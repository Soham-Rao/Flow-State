# FlowState Developer Documentation

This is the official tracked engineering handoff for FlowState. It is written so a developer who did not build the system can still recover the project model, understand the main code paths, and operate production safely.

## Read first

Start in this order if you are joining the project or resuming after a long break:

1. [Project context tracker](context.md)
2. [Resume checkpoint](resume.md)
3. [Project orientation index](project/index.md)
4. [Architecture index](architecture/index.md)
5. [Operations index](operations/index.md)
6. [Quality index](quality/index.md)
7. [Reference index](reference/index.md)

## Documentation map

### Project orientation

- [Index](project/index.md)
- [Product overview and repository orientation](project/product-overview-and-repository-orientation.md)
- [Runtime and build mental model](project/runtime-and-build-mental-model.md)

### Architecture

- [Index](architecture/index.md)
- [Frontend architecture](architecture/frontend-architecture.md)
- [Backend architecture](architecture/backend-architecture.md)
- [Data, auth, permissions, and overrides](architecture/data-auth-and-permissions.md)

### Operations

- [Index](operations/index.md)
- [Deploy, backup, restore, and rollback operations](operations/deploy-backup-restore-and-rollback.md)
- [VPS and environment reference](operations/vps-and-environment-reference.md)
- [Public signup abuse protection and never-assigned account expiry plan](operations/public-signup-abuse-and-account-expiry-plan.md)
- [Detailed VPS setup runbook](vps-setup.md)
- [Detailed VPS operations runbook](vps-operations.md)

### Quality

- [Index](quality/index.md)
- [Testing, debugging, and developer cheat sheet](quality/testing-debugging-and-dev-cheatsheet.md)

### Reference

- [Index](reference/index.md)
- [API, DB, and feature map](reference/api-db-and-feature-map.md)

## Canonical documents

These stay at the root of `Docs/dev/` because they are special-purpose handoff files:

- [context.md](context.md): project phase tracker and working context
- [resume.md](resume.md): what the next contributor should know first

## Documentation contract

- `Docs/dev/` is the canonical source of truth for collaborators.
- `Docs/user/` is the canonical source of truth for end-user help.
- `My_Docs/` is personal/reference-only and ignored by git.
- Production runbooks and deploy expectations belong in `Docs/dev/operations/`, not in personal notes.
