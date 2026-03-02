import smtplib
import os
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv

# Force Python to read the .env file
load_dotenv()


def send_approval_email(to_email: str, name: str, temp_password: str):
    sender_email = os.getenv("SMTP_EMAIL")
    sender_password = os.getenv("SMTP_PASSWORD")

    # Debugging logs to guarantee they loaded (Will print in the backend terminal)
    print(f"[DEBUG EMAIL] Loaded Email: {sender_email}")
    print(f"[DEBUG EMAIL] Password Loaded: {'YES' if sender_password else 'NO'}")

    if not sender_email or not sender_password:
        print("[ERROR] SMTP credentials are None. Check your .env file keys!")
        return

    msg = MIMEMultipart()
    msg['From'] = sender_email
    msg['To'] = to_email
    msg['Subject'] = "Your AgriGear ERP Account is Approved!"

    body = f"Hello {name},\n\nYour account has been approved by the Admin.\n\nYour temporary password is: {temp_password}\n\nPlease log in and change your password."
    msg.attach(MIMEText(body, 'plain'))

    try:
        server = smtplib.SMTP('smtp.gmail.com', 587)
        server.starttls()
        server.login(sender_email, sender_password)
        server.send_message(msg)
        server.quit()
        print(f"[EMAIL SUCCESS] Sent to {to_email}")
    except Exception as e:
        print(f"[EMAIL FAILED] {e}")
