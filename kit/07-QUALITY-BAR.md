# 07 · Quality bar

Read this file fully at the start of every phase. Read it again before you design any animation, model or texture any 3D asset, tune any material or light, write any shader, and before you judge any shot. If you are about to decide something visual and you have not read this file in this session, stop and read it.

## The standard

Brandon's words, from planning:

- "Absolutely incredible and beautiful and world class across all domains: mobile, iPad, desktop, 4K."
- The 3D is "hyper detailed". Nothing janky.
- He does not care how long the build takes.
- On an early draft that was only decent: "midtier at best", and "did you screenshot this and think this was incredible quality?"

The readers are engineers who build things like this. The question for every shot is not "does it work" and not "is it fine". It is: would one of them stop scrolling and look closer?

There is no token budget, no cap on screenshots and no time limit. There is no cheaper fallback. A phase is never left at good enough.

## The floor

These are in `kit/reference/`. Each is the least the site may be. The site must be clearly better than each one, and where Brandon named a fault the site must not have it.

| Reference | What Brandon said | So |
|---|---|---|
| `hero-city/` | "A really good concept." Approved only if the final animation is better than the preview. The old beginning was "pretty wonky". The ending was his favorite | Beat it in detail and in motion. New beginning that uses the whole viewport. Keep the feel of the ending |
| `cards-and-water/second-pass.html` | Cards "look really good", he likes the variety, favorite is the aged brass. The water "looks much better now" | The floor for metal and for how the water looks |
| `third-pass/index.html` | "The photos look great." The water there "looks really bad": no real splash, physics that do not feel real, the particles gone. The desk labels and tool names under skills are wrong | Floor for the photo window and for where the water interacts. Not a floor for water quality. No labels on the desk |
| `workbench/` | "I really like the rough draft of the desk." Agreed as a rough draft | Much better and more polished than the draft |

In Phase 0 you take shots of the two reference pages with the harness. Those are the `ref` shots. The city and the workbench references are stills already. Later shots are compared with these.

## Five tests

Every 3D shot, metal shot and water strip must pass all five.

1. **Stop.** An engineer who makes 3D for the web would stop and look closer.
2. **Close.** At three times zoom there is still detail to find. Nothing turns to mush or flat color.
3. **Lit.** It looks lit, not painted. Highlights, shadows and reflections agree with one another and with the lamp.
4. **Weight.** In motion it has mass and intent. Nothing slides, pops or loops visibly.
5. **Better.** It is clearly better than its reference, and you can say how in one sentence.

## Detail minimums

- City: the spire plus at least six large structures that differ in shape; every facade has floors, mullions and lit rooms with depth; parks with trees and people; at least three kinds of traffic moving in different directions; water in the canals and over the rim. No structure is a plain box.
- Workbench: every key has a legend; the monitor and iPad show moving content that reads as real work; ports, seams, screws and stitching are visible in close shots; wood grain varies and does not read as stripes.
- Handheld, camera, rocket, sculpture: at least twenty distinct modelled features each (fasteners, seams, vents, rings, text, panels), and at least three materials that read differently under the lamp.
- Metal: engraved text is crisp at pixel ratio 1 and 2 down to the smallest label; no stair steps on bevels; the photo window shows a shadow that moves with the lamp.
- Water: see the fail list. Every move has a filmstrip.

## Fail list

A shot with any of these fails, whoever judges it.

General
- G01 Looks like a template or a tutorial result.
- G02 Empty or flat surface where the eye expects detail.
- G03 Banding, stair steps, shimmer, z-fighting, clipped geometry, visible seams between frames or tiles.
- G04 Blown out white, crushed black, or amber that has gone white.
- G05 Something is cut off by the viewport or by another element that should not cut it.
- G06 Worse than its reference in any respect Brandon praised.
- G07 A real brand, logo or recognizable product design.

Pieces
- P01 A building or object that is a plain primitive.
- P02 Windows or screens that look like a flat texture.
- P03 Razor sharp edges with no bevel on a man made object.
- P04 A light that lights nothing, or a glow with no source.
- P05 Shadows missing, floating objects, or contact with no occlusion.
- P06 Motion that pops, loops visibly, or moves everything the same way at once.
- P07 The making view looks like a debug mode.

Metal
- M01 Reads as a gradient, not as metal.
- M02 Text hard to read, blobby or doubled.
- M03 The lamp moves and the highlight or shadow does not, or lags badly.
- M04 A photo that looks stuck on top instead of under glass in a recess.

Water
- W01 A fall that moves at one constant speed or looks like a glowing tube.
- W02 A landing with no shape: no crown, no thrown drops on arcs, no spreading sheet.
- W03 No particles riding with the flow or thrown at the head.
- W04 Water that crosses text, or runs straight down the middle.
- W05 Water that touches something and does not light it.
- W06 A visible join, fan or kink in the ribbon. A hard start or end.
- W07 The same loop visibly repeating.
- W08 Looks pasted over a 3D piece instead of touching it.

Interface
- U01 Text that overlaps, wraps badly, or is too small or too large for its tier.
- U02 Uneven spacing, misaligned edges, orphaned words in headings.
- U03 A section that looks unfinished or empty at any tier.
- U04 Horizontal scroll, layout shift, or a jump while scrolling.
- U05 The phone, tablet or 4K view is plainly the lesser version.
- U06 Skills tied to objects on the desk: labels or lines on the desk, or the name of a desk object under a skill. Listing the tools he uses in a ledger row is correct and is not this fault.

Copy
- C01 An em dash, an exclamation point, a banned word, or a sentence that sells.
- C02 A fact that is not in the content file or the old site.

## The screenshot system

Nothing visual is done until you have looked at a picture of it. This is how the work is checked, by you during the build and by Brandon after it.

**The harness.** `npm run shots -- <name or group>` builds if the sources are newer than `out/`, serves `out/`, opens the page with `?hook=1`, drives `window.__site`, waits for `settle()`, and writes `shots/<group>/<name>.jpg`. It records which build each image came from.

**Stills** show a state: a piece from an angle, a page at a tier, a plate under the lamp.

**Filmstrips** show motion, because a still cannot. `npm run strips -- <name>` freezes the clock at a fixed list of times, takes a frame at each, and lays them side by side in one image with the time under each frame. Use 8 frames for a move and 12 for an opening or a full page scroll. Judge a strip by reading it left to right: does the motion start, build, peak and settle as real motion would. Every animation on the site has a strip.

**Close shots.** Every piece has at least six close shots chosen to test the Close test: the places a viewer's eye goes.

**Viewports.**

| Name | Size | Pixel ratio |
|---|---|---|
| phone | 390 x 844 | 3 |
| tablet | 834 x 1194 | 2 |
| desktop | 1440 x 900 | 2 |
| wide | 1920 x 1080 | 1 |
| 4k | 3840 x 2160 | 1 |

**Required shots.** These are the exact names. `scripts/shot-rules.mjs` holds this list and the gate fails while any is missing. `<vp>` is each of `phone`, `tablet`, `desktop`, `wide`, `4k`. You may define extra shots with any other name inside these groups; they follow the same rules.

| Group | Names | Count |
|---|---|---|
| `ref` | `ref/second-pass-desktop`, `ref/second-pass-phone`, `ref/third-pass-desktop`, `ref/third-pass-phone` | 4 |
| `metal` | `metal/aged-lamp-1` to `-3`, `metal/polished-lamp-1` to `-3`, `metal/bronze-lamp-1` to `-3`, `metal/panel-lamp-1` to `-3`, `metal/text-1x`, `metal/text-2x`, `metal/window-lamp-1` to `-3`, `metal/window-video`, `metal/bar`, `metal/placard`, `metal/controls`, `metal/phone`, `metal/lamp-strip` (strip: the lamp crossing a plate) | 23 |
| `water` | `water/body`, and one strip each: `water/run`, `water/fall`, `water/land`, `water/cling`, `water/pour`, `water/split`, `water/frame`, `water/pool`, plus `water/light-plate` | 10 |
| `city` | `city/form`, `city/close-1` to `-6`, `city/materials`, `city/light`, `city/light-2`, `city/making`, `city/rest-<vp>`, strips `city/opening-desktop`, `city/opening-phone`, `city/settle` | 19 |
| `bench` | `bench/form`, `bench/close-1` to `-6`, `bench/light`, `bench/light-2`, `bench/making`, `bench/rest-desktop`, `bench/rest-phone`, strips `bench/entrance`, `bench/water` (the water on the desk) | 14 |
| `handheld`, `camera`, `sculpture` | each: `<piece>/form`, `<piece>/close-1` to `-6`, `<piece>/light`, `<piece>/light-2`, `<piece>/making`, `<piece>/rest-desktop`, `<piece>/rest-phone`, strip `<piece>/entrance` | 13 each |
| `rocket` | the same thirteen, plus strips `rocket/assembly` and `rocket/launch` | 15 |
| `home` | `home/hero-<vp>`, `home/work-<vp>`, `home/clients-<vp>`, `home/skills-<vp>`, `home/rooms-<vp>`, `home/about-<vp>`, `home/contact-<vp>`, strips `home/scroll-desktop`, `home/scroll-phone` | 37 |
| `page` | `page/<route>-<vp>` for route in `work`, `project`, `clients`, `games`, `photography`, `3d-art`, `skills`, `about`, `resume`, `notfound` | 50 |
| `tier` | `tier/hero-mid`, `tier/hero-low`, `tier/hero-static`, `tier/room-mid`, `tier/room-low`, `tier/room-static` | 6 |

`light` and `light-2` are the same view with the lamp in two different places. `page/project` is one project page standing for all.

## The loop

For every visual thing:

1. Read this file if you have not this session. Read the spec for the thing.
2. Research when you do not know how the real thing looks or how the effect is done well. Log what you found.
3. Build it.
4. Take the shots. Open every image with the Read tool. Never judge an image you have not opened.
5. Judge it against the five tests, the minimums and the fail list. Record your verdict with `node scripts/verdict.mjs`. Be the harshest reader the site will ever have.
6. If it fails, fix it and go to 4. Do not move on with a known fault.
7. When your own verdict is a PASS, follow the critic rules below.

## The critic

A critic is a fresh agent that has not seen the work being made. It uses the `critic` agent in `.claude/agents/`. Get its list of images from `npm run critic:list -- <names>`, give it at most 12 lines exactly as printed, save its answer under `kit/critics/` exactly as it came back, in a file named with a three digit number, and enter it with that number, for example `node scripts/verdict.mjs --from kit/critics/001.txt --who critic --critic 001`. Each critic round gets the next number.

Brandon asked for critics to judge the 3D work in phases until it is right. His last build also showed that endless rounds on shots that already look right waste the run. So:

- **Pieces, metal and water.** At the end of each phase of a piece (`kit/04-PIECES.md`), each phase of the water (`kit/03-WATER.md`), and the metal system, send that phase's shots to a critic. Fix every fault it names that is real. Then send the shots that still lack a critic PASS to a new critic. Repeat until every shot of the phase has a critic PASS or has critic verdicts from three rounds. No shot ever needs more than three rounds. Once a shot has had three, your own honest PASS on its latest image is the gate for it, and every fault a critic named that you did not fix goes under "For review" in PROGRESS with the reason.
- **Pages.** You judge page shots yourself. At each page's gate, one critic looks once at that page's desktop and phone shots. Fix what is real. Your PASS on the new images is the gate.
- **After a shared change** (a material, the post chain, tokens), do not retake and re-judge everything that already passed. Phase 12 retakes everything once.
- A critic that fails a shot for something this kit allows (an invented city, the amber color, the dark page) is wrong on that point. Say so in PROGRESS and move on.

## The verdict ledger and the gate

- Every verdict is a line in the verdict ledger, `kit/VERDICTS.jsonl`, stamped with the hash of the image it is about. A verdict on an image that has since changed does not count.
- `npm run check:shots -- <names>` says which shots are in order. A shot is in order when all of these hold:
  - it is one of the required names or is defined in `scripts/shot-list.mjs`;
  - its image was taken, or confirmed unchanged, by the harness from the current sources. The build id is a hash of the sources (everything under `src/` and `public/` except `public/generated/`, plus `package-lock.json` and the Next.js config), not of the built output, because Next.js output is not guaranteed to be identical between builds. The `ref` shots are exempt, since they come from no build;
  - the newest verdict on exactly that image is a PASS;
  - in the groups `metal`, `water`, `city`, `bench`, `handheld`, `camera`, `rocket` and `sculpture`: that PASS is a critic's, or it is yours and the verdict ledger holds critic verdicts on that shot from three different critic rounds. A critic FAIL followed by your own PASS does not pass a shot before the third round;
  - in `home` and `page`, for the `-desktop` and `-phone` shots: the verdict ledger holds at least one critic verdict on that shot, on any image;
  - in `ref` and `tier`: your own PASS is enough.
- Retaking a shot whose picture has not changed keeps its verdict. That is why every animation must read the one clock: a frozen scene gives the same image every time.
- Order at a gate: build first, then take or retake that gate's shots, then judge, then run the check last.
- A gate in `kit/08-BUILD-ORDER.md` that says "shots pass" means this check exits clean for the groups it names. Nothing else counts.

## Stuck

If a thing still fails your own verdict after four rounds of fixing, stop fixing the same way. Research how it is done at the highest level, write a new plan in PROGRESS, and rebuild that part. Do this once per thing. If it still falls short after the rebuild, make it the best you can, record exactly where it falls short under "For review", and go on. A review stage follows this build, so an honest note is worth more than a hidden fault.

## The decision rule

When the kit does not cover something, choose in this order and log the choice:

1. What Brandon said, in this kit.
2. What makes the thing more detailed, more truly lit, or more alive.
3. What an engineer reading the site would respect.
4. What keeps the piece or system swappable later.

## Taste

- Restraint in color: dark, amber, brass, ivory. No new hues without a reason.
- One hero per screen. Everything else supports it.
- Light is the decoration. Do not add ornaments where light can do the work.
- If two things compete, the 3D piece wins at the top of a page and the content wins after it.
- When unsure whether something is too much, it is. When unsure whether something is detailed enough, it is not.

## Done

The build is done when every gate has passed, `kit/09-QA-GAUNTLET.md` is complete with evidence, `npm run check:shots` and `npm run check:copy` exit clean, the Handoff in PROGRESS is written, and `main` is pushed or the failed push is logged.
