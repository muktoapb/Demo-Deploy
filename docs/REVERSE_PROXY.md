# Reverse Proxy and Wildcard TLS

Demo Deploy chooses which site to serve from the HTTP `Host` header. The reverse proxy must send the base domain and all first-level wildcard subdomains to the same container while preserving that header.

## Nginx example

This example assumes Demo Deploy is listening on `127.0.0.1:3000` and a wildcard certificate has already been installed.

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name demos.example.com *.demos.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name demos.example.com *.demos.example.com;

    ssl_certificate /etc/letsencrypt/live/demos.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/demos.example.com/privkey.pem;

    client_max_body_size 100m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Keep `client_max_body_size` equal to or greater than `MAX_UPLOAD_MB`.

Test and reload Nginx:

```sh
sudo nginx -t
sudo systemctl reload nginx
```

## Wildcard certificates

Let's Encrypt only issues wildcard certificates through a DNS-01 challenge. Use Certbot's plugin for your DNS provider or another ACME client with DNS API support.

The certificate should include both names:

```text
demos.example.com
*.demos.example.com
```

## Cloudflare

When Cloudflare proxies the DNS records:

1. Create proxied records for `demos` and `*.demos`.
2. Set SSL/TLS mode to **Full (strict)**.
3. Install a valid origin certificate covering both hostnames.
4. Keep request-body limits large enough for uploads.
5. Do not cache the dashboard routes.

Cloudflare's edge certificate and the origin certificate solve different parts of the connection. Full (strict) requires a valid certificate between Cloudflare and your server.

## Verification

Check the dashboard:

```sh
curl -I https://demos.example.com/login
```

Check that an unknown subdomain reaches Demo Deploy:

```sh
curl -I https://not-deployed.demos.example.com
```

The second request should reach Demo Deploy and return a site-not-found response. A DNS or proxy error means the wildcard route is not reaching the application.
