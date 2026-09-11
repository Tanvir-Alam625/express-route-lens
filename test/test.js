'use strict';

const assert = require('assert');
const express = require('express');
const { ExpressRoutePrinter, mount } = require('../src');

function authenticateJWT(req, res, next) { next(); }
function listUsers(req, res) { res.json([]); }

const app = express();
const api = express.Router();
const v1 = express.Router();
v1.get('/users', authenticateJWT, listUsers);
mount(api, '/v1', v1);
mount(app, '/api', api);
app.get('/health', (req, res) => res.json({ ok: true }));

const printer = new ExpressRoutePrinter(app);
const routes = printer.printRoutes();
assert.deepStrictEqual(printer.toJSON(), [
  { method: 'GET', path: '/api/v1/users', middlewareCount: 2, middleware: ['authenticateJWT', 'listUsers'] },
  { method: 'GET', path: '/health', middlewareCount: 1, middleware: ['<anonymous>'] }
]);
assert.strictEqual(printer.getDiagnostics().length, 0);
assert.strictEqual(printer.getSecurityAudit().length, 0);

// Model the opaque mount matcher used by Express 5. It exposes no `path` or
// `regexp`, which is why explicit tracking is required.
function modernApp() {
  return {
    router: { stack: [] },
    use(path, ...handlers) {
      handlers.forEach(handle => this.router.stack.push({ handle, matchers: [() => true] }));
    }
  };
}
function modernRouter() {
  return { stack: [{ route: { path: '/items', stack: [{ handle: listUsers }], methods: { get: true } } }] };
}

// An untracked Express 5 router must never be reported with a false complete path.
const app5 = modernApp();
const router5 = modernRouter();
app5.use('/api', router5);
const untracked = new ExpressRoutePrinter(app5);
assert.strictEqual(untracked.printRoutes()[0].path, '/items');
assert.strictEqual(untracked.getDiagnostics()[0].code, 'UNRESOLVED_MOUNT_PATH');

const trackedApp5 = modernApp();
const trackedRouter5 = modernRouter();
mount(trackedApp5, '/api', trackedRouter5);
assert.strictEqual(new ExpressRoutePrinter(trackedApp5).printRoutes()[0].path, '/api/items');

console.log('All tests passed');
