# Local HTML delivery instructions

This is the complete local-only 情绪知了 app. Preserve original UI, fields, behavior, encryption and read-only history.

- Read README.md. For ordinary use download the latest Release asset `emotion-vault.html` to a fixed directory on the user's computer. No Node, dependencies, terminal or server are needed. Source index.html is a build template, not the deliverable.
- Do not recreate the app or substitute a cloud deployment. Do not reintroduce Next.js, Vinext, Cloudflare, Sites, a database or log APIs.
- If browser tools block file://, respect the restriction and let the user double-click. Never work around browser/agent security controls. Distinguish the user's local computer from a cloud sandbox.
- Never overwrite an existing HTML or read/reset user browser storage, logs or credentials. Users enter their own PIN. Do not automatically import #demo-data.
- HTML contains code, not user data. Before changing file location, browser or HTML version, ask users to download an encrypted backup through the app. Never ask them to send you a backup or PIN.
- Restore accepts encrypted backups only, verifies PIN and records, and refuses destinations with existing vault, legacy data or PIN. No automatic clear/overwrite fallback.
- File URLs and localhost:3001 do not share storage. Keep encryption format and storage keys unchanged. For one-time old-data export only, use current source npm run dev on the original http://localhost:3001/. Never silently switch origin, kill unrelated processes, or assume an empty view means records were deleted.
- Developer workflow: project root, preserve package-lock.json, use .nvmrc when available; npm ci, npm test, npm run build. Output is one offline dist/emotion-vault.html. Test with synthetic data only; never disable encryption or file write locks for compatibility.
- If installation is denied, request official approval once. If still denied, stop retrying and give the user the exact local directory and command. Never modify or bypass broker/shim/sandbox restrictions.
- Public commits exclude credentials, .env files, private logs, backups, browser profiles, node_modules and dist. Publish only the clean generated HTML in Releases, with no embedded user storage. Report actual coverage without claiming untested browsers or OS interactions passed.
