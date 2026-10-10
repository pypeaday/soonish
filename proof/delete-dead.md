# Proof: delete two undeployed frontends

**

**Claim:** `frontend-personal-events-tracker` and `frontend-standalone-example`
removed — neither was in the Dockerfile, the stack compose, or any tunnel
route. `.agents/validation.md` (stale key list post-#40), `mirror.yml`
remove-list, `.dockerignore`, and `BuildingAppsPage.tsx` doc pointer updated.
Closes the delete half of #6.


## Change


## Claims

- Zero remaining repo references to either app dir (excluding historical
  `proof/*.md` evidence)
- `frontend-website` still builds clean (only frontend with an edit)

## Evidence

## Evidence

## Not proven

- Public GitHub mirror: `standalone-example` was never in mirror.yml's remove
  list, so it was being mirrored publicly — deleting removes it there too.
  `personal-events-tracker` was on the remove list; entry now dropped.

```bash
grep -rln 'personal-events-tracker\|standalone-example' --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.venv . | grep -v '^./proof/'
```

```output
```

```bash
grep -rln 'personal-events-tracker\|standalone-example' --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.venv . | grep -v '^./proof/' | wc -l
```

```output
0
```
