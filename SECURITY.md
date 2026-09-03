# Security Policy

## Reporting a vulnerability

Please report security vulnerabilities privately through GitHub's **Security -> Report a vulnerability** feature for this repository.

Include the affected version, reproduction steps, impact, and any suggested mitigation. Do not include real credentials, client files, or private deployment URLs.

Please allow time for investigation and a fix before public disclosure.

## Deployment responsibility

Demo Deploy hosts user-supplied files. Operators are responsible for HTTPS, server patching, access control, backups, DNS, reverse-proxy configuration, and the content they publish.

Use a unique admin password, a random session secret, and a persistent `/app/data` volume. Do not expose a production installation with the local defaults.
