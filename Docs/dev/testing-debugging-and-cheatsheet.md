# Testing, Debugging, and Cheat Sheet

This is the practical command-and-workflow guide for day-to-day development.

## 1. Common commands

From repo root:

```bash
bun install
bun run build
bun run test
bun run lint
```

Client:

```bash
bun run --cwd client dev
bun run --cwd client build
bun run --cwd client test
```

Server:

```bash
bun run --cwd server dev
bun run --cwd server build
bun run --cwd server test
bun run --cwd server db:migrate
bun run --cwd server db:generate
```

## 2. Local development mental model

Typical local flow:

1. run the server
2. run the client
3. visit the Vite app in the browser
4. the client talks to the backend API
5. the backend talks to MySQL

## 3. Test caveat

The server suite may need sequential execution in some cases because files share one MySQL test database and can race each other if fully parallelized.

If you hit flaky parallel DB behavior, prefer a single-worker/sequential run.

## 4. Good debugging order

When something breaks:

1. read the failing UI state or API error
2. inspect the relevant client API wrapper
3. inspect the matching route/service module
4. inspect DB schema/migration implications
5. add or update tests before expanding the fix

## 5. Common issue entrypoints

- auth problem: `client/src/lib/auth-api.ts`, auth store, auth routes/service
- board bug: boards API wrappers, board detail handlers, boards service modules
- thread bug: threads controller, threads API wrappers, threads service modules
- role/permission bug: `server/src/utils/permissions.ts`, `server/src/utils/access-control.ts`
- deploy/ops bug: `deploy/vps/*` and `Docs/dev/vps-operations.md`

## 6. Build and runtime separation

Remember the difference:

- TypeScript build errors mean the code does not compile
- runtime errors mean the compiled code still misbehaves
- test failures mean expected behavior changed or regressed

## 7. Logging and observability shortcuts

Production-oriented concepts already in place:

- structured server logs
- request context and request ids
- health endpoints
- bounded slow-query logs
- backup/restore manifests

## 8. Practical repo conventions

- prefer `rg` for search
- avoid unrelated reformatting
- keep changes scoped
- preserve user changes if the worktree is dirty
- avoid destructive git commands unless explicitly requested

## 9. Production commands

Preferred deploy:

```bash
ssh flowstate-vps
cd /opt/flowstate/app
git pull origin master
bash deploy/vps/update-safe.sh
```

Health checks:

```bash
curl http://127.0.0.1:4000/api/health/ready
curl https://flo-state.in/api/health/ready
systemctl status flowstate --no-pager
```

## 10. Documentation contract

After meaningful implementation work:

- update `Docs/dev/context.md`
- update `Docs/dev/resume.md` when the restart/handoff picture changes materially
