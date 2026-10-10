# Forgejo API cookbook

Base: `https://git.paynepride.com/api/v1`. Auth: `Authorization: token <tok>`.

## Tokens

Mint your own per agent (never reuse, never commit):

```bash
ssh ghost "docker exec forgejo forgejo admin user generate-access-token \
  --username nic --token-name <agent> --scopes write:repository,write:issue"
```

Scopes that matter: `write:repository` = PR create/merge + push checks;
`write:issue` = comments, labels, assets; `write:package` = registry push.

## Pull requests

```bash
# create
POST /repos/nic/notifiq/pulls  {"title","head","base","body"}
# merge — POST (not PUT! a PUT 405s):
POST /repos/nic/notifiq/pulls/<n>/merge  {"Do":"merge"}   # merge|rebase|squash
# PR state
GET  /repos/nic/notifiq/pulls/<n>     → .merged, .mergeable, .head.sha
```

## Comments + image attachments

```bash
POST /repos/nic/notifiq/issues/<n>/comments   {"body"}
# upload (works on issues AND PR numbers — PRs are issues):
POST /repos/nic/notifiq/issues/<n>/assets     -F attachment=@file.png
# → returns browser_download_url (https://git.paynepride.com/attachments/<uuid>)
#   embed it in markdown bodies/comments directly.
```

Durable alternative for screenshots: commit under `proof/assets/` and use
relative `![]()` links in the manifest — they render in Forgejo markdown and
travel with the branch.

## CI status + logs

```bash
GET /repos/nic/notifiq/actions/tasks?limit=N   # run list (name/status/run_number)
GET /repos/nic/notifiq/commits/<sha>/status    # per-JOB status contexts
```

No `/actions/jobs` API on this version — for step logs see `.agents/ci.md`.

## Gotchas hit in practice

- Merge 405 → you used PUT; it's POST.
- `KeyError: 'number'` after PR create → the response was an error envelope
  (`message` field) — usually token scope (`write:repository` needed).
- Email-validator rejects reserved TLDs (`@test.local`) — use a real domain.
