# These are example apprise integrations that notifiq/soonish will support and what I want to use while developing
import apprise
import os

GOTIFY_API_TOKEN = os.getenv('GOTIFY_API_TOKEN')

SMTP_PORT = os.environ.get("SMTP_PORT", 587)

# planning on using gmail for unverified users and protonmail for verified user email communications
VERIFIED = False

if VERIFIED:
    SMTP_APP_USER=os.environ.get("PROTON_APP_USER")
    SMTP_APP_PASSWORD=os.environ.get("PROTON_APP_PASSWORD")
    SMTP_SERVER = os.environ.get("SMTP_SERVER", "smtp.protonmail.ch")
else:
    # Google sinc eit's just supported by apprise already
    SMTP_APP_USER=os.environ.get("GOOGLE_APP_USER")
    SMTP_APP_PASSWORD=os.environ.get("GOOGLE_APP_PASSWORD")
    SMTP_SERVER = os.environ.get("SMTP_SERVER", "smtp.gmail.com")

# Create an Apprise instance
apobj = apprise.Apprise()

# Create an Config instance
config = apprise.AppriseConfig()

# Make sure to add our config into our apprise object
apobj.add(config)

# Gotify for example
apobj.add(f'gotify://gotify.paynepride.com/{GOTIFY_API_TOKEN}/?priority=normal&format=text&overflow=upstream', tag='urgent')

phone_number = os.getenv('PHONE_NUMBER')
provider_domain = "vzwpix.com"


# SMS via SMTP
apobj.add( f'mailtos://?to={phone_number}@{provider_domain}&smtp={SMTP_SERVER}&user={SMTP_APP_USER}&pass={SMTP_APP_PASSWORD}')

# NOTE: the `from=` directive does not do anything in protonmail, probably not a big deal
# Email via SMTP
# apobj.add( f'mailtos://?to=nic.payne@pm.me&smtp={SMTP_SERVER}&user={SMTP_APP_USER}&pass={SMTP_APP_PASSWORD}&from=Notifiq <{SMTP_APP_USER}>')

apobj.notify(
    body='You have a reminder!',
    title='Notifiq Test',
)