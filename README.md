# Racebaan

Arcade browser racing game built with Vite, three.js, Rapier, and a Cloudflare-native multiplayer backend.

## Local development

Install dependencies:

```bash
pnpm install
```

Build the frontend assets that the Worker serves:

```bash
pnpm build
```

Apply the local D1 schema used by `wrangler dev`:

```bash
pnpm db:migrate:local
```

Preview the full Worker app locally, including static assets, API routes, Durable Objects, D1, and WebSockets:

```bash
pnpm worker:dev
```

Expose the Worker preview to other devices on your local network:

```bash
pnpm worker:dev:lan
```

Wrangler uses `--ip 0.0.0.0` for LAN binding. Its `--host` flag means "forward requests to another host", so `pnpm worker:dev --host` will not do the same thing as Vite's `pnpm dev --host`.

`pnpm worker:dev` and `pnpm worker:dev:lan` rebuild the frontend before starting Wrangler so the Worker-served `dist/` assets stay in sync with recent UI changes.

Local URLs to check:

- `http://127.0.0.1:8787/`
- `http://127.0.0.1:8787/api/health`
- `http://127.0.0.1:8787/api/leaderboard/all-time?trackId=default&limit=10`

## Multiplayer deployment on Cloudflare

This repo is now a single Worker project.

- The Vite app still builds with `pnpm build`
- The Worker serves `dist/`
- `/api/*` handles leaderboard and health routes
- `/ws/room/:roomId` upgrades to a per-room Durable Object
- Durable Objects coordinate live rooms and write official results
- D1 stores official lap times and race finishes

### What Cloudflare resources you need

Create only one thing manually for v1:

1. A D1 database named `racebaan-db`

You do **not** need to create Durable Objects manually. They are provisioned from `wrangler.jsonc` on deploy.

### First-time CLI setup

1. Log in to Cloudflare:

```bash
pnpm exec wrangler login
```

2. Create the D1 database:

```bash
pnpm exec wrangler d1 create racebaan-db
```

3. Copy the returned `database_id` into [wrangler.jsonc](/Users/vincent/Documents/repos/racebaan/wrangler.jsonc) for both:

- `d1_databases[0].database_id`
- `d1_databases[0].preview_database_id`

Using the same ID for both is the simplest v1 setup. You can split preview and production later if you want.

4. Build the frontend:

```bash
pnpm build
```

5. Apply the remote D1 migration:

```bash
pnpm db:migrate:remote
```

6. Deploy the Worker:

```bash
pnpm worker:deploy
```

### Updating the deployment later

If only code changed:

```bash
pnpm build
pnpm worker:deploy
```

If schema changed too:

```bash
pnpm build
pnpm db:migrate:remote
pnpm worker:deploy
```

Or use the combined release command:

```bash
pnpm worker:release
```

### Deploying from the Cloudflare dashboard with GitHub

Cloudflare Workers Builds can deploy this repo directly from GitHub.

1. Push this repo to GitHub.
2. Make sure the Worker name in the dashboard matches the `name` field in [wrangler.jsonc](/Users/vincent/Documents/repos/racebaan/wrangler.jsonc). Right now that name is `racebaan`.
3. In Cloudflare, go to `Workers & Pages`.
4. Choose `Create application`.
5. Choose `Import a repository`.
6. Pick this GitHub repo.
7. Use the repo root as the root directory.
8. Set the build command to:

```bash
pnpm build
```

9. Set the deploy command to:

```bash
pnpm worker:release
```

10. Save and deploy.

That gives you Git-based deploys fully inside Cloudflare, while still applying D1 migrations during deploys.

### What to test after deploy

1. Open the site and confirm the game still loads.
2. Open `/api/health` and confirm JSON returns.
3. Open two browser tabs with different room participants.
4. Enter the same room ID in both tabs and start the race.
5. Confirm the countdown starts, both players appear in the room list, and placeholder remote cars move.
6. Finish laps and confirm the all-time leaderboard updates.

## v1 choices and limitations

- Identity is anonymous and browser-local only.
- `anonymousPlayerId` is the real backend identity.
- `displayName` is just a mutable alias stored in local storage and echoed to the server after validation.
- There is no signup, login, password, OAuth, or profile system.
- Abuse protection is intentionally lightweight: input validation, room-size limits, message throttling, and server-only writes to D1.
- Physics stays client-authoritative for feel.
- The Durable Object is authoritative for room membership, countdown/race start, lap acceptance timing, finish order, and official writes.
- Remote racers are simple placeholder cars in v1.
- Track ID is a single v1 constant: `default`.
- No extra server-issued auth token was added because it would add more complexity than protection for this anonymous v1.
