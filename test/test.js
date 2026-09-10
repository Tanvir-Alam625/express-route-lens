const express = require('express');
const { ExpressRoutePrinter, findShadows, getSecurityAudit } = require('../src/index');

const app = express();

app.use(express.json());

app.get('/', (req, res) => res.send('Home'));

const apiRouter = express.Router();

const v1Router = express.Router({ mergeParams: true });

v1Router.get('/users', (req, res) => res.json([]));
v1Router.get('/users/:id', (req, res) => res.json({ id: req.params.id }));
v1Router.post('/users', (req, res) => res.json({}));

const adminRouter = express.Router();
adminRouter.get('/dashboard', (req, res) => res.send('Admin Dashboard'));
adminRouter.get('/settings', (req, res) => res.send('Settings'));

apiRouter.use('/v1', v1Router);
apiRouter.use('/admin', adminRouter);

app.use('/api', apiRouter);

app.get('/api/test', (req, res) => res.json({ test: true }));
app.get('/api/auth/register', (req, res) => res.json({}));

console.log('=== Test 1: Basic Route Discovery ===');
const printer = new ExpressRoutePrinter(app);
const routes = printer.printRoutes();

console.log(`Found ${routes.length} routes:`);
routes.forEach(r => {
  console.log(`  [${r.method}] ${r.path} (middleware: ${r.middlewareCount})`);
});

const expressFiveStyleApp = { router: app._router };
const expressFiveStyleRoutes = new ExpressRoutePrinter(expressFiveStyleApp).printRoutes();
if (expressFiveStyleRoutes.length !== routes.length) {
  throw new Error('Express 5-style app.router discovery failed');
}

console.log('\n=== Test 2: JSON Export ===');
console.log(JSON.stringify(printer.toJSON(), null, 2));

console.log('\n=== Test 3: Security Audit ===');
const audit = getSecurityAudit(app);
if (!audit.some(issue => issue.path === '/api/auth/register')) {
  throw new Error('Security audit did not flag an unprotected auth route');
}
audit.forEach(a => console.log(`  ⚠ [${a.method}] ${a.path}: ${a.warning}`));

console.log('\n=== Test 4: Shadow Detection ===');
const shadows = printer.findShadows();
if (shadows.length > 0) {
  shadows.forEach(s => console.log(`  ⚠ ${s.path} shadowed by ${s.shadowedBy}`));
} else {
  console.log('  ✓ No shadowing detected');
}

console.log('\n=== All tests passed ===');