# 00 · Read me first

This kit is everything needed to build Brandon Church's new portfolio site with nobody at the keyboard. You, the Builder, have no memory of how it was planned. Everything that was decided is in these files. Nothing lives anywhere else.

## Reading order

1. `CLAUDE.md` at the project root: your rules.
2. This file.
3. `kit/PROGRESS.md`: where the build stands. It is your memory.
4. `kit/07-QUALITY-BAR.md`: the standard and how work is checked.
5. `kit/08-BUILD-ORDER.md`: the phases. Each phase names the files to read before it.

The rest are read when a phase calls for them:

| File | Holds |
|---|---|
| `kit/01-PRODUCT.md` | who it is for, the voice, the pages, the home page, what happens after |
| `kit/02-DESIGN.md` | tokens, type, metal, the lamp, the skills section, layout, motion, the hero staging |
| `kit/03-WATER.md` | the water: what it is, how it behaves, the interactions, how it is built and judged |
| `kit/04-PIECES.md` | the six 3D pieces, the module contract, the phases of building one |
| `kit/05-CONTENT.md` | the one content file, the drafts, where facts and pictures come from |
| `kit/06-ARCHITECTURE.md` | stack, source layout, test hooks, tiers, speed, scripts, git |
| `kit/09-QA-GAUNTLET.md` | the final acceptance list |
| `kit/10-KICKOFF.md` | written for Brandon. You read it only for `REPO_URL` |
| `kit/reference/` | the prototypes Brandon judged. The floor to beat |
| `kit/starter/scripts/` | the proven screenshot harness to port |
| `scripts/` | two scripts that ship ready to use: `import-old-site.mjs` and `push.mjs` |
| `kit/addenda/` | empty now. After this build the Partner adds numbered addenda here |

## When files disagree

| Topic | The file that wins |
|---|---|
| What is good enough, how to judge, critic rounds | `kit/07-QUALITY-BAR.md` |
| What is on the site, in what order, the voice | `kit/01-PRODUCT.md` |
| How a thing looks | `kit/02-DESIGN.md` |
| The water | `kit/03-WATER.md` |
| A 3D piece | `kit/04-PIECES.md` |
| Words and facts | `kit/05-CONTENT.md` |
| Code structure, tools, hooks, git | `kit/06-ARCHITECTURE.md` |
| Order of work and gates | `kit/08-BUILD-ORDER.md` |
| Anything a reference shows that a kit file contradicts | the kit file |
| An addendum against any kit file | the addendum |

If two files still disagree after this table, follow the decision rule in `kit/07-QUALITY-BAR.md` and log it under "Decisions made by the Builder".

## How to work

- Follow the memory rules in `CLAUDE.md`. Read from disk, never from recall.
- Re-read `kit/07-QUALITY-BAR.md` at the start of every phase and before any visual decision. The phases name the moments. Brandon asked for this by name: designing animations, making 3D assets, tuning materials and light.
- Look at your work. Take the shot, open it, judge it, record the verdict. `kit/07-QUALITY-BAR.md` has the loop.
- Research when you need to. How a real object is made, how an effect is done at the highest level, what a library does in the installed version. Use WebSearch, WebFetch and the docs in `node_modules`. Log what you found.
- Decide what the kit leaves open, log it, and keep going. Never ask. Never wait.
- Build things so they can be changed. A review stage follows this build, and a second plan will probably follow that.

## Words this kit uses

- **The Builder**: you, when the first message starts with `BUILD MODE`.
- **The Partner**: the model Brandon talks to after the build, started with `/partner`.
- **The water**: the golden light that flows through the site.
- **The lamp**: the light at the visitor's cursor.
- **A piece**: one of the six 3D modules.
- **A plate**: a lit metal card. **A bar**: a full width plate used as a section header. **A placard**: a small plate.
- **The skills ledger**: the rows of skills under the workbench.
- **A room**: the Games, Photography or 3D art page.
- **A move**: one thing the water does: run, fall, land, cling, pour, split, frame, pool.
- **The verdict ledger**: `kit/VERDICTS.jsonl`, where every judgment of a shot is recorded. Not the skills ledger.
- **A shot**: a screenshot taken by the harness. **A strip**: several frames of one motion in one image.
- **A tier**: high, mid, low or static.
- **The floor**: a reference prototype the site must beat.
- **The old site**: Brandon's current portfolio, copied into `old-site/`.
