# Vision

The service is known by soonish or notifiq for now. The core principle is notifications for people where they are at, not where an event organizer needs them to be (ie. a specific app or facebook etc.). Soonish is the admin portal for communicating with your guests/attendees about events. 

Event organizers can create an event with generic details. Events can be public or private (invite only). The event organizer creates the event and sends an invite link to whomever they want. From there, the users have multiple paths of interaction:

1. They don't have to create an account - from the event link they can pull up the event (assuming it's public) and add their email to be notified of any updates to the event (ie. the event owner changes the time or a detail) as well as receive a reminder about the event.
2. Users with an account can save notification preferences and receive notifications in any of the ways [apprise]() supports, which is several backends. The power here is users can get notifications for anything in the way they already get notifications.

The product philosophy can be applied to many markets:

1. the obvious is event organization and communicating with guests/attendees
2. churches may use this for coordinating volunteer efforts
3. a totally different use case may be IT ticketing - where an event is created and the service has PagerDuty notifications - the PD config can live in soonish and the IT team can use the simple soonish service for issuing updates to everyone in their own preferred manner.
4. eventually we may have the ability for participants to ask a question or send their own updates, opening the door for participants to ask general questions of an event... we are not sure if this exceeds the scope of what we want soonish to be though.