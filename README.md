# Jettagrove Site

Canonical local project folder:

`/Users/mbaggetta/my-project/jettagrove-site`

Canonical GitHub repo:

`https://github.com/immeasurablematt/jettagrove-site`

Production Vercel project:

`jettagrove` (`prj_J5zMMbQWuBka5fnijRQtMxrmATmq`)

Production domains:

- `https://www.jettagrove.com`
- `https://jettagrove.com`

## Current Structure

- `index.html` - page markup
- `assets/css/styles.css` - site styles
- `assets/js/main.js` - page behavior and charts
- `assets/images/` - local image assets
- `assets/docs/` - local PDF portfolio assets
- `assets/vendor/chart.umd.min.js` - local Chart.js vendor file

## Local Check

From this folder:

```sh
python3 -m http.server 4173 --bind 127.0.0.1
```

Then open:

`http://127.0.0.1:4173/`

Before deploying, verify:

- The homepage loads.
- The top navigation scrolls to Results, Work, Story, and Contact.
- The dark-mode button works on desktop and mobile.
- The mobile menu opens and closes.
- The charts render.
- Local images and PDF links load.

## Vercel Notes

This folder is locally linked to the Vercel project through `.vercel/project.json`.
That file is intentionally ignored by Git because it is machine/account-specific.

The production Vercel deployment currently serves an older single-file version of
the site. It uses inline CSS and CDN Chart.js, while this repo now uses local
split assets under `assets/`.

Do not deploy until the working tree is cleanly reviewed and the intended source
repo is confirmed as `immeasurablematt/jettagrove-site`.

## Safe Publish Checklist

1. Confirm `git status -sb`, current branch, and worktree list.
2. Run a local browser check against `http://127.0.0.1:4173/`.
3. Confirm no missing local files or broken same-page anchors.
4. Commit the approved local changes.
5. Push the branch or main only after review.
6. Deploy only from the confirmed Vercel project and repo.
7. Recheck `https://www.jettagrove.com/` after deployment.
