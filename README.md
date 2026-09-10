# express-route-lens

A developer tool to inspect and print Express.js routes with recursive discovery, middleware counting, and JSON export for CI/CD integration.

## Features

- **Recursive Route Discovery**: Discovers all routes including nested routers
- **Path Reconstruction**: Tracks path prefixes for nested routes (`/api` + `/v1` + `/users`)
- **Middleware Count**: Shows the number of middleware handlers on each route
- **Route Shadowing Detection**: Identifies routes that may be shadowed by others
- **Security Auditing**: Flags sensitive endpoints with low middleware counts
- **CI/CD JSON Export**: Export routes as JSON for automated API surface tracking
- **Colored CLI Output**: Beautiful console output with method-based colors

## Installation

```bash
npm install express-route-lens --save-dev
```

## Usage

### As a Library

```javascript
const express = require('express');
const { ExpressRoutePrinter, getSecurityAudit } = require('express-route-lens');

const app = express();
const router = express.Router();

router.get('/users', (req, res) => res.json([]));
app.use('/api', router);

const printer = new ExpressRoutePrinter(app);
const routes = printer.printRoutes();

console.log(routes);

// Security audit
const audit = getSecurityAudit(app);
console.log(audit);
```

### As a CLI

```bash
# Print routes from an Express app file
express-route-lens -f ./app.js

# Output as JSON
express-route-lens -f ./app.js --json

# Show middleware count
express-route-lens -f ./app.js --middleware

# Run security audit
express-route-lens -f ./app.js --audit

# Detect route shadowing
express-route-lens -f ./app.js --shadows

# Save output to file
express-route-lens -f ./app.js --output routes.json

# Disable colors
express-route-lens -f ./app.js --no-colors
```

## API

### ExpressRoutePrinter

- `constructor(app, options)` - Create a new printer instance
- `printRoutes()` - Discover and return all routes
- `toJSON()` - Get routes as JSON-serializable array
- `findShadows()` - Detect route shadowing issues
- `getSecurityAudit()` - Run security audit on routes

### Helper Functions

- `printRoutes(app, options)` - Convenience function
- `findShadows(app, options)` - Find shadowed routes
- `getSecurityAudit(app, options)` - Run security audit

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `colorize` | boolean | `true` | Enable colored output |
| `showMiddlewareCount` | boolean | `true` | Show middleware count |
| `basePath` | string | `''` | Base path prefix |

## Automated Releases

This repository includes GitHub Actions workflows for testing and publishing:

- `.github/workflows/ci.yml` runs tests on pushes to `main` and pull requests.
- `.github/workflows/publish.yml` publishes only version tags such as `v1.0.1`.

### Configure npm Trusted Publishing

In npm, open **Package Settings > Trusted Publisher > GitHub Actions** and use:

| Field | Value |
| --- | --- |
| Organization or user | `Tanvir-Alam625` |
| Repository | `express-route-printer` |
| Workflow filename | `publish.yml` |
| Environment name | Leave empty |

The workflow uses GitHub's OIDC token, so no npm token needs to be stored in GitHub Secrets. Keep the workflow filename and repository values exact.

### Release a Version

Update the version without creating a Git tag locally:

```bash
npm version patch --no-git-tag-version
```

Commit the version and lockfile changes, push them, then create and push the matching tag:

```bash
## License
git commit -m "release: v1.0.1"
git push origin main
git tag v1.0.1
git push origin v1.0.1
```

The tag must exactly match the version in `package.json`. The publish workflow installs dependencies, runs tests and the production audit, then publishes `express-route-lens` with provenance.


MIT