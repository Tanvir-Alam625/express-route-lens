'use strict';

const MOUNT_PATH = '__expressRouteLensMountPath';

function getStack(appOrRouter) {
  if (!appOrRouter) return null;
  if (Array.isArray(appOrRouter.stack)) return appOrRouter.stack;
  // Express 4 throws when its deprecated `app.router` getter is read.
  let router = appOrRouter._router;
  if (!router) {
    try { router = appOrRouter.router; } catch (error) { return null; }
  }
  return router && Array.isArray(router.stack) ? router.stack : null;
}

function handlerName(handler) { return handler && handler.name ? handler.name : '<anonymous>'; }

/** Mount handlers and preserve the path Express 5 hides from Layer objects. */
function mount(target, path, ...handlers) {
  if (!target || typeof target.use !== 'function') throw new TypeError('mount(target, path, ...handlers) requires an Express app or router');
  if (typeof path !== 'string') throw new TypeError('mount path must be a string');
  const stack = getStack(target);
  const start = stack ? stack.length : 0;
  target.use(path, ...handlers);
  const newStack = getStack(target) || [];
  for (let index = start; index < newStack.length; index += 1) {
    Object.defineProperty(newStack[index], MOUNT_PATH, { configurable: true, value: path });
  }
  return target;
}

class ExpressRoutePrinter {
  constructor(app, options = {}) {
    this.app = app;
    this.options = { basePath: options.basePath || '', sensitivePaths: options.sensitivePaths || ['/admin', '/users', '/profile', '/me', '/dashboard', '/change-password', '/email', '/protected'], ...options };
    this.routes = [];
    this.diagnostics = [];
  }

  printRoutes() {
    this.routes = [];
    this.diagnostics = [];
    this._discoverRoutes(this.app, this.options.basePath);
    return this.routes;
  }

  _discoverRoutes(appOrRouter, basePath = '') {
    const stack = getStack(appOrRouter);
    if (stack) this._processStack(stack, basePath);
  }

  _processStack(stack, basePath) {
    for (const layer of stack) {
      if (layer.route) { this._processRouteLayer(layer, basePath); continue; }
      const childStack = layer.handle && getStack(layer.handle);
      if (!childStack) continue;
      const mountPath = this._extractRouterPath(layer);
      if (mountPath === null) {
        this.diagnostics.push({ code: 'UNRESOLVED_MOUNT_PATH', message: 'Express 5 hides this router mount path. Register it with mount(app, path, router) to include it.', router: handlerName(layer.handle) });
        this._processStack(childStack, basePath);
      } else this._processStack(childStack, this._joinPaths(basePath, mountPath));
    }
  }

  _processRouteLayer(layer, basePath) {
    const route = layer.route;
    const middleware = (route.stack || []).map(item => handlerName(item.handle));
    for (const method of Object.keys(route.methods || {})) {
      this.routes.push({ method: method.toUpperCase(), path: this._joinPaths(basePath, route.path), middlewareCount: middleware.length, middleware: middleware.slice(), layer });
    }
  }

  _extractRouterPath(layer) {
    if (typeof layer[MOUNT_PATH] === 'string') return layer[MOUNT_PATH];
    if (typeof layer.path === 'string') return layer.path;
    // Express 5 stores a closure matcher without an inspectable source path.
    if (!layer.regexp) return null;
    let source = layer.regexp.source || '';
    if (source === '^\\/?(?=\\/|$)' || source === '^\\/?' || source === '^$') return '/';
    source = source.replace(/^\^/, '').replace(/\(\?=\\\/\|\$\)/g, '').replace(/\\\/\?\(\?=\\\/\|\$\)/g, '').replace(/\\\/\?/g, '').replace(/\\\//g, '/').replace(/\$$/, '');
    return source === '' || source === '/' ? '/' : source;
  }

  _joinPaths(basePath, childPath) {
    const joined = `${basePath || ''}/${childPath || ''}`.replace(/\/+/g, '/');
    return joined.length > 1 ? joined.replace(/\/+$/, '') : '/';
  }

  toJSON() { return this.routes.map(route => ({ method: route.method, path: route.path, middlewareCount: route.middlewareCount, middleware: route.middleware })); }
  getRoutes() { return this.routes; }
  getDiagnostics() { return this.diagnostics.slice(); }

  findShadows() {
    const shadows = [];
    const seen = new Set();
    for (const route of this.routes) {
      const key = `${route.method}:${route.path}`;
      if (seen.has(key)) shadows.push({ path: route.path, method: route.method, warning: 'Duplicate method and path registration' });
      seen.add(key);
    }
    return shadows;
  }

  getSecurityAudit() {
    return this.routes.filter(route => {
      const sensitive = this.options.sensitivePaths.some(path => this._pathMatches(route.path, path));
      return sensitive && !route.middleware.some(name => /auth|jwt|session|passport|guard|protect/i.test(name));
    }).map(route => ({ path: route.path, method: route.method, warning: 'No route-level authentication middleware was identified; review this endpoint', middlewareCount: route.middlewareCount, middleware: route.middleware }));
  }

  _pathMatches(routePath, configuredPath) {
    const path = (configuredPath || '').replace(/\/+$/, '');
    return path && (routePath === path || routePath.startsWith(`${path}/`) || routePath.includes(`${path}/`));
  }
}

function printRoutes(app, options = {}) { return new ExpressRoutePrinter(app, options).printRoutes(); }
function findShadows(app, options = {}) { const printer = new ExpressRoutePrinter(app, options); printer.printRoutes(); return printer.findShadows(); }
function getSecurityAudit(app, options = {}) { const printer = new ExpressRoutePrinter(app, options); printer.printRoutes(); return printer.getSecurityAudit(); }

module.exports = { ExpressRoutePrinter, printRoutes, findShadows, getSecurityAudit, mount };
