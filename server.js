const http = require('http');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const { URL } = require('url');

const execFileAsync = promisify(execFile);
const fsp = fs.promises;

const PORT = process.env.PORT || 8000;
const RUNNING_ON_RENDER = Boolean(
  process.env.RENDER
  || process.env.RENDER_EXTERNAL_URL
  || process.env.RENDER_SERVICE_ID
  || process.env.RENDER_SERVICE_NAME,
);
const HOST = process.env.HOST || (RUNNING_ON_RENDER ? '0.0.0.0' : '127.0.0.1');
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const POSTCODE_API = 'https://api.postcodes.io/postcodes/';
const PRACTICE_SERIES_URL = 'https://digital.nhs.uk/data-and-information/publications/statistical/patients-registered-at-a-gp-practice';
const DATASET_PREFIX = 'gp-reg-pat-prac-map_';
const DATASET_PATTERN = /^gp-reg-pat-prac-map_(\d{4})-(\d{2})\.csv$/;
const REFRESH_INTERVAL_HOURS = 12;
const REFRESH_INTERVAL_MS = REFRESH_INTERVAL_HOURS * 60 * 60 * 1000;
const ACADEMIC_INSTITUTIONS_FILE = path.join(DATA_DIR, 'academic-primary-care-institutions.json');
const SECONDARY_CTU_FILE = path.join(DATA_DIR, 'secondary-care-ctus.json');

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const MONTH_NAME_TO_NUMBER = new Map(
  MONTH_NAMES.map((name, index) => [name.toLowerCase(), String(index + 1).padStart(2, '0')]),
);

const pcHubRecords = [
  { id: 1, hubName: 'PC-CRDC 1', site: 'The Adam Practice, Poole, Dorset', url: 'https://www.adampractice.co.uk/', lat: 50.7192, lon: -1.9819 },
  { id: 2, hubName: 'PC-CRDC 2', site: 'Ashton Medical Group, Ashton-Under-Lyne, Lancashire', url: 'https://www.ashtonmedicalgroup.co.uk/', lat: 53.4899, lon: -2.0941 },
  { id: 3, hubName: 'PC-CRDC 3', site: 'The Garth Surgery, Guisborough, Cleveland', url: 'https://www.thegarthsurgery.nhs.uk/', lat: 54.5348, lon: -1.0564 },
  { id: 4, hubName: 'PC-CRDC 4', site: 'Grove Surgery, Thetford, Norfolk', url: 'https://grovesurgerythetford.co.uk/', lat: 52.4140, lon: 0.7484 },
  { id: 5, hubName: 'PC-CRDC 5', site: 'Hounslow Medical Centre, Middlesex', url: 'https://www.hounslowmedicalcentre.co.uk/', lat: 51.4686, lon: -0.3613 },
  { id: 6, hubName: 'PC-CRDC 6', site: 'Layton Medical Centre, Blackpool, Lancashire', url: 'https://www.laytonmedicalcentre.co.uk/', lat: 53.8330, lon: -3.0357 },
  { id: 7, hubName: 'PC-CRDC 7', site: 'Marine Lake Medical Practice, West Kirby, Wirral', url: 'https://marinelakemedicalwirral.nhs.uk/', lat: 53.3733, lon: -3.1847 },
  { id: 8, hubName: 'PC-CRDC 8', site: 'Mereside Medical, Ely, Cambridgeshire', url: 'https://www.meresidemedical.nhs.uk/', lat: 52.3995, lon: 0.2624 },
  { id: 9, hubName: 'PC-CRDC 9', site: 'Pier Health Group, Weston-Super-Mare, North Somerset', url: 'https://pierhealth.co.uk/', lat: 51.3463, lon: -2.9778 },
  { id: 10, hubName: 'PC-CRDC 10', site: 'Rame Group Practice, Torpoint, Cornwall', url: 'https://theramegrouppractice.co.uk/', lat: 50.3778, lon: -4.1957 },
  { id: 11, hubName: 'PC-CRDC 11', site: 'The University of Nottingham Health Service, Nottingham', url: 'https://www.unhs.co.uk/', lat: 52.9386, lon: -1.1953 },
  { id: 12, hubName: 'PC-CRDC 12', site: 'Wansford Surgery, Wansford, Peterborough', url: 'https://www.wansfordsurgery.co.uk/', lat: 52.5748, lon: -0.4182 },
  { id: 13, hubName: 'PC-CRDC 13', site: 'West Walk Surgery, Yate, Bristol', url: 'https://www.westwalksurgery.co.uk/', lat: 51.5406, lon: -2.4184 },
  { id: 14, hubName: 'PC-CRDC 14', site: 'Windrush Medical Practice, Witney, Oxfordshire', url: 'https://www.windrushmedicalpractice.co.uk/', lat: 51.7850, lon: -1.4854 },
];

const scHubRecords = [
  {
    id: 1,
    hubName: 'SC-CRDC 1',
    site: 'NIHR Cheshire and Merseyside CRDC',
    address: 'Royal Liverpool University Hospital, Mount Vernon Street, Liverpool, L7 8XP',
    postcode: 'L7 8XP',
    url: 'https://www.uhliverpool.nhs.uk/about-us/research/https-www-uhliverpool-nhs-uk-about-us-research-nihr-cheshire-and-merseyside-commercial-research-delivery-centre-crdc',
    lat: 50.7192,
    lon: -1.9819,
  },
  {
    id: 2,
    hubName: 'SC-CRDC 2',
    site: 'NIHR Blackpool CRDC',
    address: 'Clinical Research Centre, Whinney Heys Road, Blackpool, FY3 8NR',
    postcode: 'FY3 8NR',
    url: 'https://www.blackpoolteachinghospitals.nhs.uk/about-us/latest-news/gbp35m-funding-means-future-bright-blackpool-teaching-hospitals-research-ambitions',
    lat: 53.4899,
    lon: -2.0941,
  },
  {
    id: 3,
    hubName: 'SC-CRDC 3',
    site: 'NIHR Bradford and West Yorkshire CRDC',
    address: 'Bradford Institute for Health Research, Temple Bank House, Bradford Royal Infirmary, Duckworth Lane, Bradford, BD9 6RJ',
    postcode: 'BD9 6RJ',
    url: 'https://bradfordresearch.nhs.uk/researcharea/nihr-bradford-west-yorkshire-crdc/',
    lat: 54.5348,
    lon: -1.0564,
  },
  {
    id: 4,
    hubName: 'SC-CRDC 4',
    site: 'NIHR Central and North West Midlands CRDC',
    address: "Birmingham Women's and Children's NHS Foundation Trust, Birmingham Children's Hospital, Steelhouse Lane, Birmingham, West Midlands, B4 6NH",
    postcode: 'B4 6NH',
    url: 'https://www.birminghamhealthpartners.co.uk/central-and-north-west-midlands-awarded-prestigious-nihr-commercial-research-delivery-centre/',
    lat: 52.4140,
    lon: 0.7484,
  },
  {
    id: 5,
    hubName: 'SC-CRDC 5',
    site: 'NIHR Cornwall and Isles of Scilly CRDC',
    address: 'Royal Cornwall Hospitals NHS Trust, Royal Cornwall Hospital, Treliske, Truro, Cornwall, TR1 3LJ',
    postcode: 'TR1 3LJ',
    url: 'https://royalcornwallhospitals.nhs.uk/organisation/research-and-development/cornwall-and-isles-of-scilly-commercial-research-delivery-centre-cios-crdc/',
    lat: 51.4686,
    lon: -0.3613,
  },
  {
    id: 6,
    hubName: 'SC-CRDC 6',
    site: 'NIHR Greater Manchester CRDC',
    address: 'Manchester University NHS Foundation Trust, Cobbett House, Oxford Road, Manchester, M13 9WL',
    postcode: 'M13 9WL',
    url: 'https://research.cmft.nhs.uk/news-events/greater-manchester-to-benefit-from-4-7-million-research-boost-to-unlock-cutting-edge-health-treatments',
    lat: 53.8330,
    lon: -3.0357,
  },
  {
    id: 7,
    hubName: 'SC-CRDC 7',
    site: 'NIHR Leicestershire and Northamptonshire CRDC',
    address: 'Leicester General Hospital, Gwendolen Road, Leicester, LE5 4PW',
    postcode: 'LE5 4PW',
    url: 'https://www.uhleicester.nhs.uk/research/facilities/nihr-commercial-research-delivery-centre-crdc/',
    lat: 53.3733,
    lon: -3.1847,
  },
  {
    id: 8,
    hubName: 'SC-CRDC 8',
    site: 'NIHR London North West CRDC',
    address: 'London North West University Healthcare NHS Trust, Northwick Park Hospital, Watford Road, Harrow, Middlesex, HA1 3UJ',
    postcode: 'HA1 3UJ',
    url: 'https://www.lnwh.nhs.uk/news/trusts-7m-grant-to-spearhead-research-into-21st-century-10970',
    lat: 52.3995,
    lon: 0.2624,
  },
  {
    id: 9,
    hubName: 'SC-CRDC 9',
    site: 'NIHR Newcastle CRDC',
    address: 'Royal Victoria Infirmary, Queen Victoria Road, Newcastle upon Tyne, NE1 4LP',
    postcode: 'NE1 4LP',
    url: 'https://diagnosticsnortheast.org.uk/team/nihr-commercial-research-delivery-centre-crdc-newcastle/',
    lat: 51.3463,
    lon: -2.9778,
  },
  {
    id: 10,
    hubName: 'SC-CRDC 10',
    site: 'NIHR North East London CRDC',
    address: 'The Royal London Hospital, Whitechapel Road, London, E1 1FR',
    postcode: 'E1 1FR',
    url: 'https://www.bartshealth.nhs.uk/news/latest-news-delivering-more-research-into-new-drugs-17171',
    lat: 50.3778,
    lon: -4.1957,
  },
  {
    id: 11,
    hubName: 'SC-CRDC 11',
    site: 'NIHR North Midlands CRDC',
    address: 'UHNM NHS Trust, Royal Stoke University Hospital, Newcastle Road, Stoke-on-Trent, ST4 6QG',
    postcode: 'ST4 6QG',
    url: 'https://www.uhnm.nhs.uk/research/the-north-midlands-commercial-research-delivery-centre-crdc/',
    lat: 52.9386,
    lon: -1.1953,
  },
  {
    id: 12,
    hubName: 'SC-CRDC 12',
    site: "NIHR Sheffield Children's CRDC",
    address: "Sheffield Children's NHS Foundation Trust, Western Bank, Sheffield, S10 2TH",
    postcode: 'S10 2TH',
    url: 'https://www.sheffieldchildrens.nhs.uk/news/sheffield-childrens-nhs-opens-new-commercial-research-delivery-centre/',
    lat: 52.5748,
    lon: -0.4182,
  },
  {
    id: 13,
    hubName: 'SC-CRDC 13',
    site: 'NIHR South London CRDC',
    address: "Guy's Hospital, Great Maze Pond, London, SE1 9RT",
    postcode: 'SE1 9RT',
    url: 'https://www.jointresearchoffice.org/working-partners/our-partners',
    lat: 51.5406,
    lon: -2.4184,
  },
  {
    id: 14,
    hubName: 'SC-CRDC 14',
    site: 'NIHR Sussex CRDC',
    address: 'University Hospitals Sussex NHS Foundation Trust, Worthing Hospital, Lyndhurst Road, Worthing, West Sussex, BN11 2DH',
    postcode: 'BN11 2DH',
    url: 'https://www.uhsussex.nhs.uk/research-and-innovation/nihr-commercial-research-delivery-centre-crdc-sussex/',
    lat: 51.7850,
    lon: -1.4854,
  },
  {
    id: 15,
    hubName: 'SC-CRDC 15',
    site: 'NIHR Wessex CRDC',
    address: 'Southampton Research Hub, Shirley Health Centre, Grove Road, Southampton, SO15 3UA',
    postcode: 'SO15 3UA',
    url: 'https://www.wessexresearchhubs.nhs.uk/',
    lat: 50.7192,
    lon: -1.9819,
  },
];

const primaryCareCtuRecords = [
  {
    id: 1,
    ctuCode: 'C1',
    site: 'Oxford University PC-CTU',
    locationLabel: 'Oxford',
    postcode: 'OX3 7LF',
    url: 'https://www.phctrials.ox.ac.uk/',
    lat: 51.7520,
    lon: -1.2577,
  },
];

const academicInstitutionRecords = JSON.parse(fs.readFileSync(ACADEMIC_INSTITUTIONS_FILE, 'utf8'));
const secondaryCareCtuRecords = JSON.parse(fs.readFileSync(SECONDARY_CTU_FILE, 'utf8'));

let practiceMap = [];
let practiceSuggestions = [];
let datasetRefreshPromise = null;
let supportDatasetHydrationPromise = null;

const datasetState = {
  current: null,
  refresh: {
    inProgress: false,
    lastAttemptedAt: null,
    lastCheckedAt: null,
    lastUpdatedAt: null,
    lastResult: 'idle',
    message: 'Using the latest local GP-practice snapshot currently available.',
    mode: 'startup',
  },
};

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
};

function sendText(res, status, body, contentType = 'text/plain; charset=utf-8') {
  res.writeHead(status, {
    'Content-Type': contentType,
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload, null, 2);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function sendFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const type = MIME[ext] || 'application/octet-stream';
  fs.readFile(filePath, (err, data) => {
    if (err) {
      sendJson(res, 404, { error: 'Not found' });
      return;
    }
    res.writeHead(200, {
      'Content-Type': type,
      'Cache-Control': 'no-store',
    });
    res.end(data);
  });
}

const PUBLIC_FILE_PATHS = new Map([
  ['/', path.join(ROOT, 'index.html')],
  ['/index.html', path.join(ROOT, 'index.html')],
  ['/styles.css', path.join(ROOT, 'styles.css')],
  ['/main.js', path.join(ROOT, 'main.js')],
]);

const PUBLIC_DIRECTORY_PREFIXES = [
  ['/assets/', path.join(ROOT, 'assets')],
];

function resolvePublicFilePath(urlPath) {
  if (PUBLIC_FILE_PATHS.has(urlPath)) {
    return PUBLIC_FILE_PATHS.get(urlPath);
  }

  for (const [urlPrefix, directory] of PUBLIC_DIRECTORY_PREFIXES) {
    if (!urlPath.startsWith(urlPrefix)) continue;

    const relativePath = path.normalize(urlPath.slice(urlPrefix.length)).replace(/^([.][.][/\\])+/, '');
    const filePath = path.join(directory, relativePath);
    const relativeToDirectory = path.relative(directory, filePath);
    if (relativeToDirectory.startsWith('..') || path.isAbsolute(relativeToDirectory)) {
      return null;
    }
    return filePath;
  }

  return null;
}

function decodeHtml(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ');
}

function stripTags(str) {
  return decodeHtml(str.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim());
}

function normalizeName(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function parseCsvLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      values.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  values.push(current);
  return values;
}

function titleCaseMonth(monthLower) {
  return `${monthLower.charAt(0).toUpperCase()}${monthLower.slice(1)}`;
}

function parseVersion(version) {
  const [year, month] = version.split('-');
  return { year, month };
}

function publicationLabelFromVersion(version) {
  const { year, month } = parseVersion(version);
  const monthName = MONTH_NAMES[Number(month) - 1] || month;
  return `${monthName} ${year}`;
}

function publicationUrlFromVersion(version) {
  const { year, month } = parseVersion(version);
  const monthName = (MONTH_NAMES[Number(month) - 1] || '').toLowerCase();
  return monthName ? `${PRACTICE_SERIES_URL}/${monthName}-${year}` : PRACTICE_SERIES_URL;
}

function datasetFileNameFromVersion(version) {
  return `${DATASET_PREFIX}${version}.csv`;
}

function findLatestLocalDataset() {
  const fileNames = fs.readdirSync(DATA_DIR).filter((fileName) => DATASET_PATTERN.test(fileName));
  if (!fileNames.length) return null;
  const latestFileName = fileNames.sort((a, b) => {
    const versionA = a.match(DATASET_PATTERN)?.slice(1).join('-') || '';
    const versionB = b.match(DATASET_PATTERN)?.slice(1).join('-') || '';
    return versionB.localeCompare(versionA);
  })[0];
  const match = latestFileName.match(DATASET_PATTERN);
  const version = `${match[1]}-${match[2]}`;
  return {
    fileName: latestFileName,
    filePath: path.join(DATA_DIR, latestFileName),
    version,
  };
}

function setCurrentDataset(filePath, metadata = {}) {
  const csv = fs.readFileSync(filePath, 'utf8');
  const lines = csv.split(/\r?\n/).filter(Boolean);
  const header = parseCsvLine(lines[0]);
  const idxName = header.indexOf('PRACTICE_NAME');
  const idxPostcode = header.indexOf('PRACTICE_POSTCODE');
  const idxCode = header.indexOf('PRACTICE_CODE');
  if (idxName < 0 || idxPostcode < 0 || idxCode < 0) {
    throw new Error('GP-practice snapshot is missing one or more required columns: PRACTICE_NAME, PRACTICE_POSTCODE, PRACTICE_CODE');
  }

  practiceMap = lines.slice(1).map((line) => {
    const cols = parseCsvLine(line);
    return {
      practiceCode: (cols[idxCode] || '').trim(),
      practiceName: (cols[idxName] || '').trim(),
      postcode: (cols[idxPostcode] || '').trim(),
      normalizedPracticeName: normalizeName(cols[idxName] || ''),
    };
  }).filter((entry) => entry.practiceCode && entry.practiceName && entry.postcode);

  practiceSuggestions = [...new Set(practiceMap.map((entry) => entry.practiceName))].sort((a, b) => a.localeCompare(b, 'en-GB'));

  const fileName = path.basename(filePath);
  const match = fileName.match(DATASET_PATTERN);
  const version = metadata.version || (match ? `${match[1]}-${match[2]}` : null);
  datasetState.current = {
    fileName,
    filePath,
    version,
    publicationLabel: metadata.publicationLabel || (version ? publicationLabelFromVersion(version) : fileName),
    publicationUrl: metadata.publicationUrl || (version ? publicationUrlFromVersion(version) : PRACTICE_SERIES_URL),
    mappingResourceUrl: metadata.mappingResourceUrl || null,
    rowCount: practiceMap.length,
    loadedAt: new Date().toISOString(),
  };
  return datasetState.current;
}

function initializePracticeDataset() {
  const latestLocal = findLatestLocalDataset();
  if (!latestLocal) {
    throw new Error('No local GP-practice mapping snapshot was found in the data folder');
  }
  const current = setCurrentDataset(latestLocal.filePath, {
    version: latestLocal.version,
    publicationLabel: publicationLabelFromVersion(latestLocal.version),
    publicationUrl: publicationUrlFromVersion(latestLocal.version),
  });
  datasetState.refresh.message = `Loaded local snapshot ${current.publicationLabel}.`;
}

function scoreNameMatch(queryNormalized, candidateNormalized) {
  const q = queryNormalized;
  const c = candidateNormalized;
  if (!q || !c) return 0;
  if (q === c) return 100;
  let score = 0;
  if (c.includes(q) || q.includes(c)) score += 55;
  const qWords = new Set(q.split(' '));
  const cWords = new Set(c.split(' '));
  for (const word of qWords) {
    if (cWords.has(word)) score += 12;
  }
  return score;
}

function buildPracticeCandidate(entry) {
  return {
    practiceName: entry.practiceName,
    practiceCode: entry.practiceCode,
    postcode: entry.postcode,
  };
}

function createAmbiguousPracticeError(query, candidates) {
  const error = new Error(`Multiple official GP practices matched "${query}". Choose one of the suggested practices to continue.`);
  error.code = 'AMBIGUOUS_PRACTICE_MATCH';
  error.candidates = candidates;
  return error;
}

function maybeGetAmbiguousMatches(ranked, normalizedQuery) {
  if (!ranked.length) return null;

  const exactMatches = ranked.filter((entry) => entry.normalizedPracticeName === normalizedQuery);
  if (exactMatches.length > 1) {
    return exactMatches.slice(0, 6).map(buildPracticeCandidate);
  }
  if (exactMatches.length === 1) {
    return null;
  }

  const bestScore = ranked[0].score;
  if (bestScore < 55) {
    return null;
  }

  const threshold = Math.max(67, bestScore - 8);
  const closeMatches = ranked.filter((entry) => entry.score >= threshold).slice(0, 6);
  return closeMatches.length > 1 ? closeMatches.map(buildPracticeCandidate) : null;
}

function verifyPracticeFromDataset(practiceName, { practiceCode = '' } = {}) {
  if (!practiceMap.length) {
    throw new Error('Practice dataset not loaded');
  }

  if (practiceCode) {
    const exactPractice = practiceMap.find((entry) => entry.practiceCode === practiceCode);
    if (!exactPractice) {
      throw new Error('Selected GP practice code was not found in the current dataset');
    }
    return {
      title: exactPractice.practiceName,
      postcode: exactPractice.postcode,
      sourceUrl: datasetState.current?.publicationUrl || PRACTICE_SERIES_URL,
      source: 'nhs-england-digital-gp-snapshot',
      practiceCode: exactPractice.practiceCode,
    };
  }

  const normalizedQuery = normalizeName(practiceName);

  const ranked = practiceMap
    .map((entry) => ({ ...entry, score: scoreNameMatch(normalizedQuery, entry.normalizedPracticeName) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  const ambiguousMatches = maybeGetAmbiguousMatches(ranked, normalizedQuery);
  if (ambiguousMatches) {
    throw createAmbiguousPracticeError(practiceName, ambiguousMatches);
  }

  const best = ranked[0];
  if (!best || best.score < 55) {
    throw new Error('No official GP practice match was found in the NHS England Digital mapping data');
  }

  return {
    title: best.practiceName,
    postcode: best.postcode,
    sourceUrl: datasetState.current?.publicationUrl || PRACTICE_SERIES_URL,
    source: 'nhs-england-digital-gp-snapshot',
    practiceCode: best.practiceCode,
  };
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const radiusKm = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * radiusKm * Math.asin(Math.sqrt(a));
}

function nearestHubForCoords(records, lat, lon) {
  const viable = records.filter((hub) => Number.isFinite(hub.lat) && Number.isFinite(hub.lon));
  if (!viable.length) {
    throw new Error('No hub coordinate data is available for matching');
  }
  return viable
    .map((hub) => ({ ...hub, distanceKm: haversineKm(lat, lon, hub.lat, hub.lon) }))
    .sort((a, b) => a.distanceKm - b.distanceKm)[0];
}

async function geocodePostcode(postcode) {
  const response = await fetch(`${POSTCODE_API}${encodeURIComponent(postcode)}`);
  const payload = await response.json();
  if (!response.ok || !payload.result) {
    throw new Error(payload.error || 'Postcode lookup failed');
  }
  return payload.result;
}

async function hydrateRecordsByPostcode(records, label, recordLabelSelector) {
  await Promise.all(records.map(async (record) => {
    if (!record.postcode) return;
    try {
      const geo = await geocodePostcode(record.postcode);
      record.lat = geo.latitude;
      record.lon = geo.longitude;
      record.postcode = geo.postcode;
    } catch (error) {
      console.warn(`${label} coordinate lookup failed for ${recordLabelSelector(record)}: ${error.message}`);
    }
  }));
}

async function hydrateSupportDatasets() {
  await Promise.all([
    hydrateRecordsByPostcode(scHubRecords, 'SC-CRDC', (record) => record.hubName || record.site || 'unknown SC-CRDC'),
    hydrateRecordsByPostcode(primaryCareCtuRecords, 'Primary Care - CTU', (record) => record.ctuCode || record.site || 'unknown CTU'),
    hydrateRecordsByPostcode(secondaryCareCtuRecords, 'Secondary Care - CTU', (record) => record.ctuCode || record.site || 'unknown CTU'),
  ]);
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: { 'user-agent': 'Research Map Hub-Spoke App/1.0' },
  });
  if (!response.ok) {
    throw new Error(`Request failed for ${url} (${response.status})`);
  }
  return response.text();
}

async function fetchBuffer(url) {
  const response = await fetch(url, {
    headers: { 'user-agent': 'Research Map Hub-Spoke App/1.0' },
  });
  if (!response.ok) {
    throw new Error(`Download failed for ${url} (${response.status})`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

function extractPublicationCandidates(seriesHtml) {
  const candidates = new Map();
  const regex = /href="([^"]*\/patients-registered-at-a-gp-practice\/([a-z]+)-(\d{4})\/?(?:#[^"]*)?)"/gi;
  let match;
  while ((match = regex.exec(seriesHtml)) !== null) {
    const monthLower = match[2].toLowerCase();
    const monthNumber = MONTH_NAME_TO_NUMBER.get(monthLower);
    if (!monthNumber) continue;
    const version = `${match[3]}-${monthNumber}`;
    const publicationUrl = new URL(match[1], PRACTICE_SERIES_URL).href.replace(/\/$/, '');
    if (!candidates.has(version)) {
      candidates.set(version, {
        version,
        publicationLabel: `${titleCaseMonth(monthLower)} ${match[3]}`,
        publicationUrl,
      });
    }
  }

  return [...candidates.values()].sort((a, b) => b.version.localeCompare(a.version));
}

function extractMappingResourceFromPage(pageHtml, publicationUrl) {
  const regex = /<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = regex.exec(pageHtml)) !== null) {
    const href = new URL(match[1], publicationUrl).href;
    const linkText = stripTags(match[2]);
    if (!/mapping/i.test(linkText) || !/gp practice/i.test(linkText)) continue;
    const resourceType = /\.zip(?:$|\?)/i.test(href) || /\bzip\b/i.test(linkText) ? 'zip' : 'csv';
    return {
      mappingResourceUrl: href,
      resourceType,
      resourceLabel: linkText,
    };
  }
  return null;
}

async function findLatestPublishedDataset() {
  const seriesHtml = await fetchText(PRACTICE_SERIES_URL);
  const candidates = extractPublicationCandidates(seriesHtml);

  for (const candidate of candidates) {
    const pageHtml = await fetchText(candidate.publicationUrl);
    const resource = extractMappingResourceFromPage(pageHtml, candidate.publicationUrl);
    if (resource) {
      return { ...candidate, ...resource };
    }
  }

  throw new Error('No published GP-practice mapping resource was found on the NHS England Digital series page');
}

async function extractCsvFromZip(zipPath) {
  const { stdout: fileListing } = await execFileAsync('unzip', ['-Z1', zipPath], {
    maxBuffer: 16 * 1024 * 1024,
  });
  const csvEntry = String(fileListing)
    .split(/\r?\n/)
    .find((line) => line.toLowerCase().endsWith('.csv'));

  if (!csvEntry) {
    throw new Error('No CSV file was found in the downloaded archive');
  }

  const { stdout } = await execFileAsync('unzip', ['-p', zipPath, csvEntry], {
    encoding: 'buffer',
    maxBuffer: 32 * 1024 * 1024,
  });
  return Buffer.isBuffer(stdout) ? stdout : Buffer.from(stdout);
}

async function ensureDatasetOnDisk(datasetInfo) {
  const targetFilePath = path.join(DATA_DIR, datasetFileNameFromVersion(datasetInfo.version));
  if (fs.existsSync(targetFilePath)) {
    return { filePath: targetFilePath, downloaded: false };
  }

  if (datasetInfo.resourceType === 'csv') {
    const csvBuffer = await fetchBuffer(datasetInfo.mappingResourceUrl);
    await fsp.writeFile(targetFilePath, csvBuffer);
    return { filePath: targetFilePath, downloaded: true };
  }

  const tempZipPath = path.join(DATA_DIR, `${DATASET_PREFIX}${datasetInfo.version}.zip`);
  try {
    const zipBuffer = await fetchBuffer(datasetInfo.mappingResourceUrl);
    await fsp.writeFile(tempZipPath, zipBuffer);
    const csvBuffer = await extractCsvFromZip(tempZipPath);
    await fsp.writeFile(targetFilePath, csvBuffer);
    return { filePath: targetFilePath, downloaded: true };
  } finally {
    if (fs.existsSync(tempZipPath)) {
      await fsp.unlink(tempZipPath).catch(() => {});
    }
  }
}

function buildDatasetStatusPayload() {
  return {
    dataset: datasetState.current ? {
      fileName: datasetState.current.fileName,
      version: datasetState.current.version,
      publicationLabel: datasetState.current.publicationLabel,
      publicationUrl: datasetState.current.publicationUrl,
      mappingResourceUrl: datasetState.current.mappingResourceUrl,
      rowCount: datasetState.current.rowCount,
      loadedAt: datasetState.current.loadedAt,
    } : null,
    refresh: {
      ...datasetState.refresh,
      automaticCheckHours: REFRESH_INTERVAL_HOURS,
    },
  };
}

async function refreshPracticeDataset({ reason = 'manual' } = {}) {
  if (datasetRefreshPromise) {
    return datasetRefreshPromise;
  }

  datasetRefreshPromise = (async () => {
    datasetState.refresh.inProgress = true;
    datasetState.refresh.mode = reason;
    datasetState.refresh.lastAttemptedAt = new Date().toISOString();

    try {
      const latestPublished = await findLatestPublishedDataset();
      datasetState.refresh.lastCheckedAt = new Date().toISOString();

      const currentVersion = datasetState.current?.version || '';
      if (datasetState.current && latestPublished.version <= currentVersion) {
        datasetState.current.publicationLabel = latestPublished.publicationLabel;
        datasetState.current.publicationUrl = latestPublished.publicationUrl;
        datasetState.current.mappingResourceUrl = latestPublished.mappingResourceUrl;
        datasetState.refresh.lastResult = 'up_to_date';
        datasetState.refresh.message = `Current dataset ${datasetState.current.publicationLabel} is already the latest published snapshot.`;
      } else {
        const fileResult = await ensureDatasetOnDisk(latestPublished);
        setCurrentDataset(fileResult.filePath, latestPublished);
        datasetState.refresh.lastUpdatedAt = new Date().toISOString();
        datasetState.refresh.lastResult = fileResult.downloaded ? 'updated' : 'reloaded';
        datasetState.refresh.message = fileResult.downloaded
          ? `Downloaded and activated the ${latestPublished.publicationLabel} GP-practice mapping snapshot.`
          : `Activated the already-downloaded ${latestPublished.publicationLabel} GP-practice mapping snapshot.`;
      }
    } catch (error) {
      datasetState.refresh.lastCheckedAt = new Date().toISOString();
      datasetState.refresh.lastResult = 'error';
      datasetState.refresh.message = `Dataset refresh check failed: ${error.message}`;
    } finally {
      datasetState.refresh.inProgress = false;
      datasetRefreshPromise = null;
    }

    return buildDatasetStatusPayload();
  })();

  return datasetRefreshPromise;
}

async function handleResolvePractice(res, parsedUrl) {
  const practice = parsedUrl.searchParams.get('practice')?.trim();
  const postcodeOverride = parsedUrl.searchParams.get('postcode')?.trim();
  const practiceCode = parsedUrl.searchParams.get('practiceCode')?.trim();
  if (!practice) {
    sendJson(res, 400, { error: 'Missing practice parameter' });
    return;
  }

  try {
    await supportDatasetHydrationPromise;
    const verified = verifyPracticeFromDataset(practice, { practiceCode });
    const postcode = postcodeOverride || verified.postcode;
    if (!postcode) {
      throw new Error('Verified practice record did not include a postcode');
    }
    const geo = await geocodePostcode(postcode);
    const nearestPcHub = nearestHubForCoords(pcHubRecords, geo.latitude, geo.longitude);
    const nearestScHub = nearestHubForCoords(scHubRecords, geo.latitude, geo.longitude);
    const nearestAcademicInstitution = nearestHubForCoords(academicInstitutionRecords, geo.latitude, geo.longitude);
    const nearestPrimaryCareCtu = nearestHubForCoords(primaryCareCtuRecords, geo.latitude, geo.longitude);
    const nearestSecondaryCareCtu = nearestHubForCoords(secondaryCareCtuRecords, geo.latitude, geo.longitude);
    sendJson(res, 200, {
      ok: true,
      inputPractice: practice,
      verifiedPractice: {
        name: verified.title,
        postcode,
        sourceUrl: verified.sourceUrl,
        source: verified.source,
        practiceCode: verified.practiceCode,
      },
      postcodeLookup: {
        postcode: geo.postcode,
        latitude: geo.latitude,
        longitude: geo.longitude,
      },
      nearestPcHub: {
        id: nearestPcHub.id,
        hubName: nearestPcHub.hubName,
        site: nearestPcHub.site,
        url: nearestPcHub.url,
        distanceKm: nearestPcHub.distanceKm,
      },
      nearestScHub: {
        id: nearestScHub.id,
        hubName: nearestScHub.hubName,
        site: nearestScHub.site,
        url: nearestScHub.url,
        distanceKm: nearestScHub.distanceKm,
      },
      nearestAcademicInstitution: {
        id: nearestAcademicInstitution.id,
        institutionCode: nearestAcademicInstitution.institutionCode,
        locationLabel: nearestAcademicInstitution.locationLabel,
        site: nearestAcademicInstitution.site,
        url: nearestAcademicInstitution.url || null,
        distanceKm: nearestAcademicInstitution.distanceKm,
      },
      nearestPrimaryCareCtu: {
        id: nearestPrimaryCareCtu.id,
        ctuCode: nearestPrimaryCareCtu.ctuCode,
        locationLabel: nearestPrimaryCareCtu.locationLabel,
        site: nearestPrimaryCareCtu.site,
        url: nearestPrimaryCareCtu.url || null,
        distanceKm: nearestPrimaryCareCtu.distanceKm,
      },
      nearestSecondaryCareCtu: {
        id: nearestSecondaryCareCtu.id,
        ctuCode: nearestSecondaryCareCtu.ctuCode,
        locationLabel: nearestSecondaryCareCtu.locationLabel,
        site: nearestSecondaryCareCtu.site,
        url: nearestSecondaryCareCtu.url || null,
        distanceKm: nearestSecondaryCareCtu.distanceKm,
      },
      dataset: buildDatasetStatusPayload().dataset,
      nhsSearchUrl: `https://www.nhs.uk/service-search/find-a-gp/?locationName=${encodeURIComponent(postcode)}&suppressInvalidLoc=False`,
    });
  } catch (error) {
    if (error.code === 'AMBIGUOUS_PRACTICE_MATCH') {
      sendJson(res, 409, {
        ok: false,
        needsSelection: true,
        error: error.message,
        candidates: error.candidates,
      });
      return;
    }
    sendJson(res, 502, { ok: false, error: error.message });
  }
}

async function handleSeededPractices(res) {
  sendJson(res, 200, {
    practices: practiceSuggestions,
    dataset: buildDatasetStatusPayload().dataset,
  });
}

async function handleCentreRecords(res) {
  await supportDatasetHydrationPromise;
  sendJson(res, 200, {
    pcHubRecords: pcHubRecords.map((hub) => ({
      id: hub.id,
      hubName: hub.hubName,
      site: hub.site,
      address: hub.address || null,
      postcode: hub.postcode || null,
      url: hub.url || null,
      lat: hub.lat,
      lon: hub.lon,
    })),
    scHubRecords: scHubRecords.map((hub) => ({
      id: hub.id,
      hubName: hub.hubName,
      site: hub.site,
      address: hub.address || null,
      postcode: hub.postcode || null,
      url: hub.url || null,
      lat: hub.lat,
      lon: hub.lon,
    })),
    academicInstitutionRecords: academicInstitutionRecords.map((institution) => ({
      id: institution.id,
      institutionCode: institution.institutionCode,
      locationLabel: institution.locationLabel,
      site: institution.site,
      url: institution.url || null,
      sourceBasis: institution.sourceBasis || null,
      lat: institution.lat,
      lon: institution.lon,
    })),
    primaryCareCtuRecords: primaryCareCtuRecords.map((ctu) => ({
      id: ctu.id,
      ctuCode: ctu.ctuCode,
      locationLabel: ctu.locationLabel,
      site: ctu.site,
      postcode: ctu.postcode || null,
      url: ctu.url || null,
      lat: ctu.lat,
      lon: ctu.lon,
    })),
    secondaryCareCtuRecords: secondaryCareCtuRecords.map((ctu) => ({
      id: ctu.id,
      ctuCode: ctu.ctuCode,
      locationLabel: ctu.locationLabel,
      site: ctu.site,
      postcode: ctu.postcode || null,
      url: ctu.url || null,
      lat: ctu.lat,
      lon: ctu.lon,
      ukcrcRegistrationId: ctu.ukcrcRegistrationId || null,
      note: ctu.note || null,
      sourceBasis: ctu.sourceBasis || null,
    })),
  });
}

async function handleDatasetStatus(res) {
  sendJson(res, 200, buildDatasetStatusPayload());
}

async function handleRefreshPracticeData(res) {
  const payload = await refreshPracticeDataset({ reason: 'manual' });
  sendJson(res, payload.refresh.lastResult === 'error' ? 502 : 200, {
    ok: payload.refresh.lastResult !== 'error',
    datasetStatus: payload,
  });
}

initializePracticeDataset();

supportDatasetHydrationPromise = hydrateSupportDatasets().catch((error) => {
  console.warn(`Support dataset coordinate hydration failed: ${error.message}`);
});

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);

  if (parsedUrl.pathname === '/api/resolve-practice') {
    await handleResolvePractice(res, parsedUrl);
    return;
  }

  if (parsedUrl.pathname === '/api/seeded-practices') {
    await handleSeededPractices(res);
    return;
  }

  if (parsedUrl.pathname === '/api/centre-records') {
    await handleCentreRecords(res);
    return;
  }

  if (parsedUrl.pathname === '/api/practice-dataset-status') {
    await handleDatasetStatus(res);
    return;
  }

  if (parsedUrl.pathname === '/api/refresh-practice-data') {
    if (req.method !== 'POST') {
      sendJson(res, 405, { error: 'Method not allowed' });
      return;
    }
    await handleRefreshPracticeData(res);
    return;
  }

  if (parsedUrl.pathname === '/healthz') {
    sendText(res, 200, 'ok');
    return;
  }

  const filePath = resolvePublicFilePath(parsedUrl.pathname);
  if (!filePath) {
    sendJson(res, 404, { error: 'Not found' });
    return;
  }
  sendFile(res, filePath);
});

server.listen(PORT, HOST, () => {
  const displayHost = HOST === '0.0.0.0' ? 'localhost' : HOST;
  console.log(`Hub-spoke app listening on http://${displayHost}:${PORT}`);
  refreshPracticeDataset({ reason: 'startup' }).catch((error) => {
    console.error(`Startup dataset refresh failed: ${error.message}`);
  });
  const timer = setInterval(() => {
    refreshPracticeDataset({ reason: 'scheduled' }).catch((error) => {
      console.error(`Scheduled dataset refresh failed: ${error.message}`);
    });
  }, REFRESH_INTERVAL_MS);
  if (typeof timer.unref === 'function') timer.unref();
});
