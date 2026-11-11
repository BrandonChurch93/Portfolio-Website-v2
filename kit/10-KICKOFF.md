# 10 · Kickoff

This file is for Brandon. The Builder reads it only for the line below.

REPO_URL: NONE

Replace `NONE` with the address of the new empty GitHub repository, for example `https://github.com/BrandonChurch93/<name>.git`. With `NONE` the Builder commits on this Mac and does not push.

## Before you start

1. Create a new empty repository on GitHub. No README, no license, no .gitignore.
2. Put its address on the `REPO_URL` line above.
3. Optional: drop any project screenshots, screen recordings, a portrait, game footage or your résumé PDF into a folder named `incoming` inside this project. Name project files after the project. The Builder also copies what it needs from your current portfolio folder by itself.

## Start the build

1. Unzip into Development, In Progress.
2. Open the unzipped folder in VS Code.
3. In VS Code's integrated terminal (Terminal menu, New Terminal), paste this and leave it running so the Mac stays awake:

```
caffeinate -d
```

4. Open the Claude Code panel. If it asks whether you trust this folder, say yes. The build's permissions only work once the folder is trusted. If macOS asks whether VS Code may access the Desktop folder, allow it, so the Builder can copy pictures from your current portfolio.
5. Type `/model opus` and set effort to high.
6. Paste the kickoff prompt:

```
BUILD MODE. Read kit/00-README.md and build the whole site from the kit. Work every phase in kit/08-BUILD-ORDER.md in order, verify every gate, log everything in kit/PROGRESS.md, and stop only at BUILD COMPLETE.
```

7. Walk away.

## If it stops

Open the Claude Code panel in the same folder and paste:

```
BUILD MODE. Continue from kit/PROGRESS.md.
```

If the first line of `kit/PROGRESS.md` starts with `BLOCKED`, it says what is wrong.

## While it runs

- It never asks questions. It decides, and writes each decision in `kit/PROGRESS.md`.
- It pushes to your repository after every phase, so you can watch the commits from your phone.
- Screenshots collect in the `shots` folder on this Mac. They are how its work is checked. They are not pushed.

## When it says BUILD COMPLETE

1. In a new integrated terminal in VS Code, paste `npm run dev`, then open `http://127.0.0.1:5320`.
2. Read the Handoff at the end of `kit/PROGRESS.md`. It lists what to review and what it still needs from you.
3. In the Claude Code panel, type `/partner` to start the review. The Partner takes what you dislike and writes the fixes or the next plan for the Builder.

## What this build does not do

- It does not deploy. Deployment comes after the review and the second plan.
- It does not hide the 3D art page. That is one switch, `SHOW_3D_ART`, flipped right before deployment.
- It costs nothing beyond your Claude plan. There are no API keys and no paid services.
