# Demo Deploy

Demo Deploy is a lightweight, self-hosted Netlify alternative for publishing static website demos. Upload a ZIP archive or a folder and the site is immediately available on its own subdomain.

It is designed for freelancers, agencies, and small teams that regularly share HTML, CSS, and JavaScript demos with clients and want a simple deployment dashboard on their own server.

> Demo Deploy is an independent project and is not affiliated with Netlify.

## What it does

- Publishes static files to automatic subdomains
- Accepts ZIP archives and browser folder uploads
- Provides sandboxed thumbnails and full-page previews
- Organizes deployments by client or project group
- Searches, filters, edits, redeploys, and deletes sites
- Supports SPA fallback to `index.html`
- Stores everything on one persistent disk volume
- Protects the admin with signed sessions, hashed passwords, and CSRF tokens
- Runs as one small Docker container with no database

## What it does not do

Demo Deploy serves already-built static files. It does not run framework builds, deploy from Git, provide serverless functions, collect analytics, or manage multiple user roles. Build React, Vue, Astro, or similar projects first, then upload the generated output directory.

## Pages

| URL | Purpose |
| --- | --- |
| `/` | Overview and recent deployments |
| `/sites` | Preview, group, edit, redeploy, and delete sites |
| `/sites/new` | Create a new deployment |
| `/settings` | View installation details and change the admin password |
| `/healthz` | Container and reverse-proxy health check |

## Quick start with Docker

Requirements: Docker with Docker Compose.

```sh
git clone https://github.com/muktoapb/Demo-Deploy.git
cd Demo-Deploy
cp .env.example .env
docker compose up -d --build
```

Open [http://localhost:3000](http://localhost:3000) and sign in with:

```text
Username: admin
Password: changeme
```

Go to **Settings** and change the password before exposing the dashboard publicly. Uploaded sites are available locally at URLs such as `http://my-site.localhost:3000`.

Stop the app with:

```sh
docker compose down
```

The named Docker volume is preserved. Do not add `--volumes` unless you intend to delete all deployments and the saved admin password.

## Local development

Requirements: Node.js 20 or newer.

```sh
git clone https://github.com/muktoapb/Demo-Deploy.git
cd Demo-Deploy
npm install
npm run dev
```

The development server runs at [http://localhost:3000](http://localhost:3000). Run the test suite with:

```sh
npm test
```

## Production checklist

For a public installation you need:

1. A Linux server with Docker.
2. A domain or delegated subdomain, such as `demos.example.com`.
3. A normal DNS record and a wildcard DNS record pointing to the server.
4. A reverse proxy that forwards both hostnames to port `3000`.
5. HTTPS coverage for the base domain and its wildcard.
6. A persistent volume mounted at `/app/data`.
7. Strong `ADMIN_PASSWORD` and `SESSION_SECRET` values.

Using a dedicated subdomain is recommended:

```text
Dashboard:        https://demos.example.com
Admin alias:      https://admin.demos.example.com
Uploaded site:    https://client-name.demos.example.com
```

### DNS

Create both records:

```text
Type  Name       Value
A     demos      YOUR_SERVER_IP
A     *.demos    YOUR_SERVER_IP
```

For IPv6, add matching `AAAA` records. DNS only sends traffic to the server; your reverse proxy must also accept the wildcard hostname.

### Production environment

Create a `.env` file:

```dotenv
BASE_DOMAIN=demos.example.com
PUBLIC_PROTOCOL=https
ADMIN_USER=admin
ADMIN_PASSWORD=replace-with-a-long-unique-password
SESSION_SECRET=replace-with-output-from-openssl-rand
MAX_UPLOAD_MB=100
```

Generate a session secret:

```sh
openssl rand -hex 32
```

Start the container:

```sh
docker compose up -d --build
```

Public deployments fail fast if the admin password is shorter than 12 characters or the session secret is shorter than 32 characters.

## Dokploy setup

Demo Deploy can be deployed directly from this repository using the included Dockerfile.

1. Point `demos.example.com` and `*.demos.example.com` to the Dokploy server.
2. In Dokploy, create an Application from this GitHub repository.
3. Select **Dockerfile** as the build type and use port `3000`.
4. Add the production environment variables shown above.
5. Create persistent storage and mount it at `/app/data`.
6. Route both `demos.example.com` and `*.demos.example.com` to the application.
7. Enable HTTPS for the base domain and install wildcard TLS coverage.
8. Deploy and check `https://demos.example.com/healthz`.

Wildcard certificates normally require a DNS challenge. If Dokploy cannot issue one with your DNS provider, use a Cloudflare Origin Certificate or another wildcard certificate at the proxy.

See [Dokploy deployment](docs/DOKPLOY.md) for the complete walkthrough and [reverse proxy setup](docs/REVERSE_PROXY.md) for Nginx and TLS examples.

## Environment variables

| Name | Local default | Production requirement | Purpose |
| --- | --- | --- | --- |
| `PORT` | `3000` | Optional | HTTP port inside the container |
| `BASE_DOMAIN` | `localhost` | Your public domain | Base domain used for the dashboard and site URLs |
| `PUBLIC_PROTOCOL` | `http` | `https` | Public URL scheme |
| `ADMIN_USER` | `admin` | Recommended to change | Dashboard username |
| `ADMIN_PASSWORD` | `changeme` | Minimum 12 characters | Initial password before an in-app password is saved |
| `SESSION_SECRET` | Development placeholder | Minimum 32 random characters | Signs login and CSRF tokens |
| `DATA_DIR` | `./data` | `/app/data` | Persistent registry, credentials, and site files |
| `MAX_UPLOAD_MB` | `100` | 1 to 1024 | Per-file upload limit |

Environment changes require a container restart. A password changed in Settings is stored as a scrypt hash in `DATA_DIR/admin.json` and takes precedence over `ADMIN_PASSWORD`.

## Deploying a site

1. Build the site locally if it uses a framework.
2. Make sure the upload root contains `index.html`.
3. Open **New deployment**.
4. Enter a name, subdomain, and optional client group.
5. Choose either one ZIP archive or one website folder.
6. Keep SPA fallback enabled for client-side routers.
7. Select **Deploy site**.

A ZIP may contain one top-level folder; Demo Deploy automatically promotes it when that folder contains `index.html`. A new deployment never overwrites an existing subdomain. Use **Sites -> Manage site -> Redeploy** to replace files intentionally.

## Persistent data and backups

All mutable data lives under `DATA_DIR`:

```text
data/
  admin.json
  sites.json
  sites/
    site-slug/
      current/
```

Back up the named Compose volume:

```sh
docker run --rm \
  -v demo-deploy_demo-deploy-data:/data:ro \
  -v "$PWD":/backup \
  alpine tar -czf /backup/demo-deploy-backup.tar.gz -C /data .
```

Verify the generated archive before relying on it. To move installations, restore the data into a new `/app/data` volume before starting Demo Deploy.

## Updating

```sh
git pull
docker compose up -d --build
```

The persistent volume is not replaced during rebuilds. Back it up before upgrades.

## Security notes

- Put the dashboard behind HTTPS.
- Keep `SESSION_SECRET` stable and private; changing it signs out existing sessions.
- Use a unique admin password and change it from Settings when needed.
- Do not expose port `3000` directly when a reverse proxy is available.
- Uploaded sites are untrusted content and are isolated from the admin by subdomains and sandboxed previews.
- Only upload files you are allowed to host.

To report a vulnerability, follow [SECURITY.md](SECURITY.md).

## Troubleshooting

### The dashboard works but site subdomains do not

Confirm that wildcard DNS points to the server, the reverse proxy accepts `*.demos.example.com`, and the proxy preserves the original `Host` header.

### HTTPS works on the dashboard but not uploaded sites

The certificate covers only the base hostname. Install a wildcard certificate for `*.demos.example.com`. A normal HTTP certificate challenge cannot issue wildcard certificates.

### The container exits during startup

Read the container logs:

```sh
docker compose logs demo-deploy
```

Public domains require an admin password of at least 12 characters and a session secret of at least 32 characters.

### An uploaded app shows 404 on client-side routes

Open **Sites -> Manage site**, enable **Use index.html for app routes**, and save.

### Uploads disappear after a redeploy

The `/app/data` path is not mounted to persistent storage. Add the volume before uploading production data.

## Contributing

Issues and pull requests are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) before submitting changes.

## License

Demo Deploy is available under the [MIT License](LICENSE).
