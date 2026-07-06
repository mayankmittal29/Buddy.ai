"""Tests for the PII guard on outbound notification emails (Prompt
11.5.2's second wiring point) — app/common/notifications.py."""

from unittest.mock import patch

from app.common.notifications import send_email_guarded


def test_clean_body_is_sent():
    with patch("app.common.notifications.send_email") as mock_send:
        sent = send_email_guarded(
            "user@example.com",
            "Reminder",
            "Your task is due soon.",
            source_skill="tasks",
        )
    assert sent is True
    mock_send.assert_called_once_with(
        "user@example.com", "Reminder", "Your task is due soon."
    )


def test_unexpected_pii_in_body_is_withheld():
    # Mirrors the exact example from Prompt 11.5.2: a habit-streak
    # congratulation message that unexpectedly contains a phone number.
    body = "You hit a 10-day streak! Call 555-123-4567 to celebrate."
    with patch("app.common.notifications.send_email") as mock_send:
        sent = send_email_guarded(
            "user@example.com", "Streak!", body, source_skill="habits"
        )
    assert sent is False
    mock_send.assert_not_called()


def test_unexpected_pii_in_subject_is_also_caught():
    with patch("app.common.notifications.send_email") as mock_send:
        sent = send_email_guarded(
            "user@example.com",
            "Reach jane@example.com about this",
            "Your course deadline is tomorrow.",
            source_skill="learning",
        )
    assert sent is False
    mock_send.assert_not_called()
