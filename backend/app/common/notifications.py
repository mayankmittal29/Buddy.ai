import logging
import smtplib
from email.mime.text import MIMEText

from app.common.pii import scan
from app.core.config import get_settings

logger = logging.getLogger(__name__)

SMTP_HOST = "smtp.gmail.com"
SMTP_PORT = 465


def send_email(to: str, subject: str, body: str) -> None:
    """Send a plain-text email via Gmail SMTP.

    Uses the app's own Gmail account (EMAIL_ADDRESS / EMAIL_APP_PASSWORD) to
    authenticate and as the "From" address; `to` is the recipient.

    Prefer send_email_guarded() at call sites that build `body` from
    stored data (task/course/habit titles, etc.) rather than text the user
    just typed in this exact turn — this function itself does no PII
    scanning, so only call it directly when the caller has already done
    an equivalent check.
    """
    settings = get_settings()
    if not settings.email_address or not settings.email_app_password:
        raise RuntimeError(
            "EMAIL_ADDRESS/EMAIL_APP_PASSWORD not configured — cannot send email."
        )

    message = MIMEText(body)
    message["Subject"] = subject
    message["From"] = settings.email_address
    message["To"] = to

    with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT) as server:
        server.login(settings.email_address, settings.email_app_password)
        server.sendmail(settings.email_address, [to], message.as_string())


def send_email_guarded(to: str, subject: str, body: str, *, source_skill: str) -> bool:
    """Guarded wrapper around send_email() for the scheduler's automated
    notifications (app/common/scheduler.py) — none of these bodies are text
    the user typed in the current conversation turn; they're assembled
    from stored task/course/habit/news titles and notes, so unexpected PII
    (e.g. a phone number someone once typed into a task title) could end up
    in an outbound email without anyone reviewing it first.

    Scans `subject`+`body` for PII (app/common/pii.py); if any is found,
    withholds the send entirely and logs a warning for HITL review rather
    than emailing it silently — per docs/guardrails/ROOT_AGENT.md's
    outbound-message rule. The in-app Notification (created regardless of
    email opt-in, see app/common/scheduler.py) still exists either way, so
    withholding the email never means the user hears nothing.

    Returns True if the email was actually sent, False if withheld.
    """
    findings = scan(f"{subject}\n{body}")
    if findings:
        logger.warning(
            "notifications.withheld: blocked an outbound email (skill=%s) — "
            "unexpected PII found (%s); needs human review before resending.",
            source_skill,
            ", ".join(sorted({f.kind for f in findings})),
        )
        return False
    send_email(to, subject, body)
    return True
