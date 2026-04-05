# Deploy, Backup, Restore, and Rollback Operations

FlowState’s production workflow is intentionally safer than a plain “pull and restart” loop. This file summarizes the operational contract a developer should preserve.

## Primary production command

The default day-to-day production update path is:

- `bash deploy/vps/update-safe.sh`

This wrapper performs:

- env/tool checks
- remote state fetch
- safe deploy invocation
- readiness verification
- service/timer checks

## Why `update-safe.sh` exists

It gives operators one high-level entry point instead of expecting them to remember:

- repo sync steps
- build assumptions
- readiness timing
- service verification

It also prints compact success output while remaining verbose on failures.

## Safe deploy path

The safe deploy flow includes:

- maintenance mode enable
- predeploy backup
- build
- migration execution
- restart
- readiness wait
- maintenance disable
- rollback path on failure

That flow is intentionally more defensive than the older fast redeploy path.

## Backups

The backup workflow now includes:

- compressed DB archives
- optional encrypted offsite archives
- manifests with checksums and metadata
- retention pruning

This means operational changes that touch backup format must be made carefully and verified end to end.

## Restore verification

Backups are not treated as trustworthy by existence alone. The production workflow now supports restore verification against a scratch DB path.

Important lessons learned from real rollout:

- manifest-based restore logic must handle encrypted offsite paths correctly
- scratch DB naming and grants matter
- backup/restore scripts must account for real dump behavior, not only ideal assumptions

## Rollback

Rollback drills have already been exercised in production. The operational expectation is:

- code rollback must remain straightforward
- health must be rechecked afterward
- returning to latest should be simple and safe

Future changes must preserve this property.

## Maintenance behavior

The maintenance flow now includes:

- cleaner maintenance page
- auto-refresh behavior
- improved handling for already-open client tabs

This was improved because raw proxy errors were not acceptable UX during deploy windows.

## Migration guardrails in operations

Production migration safety now includes:

- advisory locking
- risky migration linting
- risk acknowledgement comment requirement
- backup-gated risky path
- metadata emitted into manifests/logs

Operational contributors should treat these as part of the contract, not optional niceties.
