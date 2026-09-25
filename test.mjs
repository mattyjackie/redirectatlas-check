import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm, symlink, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { check } from './check.mjs';
import { analyze, parseCSV, reportCSV } from './engine.mjs';
const directory = path.dirname(fileURLToPath(import.meta.url));
const run = (entry, args = [], env = {}) => spawnSync(process.execPath, [path.join(directory, entry), ...args], {
  env: { ...process.env, ...env }, encoding: 'utf8', timeout: 10000,
});
async function temporary(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'redirectatlas-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}
test('CLI exits reflect error and review thresholds; never still rejects malformed input', async t => {
  const clean = path.join(directory, 'examples/clean.csv');
  const loop = path.join(directory, 'examples/loop.csv');
  const review = path.join(directory, 'examples/review.csv');
  for (const [file, failOn, status] of [[clean, 'errors', 0], [loop, 'errors', 1], [review, 'errors', 0], [review, 'review', 1], [loop, 'never', 0]]) {
    const result = run('cli.mjs', ['--file', file, '--fail-on', failOn]);
    assert.equal(result.status, status, result.stderr);
  }
  const root = await temporary(t);
  const file = path.join(root, 'bad.csv');
  await writeFile(file, 'Source,Target\n"/a,/b');
  assert.equal(run('cli.mjs', ['--file', file, '--fail-on', 'never']).status, 2);
  for (const args of [[], ['--unknown', 'secret'], ['--file'], ['--file', clean, '--file', loop], ['--file', clean, '--fail-on', 'typo']]) {
    assert.equal(run('cli.mjs', args).status, 2);
  }
});
test('logs omit URL and CSV values; optional report includes URLs and refuses overwrites', async t => {
  const root = await temporary(t), file = path.join(root, 'map.csv'), report = path.join(root, 'report.csv');
  await writeFile(file, 'Source,Target\n/private-customer,/other\n/other,/private-customer');
  const result = run('cli.mjs', ['--file', file, '--report', report]);
  assert.equal(result.status, 1); assert(!result.stdout.includes('private-customer'));
  assert((await readFile(report, 'utf8')).includes('/private-customer'));
  await assert.rejects(check({ file, report }), { code: 'EEXIST' });
  await assert.rejects(check({ file, report: file }), { code: 'EEXIST' });
  assert((await readFile(file, 'utf8')).startsWith('Source,Target'));
});
test('rejects oversized bytes, too many rows, non-UTF8 input and directories', async t => {
  const root = await temporary(t), file = path.join(root, 'input.csv');
  await writeFile(file, Buffer.alloc(4_000_001)); await assert.rejects(check({ file }), /4,000,000/);
  await writeFile(file, 'Source,Target\n' + '/x,/y\n'.repeat(10001)); await assert.rejects(check({ file }), /10,000/);
  await writeFile(file, Buffer.from([0xff, 0xff])); await assert.rejects(check({ file }), /UTF-8/);
  await assert.rejects(check({ file: root }), /regular CSV/);
});
test('action restricts real input and output paths to workspace, including symlinks', async t => {
  const root = await temporary(t), workspace = path.join(root, 'workspace'), outside = path.join(root, 'outside.csv');
  await mkdir(workspace); await writeFile(outside, 'Source,Target\n/a,/b');
  await writeFile(path.join(workspace, 'map.csv'), 'Source,Target\n/a,/b');
  await symlink(outside, path.join(workspace, 'escape.csv'));
  await symlink(root, path.join(workspace, 'outside-folder'));
  for (const file of [outside, '../outside.csv', 'escape.csv']) {
    await assert.rejects(check({ file, workspace }), /inside/);
  }
  for (const report of ['../out.csv', 'outside-folder/out.csv']) {
    await assert.rejects(check({ file: 'map.csv', report, workspace }), /inside/);
  }
  await symlink(outside, path.join(workspace, 'report.csv'));
  await assert.rejects(check({ file: 'map.csv', report: 'report.csv', workspace }), { code: 'EEXIST' });
  assert.equal((await check({ file: 'map.csv', workspace })).exitCode, 0);
});
test('action writes only numeric outputs and aggregate summary, returns findings failure', async t => {
  const root = await temporary(t), output = path.join(root, 'output'), summary = path.join(root, 'summary');
  const result = run('action.mjs', [], {
    GITHUB_WORKSPACE: directory, INPUT_CSV: 'examples/loop.csv', INPUT_BASE_URL: 'https://private-customer.invalid',
    INPUT_FAIL_ON: 'errors', INPUT_REPORT: '', GITHUB_OUTPUT: output, GITHUB_STEP_SUMMARY: summary,
  });
  assert.equal(result.status, 1, result.stderr);
  assert.equal(await readFile(output, 'utf8'), 'rows=2\nerrors=2\nreview=0\nclear=0\n');
  const text = await readFile(summary, 'utf8');
  assert(!text.includes('private-customer')); assert(!text.includes('/first')); assert(text.includes('2 errors'));
});
test('engine covers conflicts, duplicates, loops, chains, invalid URLs and cross-origin review', () => {
  const a = analyze('Source,Target\n/a,/b\n/b,/a\n/c,/d\n/c,/e\n/f,/g\n/f,/g\n/h,/i\n/i,/j\n/x,/y\n/z,javascript:bad\n/ext,https://other.invalid/');
  for (const [index, issue] of [[0,'loop'],[2,'conflicting_source'],[4,'duplicate'],[6,'chain'],[9,'invalid_url'],[10,'external_target']]) assert(a.rows[index].issues.includes(issue));
  assert.equal(a.rows[8].severity, 'clear');
  assert.equal(analyze('Source,Target\n/A,/a\n/a?x=1,/a?x=2\n/a/,/a').errors, 0);
});
test('CSV parsing and reports handle quoted fields and guard spreadsheet formulas', () => {
  assert.deepEqual(parseCSV('\uFEFFa,b\r\n"x,y","one""two"\r\n'), [['a','b'],['x,y','one"two']]);
  assert.deepEqual(parseCSV('a,b\n"x\ny",z'), [['a','b'],['x\ny','z']]);
  assert.throws(() => parseCSV('Source,Target\n"/a"junk,/b'));
  assert.throws(() => analyze('Source,Target'));
  assert(reportCSV(analyze('Source,Target\n=1+1,/b')).includes("'=1+1"));
});
