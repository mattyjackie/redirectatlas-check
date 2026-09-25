import { appendFile } from 'node:fs/promises';
import { check, summary, safeError, InputError } from './check.mjs';
try {
  if (!process.env.GITHUB_WORKSPACE) throw new InputError('GITHUB_WORKSPACE is required.');
  const { result, exitCode } = await check({
    file: process.env.INPUT_CSV,
    base: process.env.INPUT_BASE_URL || 'https://example.invalid',
    failOn: process.env.INPUT_FAIL_ON || 'errors',
    report: process.env.INPUT_REPORT || undefined,
    workspace: process.env.GITHUB_WORKSPACE,
  });
  console.log(summary(result));
  if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT,
    Object.entries({ rows: result.total, errors: result.errors, review: result.review, clear: result.clear })
      .map(([key, value]) => `${key}=${value}\n`).join(''));
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY,
    '### RedirectAtlas map check\n\n' + summary(result) + '\n');
  process.exitCode = exitCode;
} catch (error) { console.error('RedirectAtlas: ' + safeError(error)); process.exitCode = 2; }
