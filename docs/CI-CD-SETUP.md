# CI/CD Setup

One-time prerequisites for the GitLab pipeline defined in
[`.gitlab-ci.yml`](../.gitlab-ci.yml) to deploy onto **`team-a@87.106.50.149`**.

The pipeline runs **tests** on every push, builds **Docker images** and pushes
them to GitLab's container registry on `main` pushes, then **SSH-deploys** to
the production server. Once these steps below are done, every merge to `main`
ships automatically.

---

## 1. Server-side prerequisites (run once on `87.106.50.149`)

SSH in as `team-a` and prepare the host.

### 1.1 Install Docker + Compose v2

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker team-a
# Re-login so the docker group takes effect, then verify:
docker version
docker compose version
```

### 1.2 Create the deploy directory

```bash
mkdir -p ~/team-a
cd ~/team-a
```

The CI deploy job will rsync `docker-compose.prod.yml` and `init-databases.sql`
into this directory on every deploy. You only need to put the `.env` file
there once (see step 1.4).

### 1.3 Log Docker into the GitLab registry

The deploy host needs to be able to `docker pull` from
`registry.gitlab.com/infra-x-group/team-a/...`. Easiest way:

1. In GitLab go to **Settings → Repository → Deploy tokens**.
2. Create a token: name `prod-server`, scope `read_registry`, no expiry.
3. Copy username + token (you only see it once).
4. On the server:
   ```bash
   docker login registry.gitlab.com -u <token-username>
   # paste the token as password
   ```

Docker stores the credential in `~/.docker/config.json` and reuses it forever.

### 1.4 Create the `.env` file

The prod compose file reads three values from a `.env` next to it:

```bash
cat > ~/team-a/.env <<'EOF'
REGISTRY_IMAGE=registry.gitlab.com/infra-x-group/team-a
DB_PASSWORD=change-me-to-a-strong-password
JWT_SECRET=VGhpcyBpcyBhIHNhbXBsZSBzZWNyZXQga2V5IGZvciBKV1Qgc2lnbmluZyE=
EOF
chmod 600 ~/team-a/.env
```

**Important:** `JWT_SECRET` must be a **Base64-encoded** HMAC-SHA256 key (≥32 raw
bytes) and must be **identical** for `auth-service` and `clinical-service`,
otherwise tokens minted by one will be rejected by the other. Generate a fresh
one once with:

```bash
openssl rand -base64 32
```

The default value above is the demo key from the dev compose file — fine for
a learning deploy, but rotate it before any real use.

### 1.5 Open firewall ports

The edge nginx is the only public-facing service. It needs port **80**
(HTTP, used by Let's Encrypt for the ACME HTTP-01 challenge and to redirect
to HTTPS) and port **443** (HTTPS). Backends and the SPA-serving nginx are
not exposed to the internet — the edge nginx reverse-proxies to them on
the internal docker network.

In the **IONOS Cloud Panel** (or whatever firewall layer your provider
uses), allow inbound TCP 80 and 443 from `0.0.0.0/0`. SSH (22) of course
stays open for the deploy.

If you also use ufw on the server itself, mirror the rules:

```bash
sudo ufw allow 22/tcp   comment 'SSH'
sudo ufw allow 80/tcp   comment 'nginx http (acme + redirect)'
sudo ufw allow 443/tcp  comment 'nginx https'
```

Ports 3000, 8080, 8081 are no longer published outside docker — no rule
needed for them anymore.

### 1.6 Bootstrap the Let's Encrypt certificate (run ONCE)

`docker-compose.prod.yml` mounts a real Let's Encrypt cert into the nginx
container. On a fresh server that file does not exist yet, so nginx
refuses to start, so certbot can't run, so the cert is never issued —
chicken and egg. The bootstrap script `nginx/init-letsencrypt.sh` solves
this by placing a self-signed dummy cert first, starting nginx with the
dummy, then having certbot fetch the real cert and reloading nginx.

```bash
# On the server, in ~/team-a, AFTER docker-compose.prod.yml and the
# nginx/ folder are present (you can copy them once via scp from your
# local clone, or trigger the GitLab pipeline once — even if its deploy
# step fails because there's no cert yet, the rsync part will succeed
# and place the files for you).

cd ~/team-a
chmod +x nginx/init-letsencrypt.sh
./nginx/init-letsencrypt.sh
```

The script downloads recommended TLS parameters, creates a 1-day
self-signed dummy cert, brings up nginx with it, requests the real
cert from Let's Encrypt, and reloads nginx. You should see five
log lines numbered `[1/5]` through `[5/5]` and a final `✓ Done`.

If the cert request fails because of rate limits or other transient
errors, edit `nginx/init-letsencrypt.sh` and set `STAGING=1` to
exercise the flow against the Let's Encrypt staging endpoint (untrusted
certs but no rate limits), confirm everything works end-to-end, then
flip back to `STAGING=0` and run again.

After this script has run successfully **once**, the certbot sidecar
in the compose file will automatically renew the cert before it
expires (every 12 hours it calls `certbot renew`, which is a no-op
unless the cert is within 30 days of expiry). The nginx container
reloads itself every 6 hours to pick up renewed cert files.

---

## 2. GitLab-side prerequisites (configure once)

### 2.1 Generate a deploy SSH key

On any local machine:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/team-a-deploy -C "gitlab-ci@team-a" -N ""
```

This creates `team-a-deploy` (private) and `team-a-deploy.pub` (public).

### 2.2 Authorise the public key on the server

```bash
ssh-copy-id -i ~/.ssh/team-a-deploy.pub team-a@87.106.50.149
# or manually: append the contents of team-a-deploy.pub to
# ~/.ssh/authorized_keys on the server.
```

Verify it works without a password:

```bash
ssh -i ~/.ssh/team-a-deploy team-a@87.106.50.149 'echo OK'
```

### 2.3 Add the private key + known_hosts to GitLab

In **Settings → CI/CD → Variables** add three variables:

| Key | Type | Protect | Mask | Value |
|---|---|---|---|---|
| `SSH_PRIVATE_KEY` | File | ✓ | ✓ | full contents of `~/.ssh/team-a-deploy` (including `-----BEGIN/END-----` lines) |
| `SSH_KNOWN_HOSTS` | Variable | ✓ | ✗ | output of `ssh-keyscan 87.106.50.149` |
| `DEPLOY_HOST` | Variable | ✓ | ✗ | `team-a@87.106.50.149` (optional — already defaulted in `.gitlab-ci.yml`) |

Get the `SSH_KNOWN_HOSTS` value with:

```bash
ssh-keyscan 87.106.50.149
```

**"Protect" must be checked** so the variables are only exposed to pipelines
running on protected branches (i.e. `main`). Without this, any feature branch
could exfiltrate the deploy key.

### 2.4 Mark `main` as protected

In **Settings → Repository → Protected branches** make sure `main` is
listed and that "Allowed to merge" is restricted to maintainers. This is the
gate that controls who can trigger a deploy.

---

## 3. First deploy

Push any commit to `main` (or merge an MR). Watch the pipeline under
**Build → Pipelines**:

```
test:auth-service     ✓ ~30s
test:clinical-service ✓ ~30s
test:frontend-build   ✓ ~60s
build:auth-image      ✓ ~90s
build:clinical-image  ✓ ~90s
build:frontend-image  ✓ ~120s
deploy                ✓ ~30s
```

Then visit:

- https://dev.praxis-form.de               — frontend (TLS via Let's Encrypt)
- https://dev.praxis-form.de/api/auth/login    — auth API
- https://dev.praxis-form.de/api/clinical/forms — clinical API

If `deploy` fails with `Permission denied (publickey)`, re-check step 2.3.
If it succeeds but the containers won't start, SSH in and run
`docker compose -f docker-compose.prod.yml logs -f` to inspect.

If the browser shows a TLS warning, the bootstrap (1.6) was probably
skipped or failed — check `docker compose logs nginx` for cert path
errors and re-run `./nginx/init-letsencrypt.sh`.

To watch certbot's renewal loop (it should print "Cert not yet due for
renewal" every 12 hours after the bootstrap):

```bash
docker compose -f docker-compose.prod.yml logs -f certbot
```

---

## 5. Rollback

To roll back to a previous image without a new commit, SSH to the server:

```bash
cd ~/team-a
IMAGE_TAG=<short-sha-of-previous-good-commit> docker compose -f docker-compose.prod.yml up -d
```

The pipeline tags every image with both `:latest` and `:<short-sha>`, so any
past commit is one-shot reachable.
