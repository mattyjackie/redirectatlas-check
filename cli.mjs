#!/usr/bin/env node
import { check, summary, safeError, InputError } from './check.mjs';
const help = `RedirectAtlas CSV checker
Usage: node cli.mjs --file redirects.csv [--base https://example.com] [--fail-on errors|review|never] [--report new-report.csv]

No dependencies, telemetry or network requests. Up to 10,000 rows / 4,000,000 bytes.
Report is optional and includes your URLs; keep it private. Existing files are never overwritten.
Exit 0: selected threshold passed. Exit 1: findings reached threshold. Exit 2: invalid input/configuration.
Default threshold: errors. Review includes warnings. Never still fails on invalid input.
`;
try {
  const args = process.argv.slice(2);
  if (args.length === 1 && ['--help', '-h'].includes(args[0])) { console.log(help); }
  else {
    const names = { '--file': 'file', '--base': 'base', '--fail-on': 'failOn', '--report': 'report' };
    const options = {};
    for (let i = 0; i < args.length; i += 2) {
      const key = names[args[i]];
      if (!key || key in options || !args[i + 1] || args[i + 1].startsWith('--')) throw new InputError('Unknown, duplicate or incomplete option. Run with --help.');
      options[key] = args[i + 1];
    }
    if (!options.file) throw new InputError('Provide --file redirects.csv. Run with --help.');
    const { result, exitCode } = await check(options);
    console.log(summary(result));
    process.exitCode = exitCode;
  }
} catch (error) { console.error('RedirectAtlas: ' + safeError(error)); process.exitCode = 2; }
