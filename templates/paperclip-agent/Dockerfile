# CubeSandbox template for Paperclip agents running the Claude Code CLI.
#
# Extends CubeSandbox's own code-interpreter image so the base template
# already carries whatever CubeSandbox's guest agent (envd) needs to boot and
# expose the sandbox over CubeProxy. This Dockerfile only adds what
# Paperclip's sandbox contract requires on top of that
# (see ../../docs/SELF_HOSTING.md#3b-paperclip-agent-template and
# SANDBOX-REQUIREMENTS.md in the Paperclip repo):
#   - node >= 24 on PATH
#   - the Claude Code CLI (`claude`) on PATH
#   - sh and tar
#   - writable home, cache, tmp, and workspace directories
#
# It deliberately does not touch any login profile or rc file, and does not
# source nvm: Paperclip's runtime execs commands non-interactively and never
# sources profiles itself, so PATH must already be correct for a bare `exec`.
#
# The base image is Debian-based (glibc + apt). If your CubeSandbox base
# image differs, adjust the package manager invocations below accordingly.
FROM cube-sandbox-int.tencentcloudcr.com/cube-sandbox/sandbox-code:latest

ENV NODE_MAJOR=24
ENV HOME=/home/user
ENV NPM_CONFIG_CACHE=/home/user/.cache/npm

# Install Node.js 24.x from NodeSource if the base image doesn't already
# carry a new enough version, then install the Claude Code CLI globally so
# it lands on the system PATH (no per-user rc file required).
RUN set -eux; \
    if command -v node >/dev/null 2>&1 && [ "$(node -e 'console.log(process.versions.node.split(".")[0])')" -ge "$NODE_MAJOR" ]; then \
      echo "node >= ${NODE_MAJOR} already present: $(node -v)"; \
    else \
      apt-get update; \
      apt-get install -y --no-install-recommends ca-certificates curl gnupg; \
      curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -; \
      apt-get install -y --no-install-recommends nodejs; \
      rm -rf /var/lib/apt/lists/*; \
    fi; \
    command -v sh; \
    command -v tar; \
    node -v

RUN npm install -g @anthropic-ai/claude-code && \
    command -v claude && \
    claude --version

# Writable home, cache, tmp, and workspace directories per
# SANDBOX-REQUIREMENTS.md. No credentials are baked into the image; the
# Claude Code CLI reads its auth from the environment the plugin's execute
# hook passes in at run time, not from anything written here.
RUN mkdir -p /home/user/.cache/npm /home/user/.claude /workspace /tmp && \
    chmod -R 0777 /home/user /workspace && \
    chmod 1777 /tmp

WORKDIR /workspace
