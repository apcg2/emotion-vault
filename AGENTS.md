# Local reproduction instructions

This repository is the complete local-only 情绪知了 web app. For requests to run or reproduce it, use the existing source rather than recreating the design.

- Read README.md. Work in the repository root, preserve package-lock.json, and use the Node version in .nvmrc when available.
- Run `npm ci`, `npm run build`, then `npm run start -- --port 3001`. Keep the local service running for the user. No deployment, cloud account, database, or API key is required.
- Keep .openai/hosting.json: it contains non-secret build configuration. Its existence is not a request to publish or deploy the site.
- Preserve original UI, fields, behavior, encryption and read-only history. Do not change frameworks or upgrade dependencies merely to run the app.
- Do not overwrite existing checkouts, user logs, browser storage or passwords. Users enter their own PIN; there is no shared default password. Do not automatically import /demo-data.
- Validate with `node --test test/privacy-pin.test.mjs test/encrypted-vault.test.mjs test/log-detail.test.mjs`, `npx tsc --noEmit --incremental false`, and the build. Use synthetic data only in tests.
- Clearly distinguish the user's local computer from a remote agent sandbox. Do not claim an untested OS or browser has been verified.
- Public commits must exclude credentials, .env files, local logs, browser profiles, node_modules, dist and .wrangler.
