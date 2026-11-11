# 09 · QA gauntlet

Run in Phase 12. Every item needs evidence written in "QA results" in `kit/PROGRESS.md`: a command and its result, a test name, or a shot name. An item with no evidence is not done.

## A · Build and checks

- A1 Delete `node_modules`, `.next` and `out` in this folder, then `npm ci`, `npm run typecheck`, `npm run test` and `npm run build` are all clean. Never clone the repository to do this.
- A2 `npm run check:copy` clean.
- A3 `npm run check:shots` clean with no names given.
- A4 `out/` holds every route in the Pages table of `kit/01-PRODUCT.md`.
- A5 No request leaves the site's own origin at runtime. A Playwright test records every request on every route.
- A6 No console error or warning on any route at any viewport.

## B · Content

- B1 Every string a visitor sees comes from `src/content/site.ts`. A test greps components for literal copy.
- B2 No em dash, exclamation point or banned word in any rendered page.
- B3 Every fact on the site is in the content file with its source noted (draft, old site, incoming). Spot check ten against `old-site/`.
- B4 Contact links are only those found publicly on the old site or given in the kit.
- B5 The word boudoir appears nowhere in rendered pages, routes, alt text or visible file names.
- B6 Every picture on the site was opened and looked at before use. The list is in PROGRESS.
- B7 "Needed from Brandon" lists every gap.

## C · Metal and the lamp

- C1 The four finishes exist and each appears on the site.
- C2 The lamp moves the highlight and the shadow on every plate, bar, placard and metal control. A strip shows it.
- C3 The photo window shows a shadow that moves with the lamp and a glare on the glass, with a picture and with video.
- C4 Plate text is readable at pixel ratio 1 and 2, and present in the DOM.
- C5 On a touch viewport the lamp drifts and the page is alive.
- C6 The lamp also lights every 3D piece. Each piece's `light` and `light-2` shots show it at two lamp positions.

## D · Water

- D1 It starts at the front center fall of the city.
- D2 The four home page interactions exist and no fifth does.
- D3 Every move has a passing strip: run, fall, land, cling, pour, split, frame, pool.
- D4 Falls speed up and thin out. Landings have a crown, thrown drops and a spreading sheet. Particles ride the flow. The strips show each.
- D5 It crosses no text at any of the five viewports on any route. Checked on shots, and by a test that compares the route with text boxes.
- D6 Plates and pieces it touches are lit by it.
- D7 The wet front follows scroll down and back up.
- D8 Reduced motion: it is drawn still and complete.
- D9 Every other route has its stream from top to foot.

## E · Pieces

- E1 Six pieces exist, each in its own folder, each behind the contract. No piece imports another. A test checks imports.
- E2 Replacing a piece with a stub that meets the contract leaves its page working. A test does this for one piece.
- E3 Each piece meets its detail minimums. The close shots are the evidence.
- E4 Each has an entrance strip, motion at rest, and a making view.
- E5 City: the opening uses the whole viewport, plays once, can be skipped, and settles with at least 60 percent of the city above the fold on desktop.
- E6 Workbench: one fixed light. Nothing relights on click. No labels tie skills to objects.
- E7 Rocket: assembles on scroll, lifts off at the end of the page, does not replay in the same visit, and nothing depends on a form.
- E8 Handheld: plays footage or its own loop. Camera: the shutter and the hand over to the photographs.
- E9 At most two pieces hold a WebGL context at once. A test counts contexts while scrolling the home page.

## F · Tiers and sizes

- F1 Every route at all five viewports passes its shot.
- F2 No horizontal scroll from 320 to 3840 wide. A test steps through widths.
- F3 The mid, low and static tiers keep the character of the site. The `tier` shots are the evidence.
- F4 First paint shows the city still, never an empty dark screen.

## G · Access

- G1 Every link and switch is reachable and operable by keyboard, with visible focus.
- G2 Headings are in order on every route. Pictures have alt text from the content file.
- G3 Text contrast is at least 4.5 to 1 against what is behind it, including over the water's glow.
- G4 Touch targets are at least 44 px.

## H · Speed

Logged from a real GPU. On a software renderer, log and mark as not measured.

- H1 Frame rate at rest on the home hero at 1440 by 900, pixel ratio 2.
- H2 Worst frame during the opening.
- H3 Frame time of the low tier with the CPU slowed 4 times.
- H4 Frame time while scrolling the whole home page.
- H5 Size of the first load of the home page, and what is deferred.

## I · Switches

- I1 A build with `SHOW_3D_ART` false (through `scripts/build-flags.mjs`): no page, no nav link, no door, nothing reads as missing. The file still says true.
- I2 A build with `SHOW_LAB` false: no lab routes in the output. The file still says true.

## J · Repository and handoff

These can only be true at the very end, so they need no written evidence. Phase 12 step 5 checks them in order and records one line, `J · checked at the final commit`.

- J1 `git status` is clean after the final commit. `.gitignore` covers `node_modules`, `out`, `out-flags`, `.next`, `next-env.d.ts`, `*.tsbuildinfo`, `shots`, `old-site`, `incoming`, `.env.local`.
- J2 `main` is pushed to `REPO_URL`, or the failed push (with its error) or the missing URL is written under "Needed from Brandon".
- J3 No force push, no rewritten history.
- J4 The Handoff is complete: built, For review, Needed from Brandon, how to run, the two switches, ideas held.
- J5 The first line of PROGRESS reads `BUILD COMPLETE`.
