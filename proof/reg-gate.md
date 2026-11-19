# Proof: registration gate — `REGISTRATION_OPEN=false` makes /register invite-only

**

**Claim:** a new env flag gates `POST /register` on a valid `invitation_token`
(existing org-invitation plumbing). Verified live on the worktree stack with
`REGISTRATION_OPEN=false`: no token → 403, bogus token → 400, real org
invitation → 201 + auto-verified. Also closes a silent-ignore bug: an invalid
token previously registered an unverified user anyway; now 400 either way.
Closes #21.


## Change


## Claims

- `REGISTRATION_OPEN` (BaseSettings field `registration_open`, default
  `true`) — unset = today's behavior, `false` = invite-only
- Live stack probes (stack ran with `REGISTRATION_OPEN=false`):
  - `POST /auth/register` no token → **403**
  - `POST /auth/register` `invitation_token:"bogus"` → **400**
  - `POST /organizations/{id}/invitations` as admin → real token →
    register → **201**
- Behavior change (intentional): invalid `invitation_token` now 400s under
  open registration too — previously silently registered unverified

## Evidence

## Evidence

## Not proven

- Register page UI copy under a closed gate (API 403s; a friendly
  "invite-only" message on `/app/register` is follow-up polish, not
  correctness)
- Deploy-time env: `REGISTRATION_OPEN=false` must be set on the prod
  compose env — deploy decision, not this PR.

```bash
curl -s -o /dev/null -w "no-token: %{http_code}\n" -X POST http://localhost:32800/api/v1/auth/register -H "Content-Type: application/json" -d "{\"email\":\"p3@example.com\",\"password\":\"x\",\"name\":\"P\"}"; curl -s -o /dev/null -w "bad-token: %{http_code}\n" -X POST http://localhost:32800/api/v1/auth/register -H "Content-Type: application/json" -d "{\"email\":\"p3@example.com\",\"password\":\"x\",\"name\":\"P\",\"invitation_token\":\"bogus\"}"
```

```output
no-token: 403
bad-token: 400
```
