# FlowState VPS Setup (Ubuntu 22.04)

This is the recommended production path for the BigRock VPS:
- Nginx on the host
- FlowState app as a `systemd` service on the host
- MySQL 8.0 in Docker
- Canonical domain: `flo-state.in`
- `www.flo-state.in` redirects to apex

## Planned server layout

- App repo: `/opt/flowstate/app`
- App env file: `/etc/flowstate/flowstate.env`
- Uploads: `/var/lib/flowstate/uploads`
- MySQL compose dir: `/opt/flowstate/infra`
- App service name: `flowstate`
- App port behind Nginx: `4000`

## 1. Create an SSH key locally

If you do not already have a key pair on your machine:

### Windows PowerShell
```powershell
ssh-keygen -t ed25519 -C "flowstate-vps"
Get-Content $env:USERPROFILE\.ssh\id_ed25519.pub
```

### macOS / Linux
```bash
ssh-keygen -t ed25519 -C "flowstate-vps"
cat ~/.ssh/id_ed25519.pub
```

Copy the public key output.

## 2. First login as root and create the non-root user

Log into the VPS as `root`, then run:

```bash
adduser flowstate
usermod -aG sudo flowstate
mkdir -p /home/flowstate/.ssh
cp ~/.ssh/authorized_keys /home/flowstate/.ssh/authorized_keys
chown -R flowstate:flowstate /home/flowstate/.ssh
chmod 700 /home/flowstate/.ssh
chmod 600 /home/flowstate/.ssh/authorized_keys
```

Keep your current root session open.
In a new terminal, verify you can log in as `flowstate` before disabling root/password auth.

```bash
ssh flowstate@YOUR_SERVER_IP
```

## 3. Harden SSH

Recommended: keep port `22` for the first setup pass and harden auth first. We can change the SSH port later if you want.

Create `/etc/ssh/sshd_config.d/flowstate.conf`:

```conf
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
PubkeyAuthentication yes
ChallengeResponseAuthentication no
X11Forwarding no
```

Then reload SSH:

```bash
systemctl restart ssh
```

Confirm you can still log in as `flowstate`.

## 4. Base packages, firewall, and Fail2Ban

```bash
apt update && apt upgrade -y
apt install -y ca-certificates curl gnupg unzip git nginx ufw fail2ban certbot python3-certbot-nginx docker.io docker-compose-plugin
systemctl enable --now nginx
systemctl enable --now docker
systemctl enable --now fail2ban
usermod -aG docker flowstate
```

Configure UFW:

```bash
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
ufw status
```

## 5. Install Node 22 and Bun

Install Node 22:

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs
node -v
npm -v
```

Install Bun as `flowstate`:

```bash
sudo -u flowstate bash -lc 'curl -fsSL https://bun.sh/install | bash'
sudo -u flowstate bash -lc 'source ~/.bashrc && bun --version'
```

## 6. Prepare directories

```bash
install -d -m 0755 -o flowstate -g flowstate /opt/flowstate
install -d -m 0755 -o flowstate -g flowstate /opt/flowstate/infra
install -d -m 0755 -o flowstate -g flowstate /var/lib/flowstate/uploads
install -d -m 0755 /etc/flowstate
```

## 7. Clone the repo on the server

Recommended: clone as the `flowstate` user into `/opt/flowstate/app`.

```bash
sudo -u flowstate git clone <YOUR_REPO_URL> /opt/flowstate/app
```

If the repo is private, use a GitHub deploy key on the server or clone with a PAT. Deploy key is the cleaner option.

## 8. Start production MySQL in Docker

```bash
cp /opt/flowstate/app/deploy/vps/mysql.env.example /opt/flowstate/infra/mysql.env
cp /opt/flowstate/app/deploy/vps/docker-compose.prod.yml /opt/flowstate/infra/docker-compose.prod.yml
nano /opt/flowstate/infra/mysql.env
```

Set strong values in `mysql.env`, then start MySQL:

```bash
cd /opt/flowstate/infra
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml ps
```

## 9. Create the app env file

```bash
cp /opt/flowstate/app/server/.env.production.example /etc/flowstate/flowstate.env
nano /etc/flowstate/flowstate.env
```

Set at minimum:
- `NODE_ENV=production`
- `PORT=4000`
- `CLIENT_ORIGIN=https://flo-state.in`
- `PUBLIC_APP_URL=https://flo-state.in`
- `MYSQL_URL=mysql://flowstate:<app-password>@127.0.0.1:3306/flowstate_prod`
- `JWT_SECRET=<long-random-secret>`
- `FLOWSTATE_DM_ENCRYPTION_KEY=<32-byte key as 64 hex or 44 base64>`
- `FLOWSTATE_UPLOADS_DIR=/var/lib/flowstate/uploads`

Lock down the env file:

```bash
chown root:flowstate /etc/flowstate/flowstate.env
chmod 640 /etc/flowstate/flowstate.env
```

## 10. Build the app and run migrations

```bash
sudo -u flowstate bash -lc 'cd /opt/flowstate/app && ~/.bun/bin/bun install --frozen-lockfile'
sudo -u flowstate bash -lc 'cd /opt/flowstate/app && ~/.bun/bin/bun run build'
cd /opt/flowstate/app
set -a && source /etc/flowstate/flowstate.env && set +a
node server/dist/db/migrate.js
```

Quick health check before Nginx:

```bash
cd /opt/flowstate/app
set -a && source /etc/flowstate/flowstate.env && set +a
node server/dist/index.js
```

Then from another shell:

```bash
curl http://127.0.0.1:4000/api/health
```

Stop the foreground server after the check.

## 11. Install the systemd service

```bash
cp /opt/flowstate/app/deploy/vps/flowstate.service /etc/systemd/system/flowstate.service
systemctl daemon-reload
systemctl enable flowstate
systemctl start flowstate
systemctl status flowstate --no-pager
journalctl -u flowstate -n 100 --no-pager
```

## 12. Install the Nginx site config

```bash
cp /opt/flowstate/app/deploy/vps/nginx.flowstate.conf /etc/nginx/sites-available/flowstate
ln -s /etc/nginx/sites-available/flowstate /etc/nginx/sites-enabled/flowstate
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx
```

## 13. Point DNS and enable SSL

In BigRock DNS:
- Point `flo-state.in` A record to the VPS public IP
- Point `www.flo-state.in` A record to the same IP

After DNS is live:

```bash
certbot --nginx -d flo-state.in -d www.flo-state.in
systemctl reload nginx
```

## 14. First production smoke test

Run these checks:

```bash
curl http://127.0.0.1:4000/api/health
curl -I http://flo-state.in
curl -I https://flo-state.in
curl -I https://flo-state.in/api/health
```

Then verify in the browser:
- login/register
- board load
- card create/edit
- threads load
- file upload
- live socket reconnect after refresh

## 15. Routine redeploy flow

After new code is on the server:

```bash
cd /opt/flowstate/app
git pull --ff-only
bash deploy/vps/redeploy.sh
```

## Notes

- Do not expose MySQL publicly. The prod compose file binds it to `127.0.0.1` only.
- The VPS path for uploads is `/var/lib/flowstate/uploads`, which matches the production env examples.
- The repo contains the deploy files used here:
  - `deploy/vps/docker-compose.prod.yml`
  - `deploy/vps/mysql.env.example`
  - `deploy/vps/flowstate.service`
  - `deploy/vps/nginx.flowstate.conf`
  - `deploy/vps/redeploy.sh`





## Cheat Sheet

This is the short replayable version of what we actually did on the BigRock VPS, including the fixes for the issues we hit.

### Setup order we actually followed

1. DNS and hosting assumptions
- BigRock VPS hosts the app.
- BigRock DNS currently serves `flo-state.in`.
- Canonical domain is `flo-state.in`.
- `www.flo-state.in` redirects to apex.

2. SSH key and first access
- Create a dedicated local SSH key for the VPS.
- Add the `flowstate` user.
- Put the public key into `/home/flowstate/.ssh/authorized_keys` manually if the provider SSH-key UI fails.
- Add a local SSH config alias such as:

```sshconfig
Host flowstate-vps
    HostName 66.116.233.148
    User flowstate
    IdentityFile ~/.ssh/id_ed25519_flowstate
    IdentitiesOnly yes
```

- After that, normal login becomes:

```bash
ssh flowstate-vps
```

3. SSH hardening
- Keep direct `root` SSH disabled.
- Use `flowstate` plus `sudo` for admin work.
- If you need root later:

```bash
sudo -i
```

4. Base server setup
- Install system packages.
- Enable `nginx`, `docker`, and `fail2ban`.
- Enable UFW with `OpenSSH`, `80`, and `443` only.
- Reboot once after kernel updates.

5. Runtime install
- Install Node 22.
- Install Bun as `flowstate`.
- Confirm `node`, `npm`, and `bun` all work.

6. App layout
- Repo at `/opt/flowstate/app`
- Infra files at `/opt/flowstate/infra`
- Env file at `/etc/flowstate/flowstate.env`
- Uploads at `/var/lib/flowstate/uploads`

7. Database
- MySQL runs in Docker only.
- App runs on the host under `systemd`.
- DB is bound to `127.0.0.1:3306` only.

8. App deploy
- `bun install --frozen-lockfile`
- `bun run build`
- source `/etc/flowstate/flowstate.env`
- run `node server/dist/db/migrate.js`
- install and start `flowstate.service`

9. Reverse proxy and HTTPS
- Nginx proxies `80/443` to `127.0.0.1:4000`
- Certbot issues the Let's Encrypt certificate
- Certbot timer handles auto-renewal

### Problems we hit and how we fixed them

1. SSH host key negotiation failed
- Error looked like: `no matching host key type found. Their offer: ssh-rsa`
- Cause: server `sshd_config` had a bad `HostKeyAlgorithms=ssh-rsa,...` restriction.
- Fix: comment that line out, keep modern host keys enabled, restart SSH.

2. Public-key login still failed
- Cause: wrong local private key path was being used.
- Fix: use the actual dedicated key file and add a local SSH alias.

3. Password auth still worked even after hardening
- Cause: `/etc/ssh/sshd_config.d/50-cloud-init.conf` still had `PasswordAuthentication yes` and was taking precedence.
- Fix: create `/etc/ssh/sshd_config.d/00-flowstate-hardening.conf` with:

```conf
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
PubkeyAuthentication yes
ChallengeResponseAuthentication no
X11Forwarding no
```

4. Bun install failed
- Error: `unzip is required to install bun`
- Fix: `sudo apt install -y unzip`

5. `docker-compose-plugin` package was not available
- Fix: install `docker.io` and `docker-compose` first, then later install `docker-compose-v2` explicitly.

6. Old `docker-compose` crashed with `KeyError: 'ContainerConfig'`
- Cause: Compose v1 bug against newer Docker/container metadata.
- Fix: install Compose v2 and use `docker compose`, not `docker-compose`.

7. Server clone was missing deploy files and prod env examples
- Cause: the public GitHub repo had not yet been updated with the local deployment work.
- Fix at the time: create missing files manually on the VPS.
- Better long-term fix: keep deploy files committed and pull before setup.

8. Client build failed on `ignoreDeprecations` / `baseUrl`
- Cause: stale TypeScript config drift.
- Fix: remove `ignoreDeprecations: "6.0"` and later remove deprecated `baseUrl` entirely.

9. App build failed because some types changed
- Fixes applied:
- pass `assignedCount` to the board header
- add `bio: null` to `BoardMember` test mocks
- include `bio` in thread user summary mapping on the server

10. `MYSQL_URL` failed Zod validation
- Cause: base64 password characters do not fit raw URL format safely.
- Better fix: use hex passwords for DB credentials that go into URLs.

11. MySQL auth failed even after fixing the URL
- Cause: container volume had already been initialized with older credentials; changing `mysql.env` alone does not update an existing MySQL volume.
- Fix: because prod DB was still empty, reset MySQL cleanly with:

```bash
docker compose -f docker-compose.prod.yml down -v
```

- Then recreate with fresh known hex passwords and start again.

12. `certbot` command was missing
- Fix: install with:

```bash
sudo apt install -y certbot python3-certbot-nginx
```

### Points to remember

- Use `ssh flowstate-vps`, not direct `root` SSH.
- Use `sudo -i` if you need a root shell.
- Prefer hex passwords for values that end up inside URLs.
- Changing MySQL env values does not retroactively change credentials in an already-initialized MySQL volume.
- `docker compose` is the correct command on this VPS.
- Keep `/etc/flowstate/flowstate.env` owned by `root:flowstate` with `640` permissions.
- Keep MySQL bound to `127.0.0.1` only.
- Certbot renewal is automatic through `certbot.timer`.
- The first production signup becomes admin, so do the first signup intentionally.
- For future pulls, it is fine to keep `Docs/` on the VPS for reference for now, even though it may later be excluded from production-only deploys.

### Minimal command checklist

```bash
ssh flowstate-vps
cd /opt/flowstate/app
git pull origin master
bun install --frozen-lockfile
bun run build
set -a
source /etc/flowstate/flowstate.env
set +a
node server/dist/db/migrate.js
sudo systemctl restart flowstate
sudo systemctl status flowstate --no-pager
curl https://flo-state.in/api/health
```

### Useful checks

```bash
systemctl status flowstate --no-pager
journalctl -u flowstate -n 100 --no-pager
docker compose -f /opt/flowstate/infra/docker-compose.prod.yml ps
systemctl status certbot.timer --no-pager
curl http://127.0.0.1:4000/api/health
curl https://flo-state.in/api/health
sudo certbot renew --dry-run
```
