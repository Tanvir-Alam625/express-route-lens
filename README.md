# express-route-lens

Inspect an Express application without starting a second server. `express-route-lens` discovers routes registered directly on an app or through nested routers, reconstructs mounted paths, reports route middleware counts, detects duplicate method/path registrations, and audits configured sensitive paths.

## Features

- Recursive discovery of Express 4 and Express 5 applications and routers
- Full path reconstruction for mounted routers such as `/api/auth/register`
- HTTP method and route middleware reporting
- JSON output for scripts and CI pipelines
- Sensitive-route security audit based on middleware count
- Duplicate route detection
- CLI output with optional colors and file export

## Requirements

- Node.js 14 or newer
- Express 4.18 or Express 5

## Installation

Install as a development dependency:

```bash
npm install --save-dev express-route-lens
```

The package includes the CLI runtime dependencies. Your application must provide Express as a peer dependency.

## Library Usage

### CommonJS

```js
const express = require('express');
const {
  ExpressRoutePrinter,
  getSecurityAudit
} = require('express-route-lens');

const app = express();
const router = express.Router();

router.get('/users', (req, res) => res.json([]));
app.use('/api', router);

const printer = new ExpressRoutePrinter(app);
const routes = printer.printRoutes();

console.log('Registered routes:', printer.toJSON());
console.log('Security audit:', getSecurityAudit(app));
```

### ES Modules

Run route discovery after all application routes and middleware have been registered:

```js
import express from 'express';
import { ExpressRoutePrinter, getSecurityAudit } from 'express-route-lens';
import authRoutes from './routes/auth.js';
import expenseRoutes from './routes/expense.js';

const app = express();

app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/expenses', expenseRoutes);

app.get('/api/protected', authenticateJWT, requireVerifiedEmail, (req, res) => {
  res.json({ user: req.user });
});

const printer = new ExpressRoutePrinter(app);
console.log('Registered Routes:', printer.toJSON());

const securityAudit = getSecurityAudit(app);
console.log('Security Audit:', securityAudit);

export default app;
```

Example output for a mounted authentication router:

```js
{
  method: 'POST',
  path: '/api/auth/register',
  middlewareCount: 1
}
```

`middlewareCount` is the number of handlers attached directly to that route. Application-level middleware such as `express.json()` is not counted as route middleware.

## Security Audit

The audit checks sensitive paths and reports routes with fewer than two route middleware handlers. It is a review aid, not a replacement for authentication tests or a complete security scanner.

The default sensitive path patterns are:

```text
/admin, /auth, /users, /profile, /me, /dashboard,
/register, /login, /change-password, /email
```

Patterns match path segments inside mounted routes. For example, `/auth` matches `/api/auth/register`.

Customize the patterns when your application uses different conventions:

```js
const audit = getSecurityAudit(app, {
  sensitivePaths: ['/billing', '/settings', '/internal']
});
```

An audit warning looks like this:

```js
{
  path: '/api/profile',
  method: 'GET',
  warning: 'Low middleware count - verify authentication is present',
  middlewareCount: 1
}
```

Public endpoints such as registration and login may intentionally have a low middleware count. Remove them from `sensitivePaths` when they should not be reviewed:

```js
const audit = getSecurityAudit(app, {
  sensitivePaths: ['/profile', '/me', '/change-password']
});
```

## CLI

Point the CLI at a module that exports an Express app. The module may use CommonJS (`module.exports = app`) or expose `app`/`default`.

```bash
# Print a route table
npx express-route-lens --file ./app.js

# Export routes as JSON
npx express-route-lens --file ./app.js --json

# Run the security audit
npx express-route-lens --file ./app.js --audit

# Detect duplicate method/path registrations
npx express-route-lens --file ./app.js --shadows

# Save output to a file and disable colors
npx express-route-lens --file ./app.js --json --output routes.json --no-colors
```

Options:

| Option | Description |
| --- | --- |
| `-f, --file <path>` | Express app module to inspect |
| `-j, --json` | Print JSON route data |
| `-m, --middleware` | Show middleware counts |
| `--audit` | Run the sensitive-route audit |
| `--shadows` | Report duplicate method/path registrations |
| `-o, --output <file>` | Write output to a file |
| `--no-colors` | Disable colored terminal output |

## API

### `ExpressRoutePrinter`

```js
const printer = new ExpressRoutePrinter(app, options);
```

| Method | Description |
| --- | --- |
| `printRoutes()` | Discover routes and return route records |
| `toJSON()` | Return serializable method, path, and middleware data |
| `getRoutes()` | Return the most recently discovered route records |
| `findShadows()` | Find duplicate method/path registrations |
| `getSecurityAudit()` | Audit the discovered routes |

Options:

| Option | Default | Description |
| --- | --- | --- |
| `basePath` | `''` | Prefix added to every discovered route |
| `showMiddlewareCount` | `true` | Retained for output compatibility |
| `colorize` | `true` | Retained for output compatibility |
| `sensitivePaths` | See audit section | Path patterns reviewed by the audit |

### Helper functions

```js
const {
  printRoutes,
  findShadows,
  getSecurityAudit
} = require('express-route-lens');

printRoutes(app, options);
findShadows(app, options);
getSecurityAudit(app, options);
```

## Development

```bash
npm install
npm test
```

The test suite covers nested routers, Express-style app router discovery, JSON output, shadow detection, and security auditing.

## Releases

Releases are published by the GitHub Actions workflow when a matching version tag is pushed:

```bash
npm version patch --no-git-tag-version
npm test
git add package.json package-lock.json
git commit -m "release: vX.Y.Z"
git push origin main
git tag -a vX.Y.Z -m "Release vX.Y.Z"
git push origin vX.Y.Z
```

The tag must match the version in `package.json` exactly. npm trusted publishing must be configured for the repository workflow before publishing.

## License

MIT
