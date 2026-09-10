#!/usr/bin/env node

'use strict';

const { Command } = require('commander');
const chalk = require('chalk');
const Table = require('cli-table3');
const fs = require('fs');
const path = require('path');
const packageJson = require('../package.json');
const { ExpressRoutePrinter, findShadows, getSecurityAudit } = require('../src/index');

const program = new Command();

program
  .name('express-route-lens')
  .description('Print Express.js routes with recursive discovery')
  .version(packageJson.version)
  .option('-f, --file <path>', 'Path to Express app file')
  .option('-j, --json', 'Output as JSON')
  .option('-c, --colors', 'Enable colored output', true)
  .option('--no-colors', 'Disable colored output')
  .option('-m, --middleware', 'Show middleware count', true)
  .option('--shadows', 'Detect route shadowing')
  .option('--audit', 'Run security audit')
  .option('-o, --output <file>', 'Save output to file');

program.parse(process.argv);

const opts = program.opts();

async function main() {
  let app;

  if (opts.file) {
    const appPath = path.resolve(opts.file);
    if (!fs.existsSync(appPath)) {
      console.error(chalk.red(`File not found: ${appPath}`));
      process.exit(1);
    }
    try {
      delete require.cache[require.resolve(appPath)];
      const appModule = require(appPath);
      app = appModule.app || appModule.default || appModule;
    } catch (err) {
      console.error(chalk.red(`Failed to load app: ${err.message}`));
      process.exit(1);
    }
  } else {
    console.error(chalk.red('Please specify an Express app file with -f option'));
    program.help();
    process.exit(1);
  }

  if (!app) {
    console.error(chalk.red('Could not find Express app'));
    process.exit(1);
  }

  const printer = new ExpressRoutePrinter(app, {
    colorize: opts.colors,
    showMiddlewareCount: opts.middleware
  });

  const routes = printer.printRoutes();

  if (opts.json) {
    const output = JSON.stringify(printer.toJSON(), null, 2);
    if (opts.output) {
      fs.writeFileSync(opts.output, output);
      console.log(chalk.green(`Routes saved to ${opts.output}`));
    } else {
      console.log(output);
    }
    return;
  }

  if (opts.audit) {
    const audit = getSecurityAudit(app);
    if (audit.length === 0) {
      console.log(chalk.green('✓ No security issues detected'));
    } else {
      console.log(chalk.yellow('⚠ Security Audit Results:\n'));
      for (const issue of audit) {
        console.log(chalk.red(`  [${issue.method}] ${issue.path}`));
        console.log(chalk.yellow(`    ${issue.warning}`));
        console.log(chalk.gray(`    Middleware count: ${issue.middlewareCount}\n`));
      }
    }
    return;
  }

  if (opts.shadows) {
    const shadowList = printer.findShadows();
    if (shadowList.length === 0) {
      console.log(chalk.green('✓ No route shadowing detected'));
    } else {
      console.log(chalk.yellow('⚠ Route Shadowing Detected:\n'));
      for (const shadow of shadowList) {
        console.log(chalk.red(`  [${shadow.method}] ${shadow.path}`));
        console.log(chalk.yellow(`    Shadowed by: ${shadow.shadowedBy}\n`));
      }
    }
    return;
  }

  const table = new Table({
    head: opts.colors ? 
      [chalk.cyan('Method'), chalk.cyan('Path'), chalk.cyan('Middleware')] :
      ['Method', 'Path', 'Middleware'],
    colWidths: [12, 50, 12]
  });

  const methodColors = {
    GET: chalk.green,
    POST: chalk.blue,
    PUT: chalk.yellow,
    PATCH: chalk.magenta,
    DELETE: chalk.red,
    OPTIONS: chalk.gray,
    HEAD: chalk.gray
  };

  for (const route of routes) {
    const methodColor = methodColors[route.method] || chalk.white;
    table.push([
      opts.colors ? methodColor(route.method) : route.method,
      route.path,
      opts.middleware ? route.middlewareCount.toString() : '-'
    ]);
  }

  console.log(table.toString());

  if (opts.output) {
    fs.writeFileSync(opts.output, table.toString());
    console.log(chalk.green(`\nRoutes saved to ${opts.output}`));
  }
}

main().catch(err => {
  console.error(chalk.red(`Error: ${err.message}`));
  process.exit(1);
});