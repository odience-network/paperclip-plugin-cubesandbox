# Changelog

All notable changes to the CubeSandbox plugin for Paperclip will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-05-28

### Added

#### Core Features
- Execute code in isolated CubeSandbox environments via Paperclip agents
- Support for multiple programming languages: Python, JavaScript, Bash
- Stateful sandbox management with automatic lifecycle handling
- Output capture for stdout, stderr, and exit codes
- File I/O support within sandboxes (isolated from host filesystem)
- Sandbox creation, querying, and termination
- Web UI for interactive code execution

#### Plugin Architecture
- `CubeSandboxClient` class providing direct API wrapper for CubeSandbox
- Worker API exposing RPC methods to Paperclip agents
- React-based web UI with language selector and code editor
- Configuration via environment variables or Paperclip plugin settings
- Automatic configuration loading from environment

#### API Methods
- `execute(code, language)` - Execute code in current sandbox
- `getSandboxInfo()` - Get metadata about current sandbox
- `listSandboxes()` - List all available sandboxes
- `terminateSandbox()` - Terminate current sandbox
- `createSandbox()` - Create new sandbox (internal, auto-called)
- `setSandboxId(id)` - Set active sandbox (internal)
- `getSandboxId()` - Get current sandbox ID (internal)

#### Configuration
- `CUBESANDBOX_SERVER_URL` - CubeSandbox API server URL
- `CUBESANDBOX_API_KEY` - API authentication key
- `CUBESANDBOX_TEMPLATE_ID` - Default sandbox template ID
- Plugin configuration schema for Paperclip settings

#### Documentation
- Comprehensive README.md with quick start and examples
- API_DOCS.md with detailed API reference
- INTEGRATION_GUIDE.md with agent usage examples and patterns
- CHANGELOG.md (this file)

#### Development
- TypeScript support with type definitions
- ESBuild configuration for bundling
- Vitest setup for unit testing
- E2E test suite (tests/e2e.sh) covering:
  - Infrastructure health checks
  - Sandbox lifecycle (creation, execution, cleanup)
  - Python code execution and output capture
  - File I/O and persistence
  - Sandbox isolation from host
  - Multi-sandbox filesystem isolation
  - Plugin client stateful lifecycle
  - Performance benchmarking

#### Performance
- Sub-150ms sandbox creation (typical ~100ms)
- Sub-50ms code execution (typical ~20-30ms)
- Sandbox reuse for optimal performance

### Build & Distribution
- pnpm package management
- TypeScript with strict mode
- Production build outputs to `dist/` directory
- Plugin entry points:
  - Manifest: `dist/manifest.js`
  - Worker: `dist/worker.js`
  - UI: `dist/ui/index.js`

### Testing
- E2E test suite validating all scenarios from ODIAA-387
- Tests against live CubeSandbox instances
- Performance metrics collection
- Isolation validation (hostname, /proc, network)

---

## Roadmap

### Planned for Future Releases

- [ ] Language parity updates (support for more languages)
- [ ] Enhanced error messages with debug information
- [ ] Result caching for identical code executions
- [ ] Sandbox resource limits configuration
- [ ] Streaming large output support
- [ ] Code syntax highlighting in UI
- [ ] Execution history/replay
- [ ] Multi-user sandbox isolation
- [ ] Metrics collection and reporting

---

## Notes

### Compatibility
- Node.js 18+
- React 18.3+
- TypeScript 5.9+
- Paperclip Plugin SDK (current version)

### Known Limitations
- No file upload/download through UI (use code to manage files)
- No interactive REPL (stateless execution per call)
- Output limited to stdout/stderr capture
- Sandbox lifetime determined by CubeSandbox server configuration

### Migration Path
This is the initial release. No migration needed for first-time installations.

---

## Contributing

When contributing changes, please:
1. Update this CHANGELOG.md with your changes
2. Follow semantic versioning
3. Include tests for new features
4. Update relevant documentation

---

## Contact

For issues or questions about the CubeSandbox plugin:
- Check [INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md) for usage examples
- Review [API_DOCS.md](./API_DOCS.md) for API reference
- See [tests/e2e.sh](./tests/e2e.sh) for working examples
- Refer to [CubeSandbox documentation](https://github.com/TencentCloud/CubeSandbox)

---

## License

MIT

---

[1.0.0]: https://github.com/odience/paperclip-plugins/releases/tag/cubesandbox-1.0.0
