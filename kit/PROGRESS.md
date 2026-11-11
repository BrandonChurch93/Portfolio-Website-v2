IN PROGRESS · Phase 3 · start

Replace the line above with `IN PROGRESS · Phase <n> · <step>` while working, `BLOCKED: <what, what you tried>` on a true blocker, and `BUILD COMPLETE` at the end.

# Progress

This file is the Builder's memory. Write in it like a lab notebook: what you did, what you measured, what you decided and why, what is next. Update it at the end of every step, before every commit and before any long command.

## Where things stand

- Phase: 3 The water
- Step: start (re-read 03, 07, the two reference pages' water code)
- Next action: research real time water and light trails, try two approaches for body and splash on /lab/water
- Background tasks running (id, what): none
- Files changed since the last commit: none

## Phases

| Phase | Name | Status | Gate passed (date, commit) |
|---|---|---|---|
| 0 | Setup | done | 2026-11-10, first commit "Phase 0 setup and harness" |
| 1 | Foundations | done | 2026-11-11, commit "Phase 1 foundations" |
| 2 | Metal and the lamp | done | 2026-11-11, commit "Phase 2 metal and the lamp" |
| 3 | The water | | |
| 4 | The city | | |
| 5 | Selected work and client work | | |
| 6 | The workbench and skills | | |
| 7 | The rooms | | |
| 8 | About, contact and the rocket | | |
| 9 | The other pages | | |
| 10 | The water through the whole site | | |
| 11 | Tiers, speed, access, hardening | | |
| 12 | Final pass | | |

## Gate evidence

One heading per gate, added as each passes: `### Gate <n>`, then each line of the gate with its proof.

### Gate 0
- `npm run build` writes `out/` with the one page: `out/index.html` holds the site name from `SITE_NAME` on `--bg` #0c0a09 in `--text` #f5f2ee, Sora light; `out/404.html` too. Source stamp 2e0ac4db7702. `npm run typecheck` clean.
- Harness proven both ways: `node scripts/check-shots.mjs ref` exited 1 with "no verdict on the current image" for all four ref shots before any verdict, then exited 0 ("passed: 4, problems: 0") after `node scripts/verdict.mjs --from kit/critics/builder-ref.txt --who builder`. Shots taken headless on the hardware renderer "ANGLE (Apple, ANGLE Metal Renderer: Apple M4 Pro)". All four ref images opened and judged. Every still in `kit/reference/hero-city/` (4) and `kit/reference/workbench/` (7) opened.
- Old site inventory and reference notes written above. Import exit 0.
- First commit made (see Phases table). Not pushed: REPO_URL is NONE.

### Gate 1
- `npm run typecheck` clean; `npm run build` wrote out/ from sources d801c9454f3c (29 pages: every route, 10 project pages, 3 lab pages plus 6 lab piece pages, 404); `npm run test` 25 passed (content shape, tier choice, lamp drift, config equals tokens and gate viewports); `npm run check:copy` 0 problems over 75 source files and 30 pages, and proven to fail on a planted exclamation point, banned words and a model version string.
- Every route at all five viewports: `tests/e2e/smoke.spec.ts` loads 28 routes (all pages, every project, the lab, a missing route) at phone, tablet, desktop, wide and 4K in Chromium (140 tests): status 200 (404 for the missing route), h1 visible inside the viewport, real text in main, body text 16px or more, Sora loaded, no console error, no page error, `scrollWidth <= innerWidth`. All passed.
- Hooks: `tests/e2e/hooks.spec.ts` proves no `window.__site` without ?hook=1; with it, the clock runs, `freeze(2.5)` holds exactly 2.5 for 400 ms and `freeze(null)` resumes from there; `lamp(0.2, 0.75)` puts the lamp exactly there; `scrollTo('clients')` lands the section at the top with no smooth scroll; `tier('low')` is reported and marked on the page; a frozen page screenshotted twice 500 ms apart is byte identical. Passed.
- SHOW_3D_ART: `node scripts/build-flags.mjs SHOW_3D_ART=false` built out-flags/ with out/ untouched; `tests/e2e/flags.spec.ts` loads that build in a browser, waits for hooks and settle (so hydration is done), and finds no link to /3d-art/, no art door, no "3D art" in the nav, and /3d-art/ answers 404; the normal build still has all three. `src/config/site.ts` still reads true by default. Passed.
- Visual check (peek, not gate shots): home at phone and 4K, a project page at desktop, the résumé at phone, all readable with real type and spacing.

### Gate 2
- `npm run typecheck` clean; `npm run build` from sources 35a978272675; `npm run test` 29 passed (adds the exact distance transform tests); `npm run check:copy` 0 problems (90 files, 30 pages); Chromium suite 146 passed.
- Shots pass: `node scripts/check-shots.mjs metal` passed 23 of 23 (with ref, 27 of 27). Every metal shot had critic verdicts from three rounds (001 and 002, 003 and 004, 005 and 006); bar and text-2x got critic PASSes; the rest pass on my own PASS of the latest image after fixing every real fault named. Disputed and unfixed points are under For review.
- Plate text is in the DOM, tested: `tests/e2e/metal.spec.ts` finds 20+ `[data-plate-text]` nodes holding each plate's label, words and facts, not hidden and not aria-hidden, and checks the plate on screen drew (canvas centre mean above 30 levels). Passed.
- Frame time with eight plates on screen (/lab/metal #eight, eight placards plus the plates around it, lamp moved every frame so every visible plate redraws), Apple M4 Pro, ANGLE Metal, tier high, 1440x900 at pixel ratio 2: headed 597 frames, interval median 8.3 ms (120 Hz display), p95 9.6 ms, one worst frame 33.4 ms at start; plate renderer CPU a frame median 0.5 ms, p95 0.6 ms. Headless (vsync 60): median 16.7 ms, p95 16.7, worst 16.8; renderer CPU median 1.6 ms.

## Environment

- Node: v24.22.2
- npm: 11.19.1
- git: 2.49.0
- Claude Code version: 2.1.322
- OS and GPU renderer string: macOS 15.7.4 (24G517), Apple M4 Pro, 20 GPU cores, Metal 3. WebGL renderer string in Chromium: logged in Measurements once the harness runs.
- REPO_URL and whether `origin` is set: NONE (kit/10-KICKOFF.md, read 2026-11-10 at Phase 0). No origin. Commit locally only.
- Git identity: global user.name is Brandon Church already set, so no local override was needed.
- Ports in use: dev 5320, static 5321 to 5329 picked free per run.

## Facts verified at build time

One line each: what was checked, where, what was found, the version it applies to.

- npm view on 2026-11-10: newest stable releases equal the kit's tested set. Installed exact: next 16.4.6, react and react-dom 19.3.1, typescript 7.0.2, three 0.187.0, @types/three 0.187.0, gsap 3.15.1, sharp 0.35.5, vitest 5.1.0, @playwright/test 1.65.0, @fontsource-variable sora, inter, jetbrains-mono 5.3.0, @types/react and @types/react-dom 19.3.0, @types/node 26.6.6.
- next 16.4.6 ships its docs in node_modules/next/dist/docs, and node_modules/next/AGENTS.md says to read them before writing code. Static export guide read (01-app/02-guides/static-exports.md).
- next 16.4.6 static export with `output: 'export'`, `trailingSlash: true`: a dynamic route with `generateStaticParams` and `dynamicParams = false` wrote `out/probe/one/index.html` and `out/probe/two/index.html`; `not-found.tsx` produced `out/404.html` and `out/404/index.html`. Probe route removed after.
- next 16.4.6 images: `images.unoptimized: true` set; the site uses plain `img` with real width and height from the media pipeline, so no loader is needed.
- next 16.4.6 rewrites tsconfig.json on first build (adds `.next/dev/types/**/*.ts` to include); the exclude list survived.
- next 16.4.6 typecheck: after deleting a route, stale `.next/types/validator.ts` breaks `tsc --noEmit` until the next build. Build before typecheck, or delete `.next`.
- @fontsource-variable 5.3.0 family names: 'Sora Variable', 'Inter Variable', 'JetBrains Mono Variable'; import path is the package root (index.css).
- `generateBuildId` returning a fixed string works: `out/_next/static/brandon-church-static/`.
- next 16.4.6 static export: `generateStaticParams` returning `[]` is a build error ("With output: export, at least one route must be generated"). So a switch cannot empty a dynamic route.
- next 16.4.6 `pageExtensions`: a page named `page.art.tsx` is a route only while `art.tsx` is in `pageExtensions`. The config adds `art.tsx` and `lab.tsx` only when SHOW_3D_ART and SHOW_LAB are on. Proven: with SHOW_3D_ART=false via `scripts/build-flags.mjs` the probe route was absent from `out-flags/`, present in `out/`, and `out/` was untouched.
- gsap 3.15.1: `gsap.ticker.remove(gsap.updateRoot)` then `gsap.updateRoot(seconds)` drives every tween from an outside clock (types in node_modules/gsap/types/gsap-core.d.ts line 614, source gsap.js line 2514). The ticker keeps running for ScrollTrigger.
- Node 24.22.2 strips TypeScript types natively, so `.mjs` scripts can import `src/config/site.ts` (kept free of non-erasable syntax and of imports).

## Old site inventory

Filled in Phase 0 from `old-site/MANIFEST.json` and the old site's source: pages, projects, clients, skills, links, résumé file, usable pictures and what each is for.

Import: `node scripts/import-old-site.mjs` exit 0 on 2026-11-10, copied 88 files (23 media, 65 text), 0 skipped, from the folder Brandon-Portfolio-2025/brandon-church-portfolio under Desktop/Development/Production. `incoming/` does not exist at Phase 0.

Pages on the old site (Next.js, app router): `/` (hero, selected work, about "How I got here", credo strip, competencies, contact with form), `/work`, `/projects/[slug]`, `/design-system`, `/cube`, opengraph image, robots, sitemap.

Projects (`app/data/projects.js`, canonical order): Proactive UI for AI Glasses (flagship, live + GitHub), Ask the Claude Docs (live + GitHub), Design System Extractor (GitHub, not deployed), Generative UI · GitHub (live + GitHub), Modern Softworks (live studio site), Hero Animation Builder (live + GitHub), Meridian · Calibre 01 (live), Micro-Interactions Library (live + GitHub). Each has title, tagline, description, features, techStack, metrics, image.
- Kit's four featured: PC Builder and Red Team Arena are NOT on the old site (no facts, no image, no link). Design System Extractor and Ask the Claude Docs are. So two featured plates use the plain layout with the kit's draft copy only, and both go under Needed from Brandon.

Clients (no client list on the old site; facts come from the résumé PDF, which is part of the old site): Property Claim Consulting (insurance platform, three connected apps, as sole developer, via Modern Softworks), USAID humanitarian aid logistics platform tracking $43B in goods a year (as Director of Frontend Engineering and Accessibility at Leidit, LLC, 2023 to 2026), Genius AI (AI powered mortgage CRM, VP of Product contract, 2026), Jobvite career portals for Fortune 500 clients: Dell, Wells Fargo, Bank of America, John Deere, Lowe's, Taco Bell (2022 to 2023), G2i (AI evaluation contract, 2026), 12+ small business marketing sites (Modern Softworks, 2020 to 2026), Section 508 and WCAG 2.2 audits for federal and enterprise clients. About copy: studio serves 40+ clients.

Skills: `app/data/competencies.js` (four rows: AI Product Engineering, Full-Stack Engineering, Design Systems & Craft, Product Leadership, 48 items) and the résumé SKILLS block (Frontend, Design & UX, AI Engineering, Product & Leadership, Accessibility, Backend & Infrastructure). Games and VR: competency tidbit "C#, game dev, and VR before any of this" (removed from the live site, kept in its content file). Photography: nothing on the old site.

Links (public): GitHub https://github.com/BrandonChurch93, LinkedIn https://www.linkedin.com/in/brandon-church-ms, CodePen https://codepen.io/BrandonLeoChurch, YouTube https://youtube.com/@BrandonChurch (footer). Contact section shows the email brandonleochurch@gmail.com publicly as a mailto link, and a Calendly booking link. The phone number appears only inside the résumé PDF.

Résumé: `old-site/public/downloads/BrandonChurch-Resume.pdf`, two pages, read in full. Experience: Modern Softworks (Founder & Principal AI Product Engineer, Sep 2020 to Aug 2026), G2i (AI Evaluation Engineer & QA Reviewer, contract, Apr to Jul 2026), Genius AI (VP of Product & AI Product Engineer, contract, Feb to Apr 2026), Leidit, LLC (Director of Frontend Engineering & Accessibility, Feb 2023 to Feb 2026), Jobvite (Senior Product Engineer, Jan 2022 to Feb 2023), earlier: Rural Sourcing 2020 to 2022, Hewlett Packard Enterprise 2018 to 2020, MAP Academy 2016 to 2018. Education: Associate of Science, Computer Programming, Augusta Technical College. Location Boise, ID.

Pictures, each opened with the Read tool:
- `images/headshot2.jpg` 2048x1986: Brandon, warm amber studio light, dark shirt. USE: About portrait. Fits the palette. CONFIRMED BY BRANDON mid-build on 2026-11-10: "Use the image with the orange background", the kit's design was made with this picture in mind. Do not swap it.
- `images/headshot.png` 1080x1430: Brandon, grey blazer, a recognizable smartwatch and tablet in frame. NOT USED (G07 risk, and the other portrait is better).
- `images/design-system-extractor.png` 2400x1350: his product UI. USE: Design System Extractor plate window and project page.
- `images/the-claude-docs.png` 3198x1966: his product's type specimen. USE, cropped above the bottom instrument line, which shows a model version string.
- `images/proactive-ui-for-ai-glasses.jpg` 2400x1600: his 3D street with glasses UI cards. USE: project page and /work plate.
- `images/genui-github.png` 2400x1600: his product UI. USE: project page and /work plate.
- `images/Meridian-Project.png` 2400x1350: his procedural watch movement. USE: project page and /work plate.
- `images/animation-builder.png` 2880x1800: his builder UI (a small framework dev badge bottom left, cropped out). USE: project page and /work plate.
- `images/ModernSoftworks.png` 2400x1600: his studio's own wordmark card. USE: project page and /work plate.
- `images/MicroInteractions.svg`: a generic generated gradient card, not a screenshot. NOT USED; that project uses the plain layout.
- `images/fileforge.png`, `images/snapShotAI.png`: not referenced by any project on the old site, no facts. NOT USED.
- `images/CodePen-logo.png`: a third party logo. NOT USED.
- favicons, og-image, coming-soon.svg: old site chrome. NOT USED.
- No video, no game footage, no photography anywhere in the old site.

## Reference notes

Filled in Phase 0: what each reference in `kit/reference/` does, how, and what must be better.

**cards-and-water/second-pass.html** (read in full). Metal: one shared WebGL1 context draws a full-plate quad per plate and copies it to the plate's own 2D canvas (`drawImage(glc, ...)`), only when a signature of lamp, scroll, tilt and lit level changed. Height field: rounded-rect SDF bevel with a quarter-circle profile (`h = thick*sqrt(1-(1-x)^2)`), minus the mask's red channel (engraving, 0.95 px deep), screws and rivets computed analytically in the shader (countersink ring, domed head, slot by angle). The mask is a 2D canvas: red cut, green enamel, blue second metal; text drawn with Canvas text at device pixels, then sampled with a 5-tap blur. Normals by central differences of the height (4 extra height evaluations, each with 5 mask taps). Shading: procedural studio env (top softbox, side strip, sky gradient, warm floor) looked up by the reflected vector plus a tilt term that slides with scroll and cursor; two-lobe GGX (sharp plus 2.3x rougher) from the lamp (cursor at depth 0.4 plate widths) and from the stream (amber, short falloff); brushed grain is anisotropic value noise perturbing the normal's y; patina is fbm plus rim darkening that lowers F0 and raises roughness. Reinhard-like luminance compression, then gamma. Finishes: brass e6b866 rough .2 slot screws; bronze 94663a with brass inlay; panel brass with deep 5a3b22 panel; aged c9994e patina 1, rivets. Plate shadow is a CSS drop-shadow offset away from the lamp; the canvas tilts a few degrees under the cursor with CSS 3D. Water: one triangle-strip ribbon along a cubic path through waypoints beside each plate, width breathing with sin, swelling near plates; fragment shader is three sine "threads" warped by noise, caustic noise, sparks, a surge pulse and a hot head that reveals with scroll (head eases to scroll position). Halo is additive point sprites along the path. Particles: 150 points spawned along the wet part and thrown at the head, simple gravity.
What must be better: the metal shader samples the mask 25 times per pixel (fine at one plate, heavy at eight); engraving is a 1 px soft cut with no real wall and no bevel highlight, so small text gets blurry; no real reflection of nearby light other than one amber point; the photo window does not exist here. The water is a flat additive ribbon: it has no thickness, no refraction, no varying speed, no splash; the threads read as sine waves when you look closely, and the same pulse visibly repeats. Particles are uniform glowing dots with no motion blur.

**third-pass/index.html** (read in full). Same metal plus the photo window: a recess SDF (raised 1.3 px lip, then 6 px down), photo sampled with cover-fit, darkened by a shadow found by offsetting the window SDF toward the lamp and by an inner ambient-occlusion ramp, plus a soft glare lobe from the lamp on flat glass. The header bar is a plate 54 px tall with centered spaced engraved letters and two slotted screws. Water: a list of strands with a kind (run, fall, cling) each knowing its start distance on one route, so one number, the head, says how much is wet. Moves: land on a card's top corner, cling along the top edge, pour off the corner as a quadratic hook, fall straight then bend to the next card; at the client bar it splits both ways, pours off both ends, falls down both sides of the trio and joins under it; then it goes to the desk's front left corner (desk is a still image with a lit overlay faded in), runs the front edge and pours off the right. Falls are faster and torn by noise; landings get a 30 drop burst with gravity plus a 2 drop trickle; landing glows are big additive sprites. The bench is a still image with leader lines and labels (both wrong per kit) and the ledger rows with tools.
What must be better: Brandon said the water here looks really bad: the splash is a glow and loose dots, no crown, no sheet, the falls are one speed and read as glowing tubes, the joins between strands show as kinks and fans, a landing is a hard start. The site's water must be a different class. The photo window shading is the floor: keep the moving recess shadow and glare, add real depth (a wall you can see), contact darkening and reflections of nearby light on the glass.

**hero-city/** (stills opened; `source/nova-main.ts` read in full; `source/nova.ts` outlined, read in full in Phase 4). A floating round city in millimetres, radius 456: disc with terraces stepping to a central spire, a moat, five canals of light-water over the rim falling to a dark slab with a grid, five towers around (twisted, tapered, segmented, a lens-shaped one, a cylinder stack), an outer ring of smaller buildings (stepped pyramid, dome, saucer on a stalk, glass dome), rails along terrace edges, a ring train track, park groves with trees, beds, lamps and people, movers (pods, trains, craft, walkers). Facades use a painted "rooms" canvas texture; MeshPhysicalMaterial ivory, brass, bronze, dark glass, gold park. Lighting: a point lamp at the cursor (shadow-casting, 2048 map, PCF radius 5) on a plane in front of the city, a house RectArea, two rim RectAreas, an amber under spot, a faint hemisphere, studio env at 0.18. Neutral tone mapping, post: GTAO (radius 0.035), Unreal bloom (strength 0.22, threshold 1.15, radius 0.4), SMAA, output. Camera: fov 32, end az 0 el 13 d 1.6 target y 0.289; opening starts az -46 el 62 d 1.72 and eases over 4.7 s while the city rises.
What must be better: the opening's first frames are a disc seen from above in a corner of a limited frame (the "wonky" part); the new one starts dark, light draws the plan, the disc lifts, the city rises and fills with water, using the whole viewport. In the stills the windows are a flat texture on curved shells (P02 at three times zoom), several towers read as plain extruded shapes, the trees are lollipops, people and traffic are specks, the grid floor is permanent, and the falls off the rim are thin lines into flat pools. Keep the ending's feel: the low settled camera, the spire, warm windows, light-water down the front.

**workbench/** (all seven stills opened; `source/bench-main.ts` read; `source/bench.ts` outlined, read in full in Phase 6). Desk in millimetres, walnut top with a dark mat, monitor showing code and a wireframe city, a keyboard with legends and an amber knob, a mouse, a tablet on a low prop with a pencil, a camera with a lens, a spare lens and a cap, and a brass cone lamp. Every tool group has its own lights so the page could relight one at a time (the kit now forbids relighting: one fixed light). Camera fov 30, az 13, el 24, d 1.8. Neutral tone mapping, GTAO 0.03, bloom 0.24 at threshold 1.0. Brandon's favorite is the fixed light: lamp plus monitor glow.
What must be better: it is a rough draft. Wood grain reads as stripes, keys are flat caps without legends you can read, the monitor content is static, the tablet is a recognizable product silhouette (keep it generic), the camera is close to a real body shape, there are no ports, seams, screws or stitching, contact shadows are soft and floaty, and the desk floats in black with no room.

**shared/** (outlined). `post.ts`: EffectComposer with GTAO, Unreal bloom, SMAA and output, with tier settings (pixel ratio, MSAA, AO full or half or off, mirror and shadow sizes) and seeded noise so AO is deterministic. `env.ts`: studio environments built from canvas softbox and strip textures through PMREM. `geometry.ts`: rounded rect shapes, holes, extrude, lathe, tube, screw heads, a PartBuilder that merges parts. `textures.ts`: fbm, grain, brushed, perforation, lapping, braid canvases. The site writes its own versions in `src/world/`.

## Decisions made by the Builder

One line each: the question, the choice, the rule from `kit/07-QUALITY-BAR.md` that decided it.

- Build id freshness: how does the harness know out/ matches the sources? `npm run build` runs `scripts/stamp-build.mjs`, which hashes the sources first, runs `next build`, then writes `out/.source-id`. `distIsStale()` compares that stamp with a fresh hash. Rule 4 (swappable, and exactly what 07 asks: a hash of the sources).
- Strips: a shot with a `strip` field in `scripts/shot-list.mjs` is taken by `scripts/strips.mjs`, tiled 4 per row with the time under each frame, and goes through the same manifest and ledger. `npm run shots` skips strips. Rule 4.
- ref shots: the reference pages animate on their own clock, so each retake differs; they are taken once in Phase 0 and their images are kept. Recorded in the manifest with build `reference`; the gate exempts them from the build check.
- Critic references: `REFERENCES` in `scripts/shot-rules.mjs` pairs city/rest-desktop, city/opening-desktop, bench/rest-desktop, metal/aged-lamp-1, metal/window-lamp-1, water/body and water/split with their floor images, so a critic PASS on those counts only when the critic saw the floor beside it. Rule 1 (Brandon: beat the reference).
- Builder verdict files live in `kit/critics/builder-*.txt` (allowed write area), named apart from the critic answers `NNN.txt`.
- `builder-batch.mjs` is not ported. It is not needed, and leaving it out guarantees it cannot pass a shot the rules would fail.
- Static server answers a missing `/favicon.ico` with 204, so the reference pages do not log a 404 console error.
- Contact links: GitHub, LinkedIn, CodePen, YouTube and the email (shown publicly on the old site's contact section). The Calendly booking link is left out: it asks the visitor to book a call, which reads as a funnel, and the kit allows only public profile links plus a public email. Rule 1 (kit 05 Contact).
- Project pictures are placeholders. Brandon said mid-build (2026-11-11): the old project images are outdated, he will make new ones, do not compromise the design to fit them, build the right design and he will make the images fit. So photo windows have fixed, designed aspect ratios (constants), pictures fill them with object-fit cover (or cover-fit in the shader), and no layout or window shape is ever bent to an old image. The kit's rule still holds that a project with no picture shows no empty window. The Handoff lists the exact window aspect and pixel size to export new images at, and swapping them is one entry each in `scripts/media.mjs`. Rule 1.
- About portrait: `headshot2.jpg` (orange background). Chosen in Phase 0 and then confirmed by Brandon in a message during the build. Rule 1.
- Switches: a page behind a switch is `page.art.tsx` or `page.lab.tsx`, and next.config.ts adds those page extensions only while the switch is on, because an empty `generateStaticParams` is a build error in static export. Rule 4 (one move to turn it off, nothing reads as missing).
- Root font size is fluid, `clamp(16px, 0.5vw + 8.8px, 28px)`: 16px at 1440 and below, 18.4 at 1920, 28 at 3840, so every rem grows on wide and 4K screens and nothing looks small and lost. Rule 1 (kit 02 Type).
- `settle()` waits for fonts, eager pictures, pictures on screen (each capped at 15 s), everything tracked in the registry, and three frames. It does not wait for lazy pictures off screen, which may never load. Found when a 4K peek hung. Rule 4.
- The test hooks add `info()` (tier, frozen, time, scrollY, GPU probe ms, lamp) for tests; the harness can call into a piece with a step named `piece:<name>.<method>`.
- The one clock removes `gsap.updateRoot` from GSAP's ticker and calls `gsap.updateRoot(t)` itself every frame, so freeze holds GSAP too; the ticker keeps running for ScrollTrigger.
- Tier choice: GPU timing test (64 iteration fragment loop at 512x512, 24 frames, read back) under 6 ms is high, under 12 ms mid, else low; one lower on under 4 GB memory; phones never high; a 4K fill or more drops one unless the GPU is under 3 ms. Rule 3.
- Lab pages are bare benches until their phase; the smoke test asks them for 3 characters of text, content pages for 20.
- Old project "why" lines are written from what the old site says (its sublines and first sentences), never a motive it does not state. Rule 1 (no invented fact).
- Résumé page: "twelve years" (the old site's About notes say Brandon ruled twelve and the PDF's eleven is stale); the PDF itself says eleven. Under For review.
- Plates render at up to 2x device pixels on high and mid tiers and 1.5x on low, not at the 3D tier caps: their words must stay crisp on a 3x phone that measures mid, and a plate redraws only when something changes. Rule 1 (kit 07 Metal minimums: crisp text at 1x and 2x).
- Plate geometry: the lamp sits at 0.42 of the larger of the viewport width and 0.8 of its height in front of the page, and its falloff scales with the larger side, so a narrow phone is lit like a desktop. Rule 2.
- Enamel is satin (roughness 0.42, a small lamp sheen), not mirror, and its surface is flat over the cut: a glossy enamel washed the words out as the lamp passed. Rule 1 (the lamp never makes text harder to read).
- Window plates are designed 960 wide (words at the same size as on a 640 plate); a window plate taller than 0.9 of its width stacks the window above the words. Mono lines shrink their letter spacing, then their size, to fit their column.
- The metal/window-video shot plays `public/media/site-recording.mp4`: six seconds of the lamp sweeping a plate on /lab/metal, recorded by `scripts/record-site.mjs` with Playwright and encoded with ffmpeg (H.264, 578 KB). No project video exists (kit 05).
- Harness "same image" tolerance widened in `scripts/shots.mjs` (not a gate script): a frozen plate flipped one pixel of 1.9 million by 17 levels between runs (GPU float noise), one level over the old limit, which threw its verdicts away. Later flips were traced to real causes and fixed, so the tolerance stays at that tight setting: (1) the GPU timing probe could drop the tier on a busy run, so the harness now pins the tier (high unless a shot names one); (2) the plate canvas faded in with a 0.9 s CSS transition, which does not read the one clock, so CSS transitions and animations are off whenever the test hooks are on; (3) plate seeds now hash the plate's words, and scrollTo settles before and after jumping. After these, the 23 metal shots retook identically three times in a row. Rule 4.
- Plate seeds (scratch and patina placement) come from a hash of the plate's words and finish, not from mount order. `scrollTo` settles before jumping, lands on a whole pixel and corrects once.
- Controls (MetalLink, buttons) use only polished or aged brass with enamel words: a bronze or panel control could fall below readable contrast away from the lamp, and a button must always be readable. Bronze and panel stay for larger plates in lists (kit 02). Rule 1 (the lamp never makes text harder to read).
- Résumé page text leaves out the phone number; the PDF download carries it as Brandon made it. Rule 1 (kit 01: never add a phone number from anywhere else to contact).
- The Ask the Claude Docs image is cropped above its bottom line, which shows a model version string. Rule 1 (kit 01: no model version strings).
- Framework and model versions in the old site's project data ("Next.js 16", "React 19", model names with numbers) are written without the numbers in the content file. Rule 1.

## Dependencies added

Name, exact version, why.

- next 16.4.6, react 19.3.1, react-dom 19.3.1: the framework, static export (kit 06).
- three 0.187.0: all 3D, vanilla (kit 06).
- gsap 3.15.1: motion, with ScrollTrigger inside it (kit 06).
- @fontsource-variable/sora, inter, jetbrains-mono 5.3.0: self hosted type (kit 02).
- dev: typescript 7.0.2, @types/react 19.3.0, @types/react-dom 19.3.0, @types/node 26.6.6, @types/three 0.187.0: strict TypeScript.
- dev: sharp 0.35.5: media pipeline. vitest 5.1.0: unit tests. @playwright/test 1.65.0: harness and page tests (Chromium installed with `npx playwright install chromium`).

## Research log

What you looked up, where, and what you took from it.

- Phase 2, metal. Anisotropic GGX for brushed metal: glTF KHR_materials_anisotropy (tangent alpha raised, bitangent kept, separate D and V), Cesium pbrLighting.js `GGX_anisotropic` with anisotropic Smith visibility (Heitz), Unity HDRP `D_GGXAnisotropic`, Unreal BRDF.ush (Burley 2012). Took: brushed brass gets an anisotropic lobe with the tangent along the brushing, so the highlight stretches across the grain as on a real plaque; the reference faked brushing by jittering the normal, which reads as noise up close.
- Phase 2, engraving. TextMesh Pro computes bevels from the glyph's signed distance field like a normal map; Mapbox tiny-sdf builds SDFs from Canvas 2D text with the Felzenszwalb and Huttenlocher distance transform and seeds edge pixels from antialiased coverage for sub-pixel accuracy. Took: paint the plate's words on a 2D canvas, turn coverage into a signed distance field (exact EDT, seeded by coverage), and build the engraving height from distance, so every cut has a crisp lip, a sloped wall and a flat floor at any size, instead of the reference's blurred 1 px mask (25 texture reads a pixel, soft small text).
- Sources: https://wallabyway.github.io/Khronos-glTF-repo-GHPages-test/extensions/2.0/Khronos/KHR_materials_anisotropy , https://app.unpkg.com/@cesium/engine@26.1.0/files/Source/Shaders/Builtin/Functions/pbrLighting.js , https://docs.unity3d.com/Packages/com.unity.textmeshpro@3.2/manual/ShadersDistanceField.html , https://npmjs.com/package/@mapbox/tiny-sdf , https://blog.mapbox.com/drawing-text-with-signed-distance-fields-in-mapbox-gl-b0933af6f817
- Plan for the plate renderer (src/metal/): one WebGL2 context, off the page. Per plate, once per size: paint the words and lines as coverage, distance transform in a worker, then a bake pass writes normal, height, cavity and material masks (brushed grain, patina, screws, the window lip all baked). Per frame only a light pass: anisotropic GGX from the lamp and the water, an analytic studio environment looked up with a view vector from a camera over the viewport center (so the reflection slides with scroll by real geometry, not a tilt fudge), enamel as glossy dielectric, the photo window with a visible wall, a lamp-cast rim shadow, contact darkening and glass glare. Result copied to the plate's own canvas. Shadows under plates are separate blurred layers moved by transform away from the lamp.

## Piece plans

One heading per piece, written in phase 1 of that piece: parts list, the details that will sell it, the risks.

## Measurements

Frame times and sizes, with the tier, the viewport and the renderer string each was measured on.

## Pictures used

Every picture from `old-site/` or `incoming/` that the site uses: source path, what it shows, where it is used, that it was opened and looked at.

## For review

Things Brandon should look at first: faults a critic named that were not fixed and why, places where the result falls short of the bar and exactly how, choices he may want to reverse.

- Metal critic points not acted on after three rounds (kit 07 allows my PASS to gate): (a) "the lamp highlight is a round blob, not stretched along the grain" on polished brass and the lamp strip: polished brass is meant to give a round highlight; the brushed finishes (aged, panel frame) do stretch it. (b) "engraved letters and rivets look the same at every lamp position": the cut walls are 1 to 2 device pixels and enamel filled, so their shading change is real but small at shot size; at 3x zoom it is visible. (c) "the panel's small labels look hollow": at 4x zoom they are solid flat tops with a rim (checked); at sheet size the rim reads as an outline. (d) "large plain bronze field": the bronze is meant to be quiet; it has a cast face and grain. Brandon may want a busier bronze.
- The lab photo window uses the Meridian render, zoomed 1.45x around the movement; real site windows will use Brandon's new pictures, which can set focus and zoom per picture.
- The résumé PDF says "over eleven years"; the résumé page and the old site's About say twelve, per his earlier ruling. The PDF needs updating on his side.
- Client work placards are built from the résumé (Property Claim Consulting, USAID through Leidit, Genius AI, Jobvite, G2i, small businesses, federal audits). The old site had no client list. He may want a different set.
- Calendly is left off contact (kit allows profile links and a public email only).
- The Proactive UI for AI Glasses picture shows a real film title on a theater card inside his own product. It is his screenshot and is used as is; he is replacing project pictures anyway.

## Needed from Brandon (collected as found; copied into the Handoff in Phase 12)

- PC Builder: any facts beyond the kit draft, a picture or video, and a link. Its plate uses the plain layout (no window) until then.
- Red Team Arena: the same: facts, picture or video, link.
- New project pictures (he said he is making them). Export at the window shapes in `WINDOW_ASPECT` (src/config/site.ts): plates 16:10, project page heroes 16:9, at least 2400 px wide; add or swap one entry each in `scripts/media.mjs` and run `npm run media`.
- Any project video for photo windows.
- Game footage, game art or game builds for /games (none on the old site).
- Photographs for /photography (none on the old site), and the tools he uses for photography for the skills ledger.
- Anything for /3d-art, or flip SHOW_3D_ART off before deployment.

## QA results

One line per item of `kit/09-QA-GAUNTLET.md`: the id, pass or fail, the evidence.

## Session log

Newest last. Date and time, what was done, what is next.

- 2026-11-10, session 1: Phase 0. Machine checked, git init, stack installed exact, configs by hand, Next static export facts verified, harness ported (serve, free-port, shot-rules, shots, strips, verdict, check-shots, critic-list, crop, sheet, imgdiff, stamp-build), ref shots taken and judged, gate proven both ways, old site imported and inventoried, references read and noted. Brandon confirmed the orange-background portrait mid-build. Next: Gate 0 commit, then Phase 1 foundations.
- 2026-11-11, Phase 2 done: plate renderer (exact SDF engraving baked per plate in a worker, anisotropic GGX lamp and water light, studio room reflection, patina, scratches, screws and rivets, photo and video windows with lamp cast rim shadow and glare), Plate, MetalLink, lamp CSS variables lighting the nav rule, determinism fixes in the harness and hooks, three critic rounds. Next: Phase 3.
- 2026-11-11, Phase 2 critic round 1 (critics 001 and 002, 23 metal shots): 22 FAIL, bar PASS. Real faults fixed: cloudy patina smudges in highlights (patina now gathers at rims, grooves and fasteners with fine speckle, no clouds); flat tan fields (studio rebuilt as a dark room with a soft key, a strip and a bounce card, so plates carry real reflection bands); small features not answering the lamp (lamp 1.15 to 1.45, room darker); pale lemon cores (exposure curve on the brightest channel keeps hue); window rivets on the lip and uneven margins (window margin 50 design units); window shadow masked by a constant wall band (wall lit by the lamp, glare softened and warmed); placards with fasteners on one side, an orphaned last word (balanced wrapping), soft 1x labels (label 12, facts 11.5); hollow raised letters on the panel (narrow wall centered on the glyph edge, 0.6 relief); bronze flatness (faint cast face); photo crops cutting UI chips (lab window uses the portrait; site pictures are placeholders per Brandon). Disputed, not changed: the lamp strip "trailing then overshooting" is how a specular highlight behaves (it sits where lamp and camera directions bisect, and the right bevel lights when the lamp is right); kit 07 lets a wrong critic point be noted.
- 2026-11-11, session 1: Phase 0 committed (63f7b11). Phase 1: constants, tokens with a fluid root, content file from drafts and the old site, every route as a plain readable page, nav with phone menu, footer, the one clock driving GSAP, the lamp store with drift, tier choice and GPU probe, test hooks and registry, media pipeline (8 pictures, résumé PDF), check:copy, vitest (25), Playwright smoke, hooks and flags tests (145). Brandon said mid-build that project pictures are placeholders and the design must not bend to them; recorded. Next: Phase 2, metal and the lamp.

## Handoff

Written in Phase 12.

- What was built.
- For review (the short list).
- Needed from Brandon: every missing fact, picture, video or link, and where it goes.
- How to run it.
- The two switches: `SHOW_3D_ART` and `SHOW_LAB`, where they are and what each does.
- Ideas held for the review stage.
- Where `main` is pushed: the `origin` address. If it could not be pushed, the reason is under Needed from Brandon.
