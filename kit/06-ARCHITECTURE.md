# 06 · Architecture

## Stack

Checked on 2026-11-10 by building a real skeleton: next 16.4.6, react and react-dom 19.3.1, typescript 7.0.2, three 0.187.0, @types/three 0.187.0, gsap 3.15.1 (ScrollTrigger ships inside it), sharp 0.35.5, vitest 5.1.0, Playwright 1.65.0, and the three `@fontsource-variable` packages (sora, inter, jetbrains-mono) at 5.3.0, on Node 22. `npm init -y`, exact installs, hand written config and `npx next build` ran with no prompt and wrote `out/`, including a dynamic route from `generateStaticParams` and `404.html`. Newer releases may exist when you build, so everything is still verified at build time. For each package: read its current docs or the docs inside `node_modules`, install the newest stable release with `--save-exact`, and record the version and what you checked under "Facts verified at build time" in PROGRESS.

| Part | Choice |
|---|---|
| Framework | Next.js 16, App Router, static export (`output: 'export'`, written to `out/`) |
| Language | TypeScript, strict |
| Interface | React function components with CSS Modules |
| 3D | Three.js, vanilla, no react-three-fiber |
| Motion | GSAP with ScrollTrigger |
| Fonts | `@fontsource-variable` packages, self hosted |
| Images | sharp, at build time, through `scripts/media.mjs` |
| Tests | vitest for logic (the `test` script is `vitest run`, never watch mode), Playwright for pages and for the screenshot harness |
| Node | 22 or newer |

Rules for the stack:

- Static only. No route handlers, no server actions, no proxy or middleware, no runtime environment variables. The site makes no network request at runtime except for its own files.
- Do not run `create-next-app`. It asks questions and refuses a folder that already has files. Write `package.json` with `npm init -y`, install the packages, and write the config files by hand from the docs of the installed version.
- Set a fixed build id in the Next.js config (`generateBuildId`) so the output is as stable as it can be between builds.
- Verify at build time how the installed Next.js handles static export with dynamic routes (`generateStaticParams`), images (`images.unoptimized` or plain `img`), trailing slashes and the not found page. Record what you found.
- Hosting will be Vercel, later, by Brandon. Nothing in this build deploys.

## Constants

`src/config/site.ts` holds every constant that is not copy, once: `SITE_NAME` (its value is `Brandon Church`), `SHOW_3D_ART` (true), `SHOW_LAB` (true), tier limits, ports, the shot viewports. Everything imports from there.

The two switches can be overridden for a test build without editing the file. This exact approach was tested on Next.js 16.4.6:

- The Next.js config has an `env` block that passes each switch through, for example `SITE_SHOW_3D_ART: process.env.SITE_SHOW_3D_ART ?? 'true'`, and `src/config/site.ts` reads it. Without the `env` block the value reaches the server rendered HTML but not the client code, and the link comes back after the page loads.
- `node scripts/build-flags.mjs SHOW_3D_ART=false` copies the environment, sets `SITE_FLAGS_BUILD=1` and the switch, and runs `npx next build` as a child process.
- The Next.js config sets `distDir: 'out-flags'` when `SITE_FLAGS_BUILD` is `1`. With a static export that folder receives the whole site, and `out/` is left alone.
- Run one build at a time, never two together.
- Tests of a switch check the page after it has loaded and hydrated in a browser, not only the HTML file.
- Never use an inline environment prefix on a command line. It prompts and stalls the run.

The first `next build` rewrites `tsconfig.json` (it reformats it and adds options) and creates `next-env.d.ts`, and `tsc --noEmit` then writes `tsconfig.tsbuildinfo`. That is expected. `next-env.d.ts` and `*.tsbuildinfo` are in `.gitignore`. The `exclude` list survives the rewrite.

`tsconfig.json`, vitest and Playwright must leave out `kit/`, `old-site/`, `incoming/`, `out/`, `out-flags/` and `shots/`. The Three.js sources under `kit/reference/` import files that do not exist here and would fail the typecheck.

## Layout of the source

```
src/app/              routes: /, /work, /work/[slug], /clients, /games, /photography, /3d-art, /skills, /about, /resume, not found, and /lab/*
src/config/site.ts    constants
src/content/site.ts   all copy and lists (kit/05-CONTENT.md)
src/styles/           tokens.css, global.css
src/components/       React components, each with its CSS Module
src/lamp/             the one lamp store: cursor, easing, idle drift, subscribe
src/metal/            the plate renderer: one shared WebGL context, shaders, the mask painter
src/water/            WaterSystem, the moves, shaders, the route builder (pure, testable)
src/world/            shared Three.js code: materials, geometry helpers, post chain, environment, tiers
src/pieces/<name>/    city, workbench, handheld, camera, rocket, sculpture (kit/04-PIECES.md)
src/hooks/            window.__site test hooks
public/media/         processed pictures and video
scripts/              harness, checks, media, import
tests/                vitest and Playwright
shots/                screenshots and filmstrips, JPEG, kept on this Mac and ignored by git
```

## The lab

`/lab/metal`, `/lab/water` and `/lab/piece/[name]` are plain pages that show one thing alone, for building and for shots. They are not linked from the site. `SHOW_LAB` is true in this build; with it false the lab routes are not generated. Brandon turns it off before deployment.

## Test hooks

With `?hook=1` in the URL the page exposes `window.__site`. Without it, nothing is exposed. The harness and the tests drive the site only through these. Design them first, in Phase 1, and keep them stable.

| Hook | Does |
|---|---|
| `settle()` | resolves when fonts, pictures, pieces and water are loaded and at rest |
| `freeze(t)` | holds every clock at `t` seconds: pieces, water, lamp drift, GSAP. `freeze(null)` releases |
| `lamp(x, y)` | puts the lamp at a point of the viewport, 0 to 1 |
| `scrollTo(idOrY)` | jumps without smooth scrolling, then settles |
| `tier(name)` | forces a tier |
| `opening(t)` | shows the hero opening at `t` seconds |
| `water.head(v)` | sets the wet front: a fraction of the route or an anchor name |
| `water.move(name, t)` | on `/lab/water`, shows one move at `t` seconds |
| `piece(name)` | returns that piece's `setProgress`, `setMaking`, `freeze`, and `view(az, el, dist)` for close shots |

Every animation reads time from one clock that `freeze` controls. A shot taken twice from the same build must be the same image.

## Tiers

- `high`, `mid`, `low`, chosen at load from a short GPU timing test, device memory, viewport and pixel ratio. Pixel ratio caps: high 2, mid 1.5, low 1.
- `static`: reduced motion asked for, or no WebGL. With WebGL: each piece draws one frame and holds it, the water is drawn still and complete, plates are lit once. Without WebGL: pieces and plates show stills that the harness rendered from the real things, and the water is left out.
- Each piece and the water say what they give up per tier. Character stays; cost goes.
- A still of the city shows at once on first load, before WebGL starts, so the first paint is never an empty dark screen.
- Pictures the harness makes for the site itself (these stills, the Open Graph images) are written by their own script, `scripts/stills.mjs`, into `public/generated/`, before a gate's build and never during `npm run shots`. The build id leaves `public/generated/` out of its hash, so making them does not turn every shot stale.

## WebGL budget

At most four contexts at a time: the water, the shared plate renderer, and two pieces. The three small views in "More rooms" share one renderer and count as one piece. Pieces mount near the viewport and dispose when far. Nothing renders while the tab is hidden or the thing is off screen.

## Pictures

`scripts/media.mjs` reads a list of sources (from `old-site/` or `incoming/`) and writes sized WebP files to `public/media/` plus a generated typed list with each picture's real width and height, so layout never jumps. Video is copied as it is. Check with `which ffmpeg` before using it; if it is absent, take poster frames with Playwright.

## Speed and access

- Budgets, measured on this Mac's real GPU, headed: 60 frames a second at 1440 by 900 at pixel ratio 2 with the city at rest; never under 50 during the opening; the `low` tier under 33 ms a frame with the CPU slowed 4 times. Performance is measured only when the renderer is a real GPU. On a software renderer log the number and do not gate on it.
- No layout shift after first paint. No horizontal scroll at any width from 320 to 3840.
- Keyboard: every link and switch reachable, visible focus in amber, a skip link. Headings in order. Alt text from the content file. Plate text present in the DOM. Text contrast at least 4.5 to 1. Touch targets at least 44 px.
- Each page has a title and description from the content file, an Open Graph image made from a real shot, and the site has a sitemap, a robots file and an icon.

## Ports and processes

- Dev server 5320. The static server for shots and tests picks a free port from 5321 to 5329. If a port is busy, never free it. Take the next one and note it.
- Stop only processes you started in this session.

## Scripts

`kit/starter/scripts/` holds the harness that proved itself on Brandon's last build (a Vite app). Port it in Phase 0; do not write a new one from nothing. Keep exactly: the verdict ledger format, the hash on every verdict, the check that an image came from the current build, and the rule that a critic's verdict enters only through its saved answer. Replace: the shot table, the rules that build required names, the hook name (`window.__site`), the build and serve commands (static export in `out/`), the groups, and the build id, which must be a hash of the sources as `kit/07-QUALITY-BAR.md` says. `build-flags.mjs` never writes to `out/`. `kit/07-QUALITY-BAR.md` says what each script must do.

Also write `scripts/serve.mjs`, a small static file server that takes a folder and a port. The harness uses it for `out/`, and Phase 0 uses it to serve `kit/reference/` for the `ref` shots.

After Phase 0 proves them, the gate scripts (`check-shots`, `verdict`, `critic-list`, `shot-rules`) change only when an addendum says so. `shot-list` grows as shots are defined.

## Git

- `git init -b main` in Phase 0. If `git config user.name` prints nothing, set a local name of `Brandon Church` and a local email of `builder@localhost` with `git config user.name` and `git config user.email` (no `--global`), and note it under "Needed from Brandon". Commit at every gate with one plain line.
- `REPO_URL` is in `kit/10-KICKOFF.md`. If it is a URL, add it as `origin` in Phase 0 and push `main` after every gate and at `BUILD COMPLETE`. Push only with `node scripts/push.mjs`, which ships with the kit. It turns off every login prompt and gives up after 100 seconds, so a push can never hang the run. Never run a bare `git push`. If it reads `NONE`, commit locally and say so in the Handoff.
- Before the first push run `git status` and confirm nothing ignored or secret is staged.
- A push that fails (the script exits 1) is logged and tried again at the next gate. It is never a blocker. The first failed push also goes under "Needed from Brandon" in the Handoff, with the error text.
- Never force push, rewrite pushed history, delete a remote branch, or create, rename or delete a repository. Never use `gh`.
