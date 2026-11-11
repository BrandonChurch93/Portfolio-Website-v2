# 04 · The 3D pieces

Six pieces. Each owns a place on the site. Each is hyper detailed, lit by the visitor's lamp, and built to the bar in `kit/07-QUALITY-BAR.md`. Read that file before designing, modelling, texturing, lighting or animating any piece, and again before judging any shot of one.

## Rules for every piece

- **Hyper detailed.** Close up, a piece still has things to find: seams, fasteners, bevels, wear, text, layered materials. A smooth empty surface is a fail. Brandon judged an early city "midtier at best" for weak buildings and fake looking windows.
- **Made new, not grown from a rough.** When a reference exists it is the floor to beat, and its good ideas are kept. But do not just add to it. Brandon rejected a version that built on top of a sketch he had approved instead of making a better model.
- **Fewer, bigger things.** Detail comes from making each thing rich, not from adding more things.
- **Real light.** Physically based materials, shadows, occlusion, restrained bloom, Neutral tone mapping. The cursor lamp is a real light in the scene.
- **Alive.** Each piece has motion of its own at rest, small and constant, and an entrance.
- **Its own idea.** The pieces do not all look like the city. One design language, different worlds.
- **Procedural or authored in code.** No downloaded models, no stock assets, no real brand's design.
- **Every tier.** Phone, tablet, desktop, 4K. Lower tiers lose cost, not character.

## The module contract

Every piece lives alone in `src/pieces/<name>/` and exports one factory. Pages talk to a piece only through this contract, so a piece can be replaced in the review stage without touching the page.

```ts
export interface Piece {
  mount(host: HTMLElement, opts: PieceOptions): Promise<void>;
  setLamp(x: number, y: number): void;        // lamp position in the host, 0 to 1
  setProgress(p: number): void;               // 0 to 1, the scroll progress the page gives it
  setWaterLight(k: number): void;             // 0 to 1, how much the water is lighting it
  setMaking(on: boolean): void;               // the "how this is made" view
  setTier(tier: Tier): void;
  freeze(t: number | null): void;             // test hook: hold the clock at t seconds, or release
  view(az: number, el: number, dist: number): void; // test hook: place the camera for a close shot
  dispose(): void;
}
```

- No piece imports another piece. Shared code (materials, geometry helpers, post chain, the lamp) lives in `src/world/`.
- A piece mounts when it nears the viewport and disposes when it is far away. At most two pieces hold a WebGL context at once.
- Vanilla Three.js. No react-three-fiber.

## "How this is made"

Every piece has a small switch. Brandon wants it because the readers are engineers.

- On: the piece shows how it is built. The same scene as clean wireframe with the lit surface fading through, plus a small readout of triangles, draw calls and frame time, in mono type.
- It is a view of the real thing, live, not a second model.
- It must look as considered as the rest of the site.

## Building a piece, in phases

Every piece goes through these phases in order. Each phase ends with shots, your verdict, and a critic round as `kit/07-QUALITY-BAR.md` describes. Do not start a phase until the one before it has passed.

1. **Research and plan.** Look at how the real thing is made and what makes it read as real. Write the plan in PROGRESS: parts list, the details that will sell it, the risks.
2. **Form.** Silhouette and proportions in plain clay. It must read from across the room.
3. **Detail.** Every part modelled to the level of the rules above.
4. **Materials.** Each material tuned alone and together.
5. **Light.** Key, fill, rim, the lamp, the water's light, shadows, the post chain.
6. **Life.** Entrance, rest motion, response to lamp and scroll, the making view.
7. **Fit.** In its page, at every tier, within the frame budget.

## 1 · The floating city (home, hero)

- A made up city of the future on a round floating disc. Brandon's reference: think Star Trek. Not New York, not a real place.
- The tallest building is a spire at the center. Around it: a few large, distinct towers, sky bridges, a forum, gardens and parks with trees and people, a transit ring with trains, landing pads, craft in the air.
- Traffic moves in different directions at once, like a living city. No road around the edge of the disc.
- Canals of the golden water cross the disc and pour off the rim. The fall at the front center is the start of the site's stream.
- Windows look like real rooms behind real glass: lit floors with their own moods, mullions, floor lines, depth.
- It builds itself in the opening. `kit/02-DESIGN.md` describes the opening and the settle.
- Reference: `kit/reference/hero-city/` holds the source of the prototype (`nova.ts`) and stills. Brandon: "a really good concept", and the water "does look good, though it will need to be greatly improved on the final version". He approved it on the condition that the finished animation is better than the preview. The prototype was pre-rendered frames. The site's city is live.

## 2 · The workbench (home skills section, skills page)

- A desk with what Brandon works with: a monitor, a keyboard and mouse, an iPad with a pencil, a camera with a spare lens, and a brass lamp. A leather mat. Walnut top with a brass inlay.
- One fixed light: the desk lamp plus the lit monitor. This was Brandon's favorite state of the prototype. No relighting on click.
- The objects are not labels for skills. See `kit/02-DESIGN.md`.
- Detail the prototype lacks and the piece must have: legends on the keys, ports and seams, stitching on the mat, real moving content on the screens, a believable mouse, wood grain that does not read as stripes.
- Life: a slow camera drift, screens that play, the lamp light answering the visitor's lamp. Objects may lift slightly and turn under the cursor, as play, with no meaning attached.
- The water lands on the front left corner, runs the front edge and pours off the front right corner. The desk shows it wet and reflects it.
- Reference: `kit/reference/workbench/` holds the prototype source (`bench.ts`) and stills. Brandon: "I really like the rough draft of the desk." It was agreed as a rough draft, and the record says the final must be much better and more polished.

## 3 · The brass handheld (games)

- A handheld game console made of brass, with real buttons, a D-pad, shoulder keys, a speaker grille, screws and a screen.
- The screen plays Brandon's game footage when there is footage in the content file, and a small original game loop made for this site when there is not.
- Buttons press when the footage would press them, or when the visitor does.
- Brandon approved this in place of an earlier game board idea.

## 4 · The camera (photography)

- A detailed camera with a lens whose glass looks deep: coated elements, an iris, reflections that move.
- The lamp shines through the lens. The shutter fires as the page opens, and the photographs arrive as if developed from it. Then the photographs have the stage.

## 5 · The rocket (home contact)

- A rocket on a pad with a gantry. It assembles in stages as the Contact section scrolls into view.
- It lifts off when the visitor reaches the end of the page: ignition, clamps release, a slow heavy climb, exhaust that lights the pad and the pool.
- It is a launch, not a flight through space. It never depends on a message being sent. There is no form.
- After liftoff the pad rests, lit by the pool. Scrolling back up and down again does not replay the launch in the same visit.

## 6 · The sculpture (3D art)

- An abstract sculpture that is half finished surface and half its own wireframe, turning slowly, the split moving with the lamp.
- It introduces the 3D art page. The page shows whatever work the content file lists and reads well with none.
- The page is visible in this build. `SHOW_3D_ART` hides it later. See `kit/01-PRODUCT.md`.

## The small views in "More rooms"

The home page doors to Games, Photography and 3D art each show a small live view of that room's piece: the same model at a low tier, at rest, lit by the lamp. The three doors are drawn by one shared renderer in one canvas, so together they count as one WebGL context. They render only while in view, and on the low and static tiers they are stills.
