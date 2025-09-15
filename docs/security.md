# Security

- FastAPI endpoints protected via user authentication
- FastAPI admin endpoints are hidden, return 404 if user not admin
- Anonymous users are session-backed: do not create a User row until they subscribe to an event or provide an email. When email is provided, a mailto Apprise URL is stored as an Integration for that user. Unclaimed session-only users are trimmed after 60 days.
- Unsubscribe uses opaque random tokens with 60-day TTL and single-use; tokens are stored server-side (no JWT required).
- Integration `apprise_url` values are intended to be encrypted at rest in production; redact/avoid logging secret-bearing URLs or tokens.
- Enforce lowercased tags for integrations/selectors; validate integration_ids belong to the authenticated user.
- Apply basic rate limiting and circuit breaker patterns to notification activities to mitigate abuse and failing endpoints.