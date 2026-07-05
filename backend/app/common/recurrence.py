import re
from datetime import datetime, timedelta

WEEKDAY_ABBREVIATIONS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]

_EVERY_RE = re.compile(r"^every:(\d+)days?$")


def compute_next_due_at(due_at: datetime, rule: str) -> datetime | None:
    """Compute the next occurrence's due_at from a recurrence_rule.

    Supported formats:
      "daily"                    — every day
      "weekly:mon,wed,fri"       — on the given weekdays (lowercase, 3-letter)
      "every:3days"              — every N days

    Preserves the time-of-day from `due_at`, only shifting the date. Returns
    None if the rule can't be parsed.
    """
    rule = rule.strip().lower()

    if rule == "daily":
        return due_at + timedelta(days=1)

    if rule.startswith("weekly:"):
        days_str = rule[len("weekly:") :]
        target_days = {
            WEEKDAY_ABBREVIATIONS.index(day)
            for day in days_str.split(",")
            if day in WEEKDAY_ABBREVIATIONS
        }
        if not target_days:
            return None
        for offset in range(1, 8):
            candidate = due_at + timedelta(days=offset)
            if candidate.weekday() in target_days:
                return candidate
        return None

    match = _EVERY_RE.match(rule)
    if match:
        return due_at + timedelta(days=int(match.group(1)))

    return None
