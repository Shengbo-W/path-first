import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLI = path.join(ROOT, 'bin', 'path-first.mjs');

function run(args) {
  const result = spawnSync(process.execPath, [CLI, ...args], { stdio: 'ignore', encoding: 'utf8' });
  if (result.error) throw result.error;
  return result.status;
}

function tmpdir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'path-first-'));
}

function block(file) {
  const text = fs.readFileSync(file, 'utf8');
  const m = /<!-- path-first:begin[^>]*-->[\s\S]*?<!-- path-first:end -->/.exec(text);
  return m ? m[0] : null;
}

test('init creates AGENTS.md with a managed block', () => {
  const cwd = tmpdir();
  assert.equal(run(['init', '--cwd', cwd]), 0);
  const file = path.join(cwd, 'AGENTS.md');
  assert.ok(fs.existsSync(file));
  const found = block(file);
  assert.ok(found, 'block present');
  assert.match(found, /Path-first/);
  assert.equal(run(['check', '--cwd', cwd]), 0);
});

test('init is idempotent', () => {
  const cwd = tmpdir();
  run(['init', '--cwd', cwd]);
  const file = path.join(cwd, 'AGENTS.md');
  const first = fs.readFileSync(file, 'utf8');
  run(['init', '--cwd', cwd]);
  assert.equal(fs.readFileSync(file, 'utf8'), first);
});

test('init appends to an existing AGENTS.md and remove keeps user content', () => {
  const cwd = tmpdir();
  const file = path.join(cwd, 'AGENTS.md');
  fs.writeFileSync(file, '# House rules\n\n- Keep tests green.\n', 'utf8');
  assert.equal(run(['init', '--cwd', cwd]), 0);
  assert.match(fs.readFileSync(file, 'utf8'), /Keep tests green/);
  assert.ok(block(file));

  assert.equal(run(['remove', '--cwd', cwd]), 0);
  const after = fs.readFileSync(file, 'utf8');
  assert.match(after, /Keep tests green/);
  assert.equal(block(file), null);
});

test('remove deletes a file that only held the block', () => {
  const cwd = tmpdir();
  run(['init', '--cwd', cwd]);
  const file = path.join(cwd, 'AGENTS.md');
  assert.equal(run(['remove', '--cwd', cwd]), 0);
  assert.equal(fs.existsSync(file), false);
});

test('check fails when the block is missing', () => {
  const cwd = tmpdir();
  assert.equal(run(['check', '--cwd', cwd]), 1);
  fs.writeFileSync(path.join(cwd, 'AGENTS.md'), '# unrelated\n', 'utf8');
  assert.equal(run(['check', '--cwd', cwd]), 1);
});

test('check fails when the block was edited by hand', () => {
  const cwd = tmpdir();
  run(['init', '--cwd', cwd]);
  const file = path.join(cwd, 'AGENTS.md');
  fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('Path-first', 'Path-first (edited)'), 'utf8');
  assert.equal(run(['check', '--cwd', cwd]), 1);
  assert.equal(run(['init', '--cwd', cwd]), 1, 'init refuses to clobber without --force');
  assert.equal(run(['init', '--cwd', cwd, '--force']), 0);
  assert.equal(run(['check', '--cwd', cwd]), 0);
});

test('--lang zh installs the Chinese rule, and re-running with en upgrades it', () => {
  const cwd = tmpdir();
  assert.equal(run(['init', '--cwd', cwd, '--lang', 'zh']), 0);
  const file = path.join(cwd, 'AGENTS.md');
  assert.match(fs.readFileSync(file, 'utf8'), /路径优先/);
  assert.equal(run(['check', '--cwd', cwd]), 0);
  assert.equal(run(['init', '--cwd', cwd, '--lang', 'en']), 0);
  assert.match(fs.readFileSync(file, 'utf8'), /Path-first/);
  assert.equal(run(['check', '--cwd', cwd]), 0);
});

test('--dry-run writes nothing', () => {
  const cwd = tmpdir();
  assert.equal(run(['init', '--cwd', cwd, '--dry-run']), 0);
  assert.equal(fs.existsSync(path.join(cwd, 'AGENTS.md')), false);
});

test('skill target installs a removable SKILL.md package', () => {
  const cwd = tmpdir();
  const skills = path.join(tmpdir(), 'skills');
  assert.equal(run(['init', '--cwd', cwd, '--target', 'skill', '--dir', skills]), 0);
  const dir = path.join(skills, 'path-first');
  assert.ok(fs.existsSync(path.join(dir, 'SKILL.md')));
  assert.ok(fs.existsSync(path.join(dir, 'references', 'path-first.md')));
  assert.ok(fs.existsSync(path.join(dir, '.path-first')));
  assert.match(fs.readFileSync(path.join(dir, 'SKILL.md'), 'utf8'), /^---\nname: path-first/);

  assert.equal(run(['check', '--cwd', cwd, '--target', 'skill', '--dir', skills]), 0);
  assert.equal(run(['remove', '--cwd', cwd, '--target', 'skill', '--dir', skills]), 0);
  assert.equal(fs.existsSync(dir), false);
});

test('skill target refuses to overwrite a foreign directory', () => {
  const cwd = tmpdir();
  const skills = tmpdir();
  fs.mkdirSync(path.join(skills, 'path-first'), { recursive: true });
  fs.writeFileSync(path.join(skills, 'path-first', 'SKILL.md'), '---\nname: other\n---\n', 'utf8');
  assert.equal(run(['init', '--cwd', cwd, '--target', 'skill', '--dir', skills]), 1);
  assert.match(fs.readFileSync(path.join(skills, 'path-first', 'SKILL.md'), 'utf8'), /name: other/);
});

test('print works without touching the filesystem', () => {
  assert.equal(run(['print']), 0);
  assert.equal(run(['print', '--lang', 'zh']), 0);
});

test('unknown arguments exit with usage error', () => {
  assert.equal(run(['init', '--bogus']), 2);
  assert.equal(run(['print', '--lang', 'fr']), 2);
  assert.equal(run(['init', '--target', 'nope']), 2);
});
