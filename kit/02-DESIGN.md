# 02 · Design

The look is settled. Brandon picked it over several rounds of prototypes. The prototypes are in `kit/reference/` and they are the floor: the site must be clearly better than every one of them. Read `kit/07-QUALITY-BAR.md` before designing anything here.

## The idea in one line

A dark, warm room. Brass and bronze that are really lit. Golden water made of light running down the page. Detailed 3D pieces that each own a room.

## Tokens

They live once, in `src/styles/tokens.css`, and everything else reads them.

| Token | Value | Use |
|---|---|---|
| `--bg` | `#0c0a09` | page background. Never pure black |
| `--amber` | `#ff9d3c` | the water's color in the interface, live accents |
| `--accent` | `#d4a574` | labels, quiet brass tone in type |
| `--text` | `#f5f2ee` | main text. Never pure white |
| `--text-2` | `#cfc8c0` | body text |
| `--text-3` | `#a39a91` | small notes |
| `--line` | `rgba(212,165,116,.2)` | hairlines |

In 3D and in shaders the water amber is given as the sRGB hex `0xff9a38`. Typed as linear numbers it comes out peach. Bright amber goes white under ACES tone mapping, so 3D pieces use Neutral tone mapping.

## Type

- Display: Sora, light to medium weights, tight tracking (about -0.04em at large sizes).
- Body: Inter.
- Labels, facts and side notes: JetBrains Mono, small, in `--accent` or `--text-3`.
- Self host all three through their `@fontsource-variable` packages. Verify the package names at build time.
- Fluid sizes with `clamp()`. At 3840 wide nothing looks small and lost; at 390 wide nothing wraps badly.

## Metal

Everything that looks like metal is really lit, per pixel, from a height field. It is never a painted gradient. Brandon rejected the gradient version and approved the lit one. The working reference is `kit/reference/cards-and-water/second-pass.html`, and the photo window is in `kit/reference/third-pass/index.html`.

How the reference does it, as the starting point:

- A plate is a quad drawn by one shared WebGL context and copied to that plate's own canvas.
- The height field: the bevel from a rounded rectangle distance, engraving and inlay from a mask painted on a 2D canvas (red is cut in, green is filled with black enamel, blue is the second metal), screws and rivets worked out in the shader.
- Normals come from the height field. Highlights are GGX from a lamp at the cursor and from the water. A studio reflection slides across the plate as it moves through the viewport. Brushed grain and patina are noise.
- The real text of every plate also exists in the DOM for screen readers and search.

Four finishes, brass and bronze only. Brandon likes having all four for variety.

| Finish | What it is | Where |
|---|---|---|
| Aged brass with rivets | darker at the edges, double engraved border | his favorite. The featured plates on the home page and the most important plates elsewhere |
| Polished brass with slotted screws | engraved, enamel filled words | header bars, some placards |
| Dark bronze with brass inlay | the words are brass set flush | variety in lists of plates |
| Brushed brass frame, sunk bronze panel | letters stand proud in the panel | variety in lists of plates |

Words on a project plate: the name small, the reason he built it large, facts small along the bottom edge.

The photo window: a recess cut into the plate, a raised brass lip around it, the photo or video under glass at the bottom. The lamp that lights the brass casts the recess edge's shadow onto the picture and puts a soft glare on the glass. Brandon approved this: "the photos look great". Every project picture on a plate uses it.

The site must go past the reference: finer engraving at small sizes, deeper and truer shadows in the window, real reflections of nearby light, no visible pixel steps at any pixel ratio, and no cost that drops frames while scrolling.

## The lamp: light from the cursor

Brandon's rule: the light from the cursor interacts with all kinds of things on the site, shows that they are three dimensional, and looks beautiful.

- There is one lamp. Its position is the cursor, eased. Every lit thing reads the same lamp from one store.
- It lights: every metal surface, every header bar and placard, nav and buttons, the glass over photos and video, each 3D piece (as a real light in that scene), raised type and rules where they are metal, and the shadows under raised things, which fall away from it.
- It never makes text harder to read.
- With no cursor (touch), the lamp drifts slowly on its own and leans toward the last touch. The page must look just as alive on a phone.
- A thing that is lit also tilts or answers a little under the cursor where that feels natural. Small. A few degrees.

## The skills section and the workbench

- The workbench is the scene for skills. Brandon really likes it.
- It sits in one fixed light: the lamp on the desk plus the lit monitor. Clicking or pointing at a skill never relights the desk.
- **Do not tie skills to objects on the desk.** No labels, no leader lines, no "iPad and pencil" under Design. Brandon found that confusing and unnatural. The desk is the place. The skills stand on their own.
- Under the desk is the ledger: one wide row per skill area. Each row reads left to right: the name, a few honest sentences, the tools, and where he used them. Rows, not columns. Brandon scrapped the narrow columns because they could not hold enough and were hard to read.
- The reference `kit/reference/third-pass/index.html` still shows labels on the desk, and the name of a desk object (such as "iPad and pencil") under each row's heading. Both are wrong. Leave them out. The list of tools he uses inside each row is right and stays.

## Layout

- Wide rows and generous space. One idea per screen.
- The water never crosses text. Sections give it room, and the route goes around words.
- On a phone: one column, the water runs down the margins and crosses in the gaps.
- Tiers to design and check: phone 390 wide, tablet 834 wide, desktop 1440 and 1920 wide, 4K 3840 wide. `kit/07-QUALITY-BAR.md` lists the exact sizes for shots.

## Motion

- GSAP drives motion in the interface and in the 3D scenes.
- Things arrive with weight and settle. Nothing bounces like a toy. Nothing fades in for no reason.
- Scroll is the visitor's hand on the page. Motion tied to scroll must follow it both ways and never trap it.
- `prefers-reduced-motion`: the water is still and fully drawn, openings jump to their settled state, the lamp does not drift.

## The hero staging

- The opening uses the entire viewport. Nothing is cut off by the text area. Brandon called the old beginning "pretty wonky" because it was capped to the top of the screen.
- The new beginning: the screen starts dark. Light draws the city's plan on the ground. The disc lifts. The city rises. The water fills the canals and pours off the rim.
- Then the city flies down and settles low, and the headline arrives above it. Brandon's favorite part of the old opening was this ending. Keep its feel.
- At rest on a desktop at least 60 percent of the city shows above the bottom of the screen. The headline is not jammed against the top.
- The opening plays once per visit, can be skipped by any input, and never plays again on back navigation.
