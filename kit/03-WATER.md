# 03 · The water

Brandon calls it the water. It is golden light that behaves like water. It is the one thing that ties the whole site together, and it is the part he has pushed hardest on. Read `kit/07-QUALITY-BAR.md` before designing or judging any of it.

## What it is

- It is the city's own water. It pours off the front center of the floating city in the hero and carries on down the home page. It is never a separate decoration that starts from nowhere.
- On the home page it ends in a pool under the rocket's launch pad.
- On every other page a stream enters from the top of the page, as if it came from the home page, and runs to the foot.
- Its color is the site amber. Hot parts go to pale gold, never to white.

## How it behaves

Brandon's rulings, in his order of importance:

1. **It weaves by default.** Most of the time it flows between sections and around content, the way a stream finds its way. He likes this.
2. **It interacts with a few things, for depth.** Not with everything. Touching everything is too much.
3. **It moves down the page with the visitor.** The wet front follows the scroll, eased, at a believable speed. Scrolling back up pulls it back.
4. **It never goes straight down the middle and it never crosses text.**
5. **Whatever it touches glows.** Metal near it picks up amber light. A 3D piece it touches is lit by it and shows it wet.

## The interactions on the home page

Exactly these four. Do not add more on the home page.

| Where | What happens |
|---|---|
| The city | It fills the canals, pours off the front rim of the disc and falls to the page below. This is where the stream begins |
| Client work | It drops onto the center of the brass header bar, splashes, runs both ways along the top, pours over both ends, falls down both sides of the section and joins again underneath |
| The workbench | It falls onto the front left corner of the desk, splashes, runs along the front edge and pours off the front right corner |
| Contact | It runs into a shallow pool under the launch pad. The pool ripples. When the rocket lifts off, the pool answers |

Between these it weaves: past the selected work plates, around the doors to the rooms, behind the portrait in About.

On the other pages it weaves from top to bottom, and each page may have at most one interaction of its own if one fits naturally. None is required.

## The floor, and what Brandon said about it

- `kit/reference/cards-and-water/second-pass.html` is the reference for **how the water looks**: a ribbon of flowing light with braided threads, caustics, glints, a bright head, a halo, sparks riding with it, and a faint dry channel ahead of the wet front. Brandon: it "looks much better now".
- `kit/reference/third-pass/index.html` is the reference for **where and how it can interact**: landing, running an edge, pouring over a corner, splitting and framing, the desk. It is not a reference for quality. Brandon: "definitely not high enough quality", "looks really bad", it "doesn't really have a splashing animation", "the physics of it just don't really feel realistic or proper", and it lost the particles the second pass had.

The site's water must be clearly better than the second pass in look and must make every interaction feel real.

## What "real" means here

It is a choreographed effect, not a fluid solver. A browser cannot run a true simulation at this quality on a phone. But every part must obey what water does, so the eye believes it.

- **Falling.** Water in free fall speeds up. Its speed grows with the square root of the distance dropped. As it speeds up the stream thins and then breaks into strands and drops. It never moves at one constant speed down a fall.
- **Landing.** A landing has a shape and a weight. A crown rises and collapses. Drops are thrown on arcs under gravity and land. A thin sheet spreads from the impact along the surface. The impact point boils while water keeps arriving. A splash made only of glow and a few dots is a fail.
- **Running on a surface.** A thin sheet with a leading edge, ripples that travel with it, and a bead along the lip. It slows on flat runs and gathers before it pours.
- **Pouring over an edge.** It clings a little round the corner, then lets go.
- **Weaving.** The body has depth: braided currents, slow swirls where it bends, pooling on the outside of a bend.
- **Pooling.** A surface with rings that spread, cross and fade, a soft meniscus at the edge, and light from below.
- **Particles.** Sparks and motes ride with the flow everywhere, are thrown at the head, and rise from landings. Brandon asked for these by name.
- **Light.** It is the brightest thing on the page and it lights what is near it, with falloff. It never looks like a neon tube.

Research is expected here. Look up how real time water and light trails are done well on the web and in games (flow maps, signed distance ribbons, GPU particles, height field ripples, screen space light), try approaches on a test page, and log what was tried and why the final approach won.

## How it is built

- One `WaterSystem` owns the water on a page. It is a module with a small contract, like a 3D piece, so it can be swapped in the review stage.
- **It is driven by anchors, not drawn by hand per page.** A section marks where water may touch it with data attributes: a corner, a top edge, a side, a pool. The system reads the real layout and computes the route. It recomputes on resize and when fonts or images change the layout.
- The route is a list of strands. Each strand has a kind (run, fall, cling, pool) and knows how far along the whole route it starts. One number, the head, says how much of the route is wet. Both halves of a split share the same distances.
- The moves are separate parts with one job each: run, fall, land, cling, pour, split, frame, pool. Each is built and judged alone before any page uses it.
- A phone gets a simpler route with the same moves.
- It draws above the page background and below text. Where it must pass in front of a 3D piece (the desk edge), the piece and the water agree on depth so it never looks pasted on.
- It costs little when it is off screen and nothing when the tab is hidden.
- Test hooks, listed in `kit/06-ARCHITECTURE.md`, can freeze its clock, set the head, and jump to any move, so shots and filmstrips are repeatable.

## How it is judged

Stills cannot show motion, so the water is judged with filmstrips: a fixed number of frames at fixed times, laid side by side in one image. `kit/07-QUALITY-BAR.md` defines them, the shot list and the fail list for water. The phases are:

1. Look of the body at rest and flowing.
2. Each move alone, on a test page.
3. Light on metal and on 3D pieces.
4. The home page route at every tier.
5. The other pages.
6. Cost: frame time with the water on, at every tier.
