# Local server delivery (v0.5.0)

Follow README.md and preserve the UI, fields, read-only history, deletion and analysis.

- User explicitly requests script-launched local Node server, not a packaged app or direct-file HTML. First setup: Node 24+, npm ci, npm run build. Daily: 启动.cmd / 启动.command.
- Build records a machine-local Node path in .local/node-path.txt. Preserve existing valid binding; use a verified Node 24 full path with scripts/configure-runtime.mjs --replace to repair a stale binding. Never upload .local or change global PATH/system Node for this project.
- Managed Agent Node is not sufficient evidence of independent desktop startup. Verify the executable works from a normal system terminal and remains installed, or install a separate official user runtime with required authorization. Do not bypass policies.
- For final setup acceptance, normally stop only the service you started for this project, then start through the actual native launcher from a normal terminal/desktop and verify version, path, open, stop and restart. Do not substitute direct launch.mjs or HTTP 200 for this check. If desktop interaction is unavailable, hand off double-click verification to the user explicitly.
- No passwords, encryption, browser persistence or implicit fallback. Never read, clear, migrate or upload browser or JSON records. Do not automatically import demo data.
- Persist only in project data/logs.json through the loopback server. Initialize only missing files. Stop on corrupt/unsupported data; never reset on errors.
- Keep user data and backups out of public commits/releases. Preserve data on source updates.
- Use built-in Node HTTP/filesystem, no cloud, database or replacement framework. Keep Host/Origin/token protection, loopback binding, serialized writes, atomic replacement, readback and pre-change backups.
- Lost write responses require re-read before further writes. Stale deletes must fail. Never automatically remove locks or kill port occupants.
- Tests use only synthetic data, temporary directories and isolated ports. Do not read browser profiles or user JSON. If browser policy blocks navigation, do not bypass it.
- Run npm run lint, npm test, npm run build. Verify launchers in Windows/macOS CI; do not claim untested native desktop behavior.
- Keep Windows .cmd ASCII and CRLF in the committed blob (including GitHub ZIP), Mac .command executable with LF. All paths must support spaces and Chinese names.
- If installation is denied, request formal authorization once. If still denied, stop and provide exact project directory and commands for the user. Never disable or bypass broker/shim/sandbox controls.
- Do not deploy the server publicly or package private data with the source.
