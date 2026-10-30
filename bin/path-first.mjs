#!/usr/bin/env node
'use strict';

/**
 * path-first — install the "check the route before walking it" rule
 * into the files your agent actually reads.
 *
 * Zero dependencies. Node >= 18.
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const VERSION = '0.1.0';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RULES = {
  en: path.join(ROOT, 'rules', 'path-first.md'),
  zh: path.join(ROOT, 'rules', 'path-first.zh-CN.md'),
};
const SKILL_SRC = path.join(ROOT, 'skills', 'path-first');
const SKILL_NAME = 'path-first';
const MARKER = '.path-first';

const BLOCK_RE = /<!-- path-first:begin([^>]*)-->\r?\n([\s\S]*?)<!-- path-first:end -->/;

// ---------------------------------------------------------------- utilities

const c = {
  dim: (s) => (process.stdout.isTTY ? `\u001b[2m${s}\u001b[0m` : s),
  green: (s) => (process.stdout.isTTY ? `\u001b[32m${s}\u001b[0m` : s),
  red: (s) => (process.stdout.isTTY ? `\u001b[31m${s}\u001b[0m` : s),
  yellow: (s) => (process.stdout.isTTY ? `\u001b[33m${s}\u001b[0m` : s),
};

function fail(msg, code = 1) {
  process.stderr.write(`${c.red('error')} ${msg}\n`);
  process.exit(code);
}

function hash(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex').slice(0, 12);
}

function normalize(text) {
  return `${text.replace(/\r\n/g, '\n').trimEnd()}\n`;
}

function readRule(lang) {
  const file = RULES[lang];
  if (!file) fail(`unknown --lang "${lang}" (expected: en, zh)`, 2);
  return normalize(fs.readFileSync(file, 'utf8'));
}

function renderBlock(lang, body) {
  const clean = normalize(body);
  return (
    `<!-- path-first:begin v1 lang=${lang} sha256=${hash(clean)} -->\n` +
    `${clean}` +
    `<!-- path-first:end -->\n`
  );
}

function parseAttributes(raw) {
  const out = {};
  for (const part of raw.trim().split(/\s+/)) {
    if (/^v\d+$/.test(part)) {
      out.version = part;
      continue;
    }
    const m = /^([a-z][a-z0-9]*)=(\S*)$/.exec(part);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

/** Rebuild text with `block` swapped in for the range [start, end). */
function replaceRange(text, start, end, block) {
  const tail = text.slice(end);
  const joined = tail.startsWith('\n') ? tail.slice(1) : tail;
  return `${text.slice(0, start)}${block}${joined}`;
}

function locateBlock(text) {
  const m = BLOCK_RE.exec(text);
  if (!m) return null;
  return {
    start: m.index,
    end: m.index + m[0].length,
    raw: m[0],
    attrs: parseAttributes(m[1]),
    body: normalize(m[2]),
  };
}

function upsertBlock(text, lang, { force = false } = {}) {
  const wanted = readRule(lang);
  const found = locateBlock(text);

  if (!found) {
    const sep = text.trim() === '' ? '' : text.endsWith('\n') ? '\n' : '\n\n';
    return { status: 'added', text: `${text}${sep}${renderBlock(lang, wanted)}` };
  }

  if (found.attrs.sha256 === hash(found.body)) {
    if (hash(wanted) === found.attrs.sha256 && found.attrs.lang === lang) {
      return { status: 'unchanged', text };
    }
    // Clean block, but a different version of the rule: upgrade it.
    return {
      status: 'updated',
      text: replaceRange(text, found.start, found.end, renderBlock(lang, wanted)),
    };
  }

  if (!force) {
    return {
      status: 'drifted',
      text,
      reason:
        'the managed block was edited by hand (sha256 mismatch). ' +
        'Re-run with --force to overwrite it, or --remove to delete it.',
    };
  }

  return {
    status: 'updated',
    text: replaceRange(text, found.start, found.end, renderBlock(lang, wanted)),
  };
}

function stripBlock(text) {
  const found = locateBlock(text);
  if (!found) return { status: 'absent', text };
  const before = text.slice(0, found.start);
  const after = text.slice(found.end);
  const merged = `${before}${after}`.replace(/\n{3,}/g, '\n\n').replace(/^\n+/, '');
  return { status: 'removed', text: merged.trim() === '' ? '' : normalize(merged) };
}

// ----------------------------------------------------------------- targets

function agentsFile(cwd) {
  return path.join(cwd, 'AGENTS.md');
}

function skillRoots() {
  const home = os.homedir();
  return [
    path.join(home, '.dsh', 'skills'),
    path.join(home, '.claude', 'skills'),
    path.join(home, '.codex', 'skills'),
    path.join(home, '.config', 'agents', 'skills'),
    path.join(home, '.cursor', 'skills'),
  ];
}

function resolveSkillDir(explicit) {
  if (explicit) return path.resolve(explicit);
  for (const dir of skillRoots()) {
    if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) return dir;
  }
  return null;
}

function readFileOr(file, fallback) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return fallback;
  }
}

function writeFile(file, text, dryRun) {
  if (dryRun) return;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text, 'utf8');
}

// ---------------------------------------------------------------- commands

function cmdInit(opts) {
  const cwd = opts.cwd;
  const lang = opts.lang;
  const targets = opts.targets.length ? opts.targets : ['agents'];
  let changed = 0;
  let failed = 0;

  for (const target of targets) {
    if (target === 'agents') {
      const file = agentsFile(cwd);
      const existed = fs.existsSync(file);
      const before = readFileOr(file, '');
      const result = upsertBlock(before, lang, { force: opts.force });

      if (result.status === 'drifted') {
        process.stderr.write(`${c.red('drift')} ${file}\n  ${result.reason}\n`);
        failed += 1;
        continue;
      }
      if (result.status === 'unchanged') {
        console.log(`${c.dim('same')}   ${file}  ${c.dim(`(${lang})`)}`);
        continue;
      }
      writeFile(file, result.text, opts.dryRun);
      changed += 1;
      const verb = result.status === 'added' ? (existed ? 'append' : 'create') : 'update';
      console.log(`${c.green(verb.padEnd(6))} ${file}  ${c.dim(`(${lang})`)}`);
      continue;
    }

    if (target === 'skill') {
      const dir = resolveSkillDir(opts.dir);
      if (!dir) {
        process.stderr.write(
          `${c.red('error')} no skills directory found.\n` +
            `  Pass one explicitly, e.g.  path-first init --target skill --dir "$HOME/.dsh/skills"\n`,
        );
        failed += 1;
        continue;
      }
      const dest = path.join(dir, SKILL_NAME);
      const marker = path.join(dest, MARKER);

      if (fs.existsSync(dest) && !fs.existsSync(marker) && !opts.force) {
        process.stderr.write(
          `${c.red('error')} ${dest} already exists and was not installed by path-first.\n` +
            `  Re-run with --force to replace it.\n`,
        );
        failed += 1;
        continue;
      }
      if (fs.existsSync(marker) && !opts.force && !fs.existsSync(path.join(dest, 'SKILL.md'))) {
        process.stderr.write(`${c.red('error')} ${dest} is incomplete. Re-run with --force.\n`);
        failed += 1;
        continue;
      }

      if (!opts.dryRun) {
        fs.mkdirSync(path.join(dest, 'references'), { recursive: true });
        for (const file of ['SKILL.md']) {
          fs.copyFileSync(path.join(SKILL_SRC, file), path.join(dest, file));
        }
        for (const file of fs.readdirSync(path.join(SKILL_SRC, 'references'))) {
          fs.copyFileSync(
            path.join(SKILL_SRC, 'references', file),
            path.join(dest, 'references', file),
          );
        }
        fs.writeFileSync(
          marker,
          `${JSON.stringify({ name: SKILL_NAME, version: VERSION, lang }, null, 2)}\n`,
          'utf8',
        );
      }
      changed += 1;
      console.log(`${c.green('skill'.padEnd(6))} ${dest}  ${c.dim(`(${lang})`)}`);
      continue;
    }

    fail(`unknown --target "${target}" (expected: agents, skill)`, 2);
  }

  if (opts.dryRun) console.log(c.dim('\ndry run — nothing written'));
  if (failed) process.exit(1);
  if (!changed && !opts.dryRun) console.log(c.dim('already installed'));
}

function cmdCheck(opts) {
  const targets = opts.targets.length ? opts.targets : ['agents'];
  let problems = 0;

  for (const target of targets) {
    if (target === 'agents') {
      const file = agentsFile(opts.cwd);
      if (!fs.existsSync(file)) {
        console.log(`${c.red('missing')} ${file}  ${c.dim('(no AGENTS.md)')}`);
        problems += 1;
        continue;
      }
      const found = locateBlock(readFileOr(file, ''));
      if (!found) {
        console.log(`${c.red('missing')} ${file}  ${c.dim('(rule block not found)')}`);
        problems += 1;
        continue;
      }
      const actual = hash(found.body);
      if (found.attrs.sha256 !== actual) {
        console.log(`${c.red('drifted')} ${file}  ${c.dim('(block edited by hand)')}`);
        problems += 1;
        continue;
      }
      if (hash(readRule(found.attrs.lang || opts.lang)) !== actual) {
        console.log(`${c.yellow('stale')}   ${file}  ${c.dim('(newer rule available: re-run init)')}`);
        continue;
      }
      console.log(`${c.green('ok')}      ${file}  ${c.dim(`(${found.attrs.lang})`)}`);
      continue;
    }

    if (target === 'skill') {
      const dir = resolveSkillDir(opts.dir);
      const dest = dir ? path.join(dir, SKILL_NAME) : null;
      const skill = dest ? path.join(dest, 'SKILL.md') : null;
      if (!dest || !fs.existsSync(skill)) {
        console.log(`${c.red('missing')} ${skill || SKILL_NAME}  ${c.dim('(skill not installed)')}`);
        problems += 1;
        continue;
      }
      const same = hash(readFileOr(skill, '')) === hash(readFileOr(path.join(SKILL_SRC, 'SKILL.md'), ''));
      if (!same) {
        const markerFile = path.join(dest, MARKER);
        const marker = JSON.parse(readFileOr(markerFile, '{}') || '{}');
        if (marker.version && marker.version !== VERSION) {
          console.log(`${c.yellow('stale')}   ${skill}  ${c.dim(`(v${marker.version} → v${VERSION})`)}`);
          continue;
        }
        console.log(`${c.red('drifted')} ${skill}  ${c.dim('(SKILL.md was edited)')}`);
        problems += 1;
        continue;
      }
      console.log(`${c.green('ok')}      ${skill}`);
      continue;
    }

    fail(`unknown --target "${target}" (expected: agents, skill)`, 2);
  }

  process.exit(problems ? 1 : 0);
}

function cmdRemove(opts) {
  const targets = opts.targets.length ? opts.targets : ['agents'];
  let changed = 0;

  for (const target of targets) {
    if (target === 'agents') {
      const file = agentsFile(opts.cwd);
      if (!fs.existsSync(file)) {
        console.log(`${c.dim('absent')} ${file}`);
        continue;
      }
      const result = stripBlock(readFileOr(file, ''));
      if (result.status === 'absent') {
        console.log(`${c.dim('absent')} ${file}  ${c.dim('(no rule block)')}`);
        continue;
      }
      if (!opts.dryRun) {
        if (result.text === '') fs.rmSync(file);
        else fs.writeFileSync(file, result.text, 'utf8');
      }
      changed += 1;
      console.log(`${c.green('remove')} ${file}${result.text === '' ? c.dim('  (file was only the block, deleted)') : ''}`);
      continue;
    }

    if (target === 'skill') {
      const dir = resolveSkillDir(opts.dir);
      const dest = dir ? path.join(dir, SKILL_NAME) : null;
      if (!dest || !fs.existsSync(dest)) {
        console.log(`${c.dim('absent')} ${dest || SKILL_NAME}`);
        continue;
      }
      if (!fs.existsSync(path.join(dest, MARKER))) {
        process.stderr.write(
          `${c.red('error')} ${dest} was not installed by path-first — not touching it.\n`,
        );
        process.exitCode = 1;
        continue;
      }
      if (!opts.dryRun) fs.rmSync(dest, { recursive: true, force: true });
      changed += 1;
      console.log(`${c.green('remove')} ${dest}`);
      continue;
    }

    fail(`unknown --target "${target}" (expected: agents, skill)`, 2);
  }

  if (opts.dryRun) console.log(c.dim('\ndry run — nothing written'));
  if (!changed && !opts.dryRun) console.log(c.dim('nothing to remove'));
}

function cmdPrint(opts) {
  process.stdout.write(readRule(opts.lang));
}

function cmdTargets(opts) {
  const file = agentsFile(opts.cwd);
  console.log(`${c.dim('agents')}  ${file}  ${fs.existsSync(file) ? 'exists' : 'not found'}`);
  const found = resolveSkillDir(opts.dir);
  console.log(`${c.dim('skill')}   ${found || '(none detected — pass --dir <skills dir>)'}`);
}

function usage() {
  return `path-first v${VERSION}

Install the rule that tells an agent to check whether your route is the
best one before it starts walking it.

Usage
  path-first <command> [options]

Commands
  init      Install the rule (default target: agents)
  check     Verify the rule is installed and unmodified (exit 1 if not)
  print     Print the rule text
  remove    Uninstall
  targets   Show where the rule would be installed

Options
  --target <agents|skill>  Repeatable. agents = AGENTS.md in cwd; skill = SKILL.md package
  --dir <path>             Skills directory for --target skill
  --lang <en|zh>           Rule language (default: en)
  --dry-run                Show what would change
  --force                  Overwrite a hand-edited block or a foreign skill dir
  --cwd <path>             Directory holding AGENTS.md (default: cwd)
  -h, --help
  -v, --version

Examples
  path-first init
  path-first init --lang zh
  path-first init --target agents --target skill --dir "$HOME/.dsh/skills"
  path-first check
  path-first remove
`;
}

function parseArgs(argv) {
  const opts = {
    command: null,
    targets: [],
    dir: null,
    lang: 'en',
    dryRun: false,
    force: false,
    cwd: process.cwd(),
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => {
      i += 1;
      if (i >= argv.length) fail(`missing value for ${arg}`, 2);
      return argv[i];
    };
    switch (arg) {
      case 'init':
      case 'install':
        opts.command = 'init';
        break;
      case 'check':
      case 'status':
        opts.command = 'check';
        break;
      case 'print':
        opts.command = 'print';
        break;
      case 'remove':
      case 'uninstall':
        opts.command = 'remove';
        break;
      case 'targets':
        opts.command = 'targets';
        break;
      case '--target':
        opts.targets.push(next());
        break;
      case '--dir':
        opts.dir = next();
        break;
      case '--lang':
        opts.lang = next();
        break;
      case '--cwd':
        opts.cwd = path.resolve(next());
        break;
      case '--dry-run':
        opts.dryRun = true;
        break;
      case '--force':
        opts.force = true;
        break;
      case '-h':
      case '--help':
        process.stdout.write(usage());
        process.exit(0);
        break;
      case '-v':
      case '--version':
        process.stdout.write(`${VERSION}\n`);
        process.exit(0);
        break;
      default:
        fail(`unknown argument "${arg}" (try --help)`, 2);
    }
  }

  if (!opts.command) {
    process.stdout.write(usage());
    process.exit(2);
  }
  if (!['en', 'zh'].includes(opts.lang)) fail(`unknown --lang "${opts.lang}" (expected: en, zh)`, 2);
  for (const target of opts.targets) {
    if (!['agents', 'skill'].includes(target)) {
      fail(`unknown --target "${target}" (expected: agents, skill)`, 2);
    }
  }
  return opts;
}

const opts = parseArgs(process.argv.slice(2));
switch (opts.command) {
  case 'init':
    cmdInit(opts);
    break;
  case 'check':
    cmdCheck(opts);
    break;
  case 'print':
    cmdPrint(opts);
    break;
  case 'remove':
    cmdRemove(opts);
    break;
  case 'targets':
    cmdTargets(opts);
    break;
  default:
    fail(`unknown command "${opts.command}"`, 2);
}
