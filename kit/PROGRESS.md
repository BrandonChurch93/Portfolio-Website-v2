IN PROGRESS · Phase 1 · start

Replace the line above with `IN PROGRESS · Phase <n> · <step>` while working, `BLOCKED: <what, what you tried>` on a true blocker, and `BUILD COMPLETE` at the end.

# Progress

This file is the Builder's memory. Write in it like a lab notebook: what you did, what you measured, what you decided and why, what is next. Update it at the end of every step, before every commit and before any long command.

## Where things stand

- Phase: 1 Foundations
- Step: start (read the Phase 1 "Read first" files)
- Next action: src/config/site.ts constants, tokens, fonts, global styles; then src/content/site.ts
- Background tasks running (id, what): none
- Files changed since the last commit: none

## Phases

| Phase | Name | Status | Gate passed (date, commit) |
|---|---|---|---|
| 0 | Setup | done | 2026-11-10, first commit "Phase 0 setup and harness" |
| 1 | Foundations | | |
| 2 | Metal and the lamp | | |
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
- About portrait: `headshot2.jpg` (orange background). Chosen in Phase 0 and then confirmed by Brandon in a message during the build. Rule 1.
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

## Piece plans

One heading per piece, written in phase 1 of that piece: parts list, the details that will sell it, the risks.

## Measurements

Frame times and sizes, with the tier, the viewport and the renderer string each was measured on.

## Pictures used

Every picture from `old-site/` or `incoming/` that the site uses: source path, what it shows, where it is used, that it was opened and looked at.

## For review

Things Brandon should look at first: faults a critic named that were not fixed and why, places where the result falls short of the bar and exactly how, choices he may want to reverse.

## QA results

One line per item of `kit/09-QA-GAUNTLET.md`: the id, pass or fail, the evidence.

## Session log

Newest last. Date and time, what was done, what is next.

- 2026-11-10, session 1: Phase 0. Machine checked, git init, stack installed exact, configs by hand, Next static export facts verified, harness ported (serve, free-port, shot-rules, shots, strips, verdict, check-shots, critic-list, crop, sheet, imgdiff, stamp-build), ref shots taken and judged, gate proven both ways, old site imported and inventoried, references read and noted. Brandon confirmed the orange-background portrait mid-build. Next: Gate 0 commit, then Phase 1 foundations.

## Handoff

Written in Phase 12.

- What was built.
- For review (the short list).
- Needed from Brandon: every missing fact, picture, video or link, and where it goes.
- How to run it.
- The two switches: `SHOW_3D_ART` and `SHOW_LAB`, where they are and what each does.
- Ideas held for the review stage.
- Where `main` is pushed: the `origin` address. If it could not be pushed, the reason is under Needed from Brandon.
