# Models

## Organization

id | uuid
name | string
admin_user_id | uuid
user_ids | uuid[]

## User

id | uuid
email | string
is_verified | bool
config_key | string
verify_sent_at | datetime
organization_id | uuid

## Integrations

id | uuid
user_id | uuid
apprise_config_json | json
possible_tags | json

## Event

id | uuid
owner_user_id | uuid
event_details | eventDetails
status | string
public | bool
allowed_user_ids | uuid[]

## EventDetails

event_id | uuid
name | string
start_date | datetime
end_date | datetime
extra_details | json

## EventUpdates

id | uuid
event_id | uuid
created_by_user_id | uuid
update_type | enum ["TIME", "NAME", "CANCEL", "EXTRA_DETAILS", "PARTICIPANT_QUERY]
update_content | eventUpdateContent

## EventUpdateContent

id | uuid
event_id | uuid
extra_details | json

## EventParticipants

id | uuid
event_id | uuid
user_id | uuid
notification_tags | json
custom_frequency | enum ["EVERY", "BEFORE"]
custom_time_delta_seconds | int


