# VPS and Environment Reference

This file is the quick orientation layer for production configuration and VPS expectations.

## Production model

Current production is:

- single VPS
- nginx in front
- Bun server app
- MySQL in Docker
- R2-backed offsite backup flow

That model should be assumed unless explicitly changed in future architecture work.

## Important filesystem locations

Commonly relevant locations include:

- app repo checkout under `/opt/flowstate/app`
- env file under `/etc/flowstate/flowstate.env`
- backup storage under `/var/lib/flowstate/backups`

## High-value env categories

Production env contains values for:

- DB access
- auth secrets
- DM encryption key
- backup encryption
- R2 credentials
- public app URL
- ops alerting configuration
- restore verification scratch DB URL
- dedicated registration rate limits and honeypot enforcement
- never-assigned account cleanup mode, retention, backup gate, and protected accounts

When adding new env values, ask whether they are:

- secret
- production-tunable
- environment-specific

Only then should they usually live in env.

## Important service-level checks

After meaningful production changes, validate:

- local readiness endpoint
- public readiness endpoint
- main app service status
- daily backup timer
- weekly backup timer
- never-assigned account cleanup timer when cleanup has been installed

## Never-assigned account cleanup

The cleanup ships in `disabled` mode. Production rollout must progress through `disabled`, then `report`, and only then `delete` after candidate inspection and scratch restore verification.

Install the units after deploying a build that contains the compiled cleanup job:

```bash
sudo install -m 0644 deploy/vps/flowstate-account-cleanup.service /etc/systemd/system/flowstate-account-cleanup.service
sudo install -m 0644 deploy/vps/flowstate-account-cleanup.timer /etc/systemd/system/flowstate-account-cleanup.timer
sudo systemctl daemon-reload
sudo systemctl enable --now flowstate-account-cleanup.timer
sudo systemctl status flowstate-account-cleanup.timer --no-pager
```

Run a manual report without enabling deletion:

```bash
set -a
source /etc/flowstate/flowstate.env
set +a
/usr/bin/node server/dist/jobs/cleanup-unassigned-accounts.js --report
```

Before reloading the repository Nginx configuration, always run `sudo nginx -t`. The exact registration location adds short-burst protection while the application enforces the longer registration window.

This is now part of the expected ops routine.
