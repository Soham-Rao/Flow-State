# Testing, Debugging, and Developer Cheat Sheet

FlowState has enough moving parts that testing strategy should be intentional rather than improvised.

## Broad testing split

There are several important categories:

- client tests
- server tests
- build verification
- operational script verification
- production drill verification

## Client tests

Client tests are useful for:

- component behavior
- API error mapping
- route-specific workflows
- user-facing regression coverage

Recent examples include error UX and legal/bug-report behavior.

## Server tests

Server tests cover:

- auth flows
- cards and boards behavior
- roles/permission logic
- threads behavior
- bug reports
- migration guard behavior
- ops helpers

One important practical note:

- some server tests share one MySQL test DB
- running the full suite sequentially can avoid cross-file race issues

Preserve this operational knowledge until the test isolation story changes.

## Build verification

Because FlowState is a built client and built server app, successful builds are a major safety signal even before runtime tests.

Common checks:

- `bun run --cwd client build`
- `bun run --cwd server build`

## Debugging by layer

When debugging, first classify the layer:

- browser UI issue
- client API issue
- server logic issue
- DB issue
- deploy/ops issue
- proxy or env issue

Then use the matching tools. Do not jump randomly across layers without a hypothesis.

## High-value local commands

Use the repo scripts for:

- local development
- build
- lint
- test

Use the VPS shell scripts for:

- deploy
- backup
- restore verification
- rollback

## Regression mindset

Because the app includes both product features and production safety tooling, review changes for:

- behavioral regressions
- permission regressions
- migration/deploy regressions
- user-facing error regressions

A “small” change can still break deploy safety or maintenance UX if it touches the wrong boundary.
