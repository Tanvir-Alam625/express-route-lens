'use strict';

class ExpressRoutePrinter {
  constructor(app, options = {}) {
    this.app = app;
    this.options = {
      showMiddlewareCount: options.showMiddlewareCount !== false,
      colorize: options.colorize !== false,
      basePath: options.basePath || '',
      ...options
    };
    this.routes = [];
  }

  printRoutes() {
    this.routes = [];
    this._discoverRoutes(this.app, this.options.basePath);
    return this.routes;
  }

  _discoverRoutes(layerOrRouter, basePath = '') {
    if (!layerOrRouter) return;

    if (layerOrRouter.stack) {
      this._processStack(layerOrRouter.stack, basePath);
    } else if (layerOrRouter._router && layerOrRouter._router.stack) {
      this._processStack(layerOrRouter._router.stack, basePath);
    }
  }

  _processStack(stack, basePath) {
    for (const layer of stack) {
      if (layer.route) {
        this._processRouteLayer(layer, basePath);
      } else if (layer.name === 'router' && layer.handle && layer.handle.stack) {
        const routePath = this._extractRouterPath(layer);
        this._processStack(layer.handle.stack, basePath + routePath);
      } else if (layer.regexp && layer.path !== undefined && layer.path !== '/') {
        const routePath = this._extractRouterPath(layer);
        if (layer.handle && layer.handle.stack) {
          this._processStack(layer.handle.stack, basePath + routePath);
        }
      }
    }
  }

  _processRouteLayer(layer, basePath) {
    const route = layer.route;
    const fullPath = this._normalizePath(basePath + route.path);

    for (const method of Object.keys(route.methods)) {
      this.routes.push({
        method: method.toUpperCase(),
        path: fullPath,
        middlewareCount: layer.route.stack ? layer.route.stack.length : 0,
        layer
      });
    }
  }

  _extractRouterPath(layer) {
    if (layer.path) return layer.path;
    if (!layer.regexp) return '';

    let source = layer.regexp.source || layer.regexp.toString();
    if (source === '^\\/?(?=\\/|$)' || source === '^\\/?' || source === '^$') {
      return '/';
    }

    source = source.replace(/^\^/, '');
    source = source.replace(/\(\?=\\\/\|\$\)/g, '');
    source = source.replace(/\\\/\?/g, '');
    source = source.replace(/\\\//g, '/');
    source = source.replace(/\(\?:[^)]+\)/g, '');
    source = source.replace(/\$$/, '');

    return source === '' || source === '/' ? '/' : source;
  }

  _normalizePath(pathStr) {
    if (!pathStr || pathStr === '') return '/';
    if (pathStr === '/') return pathStr;
    return pathStr.replace(/\/+$/, '') || '/';
  }

  toJSON() {
    return this.routes.map(route => ({
      method: route.method,
      path: route.path,
      middlewareCount: route.middlewareCount
    }));
  }

  getRoutes() {
    return this.routes;
  }

  findShadows() {
    const shadows = [];
    const pathMethods = new Map();

    for (const route of this.routes) {
      const key = `${route.method}:${route.path}`;
      if (pathMethods.has(key)) {
        shadows.push({
          path: route.path,
          method: route.method,
          shadowedBy: pathMethods.get(key)
        });
      } else {
        pathMethods.set(key, route.method);
      }
    }

    return shadows;
  }

  getSecurityAudit() {
    const sensitivePaths = ['/admin', '/api/admin', '/auth', '/api/auth', '/users', '/api/users'];
    const audit = [];

    for (const route of this.routes) {
      const isSensitive = sensitivePaths.some(sensitivePath =>
        route.path.startsWith(sensitivePath) || route.path.includes(sensitivePath)
      );

      if (isSensitive && route.middlewareCount < 2) {
        audit.push({
          path: route.path,
          method: route.method,
          warning: 'Low middleware count - verify authentication is present',
          middlewareCount: route.middlewareCount
        });
      }
    }

    return audit;
  }
}

function printRoutes(app, options = {}) {
  const printer = new ExpressRoutePrinter(app, options);
  return printer.printRoutes();
}

function findShadows(app, options = {}) {
  const printer = new ExpressRoutePrinter(app, options);
  printer.printRoutes();
  return printer.findShadows();
}

function getSecurityAudit(app, options = {}) {
  const printer = new ExpressRoutePrinter(app, options);
  printer.printRoutes();
  return printer.getSecurityAudit();
}

module.exports = {
  ExpressRoutePrinter,
  printRoutes,
  findShadows,
  getSecurityAudit
};
