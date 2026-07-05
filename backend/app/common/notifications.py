import smtplib
from email.mime.text import MIMEText

from app.core.config import get_settings

SMTP_HOST = "smtp.gmail.com"
SMTP_PORT = 465


def send_email(to: str, subject: str, body: str) -> None:
    """Send a plain-text email via Gmail SMTP.

    Uses the app's own Gmail account (EMAIL_ADDRESS / EMAIL_APP_PASSWORD) to
    authenticate and as the "From" address; `to` is the recipient.
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
