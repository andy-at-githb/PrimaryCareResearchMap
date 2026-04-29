# GP-Level Hub and Spoke App

This is a lightweight local web app for the GP-level research map.

## What it does

- lets a user type a GP practice name
- verifies that practice against the current official NHS England Digital GP-practice mapping snapshot
- gets the practice postcode from that official mapping data
- geocodes the postcode
- calculates the nearest primary-care and secondary-care CRDCs
- places the verified GP practice name in the centre of the diagram
- places the nearest centres in the local hub boxes
- highlights the matched centres in the hub directories
- provides an NHS `Find a GP` link for the postcode used
- shows a verification summary card in the UI
- keeps a lightweight NHS snapshot refresh control beside the verification source field
- checks automatically for newer NHS GP-practice snapshots on startup and every 12 hours
- includes a semi-transparent UK CRDC map underlay behind the right-hand centre arcs
- projects `PC-CRDC` and `SC-CRDC` circles onto that UK map using their stored coordinates

## Files

- `index.html`: app structure
- `styles.css`: app styling
- `main.js`: front-end diagram rendering and interaction logic
- `server.js`: local backend for official-practice verification, dataset refresh, postcode lookup, and nearest-hub matching
- `assets/UK_CRDC_Map.webp`: original UK map reference image
- `assets/UK_CRDC_Map_clean.png`: cleaned shared UK map underlay used by all browsers
- `data/gp-reg-pat-prac-map_2026-02.csv`: older official GP-practice mapping snapshot retained locally
- `data/gp-reg-pat-prac-map_2026-04.csv`: latest downloaded official GP-practice mapping snapshot currently active
- `smoke-test.js`: lightweight endpoint smoke test for local or hosted app verification
- `sync-render-upload.sh`: syncs the app files, assets, and datasets into the standalone Render upload bundle
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

### 4. Nearest-centre matching

The backend compares the postcode coordinates against:
- the current 14 `PC-CRDC` records
- the current 15 `SC-CRDC` records

and returns the nearest centre from each set.

### 4a. UK map underlay

The diagram now includes a UK map underlay on the right side:
- reference source image: `assets/UK_CRDC_Map.webp`
- shared cleaned underlay: `assets/UK_CRDC_Map_clean.png`
- rendered as an SVG image in the same coordinate space as the CRDC arcs
- opacity reduced so the map supports the reading of the data rather than competing with it
- served as a pre-generated static asset so all browsers use the same silhouette

### 4b. Geographic CRDC placement

The `PC-CRDC` and `SC-CRDC` circles are now placed onto the UK map using their stored latitude/longitude coordinates.

Current behavior:
- `PC-CRDC` positions use the current stored locality coordinates
- `SC-CRDC` positions use the postcode-hydrated coordinates from the backend
- both sets are projected into the map rectangle in the SVG
- nearby centres are slightly spread so they remain visible in dense areas such as London and the South East

### 5. Verification summary card

The UI now shows:
- entered practice name
- verified practice name
- practice code
- postcode used
- nearest `PC-CRDC`
- `PC-CRDC` distance
- nearest `SC-CRDC`
- `SC-CRDC` distance
- verification source and linked publication

The NHS snapshot refresh control now sits directly beside the `Verification source` field so the refresh action stays available without a dedicated dataset-status panel.

## Current data model

In `server.js`:
- `pcHubRecords`: the 14 primary-care CRDCs, URLs, and approximate coordinates
- `scHubRecords`: the 15 secondary-care CRDCs, with centre names, addresses, postcodes, and websites
- `practiceMap`: the active GP practice snapshot loaded from the current CSV
- `datasetState`: the active dataset metadata plus refresh status
- `/api/centre-records`: current CRDC records and coordinates for front-end map placement

## Important limitations

### Coordinates

The current CRDC coordinates are approximate locality anchors, not guaranteed exact site coordinates.

If postcode-driven matching becomes a serious workflow, these should be replaced with exact site coordinates or exact postcodes for each centre.

### SC-CRDC coordinates

The `SC-CRDC` layer now contains the real 15 centre names, addresses, postcodes, and websites.

Current coordinate behavior:
- each `SC-CRDC` record includes a postcode
- the server hydrates those centre coordinates from Postcodes.io at startup
- fallback coordinates are kept in the records so the app still runs if a startup lookup fails

This gives a materially better nearest-`SC-CRDC` match than the earlier placeholder approach.

### Ambiguous names

Practice-name matching now supports a shortlist flow.

Current behavior:
- unique exact or strong single matches resolve automatically
- duplicate or near-tied official matches return a shortlist
- the UI prompts the user to choose the correct GP practice before continuing
- the selected practice code is then used to complete the lookup deterministically

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

### Render host note

For Render deployments, the safest configuration is still:

```bash
HOST=0.0.0.0
```

The server now includes a Render-aware fallback that will try to bind to `0.0.0.0` automatically when it detects a Render environment, but you should still check the Render `Environment` page after a deploy and confirm that `HOST` is set explicitly if possible.

## Smoke testing

With the server running, you can run the lightweight smoke test:

```bash
node smoke-test.js
```

Or via npm:

```bash
npm run smoke:test
```

By default the script tests:
- `/healthz`
- seeded practice loading
- dataset status
- centre-record loading
- a known successful lookup
- an ambiguous lookup that should return a shortlist
- selecting one shortlisted practice by practice code
- an unknown-practice failure case

To point the smoke test at a different host:

```bash
APP_BASE_URL=https://your-app.example node smoke-test.js
```


## Render deployment prep

This app is now prepared for Render.

Files added for deployment:
- `package.json`
- `.gitignore`
- `render.yaml` for a standalone repo
- `render.monorepo.yaml` for the current wider Codex repo layout
- `RENDER_DEPLOY.md` with step-by-step deployment guidance
- `sync-render-upload.sh` to refresh the standalone `render-upload` folder from the main app
- `smoke-test.js` for quick post-deploy or local verification

A health check endpoint is also available at:
- `/healthz`

For a simple hosted review flow, the cleanest option is to place this app folder in its own GitHub repo and deploy that repo to Render.

## Suggested next improvements

1. replace approximate hub coordinates with exact site coordinates or postcodes
2. calibrate the UK map underlay so CRDC links can terminate at geographic positions
3. decide whether to keep the current marker-rich `.webp` or switch to a cleaner UK base map
4. add a clearer disambiguation flow for close practice-name matches
5. persist a small dataset manifest if you want a longer audit trail of automatic refresh events
6. add export/share output for the populated diagram state
