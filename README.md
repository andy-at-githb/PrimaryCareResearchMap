# GP-Level Hub and Spoke App

This is a lightweight local web app for the GP-level research map.

## What it does

- lets a user type a GP practice name
- verifies that practice against the current official NHS England Digital GP-practice mapping snapshot
- gets the practice postcode from that official mapping data
- geocodes the postcode
- calculates the nearest regional research hub
- places the verified GP practice name in the centre of the diagram
- places the nearest hub in the local hub box
- highlights the matched hub in the hub directory
- provides an NHS `Find a GP` link for the postcode used
- shows a verification summary card in the UI
- keeps a lightweight NHS snapshot refresh control beside the verification source field
- checks automatically for newer NHS GP-practice snapshots on startup and every 12 hours

## Files

- `index.html`: app structure
- `styles.css`: app styling
- `main.js`: front-end diagram rendering and interaction logic
- `server.js`: local backend for official-practice verification, dataset refresh, postcode lookup, and nearest-hub matching
- `data/gp-reg-pat-prac-map_2026-02.csv`: older official GP-practice mapping snapshot retained locally
- `data/gp-reg-pat-prac-map_2026-04.csv`: latest downloaded official GP-practice mapping snapshot currently active
- `README.md`: this file

## How it works

### 1. Practice verification

The local backend verifies practice names using the official NHS England Digital `Patients Registered at a GP Practice` mapping snapshot.

Current source in the tested app:
- April 2026 mapping snapshot
- practice fields used:
  - `PRACTICE_NAME`
  - `PRACTICE_POSTCODE`
  - `PRACTICE_CODE`

This is a stronger verification source than scraping public NHS search pages.

### 2. Automatic snapshot refresh

The backend now does the following:
- loads the newest local `gp-reg-pat-prac-map_YYYY-MM.csv` file it can find
- checks the NHS England Digital publication series on startup
- checks again every 12 hours while the server is running
- looks for the newest published `Mapping (Commissioning Regions-ICBs-SICBLs-PCNs-GP practice)` resource
- downloads a newer snapshot automatically when one is available
- keeps using the latest local snapshot if the network check fails

There is also a manual UI button:
- `Check for newer NHS snapshot`

That button calls the same backend refresh flow and updates the dataset status card.

### 3. Postcode lookup

Once a postcode is found, the backend uses Postcodes.io to get coordinates.

### 4. Nearest-hub matching

The backend compares the postcode coordinates against the current 14 regional hub coordinates and returns the nearest hub.

### 5. Verification summary card

The UI now shows:
- entered practice name
- verified practice name
- practice code
- postcode used
- nearest regional hub
- approximate distance to hub
- verification source and linked publication

The NHS snapshot refresh control now sits directly beside the `Verification source` field so the refresh action stays available without a dedicated dataset-status panel.

## Current data model

In `server.js`:
- `hubRecords`: the 14 regional research hubs, URLs, and approximate coordinates
- `practiceMap`: the active GP practice snapshot loaded from the current CSV
- `datasetState`: the active dataset metadata plus refresh status

## Important limitations

### Coordinates

The current hub coordinates are approximate locality anchors, not guaranteed exact site coordinates.

If postcode-driven hub matching becomes a serious workflow, these should be replaced with exact site coordinates or exact postcodes for each hub.

### Ambiguous names

Practice-name matching is still a best-match approach.

If two practice names are very similar, a future UI may need to present a shortlist for user confirmation rather than selecting the highest-scoring match automatically.

### Live network dependency

The app still depends on live network access for:
- NHS England Digital publication checks
- Postcodes.io postcode geocoding

## Running it

This app requires the local server.

From this folder run:

```bash
node server.js
```

By default the app now binds to `127.0.0.1` only, which is safer for local use.

Then open:

`http://localhost:8000`

If you later want to share it on your network or deploy it behind a proper host, you can expose it without code changes:

```bash
HOST=0.0.0.0 PORT=8000 node server.js
```


## Render deployment prep

This app is now prepared for Render.

Files added for deployment:
- `package.json`
- `.gitignore`
- `render.yaml` for a standalone repo
- `render.monorepo.yaml` for the current wider Codex repo layout
- `RENDER_DEPLOY.md` with step-by-step deployment guidance

A health check endpoint is also available at:
- `/healthz`

For a simple hosted review flow, the cleanest option is to place this app folder in its own GitHub repo and deploy that repo to Render.

## Suggested next improvements

1. replace approximate hub coordinates with exact site coordinates or postcodes
2. add a clearer disambiguation flow for close practice-name matches
3. persist a small dataset manifest if you want a longer audit trail of automatic refresh events
4. add export/share output for the populated diagram state
