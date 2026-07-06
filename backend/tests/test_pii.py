"""Tests for app/common/pii.py — confirms the scanner catches common PII
shapes and measures its false-positive rate on ordinary, PII-free sentences
(Prompt 11.5.2)."""

from app.common.pii import contains_pii, redact, scan

# --- Positive cases: each should be detected as the given kind -------------

POSITIVE_CASES = [
    ("email", "Reach me at john.doe@example.com for details."),
    ("phone", "Call me at 555-123-4567 tomorrow."),
    ("phone", "My number is +1 555-123-4567."),
    ("phone", "Ping me on 9876543210 anytime."),
    ("ssn", "My SSN is 123-45-6789, keep it safe."),
    ("aadhaar", "Aadhaar number: 1234 5678 9123."),
    ("pan", "PAN card is ABCDE1234F."),
    ("credit_card", "Card number 4111111111111111 was charged."),
    ("address", "I live at 123 Main Street, apartment 4."),
    ("address", "Ship it to 456 Oak Avenue please."),
]


def test_positive_cases_are_detected():
    for expected_kind, text in POSITIVE_CASES:
        findings = scan(text)
        kinds = [f.kind for f in findings]
        assert (
            expected_kind in kinds
        ), f"expected {expected_kind!r} in {text!r}, got {kinds}"
        assert contains_pii(text) is True


def test_redact_replaces_with_typed_placeholder():
    text = "Email me at jane@example.com about the invoice."
    redacted, findings = redact(text)
    assert "[EMAIL_REDACTED]" in redacted
    assert "jane@example.com" not in redacted
    assert len(findings) == 1
    assert findings[0].kind == "email"


def test_redact_handles_multiple_findings_without_offset_corruption():
    text = "Contact jane@example.com or call 555-123-4567."
    redacted, findings = redact(text)
    assert "[EMAIL_REDACTED]" in redacted
    assert "[PHONE_REDACTED]" in redacted
    assert "jane@example.com" not in redacted
    assert "555-123-4567" not in redacted
    assert len(findings) == 2


def test_credit_card_requires_luhn_validity():
    # A random 16-digit run that is NOT a valid card number (fails Luhn)
    # should not be flagged as a credit card — otherwise this pattern would
    # false-positive on things like arbitrary order/reference numbers.
    invalid_card = "1234567890123456"
    findings = scan(f"Reference number: {invalid_card}.")
    assert "credit_card" not in [f.kind for f in findings]


def test_no_pii_returns_empty():
    assert scan("Just a normal sentence with no personal data.") == []
    assert contains_pii("Nothing sensitive here.") is False


# --- Negative cases: ordinary sentences that must NOT trigger a false positive

EVERYDAY_SENTENCES = [
    "I finished 10 tasks today and drank 2 liters of water.",
    "The meeting is at 3:00 PM on July 6, 2026.",
    "My score was 95 out of 100 on the practice test.",
    "Order #12345678 shipped yesterday.",
    "I ran 5 kilometers in 32 minutes this morning.",
    "I saved 1500 rupees this month on groceries.",
    "The task is due 2026-07-06T10:30, please remind me.",
    "Room 204, second floor, next to the elevator.",
    "We need about 3-4 people for this project.",
    "The recipe needs 2 cups of flour and 1 teaspoon of salt.",
]


def test_false_positive_rate_on_everyday_sentences():
    """Measures (and asserts a ceiling on) the false-positive rate across a
    handful of ordinary, PII-free example messages — per Prompt 11.5.2."""
    false_positives = [s for s in EVERYDAY_SENTENCES if contains_pii(s)]
    rate = len(false_positives) / len(EVERYDAY_SENTENCES)
    assert rate == 0.0, f"false positives ({rate:.0%}): {false_positives}"
