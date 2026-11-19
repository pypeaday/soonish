# CI image for notifiq verify runs.
#
# Bakes every tool `just verify` needs so workflow runs don't fetch installers
# (or the temporal test-server binary) from the internet at run time.
#
# Build + push (from repo root):
#   docker build -t git.paynepride.com/nic/notifiq-ci:<tag> ci/
#   docker push git.paynepride.com/nic/notifiq-ci:<tag>
#
# Used by .forgejo/workflows/verify.yml via `container:`.

FROM node:20-bookworm

# uv + uvx, pinned by image tag (bump the tag to upgrade).
COPY --from=ghcr.io/astral-sh/uv:0.9.5 /uv /uvx /usr/local/bin/

# python3.11 = bookworm default python3. git/bash are required by actions/checkout
# and justfile recipes; curl is used by the test lane's health checks.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        python3 python3-venv python3-pip \
        git bash curl ca-certificates jq \
    && rm -rf /var/lib/apt/lists/*

# just (repo entry points are justfiles).
RUN curl --proto '=https' --tlsv1.2 -sSf https://just.systems/install.sh \
      | bash -s -- --to /usr/local/bin \
    && just --version

# Temporal CLI (dev server for `just test-full` / `verify-integration`).
RUN curl -sSf https://temporal.download/cli.sh | sh \
    && mv "$HOME/.temporalio/bin/temporal" /usr/local/bin/temporal \
    && chmod +x /usr/local/bin/temporal \
    && temporal --version

# Python SDK test-server binary, pre-fetched to the SDK's cache path so
# WorkflowEnvironment.start_time_skipping() never hits the network in CI.
# Path rule (temporalio sdk-core): <tempdir>/temporal-test-server-<sdk>-<ver>.
# Bump when backend/uv.lock bumps temporalio. The /default endpoint returns a
# manifest {archiveUrl, fileToExtract} pointing at a tar.gz — resolve + extract.
RUN curl -sSfL \
      "https://temporal.download/temporal-test-server/default?arch=amd64&platform=linux&sdk-name=sdk-python&sdk-version=1.18.1" \
      -o /tmp/ts-manifest.json \
    && archive_url="$(jq -r .archiveUrl /tmp/ts-manifest.json)" \
    && file_to_extract="$(jq -r .fileToExtract /tmp/ts-manifest.json)" \
    && curl -sSfL "$archive_url" -o /tmp/ts.tar.gz \
    && tar -xzf /tmp/ts.tar.gz -C /tmp "$file_to_extract" \
    && mv "/tmp/$file_to_extract" /tmp/temporal-test-server-sdk-python-1.18.1 \
    && chmod +x /tmp/temporal-test-server-sdk-python-1.18.1 \
    && ln -s /tmp/temporal-test-server-sdk-python-1.18.1 /usr/local/bin/temporal-test-server \
    && rm -f /tmp/ts-manifest.json /tmp/ts.tar.gz \
    && test -x /tmp/temporal-test-server-sdk-python-1.18.1

# Verify jobs must never address shared prod services.
ENV TEMPORAL_URL=localhost:7233 \
    CI=true

CMD ["bash"]
