# CubeSandbox Plugin for Paperclip

Execute code securely in isolated sandbox environments within Paperclip. This plugin provides seamless integration with CubeSandbox, enabling safe code execution across multiple programming languages with full output capture and file I/O support.

## Features

- **Multi-language support**: Execute Python, JavaScript, and Bash code
- **Isolated execution**: Run code in fully sandboxed environments without access to host resources
- **Output capture**: Capture stdout, stderr, and exit codes
- **File I/O**: Read and write files within sandbox (isolated from host filesystem)
- **Multiple sandboxes**: Create and manage multiple concurrent sandboxes
- **Web UI**: Interactive code execution interface
- **Worker API**: Programmatic access via Paperclip's worker system
- **Performance**: Sub-150ms sandbox creation, <50ms code execution
- **Stateful execution**: Maintain sandbox state across multiple executions

## Quick Start

### Prerequisites

- Node.js 18+
- pnpm
- Access to a running CubeSandbox API server

### Installation

1. **Install dependencies:**
   ```bash
   cd /home/user/dev/paperclip-plugins/cubesandbox
   pnpm install
   ```

2. **Configure environment variables:**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` with your CubeSandbox credentials:
   ```env
   CUBESANDBOX_SERVER_URL=https://api.cubesandbox.example.com
   CUBESANDBOX_API_KEY=your-api-key-here
   CUBESANDBOX_TEMPLATE_ID=your-template-id-here
   ```

3. **Build the plugin:**
   ```bash
   pnpm build
   ```

4. **Install into Paperclip:**
   ```bash
   paperclipai plugin install /home/user/dev/paperclip-plugins/cubesandbox
   ```

### Basic Usage

#### Via Web UI

1. Navigate to the **CubeSandbox** page in Paperclip
2. Select your programming language from the dropdown
3. Write or paste your code in the editor
4. Click **Execute**
5. View the results including stdout, stderr, and exit code

Example code to execute:
```python
# Python
print("Hello from CubeSandbox!")
result = 2 + 2
print(f"2 + 2 = {result}")
```

```bash
# Bash
echo "Hello from CubeSandbox!"
date
whoami
```

```javascript
// JavaScript
console.log("Hello from CubeSandbox!");
console.log(2 + 2);
```

#### Via Worker API

Use the worker API from Paperclip agents to execute code programmatically:

```typescript
// Execute Python code
const result = await worker.execute('print("Hello")', 'python');
console.log(result.status);      // 'success' or 'error'
console.log(result.output);      // captured stdout
console.log(result.stderr);      // captured stderr
console.log(result.exit_code);   // exit code from execution

// Get current sandbox information
const info = await worker.getSandboxInfo();
console.log(info.id);            // sandbox ID
console.log(info.status);        // 'running', 'paused', etc.
console.log(info.createdAt);     // creation timestamp
console.log(info.expiresAt);     // expiration timestamp

// List all available sandboxes
const sandboxes = await worker.listSandboxes();
console.log(sandboxes.length);   // number of sandboxes

// Terminate sandbox when done
await worker.terminateSandbox();
```

## Configuration

### Environment Variables

The plugin reads configuration from environment variables. These can be set via:
- `.env` file in the plugin directory
- Paperclip plugin configuration interface
- System environment variables

**Required variables:**
- `CUBESANDBOX_SERVER_URL`: Base URL of your CubeSandbox API server (e.g., `https://api.cubesandbox.example.com`)
- `CUBESANDBOX_API_KEY`: API key for authentication
- `CUBESANDBOX_TEMPLATE_ID`: Default template ID to use when creating sandboxes

### Plugin Configuration

The plugin manifest (`src/manifest.ts`) defines a configuration schema that can be edited in Paperclip's plugin settings:

```json
{
  "serverUrl": "https://api.cubesandbox.example.com",
  "apiKey": "your-api-key",
  "templateId": "your-template-id"
}
```

## Architecture

### Plugin Structure

```
src/
├── manifest.ts           # Plugin metadata and configuration schema
├── worker.ts            # Background worker with RPC handlers
├── client/
│   ├── config.ts        # Configuration loading from environment
│   ├── cubesandbox.ts   # API client wrapper
│   └── index.ts         # Public exports
├── ui/
│   └── index.tsx        # React UI component
└── types/
    └── index.ts         # TypeScript type definitions
```

### Client Library

The `CubeSandboxClient` class provides a TypeScript wrapper around the CubeSandbox API:

- **Initialization**: Takes configuration object with `serverUrl`, `apiKey`, `templateId`
- **Stateful**: Maintains sandbox ID across method calls
- **Error handling**: Throws descriptive errors on API failures

Methods:
- `createSandbox()`: Create new sandbox and return its ID
- `execute(options)`: Run code in current sandbox
- `getSandboxInfo()`: Get metadata about current sandbox
- `listSandboxes()`: List all running sandboxes
- `terminateSandbox()`: Delete current sandbox
- `setSandboxId(id)`: Set which sandbox to operate on
- `getSandboxId()`: Get current sandbox ID

### Worker API

The plugin exports a worker API that Paperclip agents use to access the plugin. The worker manages the sandbox lifecycle:

- Creates a sandbox on first use
- Reuses the same sandbox for subsequent executions
- Provides methods: `execute()`, `getSandboxInfo()`, `listSandboxes()`, `terminateSandbox()`

### UI

The web interface provides:
- Language selector (Python, JavaScript, Bash)
- Code editor with syntax highlighting support
- Execute button
- Results panel showing status, stdout, stderr, and exit code

## Development

### Setup

```bash
pnpm install
```

### Build

Build for production:
```bash
pnpm build
```

Watch mode (rebuilds on file changes):
```bash
pnpm dev
```

### Testing

Run unit and integration tests:
```bash
pnpm test
```

Run E2E tests against a live CubeSandbox instance:
```bash
bash tests/e2e.sh
```

### Type Checking

```bash
pnpm typecheck
```

### UI Development

Start dev server for UI components:
```bash
pnpm dev:ui
```

## Advanced Usage

### File I/O in Sandboxes

Files written in a sandbox persist within that sandbox across executions:

```python
# Write a file
with open('/tmp/data.txt', 'w') as f:
    f.write('Hello from sandbox')

# In a later execution in the same sandbox:
with open('/tmp/data.txt', 'r') as f:
    print(f.read())  # Prints: Hello from sandbox
```

### Sandbox Isolation

Each sandbox is completely isolated:
- Separate filesystem (cannot access host files)
- Separate process namespace (different hostname, init process)
- Network restrictions (cannot access host services)
- File isolation between sandboxes (sandbox A cannot see sandbox B's files)

### Error Handling

The worker API returns errors in the response object:

```typescript
const result = await worker.execute('import nonexistent', 'python');
if (result.status === 'error') {
  console.error('Execution failed:', result.error);
  console.error('Stderr:', result.stderr);
}
```

Errors thrown by methods (vs. returned in result):
- `getSandboxInfo()`, `listSandboxes()`, `terminateSandbox()` throw on API errors
- `execute()` always returns a result object (status + details)

## API Reference

See [API_DOCS.md](./API_DOCS.md) for detailed API documentation.

## Integration Guide

See [INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md) for examples of using the plugin in Paperclip agents and workflows.

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for release notes and version history.

## Troubleshooting

### Configuration Errors

**Error: "CUBESANDBOX_SERVER_URL environment variable is required"**
- Ensure `.env` file exists with `CUBESANDBOX_SERVER_URL` set
- Or set the environment variable before starting Paperclip
- Check that the URL is valid (no trailing slash needed)

### Connection Issues

**Error: "CubeSandbox API error: 401"**
- Verify your `CUBESANDBOX_API_KEY` is correct
- Check that the API key hasn't expired

**Error: "CubeSandbox API error: 404"**
- Verify `CUBESANDBOX_SERVER_URL` is correct and accessible
- Check that the server is running

### Sandbox Issues

**Error: "Sandbox not created. Call createSandbox() first."**
- The plugin should auto-create a sandbox on first use
- If this error occurs, try restarting the agent
- Check that the template ID is valid

**Sandbox creation timeout**
- May indicate server overload
- Try again in a few moments

## Performance Characteristics

Based on E2E testing against CubeSandbox:
- Sandbox creation: <150ms (typical ~100ms)
- Code execution: <50ms (typical ~20-30ms)
- Sandbox list: <100ms

## Related Documentation

- [CubeSandbox GitHub](https://github.com/TencentCloud/CubeSandbox)
- [Paperclip Plugin SDK](https://github.com/paperclipai/sdk)
- [Paperclip Agent Documentation](https://docs.paperclip.ai/agents)

## License

MIT

## Support

For issues or questions:
1. Check [INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md) for usage examples
2. Review the [tests/e2e.sh](./tests/e2e.sh) for working examples
3. Check CubeSandbox API documentation at https://github.com/TencentCloud/CubeSandbox
