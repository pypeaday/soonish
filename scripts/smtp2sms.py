# /// script
# requires-python = ">=3.10"
# dependencies = [
# ]
# ///
import os, smtplib
from email.mime.text import MIMEText

# SMTP_APP_USER="notifiq.hello@gmail.com"
# SMTP_APP_PASSWORD=os.environ.get("GOOGLE_APP_PASSWORD")
# SMTP_SERVER="smtp.gmail.com"
SMTP_APP_USER=os.environ.get("PROTON_APP_USER")
SMTP_APP_PASSWORD=os.environ.get("PROTON_APP_PASSWORD")
SMTP_SERVER="smtp.protonmail.ch"

carriers = {
    "att": {
        "sms": "txt.att.net",
        "mms": "mms.att.net"
    },
    "tmobile": {
        "sms": "tmomail.net",   # works for MMS too
        "mms": "tmomail.net"
    },
    "verizon": {
        # "sms": "vtext.com", # not reliable
        "sms": "vzwpix.com",
        "mms": "vzwpix.com"
    },
    "sprint": {
        "sms": "messaging.sprintpcs.com",
        "mms": "pm.sprint.com"
    },
    "googlefi": {
        "sms": "msg.fi.google.com",
        "mms": "msg.fi.google.com"
    },
    "uscellular": {
        "sms": "email.uscc.net",
        "mms": "mms.uscc.net"
    },
    "boost": {
        "sms": "sms.myboostmobile.com",
        "mms": "myboostmobile.com"
    },
    "cricket": {
        "sms": "sms.cricketwireless.net",
        "mms": "mms.cricketwireless.net"
    },
    "metropcs": {
        "sms": "mymetropcs.com",
        "mms": "mymetropcs.com"
    },
    "virgin": {
        "sms": "vmobl.com",
        "mms": "vmobl.com"
    }
}
contacts = {
    "me": {"carrier": "verizon", "number": os.environ.get("PHONE_NUMBER")},
}
msg = MIMEText("I can send texts for free apparently from my code!")
msg["From"] = SMTP_APP_USER

SEND_TO = "me"

msg["To"] = f"{contacts[SEND_TO]['number']}@{carriers[contacts[SEND_TO]['carrier']]['sms']}"

with smtplib.SMTP(SMTP_SERVER, 587) as email_handler:
    email_handler.starttls()
    email_handler.login(SMTP_APP_USER, SMTP_APP_PASSWORD)
    email_handler.sendmail(SMTP_APP_USER, [msg["To"]], msg.as_string())
