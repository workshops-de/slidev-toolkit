#!/usr/bin/env node
// workshop-slides: shared build, dev and deploy tooling for workshops.de Slidev repositories.
//
// Two repository layouts are supported and detected automatically:
//   multi-deck:  00-index.md + lessons/<NN-name>/<file>.md, each with `base:` and `out:` in its
//                headmatter. Every deck is built into its own subfolder of dist/.
//   single-deck: slides.md in the repository root, built into dist/.
//
// Commands:
//   workshop-slides build [--base /<repo>] [--no-pdf]   build all decks (+ PDFs) into dist/
//   workshop-slides dev [<lesson-number>|all]           start the Slidev dev server
//   workshop-slides install-browser                     install the Chromium used for PDF export

import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';

const root = process.cwd();
const requireFromProject = createRequire(path.join(root, 'package.json'));
const color = (code) => (text) => (process.stdout.isTTY ? `\x1b[${code}m${text}\x1b[0m` : text);
const green = color('32');
const yellow = color('33');
const cyan = color('36');
const red = color('31');

function fail(message) {
  console.error(`${red('Error:')} ${message}`);
  process.exit(1);
}

// Resolve a package bin from the project's node_modules. Transitive dependencies (like
// @slidev/cli when it comes in through this toolkit) are not linked into node_modules/.bin,
// so `npx slidev` would fetch a different version from the registry instead.
function resolveBin(pkg, binName) {
  let manifestPath;
  try {
    manifestPath = requireFromProject.resolve(`${pkg}/package.json`);
  } catch {
    fail(`${pkg} is not installed. Run npm install first.`);
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const bin = typeof manifest.bin === 'string' ? manifest.bin : manifest.bin?.[binName];
  if (!bin) fail(`${pkg} has no "${binName}" executable.`);
  return path.join(path.dirname(manifestPath), bin);
}

function run(pkg, binName, args, { allowFailure = false } = {}) {
  const result = spawnSync(process.execPath, [resolveBin(pkg, binName), ...args], {
    cwd: root,
    stdio: 'inherit',
  });
  if (result.status !== 0 && !allowFailure) process.exit(result.status ?? 1);
  return result.status === 0;
}

const slidev = (args, options) => run('@slidev/cli', 'slidev', args, options);

function headmatter(file) {
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  if (lines[0].trim() !== '---') return {};
  const data = {};
  for (const line of lines.slice(1)) {
    if (line.trim() === '---') break;
    const match = line.match(/^(base|out):\s*(.+?)\s*$/);
    if (match) data[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
  return data;
}

function lessonDecks() {
  const lessonsDir = path.join(root, 'lessons');
  if (!fs.existsSync(lessonsDir)) return [];
  return fs
    .readdirSync(lessonsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .flatMap((dir) =>
      fs
        .readdirSync(path.join(lessonsDir, dir))
        .filter((file) => file.endsWith('.md'))
        .sort()
        .map((file) => ({ dir, file: path.join('lessons', dir, file) })),
    );
}

function layout() {
  if (lessonDecks().length > 0) return 'multi';
  if (fs.existsSync(path.join(root, 'slides.md'))) return 'single';
  fail('No decks found: expected lessons/<NN-name>/*.md or slides.md in the repository root.');
}

function parseArgs(argv) {
  const options = { base: '', pdf: true, rest: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--base') options.base = (argv[++i] ?? '').replace(/\/+$/, '');
    else if (argv[i] === '--no-pdf') options.pdf = false;
    else options.rest.push(argv[i]);
  }
  return options;
}

function exportPdf(entry, output) {
  console.log(`${green('Exporting PDF')} ${entry} → ${output}`);
  const ok = slidev(['export', entry, '--output', output, '--timeout', '60000'], { allowFailure: true });
  console.log(ok ? `   ${green('✓')} PDF exported` : `   ${yellow('⚠')} PDF export failed (is Chromium installed?)`);
}

function buildMulti({ base, pdf }) {
  const decks = [{ dir: null, file: '00-index.md' }, ...lessonDecks()].filter(({ file }) =>
    fs.existsSync(path.join(root, file)),
  );
  for (const { dir, file } of decks) {
    const { base: deckBase, out } = headmatter(path.join(root, file));
    if (!deckBase || !out) {
      console.log(`${yellow('Skipping')} ${file} (missing base or out in headmatter)`);
      continue;
    }
    const fullBase = `${base}${deckBase}`;
    console.log(`${green('Building')} ${file}\n   ➤ base: ${fullBase}\n   ➤ out : ${out}`);
    slidev(['build', file, '--base', fullBase, '--out', out]);
    if (pdf && dir) exportPdf(file, path.join('dist', dir, 'slides.pdf'));
  }

  const dist = path.join(root, 'dist');
  fs.mkdirSync(dist, { recursive: true });
  const indexUrl = `${base}/00-index/`;
  fs.writeFileSync(
    path.join(dist, 'index.html'),
    `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta http-equiv="refresh" content="0; url=${indexUrl}">
  <title>Redirecting...</title>
</head>
<body>
  <p>Redirecting to <a href="${indexUrl}">slide decks</a>...</p>
</body>
</html>
`,
  );

  // GitHub Pages only serves the 404.html at the site root, but every deck is its own SPA in a
  // subfolder (Slidev's own 404.html lands in dist/<deck>/ and is never used). This page loads the
  // matching deck's index.html in place, so the URL stays intact and the deck router opens the
  // requested route, e.g. /<deck>/presenter/1.
  fs.writeFileSync(
    path.join(dist, '404.html'),
    `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Loading…</title>
  <script>
    (function () {
      var base = '${base}/';
      var path = location.pathname;
      var deck = path.indexOf(base) === 0 ? path.slice(base.length).split('/')[0] : '';
      function notFound() {
        document.title = 'Not found';
        document.body.innerHTML = '<h1>404</h1><p><a href="' + base + '">Back to the overview</a></p>';
      }
      if (!deck) { document.addEventListener('DOMContentLoaded', notFound); return; }
      fetch(base + deck + '/index.html')
        .then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); })
        .then(function (html) { document.open(); document.write(html); document.close(); })
        .catch(notFound);
    })();
  </script>
</head>
<body></body>
</html>
`,
  );
  console.log(`${green('Created')} dist/index.html and dist/404.html`);
}

function buildSingle({ base, pdf }) {
  // Slidev writes its own dist/404.html (a copy of index.html), which covers deep links here.
  console.log(`${green('Building')} slides.md\n   ➤ base: ${base}/\n   ➤ out : dist`);
  slidev(['build', 'slides.md', '--base', `${base}/`, '--out', 'dist']);
  if (pdf) exportPdf('slides.md', path.join('dist', 'slides.pdf'));
}

async function dev(choice) {
  if (layout() === 'single') return slidev(['slides.md', '--open']);

  const lessons = lessonDecks().filter(({ dir }, i, all) => all.findIndex((d) => d.dir === dir) === i);
  const hasAll = fs.existsSync(path.join(root, 'slides.md'));
  if (!choice) {
    console.log(`\n${cyan('Workshop slides: development server')}\n`);
    if (hasAll) console.log(`  ${green('0')}) All lessons (slides.md) [default]`);
    for (const { dir } of lessons) console.log(`  ${green(dir.split('-')[0])}) ${dir.replace(/^[^-]*-/, '')}`);
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    choice = (await rl.question(`\nEnter your choice${hasAll ? ' [0]' : ''}: `)).trim() || (hasAll ? '0' : '');
    rl.close();
  }
  if (choice === '0' || choice === 'all') {
    if (!hasAll) fail('slides.md not found in the repository root.');
    return slidev(['slides.md', '--open']);
  }
  const lesson = lessons.find(({ dir }) => dir.split('-')[0] === choice.padStart(2, '0'));
  if (!lesson) fail(`No lesson found starting with '${choice}'.`);
  return slidev([lesson.file, '--open']);
}

const [command, ...argv] = process.argv.slice(2);
switch (command) {
  case 'build': {
    const options = parseArgs(argv);
    (layout() === 'multi' ? buildMulti : buildSingle)(options);
    console.log(cyan('Build complete!'));
    break;
  }
  case 'dev':
    await dev(argv[0]);
    break;
  case 'install-browser':
    run('playwright-chromium', 'playwright', ['install', 'chromium']);
    break;
  default:
    console.log(`Usage:
  workshop-slides build [--base /<repo>] [--no-pdf]   build all decks (+ PDFs) into dist/
  workshop-slides dev [<lesson-number>|all]           start the Slidev dev server
  workshop-slides install-browser                     install Chromium for the PDF export`);
    process.exit(command ? 1 : 0);
}
