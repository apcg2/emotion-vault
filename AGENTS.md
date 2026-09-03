# Local server delivery (v0.4)

Follow README.md and preserve the UI, fields, read-only history, deletion and analysis.

- User explicitly requests script-launched local Node server, not a packaged app or direct-file HTML. First setup: Node 24+, npm ci, npm run build. Daily: 启动.cmd / 启动.command.
- No passwords, encryption, browser persistence or implicit fallback. Never read, clear, migrate or upload legacy browser or JSON records. Do not automatically import demo data.
- Persist only in project data/logs.json through the loopback server. Initialize only missing files. Stop on corrupt/unsupported data; never reset on errors.
- Keep user data and backups out of public commits/releases. Preserve data on source updates. Prior release assets remain intact.
- Use built-in Node HTTP/filesystem, no cloud, database or replacement framework. Keep Host/Origin/token protection, loopback binding, serialized writes, atomic replacement, readback and pre-change backups.
- Lost write responses require re-read before further writes. Stale deletes must fail. Never automatically remove locks or kill port occupants.
- Tests use only synthetic data, temporary directories and isolated ports. Do not read browser profiles or user JSON. If browser policy blocks navigation, do not bypass it.
- Run npm run lint, npm test, npm run build. Verify launchers in Windows/macOS CI; do not claim untested native desktop behavior.
- Keep Windows .cmd ASCII and CRLF in the committed blob (including GitHub ZIP), Mac .command executable with LF. All paths must support spaces and Chinese names.
- If installation is denied, request formal authorization once. If still denied, stop and provide exact project directory and commands for the user. Never disable or bypass broker/shim/sandbox controls.
- Do not deploy the server publicly or package private data with the source.
