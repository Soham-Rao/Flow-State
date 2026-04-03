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



