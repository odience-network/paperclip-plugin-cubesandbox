#!/usr/bin/env bash
# Build, push, and register the paperclip-agent CubeSandbox template.
#
# Usage:
#   ./build.sh <registry>/paperclip-agent:v1
#
# Run this on (or with network access to) the Cube host, with `cubemastercli`
# configured against your CubeSandbox deployment and `docker` logged in to
# <registry>. Building against the real host is a separate infra task from
# this repo; this script only wraps the two commands documented in
# ../../docs/SELF_HOSTING.md#3b-paperclip-agent-template.
set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "Usage: $0 <registry>/paperclip-agent:v1" >&2
  exit 1
fi

IMAGE="$1"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "==> Building ${IMAGE}"
docker build -t "${IMAGE}" "${SCRIPT_DIR}"

echo "==> Pushing ${IMAGE}"
docker push "${IMAGE}"

echo "==> Registering CubeSandbox template from ${IMAGE}"
cubemastercli tpl create-from-image \
  --image "${IMAGE}" \
  --writable-layer-size 4G \
  --expose-port 49983 \
  --probe 49983

cat <<EOF

Template submitted. Watch it with:
  cubemastercli tpl watch --job-id <job_id>

Once it reports READY, give it the alias 'paperclip-agent-v1' (see
docs/guide/template-aliases.md in the CubeSandbox repo) so Paperclip
environments can reference a stable name across future rebuilds of this
image.
EOF
