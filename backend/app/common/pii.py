"""PII detection before persistence.

Regex + simple rules-based scanning only — deliberately no call to an
external API to do this check, since sending the very text we're scanning
for leaks to a third party would itself be a privacy leak (per
docs/guardrails/ROOT_AGENT.md's memory-write rules). "NER-lite" here means
a handful of structural heuristics (e.g. "number + street-suffix word" for
addresses), not a trained model — good enough to catch common shapes
without a new ML dependency.

Used by:
  - app/common/memory.py's remember() — redact before embedding/storing.
  - app/common/notifications.py callers — flag (not silently redact)
    unexpected PII in outbound message bodies for HITL review.
"""

import logging
import re
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class PIIFinding:
    kind: str  # "email", "phone", "ssn", "aadhaar", "pan", "credit_card", "address"
    text: str
    start: int
    end: int


PLACEHOLDERS = {
    "email": "[EMAIL_REDACTED]",
    "phone": "[PHONE_REDACTED]",
    "ssn": "[SSN_REDACTED]",
    "aadhaar": "[AADHAAR_REDACTED]",
    "pan": "[PAN_REDACTED]",
    "credit_card": "[CARD_REDACTED]",
    "address": "[ADDRESS_REDACTED]",
}

_EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")

# US SSN: 123-45-6789 (hyphens required — otherwise indistinguishable from
# a phone number, which is handled separately).
_SSN_RE = re.compile(r"(?<!\d)\d{3}-\d{2}-\d{4}(?!\d)")

# Indian Aadhaar: 12 digits, conventionally grouped in 4s (with space or
# hyphen) — require the grouping to avoid matching arbitrary 12-digit runs.
_AADHAAR_RE = re.compile(r"(?<!\d)\d{4}[ -]\d{4}[ -]\d{4}(?!\d)")

# Indian PAN: 5 letters, 4 digits, 1 letter (e.g. ABCDE1234F).
_PAN_RE = re.compile(r"\b[A-Z]{5}\d{4}[A-Z]\b")

# Candidate credit card runs — 13-19 digits, optionally grouped in 4s by
# space/hyphen. Luhn-validated afterward to cut false positives on
# arbitrary long numbers (order ids, phone numbers, etc.).
_CARD_CANDIDATE_RE = re.compile(r"(?<!\d)(?:\d[ -]?){13,19}(?!\d)")

# Phone numbers — requires either a leading "+", parens, or a separator, OR
# exactly 10 bare digits (the common length for a phone number on its own).
# This deliberately does NOT match arbitrary short digit runs, prices, or
# years, to keep the false-positive rate low on everyday sentences.
_PHONE_RE = re.compile(
    r"(?<!\w)(?:"
    r"\+\d{1,3}[\s.-]?\(?\d{2,4}\)?(?:[\s.-]?\d{2,4}){1,3}"  # +<cc> ...
    r"|\(\d{2,4}\)[\s.-]?\d{3,4}[\s.-]?\d{3,4}"  # (area) xxx-xxxx
    r"|\d{3,4}[\s.-]\d{3,4}[\s.-]\d{3,4}"  # xxx-xxx-xxxx style, hyphen/space required
    r"|\d{10}"  # bare 10 digits
    r")(?!\w)"
)

# Very light "street address" heuristic: a number followed by 1-4 words
# followed by a common street-suffix word. Intentionally narrow (misses
# many real addresses, e.g. apartment/unit-only or non-English suffixes)
# to keep false positives low — a rules-based lower bound, not a complete
# address detector.
_STREET_SUFFIXES = (
    r"Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|"
    r"Court|Ct|Way|Place|Pl|Terrace|Ter|Circle|Cir|Highway|Hwy"
)
_ADDRESS_RE = re.compile(
    rf"\b\d{{1,6}}\s+[A-Za-z0-9][A-Za-z0-9.'\s]{{0,40}}?\b(?:{_STREET_SUFFIXES})\b\.?",
    re.IGNORECASE,
)


def _luhn_valid(digits: str) -> bool:
    total = 0
    for i, ch in enumerate(reversed(digits)):
        n = int(ch)
        if i % 2 == 1:
            n *= 2
            if n > 9:
                n -= 9
        total += n
    return total % 10 == 0


def _find_credit_cards(text: str) -> list[PIIFinding]:
    findings = []
    for match in _CARD_CANDIDATE_RE.finditer(text):
        digits = re.sub(r"[ -]", "", match.group(0))
        if len(digits) < 13 or len(digits) > 19:
            continue
        if _luhn_valid(digits):
            findings.append(
                PIIFinding("credit_card", match.group(0), match.start(), match.end())
            )
    return findings


def scan(text: str) -> list[PIIFinding]:
    """All PII findings in `text`, non-overlapping — more specific pattern
    kinds (email, credit card, SSN, Aadhaar, PAN) take priority over the
    more general phone/address heuristics when spans overlap."""
    if not text:
        return []

    candidates: list[PIIFinding] = []
    candidates += [
        PIIFinding("email", m.group(0), m.start(), m.end())
        for m in _EMAIL_RE.finditer(text)
    ]
    candidates += _find_credit_cards(text)
    candidates += [
        PIIFinding("ssn", m.group(0), m.start(), m.end())
        for m in _SSN_RE.finditer(text)
    ]
    candidates += [
        PIIFinding("aadhaar", m.group(0), m.start(), m.end())
        for m in _AADHAAR_RE.finditer(text)
    ]
    candidates += [
        PIIFinding("pan", m.group(0), m.start(), m.end())
        for m in _PAN_RE.finditer(text)
    ]
    candidates += [
        PIIFinding("phone", m.group(0), m.start(), m.end())
        for m in _PHONE_RE.finditer(text)
    ]
    candidates += [
        PIIFinding("address", m.group(0), m.start(), m.end())
        for m in _ADDRESS_RE.finditer(text)
    ]

    # Priority order for overlap resolution: earlier kind wins.
    priority = {
        "email": 0,
        "credit_card": 1,
        "ssn": 2,
        "aadhaar": 3,
        "pan": 4,
        "phone": 5,
        "address": 6,
    }
    candidates.sort(key=lambda f: (f.start, priority[f.kind], -(f.end - f.start)))

    accepted: list[PIIFinding] = []
    occupied: list[tuple[int, int]] = []
    for finding in candidates:
        if any(finding.start < end and finding.end > start for start, end in occupied):
            continue
        accepted.append(finding)
        occupied.append((finding.start, finding.end))

    accepted.sort(key=lambda f: f.start)
    return accepted


def contains_pii(text: str) -> bool:
    return bool(scan(text))


def redact(text: str) -> tuple[str, list[PIIFinding]]:
    """Returns (redacted_text, findings). Each finding's span in the
    original text is replaced with a typed placeholder
    (e.g. "[EMAIL_REDACTED]"). Logs when a redaction occurs (caller-visible
    audit trail), per Prompt 11.5.2."""
    findings = scan(text)
    if not findings:
        return text, []

    result = text
    for finding in sorted(findings, key=lambda f: f.start, reverse=True):
        placeholder = PLACEHOLDERS[finding.kind]
        result = result[: finding.start] + placeholder + result[finding.end :]

    logger.warning(
        "pii.redact: redacted %d finding(s): %s",
        len(findings),
        ", ".join(f.kind for f in findings),
    )
    return result, findings
