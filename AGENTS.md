# Local reproduction instructions

This repository is the complete local-only 情绪知了 web app. For requests to run or reproduce it, use the existing source rather than recreating the design.

- Read README.md. Work in the repository root, preserve package-lock.json, and use the Node version in .nvmrc when available.
- First setup: run `npm ci` and `npm run build` in this repository. Daily use: double-click `启动.command` on macOS or `启动.cmd` on Windows, or run `node scripts/launch.mjs`. Use `--no-open` for non-browser verification. Keep the local service running for the user. No deployment, cloud account, database, or API key is required.
- Do not repeat installation every time. The launcher reuses the existing app on localhost:3001, never kills unrelated processes, and does not read browser data. If package installation is blocked by an agent's permissions, request proper approval or ask the user to run it in their own terminal; never disable a broker, shim, or sandbox.
- Keep .openai/hosting.json: it contains non-secret build configuration. Its existence is not a request to publish or deploy the site.
- Preserve original UI, fields, behavior, encryption and read-only history. Do not change frameworks or upgrade dependencies merely to run the app.
- Do not overwrite existing checkouts, user logs, browser storage or passwords. Users enter their own PIN; there is no shared default password. Do not automatically import /demo-data.
- Validate with `node --test test/privacy-pin.test.mjs test/encrypted-vault.test.mjs test/log-detail.test.mjs test/launcher.test.mjs`, `npx tsc --noEmit --incremental false`, and the build. Use synthetic data only in tests.
- Clearly distinguish the user's local computer from a remote agent sandbox. Do not claim an untested OS or browser has been verified.
- Public commits must exclude credentials, .env files, local logs, browser profiles, node_modules, dist and .wrangler.
