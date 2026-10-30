# path-first

**A rule that lets your coding agent disagree with your route, without disagreeing with your goal.**

[中文](README.zh-CN.md)

---

You said: *"grep the logs for the error, then read the file it points to."*

The agent grepped. The log was 40 MB. The error line had no file pointer. It produced a plausible-looking summary anyway, and you spent the next ten minutes discovering the route never had a chance.

Nothing was broken. The agent did exactly what you said. That is the failure.

People give a **goal** and a **route** in the same sentence, without marking which is which. Most agents treat both as commands and comply. The polite ones finish the worse route and mention afterwards that a simpler way existed — a report, not a decision.

`path-first` adds one check before the first action:

> Am I walking this route because it is the best one, or because it was named?

If it was named, the agent has one sentence to say before it starts.

## What the rule actually asks for

Before the first tool call, four silent questions:

1. Is this a goal or a route?
2. Is the named route the best one, here, with what is already available?
3. What would a better route cost — reversible, cheaper, fewer steps, still reaching the goal?
4. Would you care? Changing something you care about is a question, not a decision.

Then one of four moves:

| Situation | Move |
| --- | --- |
| The named route is already best | Follow it. No commentary. |
| It cannot tell (missing info, unknown env) | Follow it, name the uncertainty in one line. |
| The better route needs your credentials, approval, or a change to your goal | Follow it, say which one, in one line. |
| A clearly better route exists | Say it in one sentence, **before** acting. Small gap: just take it, mention it in a clause. Large gap or the route will fail: offer it and keep moving. |

Plus the discipline that keeps it from becoming an annoying assistant: **one proposal per task**, dropped permanently if declined, and a hard off-switch for "just do it", "don't ask", "follow my steps exactly".

It also names the failure modes it is meant to catch: literal compliance, treating an example as a requirement, tool-name gravity, sentence order read as dependency, rebuilding what the repo already has, running independent steps serially, and late honesty.

## Install

Zero dependencies. Node 18+.

```bash
npx path-first init
```

That appends a managed block to `AGENTS.md` in the current directory — the file Codex, Cursor, Gemini CLI, Zed, Aider, and most other agents already read.

```bash
path-first init --lang zh            # 中文版规则
path-first init --target skill --dir ~/.claude/skills   # also drop a SKILL.md package
path-first init --dry-run            # show what would change
path-first check                     # exit 1 if missing or hand-edited
path-first print --lang zh           # just print the rule
path-first remove                    # undo, leaving your own content intact
path-first targets                   # where it would install
```

No npx? Copy [`rules/path-first.md`](rules/path-first.md) into your `AGENTS.md` yourself. Or copy [`skills/path-first`](skills/path-first) into a skills directory as `path-first/`.

### Where it lands

| Target | File |
| --- | --- |
| `agents` (default) | `AGENTS.md` in the directory you run it from |
| `skill` | `<dir>/path-first/SKILL.md`, plus the full rule under `references/` |

The block is delimited by HTML comments and carries a checksum, so `check` can tell a clean install from a hand-edited one, and a re-run upgrades the text instead of duplicating it. `remove` deletes only the block, never your own rules.

For OpenViking (`viking://~/skills`), install with `--target skill --dir <skills dir>`, or import the folder with the `add_skill` tool / `ov` CLI.

## Does it work?

It is a prompt, not an interlock. A model can still comply literally; the rule raises the base rate and changes what the agent says out loud. Three prompts to try it on:

1. **The impossible route.** "Use `jq` to parse this file" — pointing at a `.docx`. Without the rule, agents improvise a `jq` pipeline that cannot work. With it, they say the file is a zip container and pick another tool.
2. **The redundant route.** "Read `src/*.ts` one by one and find where `createUser` is defined." With the rule, one `grep` instead of forty reads, mentioned in a clause.
3. **The costly route.** "Run the migration now, then we'll check the schema." With the rule, it asks about the backup first — and only once.

If the agent just obeys all three, the rule is installed but not being read: check that your harness actually loads `AGENTS.md`, or install as a skill if it only loads skills.

## What it is not

- Not a linter, not a sandbox, not a permission system. It changes how the agent talks before it acts; the actual guardrails are yours.
- Not licence to redesign your request. Section 5 defines "better" narrowly — same goal, fewer irreversible actions, fewer steps, less cost, same or better result. Taste is not a better route, and the rule says to stay quiet about it.
- Not a replacement for a workflow engine. If you need determinism, encode the steps in code; this is for the open-ended part.

## Files

```
rules/path-first.md            the canonical rule (English)
rules/path-first.zh-CN.md      the canonical rule (中文)
skills/path-first/SKILL.md     compact skill version, for skill-loading harnesses
bin/path-first.mjs             the installer (no dependencies)
test/cli.test.mjs              node --test
```

## License

MIT. Take it, fork it, translate it, put it in your own `AGENTS.md`.
