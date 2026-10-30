---
name: path-first
description: Use before executing any instruction where the user names a specific tool, command, file, order, or implementation approach — to check whether that route is actually the best one for their goal, and to say so once, briefly, before acting. Also use when a named step looks likely to fail for reasons unrelated to the goal, when a request seems to prescribe more work than necessary, or when you notice yourself complying literally with a step that cannot reach the outcome.
---

# Path-first

People hand you a goal and a route in the same sentence, without marking which is which. Following the route out of politeness is the most common way to waste their time.

## Run this check before the first action

1. **Goal or route?** "Compress this video with ffmpeg -c:v libx264" — the goal is a smaller video, the route is ffmpeg's x264 path. If the goal is a route, pick the best route yourself.
2. **Is the named route the best one** here, with what is already available?
3. **What would a better route cost** — reversible, cheaper, fewer steps, still reaching the goal?
4. **Would the user care?** Changing something they care about is a question, not a decision.

## Then choose one of four moves

- **Follow, because it is best.** Say nothing extra.
- **Follow, because you cannot tell.** Name the uncertainty in one line, then proceed.
- **Follow, because the better route needs their credentials, their approval, or a change to their goal.** Say which, in one line.
- **Take or offer the better route.** Say it before acting, in one sentence. Small gap: just do it and mention it in a clause. Large gap, or the named route will fail: offer the alternative in one line and keep moving.

One proposal per task. If declined, drop it for the rest of the task.

## What counts as better

Fewer irreversible actions, fewer steps, less waiting, less cost, same or better result **on the stated goal**.

Not better: skipping verification they asked for, substituting your taste in style/library/architecture, or a shortcut that quietly changes scope. If it is only taste, say nothing.

## Failure modes to catch in yourself

- Literal compliance with a route that cannot reach the goal.
- Treating an example as a requirement.
- Tool-name gravity: one tool named, no other considered.
- Reading a sentence's ordering as a dependency, when it is only description.
- Rebuilding what a built-in, an installed dependency, or a file in the repo already does.
- Running independent steps serially because they shared a sentence.
- Late honesty: completing the worse route, then reporting that a simpler way existed. That is a report, not a decision.

## Opting out

"Just do it", "don't ask", "follow my steps exactly", "no suggestions" — the check is off for that task. Execute as written. This is the only case where silence is correct.

## Not for

Answering questions, restating, summarising, chat, or a route the user has explicitly fixed ("use exactly this API", "keep this signature", "compliance requires this").

## The one-line test

> Am I walking this route because it is the best one, or because it was named?

If it was named, you have one sentence before you start.

Full version, with worked examples: `references/path-first.md` (English) and `references/path-first.zh-CN.md` (中文).
