// Every word a visitor reads, and every list the site shows. Components hold no copy.
// Drafts come from kit/05-CONTENT.md. Facts come from Brandon's old site and résumé (kit/PROGRESS.md, Old site inventory).

export type Slug =
  | 'pc-builder'
  | 'design-system-extractor'
  | 'red-team-arena'
  | 'ask-the-claude-docs'
  | 'proactive-ui-for-ai-glasses'
  | 'generative-ui-github'
  | 'meridian'
  | 'hero-animation-builder'
  | 'modern-softworks'
  | 'micro-interactions-library';

export type MediaId = 'dse' | 'claude-docs' | 'glasses' | 'genui' | 'meridian' | 'animation-builder' | 'modern-softworks' | 'portrait';

export type Finish = 'aged' | 'polished' | 'bronze' | 'panel';

export interface Link {
  label: string;
  href: string;
}

export interface MediaRef {
  id: MediaId;
  alt: string;
}

export interface Project {
  slug: Slug;
  name: string;
  why: string;
  facts: string[];
  body: string[];
  stack: string[];
  media: MediaRef[];
  links: Link[];
  year?: string;
}

export interface Client {
  name: string;
  what: string;
  year?: string;
}

export interface SkillArea {
  name: string;
  note: string;
  tools: string[];
  usedIn: string[];
}

export interface Door {
  route: 'games' | 'photography' | 'art3d';
  name: string;
  line: string;
}

export interface ResumeRole {
  title: string;
  org: string;
  when: string;
  where?: string;
  summary?: string;
  points: string[];
}

export interface PageMeta {
  title: string;
  description: string;
}

const GITHUB = 'https://github.com/BrandonChurch93';

export const site = {
  meta: {
    home: { title: 'Designer and engineer', description: 'Brandon Church builds things he wants to exist. A floating city, brass plates and golden water, all made in code.' },
    work: { title: 'Work', description: 'Every project, each with the reason it was built.' },
    clients: { title: 'Client work', description: 'Work Brandon did for other people.' },
    games: { title: 'Games', description: 'Small games and game art, made for fun.' },
    photography: { title: 'Photography', description: 'Portraits, mostly.' },
    art3d: { title: '3D art', description: 'Models and scenes.' },
    skills: { title: 'Skills', description: 'What Brandon works with, and what he uses it for.' },
    about: { title: 'About', description: 'A short letter from Brandon.' },
    resume: { title: 'Resume', description: 'Brandon Church, résumé.' },
    notFound: { title: 'Not here', description: 'This page is not here. The water still runs.' },
    lab: { title: 'Lab', description: 'A test bench for one part of the site.' },
  } satisfies Record<string, PageMeta>,

  ui: {
    skip: 'Skip to content',
    navLabel: 'Main',
    nav: { work: 'Work', clients: 'Clients', skills: 'Skills', games: 'Games', photography: 'Photography', art3d: '3D art', about: 'About', resume: 'Resume' },
    home: 'Home',
    menuOpen: 'Menu',
    menuClose: 'Close',
    making: 'How this is made',
    makingOn: 'Showing how it is made',
    stats: { triangles: 'triangles', calls: 'draw calls', frame: 'ms a frame' },
    projectWhy: 'Why',
    projectStack: 'Built with',
    projectLinks: 'Links',
    projectNoLinks: 'No public link yet.',
    allWork: 'All work',
    nextProject: 'Next',
    prevProject: 'Previous',
    resumeDownload: 'Download the PDF',
    toolsLabel: 'Tools',
    usedInLabel: 'Used in',
    openRoom: 'Open',
    externalHint: 'opens in a new tab',
  },

  hero: {
    headline: 'I build things I want to exist.',
    sub: "I'm Brandon. Equal parts designer and engineer. I like making things that help people, and I usually start because something looks fun to try.",
    cue: 'Follow the water',
    cityAlt: 'A floating round city of the future, with a central spire, towers, parks and canals of golden water pouring off its rim.',
  },

  work: {
    heading: 'Things I built',
    sub: "A few I'm proud of. Each one started with a reason.",
    pageHeading: 'Everything I built',
    pageSub: 'Each one started with a reason. Some of them are live.',
    featured: ['pc-builder', 'design-system-extractor', 'red-team-arena', 'ask-the-claude-docs'] satisfies Slug[],
    finishes: { 'pc-builder': 'aged', 'design-system-extractor': 'bronze', 'red-team-arena': 'panel', 'ask-the-claude-docs': 'aged' } satisfies Partial<Record<Slug, Finish>>,
    link: 'Everything else',
    projects: [
      {
        slug: 'pc-builder',
        name: 'PC Builder',
        why: 'I wanted to build a gaming PC without buying one.',
        facts: ['Three.js', 'No AI at runtime'],
        body: [],
        stack: ['Three.js'],
        media: [],
        links: [],
      },
      {
        slug: 'design-system-extractor',
        name: 'Design System Extractor',
        why: 'I kept copying design systems out of websites by hand. So I made something that does it.',
        facts: ['Paste a link', 'Get tokens and components back'],
        body: [
          'Paste a URL and a crawler visits the pages that matter, captures every component in every state it can reach, clusters the raw values into tokens, runs five measured checks per component and reports where the system is drifting.',
          'Reading stylesheets is not enough, so it watches the page. It walks the real Tab order for focus, holds the mouse down for active states and reads motion from the running page, GSAP included. Values cluster into tokens in OKLCH, and components group by structure, not by selectors.',
          'Every preview is rebuilt as clean HTML and CSS and compared pixel by pixel with the real page before it shows live. Real sites fought back. One took 773 seconds against a six minute limit at first, and live previews started near 30 percent. Four measured rounds of fixes brought them to between 72 and 83 percent.',
          'The model only names and narrates. Every call has a fallback that needs no model, and every number in a narrative is checked against the facts. A typical run costs under a cent in model spend.',
          'It exports to CSS, JSON, Tailwind and W3C tokens, and it ships an MCP server with seven tools and a CLI. Claude Code built it from a kit I planned, across nineteen gated phases and 112 logged decisions.',
        ],
        stack: ['Next.js', 'React', 'TypeScript', 'Playwright', 'BullMQ', 'Redis', 'PostgreSQL', 'Drizzle', 'Anthropic API', 'Model Context Protocol', 'Stripe'],
        media: [{ id: 'dse', alt: 'A Design System Extractor run showing a live site with its extracted palette, stats and components' }],
        links: [{ label: 'Code', href: `${GITHUB}/design-system-extractor` }],
      },
      {
        slug: 'red-team-arena',
        name: 'Red Team Arena',
        why: 'Two AI models, one attacks and one defends. I wanted to watch.',
        facts: ['Live matches', 'A city in 3D'],
        body: [],
        stack: [],
        media: [],
        links: [],
      },
      {
        slug: 'ask-the-claude-docs',
        name: 'Ask the Claude Docs',
        why: 'A chatbot that shows its sources and its test scores. I wanted to know how good one could get if you measure it.',
        facts: ['Retrieval', 'An eval harness'],
        body: [
          'A retrieval chatbot over the live Claude Code documentation. Every answer cites the exact passage it came from. When nothing clears a calibrated confidence line, it declines instead of guessing, and shows its receipts.',
          'A nightly GitHub Action pulls in the docs, chunks them along their headings and embeds only what changed. An unchanged set re-syncs in 26 seconds with zero embedding calls. Answers stream with the sources first, and every receipt prints the real cost.',
          'The refusal gate is set from measured score distributions and refuses before the model is ever called. A public evals page shows retrieval accuracy, judged answer quality with a noise margin and the refusal tests, all re-run in CI so a regression cannot merge.',
          'Claude Code built it from twelve specification documents I wrote, under a three tier decision authority that sent ten real engineering conflicts to me for a ruling.',
        ],
        stack: ['Next.js', 'React', 'TypeScript', 'PostgreSQL and pgvector', 'Anthropic API', 'OpenAI embeddings', 'Upstash Redis', 'GitHub Actions', 'Playwright'],
        media: [{ id: 'claude-docs', alt: 'The Ask the Claude Docs type specimen: an answer set in a serif with a cited passage, and a question set in a sans' }],
        links: [
          { label: 'Live', href: 'https://ask-the-claude-docs.vercel.app' },
          { label: 'Evals', href: 'https://ask-the-claude-docs.vercel.app/evals' },
          { label: 'Code', href: `${GITHUB}/Ask-the-Claude-Docs` },
        ],
      },
      {
        slug: 'proactive-ui-for-ai-glasses',
        name: 'Proactive UI for AI Glasses',
        why: 'An assistant on a screen waits to be asked. Glasses have to decide when to speak at all. This is a study of that decision.',
        facts: ['Thirteen walking rules', 'No model calls', 'The same decisions every run'],
        body: [
          'One looping city block renders in real time in Three.js. The wearer walks it on rails and looks where they like, with a viewfinder standing in for eye tracking.',
          'Ten times a second a rules engine reads the walk: pace, gaze, the crossing and its signal, nearby cars and people, messages and the goal. It returns decisions, each with a level, a timing, a placement and a reason. In a crossing the glass steps back and only the safety text shows.',
          'The brain is a rules policy, not a model, and the simulation is seeded, so the same inputs make the same decisions every run. An inspector replays every decision with its reason, and an eval suite runs two recorded walks and 41 focused cases through the engine.',
          'Claude Code built it from a written spec across 31 gated phases. I played each build before the next one was written.',
        ],
        stack: ['Three.js', 'WebGL', 'TypeScript', 'GSAP', 'CSS Modules', 'Vite', 'Vitest', 'Playwright'],
        media: [{ id: 'glasses', alt: 'The view through the glasses on a city street: a card for the Grace Theater pinned at its storefront, with a label for Trattoria da Lia beside it' }],
        links: [
          { label: 'Live', href: 'https://proactive-ui-for-ai-glasses.vercel.app' },
          { label: 'Code', href: `${GITHUB}/Proactive-UI-for-AI-Glasses` },
        ],
      },
      {
        slug: 'generative-ui-github',
        name: 'Generative UI · GitHub',
        why: 'Most generative interface demos let a model write the page. In this one the model picks the pieces and the code decides how they look.',
        facts: ['41 components', 'Five states each', 'Public evals'],
        body: [
          'Paste a public GitHub repo and ask it a question. A model sorts the question, picks from a hand built catalog of 41 components, and the screen streams in. Click any card, row or chart point and the screen rewrites itself around it.',
          'The model writes a small JSON description against a Zod registry and never touches HTML, CSS or a pixel value. A fast model fills one of fifteen layout templates, and a larger one composes only when no template fits, which keeps a typical answer around a fifth of a cent.',
          'Any number the model writes into a sentence or a chart is checked against the data it cites. A mismatch is replaced by a sentence the system writes, never rendered as is.',
          'The eval harness runs 99 cases three times each on three model setups and publishes everything, the failures included.',
        ],
        stack: ['Next.js', 'React', 'TypeScript', 'CSS Modules', 'Motion', 'GSAP', 'Zod', 'Anthropic API', 'GitHub GraphQL and REST', 'Upstash Redis', 'Playwright'],
        media: [{ id: 'genui', alt: 'A composed answer about a GitHub repo: open pull requests, pull requests awaiting review, failing checks, a review queue and a CI duration chart' }],
        links: [
          { label: 'Live', href: 'https://generative-ui-github.vercel.app' },
          { label: 'Evals', href: 'https://generative-ui-github.vercel.app/evals' },
          { label: 'Code', href: `${GITHUB}/generative-ui-github` },
        ],
      },
      {
        slug: 'meridian',
        name: 'Meridian · Calibre 01',
        why: 'A working watch movement, built entirely in code. Every gear turns on real tooth counts.',
        facts: ['No imported models', '60 to 1 gear train', 'Wind it yourself'],
        body: [
          'A browser 3D specimen of an invented hand wound tourbillon. Nothing is imported. Every gear, jewel and texture, and the clockwork moth that lives on the bench, is generated in code.',
          'It is a kinematic model, not an animation. The escapement, the tourbillon and the gear train all follow one integer beat counter at 8 beats a second, solved backward from the cage by real tooth counts.',
          'Visitors can wind it, take it apart, tour it part by part and watch it run down. A re-plating wave sweeps a new finish across the movement, and day turns to night through a dissolve.',
          'I wrote fifteen specification documents with a 41 item acceptance list. Perplexity Computer built it across twelve gated phases, and then I took it into Claude Code and added 23 scripted camera takes so the page can film itself.',
        ],
        stack: ['Three.js', 'GSAP', 'JavaScript modules', 'GLSL shaders', 'Perplexity Computer', 'Claude Code'],
        media: [{ id: 'meridian', alt: 'The Meridian watch movement on a warm paper backdrop, its gears, jewels and tourbillon cage visible through the open dial' }],
        links: [{ label: 'Live', href: 'https://meridian-calibre.vercel.app/' }],
      },
      {
        slug: 'hero-animation-builder',
        name: 'Hero Animation Builder',
        why: 'Design a hero animation, then watch it ship itself on a site.',
        facts: ['36 live controls', 'Five glow layers', 'No animation library'],
        body: [
          'A builder for SVG arc animations: tune the line, five independent glow layers, an entrance draw and a breathing loop through 36 live controls, then see the design on a made up fintech site.',
          'The arc is built once as SVG and after that only its attributes change, which is why every slider answers at once.',
          'The whole design travels in the URL, so every version can be shared with no storage anywhere. Text color against any accent is picked by an inline APCA contrast check.',
        ],
        stack: ['Next.js', 'React', 'TypeScript', 'SVG', 'CSS 3D transforms'],
        media: [{ id: 'animation-builder', alt: 'The Hero Animation Builder: a glowing violet arc under a headline, with the control panel of presets and sliders on the right' }],
        links: [
          { label: 'Live', href: 'https://hero-animation-builder.vercel.app' },
          { label: 'Code', href: `${GITHUB}/HeroAnimationBuilder` },
        ],
      },
      {
        slug: 'modern-softworks',
        name: 'Modern Softworks',
        why: 'The site for my studio. I built its design system from scratch, with no framework under it.',
        facts: ['48 components', '22 pages', 'Accessibility checked on every build'],
        body: [
          'The site for my development studio, Modern Softworks: service pages, case studies, a blog and guides.',
          'The design system is hand built on CSS custom properties. No Tailwind, no interface framework. 48 components, a color system, a type scale and spacing tokens.',
          'Lighthouse CI fails the build if accessibility or SEO drops below 90.',
        ],
        stack: ['Next.js', 'React', 'TypeScript', 'GSAP', 'MDX'],
        media: [{ id: 'modern-softworks', alt: 'The Modern Softworks wordmark and its green hexagon mark on a dark grid' }],
        links: [{ label: 'Live', href: 'https://www.modernsoftworks.com' }],
      },
      {
        slug: 'micro-interactions-library',
        name: 'Micro-Interactions Library',
        why: 'Fifteen small interactions to copy and paste, with no animation library behind them.',
        facts: ['15 components', 'No animation libraries', '6 dependencies'],
        body: [
          'Every animation runs on CSS transitions or the Web Animations API. The code you copy is the code you just watched run.',
          'It respects reduced motion everywhere and is built on accessible components. The whole site is static, with six production dependencies.',
        ],
        stack: ['Next.js', 'TypeScript', 'CSS Modules', 'Web Animations API', 'React Aria'],
        media: [],
        links: [
          { label: 'Live', href: 'https://micro-interactions-library.vercel.app/' },
          { label: 'Code', href: `${GITHUB}/micro-interactions-library` },
        ],
      },
    ] satisfies Project[],
  },

  clients: {
    bar: 'CLIENT WORK',
    sub: 'Work I did for other people.',
    pageSub: 'Work I did for other people, as a studio, a contractor and a lead.',
    items: [
      { name: 'Property Claim Consulting', what: 'An insurance platform as sole developer: a claims tool for public adjusters, a rental marketplace for displaced homeowners and a certification course.' },
      { name: 'USAID aid logistics', what: 'The whole user facing product for a humanitarian aid platform tracking $43B in goods a year across 40+ warehouses, through Leidit.', year: '2023 to 2026' },
      { name: 'Genius AI', what: 'An AI mortgage CRM and its marketing site, as VP of Product. The application funnel went from 40 screens to 15.', year: '2026' },
      { name: 'Jobvite', what: '20+ career portals for Fortune 500 clients, among them Dell, Wells Fargo, Bank of America, John Deere and Lowe’s.', year: '2022 to 2023' },
      { name: 'G2i', what: 'Rubric based evaluation of 300+ agentic coding outputs, then QA reviewer for the other evaluators.', year: '2026' },
      { name: 'Small businesses', what: '12+ marketing sites and platforms through Modern Softworks, wired to payment, CRM and marketing tools.', year: '2020 to 2026' },
      { name: 'Federal and enterprise teams', what: 'Section 508 and WCAG 2.2 audits and fixes, tested by hand with screen readers.' },
    ] satisfies Client[],
  },

  skills: {
    heading: 'What I work with',
    sub: 'And what I use it for.',
    deskAlt: 'A walnut desk at night under a brass lamp: a monitor showing code, a keyboard, a mouse, a tablet with a pencil and a camera with a spare lens.',
    areas: [
      {
        name: 'Design',
        note: 'Most things start as a sketch. I work out the layout and the feel before any code exists.',
        tools: ['Figma', 'Design systems', 'Design tokens', 'Prototyping in code', 'Information architecture', 'User research', 'Motion design'],
        usedIn: ['Design System Extractor', 'Generative UI · GitHub', 'Modern Softworks'],
      },
      {
        name: 'Engineering',
        note: 'Front end first. I like building the part people touch, and I care how it feels under the cursor.',
        tools: ['React', 'Next.js', 'Angular', 'TypeScript', 'Node.js', 'Python', 'PostgreSQL', 'Playwright', 'Vitest'],
        usedIn: ['Ask the Claude Docs', 'Design System Extractor', 'Micro-Interactions Library'],
      },
      {
        name: 'AI',
        note: 'I build with AI every day, and I build products on top of it. I read what the agents write.',
        tools: ['Claude Code', 'Claude API', 'MCP', 'Retrieval', 'Eval harnesses', 'LLM as judge', 'Multi model orchestration'],
        usedIn: ['Ask the Claude Docs', 'Proactive UI for AI Glasses', 'Generative UI · GitHub'],
      },
      {
        name: '3D and motion',
        note: 'The most fun you can have in a browser. It is the reason this site looks the way it does.',
        tools: ['Three.js', 'WebGL', 'GLSL shaders', 'GSAP'],
        usedIn: ['Meridian · Calibre 01', 'Proactive UI for AI Glasses', 'Hero Animation Builder', 'This site'],
      },
      {
        name: 'Games',
        note: 'I make game art and small games because I enjoy it. It keeps my eye for detail sharp.',
        tools: ['C#', 'Game development', 'VR'],
        usedIn: ['The games room'],
      },
      {
        name: 'Photography',
        note: 'Portraits, mostly. It taught me more about light than any tutorial did.',
        tools: [],
        usedIn: ['The photography room'],
      },
    ] satisfies SkillArea[],
  },

  rooms: {
    heading: 'More rooms',
    doors: [
      { route: 'games', name: 'Games', line: 'Small games and game art, made for fun.' },
      { route: 'photography', name: 'Photography', line: 'Portraits, mostly.' },
      { route: 'art3d', name: '3D art', line: 'Models and scenes.' },
    ] satisfies Door[],
  },

  games: {
    heading: 'Games',
    sub: 'Small games and game art, made for fun.',
    note: 'The handheld is playing a small loop made for this site.',
    pieceAlt: 'A brass handheld game console with a D-pad, buttons, shoulder keys and a lit screen.',
    items: [] as { name: string; line: string }[],
  },

  photography: {
    heading: 'Photography',
    sub: 'Portraits, mostly.',
    note: 'The camera is the only thing in this room for now.',
    pieceAlt: 'A camera with a deep lens, its coated glass catching the light.',
    sets: [] as { name: string; photos: MediaRef[] }[],
  },

  art3d: {
    heading: '3D art',
    sub: 'Models and scenes.',
    note: 'Every 3D piece on this site is made in code. Each one has a switch that shows how.',
    pieceAlt: 'An abstract sculpture, half finished surface and half its own wireframe.',
    items: [] as { name: string; line: string }[],
  },

  about: {
    heading: 'About',
    letter: [
      "I'm Brandon. I design software and I build it, and I like both halves of the job the same amount.",
      'I want to work on things that matter. Tools that help people. Science. Anything that leaves the future a little better than it was.',
      'Most of what is on this site started smaller than that. I saw something and wanted to know if I could make it.',
      'Thanks for looking around.',
    ],
    signature: 'Brandon',
    portrait: { id: 'portrait', alt: 'Brandon Church in warm amber light, looking off to the side' } satisfies MediaRef,
  },

  contact: {
    heading: 'Find me',
    line: 'If you want to talk, these are the places.',
    links: [
      { label: 'GitHub', href: GITHUB },
      { label: 'LinkedIn', href: 'https://www.linkedin.com/in/brandon-church-ms' },
      { label: 'CodePen', href: 'https://codepen.io/BrandonLeoChurch' },
      { label: 'YouTube', href: 'https://youtube.com/@BrandonChurch' },
      { label: 'Email', href: 'mailto:brandonleochurch@gmail.com' },
    ] satisfies Link[],
    rocketAlt: 'A rocket on a launch pad with a gantry, over a shallow pool of golden water.',
  },

  resume: {
    heading: 'Resume',
    file: '/media/brandon-church-resume.pdf',
    name: 'Brandon Church',
    titles: 'AI Product Engineer · Senior Frontend Engineer · Forward Deployed Engineer · AI Product Manager',
    place: 'Boise, ID · Remote or relocate · Public Trust clearance',
    summary:
      "I'm a product engineer and leader who takes software from problem to production: deciding what to build with clients and stakeholders, designing it in Figma, building and testing it across the stack, and iterating on real user feedback. I've done that for twelve years for federal contractors, Fortune 500 clients and startups, and spent three of them as a Director building and leading the engineering teams that shipped it. Accessibility is a deep specialty. I work AI natively with Claude Code and MCP, evaluate frontier models, and ship LLM features with real eval harnesses behind them.",
    experienceHeading: 'Experience',
    roles: [
      {
        title: 'Founder and Principal AI Product Engineer',
        org: 'Modern Softworks',
        when: 'Sep 2020 to Aug 2026',
        where: 'Remote',
        summary: 'Founded a digital marketing and software studio for startups and small businesses, then turned it into an accessibility first engineering studio for federal and enterprise clients in 2024. I owned every project end to end, from user research and Figma design through the build in Angular or React, TypeScript and Node.js.',
        points: [
          "Designed and built Property Claim Consulting's insurance platform as sole developer: three connected apps on React and Node with a shared REST API, integrating satellite imagery, a 3D walkthrough and Stripe.",
          'Shipped 12+ marketing sites and platforms for small businesses, many for repeat clients, every site at 95+ Lighthouse.',
          'Delivered Section 508 and WCAG 2.2 audits and remediation for federal and enterprise clients, tested by hand with JAWS, NVDA and VoiceOver plus axe, with conformance documentation including VPATs.',
          'Ran every part of the business. After 18 months solo, hired and led five developers plus contractors as technical and design lead.',
        ],
      },
      {
        title: 'AI Evaluation Engineer and QA Reviewer (contract)',
        org: 'G2i',
        when: 'Apr 2026 to Jul 2026',
        where: 'Remote',
        summary: 'Three consecutive engagements scoring a coding agent’s work against detailed rubrics, so that human judgment fed directly into how the model was trained.',
        points: [
          'Evaluated 300+ agentic coding outputs across TypeScript, React, Python and Go for correctness, code quality, instruction following, reasoning and honest task completion.',
          'Recognized as a top evaluator, then asked to onboard and train new evaluators, and promoted to QA reviewer, auditing 100+ submissions.',
        ],
      },
      {
        title: 'VP of Product and AI Product Engineer (contract)',
        org: 'Genius AI',
        when: 'Feb 2026 to Apr 2026',
        where: 'Boise, ID',
        summary: 'Took over an AI powered mortgage CRM and its marketing site that had stalled, and made them ready to show investors. Owned strategy and roadmap across four applications and directed a team of six.',
        points: [
          'Redesigned the borrower application funnel: consolidated 40 screens to 15 and raised completion roughly 4x.',
          "Created the design system from scratch, shipped a Next.js marketing site with GSAP and Three.js motion, and rebuilt the CRM's components on it.",
          'Built CI quality gates, including a fixed prompt suite scored by an LLM judge, and brought the platform to WCAG 2.2.',
        ],
      },
      {
        title: 'Director of Frontend Engineering and Accessibility',
        org: 'Leidit, LLC',
        when: 'Feb 2023 to Feb 2026',
        where: 'Remote',
        summary: "Product, frontend and accessibility lead at a 30+ person federal contractor, reporting to the CEO. The company's only Section 508 specialist.",
        points: [
          'Owned the entire user facing product for a USAID humanitarian aid logistics platform tracking $43B in goods a year across 40+ international warehouses, from requirements and personas to every screen in Figma and the full Angular frontend. MVP in 6 months, full release in 12, with users trained in person in Dubai and Djibouti.',
          'Took over a federal contract two weeks before launch after an audit found 4,500+ accessibility violations, fixed every one and launched on the original date.',
          'Built an accessible frontend framework and component library inside ServiceNow that every later application used. The next comparable app took under 2 months instead of 6.',
          'Hired the UI and UX engineering team, managed three engineers directly and set the frontend and accessibility standards for every project.',
        ],
      },
      {
        title: 'Senior Product Engineer',
        org: 'Jobvite',
        when: 'Jan 2022 to Feb 2023',
        where: 'Remote',
        points: [
          "Owned each Fortune 500 client relationship on Jobvite's career portal team, from requirements and Figma design to the React build and deployment. Shipped 20+ career portals for Dell, Wells Fargo, Bank of America, John Deere, Lowe's and Taco Bell, every portal at 95+ PageSpeed and WCAG 2.1 AA.",
        ],
      },
    ] satisfies ResumeRole[],
    earlierHeading: 'Earlier',
    earlier: [
      { title: 'Full Stack Software Engineer', org: 'Rural Sourcing', when: '2020 to 2022' },
      { title: 'Frontend Developer', org: 'Hewlett Packard Enterprise', when: '2018 to 2020' },
      { title: 'Software Engineer', org: 'MAP Academy', when: '2016 to 2018' },
    ],
    skillsHeading: 'Skills',
    skills: [
      { name: 'Frontend', items: 'React, Angular, React Native, TypeScript, JavaScript, HTML, CSS, Next.js, Tailwind CSS, Storybook, design tokens, component libraries, Core Web Vitals, GSAP, Framer Motion, Three.js, micro frontends' },
      { name: 'Design and UX', items: 'Figma, Claude Design, prototyping in code, design systems, UI and UX design, user flows, interaction design, information architecture, user research, usability testing, brand identity' },
      { name: 'AI engineering', items: 'Claude Code, Claude API, OpenAI API, Amazon Bedrock, AI agents, multi model orchestration, RAG, Model Context Protocol, prompt engineering, LLM evaluation, eval harnesses, LLM as judge, guardrails' },
      { name: 'Product and leadership', items: 'Product strategy, roadmaps, user stories, PRDs, sprint planning, UAT, KPIs, A/B testing, go to market, stakeholder management, cross functional leadership, hiring and mentorship, Jira' },
      { name: 'Accessibility', items: 'WCAG 2.2, Section 508, ARIA, screen reader testing with JAWS, NVDA and VoiceOver, axe, auditing and remediation, VPAT' },
      { name: 'Backend and infrastructure', items: 'Node.js, Express, Python, FastAPI, REST, GraphQL, PostgreSQL, Supabase, Firebase, Redis, Stripe, OAuth and JWT, Vercel, AWS, Docker, GitHub Actions, CI/CD, Playwright, Vitest' },
    ],
    educationHeading: 'Education',
    education: 'Associate of Science, Computer Programming · Augusta Technical College · Augusta, GA',
  },

  notFound: {
    line: 'This page is not here. The water still runs.',
    back: 'Back home',
  },

  footer: {
    line: 'Everything on this site is code, including the city and the water.',
  },

  lab: {
    metal: 'Metal',
    water: 'Water',
    piece: 'Piece',
    sample: {
      label: '01 · PC BUILDER',
      big: 'I wanted to build a gaming PC without buying one.',
      facts: 'THREE.JS · NO AI AT RUNTIME',
      placardLabel: 'GENIUS AI',
      placardBig: 'Mortgage CRM',
      placardFacts: '2026',
      bar: 'CLIENT WORK',
      windowLabel: '07 · MERIDIAN · CALIBRE 01',
      windowFacts: 'NO IMPORTED MODELS · 60 TO 1 GEAR TRAIN',
      videoLabel: 'THIS SITE',
      videoFacts: 'RECORDED IN A BROWSER',
    },
  },
} as const;

export type Site = typeof site;
export const projects: readonly Project[] = site.work.projects;
export const projectBySlug = (slug: string): Project | undefined => projects.find((p) => p.slug === slug);
