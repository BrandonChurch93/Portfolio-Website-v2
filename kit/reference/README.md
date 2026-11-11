# Reference

These are the prototypes Brandon judged during planning. Each is the floor: the least the site may be. `kit/07-QUALITY-BAR.md` has what he said about each and what must be better. Where a reference shows something a kit file contradicts, the kit file wins.

They were made in a sandbox with no GPU, as stills and simple pages. The site is live, on a real GPU. Use them for the look and the ideas, not as code to paste.

## hero-city/

The floating city, as a pre-rendered prototype.

- `rest-lamp-center.jpg`, `rest-lamp-left.jpg`, `rest-lamp-right.jpg`: the finished city with the lamp in three places.
- `opening-strip.jpg`: twelve frames of the old opening, left to right, top to bottom. The camera path and the city rising are worth keeping. The beginning is what Brandon called wonky: it must use the whole viewport and start as `kit/02-DESIGN.md` says.
- `source/nova.ts`: how the city was modelled: the disc and terraces, canals and falls, the spire, the towers, facades with lit rooms behind glass, bridges, parks, trees, people, traffic. `source/nova-main.ts`: the lights, camera, tone mapping and post settings that gave the look.

## cards-and-water/

- `second-pass.html`: open it in a browser. Live lit metal plates and the water as a flowing ribbon. This is the floor for metal and for how the water looks. It sets `window.__ready` when drawn, so the harness can shoot it.
- `shot-*.jpg`: what it looked like in planning.

## third-pass/

- `index.html`: open it in a browser. The photo window on a plate, and the water interacting: landing on a card corner, running a top edge, pouring off, splitting on the client work bar and framing the section, landing on the desk corner and running the front edge.
- It is the floor for the photo window and for where the water can interact. Its water quality is not a floor: Brandon said it looks really bad.
- It shows labels on the desk, and the name of a desk object under each skills row's heading. Both are wrong. Do not copy them. The tools listed inside each row are right.
- On the home page the water interacts with four things only (`kit/03-WATER.md`). This page shows more, to test the moves.
- `shot-*.jpg`: what it looked like in planning.

## workbench/

- `fixed-light-brandons-favorite.jpg`: the desk in the one light it must always be in.
- `all-lights.jpg` and `pass-*.jpg`: the same scene under other lights, for seeing the forms.
- `source/bench.ts` and `source/bench-main.ts`: how the desk and its objects were modelled and lit.

## shared/

`post.ts`, `env.ts`, `geometry.ts`, `rng.ts`, `textures.ts`: the helpers the two Three.js sources import, from Brandon's earlier project: the post chain (occlusion, bloom, output), the studio environment, geometry builders. Read them to understand the sources. The site writes its own in `src/world/`.
