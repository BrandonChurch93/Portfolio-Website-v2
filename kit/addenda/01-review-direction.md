# Addendum 01 · The review direction

Written 2026-11-11 by Fable, working with Brandon after BUILD COMPLETE. It records what he decided at review and what has been built since on the branch `fable/phase-2-layout-water`. Where it disagrees with kit files 01 to 10, this addendum wins.

For this stage Brandon chose to have Fable build the new direction in the repo with him, in phases, and to have the Builder finish the rest afterwards. That is his decision and it sets aside the "Partner never writes site code" rule in `docs/partner.md` for this stage only.

## Who the site is for

Nobody finds this site on their own. Its visitors have already read Brandon's résumé: people he is interviewing with, who want to look at his work. So the site never repeats the résumé. It shows the work in depth, and it says the things a résumé cannot.

## What he said about the first build

- "The overall layout is like horrible very amateurish with the cards." Brass was on everything, so nothing stood out.
- The water is the most important thing on the site. It is not a gimmick that touches a couple of things. It scrolls with the visitor, frames layout, splits and interacts, and it has to look incredible.
- No faint channel ahead of the water showing where it will go. It just goes there.
- The city model is good. Its opening must use the whole screen, with nothing cut off at the top or the bottom.
- The copy was in the wrong voice ("I build things for fun"). He wants a serious tone: bettering humanity, cutting edge technology, pushing design. The copy on his live site is the base. He rewrites all of it himself.
- He likes the brass buttons, and wants a primary and an accent.
- Cards should be cards: a dark card with the picture, title, description and tags, with brass around it as hardware and a 3D feel. Not a whole brass plate.

## The home page now

In the order the water runs it:

1. **Hero.** The built city. Live site copy.
2. **Work.** One section for everything he has made. A centered title on a brass lintel, a row of category switches (Software, Games, 3D art, Photography), six cards at most (four on a phone), and a View all work button that goes to the All work page.
3. **Skills.** The workbench and the ledger.
4. **About.** Three tabs beside a large portrait on the right: About me, What I want next, How I work. The first tab has to stand alone.
5. **Contact.** The links, the rocket and its pool.

Gone from the home page: the client work section and the More rooms section. Client work is cut from the site completely: no section, no category. Games, Photography and 3D art stop being separate pages and become categories of the work wall (their pages still exist and are unlinked until Phase 5 removes them). No FAQ.

## The water's route on the home page

Ten stations. This replaces the table of four interactions in `kit/03-WATER.md`.

1. The source: the city's front fall, in the middle.
2. The title: it falls straight onto the middle of the work lintel, throws a crown and runs both ways along the top.
3. The corners: it pours over both ends of the lintel, which is set in from the cards, and lands on the top corners of the two outer cards.
4. The frame: it rounds each corner and clings down the outer edges of the cards on both sides.
5. The meeting: both sides turn in under the cards and meet behind the View all work button. One stream leaves.
6. The weave: it crosses to the left around the skills title.
7. The desk: it lands on the left end of the desk and runs the front edge.
8. The run off: it pours off the right corner and falls beside the ledger.
9. The portrait: it passes behind him.
10. The pool: under the launch pad.

Rules: nothing is drawn ahead of the front; the front follows the scroll and eases; it never crosses text; it lights what it passes; a phone gets the same moves on a narrower route.

Still to design, in Phase 3 and 4: the brass beside the side sheets glowing, a pulse down both sides when the category changes, each ledger row catching a glint, the portrait cut out of its photograph so the water is the light around his head and shoulders.

## The phases

1. Blueprint. Done and approved ("This looks great", "Good work on the water").
2. Layout and water in the repo. Built on the branch; waiting for his verdict.
3. Cards and buttons in the real metal: dark card, brass rim and a small engraved nameplate, the picture in the recessed photo window, the category switch, a primary and an accent button.
4. The pieces: the hero opening at full screen with nothing cut off, the desk brought up to the prototype, the portrait (large, right, cut out, shifting with the lamp, the water behind it), the rocket and pool.
5. Content and the other pages: copy from his live site for him to rewrite, the All work page with the same category filter showing everything, project pages in depth, the résumé, removal of the client and room pages, phone, tablet and 4K passes.
6. The Builder finishes: polish, the gauntlet, speed, access. Then the deployment plan.

He approves each phase before the next starts.

## What Phase 2 changed in the code

- `src/water/route.ts`: a `split` anchor whose bar is set in from its frame now pours onto the top corners of the frame, clings down both sides and meets behind a control under it (`join`). A split straight below the source is reached in one fall. `lineTo` takes an optional width. `WATER.width.side` is the width of the side sheets. The older split, with the bar as wide as its frame, is unchanged.
- `src/water/anchors.ts`: `data-water-join="#id"`.
- `src/water/shaders.ts`: the faint channel ahead of the front is removed.
- `src/components/WorkWall.tsx`, `MetalButton.tsx`, `About.tsx` and their styles are new. `src/app/page.tsx` and `home.module.css` are rewritten for the new order.
- `src/components/Hero.tsx` and its styles: the cue link is gone and the foot of the stage fades into the page.
- `src/components/Nav.tsx`: Work, Skills, About, Resume.
- `src/content/site.ts`: hero copy from the live site, `work.categories`, `work.wall`, `about.tabs`. All of it is draft for Brandon to rewrite.
- `tests/unit/route.test.ts`: ten new tests for the work wall on desktop and phone.

## What is knowingly unfinished after Phase 2

- The cards are plain. They get their metal in Phase 3.
- Two of the six software cards have no picture (PC Builder, Red Team Arena). They show the project's name and "Picture to come".
- Games, 3D art and Photography have no work yet, so each shows its piece and its line.
- The portrait is the photograph with soft edges, not yet cut out. The stream shows faintly through its faded top and foot.
- The skills ledger still lists Games and Photography rows that point at rooms that no longer exist.
- The pages `/clients/`, `/games/`, `/photography/`, `/3d-art/`, `/about/` and `/skills/` are as the Builder left them.
- Browser tests (`npx playwright test`) and the shot gate (`npm run check:shots`) were not run. Some describe the old home page and must be brought up to date in Phase 6: `tests/e2e/gauntlet.spec.ts` E9 (doors), `tests/e2e/flags.spec.ts` (doors and the 3D art nav link), `tests/e2e/hooks.spec.ts` (scrolls to `clients`), and the home shots in `scripts/shot-list.mjs`.

## Checks run for Phase 2

`npm run typecheck`, `npm run test` (125 pass), `npm run build` and `npm run check:copy` (0 problems) all pass. The home page was looked at in screenshots at 1440 by 900 and 390 by 844 with the water's front held at each station. Those were taken with software rendering, so motion and frame time were not judged. Brandon judges motion on his own machine.
