# FlowState

FlowState is a collaborative workspace for boards, realtime discussions, and focus tracking.

## Highlights

- Boards with lists, cards, labels, comments, attachments, and activity feed
- Realtime updates (mentions, presence, activity) via Socket.IO
- Threads: DMs + channels, replies, reactions, and media
- Dashboard with assigned/created tasks, mentions, summaries, announcements, and pomodoro

## Tech Stack

- **Client:** React + Vite + TypeScript + Tailwind + Zustand + Socket.IO client
- **Server:** Express + Socket.IO + Drizzle ORM + MySQL 8.0 (`mysql2`) + Zod
- **Tooling:** Bun, ESLint, Vitest

## Quickstart

```bash
bun install
bun run dev:server
bun run dev:client
```

You can also start the server only with:

```bash
bun run dev
```

## Local URLs

- Client: `http://localhost:5173`
- Server API: `http://localhost:4000`

## Common Commands

| Command | Purpose |
| --- | --- |
| `bun run dev` | Start server (watch mode) |
| `bun run dev:client` | Start Vite client |
| `bun run dev:server` | Start server (watch mode) |
| `bun run build` | Build client + server |
| `bun run test` | Run all tests |
| `bun run test:client` | Run client tests |
| `bun run test:server` | Run server tests |
| `bun run lint` | Run client + server lint |
| `bun run format` | Prettier format |

## Production Notes

- Build both apps with `bun run build`
- Start the built server from the repo root with `bun run start`
- In production, the Express server serves the built React app from `client/dist`
- Leave `VITE_API_BASE_URL` unset in production so the client uses same-origin `/api`
- Set `PUBLIC_APP_URL` to the canonical frontend URL used in invite links
- Set `FLOWSTATE_UPLOADS_DIR` to a persistent directory on the host
- Use `server/.env.production.example` and `client/.env.production.example` as the production env starting point
- VPS deployment templates live under `deploy/vps/`, with the official tracked runbooks under `Docs/dev/operations/`

## Repo Layout

```text
client/   Frontend (Vite + React)
server/   API + realtime services
Docs/     Official tracked docs (`user/` + `dev/`)
My_Docs/  Personal/learning docs (ignored by git)
```

## Documentation

- End-user documentation lives in [Docs/user](Docs/user/index.md)
- Developer handoff documentation lives in [Docs/dev](Docs/dev/index.md)
- Personal webdev learning notes live in `My_Docs/` and are intentionally not tracked



