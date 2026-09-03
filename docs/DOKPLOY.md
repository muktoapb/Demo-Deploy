# Deploying Demo Deploy with Dokploy

This guide uses `demos.example.com` as the base domain. Replace it with your own domain.

## 1. Prepare DNS

Create two DNS records pointing to the public IP address of the Dokploy server:

| Type | Name | Value |
| --- | --- | --- |
| `A` | `demos` | Server IPv4 address |
| `A` | `*.demos` | Server IPv4 address |

Add equivalent `AAAA` records when the server uses IPv6. Wait until both names resolve before troubleshooting Dokploy.

## 2. Create the application

1. In Dokploy, create or select a project.
2. Add an **Application**.
3. Choose GitHub as the source.
4. Select `muktoapb/Demo-Deploy`.
5. Choose **Dockerfile** as the build method.
6. Keep the Docker context and Dockerfile path at the repository root.
7. Set the application/container port to `3000`.

The image includes a health check at `/healthz`.

## 3. Add environment variables

Set:

```dotenv
BASE_DOMAIN=demos.example.com
PUBLIC_PROTOCOL=https
ADMIN_USER=admin
ADMIN_PASSWORD=use-a-long-unique-password
SESSION_SECRET=use-a-random-value-at-least-32-characters
DATA_DIR=/app/data
MAX_UPLOAD_MB=100
```

Generate `SESSION_SECRET` locally with:

```sh
openssl rand -hex 32
```

Do not regenerate it on every deployment. Changing it invalidates existing login sessions.

## 4. Add persistent storage

Create a persistent volume in Dokploy and mount it at:

```text
/app/data
```

This volume holds the site registry, the saved password hash, and every uploaded website. Deployments are disposable without this mount.

## 5. Configure the dashboard domain

In Dokploy, route only the base hostname to the `demo-deploy` service on port `3000`:

```text
demos.example.com
```

Do not add `*.demos.example.com` in Dokploy's domain form. Dokploy currently turns that value into the literal Traefik rule `Host(`*.demos.example.com`)`, which does not match real subdomains. The included `docker-compose.yml` creates the required `HostRegexp` routers automatically from `BASE_DOMAIN`.

The base domain serves the dashboard. The `admin` subdomain is also reserved for the dashboard. Every other first-level subdomain is treated as a deployed site slug.

The reverse proxy must preserve the incoming `Host` header. Dokploy's normal application routing does this.

## 6. Configure TLS

You need certificate coverage for:

```text
demos.example.com
*.demos.example.com
```

Wildcard certificates require DNS validation. Choose one of these approaches:

- Configure a DNS challenge in the proxy using your DNS provider.
- Put both DNS records behind Cloudflare and use **Full** mode. The included secure wildcard router terminates origin TLS; for **Full (strict)**, install a Cloudflare Origin Certificate covering the base and wildcard names.
- Install a wildcard certificate from another certificate provider.

Do not publish the service as HTTPS until both the dashboard and one test subdomain pass certificate validation.

## 7. Deploy and verify

Deploy the application, then check:

```text
https://demos.example.com/healthz
```

Expected response:

```json
{"status":"ok"}
```

Sign in at `https://demos.example.com`, create a small test deployment, and confirm its generated subdomain loads over HTTPS.

If the dashboard works but a site returns Traefik's plain `404 page not found`, inspect the running container labels. The wildcard rule must start with `HostRegexp`, not `Host`.

## 8. Back up

Use Dokploy's volume backup facilities or snapshot the mounted volume regularly. A useful backup must include the complete contents of `/app/data`.

Before changing storage settings, download or snapshot a backup and verify that it is readable.
