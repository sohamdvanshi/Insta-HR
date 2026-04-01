# Backend Scripts

These are **dev utility scripts** — not part of the running app. Run them from inside the `backend/` directory.

## Folder Structure

```
scripts/
├── generators/   <- Write/generate src/ files (run once to scaffold features)
├── patches/      <- Patch existing src/ files (fix bugs, update logic)
├── db/           <- Database operations (create tables, seed, drop, sync)
└── admin/        <- Admin user management & auditing
```

## How to Run

From the `backend/` directory:

```bash
node scripts/generators/ai-screening-backend.js
node scripts/db/fix-db.js
node scripts/admin/create-admin.js
```

> Warning: Always restart the backend after running generators or patches: `npm run dev`
