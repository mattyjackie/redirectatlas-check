import { open, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { analyze, reportCSV } from './engine.mjs';

const MAX_BYTES = 4_000_000;
export class InputError extends Error {}
function inside(root, target) {
  const relative = path.relative(root, target);
  return relative !== '' && relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative);
}
async function resolvePath(value, workspace, output = false) {
  if (!value || typeof value !== 'string' || value.includes('\0')) throw new InputError('Provide a valid file path.');
  const root = workspace ? await realpath(workspace) : null;
  const absolute = path.resolve(root || process.cwd(), value);
  // The parent must already exist. Resolve symlinks before checking workspace containment.
  const resolved = output
    ? path.join(await realpath(path.dirname(absolute)), path.basename(absolute))
    : await realpath(absolute);
  if (root && !inside(root, resolved)) throw new InputError('Files must stay inside the checked-out workspace.');
  return resolved;
}
export async function check({ file, base = 'https://example.invalid', failOn = 'errors', report, workspace }) {
  if (!['errors', 'review', 'never'].includes(failOn)) throw new InputError('fail-on must be errors, review, or never.');
  const source = await resolvePath(file, workspace);
  if (!(await stat(source)).isFile()) throw new InputError('Use a regular CSV file.');
  const handle = await open(source, 'r');
  let text;
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size > MAX_BYTES) throw new InputError('Use a regular CSV file no larger than 4,000,000 bytes.');
    // Bound the read even if another process grows the file after stat.
    const bytes = Buffer.alloc(MAX_BYTES + 1);
    let length = 0;
    while (length < bytes.length) {
      const { bytesRead } = await handle.read(bytes, length, bytes.length - length, null);
      if (!bytesRead) break;
      length += bytesRead;
    }
    if (length > MAX_BYTES) throw new InputError('Use a CSV file no larger than 4,000,000 bytes.');
    try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(0, length)); }
    catch { throw new InputError('Save the CSV as UTF-8.'); }
  } finally { await handle.close(); }
  let result;
  try { result = analyze(text, { base, limit: 10000 }); }
  catch (error) { throw new InputError(error.message); }
  if (report) {
    const destination = await resolvePath(report, workspace, true);
    // Exclusive creation refuses existing files and symlinks, including the input file.
    const output = await open(destination, 'wx', 0o600);
    try { await output.writeFile(reportCSV(result)); } finally { await output.close(); }
  }
  const exitCode = failOn === 'never' ? 0 : (result.errors || (failOn === 'review' && result.review)) ? 1 : 0;
  return { result, exitCode };
}
export function summary(result) {
  const counts = Object.entries(result.counts).sort().map(([issue, count]) => `${issue}: ${count}`).join(', ');
  return `RedirectAtlas: ${result.total} rows; ${result.errors} errors; ${result.review} review; ${result.clear} clear.${counts ? '\nFindings: ' + counts + '.' : ''}\nStructural CSV checks only; live redirects were not requested.`;
}
export function safeError(error) {
  if (error instanceof InputError) return error.message;
  if (error.code === 'ENOENT') return 'Input file or output parent folder was not found.';
  if (error.code === 'EEXIST') return 'Report already exists. Choose a new path; files are never overwritten.';
  if (error.code === 'EACCES' || error.code === 'EPERM') return 'File access was denied.';
  return 'Could not read the input or create the report. Check file access and configuration.';
}
