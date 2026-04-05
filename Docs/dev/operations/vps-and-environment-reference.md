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

This is now part of the expected ops routine.
