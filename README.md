# FlowState

FlowState is a collaborative workspace for boards, realtime discussions, and focus tracking.

## Highlights

- Boards with lists, cards, labels, comments, attachments, and activity feed
- Realtime updates (mentions, presence, activity) via Socket.IO
- Threads: DMs + channels, replies, reactions, and media
- Dashboard with assigned/created tasks, mentions, summaries, announcements, and pomodoro

## Tech Stack

- **Client:** React + Vite + TypeScript + Tailwind + Zustand + Socket.IO client
- **Server:** Express + Socket.IO + Drizzle ORM + SQLite (better-sqlite3) + Zod
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

## Repo Layout

```text
client/   Frontend (Vite + React)
server/   API + realtime services
Docs/     Project docs
```