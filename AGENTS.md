# Local plaintext file delivery

Follow README.md and preserve the existing UI, fields, read-only history, deletion and analysis.

- Ordinary users download the latest Release emotion-vault.html. No Node, dependencies or server. Source index.html is not the deliverable.
- Version 0.3 deliberately removes all passwords/encryption and browser persistence at the user's request. Do not reintroduce them or migrate old data. Never read, clear or upload legacy browser records.
- Logs live in the explicitly selected plaintext JSON file. The user chooses a file and grants browser permissions. New page sessions start empty until the user opens a file. No hidden localStorage/IndexedDB fallback.
- Keep data files out of public commits/releases. Do not overwrite a preexisting nonempty file when creating a new document. Preserve current data on invalid file selection or failures. Mark uncertain writes and require explicit reopen.
- Respect browser and agent policies. If file:// or native pickers are blocked to tools, hand off to the user; never bypass restrictions or automate their private file selection.
- Runtime target: latest desktop Chrome/Edge with File System Access. No cloud, database, filesystem server or replacement framework. File permission denial is an error, not permission to silently download or cache data.
- Source workflow: project root, locked dependencies, Node version in .nvmrc; npm ci, npm run lint, npm test, npm run build. Report actual verification, not untested OS or native picker success.
- Tests use only synthetic data and isolated temporary directories. Do not read user JSON files, browser profiles or PINs. Do not automatically import #demo-data.
- Publish only clean code and generated HTML with third-party notices. No user logs. Keep prior release assets intact.
- If source dependency installation is denied, request formal approval once; if still denied, stop and give the user the command to run themselves. Never bypass broker/shim/sandbox controls.
