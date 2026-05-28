# CubeSandbox Plugin for Paperclip

This is a Paperclip plugin that integrates with CubeSandbox to execute code in isolated sandbox environments.

## Features

- Execute code in isolated CubeSandbox environments
- Support for multiple programming languages (Python, JavaScript, Bash)
- Environment-based configuration
- Web UI for code execution and result viewing
- Worker API for programmatic access

## Installation

### Prerequisites

- Node.js 18+
- pnpm

### Setup

1. Install dependencies:
```bash
pnpm install
```

2. Create a `.env` file based on `.env.example`:
```bash
cp .env.example .env
# Edit .env with your CubeSandbox credentials
```

3. Build the plugin:
```bash
pnpm build
```

4. Install into Paperclip:
```bash
paperclipai plugin install /home/user/dev/paperclip-plugins/cubesandbox
```

## Development

### Watch mode
```bash
pnpm dev
```

### Run tests
```bash
pnpm test
```

### Type checking
```bash
pnpm typecheck
```

### Build for production
```bash
pnpm build
```

## Configuration

The plugin requires the following environment variables:

- `CUBESANDBOX_SERVER_URL`: Base URL of the CubeSandbox API server
- `CUBESANDBOX_API_KEY`: Authentication key for the CubeSandbox API
- `CUBESANDBOX_TEMPLATE_ID`: Default template ID for sandbox execution

These can be configured either via environment variables or through the Paperclip plugin configuration interface.

## Usage

### Via Web UI

1. Navigate to the CubeSandbox plugin page in Paperclip
2. Select your programming language
3. Write or paste your code
4. Click "Execute"
5. View the results

### Via Worker API

```typescript
import { execute, getSandboxInfo, listSandboxes } from '@odience/cubesandbox/worker';

// Execute code
const result = await execute('print("Hello")', 'python');

// Get sandbox info
const info = await getSandboxInfo();

// List all sandboxes
const sandboxes = await listSandboxes();
```

## Architecture

### Client Library (`src/client/`)

- `config.ts`: Environment configuration loading
- `cubesandbox.ts`: Main API client wrapper with methods for:
  - `execute()`: Execute code in sandbox
  - `getSandboxInfo()`: Get current sandbox information
  - `listSandboxes()`: List all available sandboxes
  - `terminateSandbox()`: Terminate a sandbox

### Plugin Components

- `src/manifest.ts`: Plugin manifest with capabilities and configuration schema
- `src/worker.ts`: Background worker with API methods
- `src/ui/index.tsx`: React UI component for code execution

## API Reference

### CubeSandboxClient

#### Constructor
```typescript
new CubeSandboxClient(config: CubeSandboxConfig)
```

#### Methods

- `execute(options: ExecuteOptions): Promise<ExecuteResponse>`
- `getSandboxInfo(): Promise<SandboxInfo>`
- `listSandboxes(): Promise<SandboxInfo[]>`
- `terminateSandbox(): Promise<void>`

## License

MIT
