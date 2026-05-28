import React, { useState, useCallback } from 'react';
import type { PluginUiContext } from '@paperclipai/plugin-sdk';

interface ExecuteResult {
  status: string;
  result?: unknown;
  error?: string;
}

export default function CubeSandboxUI(ctx: PluginUiContext) {
  const [code, setCode] = useState<string>('print("Hello, CubeSandbox!")');
  const [language, setLanguage] = useState<string>('python');
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<ExecuteResult | null>(null);

  const handleExecute = useCallback(async () => {
    setLoading(true);
    try {
      const response = await ctx.worker.execute(code, language);
      setResult(response as ExecuteResult);
    } catch (error) {
      setResult({
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setLoading(false);
    }
  }, [code, language, ctx.worker]);

  return (
    <div style={{ padding: '20px', fontFamily: 'system-ui' }}>
      <h1>CubeSandbox Code Executor</h1>

      <div style={{ marginBottom: '15px' }}>
        <label>
          <span style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Language:</span>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            style={{ padding: '5px', width: '100%' }}
          >
            <option value="python">Python</option>
            <option value="javascript">JavaScript</option>
            <option value="bash">Bash</option>
          </select>
        </label>
      </div>

      <div style={{ marginBottom: '15px' }}>
        <label>
          <span style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Code:</span>
          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            style={{
              width: '100%',
              height: '200px',
              padding: '10px',
              fontFamily: 'monospace',
              border: '1px solid #ccc',
              borderRadius: '4px',
            }}
            disabled={loading}
          />
        </label>
      </div>

      <button
        onClick={handleExecute}
        disabled={loading}
        style={{
          padding: '10px 20px',
          backgroundColor: '#0066cc',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: loading ? 'not-allowed' : 'pointer',
          opacity: loading ? 0.6 : 1,
        }}
      >
        {loading ? 'Executing...' : 'Execute'}
      </button>

      {result && (
        <div
          style={{
            marginTop: '20px',
            padding: '15px',
            backgroundColor: result.status === 'success' ? '#f0f8f0' : '#f8f0f0',
            border: `1px solid ${result.status === 'success' ? '#0a0' : '#a00'}`,
            borderRadius: '4px',
          }}
        >
          <h3>Result</h3>
          <p>Status: <strong>{result.status}</strong></p>
          {result.result ? (
            <pre
              style={{
                backgroundColor: '#f5f5f5',
                padding: '10px',
                borderRadius: '4px',
                overflow: 'auto',
              }}
            >
              {String(JSON.stringify(result.result, null, 2))}
            </pre>
          ) : null}
          {result.error && (
            <pre
              style={{
                backgroundColor: '#ffe0e0',
                padding: '10px',
                borderRadius: '4px',
                color: '#cc0000',
                overflow: 'auto',
              }}
            >
              {result.error}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
