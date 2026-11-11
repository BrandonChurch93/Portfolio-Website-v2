# Starter scripts

The screenshot harness and gate from Brandon's last hands-off build. They were proven on that build and they are the reason its work could be checked. That build was a Vite app with its own shot names, so they will not run here as they are. Port them into `scripts/` in Phase 0. Do not write a new harness from nothing.

Each file starts with a comment that says what it does and how it is called. Read those first. Those comments describe the last build. Where they disagree with this kit, this kit wins: they mention a parts catalog under `kit/data/`, an addendum called `01-less-judging`, a `dist/` folder, a hook called `window.__pcb`, and "do not change this file". None of that applies here.

| File | Job | Port notes |
|---|---|---|
| `shots.mjs` | takes named shots and one-off `--url` shots | serve `out/` from the static export; drive `window.__site`; wait for `settle()`; use the viewports in `kit/07-QUALITY-BAR.md`, with their pixel ratios and touch on phone and tablet, in `--url` mode too; record `ref` shots so the gate can see them |
| `shot-list.mjs` | the table of named shots | empty it and fill it for this site |
| `shot-rules.mjs` | builds the required names, groups and reference pairs | rebuild from the Required shots table in `kit/07-QUALITY-BAR.md` |
| `verdict.mjs` | appends verdicts to `kit/VERDICTS.jsonl`, each with the image hash | keep as is |
| `check-shots.mjs` | the gate: says which shots are in order | keep the checks; change the group rules to the critic rules in `kit/07-QUALITY-BAR.md` |
| `critic-list.mjs` | prints the lines to hand a critic | keep as is |
| `check-copy.mjs` | fails on banned characters, words and colors | set the rules in `kit/05-CONTENT.md`; scan `src/content/` and the built pages |
| `free-port.mjs` | finds a free port | range 5321 to 5329 |
| `thumbs.mjs`, `crop.mjs`, `sheet.mjs`, `contacts.mjs`, `peek.mjs`, `imgdiff.mjs`, `replace.mjs`, `builder-batch.mjs` | helpers for looking at, cropping, tiling and comparing images, and for batch verdicts | keep what is useful |

To add: `strips.mjs`. It freezes the clock at a list of times with `window.__site.freeze(t)`, takes a frame at each, and tiles them into one image with the time printed under each frame, saved as a shot so it goes through the same verdict ledger and gate.

The critic rules in the copied `check-shots.mjs` are the last build's. Replace them with the rules under "The verdict ledger and the gate" in `kit/07-QUALITY-BAR.md`, exactly: the source hash as build id, the `ref` exemption, three critic rounds before a Builder PASS counts in the piece, metal and water groups, and one critic verdict on the desktop and phone shots of `home` and `page`. `builder-batch.mjs` must not be able to pass a shot those rules would fail.
