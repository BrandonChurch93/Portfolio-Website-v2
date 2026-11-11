# 08 · Build order

Thirteen phases, 0 to 12, in order. There are no planned stops. Work from kickoff to `BUILD COMPLETE` in one run.

How every phase works:

- Start by reading its "Read first" files from disk, and `kit/07-QUALITY-BAR.md`, even if you read them before.
- Do the steps. Log each in `kit/PROGRESS.md` as you finish it.
- The gate is the proof. A phase is done only when every line of its gate is true and the evidence is written under that gate in PROGRESS.
- "Shots pass" means `npm run check:shots -- <names>` exits clean for the names given. Nothing else counts.
- At every gate, in this order: `npm run typecheck` and `npm run build` are clean, and from Gate 1 on `npm run test` and `npm run check:copy` are clean too (Gate 0 has no tests and no copy check yet); then that gate's shots are taken or retaken and judged; then `check:shots` for the gate's names runs last; then commit with one plain line; then push with `node scripts/push.mjs` if `REPO_URL` is set.

## Phase 0 · Setup

Read first: `CLAUDE.md`, `kit/00-README.md`, `kit/06-ARCHITECTURE.md`, `kit/07-QUALITY-BAR.md`, `kit/10-KICKOFF.md`, `kit/05-CONTENT.md`.

1. Check the machine: `node -v` is 22 or newer, `git --version` works, the npm registry answers. Log `claude --version` too. Fill in Environment in PROGRESS.
2. `git init -b main`, and the commit identity check in `kit/06-ARCHITECTURE.md`. If `REPO_URL` in `kit/10-KICKOFF.md` is a URL, add it as `origin`.
3. `npm init -y`, install the stack with exact versions, write the config files by hand, and make one page that shows the site name in the background and text colors of `kit/02-DESIGN.md`. Verify each fact `kit/06-ARCHITECTURE.md` marks for build time and log it. `npm run build` must write `out/`.
4. Port the harness from `kit/starter/scripts/` into `scripts/` as `kit/06-ARCHITECTURE.md` says. Add `strips`. Install the Playwright browsers.
5. Prove the harness. Take the four `ref` shots: `kit/reference/cards-and-water/second-pass.html` and `kit/reference/third-pass/index.html`, each at desktop and phone, served by the static server. Open each. Record your verdict on each. Show `check:shots ref` passing, and show the check failing for a shot with no verdict. Open every still in `kit/reference/hero-city/` and `kit/reference/workbench/` with the Read tool too.
6. Run `node scripts/import-old-site.mjs`. Read `old-site/MANIFEST.json` and the old site's source. Write "Old site inventory" in PROGRESS: its pages, projects, clients, skills, links, résumé file, and which images are usable for what.
7. Read the source of every reference. Write "Reference notes" in PROGRESS: what each does, how, and what must be better.

Gate 0
- `npm run build` writes `out/` with that one page in it.
- The harness is proven both ways, and `check:shots ref` passes.
- The old site inventory and the reference notes are written, or the import's exit code 2 is logged with what is missing.
- First commit made. Pushed, or the reason it could not be is logged.

## Phase 1 · Foundations

Read first: `kit/01-PRODUCT.md`, `kit/02-DESIGN.md`, `kit/05-CONTENT.md`, `kit/06-ARCHITECTURE.md`.

1. `src/config/site.ts`, tokens, fonts, global styles.
2. `src/content/site.ts` from the drafts, filled with facts from the old site inventory. List gaps under "Needed from Brandon".
3. Every route, as a plain, readable page that shows its content with real type and spacing. The lab routes. Nav and footer.
4. The lamp store, the tier logic, the one clock, and every test hook in `kit/06-ARCHITECTURE.md`.
5. `scripts/media.mjs` and the first processed pictures.
6. `check:copy`. Unit tests for the content shape and tier logic. A Playwright smoke test that loads every route at every viewport and fails on a console error or horizontal scroll.

Gate 1
- Every route loads at all five viewports with its content readable, no console errors, no horizontal scroll.
- The hooks work: a test freezes the clock, sets the lamp and scrolls to a section.
- A build with `SHOW_3D_ART` false, made with `scripts/build-flags.mjs`, has no 3D art page, nav link or door, and a test proves it on the loaded, hydrated page. The value in `src/config/site.ts` stays true.

## Phase 2 · Metal and the lamp

Read first: `kit/02-DESIGN.md` (Metal, The lamp), `kit/07-QUALITY-BAR.md`, the source of `kit/reference/cards-and-water/second-pass.html` and `kit/reference/third-pass/index.html`.

1. Research how the best real time metal on the web is done. Log it.
2. Build the plate renderer on `/lab/metal`: the four finishes, the mask painter, screws and rivets, the photo window with a picture and with video, the header bar, the placard.
3. Put metal and the lamp on nav, buttons and links where it suits them. Shadows fall away from the lamp. The lamp drifts on touch devices.
4. Shots for the `metal` group. Critic rounds as the quality bar says.

Gate 2
- Shots pass: `metal`.
- Plate text is in the DOM, tested.
- Frame time with eight plates on screen is logged.

## Phase 3 · The water

Read first: `kit/03-WATER.md`, `kit/07-QUALITY-BAR.md`, the two reference pages' water code.

1. Research. Try at least two approaches for the body and for the splash on `/lab/water`. Log what won and why.
2. The body: look at rest and flowing, particles, halo, the dry channel, the head.
3. Each move alone: run, fall, land, cling, pour, split, frame, pool. A strip for each.
4. Light: on a plate, and the interface a piece uses to be lit and to show wet.
5. The route builder, pure and unit tested against fixture layouts for desktop and phone, including a split.
6. Critic rounds for water phases 1 to 3.

Gate 3
- Shots pass: `water`.
- Route builder tests pass.
- Frame time with the water on is logged for each tier.

## Phase 4 · The city

Read first: `kit/04-PIECES.md` (all of it), `kit/02-DESIGN.md` (The hero staging), `kit/07-QUALITY-BAR.md`, `kit/reference/hero-city/`.

1. The seven piece phases, in order, each with its shots and critic rounds.
2. The opening and the settle, with strips at desktop and phone.
3. The canals and the fall at the front center, handed to the WaterSystem as the start of the stream.
4. The making view. The still for first paint and for the static tier.

Gate 4
- Shots pass: `city`, `home/hero`.
- Frame time at rest and the worst frame of the opening are logged from a real GPU.

## Phase 5 · Selected work and client work

Read first: `kit/01-PRODUCT.md` (The home page), `kit/02-DESIGN.md`, `kit/03-WATER.md` (The interactions), `kit/05-CONTENT.md`.

1. Selected work: four featured plates with photo windows and real pictures, the link to `/work`.
2. Client work: the header bar, the placards, and the water landing, splitting and framing.
3. The water weaving from the hero through both sections.

Gate 5
- Shots pass: `home/work`, `home/clients`.

## Phase 6 · The workbench and skills

Read first: `kit/04-PIECES.md` (rules, contract, phases, The workbench), `kit/02-DESIGN.md` (The skills section), `kit/03-WATER.md`.

1. The workbench through its seven phases.
2. The skills section on the home page and the `/skills` page: the desk in its fixed light and the ledger rows. No labels on the desk.
3. The water on the desk: corner, front edge, pour, wetness and reflection.

Gate 6
- Shots pass: `bench`, `home/skills`, `page/skills`.

## Phase 7 · The rooms

Read first: `kit/04-PIECES.md` (rules, contract, phases, the handheld, the camera, the sculpture, The small views), `kit/01-PRODUCT.md` (Pages, Rules that hold on every page).

1. The handheld and `/games`.
2. The camera and `/photography`.
3. The sculpture and `/3d-art`.
4. The "More rooms" doors on the home page.

Gate 7
- Shots pass: `handheld`, `camera`, `sculpture`, `home/rooms`, `page/games`, `page/photography`, `page/3d-art`.

## Phase 8 · About, contact and the rocket

Read first: `kit/04-PIECES.md` (rules, contract, phases, The rocket), `kit/01-PRODUCT.md`, `kit/03-WATER.md` (Contact).

1. About on the home page and `/about`.
2. The rocket through its seven phases: assembly on scroll, liftoff at the end of the page, the pad at rest.
3. Contact: the links, the pool, the water's end.

Gate 8
- Shots pass: `rocket`, `home/about`, `home/contact`, `page/about`.

## Phase 9 · The other pages

Read first: `kit/01-PRODUCT.md` (Pages), `kit/02-DESIGN.md`, `kit/05-CONTENT.md`.

1. `/work`, every project page, `/clients`, `/resume`, not found.
2. Titles, descriptions, Open Graph images, sitemap, robots, icon.

Gate 9
- Shots pass: `page/work`, `page/project`, `page/clients`, `page/resume`, `page/notfound`.

## Phase 10 · The water through the whole site

Read first: `kit/03-WATER.md`, `kit/07-QUALITY-BAR.md`.

1. The full home page route at every tier, with the four interactions and the weaving between them.
2. The stream on every other page.
3. Scroll strips for the home page at desktop and phone. Critic rounds for water phases 4 and 5.

Gate 10
- Shots pass: `home`, `page`, `water`.
- No shot shows water crossing text.

## Phase 11 · Tiers, speed, access, hardening

Read first: `kit/06-ARCHITECTURE.md` (Tiers, WebGL budget, Speed and access), `kit/07-QUALITY-BAR.md`.

1. Tune each tier. Take the `tier` shots.
2. Meet the speed budgets on a real GPU, or log exactly what was measured and why it falls short.
3. Keyboard, focus, reduced motion, contrast, touch targets.
4. Playwright: the full suite in Chromium, the smoke test in WebKit and Firefox.

Gate 11
- Shots pass: `tier`.
- The speed numbers and the access checks are logged.

## Phase 12 · Final pass

Read first: `kit/07-QUALITY-BAR.md`, `kit/09-QA-GAUNTLET.md`.

1. Build. Retake every shot once. Open and judge every image that changed. Fix real faults and retake those. A changed image in the `metal`, `water` or piece groups goes to a critic, unless that shot already has critic verdicts from three rounds, until the rule in "The verdict ledger and the gate" holds for it.
2. One critic round on `home/hero-desktop` and on each piece's `rest-desktop` shot, even where the rule already holds.
3. Work through sections A to I of the QA gauntlet and write the evidence for each item.
4. Write the Handoff in PROGRESS: what was built, "For review", "Needed from Brandon", how to run it, how to flip `SHOW_3D_ART` and `SHOW_LAB`, and the ideas held for the review stage.
5. Finish, in this exact order:
   1. Run `npm run check:shots` and `npm run check:copy` with no names. Both must exit clean.
   2. In QA results write one line: `J · checked at the final commit`. Write the `### Gate 12` evidence. In the Phases table put the word `final` in the Phase 12 commit cell; never record the final commit's hash, because writing it would change the tree again. Replace the first line of PROGRESS with `BUILD COMPLETE`.
   3. Commit. Run `git status` and see that it is clean.
   4. Push with `node scripts/push.mjs`. If it exits 0, you are done. Do not write anything more.
   5. If it exits 1, or `REPO_URL` is `NONE`: add what it printed, or the missing address, under "Needed from Brandon", commit once more, and do not push again. You are done.

Gate 12
- `npm run check:shots` and `npm run check:copy` exited clean with no names given, after the last build and the last retake.
- Every gauntlet item in sections A to I has evidence. Section J is true at the final commit.
- The first line of PROGRESS reads `BUILD COMPLETE`, and the tree is committed.
