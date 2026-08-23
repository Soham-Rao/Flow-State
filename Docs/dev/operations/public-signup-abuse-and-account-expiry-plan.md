# Public Signup Abuse Protection and Never-Assigned Account Expiry Plan

## Purpose

FlowState intentionally keeps account registration open so visitors can evaluate the product without first obtaining a registration password. Workspace creation remains protected by the workspace creation password, and joining a workspace still requires a valid workspace join code or invite.

Open registration creates two separate concerns:

1. abandoned accounts can accumulate in the database; and
2. automated signup traffic can consume CPU, memory, and request capacity before abandoned accounts are eventually removed.

This plan addresses both concerns without changing workspace isolation, rerunning the historical workspace backfill, or placing a visible challenge in front of normal users.

## Required outcomes

- A user who has **never had any workspace membership** expires after 48 hours.
- Existing, backfilled, active, suspended, and removed workspace members are never selected by this cleanup.
- A pending, unexpired email-bound workspace invite temporarily protects a matching account from cleanup.
- Explicitly protected showcase, owner, and test accounts are never selected.
- Cleanup is disabled by default, supports a report-only mode, runs in bounded batches, and requires a recent successful backup before destructive mode.
- Registration gets its own stricter rate limit instead of sharing the login limit.
- A hidden honeypot rejects obvious automated submissions before password hashing or database writes.
- Normal users see no CAPTCHA and no additional registration step.
- Operators can observe, stop, verify, and roll back the feature safely.

## Non-goals

- Do not rerun or modify the completed historical workspace backfill.
- Do not automatically assign newly registered users to the original workspace.
- Do not delete users merely because they have no **active** workspace. A suspended or removed membership is historical proof that the account was assigned.
- Do not use account deletion as the primary defense against traffic spikes. Deletion happens later and cannot recover CPU already spent hashing passwords.
- Do not add the workspace creation password to registration.
- Do not expose the workspace creation password or its hash to the client.
- Do not introduce a visible CAPTCHA in the first rollout.

## Existing implementation constraints

The implementation must work with these current behaviors:

- `users.created_at` is available and can be used to calculate the 48-hour cutoff.
- `workspace_memberships` retains `active`, `suspended`, and `removed` membership states.
- New production registrations without an invite can remain workspace-less.
- Invite email comparison is normalized to lowercase.
- `registerRateLimiter` currently shares `AUTH_RATE_LIMIT_WINDOW_MS` and `AUTH_RATE_LIMIT_MAX` with login and password-reset endpoints.
- The current `express-rate-limit` store is in memory. Its counters reset when the server restarts and are not shared across multiple server instances.
- Production correctly trusts one reverse proxy hop, and Nginx forwards the client address.
- Password hashing uses bcrypt cost 12, so abusive requests should be rejected before `bcrypt.hash` whenever possible.
- Deleting a user can cascade into many domain tables. Cleanup cannot be implemented as an unguarded age-based `DELETE FROM users` statement.
- Audit log actor references are set to `NULL` when a user is deleted, so cleanup records must use a non-PII target identifier if they need to remain attributable.

## Policy definition

### Meaning of never assigned

A user is never assigned only when **no row exists** in `workspace_memberships` for that user, regardless of membership status.

This deliberately differs from “has no active workspace.” The following users are ineligible for automatic deletion:

- active members;
- suspended members;
- removed members;
- members of archived workspaces; and
- users whose membership is otherwise inaccessible through the current UI.

Keeping the historical membership row is the safety boundary that prevents the cleanup from erasing former real users and their authored data.

### Eligibility predicate

A user is eligible only when every condition below is true at deletion time:

1. `users.created_at <= current_time - retention_period`;
2. no `workspace_memberships` row exists for the user;
3. the normalized user email is not in the protected-email configuration;
4. the user ID is not in the protected-ID configuration;
5. no pending, unrevoked, unaccepted, unexpired invite exists for the same normalized email;
6. the account has no unexpected workspace/domain data references; and
7. cleanup is explicitly operating in destructive mode.

The final delete statement must re-evaluate the age, membership, protection, and invite conditions. Candidate selection alone is insufficient because membership or invite state can change between selection and deletion.

### Invite grace behavior

An email-bound invite protects the account while:

- `accepted_at IS NULL`;
- `revoked_at IS NULL`; and
- `expires_at > current_time`.

After the invite expires or is revoked, the account becomes eligible on a later cleanup run if all other conditions still hold. Token-only invites without an email cannot safely be matched to a particular workspace-less account and therefore do not extend account retention.

### Protected accounts

Add two server-only, comma-separated environment settings:

- `UNASSIGNED_ACCOUNT_PROTECTED_EMAILS`
- `UNASSIGNED_ACCOUNT_PROTECTED_USER_IDS`

Values must be trimmed; emails must be normalized to lowercase; empty values must be ignored. Production should include the public demo account, the project owner account, operational test accounts, and any account used by monitoring.

Protection is checked both during candidate discovery and in the final deletion guard. Protected values must never be returned by a public API.

## Configuration design

Add validated server configuration with conservative defaults:

| Setting | Default | Purpose |
| --- | ---: | --- |
| `UNASSIGNED_ACCOUNT_CLEANUP_MODE` | `disabled` | One of `disabled`, `report`, or `delete` |
| `UNASSIGNED_ACCOUNT_RETENTION_HOURS` | `48` | Minimum age before eligibility |
| `UNASSIGNED_ACCOUNT_CLEANUP_BATCH_SIZE` | `25` | Maximum users examined/deleted per run |
| `UNASSIGNED_ACCOUNT_REQUIRE_RECENT_BACKUP` | `true` | Blocks destructive mode without a recent successful backup |
| `UNASSIGNED_ACCOUNT_MAX_BACKUP_AGE_HOURS` | `26` | Maximum age of the qualifying backup manifest |
| `UNASSIGNED_ACCOUNT_PROTECTED_EMAILS` | empty | Normalized protected account emails |
| `UNASSIGNED_ACCOUNT_PROTECTED_USER_IDS` | empty | Protected immutable user IDs |
| `REGISTER_RATE_LIMIT_WINDOW_MS` | `3600000` | One-hour registration limit window |
| `REGISTER_RATE_LIMIT_MAX` | `5` | Registration requests allowed per client address per window |
| `REGISTRATION_HONEYPOT_ENABLED` | `true` in production | Enables server-side honeypot enforcement |

The registration limit should initially count all requests, not only successful accounts. Invalid registrations still consume parsing, logging, lookup, and potentially hashing work. Five requests per hour leaves room for normal form corrections while being substantially stricter than the current shared limit of ten per 15 minutes.

All settings must be documented in the production environment reference and deployment example. Startup validation should reject invalid modes, non-positive periods, and unsafe batch sizes. Cap the batch size to a modest upper bound such as 100.

## Workstream 1: account expiry

### 1. Candidate query service

Create a dedicated module, for example:

- `server/src/modules/account-cleanup/account-cleanup.service.ts`
- `server/src/modules/account-cleanup/account-cleanup.types.ts`

The service should:

1. calculate one UTC cutoff at the beginning of the run;
2. select users older than the cutoff in deterministic `created_at`, `id` order;
3. use `NOT EXISTS` against all workspace membership rows;
4. use `NOT EXISTS` against matching live email-bound invites;
5. exclude protected emails and IDs;
6. request no more than the configured batch size; and
7. return structured reasons and counts in report mode.

Do not select password hashes. Candidate logs should use a SHA-256/HMAC-derived user identifier rather than email, name, or raw user ID.

### 2. Domain-data anomaly guard

Before deletion, verify that a candidate has no unexpected domain history. The initial implementation must audit every foreign key from a domain table to `users` and classify it as one of:

- expected account-only child data that may be removed, such as password reset tokens or notification preferences;
- nullable historical attribution that is intentionally anonymized, such as an audit-log actor; or
- business/domain data that makes automatic deletion unsafe.

If any business/domain reference exists—workspace creation, invite creation, boards, cards, comments, messages, activities, bug reports, or similar—the service must skip the user and emit an anomaly event. It must not rely on database cascades to decide what is acceptable to lose.

Keep the classification centralized and covered by a schema-focused test so future user foreign keys cannot silently bypass the guard.

### 3. Destructive transaction

For each bounded batch:

1. start a transaction;
2. re-evaluate the full eligibility predicate using the database clock or the run's fixed cutoff;
3. re-run the anomaly guard;
4. delete only rows whose final predicate remains true;
5. allow only explicitly classified account-only cascades;
6. commit; and
7. write a non-PII cleanup audit/operations event with the outcome.

If a membership, invite, protected value, or unexpected domain reference appears, skip that user without failing the entire batch. Database errors should fail the batch, preserve the transaction boundary, and cause the command to exit non-zero.

The command must be idempotent: running it twice should not error or affect additional users before they independently meet the policy.

### 4. Command-line entry point

Add a compiled server command such as:

- `server/src/jobs/cleanup-unassigned-accounts.ts`
- package script `accounts:cleanup`

Supported behavior:

- configuration controls the default mode;
- an explicit `--report` flag can force non-destructive output;
- destructive execution requires both `UNASSIGNED_ACCOUNT_CLEANUP_MODE=delete` and a recent-backup check;
- output is structured and includes scanned, eligible, protected, invite-exempt, anomaly-skipped, deleted, and failed counts;
- no password hashes, names, emails, invite tokens, or raw credentials are logged;
- overlapping runs are prevented with a MySQL advisory lock;
- the database connection always closes on success or failure.

Do not invoke this command from application startup or database migration. A cleanup failure must not prevent the main FlowState service from starting.

### 5. User-facing expiry notice

Expose authenticated account-retention metadata from an account-safe endpoint, preferably by extending `GET /api/auth/account`:

```json
{
  "workspaceAssignment": {
    "hasEverBeenAssigned": false,
    "expiresAt": "2026-08-19T12:00:00.000Z"
  }
}
```

Rules:

- `expiresAt` is present only for accounts that are currently subject to the never-assigned policy.
- Any membership row, including suspended or removed, makes `hasEverBeenAssigned` true and removes the expiry countdown.
- A matching pending invite should expose the extended effective expiry or a clear “pending invitation protects this account” state.
- The server remains authoritative; the client countdown is informational.

On the workspace-selection page, show a calm warning such as:

> Join or create a workspace by 19 Aug, 12:00 UTC to keep this account.

Also explain that workspace creation requires the private creation password while joining requires the workspace's code or invite. Avoid presenting account expiry as an error immediately after registration.

### 6. Scheduling

Add a dedicated systemd oneshot service and timer:

- `deploy/vps/flowstate-account-cleanup.service`
- `deploy/vps/flowstate-account-cleanup.timer`

Recommended schedule:

- run once daily after the existing daily backup window;
- use `Persistent=true` so a missed run is retried after reboot;
- add a randomized delay to avoid all maintenance work starting simultaneously;
- run as the existing `flowstate` user;
- load `/etc/flowstate/flowstate.env`;
- execute the compiled cleanup job with `/usr/bin/node`; and
- set a bounded systemd timeout.

The job must verify the latest successful backup manifest itself. Ordering the timer after a backup service is useful but is not proof that the backup succeeded.

## Workstream 2: stricter registration rate limits

### 1. Separate registration configuration

Change `registerRateLimiter` to use `REGISTER_RATE_LIMIT_WINDOW_MS` and `REGISTER_RATE_LIMIT_MAX`. Keep login and password reset on their existing authentication settings so tightening signup does not accidentally lock legitimate users out of login.

The public API should continue returning the standard JSON `429` response. Do not reveal the exact bucket state or why a request was classified as abusive.

### 2. Verify client-address handling

Production currently trusts one reverse proxy hop and Nginx supplies `X-Forwarded-For`. Add an integration/operations check that confirms two distinct external addresses do not share a limiter bucket and that a client cannot choose its own effective address by supplying a forged forwarded header through Nginx.

Do not increase the Express `trust proxy` setting beyond the known production topology.

### 3. Add an edge-level burst guard

Application rate limiting protects business logic, but the request has already reached Node. Add a narrowly scoped Nginx `limit_req` zone for `POST /api/auth/register` to absorb obvious bursts before JSON parsing and bcrypt work.

The edge limit should:

- key by the actual remote client address;
- allow a small burst for browser retries;
- return `429`, not a maintenance page;
- apply only to registration;
- leave login, invite lookup, health, and Socket.IO behavior unchanged; and
- be tested with `nginx -t` before reload.

The application limit remains the authoritative longer-window policy. The Nginx limit is only a short-burst safety layer.

### 4. Limiter storage decision

For the current single-process VPS, the in-memory application limiter is acceptable as an initial layer when paired with Nginx. Document that it resets on service restart.

Before running multiple Node instances or multiple VPS nodes, replace it with a shared limiter store such as Redis. Do not introduce Redis solely for this rollout unless monitoring shows the current layers are insufficient.

## Workstream 3: invisible registration honeypot

### 1. Client field

Add an off-screen text input to the registration form with:

- a neutral field name that legitimate users never need;
- `tabIndex={-1}`;
- `aria-hidden="true"`;
- `autoComplete="off"`;
- an empty initial value; and
- layout/CSS that prevents it from affecting the visible form or page size.

Do not use `type="hidden"`; simplistic bots often ignore hidden inputs but populate ordinary-looking text inputs. The associated label should also be off-screen and excluded from the accessibility tree.

The client must submit the value exactly as received. Client-side checks are only UX; the server decides whether to reject it.

### 2. API schema and early guard

Add the honeypot field as an optional, tightly length-limited string in the registration request schema. Check it immediately after lightweight body validation and before:

- invite database lookup;
- existing-email lookup;
- user-count lookup;
- bcrypt hashing; and
- user insertion.

When the feature is enabled and the trimmed field is non-empty:

- do not create a user;
- do not hash a password;
- do not expose which field caused rejection;
- return a generic registration failure response; and
- emit a privacy-safe `auth.register.blocked` audit event with reason `honeypot`.

Never log the honeypot contents because bots may place arbitrary or malicious data in it.

The honeypot must fail open when the field is absent so older cached clients remain compatible during deployment. After the new client is widely deployed, absence may be monitored as a signal but should not become a hard requirement without a separate rollout decision.

### 3. Limitations

A honeypot catches unsophisticated automation; it is not proof that a visitor is human. It must remain one layer alongside rate limiting, monitoring, and optional future verification. Avoid adding artificial multi-second sleeps that tie up scarce server connections.

## Workstream 4: supporting safeguards

### Audit and metrics

Record aggregate, privacy-safe events for:

- registration rate-limit hits;
- honeypot blocks;
- cleanup report candidates;
- protected-account exclusions;
- live-invite exclusions;
- domain-data anomalies;
- successful deletions; and
- cleanup job failures.

Operational logs should make it possible to answer:

- How many registrations were attempted, blocked, and completed?
- How many workspace-less accounts are approaching expiry?
- How many accounts would report mode delete?
- Did any candidate contain unexpected domain data?
- Did the most recent cleanup complete, and was it destructive?

Avoid permanent storage of raw IP addresses beyond the project's existing audit policy. Continue applying `AUDIT_LOG_RETENTION_DAYS`.

### Privacy and product documentation

Update the Privacy Policy, Terms or account-access documentation as appropriate so users are told before registration that never-assigned accounts are removed after 48 hours. The registration page should link to the existing legal documents and the workspace-selection page should show the concrete deadline.

Document that joining or creating a workspace prevents automatic expiry permanently, even if membership is later suspended or removed.

### Optional later controls

Only add these after measuring the first rollout:

- email verification before allowing expensive or write-heavy features;
- a signed registration-page timestamp/challenge to detect impossible submission speed;
- disposable-email-domain checks;
- a privacy-conscious bot-management service at the edge; or
- a visible/accessibility-compatible challenge triggered only after suspicious behavior.

These are not required for the initial implementation and should not silently expand the registration data collected.

## Database and migration strategy

The initial implementation can derive eligibility from `users.created_at`, membership existence, invite state, and environment protection lists. It therefore does not require a destructive schema migration.

Before adding an index, run `EXPLAIN` against the real candidate query. If the user table becomes large enough to justify it, add an additive index on `users.created_at` in a separate, backup-gated migration. Do not combine an optional performance index with cleanup activation.

There must be no data backfill in this feature. In particular:

- do not create workspace memberships;
- do not change existing membership status;
- do not rewrite user creation dates; and
- do not remove the historical migration records that prove the original backfill already ran.

## Test plan

### Account cleanup service tests

Cover at least these cases:

- 47-hour workspace-less account is retained.
- Exactly-at-cutoff and older workspace-less accounts are eligible according to one documented boundary rule.
- Active member is retained.
- Suspended member is retained.
- Removed member is retained.
- Member of an archived workspace is retained.
- Protected email is retained with case-insensitive matching.
- Protected user ID is retained.
- Matching pending email invite retains the account.
- Expired, revoked, or accepted invite does not retain an otherwise eligible account.
- Token-only invite does not accidentally protect every workspace-less account.
- Account-only child rows are handled as explicitly designed.
- Any unexpected domain record skips deletion and emits an anomaly.
- Report mode performs zero writes.
- Disabled mode performs zero candidate/deletion work.
- Delete mode removes only eligible candidates.
- Batch size is enforced and ordering is deterministic.
- A membership created between initial selection and final deletion prevents deletion.
- A live invite created before the final guarded delete prevents deletion.
- Repeated runs are idempotent.
- Failure rolls back the current transaction and exits non-zero.
- Logs contain no email, name, password hash, invite token, or raw protected list.

### Registration protection tests

Cover at least these cases:

- Normal empty-honeypot registration still succeeds.
- Missing honeypot field remains compatible with an older client.
- Filled honeypot creates no user and never calls bcrypt.
- Filled honeypot does not perform invite or existing-email lookups.
- Honeypot contents are absent from logs and responses.
- Registration uses its dedicated configured window and maximum.
- Login continues using the original authentication limiter.
- Limit responses use status `429` and the standard API error shape.
- Production proxy configuration derives the expected client address.
- Test configuration can exercise real low limits without the current test-only limit expansion masking behavior.

### Client tests

Cover at least these cases:

- Honeypot is not visible, tabbable, announced, or layout-affecting.
- Honeypot value is included in the registration request.
- Expiry notice appears only for never-assigned accounts.
- Displayed deadline comes from server-authoritative metadata.
- Joining or creating a workspace removes the notice after state refresh.
- Pending-invite protection is communicated correctly.
- Existing password confirmation, visibility controls, strength meter, and legal consent remain functional.

### Operations tests

Verify:

- systemd unit syntax;
- timer schedule and persistence;
- service environment loading;
- advisory-lock behavior;
- backup freshness failure behavior;
- report-mode output on a production-shaped database copy;
- `nginx -t` with the edge registration limit;
- health readiness after Nginx reload and app restart; and
- restore of a deliberately expired test account from a backup in a scratch database.

## Rollout sequence

### Phase 0: establish a baseline

Before code deployment, record:

- total user count;
- count of users with no membership row;
- age distribution of never-assigned users;
- count of matching live email invitations;
- current registration attempt and rate-limit event volume; and
- latest verified backup status.

Manually inspect the proposed protected account list. Do not place passwords in that list or in command history.

### Phase 1: deploy non-destructive protections

Deploy:

- dedicated registration rate-limit configuration;
- honeypot client and server handling;
- account-expiry metadata and UI warning;
- cleanup command in `disabled`/`report` capability; and
- logging/metrics.

Keep cleanup mode set to `disabled` initially. Confirm normal registration, invitation registration, workspace joining, workspace creation, and login in production.

### Phase 2: report-only cleanup

Set:

```text
UNASSIGNED_ACCOUNT_CLEANUP_MODE=report
```

Run the job manually and through its timer for at least two scheduled cycles. Compare every reported candidate against:

- membership history;
- protected accounts;
- pending invites;
- domain-data anomaly results; and
- the expected 48-hour cutoff.

Any unexpected candidate blocks destructive activation. Fix the predicate or data invariant and repeat the complete report-only observation period.

### Phase 3: bounded destructive activation

Immediately before activation:

1. confirm a recent successful backup and manifest;
2. verify the backup in the scratch restore path;
3. capture report-mode candidate counts;
4. set `UNASSIGNED_ACCOUNT_CLEANUP_MODE=delete`;
5. keep the initial batch size small, preferably 5;
6. run once manually;
7. inspect job logs, database counts, auth health, and workspace health; and
8. only then enable the timer.

Increase the batch size to the normal value only after at least one clean scheduled run.

### Phase 4: monitor and tune

Review after 24 hours, 72 hours, and one week:

- false-positive or support reports;
- number of signup attempts and completions;
- rate-limit and honeypot hit rates;
- Node CPU and response latency during signup bursts;
- cleanup candidates, deletions, and anomalies; and
- backup and timer health.

Tune limits only from observed behavior. A high honeypot count does not justify weakening the membership and backup safety rules.

## Disable and recovery procedures

### Immediate stop

To stop future deletion:

- set `UNASSIGNED_ACCOUNT_CLEANUP_MODE=disabled`;
- stop and disable the cleanup timer if necessary; and
- leave registration and normal application service running.

Cleanup failure must never require disabling workspace access.

### Code rollback

Because the initial plan requires no schema change, the application and timer code can be rolled back independently. Remove or disable the timer before rolling back the command it invokes. Nginx rate-limit changes can also be reverted separately after validating the previous configuration.

### Deleted-account recovery

A hard-deleted account cannot be reconstructed reliably from application logs. Recovery requires the verified database backup taken before deletion.

Restore must first occur into the scratch database. Extract and validate the specific account and permitted account-only child rows before any production recovery operation. Do not overwrite the whole production database merely to restore one mistakenly deleted account.

If selective recovery tooling is not ready when destructive mode is proposed, keep the cleanup in report mode.

## Expected files affected during implementation

Exact names can vary, but implementation should remain within these areas:

- `server/src/config/env.ts`
- `server/src/middleware/rate-limit.ts`
- `server/src/modules/auth/auth.schema.ts`
- `server/src/modules/auth/auth.route.ts`
- `server/src/modules/auth/auth.service.ts`
- `server/src/modules/account-cleanup/`
- `server/src/jobs/cleanup-unassigned-accounts.ts`
- `server/tests/auth.test.ts`
- new account-cleanup server tests
- `server/package.json`
- `client/src/pages/register-page.tsx`
- `client/src/lib/auth-api.ts`
- `client/src/stores/auth-store.ts`
- workspace-selection/account-expiry UI and tests
- `deploy/vps/nginx.flowstate.conf`
- new systemd cleanup service and timer
- production environment examples and operations documentation

After implementation, update the repository knowledge graph with `graphify update .`.

## Definition of done

This work is complete only when:

- never-assigned eligibility means zero membership rows of any status;
- pending live email invites and protected accounts are excluded;
- domain-data anomalies fail safe;
- cleanup defaults to disabled and report mode is proven against production-shaped data;
- destructive mode requires a recent verified backup and uses bounded transactions;
- no completed workspace backfill is rerun;
- signup limiting is independent of login limiting;
- burst protection rejects requests before expensive password hashing where possible;
- the honeypot is invisible and accessible to legitimate users while remaining server-enforced;
- all tests above pass;
- production health remains green after deployment;
- timer, backup, cleanup, and rate-limit behavior are documented; and
- a selective recovery procedure has been validated before automatic deletion is enabled.
