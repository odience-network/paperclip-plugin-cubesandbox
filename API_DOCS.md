# CubeSandbox Plugin API Documentation

## Overview

The CubeSandbox plugin provides a TypeScript API for executing code in isolated sandbox environments. This document covers the `CubeSandboxClient` class and the Worker API exposed to Paperclip agents.

## Table of Contents

- [CubeSandboxClient API](#cubesandboxclient-api)
- [Worker API](#worker-api)
- [Type Definitions](#type-definitions)
- [Error Handling](#error-handling)
- [Examples](#examples)

## CubeSandboxClient API

The `CubeSandboxClient` class (`src/client/cubesandbox.ts`) provides direct access to the CubeSandbox API.

### Constructor

```typescript
constructor(config: CubeSandboxConfig)
```

**Parameters:**
- `config.serverUrl` (string): Base URL of the CubeSandbox API server
- `config.apiKey` (string): API authentication key
- `config.templateId` (string): Default template ID for sandbox creation

**Example:**
```typescript
import { CubeSandboxClient } from './client/cubesandbox';

const client = new CubeSandboxClient({
  serverUrl: 'https://api.cubesandbox.example.com',
  apiKey: 'your-api-key',
  templateId: 'tpl_default_sandbox_code',
});
```

### Methods

#### `createSandbox(): Promise<string>`

Create a new sandbox instance.

**Returns:** Promise resolving to the sandbox ID

**Throws:** Error if API call fails

**Example:**
```typescript
const sandboxId = await client.createSandbox();
console.log('Created sandbox:', sandboxId);
// Output: Created sandbox: sbx_1234567890abcdef
```

---

#### `setSandboxId(id: string): void`

Set the sandbox ID for subsequent operations.

**Parameters:**
- `id` (string): The sandbox ID to operate on

**Example:**
```typescript
client.setSandboxId('sbx_1234567890abcdef');
```

---

#### `getSandboxId(): string | null`

Get the currently set sandbox ID.

**Returns:** Current sandbox ID or null if not set

**Example:**
```typescript
const currentId = client.getSandboxId();
if (currentId) {
  console.log('Operating on sandbox:', currentId);
} else {
  console.log('No sandbox selected');
}
```

---

#### `execute(options: ExecuteOptions): Promise<ExecuteResponse>`

Execute code in the current sandbox.

**Parameters:**
- `options.code` (string): Code to execute
- `options.language` (string, optional): Programming language - 'python', 'javascript', or 'bash' (default: 'python')
- `options.timeout` (number, optional): Execution timeout in milliseconds

**Returns:** Promise resolving to execution result

**Throws:** Error if sandbox not created or API call fails

**Example:**
```typescript
const result = await client.execute({
  code: 'print("Hello, World!")',
  language: 'python',
  timeout: 5000,
});

console.log(result.exit_code);       // 0
console.log(result.output);          // "Hello, World!\n"
console.log(result.execution_time_ms); // 42
```

---

#### `getSandboxInfo(): Promise<SandboxInfo>`

Get metadata about the current sandbox.

**Returns:** Promise resolving to sandbox information

**Throws:** Error if sandbox not created or API call fails

**Example:**
```typescript
const info = await client.getSandboxInfo();
console.log(info.id);           // 'sbx_1234567890abcdef'
console.log(info.status);       // 'running'
console.log(info.createdAt);    // '2024-01-15T10:30:00Z'
console.log(info.expiresAt);    // '2024-01-15T11:30:00Z'
```

---

#### `listSandboxes(): Promise<SandboxInfo[]>`

List all available sandboxes.

**Returns:** Promise resolving to array of sandbox information

**Throws:** Error if API call fails

**Example:**
```typescript
const sandboxes = await client.listSandboxes();
console.log(`Found ${sandboxes.length} sandboxes`);

for (const sandbox of sandboxes) {
  console.log(`  - ${sandbox.id} (${sandbox.status})`);
}
```

---

#### `terminateSandbox(): Promise<void>`

Delete the current sandbox.

**Returns:** Promise that resolves when sandbox is deleted

**Throws:** Error if sandbox not created or API call fails

**Note:** After calling this method, the sandbox ID is cleared. You must call `createSandbox()` again if you need a sandbox.

**Example:**
```typescript
await client.terminateSandbox();
console.log('Sandbox terminated');
// Note: client.getSandboxId() now returns null
```

---

## Worker API

The Worker API is what Paperclip agents use to interact with the plugin. It's declared in the `PluginWorkerApi` interface in `src/worker.ts`.

### Global Declaration

The plugin declares a global `PluginWorkerApi` interface that Paperclip recognizes:

```typescript
declare global {
  interface PluginWorkerApi {
    execute: (code: string, language?: string) => Promise<...>;
    getSandboxInfo: () => Promise<...>;
    listSandboxes: () => Promise<...>;
    terminateSandbox: () => Promise<void>;
  }
}
```

### Usage in Agents

When called from a Paperclip agent, use the `worker` context:

```typescript
// In a Paperclip agent
const result = await worker.execute(code, language);
```

### Methods

#### `execute(code: string, language?: string): Promise<ExecuteResult>`

Execute code in the plugin's managed sandbox.

**Parameters:**
- `code` (string): Code to execute
- `language` (string, optional): 'python' (default), 'javascript', or 'bash'

**Returns:** Promise resolving to execution result with:
- `status` (string): 'success' or 'error'
- `output` (string, optional): Captured stdout
- `stderr` (string, optional): Captured stderr
- `exit_code` (number, optional): Process exit code
- `error` (string, optional): Error message (status='error')

**Example:**
```typescript
const result = await worker.execute(
  'print("Hello"); print(2+2)',
  'python'
);

if (result.status === 'success') {
  console.log('Output:', result.output);     // "Hello\n4\n"
  console.log('Exit code:', result.exit_code); // 0
} else {
  console.log('Error:', result.error);
}
```

---

#### `getSandboxInfo(): Promise<SandboxInfoResponse>`

Get information about the current sandbox.

**Returns:** Promise resolving to:
- `id` (string): Sandbox ID
- `status` (string): Sandbox status ('running', 'paused', etc.)
- `createdAt` (string): ISO 8601 creation timestamp
- `expiresAt` (string): ISO 8601 expiration timestamp

**Throws:** Error if API call fails

**Example:**
```typescript
const info = await worker.getSandboxInfo();
console.log(`Sandbox ${info.id} is ${info.status}`);
console.log(`Expires at: ${info.expiresAt}`);
```

---

#### `listSandboxes(): Promise<SandboxInfo[]>`

Get a list of all available sandboxes.

**Returns:** Promise resolving to array with objects containing:
- `id` (string): Sandbox ID
- `status` (string): Status
- `createdAt` (string): Creation time
- `expiresAt` (string): Expiration time

**Throws:** Error if API call fails

**Example:**
```typescript
const sandboxes = await worker.listSandboxes();
console.log(`Available sandboxes: ${sandboxes.map(s => s.id).join(', ')}`);
```

---

#### `terminateSandbox(): Promise<void>`

Terminate the current sandbox.

**Returns:** Promise that resolves when complete

**Throws:** Error if API call fails

**Note:** After termination, the plugin creates a new sandbox on the next `execute()` call.

**Example:**
```typescript
await worker.terminateSandbox();
console.log('Current sandbox terminated');

// Next execution will use a new sandbox
const result = await worker.execute('print("In new sandbox")');
```

---

## Type Definitions

### CubeSandboxConfig

```typescript
interface CubeSandboxConfig {
  serverUrl: string;      // Base URL of CubeSandbox API
  apiKey: string;         // API authentication key
  templateId: string;     // Default template ID
}
```

### ExecuteOptions

```typescript
interface ExecuteOptions {
  code: string;
  language?: string;      // 'python' (default), 'javascript', 'bash'
  timeout?: number;       // Timeout in milliseconds
}
```

### ExecuteResponse

```typescript
interface ExecuteResponse {
  output?: string;        // Captured stdout
  stderr?: string;        // Captured stderr
  exit_code: number;      // Process exit code
  execution_time_ms: number; // Execution duration
}
```

### SandboxInfo

```typescript
interface SandboxInfo {
  id: string;             // Unique sandbox identifier
  status: string;         // Status ('running', 'paused', etc.)
  createdAt: string;      // ISO 8601 creation timestamp
  expiresAt: string;      // ISO 8601 expiration timestamp
}
```

### Worker API Types

```typescript
interface ExecuteResult {
  status: string;         // 'success' or 'error'
  output?: string;        // Stdout output
  stderr?: string;        // Stderr output
  exit_code?: number;     // Exit code
  error?: string;         // Error message if status='error'
}

interface SandboxInfoResponse {
  id: string;
  status: string;
  createdAt: string;
  expiresAt: string;
}
```

---

## Error Handling

### Client Errors

The `CubeSandboxClient` throws errors in these cases:

```typescript
// Sandbox not created
await client.execute(...);  // throws: "Sandbox not created. Call createSandbox() first."

// API errors
await client.getSandboxInfo();  // throws: "CubeSandbox API error: 404 Not Found - ..."

// Network/fetch errors
await client.createSandbox();  // throws: Error from fetch (network issue)
```

### Worker API Errors

The Worker API returns errors differently:

- **execute()**: Always returns a result object. On error, `result.status === 'error'` and `result.error` contains the message.

```typescript
const result = await worker.execute('invalid code', 'python');
if (result.status === 'error') {
  console.error(result.error);  // Details of execution error
  console.error(result.stderr); // Stderr from failed execution
}
```

- **getSandboxInfo(), listSandboxes(), terminateSandbox()**: Throw errors on failure.

```typescript
try {
  const info = await worker.getSandboxInfo();
} catch (error) {
  console.error('Failed to get sandbox info:', error);
}
```

### Specific API Error Codes

| Status | Meaning | How to Handle |
|--------|---------|---------------|
| 400 | Bad request (invalid parameters) | Check code/language/parameters |
| 401 | Unauthorized (invalid API key) | Verify CUBESANDBOX_API_KEY |
| 404 | Not found (invalid sandbox/template ID) | Verify template ID exists |
| 500 | Server error | Retry or check CubeSandbox status |
| Network error | Cannot reach server | Verify CUBESANDBOX_SERVER_URL and connectivity |

---

## Examples

### Basic Code Execution

```typescript
// Simple Python code execution
const result = await worker.execute('print("Hello, World!")', 'python');
console.log(result.output); // "Hello, World!\n"
```

### Language-Specific Examples

**Python:**
```typescript
const pythonCode = `
import json
data = {"name": "Alice", "age": 30}
print(json.dumps(data, indent=2))
`;
const result = await worker.execute(pythonCode, 'python');
console.log(result.output);
```

**JavaScript:**
```typescript
const jsCode = `
const obj = { name: 'Bob', age: 25 };
console.log(JSON.stringify(obj, null, 2));
`;
const result = await worker.execute(jsCode, 'javascript');
console.log(result.output);
```

**Bash:**
```typescript
const bashCode = `
echo "Current directory: $(pwd)"
echo "Files: $(ls -1 | head -3)"
`;
const result = await worker.execute(bashCode, 'bash');
console.log(result.output);
```

### Error Capture

```typescript
const code = 'import nonexistent_module';
const result = await worker.execute(code, 'python');

if (result.status === 'error') {
  console.error('Execution failed');
  console.error('Stderr:', result.stderr);  // ImportError details
  console.error('Exit code:', result.exit_code);
}
```

### File I/O

```typescript
// Write a file
await worker.execute(
  'with open("/tmp/data.txt", "w") as f: f.write("test data")',
  'python'
);

// Read it back in same sandbox
const result = await worker.execute(
  'with open("/tmp/data.txt") as f: print(f.read())',
  'python'
);
console.log(result.output); // "test data"
```

### Sandbox Management

```typescript
// Get current sandbox info
const info = await worker.getSandboxInfo();
console.log(`Using sandbox: ${info.id}`);
console.log(`Expires: ${info.expiresAt}`);

// List all sandboxes
const all = await worker.listSandboxes();
console.log(`Total sandboxes: ${all.length}`);

// Terminate current sandbox (next execution gets new one)
await worker.terminateSandbox();
```

### Long-Running Code with Timeout

```typescript
// Note: timeout is passed in ExecuteOptions to client,
// but Worker API doesn't expose timeout parameter directly.
// For timeout handling in agents, use Promise.race():

const timeoutMs = 5000;
const promise = worker.execute(
  'import time; time.sleep(10); print("done")',
  'python'
);

try {
  const result = await Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), timeoutMs)
    ),
  ]);
} catch (error) {
  console.error('Execution timed out');
}
```

---

## Migration Notes

### From Direct Client to Worker API

If you're migrating from using `CubeSandboxClient` directly to the Worker API:

**Before (client):**
```typescript
const client = new CubeSandboxClient(config);
await client.createSandbox();
const result = await client.execute({ code, language });
await client.terminateSandbox();
```

**After (worker):**
```typescript
// Sandbox lifecycle is managed automatically
const result = await worker.execute(code, language);
// Terminate if needed (or let it expire)
await worker.terminateSandbox();
```

The Worker API abstracts sandbox creation - it automatically creates one on first use and reuses it for subsequent calls.

---

## See Also

- [README.md](./README.md) - Overview and quick start
- [INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md) - Using the plugin in Paperclip agents
- [CubeSandbox API Docs](https://github.com/TencentCloud/CubeSandbox) - Upstream API documentation
