# Considerations

- Models are expressed loosely as tables, using Temporal though the EventModel would actually be a workflow, this way event driven methodlogies can be used natively.
- RBAC to allow owners to set managers for an event
- More complicataed notification rules and bi-directional communication (planned for via the ParticipantQuery update_type)
- Repeated events
- Event feed based on location
- Private events / invite only