# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```sh
# Development (runs backend on :3001 + Vite dev server on :5173 concurrently)
npm run dev

# Build admin frontend (Vite → admin/dist/)
npm run build:admin

# Production server
npm start

# Rerender all recipe pages from DB (e.g. after template changes)
npm run rerender
```

During development, the admin UI is at `http://localhost:5173`. The Vite dev server proxies `/api`, `/r`, `/recipes`, and `/assets` to the backend on `:3001`.

There are no automated tests.

## Architecture

**Single Node.js/Express server** (`server/index.js`) handles everything: REST API, admin UI, and serving prerendered static files. No separate frontend server in production.

### Data flow

Recipes live in SQLite (`data/kokebok.db`). On every create/update/delete, the server:
1. Writes to SQLite via `server/db/recipes.js`
2. Writes a JSON snapshot to `data/recipes/<id>.json` (redundant backup)
3. Prerenders the recipe page to `public/r/<id>.html`
4. Rerenders `public/index.html` and `public/recipes/recipe-index.json`

This prerender-on-write pattern means the public site is entirely static files — no per-request DB queries for recipe views.

On startup the server computes a hash of the template files and compares it to the stored hash in `meta_kv`. If different (or `public/index.html` is missing), it prerenders all recipes automatically.

### Key directories

- `server/` — Express backend (CommonJS)
  - `routes/api-recipes.js` — CRUD for recipes (POST/PUT/DELETE trigger prerender)
  - `routes/api-admin.js` — Admin-only endpoints (rerender-all, batch-update, import-raw)
  - `prerender/` — Template rendering; `template.js` and `index-template.js` are the HTML templates
  - `lib/` — Parsers (YAML, markdown, raw import), formatters, slugify
  - `db/` — SQLite via `better-sqlite3`; schema in `db/schema.sql`
- `admin/` — Admin frontend (Vite + Tailwind, vanilla JS, no framework)
  - `src/main.js` — Single-page app with hash routing (`#/`, `#/edit/:id`, `#/new`)
  - `src/editor/` — TipTap (ProseMirror) step editor with custom `ingredientRef` node
  - `src/components/` — Standalone UI components (sidebar, recipe table, modals)
  - Built to `admin/dist/` and served at `/admin/` in production
- `public/` — Static output: `index.html`, `r/<id>.html`, `assets/`, `recipes/recipe-index.json`
- `data/` — Runtime data: `kokebok.db`, `recipes/*.json` snapshots (not committed)

### Database schema

Three main tables: `recipes` (with `tags`/`meta`/`tips` as JSON text columns), `ingredients`, `steps`. A `meta_kv` table stores the template hash. SQLite cascades deletes from `recipes` to `ingredients` and `steps`.

Ingredient IDs are human-readable slugs derived from the ingredient name (e.g. `smor`, `mel-2`). Step content is a ProseMirror JSON document stored as TEXT.

### Admin UI details

The admin is vanilla JS with no framework. Hash routing: `#/` → recipe list, `#/edit/:id` → edit form, `#/new` → new recipe form. The edit view has three columns: form, ingredient sidebar, and live preview (the preview renders a client-side HTML facsimile, not the actual template).

Step content uses TipTap with a custom `ingredientRef` inline node that references ingredient IDs and a factor (fraction of the full amount used in that step).

### Deployment

Push to `main` triggers GitHub Actions (`build.yml`) which builds a Docker image and pushes it to `ghcr.io/taraldb/kokebok:latest`. The container runs on Unraid behind nginx (TLS termination). Persistent data is at `/data` (mount `/mnt/user/appdata/kokebok`).

Environment variables: `DATA_DIR` (default `/data`), `RECIPES_DIR` (default `$DATA_DIR/recipes`), `PORT` (default `8080`).
