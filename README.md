# GP-Level Hub and Spoke App

This is a lightweight local web app for the GP-level research map.

## What it does

- lets a user type a GP practice name
- verifies that practice against the current official NHS England Digital GP-practice mapping snapshot
- gets the practice postcode from that official mapping data
- geocodes the postcode
- calculates the nearest primary-care and secondary-care CRDCs
- calculates the nearest academic primary care university department
- calculates the nearest PC-CTU
- calculates the nearest SC-CTU
- places the verified GP practice name in the centre of the diagram
- places the nearest centres in the local hub boxes
- places the nearest academic department in the university support box
- places the nearest PC-CTU in its dedicated CTU support box
- places the nearest SC-CTU in its dedicated CTU support box
- highlights the matched centres in the hub directories
- provides an NHS `Find a GP` link for the postcode used
- shows a verification summary card in the UI
- keeps a lightweight NHS snapshot refresh control beside the verification source field
- checks automatically for newer NHS GP-practice snapshots on startup and every 12 hours
- includes a semi-transparent UK CRDC map underlay behind the right-hand centre arcs
- projects `PC-CRDC` and `SC-CRDC` circles onto that UK map using their stored coordinates
- projects university-linked academic primary care institutions onto that UK map from the `Universities` box

## Files

- `index.html`: app structure
- `styles.css`: app styling
- `main.js`: front-end diagram rendering and interaction logic
- `server.js`: local backend for official-practice verification, dataset refresh, postcode lookup, and nearest-hub matching
- `assets/UK_CRDC_Map.webp`: original UK map reference image
- `assets/UK_CRDC_Map_clean.png`: cleaned shared UK map underlay used by all browsers
- `assets/app-icon.svg`: vector app icon used for browser and install metadata
- `assets/app-icon-180.png`: iPhone home-screen icon
- `assets/app-icon-192.png`: Android home-screen icon
- `assets/app-icon-512.png`: large Android/web app icon
- `site.webmanifest`: web app manifest for Android install/home-screen behavior
- `data/gp-reg-pat-prac-map_2026-02.csv`: older official GP-practice mapping snapshot retained locally
- `data/gp-reg-pat-prac-map_2026-04.csv`: latest downloaded official GP-practice mapping snapshot currently active
- `data/academic-primary-care-institutions.json`: academic primary care institution dataset used for the `Universities` map layer
- `data/secondary-care-ctus.json`: secondary-care CTU dataset used for the `Nearest SC-CTU` box, map layer, and directory list
- `CHANGELOG.md`: shared running change log for Codex and Claude handoff
- `archive-version.sh`: archives the current app version into `archive/v<version>`
- `deploy.sh`: syncs `render-upload`, commits it, and pushes it to GitHub
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

That button calls the same backend refresh flow and updates the verification summary source status.

### 3. Postcode lookup

Once a postcode is found, the backend uses Postcodes.io to get coordinates.

### 4. Nearest-centre matching

The backend compares the postcode coordinates against:
- the current 14 `PC-CRDC` records
- the current 15 `SC-CRDC` records
- the current academic primary care institution records
- the current PC-CTU records
- the current SC-CTU records

and returns the nearest record from each set.

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

### 4c. Home-screen app icon support

The app now includes install/home-screen metadata for mobile browsers:
- `site.webmanifest` for Android and other manifest-aware browsers
- `apple-touch-icon` metadata for iPhone home-screen saves
- a dedicated app icon set in `assets/`

This means the hosted app can show a proper icon when saved to the home screen on iPhone or Android instead of using a generic screenshot tile.

### 4c. University-linked institution placement

The map now includes a third projected data layer linked from the `Universities` box.

Current behavior:
- a curated academic primary care institution dataset is loaded from `data/academic-primary-care-institutions.json`
- each institution is placed onto the UK map using approximate city-level coordinates
- the institutions are rendered as numbered `U` nodes
- nearby institutions are spread slightly where multiple entries share the same city
- the right-hand directory includes a matching institution list and links
- the nearest institution for the verified GP practice is highlighted and shown in the `Nearest Primary Care University Department` box

### 4d. PC-CTU placement

The map now includes a fourth projected data layer for PC-CTUs.

Current behavior:
- the current CTU dataset contains one record: `Oxford University PC-CTU`
- that record is treated as a proper nearest-match dataset rather than a fixed label
- the nearest CTU result is shown in the `Nearest PC-CTU` box
- the CTU is rendered as a projected numbered node on the UK map
- the right-hand directory includes a matching CTU list
- the structure is ready for additional CTU records later without another layout redesign

### 4e. SC-CTU placement

The map now includes a fifth projected data layer for SC-CTUs.

Current behavior:
- a curated SC-CTU dataset is loaded from `data/secondary-care-ctus.json`
- the first-pass coordinates are approximate city-level placements inferred from the unit names and linked institutions in the source file
- the nearest SC-CTU result is shown in the `Nearest SC-CTU` box
- the SC-CTUs are rendered as projected numbered nodes on the UK map
- the right-hand directory includes a matching SC-CTU list with web links
- the hover/selection behavior matches the existing CRDC, university, and PC-CTU layers

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
- nearest `Primary Care University Department`
- `University department` distance
- nearest `PC-CTU`
- `PC-CTU` distance
- nearest `SC-CTU`
- `SC-CTU` distance
- verification source and linked publication

The NHS snapshot refresh control now sits directly beside the `Verification source` field so the refresh action stays available without a dedicated dataset-status panel.

## Current data model

In `server.js`:
- `pcHubRecords`: the 14 primary-care CRDCs, URLs, and approximate coordinates
- `scHubRecords`: the 15 secondary-care CRDCs, with centre names, addresses, postcodes, and websites
- `academicInstitutionRecords`: the university-linked academic primary care institutions used for the `Universities` map layer
- `primaryCareCtuRecords`: the PC-CTU dataset used for the CTU map layer
- `secondaryCareCtuRecords`: the SC-CTU dataset used for the CTU map layer
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

## Change tracking and archives

This app now keeps two simple project-history tools in the live app folder:

- `CHANGELOG.md`
  - short, human-readable version notes
  - intended to be updated by either Codex or Claude
- `archive-version.sh`
  - creates a version snapshot in `archive/v<version>`
  - excludes `.env` and `.env.*` so secrets are not copied into archives

Recommended workflow for future changes:

1. make and validate the code changes in the live app folder
2. update `CHANGELOG.md`
3. run `./archive-version.sh` before bumping to the next version if you want to snapshot the old version
4. run `./sync-render-upload.sh`
5. deploy from `render-upload/`

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
- `/api/client-config`
- seeded practice loading
- dataset status
- centre-record loading
- a known successful lookup
- an ambiguous lookup that should return a shortlist
- selecting one shortlisted practice by practice code
- an unknown-practice failure case
- protected-action token guards for dataset refresh and suggestions

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

## Deploy workflow used here

The current shared-project deploy workflow is:

1. edit the live app here:
   - `GP level/hub-spoke-app`
2. sync the GitHub-ready bundle:
   - `./sync-render-upload.sh`
3. deploy from:
   - `GP level/hub-spoke-app/render-upload`

The desktop deploy app currently points into this shared project and runs:

- `GP level/hub-spoke-app/deploy.sh`

That script:
- syncs `render-upload/` from the live app
- commits inside `render-upload/`
- pushes `render-upload/` to GitHub

So yes: the GitHub upload folder used here is the shared copy’s own:

- `GP level/hub-spoke-app/render-upload`

## Suggested next improvements

1. replace approximate hub coordinates with exact site coordinates or postcodes
2. calibrate the UK map underlay so CRDC links can terminate at geographic positions
3. decide whether to keep the current marker-rich `.webp` or switch to a cleaner UK base map
4. add a clearer disambiguation flow for close practice-name matches
5. persist a small dataset manifest if you want a longer audit trail of automatic refresh events
6. add export/share output for the populated diagram state

## Security and deployment hardening

The app now includes a small security hardening pass aimed at the deployed web version:
- HTML responses send a Content Security Policy and additional browser hardening headers
- external static links now use `rel=\"noreferrer noopener\"`
- the manual dataset-refresh endpoint blocks cross-origin requests
- the manual dataset-refresh endpoint is lightly rate limited
- the `render-upload` sync script now clears stale copied files before rebuilding the deploy bundle
