# 01 · Product

## What this is

Brandon Church's portfolio site, rebuilt from nothing. It replaces the site at brandonchurchportfolio.com. It is a static site: no accounts, no database, no AI at runtime, no form that sends anything.

The site name is the `SITE_NAME` constant in `src/config/site.ts`. Application code never hardcodes it.

## Who reads it

- Mostly engineers who are about to interview Brandon. They have already read his résumé and they came to see the work.
- They know what is hard. A cheap trick does not impress them. Real craft does.
- That is why the bar in `kit/07-QUALITY-BAR.md` is as high as it is.

## What it must feel like

- World class on a phone, an iPad, a desktop and a 4K screen. Not one of them is the lesser version.
- Hyper detailed 3D. Brandon's word is "hyper detailed", not "hyper authentic": invented things are welcome, thin or empty things are not.
- Nothing janky. Nothing that looks like a template.
- Brandon does not care how long the build takes. He cares that it is right.

## Voice

This is settled and it is the rule for every word on the site.

- It is not a sales pitch. Nobody is being sold anything.
- The stance is: this is who I am. I want to do things that help people and build a better future.
- Each project says why he built it. Often the honest reason is that it looked cool or fun to try.
- Laid back and honest. First person. Plain words.
- Present tense. No exclamation points. No em dashes anywhere. Use a period, a comma or an interpunct (·).
- No corporate words: no "passionate", "leverage", "solutions", "results driven", "world class".
- Nothing on the site depends on a visitor sending a message. Nobody does.
- No model version strings. Name products, never versions.

## Hard rules about content

- Facts come from `src/content/site.ts` or from the old site copied by `scripts/import-old-site.mjs`. Never invent a fact: no made up client, date, number, award, job title or quote. `kit/05-CONTENT.md` says what to do when a fact is missing.
- Photography is one room. Never label boudoir work as its own category, and never use that word in a heading, link, file name shown to a visitor or alt text.
- Business ideas Brandon has not shipped stay off the site.
- Contact links are only the ones listed in the content file. Never add an email address or phone number from anywhere else.
- No real company's logo or product design appears in any 3D piece. Tools on the workbench are generic and unbranded.

## Pages

| Route | Page | Opens with |
|---|---|---|
| `/` | Home | the floating city |
| `/work` | Work · every project | brass plates |
| `/work/[slug]` | One page per project | that project's photo or video under glass |
| `/clients` | Client work | brass placards |
| `/games` | Games | the brass handheld |
| `/photography` | Photography | the camera piece |
| `/3d-art` | 3D art | the sculpture |
| `/skills` | Skills | the workbench |
| `/about` | About | portrait and a short signed letter |
| `/resume` | Resume | the résumé, readable on the page, with a download |
| not found | Not found | a small piece of the site's world, one line, one way home |

The 3D art page is built, linked and shown during development. `SHOW_3D_ART` in `src/config/site.ts` is `true` in this build. Setting it to `false` removes the page, its nav link and its home page door in one move. Brandon flips it right before deployment if he has no 3D work to show yet. Nothing else may read as missing when it is `false`.

## The home page, in order

1. **Hero.** The floating city fills the first screen. It builds itself in an opening that uses the whole viewport, then settles low so the headline sits above it. The water starts here.
2. **Selected work.** Four featured projects on brass plates, each with a photo window: PC Builder, Design System Extractor, Red Team Arena, Ask the Claude Docs, in that order. A link to `/work`.
3. **Client work.** A full width brass header bar, then small brass placards. The water lands on the bar, splits and frames the section.
4. **Skills.** The workbench, in one fixed light, with the skills ledger under it. The water lands on the corner of the desk and runs off it.
5. **More rooms.** Doors to Games, Photography and 3D art. Each door shows a small live view of that room's piece.
6. **About.** A portrait and a short signed letter. The water bends behind the portrait.
7. **Contact.** Links, no form. The rocket assembles as this section scrolls in and lifts off when the visitor reaches the end of the page. The water ends in a pool under the pad.

There is no process section. Brandon cut it as bloat. Do not add sections that are not on this list.

## Rules that hold on every page

- Each room has its own 3D piece. The pieces do not all follow the city. Each has its own idea and its own look, inside the one design language.
- Video and photos never compete with 3D. A page opens with its piece. Once the visitor is past the opening, the media has the stage and the piece is gone or at rest.
- The water runs through every page. `kit/03-WATER.md` is the spec.
- The light from the cursor falls on everything that has form. `kit/02-DESIGN.md` is the spec.
- Every 3D piece has a "how this is made" switch. `kit/04-PIECES.md` is the spec.
- There is no permanent grid floor behind the page. A grid may appear in places where it belongs to something, such as under the city.
- Layouts may break the usual patterns where the page is still easy to use. They never get in the way of reading.

## Not in this build

Record these under Handoff as ideas for the review stage. Do not build them.

- A separate small 3D object for each featured project.
- The gaming PC as a piece on this site.
- Anything that sends a message, stores data or calls a service.
- Deployment. See below.

## What happens after this build

1. This build ends at `BUILD COMPLETE`, pushed to the repository, not deployed.
2. Brandon reviews it with the Partner.
3. A second plan will probably follow, as addenda in `kit/addenda/`.
4. Deployment comes only after that second plan is finished.

So build everything to finished quality, and build it so it can be changed: every 3D piece is a module that can be swapped without touching its page, all copy is in one file, and every constant appears once.
