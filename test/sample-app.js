const express = require('express');

const app = express();

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

module.exports = app;