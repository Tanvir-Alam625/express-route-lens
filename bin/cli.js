#!/usr/bin/env node
'use strict';

const { Command } = require('commander');
const chalk = require('chalk');
const Table = require('cli-table3');
const fs = require('fs');
const path = require('path');
const packageJson = require('../package.json');
const { ExpressRoutePrinter } = require('../src/index');

const program = new Command();
program.name('express-route-lens').description('Inspect Express routes, middleware, and mount paths').version(packageJson.version)
  .requiredOption('-f, --file <path>', 'Path to a module exporting an Express app')
  .option('-j, --json', 'Output structured JSON')
  .option('--no-colors', 'Disable colored output')
  .option('-m, --middleware', 'Show middleware names in table output')
  .option('-s, --search <text>', 'Filter by method, path, or middleware name')
  .option('--method <method>', 'Filter by HTTP method')
  .option('--shadows', 'Detect duplicate method/path registrations')
  .option('--audit', 'Review sensitive routes for route-level authentication middleware')
  .option('--diagnostics', 'Show discovery diagnostics')
  .option('-o, --output <file>', 'Save selected output to file');
program.parse(process.argv);
const opts = program.opts();

function writeOutput(output) {
  if (opts.output) fs.writeFileSync(path.resolve(opts.output), output);
  else process.stdout.write(`${output}\n`);
  if (opts.output && !opts.json) console.log(chalk.green(`Saved to ${opts.output}`));
}

function matches(route) {
  const text = opts.search && opts.search.toLowerCase();
  const searchable = `${route.method} ${route.path} ${(route.middleware || []).join(' ')}`.toLowerCase();
  return (!text || searchable.includes(text)) && (!opts.method || route.method === opts.method.toUpperCase());
}

async function main() {
  const appPath = path.resolve(opts.file);
  if (!fs.existsSync(appPath)) throw new Error(`File not found: ${appPath}`);
  delete require.cache[require.resolve(appPath)];
  const appModule = require(appPath);
  const app = appModule.app || appModule.default || appModule;
  if (!app) throw new Error('The module did not export an Express app');
  const printer = new ExpressRoutePrinter(app);
  const routes = printer.printRoutes().filter(matches);
  const diagnostics = printer.getDiagnostics();
  let selected = routes;
  if (opts.audit) selected = printer.getSecurityAudit().filter(matches);
  if (opts.shadows) selected = printer.findShadows().filter(matches);

  if (opts.json) {
    const serializable = selected.map(item => {
      const { layer, ...data } = item;
      return data;
    });
    return writeOutput(JSON.stringify({ routes: serializable, diagnostics }, null, 2));
  }
  if (opts.audit || opts.shadows) {
    return writeOutput(selected.length ? selected.map(item => `[${item.method}] ${item.path}\n  ${item.warning}\n  Middleware: ${(item.middleware || []).join(', ') || 'none'}`).join('\n') : 'No issues found.');
  }
  const table = new Table({
    head: opts.middleware ? ['Method', 'Path', 'Middleware', 'Handlers'] : ['Method', 'Path', 'Middleware', 'Handlers'],
    colWidths: opts.middleware ? [10, 32, 32, 32] : [12, 52, 14, 12]
  });
  for (const route of routes) {
    table.push(opts.middleware
      ? [route.method, route.path, route.middleware.join(', ') || '-', route.handlers.join(', ') || '-']
      : [route.method, route.path, String(route.middlewareCount), String(route.handlerCount)]);
  }
  writeOutput(routes.length ? table.toString() : 'No routes matched the filter.');
  if (opts.diagnostics && diagnostics.length) console.error(diagnostics.map(item => `Warning: ${item.message}`).join('\n'));
}

main().catch(error => { console.error(chalk.red(`express-route-lens: ${error.message}`)); process.exitCode = 1; });
