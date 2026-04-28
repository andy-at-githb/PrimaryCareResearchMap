# Render Deployment Guide

This app is now prepared for Render in two ways.

## What your reviewers will do

Once deployed, reviewers do not need any coding knowledge.

They will:
- receive a normal web link
- open it in a browser
- type a GP practice name
- test the app

They do not need to install anything.

## Option 1: Easiest long-term setup

Create a dedicated GitHub repository that contains only the contents of this app folder:

- `index.html`
- `styles.css`
- `main.js`
- `server.js`
- `package.json`
- `render.yaml`
- `data/`

Then in Render:
1. Create a new Web Service from that GitHub repo.
2. Render should detect the Node app.
3. Use:
   - Build Command: `npm install`
   - Start Command: `node server.js`
4. Deploy.

This is the cleanest option because the included `render.yaml` works directly when this app is the repo root.

## Option 2: Deploy from the current larger Codex repo

If you keep the app inside the wider Codex repo, use the monorepo-aware file:

- `render.monorepo.yaml`

This config already sets:
- `rootDir: "Research Map/GP level/hub-spoke-app"`

In Render you can either:
- use the dashboard and set Root Directory to `Research Map/GP level/hub-spoke-app`
- or create a Blueprint and point Render at `Research Map/GP level/hub-spoke-app/render.monorepo.yaml`

## Prepared files

- `package.json`: provides conventional Node metadata and scripts
- `.gitignore`: ignores local development artifacts
- `render.yaml`: standalone-repo Render config
- `render.monorepo.yaml`: current-monorepo Render config
- `server.js`: now includes `/healthz` for Render health checks

## Default hosted behavior

The deployment configs set:
- `HOST=0.0.0.0`
- `PORT=10000`

That matches Render's requirement for public web services.

## Notes

- The app depends on outbound access to NHS England Digital and Postcodes.io.
- The free Render plan may be fine for testing and feedback, but it may have sleep/cold-start behavior.
- If free is unavailable or unsuitable, change the `plan` field in the Render YAML.
