# express-route-lens

`express-route-lens` inspects an Express application after its routes are registered. It lists methods, complete paths, route handlers, duplicate registrations, and endpoints that may need an authentication review.

## Install

```bash
npm install --save-dev express-route-lens
```

Node.js 14+ is supported. Express is a peer dependency (Express 4 or 5).

## Use it in an application

```js
const express = require('express');
const { ExpressRoutePrinter, mount } = require('express-route-lens');

const app = express();
const api = express.Router();

function authenticateJWT(req, res, next) { next(); }
api.get('/users', authenticateJWT, (req, res) => res.json([]));

// Use mount for routers. It preserves the mount path for Express 5.
mount(app, '/api', api);

const lens = new ExpressRoutePrinter(app);
lens.printRoutes();
console.log(lens.toJSON());
```

The record for the example includes the full route and the handler names:

```json
{
  "method": "GET",
  "path": "/api/users",
  "middlewareCount": 1,
  "middleware": ["authenticateJWT"],
  "handlers": ["getUsers"]
}
```

## Express 5: use `mount()` for nested paths

Express 5 does not expose a router’s registered mount path through its runtime `Layer` objects. No route inspector can safely recover an unknown mount path after the fact. `mount(target, path, ...handlers)` calls `target.use()` and stores the path as route-inspection metadata, so nested routes remain exact.

Replace router mounts such as:

```js
app.use('/api/auth', authRoutes);
```

with:

```js
import { mount } from 'express-route-lens';
mount(app, '/api/auth', authRoutes);
```

Use it at every nested router boundary:

```js
mount(app, '/api', apiRouter);
mount(apiRouter, '/v1', v1Router);
```

On an untracked Express 5 mount, discovery keeps the child route rather than inventing a wrong path and adds an `UNRESOLVED_MOUNT_PATH` diagnostic. Retrieve diagnostics with `lens.getDiagnostics()` or use the CLI’s `--diagnostics` flag.

## CLI

The inspected module must export the Express app using CommonJS (`module.exports = app`) or expose `app`/`default` from a CommonJS-loadable module.

```bash
# Route table
npx express-route-lens --file ./src/app.js

# Include actual middleware and endpoint handler names separately
npx express-route-lens --file ./src/app.js --middleware

# Search paths, methods, or handler names
npx express-route-lens --file ./src/app.js --search expense
npx express-route-lens --file ./src/app.js --method GET

# Machine-readable output, including diagnostics
npx express-route-lens --file ./src/app.js --json

# Review duplicate registrations or sensitive endpoints
npx express-route-lens --file ./src/app.js --shadows
npx express-route-lens --file ./src/app.js --audit

# Save the selected output
npx express-route-lens --file ./src/app.js --json --output routes.json
```

The CLI uses `require()` to load the app module. For a native ES module, create a small CommonJS inspection entry point or use the library API inside your application after registration.

## API

```js
const lens = new ExpressRoutePrinter(app, {
  sensitivePaths: ['/profile', '/billing', '/internal']
});

lens.printRoutes();
lens.toJSON();           // serializable middleware and handler records
lens.getRoutes();        // route records with internal layer reference
lens.getDiagnostics();   // Express 5 mount-path limitations
lens.findShadows();      // duplicate method/path registrations
lens.getSecurityAudit(); // sensitive routes without an auth-like route handler
```

Convenience exports are also available: `printRoutes(app)`, `findShadows(app)`, and `getSecurityAudit(app)`.

## Audit behavior

The audit is a review signal, not a security guarantee. It looks at middleware names for authentication-related terms such as `auth`, `jwt`, `session`, `guard`, and `protect`, including middleware added by `router.use()`. It deliberately does not flag public login and registration endpoints by default. Configure `sensitivePaths` for your application’s conventions and protect routes with tests.

## Release notes: 1.0.7

- Added Express 5-safe `mount()` metadata tracking for exact nested paths.
- Added route handler names to API and JSON output.
- Separated endpoint handlers from middleware and included applicable `router.use()` middleware.
- Added searchable CLI output with `--search` and `--method`.
- Added discovery diagnostics instead of silently reporting a partial route as complete.
- Improved duplicate reporting and made the security audit less noisy.
