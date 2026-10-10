# Proof: agent/ci-stack

**Claim:** the same `just stack-*` e2e lane agents run in worktrees now runs
in CI on every PR — full product (Temporal + api + worker + all frontends)
built from the commit, against the runner's DinD daemon, no new CI image.

## What changed

- `docker-compose.stack.yml` — published ports honor `STACK_BIND`
  (default `127.0.0.1` unchanged).
- `scripts/agent-stack.sh` — `STACK_HOST` (default `localhost`) for
  reachability; port parsing handles `0.0.0.0`/`[::]`; `GITHUB_RUN_ID`
  suffixes the compose slug so concurrent CI runs can't collide on the
  shared DinD daemon.
- `.forgejo/workflows/verify.yml` — new `stack` job (no `container:` — the
  `act-latest` runner image already ships docker CLI + compose; DinD via
  `DOCKER_HOST=tcp://docker-in-docker:2375`).

## Evidence

### Local defaults unchanged (STACK_BIND/STACK_HOST unset)

```console
$ scripts/agent-stack.sh up   # tail
==> stack is UP
app:          http://localhost:32780
api/docs:     http://localhost:32780/docs
temporal ui:  http://localhost:32779
temporal rpc: localhost:32778
project:      notifiq-e2e-ci-stack   image: notifiq-e2e-ci-stack

$ scripts/agent-stack.sh test
  PASS  health (/api/v1/health -> 200)
  PASS  front door (/ -> 200)
  PASS  api docs (/docs -> 200)
  PASS  spa:mission-control (/mission-control/ -> 200)
  PASS  spa:volunteer-coordinator (/volunteer-coordinator/ -> 200)
  PASS  spa:event-planner (/event-planner/ -> 200)
  PASS  spa:duty-pager (/duty-pager/ -> 200)
  PASS  spa:developer-user (/developer-user/ -> 200)
  PASS  spa:tasks (/tasks/ -> 200)
  PASS  spa:stage-manager (/stage-manager/ -> 200)
  PASS  spa:adhd-reminders (/adhd-reminders/ -> 200)
  PASS  spa:mindful (/mindful/ -> 200)
==> 0 failure(s)
```

### DinD topology the job relies on

```console
$ docker exec forgejo-runner sh -c 'cat /data/.runner'   # labels
"docker:docker://ghcr.io/catthehacker/ubuntu:act-latest"
$ docker exec forgejo-runner env | grep DOCKER_HOST
DOCKER_HOST=tcp://docker-in-docker:2375
```

## Not proven locally

- `STACK_BIND=0.0.0.0` + `STACK_HOST=docker-in-docker` reachability — only
  real inside the runner's DinD network. **This PR's own `stack` job is the
  proof**: check the Actions run on this PR — green `smoke` = ports reached
  through the daemon hostname.
