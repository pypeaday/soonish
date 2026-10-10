# How CI actually executes

Forgejo Actions, one self-hosted runner (`forgejo-runner` on ghost). Jobs
serialize — other repos' workflows interleave in the queue; a slow run
elsewhere delays yours.

## Runner topology

```text
verify.yml job ──► job container on the runner
                     │
                     ├─ container: notifiq-ci:0.1.0  (verify, proof-manifest)
                     │    just, uv, node20, py3.11, temporal CLI baked in
                     │
                     └─ no container: → label `docker` → act-latest image
                          (stack job, docker-build.yml) — has docker CLI

DOCKER_HOST=tcp://docker-in-docker.docker.internal:2375   (job containers)
                         │
                         ▼
              DinD daemon (dockerd on ghost's network)
                ▶ job's docker builds/containers run HERE
                ▶ published ports bind inside the DinD netns:
                  reach them at docker-in-docker.docker.internal:PORT
                  when published 0.0.0.0 — NOT via localhost
```

- `runs-on: docker` is a **label** → `ghcr.io/catthehacker/ubuntu:act-latest`
  (`.runner` file on the runner shows the mapping).
- Bare `docker-in-docker` does **not** resolve inside job containers — the
  injected name is `docker-in-docker.docker.internal` (`/etc/hosts` → the
  DinD bridge IP).
- The stack lane handles this: `STACK_BIND=0.0.0.0` +
  `STACK_HOST=docker-in-docker.docker.internal` (see verify.yml `stack` job).
- `GITHUB_RUN_ID` suffixes the compose project slug — concurrent runs share
  the DinD daemon and must not share project names.

## Debugging a CI job

- Job status per commit: `GET /api/v1/repos/nic/notifiq/commits/<sha>/status`
  → `statuses[].context` (`Verify / stack (pull_request)` etc.). The
  `/actions/runs/<id>/jobs` API doesn't exist on this Forgejo version.
- Step logs live on ghost as zstd files:
  `/tank/encrypted/docker/forjeo-zfs/forgejo/actions_log/nic/notifiq/<shard>/<task-id>.log.zst`
  — `zstd -dc <file> | less`. Task IDs appear in runner logs
  (`docker logs forgejo-runner`).
- Live inspection: job containers run **inside** DinD —
  `ssh ghost 'docker exec forgejo-docker-in-docker-1 docker -H tcp://127.0.0.1:2375 ps'`.
