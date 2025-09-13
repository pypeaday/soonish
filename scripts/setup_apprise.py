import apprise
import os

GOTIFY_API_TOKEN = os.getenv('GOTIFY_API_TOKEN')

# Create an Apprise instance
apobj = apprise.Apprise()

# Create an Config instance
config = apprise.AppriseConfig()

# Add a configuration source:
# NOTE: not sure if we'll use a file or not
# config.add('config/apprise.txt')

# Make sure to add our config into our apprise object
apobj.add(config)

apobj.add(f'gotify://gotify.paynepride.com/{GOTIFY_API_TOKEN}/?priority=normal&format=text&overflow=upstream', tag='urgent')

# Then notify these services any time you desire. The below would
# notify all of the services that have not been bound to any specific
# tag.
apobj.notify(
    body='what a great notification service!',
    title='my notification title',
)

# Tagging allows you to specifically target only specific notification
# services you've loaded:
apobj.notify(
    body='send a notification to our admin group',
    title='Attention Admins',
    # notify any services tagged with the 'admin' tag
    tag='urgent',
)

# If you want to notify absolutely everything (regardless of whether
# it's been tagged or not), just use the reserved tag of 'all':
apobj.notify(
    body='send a notification to our admin group',
    title='Attention Admins',
    # notify absolutely everything loaded, regardless on whether
    # it has a tag associated with it or not:
    tag='all',
)