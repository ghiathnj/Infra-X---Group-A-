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

The frontend listens on port 3000, auth on 8080, clinical on 8081. Open them:

```bash
sudo ufw allow 3000/tcp comment 'team-a frontend'
sudo ufw allow 8080/tcp comment 'team-a auth-service'
sudo ufw allow 8081/tcp comment 'team-a clinical-service'
```

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

- http://87.106.50.149:3000  — frontend
- http://87.106.50.149:8080/api/auth/login  — auth API
- http://87.106.50.149:8081/api/clinical/forms  — clinical API

If `deploy` fails with `Permission denied (publickey)`, re-check step 2.3.
If it succeeds but the containers won't start, SSH in and run
`docker compose -f docker-compose.prod.yml logs -f` to inspect.

---

## 4. Known follow-ups (out of scope for this MR)

The pipeline gets the **services running on the server**. Two things still
need a small follow-up MR before the SPA fully works against the deployed
backends from a remote browser:

1. **Frontend env URLs.** [`frontend/src/environments/environment.prod.ts`](../frontend/src/environments/environment.prod.ts)
   currently hardcodes `http://localhost:8080` and `:8081`. From a browser
   pointing at `87.106.50.149:3000`, those URLs resolve to the user's own
   machine, not the server. Either:
   - replace with `http://87.106.50.149:8080` / `:8081`, or
   - set `apiBaseUrl: ''` and add reverse-proxy rules to
     [`frontend/nginx.conf`](../frontend/nginx.conf) so `/api/auth/*` and
     `/api/clinical/*` proxy to the backends inside the docker network.

2. **CORS allowed origins.** Both `SecurityConfig` classes
   ([auth](../auth-service/src/main/java/infrax/teama/auth_service/config/SecurityConfig.java),
   [clinical](../clinical-service/src/main/java/infrax/teama/clinical_service/security/SecurityConfig.java))
   only allow `http://localhost:3000` and `:8081`. Add
   `http://87.106.50.149:3000` to both lists, or read the allowed origins
   from an environment variable.

The simpler-and-cleaner fix is option 1's reverse-proxy approach: the SPA
calls relative URLs, nginx proxies them inside the docker network, and CORS
becomes a non-issue because everything is same-origin.

---

## 5. Rollback

To roll back to a previous image without a new commit, SSH to the server:

```bash
cd ~/team-a
IMAGE_TAG=<short-sha-of-previous-good-commit> docker compose -f docker-compose.prod.yml up -d
```

The pipeline tags every image with both `:latest` and `:<short-sha>`, so any
past commit is one-shot reachable.
