# Brandon Church · portfolio site

This folder is the whole project. It holds a build kit (`kit/`) and, once the build runs, the site itself. The product is Brandon Church's portfolio: a static Next.js site with real time 3D, lit metal and golden water that flows down every page. No AI at runtime, no API keys, no accounts, no database, no form.

The owner is Brandon. He is not at the computer while the build runs. Nobody will answer a question or approve a prompt.

## Which mode you are in

- The first message starts with `BUILD MODE`: you are the **Builder**. Follow the rest of this file, then `kit/00-README.md`.
- You were started with `/partner`: you are the **Partner**. Follow `docs/partner.md`. The Builder sections below do not apply to you except Boundaries, Code conventions and Copy conventions.
- Anything else: act as a normal assistant in this repo. Do not start or continue the build unless asked.

## Builder: memory lives on disk

You have no memory between sessions and you lose detail at every compaction. `kit/PROGRESS.md` is your memory.

1. At the start of every session, and after every compaction, read `kit/PROGRESS.md` first, then `kit/00-README.md`, then `kit/07-QUALITY-BAR.md`, then the "Read first" files of the phase PROGRESS says you are in. Read them from disk. Do not work from what you remember of them.
2. Never type a number, name, color, path or line of copy from memory. Look it up in the kit, in `src/config/site.ts` or in `src/content/site.ts` every time.
3. Write to `kit/PROGRESS.md` like a lab notebook: what you did, what you measured, what you decided and why, what is next. Update it at the end of every step, before every commit, and before any long command.
4. A phase is done only when its gate in `kit/08-BUILD-ORDER.md` passes and the evidence is written in PROGRESS.
5. Screenshot verdicts do not live in PROGRESS. They live in `kit/VERDICTS.jsonl`, written by `node scripts/verdict.mjs` and checked by `npm run check:shots`. `kit/07-QUALITY-BAR.md` explains both.

## Builder: stops

There are no planned stops. Work from kickoff to `BUILD COMPLETE` in one run.

If the first line of `kit/PROGRESS.md` already reads `BUILD COMPLETE`, a `BUILD MODE` message is a follow up task written by the Partner: a fix, or an addendum in `kit/addenda/` to apply. Do exactly that task under every rule in this file and in `kit/07-QUALITY-BAR.md`, prove it the way the message or addendum says, log it in the Session log, commit, push, and leave the first line as `BUILD COMPLETE`.

- Never ask Brandon a question. Never use AskUserQuestion. Never wait for input. Never enter plan mode.
- Never end your turn before `BUILD COMPLETE` or a true blocker. If you notice you are about to stop and report progress, write it in PROGRESS instead and keep working.
- When the kit does not cover something, decide it yourself with the decision rule in `kit/07-QUALITY-BAR.md`, write the decision under "Decisions made by the Builder" in PROGRESS, and continue.
- A true blocker is only this: the machine cannot run Node 22 or newer, `git --version` fails, `npm install` cannot reach the registry after three tries spaced a few minutes apart, or the disk is full. On a true blocker replace the first line of PROGRESS with `BLOCKED: <what, what you tried>` and stop. Everything else is yours to solve. A missing old site, a missing picture, a failed push and a missing `REPO_URL` are not blockers.

## Builder: commands that would stall the run

A command that needs approval hangs forever, because nobody is there to approve it. The rules in `.claude/settings.json` allow every tool the build needs. These still prompt, so never use them:

- an inline environment prefix, such as `FOO=1 npm run x`
- `find` with `-exec`, `-delete` or any action that runs or removes
- `watch`, `setsid`, `flock`
- a redirect to a path that starts with `~` or contains a glob character
- any path outside this folder on a command line, including `cd` to another folder followed by a git command
- a write into a protected path listed under Boundaries
- `rm` or `rmdir` aimed at this folder itself, a parent folder, the home folder or `/`
- a command line longer than 10,000 characters
- a command line the shell parser cannot read, such as unbalanced quotes or a dangling `&&` or `||`
- anything that asks a question in the terminal, such as `create-next-app` or `npm init` without `-y`

These do not prompt. They are refused outright by the deny rules, so do not try them: a force push in any form, `git push --delete`, `git push --mirror`, `gh`, `sudo`, `pkill`, `killall`, a hosting CLI, `npm publish`, a global npm install.

How to stay clear of all of them:

- Keep command lines short and plain: one program, its arguments, at most a few `&&` steps.
- Write files with the Write and Edit tools. Never write a file with a heredoc, `echo >` or `cat >`.
- Commit with `git commit -m "one plain line"`. No heredoc, no quotes inside the message.
- When something needs logic, loops, quoting or long text, write a small Node script under `scripts/` and run it.
- The old site is outside this folder. Reach it only by running `node scripts/import-old-site.mjs`, which takes no arguments. Never name its path in a command.
- Never clone this repository, here or anywhere else. To test a clean install, delete `node_modules`, `.next` and `out` in this folder and run `npm ci`.
- Text with quotes in it goes into a file first, then a script reads the file. `node scripts/verdict.mjs --from` exists for exactly this.
- Subagents: start them with the Agent tool. When the tool offers `run_in_background`, set it to false for a critic, so the call itself returns the report. If a subagent runs in the background anyway, its report arrives as a notification while you work. Until it does, keep doing other useful work, or run `sleep 60` and look again. Never end your turn to wait for one.
- Critics use the `critic` agent that ships in `.claude/agents/`. Give every other subagent the path of this file and tell it to follow this section, because a prompt inside a subagent stalls the run too.

## Builder: the quality rule

Quality comes before speed, always. There is no token budget, no screenshot cap and no time limit. Brandon's plan makes Claude Code usage free for this build. He has said he does not care how long it takes.

- Read `kit/07-QUALITY-BAR.md` at the start of every phase, and again before you design any animation, make any 3D asset, tune any material or light, write any shader, or judge any screenshot.
- Verify your own work: tests for logic, screenshots and filmstrips opened with the Read tool for anything visual, with a recorded verdict against the quality bar.
- Never leave a piece, a page, a move of the water or a plate at "good enough". Iterate until it passes the bar in your own honest verdict and through the critic rounds the quality bar sets.
- No cheaper fallbacks. If the right way is harder, do it the right way.
- Research is expected. When you need to know how a real thing looks or is made, how an effect is done at the highest level, or what a library does in the installed version, look it up with WebSearch or WebFetch or in `node_modules`, and record what you found in PROGRESS.

## Boundaries

- Work only inside this folder. The one exception is `node scripts/import-old-site.mjs`, which reads Brandon's current portfolio and copies from it. It never writes outside this folder, and neither do you.
- Other builds may be running on this machine in other windows. Never touch their folders, their ports or their processes.
- `npm install` and `npx playwright install` write to their own caches in the home folder. That is expected. Never clean, move or edit those caches.
- Never run `pkill`, `killall`, `pgrep`, or any kill by process name or by port. Stop only processes you started yourself in this session, with the background task controls or the PID you recorded.
- Ports: dev server 5320, static server 5321 to 5329. If a port is busy, do not free it. Use the next free one and note it in PROGRESS.
- Never write inside `.claude/`, `.git/` (use git commands instead), `.vscode/`, `.husky/`, `.idea/`, `.devcontainer/`, or to `.npmrc`, `.mcp.json`, `.envrc` or shell rc files. Writes there prompt and stall the run.
- Builder: inside `kit/`, change only `kit/PROGRESS.md`, `kit/VERDICTS.jsonl` and files under `kit/critics/`. Everything else in `kit/` stays as delivered unless an addendum tells you to change it. The Partner's own limits are in `docs/partner.md`.
- Never edit, move or delete anything in `incoming/`. Read from it and copy from it.
- Git: `kit/06-ARCHITECTURE.md` has the rules. Commit at every gate. Push `main` to `REPO_URL` when it is set, only with `node scripts/push.mjs`, never with a bare `git push`, which can wait forever for a login. Never force push, never rewrite pushed history, never delete a remote branch, never create, rename or delete a repository, never use `gh`.
- Never deploy. No `vercel`, no `netlify`, no hosting CLI. Deployment happens after a review stage and a second plan.
- No paid services, no sign ups, no API keys. The site makes no network request at runtime except for its own files.
- Never use `sudo`. Never install global packages.

## Code conventions

- TypeScript strict. No `any` unless a comment gives the reason.
- React function components with CSS Modules. Design tokens live once in `src/styles/tokens.css`.
- Three.js is vanilla. Each 3D piece is its own module under `src/pieces/`, behind the contract in `kit/04-PIECES.md`. No react-three-fiber. No piece imports another.
- GSAP drives motion, in the interface and in the scenes. Every animation reads time from the one clock the test hooks can freeze.
- Pure logic (the water's route builder, tier choice, content shape) has no Three.js and no DOM, and has unit tests.
- Every constant appears once, in `src/config/site.ts` or `src/styles/tokens.css`, and is imported everywhere. Every word a visitor reads is in `src/content/site.ts`.
- Almost no code comments. Keep a comment only when it explains a non-obvious reason that someone could otherwise undo.

## Copy conventions

These apply to everything the site shows, including text drawn onto metal and onto 3D pieces.

- No em dashes anywhere. Use a period, a comma, or an interpunct (·).
- Present tense, plain words, first person, no exclamation points. Not a sales pitch. `kit/01-PRODUCT.md` has the voice.
- No pure black (#000000) or pure white (#ffffff) interface surfaces. Light is exempt.
- No fact that is not in the content file or the old site. No real company's logo or product design on any 3D piece.
- The site name is the `SITE_NAME` constant. Application code never hardcodes it.

## Compact instructions

When compacting, keep: the current phase and step from `kit/PROGRESS.md`, the list of files changed since the last commit, any failing test or shot not yet fixed, the ids of background tasks you started, and the rule that the first action after compaction is to re-read `kit/PROGRESS.md`, `kit/07-QUALITY-BAR.md` and the current phase's "Read first" files from disk.
