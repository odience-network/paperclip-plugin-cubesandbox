# CubeSandbox Plugin Integration Guide

This guide shows how to use the CubeSandbox plugin within Paperclip agents and workflows.

## Table of Contents

- [Setup](#setup)
- [Basic Integration](#basic-integration)
- [Agent Examples](#agent-examples)
- [Workflow Patterns](#workflow-patterns)
- [Error Handling](#error-handling)
- [Performance Tips](#performance-tips)
- [Troubleshooting](#troubleshooting)

## Setup

### 1. Install the Plugin

```bash
cd /home/user/dev/paperclip-plugins/cubesandbox
pnpm build
paperclipai plugin install .
```

### 2. Configure Environment

Set the required environment variables:

```bash
export CUBESANDBOX_SERVER_URL=https://api.cubesandbox.example.com
export CUBESANDBOX_API_KEY=your-api-key
export CUBESANDBOX_TEMPLATE_ID=your-template-id
```

Or create a `.env` file in the plugin directory.

### 3. Enable Plugin in Agent Config

In your agent configuration (agent.yaml or similar), ensure the CubeSandbox plugin is loaded:

```yaml
plugins:
  - '@odience/cubesandbox'
```

## Basic Integration

### Using the Worker API in an Agent

The plugin exposes a `worker` object that agents can call:

```typescript
// In your agent implementation
const executeCode = async (code: string, language: string = 'python') => {
  const result = await worker.execute(code, language);
  
  if (result.status === 'success') {
    console.log('Output:', result.output);
  } else {
    console.log('Error:', result.error);
  }
  
  return result;
};

// Execute code
const result = await executeCode('print("Hello from CubeSandbox!")', 'python');
```

### Accessing Sandbox Information

```typescript
// Get current sandbox metadata
const info = await worker.getSandboxInfo();
console.log(`Using sandbox ${info.id}`);
console.log(`Status: ${info.status}`);
console.log(`Expires at: ${info.expiresAt}`);

// List all available sandboxes
const allSandboxes = await worker.listSandboxes();
console.log(`${allSandboxes.length} sandboxes available`);
```

## Agent Examples

### Example 1: Code Execution Agent

An agent that executes user-provided code and returns results:

```typescript
import { AgentContext, AgentResult } from '@paperclipai/sdk';

export async function executeCodeAgent(
  ctx: AgentContext,
  code: string,
  language: string = 'python'
): Promise<AgentResult> {
  try {
    const result = await ctx.worker.execute(code, language);
    
    if (result.status === 'success') {
      return {
        status: 'success',
        output: {
          stdout: result.output,
          stderr: result.stderr,
          exitCode: result.exit_code,
        },
      };
    } else {
      return {
        status: 'error',
        message: `Execution failed: ${result.error}`,
      };
    }
  } catch (error) {
    return {
      status: 'error',
      message: `Error executing code: ${error}`,
    };
  }
}

// Usage in another agent
const codeToRun = 'print("Hello from agent")';
const result = await executeCodeAgent(context, codeToRun, 'python');
```

### Example 2: Python Data Analysis Agent

An agent that performs data analysis using Python:

```typescript
export async function analyzeDataAgent(ctx: AgentContext, csvData: string) {
  // Write CSV to sandbox
  const writeCode = `
with open('/tmp/data.csv', 'w') as f:
    f.write("""${csvData}""")
print('Data written')
`;

  await ctx.worker.execute(writeCode, 'python');

  // Analyze the data
  const analyzeCode = `
import csv
import statistics

with open('/tmp/data.csv', 'r') as f:
    reader = csv.DictReader(f)
    rows = list(reader)

# Calculate statistics on numeric columns
results = {}
for col in rows[0].keys():
    try:
        values = [float(row[col]) for row in rows]
        results[col] = {
            'count': len(values),
            'mean': statistics.mean(values),
            'stdev': statistics.stdev(values) if len(values) > 1 else 0,
            'min': min(values),
            'max': max(values),
        }
    except ValueError:
        results[col] = {'type': 'string'}

import json
print(json.dumps(results, indent=2))
`;

  const result = await ctx.worker.execute(analyzeCode, 'python');
  
  if (result.status === 'success') {
    const analysis = JSON.parse(result.output);
    return {
      status: 'success',
      analysis,
    };
  } else {
    throw new Error(`Analysis failed: ${result.error}`);
  }
}
```

### Example 3: Code Validation Agent

An agent that validates code before execution:

```typescript
export async function validateAndExecuteCode(
  ctx: AgentContext,
  code: string,
  language: string
) {
  // First, validate syntax without executing
  const validationCode = language === 'python' 
    ? `
import py_compile
import tempfile
try:
    with tempfile.NamedTemporaryFile(suffix='.py', delete=False) as f:
        f.write("""${code}""")
        f.flush()
    py_compile.compile(f.name, doraise=True)
    print('valid')
except py_compile.PyCompileError as e:
    print(f'syntax_error:{e}')
`
    : null;

  if (validationCode) {
    const validationResult = await ctx.worker.execute(validationCode, language);
    
    if (!validationResult.output.includes('valid')) {
      return {
        status: 'error',
        message: validationResult.output,
      };
    }
  }

  // If syntax is valid, execute the code
  return await ctx.worker.execute(code, language);
}
```

### Example 4: Multi-Language Code Executor

An agent that can execute code in different languages:

```typescript
export async function executeMultiLanguage(
  ctx: AgentContext,
  snippets: { code: string; language: string }[]
) {
  const results = [];

  for (const snippet of snippets) {
    console.log(`Executing ${snippet.language}...`);
    
    const result = await ctx.worker.execute(
      snippet.code,
      snippet.language
    );

    results.push({
      language: snippet.language,
      status: result.status,
      output: result.output,
      stderr: result.stderr,
      exitCode: result.exit_code,
    });
  }

  return results;
}

// Usage
const multiResult = await executeMultiLanguage(ctx, [
  { code: 'print("Python")', language: 'python' },
  { code: 'console.log("JavaScript")', language: 'javascript' },
  { code: 'echo "Bash"', language: 'bash' },
]);
```

### Example 5: Sandbox Cleanup Agent

An agent that manages sandbox lifecycle:

```typescript
export async function manageSandboxesAgent(ctx: AgentContext) {
  // List all sandboxes
  const sandboxes = await ctx.worker.listSandboxes();
  console.log(`Found ${sandboxes.length} sandboxes`);

  // Get info on current sandbox
  try {
    const currentInfo = await ctx.worker.getSandboxInfo();
    console.log(`Current sandbox: ${currentInfo.id}`);
    console.log(`Status: ${currentInfo.status}`);
    console.log(`Expires: ${currentInfo.expiresAt}`);
  } catch (error) {
    console.log('No active sandbox yet');
  }

  // Execute some code
  const result = await ctx.worker.execute('print("test")', 'python');
  console.log('Execution complete');

  // Terminate sandbox when done
  await ctx.worker.terminateSandbox();
  console.log('Sandbox terminated');
}
```

## Workflow Patterns

### Pattern 1: Sequential Execution (Stateful)

Execute multiple code snippets in the same sandbox, where later code can use files/state from earlier code:

```typescript
// Step 1: Generate data
await worker.execute(`
data = list(range(100))
with open('/tmp/data.pkl', 'wb') as f:
    import pickle
    pickle.dump(data, f)
`, 'python');

// Step 2: Analyze data (in same sandbox, can read the file)
const result = await worker.execute(`
with open('/tmp/data.pkl', 'rb') as f:
    import pickle
    data = pickle.load(f)
print(f'Mean: {sum(data) / len(data)}')
`, 'python');
```

### Pattern 2: Isolated Executions (Stateless)

Execute independent code snippets and start fresh:

```typescript
// Execute snippet 1
await worker.execute('print("Snippet 1")', 'python');

// Clean up and start fresh
await worker.terminateSandbox();

// Execute snippet 2 (in a new sandbox)
await worker.execute('print("Snippet 2")', 'python');
```

### Pattern 3: Conditional Execution

Execute code conditionally based on previous results:

```typescript
const checkCode = 'import os; print("exists" if os.path.exists("/tmp/data.txt") else "missing")';
const checkResult = await worker.execute(checkCode, 'python');

if (checkResult.output.includes('exists')) {
  // File exists, process it
  const processResult = await worker.execute(
    'with open("/tmp/data.txt") as f: print(len(f.read()))',
    'python'
  );
  console.log('File size:', processResult.output);
} else {
  // File doesn't exist, create it
  await worker.execute(
    'with open("/tmp/data.txt", "w") as f: f.write("new data")',
    'python'
  );
}
```

### Pattern 4: Error Recovery

Handle execution errors gracefully:

```typescript
async function executeWithRetry(
  ctx: AgentContext,
  code: string,
  maxRetries: number = 3
) {
  for (let i = 0; i < maxRetries; i++) {
    const result = await ctx.worker.execute(code, 'python');
    
    if (result.status === 'success') {
      return result;
    }

    console.log(`Attempt ${i + 1} failed, retrying...`);
    
    // Clear sandbox on persistent failures
    if (i === maxRetries - 1) {
      await ctx.worker.terminateSandbox();
    }
  }

  throw new Error('Max retries exceeded');
}
```

### Pattern 5: Streaming Large Results

Handle large output by processing in chunks:

```typescript
async function executeLargeQuery(ctx: AgentContext) {
  // Generate large dataset
  const result = await ctx.worker.execute(`
import json
data = [{'id': i, 'value': i*2} for i in range(10000)]
print(json.dumps(data))
`, 'python');

  if (result.status === 'success') {
    const lines = result.output.split('\n').filter(l => l.trim());
    
    for (const line of lines) {
      try {
        const item = JSON.parse(line);
        // Process item
        console.log(item);
      } catch (e) {
        // Skip malformed lines
      }
    }
  }
}
```

## Error Handling

### Handle Execution Errors

```typescript
const result = await worker.execute('invalid python code', 'python');

if (result.status === 'error') {
  console.error('Execution error:');
  console.error('  Message:', result.error);
  console.error('  Stderr:', result.stderr);
  console.error('  Exit code:', result.exit_code);
}
```

### Handle API Errors

```typescript
try {
  const info = await worker.getSandboxInfo();
} catch (error) {
  if (error.message.includes('401')) {
    console.error('Invalid API key');
  } else if (error.message.includes('404')) {
    console.error('Sandbox not found');
  } else {
    console.error('Unexpected error:', error);
  }
}
```

### Handle Timeout

```typescript
const codePromise = worker.execute(
  'import time; time.sleep(30); print("done")',
  'python'
);

try {
  const result = await Promise.race([
    codePromise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Timeout after 5s')), 5000)
    ),
  ]);
} catch (error) {
  console.error('Execution error:', error.message);
}
```

## Performance Tips

1. **Reuse sandboxes**: The plugin reuses the same sandbox for multiple executions, which is faster than creating new ones each time. Only call `terminateSandbox()` when you need a fresh environment.

2. **Minimize code size**: Smaller code snippets execute faster. Move data loading to separate steps if possible.

3. **Use appropriate language**: Choose the language best suited for the task:
   - Python for data analysis, ML, scripts
   - JavaScript for JSON processing, logic
   - Bash for system operations

4. **Handle large output**: Large outputs can be slow to transfer. Consider writing to files and reading incrementally instead.

5. **Batch operations**: Group related operations to minimize sandbox switches:

```typescript
// Good: single execution with multiple operations
await worker.execute(`
result1 = compute_a()
result2 = compute_b()
result3 = compute_c()
print(json.dumps([result1, result2, result3]))
`, 'python');

// Slower: three separate executions
await worker.execute('result1 = compute_a(); print(result1)', 'python');
await worker.execute('result2 = compute_b(); print(result2)', 'python');
await worker.execute('result3 = compute_c(); print(result3)', 'python');
```

## Troubleshooting

### Plugin Not Found

**Error:** "Plugin not found: @odience/cubesandbox"

**Solution:**
1. Ensure the plugin is built: `pnpm build`
2. Install it: `paperclipai plugin install /path/to/cubesandbox`
3. Restart Paperclip

### Sandbox Not Created

**Error:** "Sandbox not created. Call createSandbox() first."

**Solution:**
- This should be handled automatically by the plugin
- If it occurs, restart the plugin or agent
- Check that the template ID is valid

### API Authentication Error

**Error:** "CubeSandbox API error: 401"

**Solution:**
1. Verify your API key in `.env` or environment
2. Check that the key hasn't expired
3. Contact CubeSandbox administrator

### Connection Error

**Error:** "CubeSandbox API error: network error" or "ECONNREFUSED"

**Solution:**
1. Verify `CUBESANDBOX_SERVER_URL` is correct
2. Check that the CubeSandbox server is running
3. Check firewall/network connectivity

### Code Execution Errors

**Error:** "SyntaxError" or other runtime errors

**Solution:**
- Check the code syntax for the language
- Review `stderr` output for error details
- Test code locally first

### Large Output

**Error:** Response times out or output is truncated

**Solution:**
- Write results to a file instead of printing
- Process output in chunks
- Reduce the amount of output

---

## See Also

- [README.md](./README.md) - Overview and setup
- [API_DOCS.md](./API_DOCS.md) - Detailed API reference
- [tests/e2e.sh](./tests/e2e.sh) - Working examples
