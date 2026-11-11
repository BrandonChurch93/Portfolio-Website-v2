// Written by scripts/media.mjs. Do not edit by hand.

export interface MediaEntry {
  w: number;
  h: number;
  tone: string;
  srcs: { w: number; h: number; src: string }[];
}

export const MEDIA = {
  "dse": {
    "w": 2400,
    "h": 1350,
    "tone": "rgb(232, 232, 232)",
    "srcs": [
      {
        "w": 480,
        "h": 270,
        "src": "/media/dse-480.webp"
      },
      {
        "w": 960,
        "h": 540,
        "src": "/media/dse-960.webp"
      },
      {
        "w": 1600,
        "h": 900,
        "src": "/media/dse-1600.webp"
      },
      {
        "w": 2400,
        "h": 1350,
        "src": "/media/dse-2400.webp"
      }
    ]
  },
  "claude-docs": {
    "w": 3198,
    "h": 1288,
    "tone": "rgb(248, 248, 232)",
    "srcs": [
      {
        "w": 480,
        "h": 193,
        "src": "/media/claude-docs-480.webp"
      },
      {
        "w": 960,
        "h": 387,
        "src": "/media/claude-docs-960.webp"
      },
      {
        "w": 1600,
        "h": 644,
        "src": "/media/claude-docs-1600.webp"
      },
      {
        "w": 2400,
        "h": 967,
        "src": "/media/claude-docs-2400.webp"
      }
    ]
  },
  "glasses": {
    "w": 1688,
    "h": 780,
    "tone": "rgb(40, 56, 72)",
    "srcs": [
      {
        "w": 480,
        "h": 222,
        "src": "/media/glasses-480.webp"
      },
      {
        "w": 960,
        "h": 444,
        "src": "/media/glasses-960.webp"
      },
      {
        "w": 1600,
        "h": 739,
        "src": "/media/glasses-1600.webp"
      },
      {
        "w": 1688,
        "h": 780,
        "src": "/media/glasses-1688.webp"
      }
    ]
  },
  "genui": {
    "w": 2400,
    "h": 1600,
    "tone": "rgb(248, 248, 248)",
    "srcs": [
      {
        "w": 480,
        "h": 320,
        "src": "/media/genui-480.webp"
      },
      {
        "w": 960,
        "h": 640,
        "src": "/media/genui-960.webp"
      },
      {
        "w": 1600,
        "h": 1067,
        "src": "/media/genui-1600.webp"
      },
      {
        "w": 2400,
        "h": 1600,
        "src": "/media/genui-2400.webp"
      }
    ]
  },
  "meridian": {
    "w": 2400,
    "h": 1350,
    "tone": "rgb(216, 200, 168)",
    "srcs": [
      {
        "w": 480,
        "h": 270,
        "src": "/media/meridian-480.webp"
      },
      {
        "w": 960,
        "h": 540,
        "src": "/media/meridian-960.webp"
      },
      {
        "w": 1600,
        "h": 900,
        "src": "/media/meridian-1600.webp"
      },
      {
        "w": 2400,
        "h": 1350,
        "src": "/media/meridian-2400.webp"
      }
    ]
  },
  "animation-builder": {
    "w": 2750,
    "h": 1665,
    "tone": "rgb(8, 8, 8)",
    "srcs": [
      {
        "w": 480,
        "h": 291,
        "src": "/media/animation-builder-480.webp"
      },
      {
        "w": 960,
        "h": 581,
        "src": "/media/animation-builder-960.webp"
      },
      {
        "w": 1600,
        "h": 969,
        "src": "/media/animation-builder-1600.webp"
      },
      {
        "w": 2400,
        "h": 1453,
        "src": "/media/animation-builder-2400.webp"
      }
    ]
  },
  "modern-softworks": {
    "w": 2400,
    "h": 1600,
    "tone": "rgb(24, 24, 24)",
    "srcs": [
      {
        "w": 480,
        "h": 320,
        "src": "/media/modern-softworks-480.webp"
      },
      {
        "w": 960,
        "h": 640,
        "src": "/media/modern-softworks-960.webp"
      },
      {
        "w": 1600,
        "h": 1067,
        "src": "/media/modern-softworks-1600.webp"
      },
      {
        "w": 2400,
        "h": 1600,
        "src": "/media/modern-softworks-2400.webp"
      }
    ]
  },
  "portrait": {
    "w": 2048,
    "h": 1986,
    "tone": "rgb(8, 8, 8)",
    "srcs": [
      {
        "w": 480,
        "h": 465,
        "src": "/media/portrait-480.webp"
      },
      {
        "w": 960,
        "h": 931,
        "src": "/media/portrait-960.webp"
      },
      {
        "w": 1600,
        "h": 1552,
        "src": "/media/portrait-1600.webp"
      },
      {
        "w": 2048,
        "h": 1986,
        "src": "/media/portrait-2048.webp"
      }
    ]
  }
} as const satisfies Record<string, MediaEntry>;
