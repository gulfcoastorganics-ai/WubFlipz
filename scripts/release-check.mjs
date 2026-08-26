import { readFile, readdir, stat } from 'node:fs/promises';

for (const path of ['index.html', 'css', 'js']) {
  const info = await stat(path).catch(() => null);
  if (!info) throw new Error(`Release preflight failed: missing ${path}`);
  if (path === 'index.html' && (!info.isFile() || info.size === 0)) throw new Error('Release preflight failed: index.html is empty.');
  if (path !== 'index.html' && !info.isDirectory()) throw new Error(`Release preflight failed: ${path} is not a directory.`);
}

const html = await readFile('index.html', 'utf8');
if (!/name=["']viewport["']/i.test(html)) throw new Error('Release preflight failed: viewport metadata is missing.');
if (!/WubFlipz/i.test(html)) throw new Error('Release preflight failed: product identity is missing from index.html.');

const rootAbsolute = /(?:src|href)=["']\/(?!\/|#)/gi;
if (rootAbsolute.test(html)) {
  throw new Error('Release preflight failed: root-absolute asset/navigation URL would break the GitHub project Pages path.');
}

const jsFiles = (await readdir('js', { recursive: true })).filter((file) => file.endsWith('.js'));
if (jsFiles.length < 5) throw new Error('Release preflight failed: expected application JavaScript modules are missing.');

console.log(`WubFlipz release preflight passed (${jsFiles.length} JavaScript modules).`);
