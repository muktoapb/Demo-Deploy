# Contributing

Thanks for helping improve Demo Deploy.

## Development setup

```sh
git clone https://github.com/muktoapb/Demo-Deploy.git
cd Demo-Deploy
npm install
npm run dev
```

The default local login is `admin` / `changeme`.

## Before opening a pull request

1. Keep changes focused on the issue being solved.
2. Preserve compatibility with Node.js 20 and newer.
3. Add or update tests for behavior changes.
4. Run `npm test`.
5. Do not commit `.env`, `data/`, uploaded sites, or credentials.
6. Update the README when setup or configuration changes.

## Pull requests

Describe the user-visible behavior, how it was tested, and any deployment or data compatibility considerations. Screenshots are useful for interface changes.

Security vulnerabilities should not be filed as public issues. Follow [SECURITY.md](SECURITY.md).
