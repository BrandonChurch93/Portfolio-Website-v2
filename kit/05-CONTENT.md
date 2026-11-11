# 05 · Content

## One file

All words and all lists the site shows live in `src/content/site.ts`, typed, and nowhere else. Components never hold copy. Brandon will rewrite the words in the review stage, and he must be able to do it by editing that one file.

The drafts below are written in the settled voice (`kit/01-PRODUCT.md`). Use them as they are. Do not polish them into marketing. Any text you have to add yourself (labels, alt text, small interface words) follows the same voice rules and goes in the same file.

## Where facts come from

1. `src/content/site.ts`, starting from the drafts in this file.
2. The old site, copied into `old-site/` by `scripts/import-old-site.mjs`: its pages, data files and images. Read its source for project names, descriptions, dates, client names, skills, links and the résumé.
3. Files Brandon dropped into `incoming/` before kickoff, if the folder exists. It is ignored by git. Never edit or delete anything in it.

When a fact is not in any of the three:

- Never invent it. Leave the line out, or write the sentence so it does not need the fact.
- Add a line under "Needed from Brandon" in the Handoff section of `kit/PROGRESS.md`: what is missing and where it goes.
- A missing fact is never a blocker.

When the old site and a draft here disagree on a fact (a date, a name, a tool), the old site wins. When they disagree on tone, this kit wins.

## Importing the old site

Brandon's current portfolio is on this Mac at `Desktop/development/production/Brandon Church portfolio`. The exact spelling of the folder may differ.

- Run `node scripts/import-old-site.mjs`. It finds the folder, copies its images, video, PDFs and readable source into `old-site/`, and writes `old-site/MANIFEST.json`. The script ships with the kit. It never changes the old folder.
- Never put a path outside this project on a command line. That prompts and stalls the run. The script holds the path logic. If the folder is somewhere else, the Partner writes the full path into `kit/old-site-path.txt` and the script uses that.
- If the script exits with code 2, the folder was not found. Log it, carry on with what the kit and `incoming/` provide, and list the missing assets in the Handoff.
- `old-site/` is ignored by git. Copy only the files the new site uses into `public/media/`, through the image pipeline in `kit/06-ARCHITECTURE.md`. Brandon asked for exactly this: take the current images from his portfolio and put them where the new site needs them.
- Look at every image you intend to use with the Read tool before using it. Use only images that are plainly his work or his projects. Skip anything that looks like a stock photo, a third party logo or a private document.
- Photography: use his photographs as one body of work. Do not sort them into categories that name a genre he has not named in the content file.

## Pictures and video

- Every featured project plate has a photo window. If a project has no usable image, that plate uses the plain layout with no window, and the project goes under "Needed from Brandon". Never show an empty window, a stock image or a made up screenshot.
- Project pages open with that project's best image or video under glass.
- Portrait for About: from the old site. If there is none, About is the letter alone.
- Video for a photo window: from the old site or `incoming/`. If there is none, the lab shot `metal/window-video` uses a short recording of this site made with Playwright, and the missing project video goes under "Needed from Brandon".
- Game footage for the handheld: from the old site or `incoming/`. If there is none, the handheld runs the small original loop described in `kit/04-PIECES.md`.

## The shape of the content file

```ts
export const site = {
  hero: { headline, sub, cue },
  work: { heading, sub, featured: Slug[], projects: Project[] },   // Project: slug, name, why, facts[], body[], media[], links[], year?
  clients: { bar, sub, items: Client[] },                           // Client: name, what, year?
  skills: { heading, sub, areas: SkillArea[] },                     // SkillArea: name, note, tools[], usedIn[]
  rooms: { heading, doors: Door[] },                                // Door: route, name, line
  games: { heading, sub, items[] }, photography: { heading, sub, sets[] }, art3d: { heading, sub, items[] },
  about: { heading, letter: string[], signature },
  contact: { heading, line, links: Link[] },                        // Link: label, href
  resume: { heading, file?, sections[] },
  notFound: { line, back },
  footer: { line },
} as const;
```

## Drafts

Brandon rewrites these at review. Until then they are the copy.

**Hero**
- Headline: I build things I want to exist.
- Sub: I'm Brandon. Equal parts designer and engineer. I like making things that help people, and I usually start because something looks fun to try.
- Cue: Follow the water

**Selected work**
- Heading: Things I built
- Sub: A few I'm proud of. Each one started with a reason.
- PC Builder · why: I wanted to build a gaming PC without buying one. · facts: Three.js · No AI at runtime
- Design System Extractor · why: I kept copying design systems out of websites by hand. So I made something that does it. · facts: Paste a link · Get tokens and components back
- Red Team Arena · why: Two AI models, one attacks and one defends. I wanted to watch. · facts: Live matches · A city in 3D
- Ask the Claude Docs · why: A chatbot that shows its sources and its test scores. I wanted to know how good one could get if you measure it. · facts: Retrieval · An eval harness
- Link: Everything else

**Client work**
- Bar: CLIENT WORK
- Sub: Work I did for other people.
- Items: from the old site. Name, what it was, and the year if the old site gives one.

**Skills**
- Heading: What I work with
- Sub: And what I use it for.
- Design · Most things start as a sketch. I work out the layout and the feel before any code exists.
- Engineering · Front end first. I like building the part people touch, and I care how it feels under the cursor.
- AI · I build with AI every day, and I build products on top of it. I read what the agents write.
- 3D and motion · The most fun you can have in a browser. It is the reason this site looks the way it does.
- Games · I make game art and small games because I enjoy it. It keeps my eye for detail sharp.
- Photography · Portraits, mostly. It taught me more about light than any tutorial did.
- Tools and "used in" for each area: from the old site and the résumé. List only tools found there.

**More rooms**
- Heading: More rooms
- Games: Small games and game art, made for fun.
- Photography: Portraits, mostly.
- 3D art: Models and scenes.

**About**
- Heading: About
- Letter:
  - I'm Brandon. I design software and I build it, and I like both halves of the job the same amount.
  - I want to work on things that matter. Tools that help people. Science. Anything that leaves the future a little better than it was.
  - Most of what is on this site started smaller than that. I saw something and wanted to know if I could make it.
  - Thanks for looking around.
- Signature: Brandon

**Contact**
- Heading: Find me
- Line: If you want to talk, these are the places.
- Links: only the public profile links found on the old site, such as GitHub and LinkedIn. An email address or phone number goes in only if the old site shows one publicly on its contact section.

**Resume**
- Heading: Resume
- The newest résumé PDF found in the old site, offered as a download, with its content also set as real text on the page. If there is no PDF, build the page from the old site's experience content and list the PDF under "Needed from Brandon".

**Not found**
- Line: This page is not here. The water still runs.
- Back: Back home

**Footer**
- Line: Everything on this site is code, including the city and the water.

## Checks

`npm run check:copy` must fail the build on: an em dash anywhere in `src/content/` or in rendered pages, an exclamation point in copy, pure `#000000` or `#ffffff` in styles, the banned words in `kit/01-PRODUCT.md`, and any model version string. Port it from `kit/starter/scripts/check-copy.mjs`.
