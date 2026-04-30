const SVG_NS = 'http://www.w3.org/2000/svg';
const NHS_GP_SEARCH = 'https://www.nhs.uk/service-search/find-a-gp/';
const XLINK_NS = 'http://www.w3.org/1999/xlink';
const APP_ASSET_VERSION = '2026-04-30y';
const CLEAN_MAP_ASSET_URL = `./assets/UK_CRDC_Map_clean.png?v=${APP_ASSET_VERSION}`;
const MAP_RECT = { x: 875, y: 76, w: 635, h: 910 };
const MAP_UNDERLAY_SHIFT_X = 26;
const UK_GEO_BOUNDS = { west: -8.8, east: 2.1, north: 59.4, south: 49.6 };

const DIAGRAM_LINKS = {
  cprd: 'https://www.cprd.com/',
  nihrIndustryHubs: 'https://www.nihr.ac.uk/support-and-services/industry/life-sciences-industry-hub',
  nihrHealthTechHubs: 'https://www.nihr.ac.uk/support-and-services/industry/explore/healthtech-research-centres',
  rdn: 'https://rdn.nihr.ac.uk/',
  researchReady: 'https://www.rcgp.org.uk/representing-you/research-at-rcgp/research-ready',
  opc: 'https://www.optimumpatientcare.org',
  medicys: 'https://medicysltd.co.uk',
};

let pcHubRecords = [];
let scHubRecords = [];
let academicInstitutionRecords = [];
let primaryCareCtuRecords = [];
let secondaryCareCtuRecords = [];
let centreRecordsPromise = null;
let activeResolveRequestId = 0;

const state = {
  inputPracticeName: '',
  practiceLabel: 'Research Active GP Practice 1',
  verifiedPracticeName: null,
  verifiedPracticePostcode: null,
  verifiedPracticeUrl: null,
  verifiedPracticeCode: null,
  activePcHubId: null,
  activePcDistanceKm: null,
  activeScHubId: null,
  activeScDistanceKm: null,
  activeAcademicInstitutionId: null,
  activeAcademicDistanceKm: null,
  activePrimaryCareCtuId: null,
  activePrimaryCareCtuDistanceKm: null,
  activeSecondaryCareCtuId: null,
  activeSecondaryCareCtuDistanceKm: null,
  hoveredMapRecordType: null,
  hoveredMapRecordId: null,
  activePostcode: '',
  verificationSource: null,
  datasetStatus: null,
  selectedPracticeCode: null,
};

const practiceInput = document.querySelector('#practice-input');
const practiceOptions = document.querySelector('#practice-options');
const postcodeInput = document.querySelector('#postcode-input');
const resolveButton = document.querySelector('#resolve-button');
const refreshDatasetButton = document.querySelector('#refresh-dataset-button');
const nhsLink = document.querySelector('#nhs-link');
const statusHub = document.querySelector('#status-hub');
const statusDetail = document.querySelector('#status-detail');
const pcLegend = document.querySelector('#pc-hub-legend');
const scLegend = document.querySelector('#sc-hub-legend');
const universityLegend = document.querySelector('#university-legend');
const ctuLegend = document.querySelector('#ctu-legend');
const scCtuLegend = document.querySelector('#sc-ctu-legend');
const practiceMatchPanel = document.querySelector('#practice-match-panel');
const practiceMatchTitle = document.querySelector('#practice-match-title');
const practiceMatchMessage = document.querySelector('#practice-match-message');
const practiceMatchOptions = document.querySelector('#practice-match-options');
const diagramPanel = document.querySelector('.diagram-panel');
const legendPanel = document.querySelector('.legend-panel');
const underlayLayer = document.querySelector('#diagram-underlay');
const lineLayer = document.querySelector('#diagram-lines');
const nodeLayer = document.querySelector('#diagram-nodes');

const summaryEntered = document.querySelector('#summary-entered');
const summaryVerified = document.querySelector('#summary-verified');
const summaryCode = document.querySelector('#summary-code');
const summaryPostcode = document.querySelector('#summary-postcode');
const summaryPcHub = document.querySelector('#summary-pc-hub');
const summaryPcDistance = document.querySelector('#summary-pc-distance');
const summaryScHub = document.querySelector('#summary-sc-hub');
const summaryScDistance = document.querySelector('#summary-sc-distance');
const summaryAcademicHub = document.querySelector('#summary-academic-hub');
const summaryAcademicDistance = document.querySelector('#summary-academic-distance');
const summaryCtuHub = document.querySelector('#summary-ctu-hub');
const summaryCtuDistance = document.querySelector('#summary-ctu-distance');
const summaryScCtuHub = document.querySelector('#summary-sc-ctu-hub');
const summaryScCtuDistance = document.querySelector('#summary-sc-ctu-distance');
const summarySource = document.querySelector('#summary-source');

function createSvgEl(tag, attrs = {}) {
  const el = document.createElementNS(SVG_NS, tag);
  Object.entries(attrs).forEach(([key, value]) => {
    if (key === 'xlink:href') {
      el.setAttributeNS(XLINK_NS, key, String(value));
      return;
    }
    el.setAttribute(key, String(value));
  });
  return el;
}

function syncLegendPanelHeight() {
  if (!diagramPanel || !legendPanel) return;
  if (window.innerWidth <= 1220) {
    legendPanel.style.height = '';
    return;
  }
  const nextHeight = Math.round(diagramPanel.getBoundingClientRect().height);
  if (nextHeight > 0) {
    legendPanel.style.height = `${nextHeight}px`;
  }
}

function clearChildren(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

function drawRect(group, { x, y, w, h, rx = 24, fill = 'rgba(255,255,255,0.92)', stroke = '#151515', sw = 3 }) {
  group.appendChild(createSvgEl('rect', { x, y, width: w, height: h, rx, ry: rx, fill, stroke, 'stroke-width': sw }));
}

function drawCircle(group, { cx, cy, r, fill = '#ffffff', stroke = '#151515', sw = 3 }) {
  group.appendChild(createSvgEl('circle', { cx, cy, r, fill, stroke, 'stroke-width': sw }));
}

function drawLine(group, { x1, y1, x2, y2, sw = 4, dash = null, stroke = '#151515' }) {
  const attrs = { x1, y1, x2, y2, stroke, 'stroke-width': sw, 'stroke-linecap': 'round' };
  if (dash) attrs['stroke-dasharray'] = dash;
  group.appendChild(createSvgEl('line', attrs));
}

function drawText(group, { x, y, lines, size = 30, color = '#121212', anchor = 'middle', weight = 400, href = null, lineGap = 1.2 }) {
  const parent = href
    ? createSvgEl('a', { href, 'xlink:href': href, target: '_blank', rel: 'noreferrer noopener' })
    : group;
  const startY = y - ((lines.length - 1) * size * lineGap) / 2;
  lines.forEach((line, index) => {
    const text = createSvgEl('text', {
      x,
      y: startY + index * size * lineGap,
      'text-anchor': anchor,
      'font-family': 'Georgia, Times New Roman, serif',
      'font-size': size,
      'font-weight': weight,
      fill: color,
      style: href ? 'cursor:pointer;' : '',
    });
    text.textContent = line;
    parent.appendChild(text);
  });
  if (href) group.appendChild(parent);
}

function wrap(text, width = 24) {
  const words = text.split(' ');
  const lines = [];
  let current = '';
  for (const word of words) {
    const trial = current ? `${current} ${word}` : word;
    if (trial.length <= width) current = trial;
    else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function projectToUkMap(lat, lon) {
  const xNorm = (lon - UK_GEO_BOUNDS.west) / (UK_GEO_BOUNDS.east - UK_GEO_BOUNDS.west);
  const yNorm = (UK_GEO_BOUNDS.north - lat) / (UK_GEO_BOUNDS.north - UK_GEO_BOUNDS.south);
  return {
    x: MAP_RECT.x + xNorm * MAP_RECT.w,
    y: MAP_RECT.y + yNorm * MAP_RECT.h,
  };
}

function rectBoundaryPoint(node, target) {
  const dx = target.x - node.x;
  const dy = target.y - node.y;
  const halfW = node.w / 2;
  const halfH = node.h / 2;
  const sx = halfW / Math.abs(dx || 1e-6);
  const sy = halfH / Math.abs(dy || 1e-6);
  const scale = Math.min(sx, sy);
  return {
    x: node.x + dx * scale,
    y: node.y + dy * scale,
  };
}

function layoutProjectedCentres() {
  const allEntries = [
    ...pcHubRecords
      .filter((hub) => Number.isFinite(hub.lat) && Number.isFinite(hub.lon))
      .map((hub) => ({ type: 'pc', id: hub.id, base: projectToUkMap(hub.lat, hub.lon) })),
    ...scHubRecords
      .filter((hub) => Number.isFinite(hub.lat) && Number.isFinite(hub.lon))
      .map((hub) => ({ type: 'sc', id: hub.id, base: projectToUkMap(hub.lat, hub.lon) })),
    ...academicInstitutionRecords
      .filter((institution) => Number.isFinite(institution.lat) && Number.isFinite(institution.lon))
      .map((institution) => ({ type: 'university', id: institution.id, base: projectToUkMap(institution.lat, institution.lon) })),
    ...primaryCareCtuRecords
      .filter((ctu) => Number.isFinite(ctu.lat) && Number.isFinite(ctu.lon))
      .map((ctu) => ({ type: 'pc-ctu', id: ctu.id, base: projectToUkMap(ctu.lat, ctu.lon) })),
    ...secondaryCareCtuRecords
      .filter((ctu) => Number.isFinite(ctu.lat) && Number.isFinite(ctu.lon))
      .map((ctu) => ({ type: 'sc-ctu', id: ctu.id, base: projectToUkMap(ctu.lat, ctu.lon) })),
  ];

  const groups = new Map();
  allEntries.forEach((entry) => {
    const key = `${Math.round(entry.base.x / 20)}:${Math.round(entry.base.y / 20)}`;
    const existing = groups.get(key) || [];
    existing.push(entry);
    groups.set(key, existing);
  });

  const pcPositions = new Map();
  const scPositions = new Map();
  const universityPositions = new Map();
  const pcCtuPositions = new Map();
  const scCtuPositions = new Map();

  groups.forEach((entries) => {
    entries.forEach((entry, index) => {
      const angle = entries.length === 1 ? 0 : (-Math.PI / 2) + ((Math.PI * 2 * index) / entries.length);
      const radius = entries.length === 1 ? 0 : Math.min(28, 8 + (entries.length - 1) * 2.2);
      const point = {
        x: entry.base.x + Math.cos(angle) * radius,
        y: entry.base.y + Math.sin(angle) * radius,
      };
      if (entry.type === 'pc') pcPositions.set(entry.id, point);
      else if (entry.type === 'sc') scPositions.set(entry.id, point);
      else if (entry.type === 'university') universityPositions.set(entry.id, point);
      else if (entry.type === 'pc-ctu') pcCtuPositions.set(entry.id, point);
      else scCtuPositions.set(entry.id, point);
    });
  });

  return { pcPositions, scPositions, universityPositions, pcCtuPositions, scCtuPositions };
}

async function loadCentreRecords() {
  if (centreRecordsPromise) return centreRecordsPromise;
  centreRecordsPromise = (async () => {
    const response = await fetch('/api/centre-records');
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || 'Centre records could not be loaded');
    }
    pcHubRecords = payload.pcHubRecords || [];
    scHubRecords = payload.scHubRecords || [];
    academicInstitutionRecords = payload.academicInstitutionRecords || [];
    primaryCareCtuRecords = payload.primaryCareCtuRecords || [];
    secondaryCareCtuRecords = payload.secondaryCareCtuRecords || [];
    syncLegend();
    renderVerificationSummary();
    drawDiagram();
    syncStatus();
    return payload;
  })().catch((error) => {
    centreRecordsPromise = null;
    throw error;
  });
  return centreRecordsPromise;
}

function pcHubById(id) {
  return pcHubRecords.find((hub) => hub.id === id);
}

function scHubById(id) {
  return scHubRecords.find((hub) => hub.id === id);
}

function academicInstitutionById(id) {
  return academicInstitutionRecords.find((institution) => institution.id === id);
}

function primaryCareCtuById(id) {
  return primaryCareCtuRecords.find((ctu) => ctu.id === id);
}

function secondaryCareCtuById(id) {
  return secondaryCareCtuRecords.find((ctu) => ctu.id === id);
}

function hasHoveredMapRecord() {
  return Boolean(state.hoveredMapRecordType) && state.hoveredMapRecordId !== null;
}

function hasCentreRecordCache() {
  return Boolean(
    pcHubRecords.length
    && scHubRecords.length
    && academicInstitutionRecords.length
    && primaryCareCtuRecords.length
    && secondaryCareCtuRecords.length
  );
}

function isHoveredMapRecord(type, id) {
  return state.hoveredMapRecordType === type && state.hoveredMapRecordId === id;
}

function hasActiveMapSelection() {
  return Boolean(
    state.activePcHubId
    || state.activeScHubId
    || state.activeAcademicInstitutionId
    || state.activePrimaryCareCtuId
    || state.activeSecondaryCareCtuId,
  );
}

function hoverInspectionEnabled() {
  return !hasActiveMapSelection();
}

function setHoveredMapRecord(type, id) {
  if (isHoveredMapRecord(type, id)) return;
  state.hoveredMapRecordType = type;
  state.hoveredMapRecordId = id;
  drawDiagram();
}

function clearHoveredMapRecord(type, id) {
  if (!hasHoveredMapRecord()) return;
  if (type && id !== undefined && !isHoveredMapRecord(type, id)) return;
  state.hoveredMapRecordType = null;
  state.hoveredMapRecordId = null;
  drawDiagram();
}

function projectedRecordVisualState(type, id, activeId) {
  if (hasHoveredMapRecord()) {
    const matched = isHoveredMapRecord(type, id);
    return { visible: matched, active: matched };
  }

  const active = Boolean(activeId) && activeId === id;
  return {
    visible: hasActiveMapSelection() ? active : true,
    active,
  };
}

function bindLegendHover(li, type, id) {
  li.addEventListener('pointerenter', () => {
    if (!hoverInspectionEnabled()) return;
    li.classList.add('is-hover-preview');
    setHoveredMapRecord(type, id);
  });
  li.addEventListener('pointerleave', () => {
    li.classList.remove('is-hover-preview');
    clearHoveredMapRecord(type, id);
  });
}

function setFieldText(node, value, fallback) {
  node.textContent = value || fallback;
}

function setFieldLink(node, label, href, fallback) {
  clearChildren(node);
  if (!label) {
    node.textContent = fallback;
    return;
  }
  if (href) {
    node.appendChild(createExternalLink(label, href));
    return;
  }
  node.textContent = label;
}

function createExternalLink(label, href, className = '') {
  const link = document.createElement('a');
  link.href = href;
  link.target = '_blank';
  link.rel = 'noreferrer noopener';
  link.textContent = label;
  if (className) link.className = className;
  return link;
}

function setNodeChildren(node, ...children) {
  clearChildren(node);
  children.filter(Boolean).forEach((child) => node.appendChild(child));
}

function clearVerificationState() {
  state.verifiedPracticeName = null;
  state.verifiedPracticePostcode = null;
  state.verifiedPracticeUrl = null;
  state.verifiedPracticeCode = null;
  state.verificationSource = null;
  state.activePcHubId = null;
  state.activePcDistanceKm = null;
  state.activeScHubId = null;
  state.activeScDistanceKm = null;
  state.activeAcademicInstitutionId = null;
  state.activeAcademicDistanceKm = null;
  state.activePrimaryCareCtuId = null;
  state.activePrimaryCareCtuDistanceKm = null;
  state.activeSecondaryCareCtuId = null;
  state.activeSecondaryCareCtuDistanceKm = null;
  state.activePostcode = '';
}

function hidePracticeMatchPanel() {
  practiceMatchPanel.hidden = true;
  practiceMatchMessage.textContent = 'Choose the correct GP practice to continue.';
  clearChildren(practiceMatchOptions);
}

function showPracticeMatchPanel(message, candidates) {
  practiceMatchPanel.hidden = false;
  practiceMatchTitle.textContent = candidates.length > 1 ? 'Possible GP practice matches' : 'Possible GP practice match';
  practiceMatchMessage.textContent = message;
  clearChildren(practiceMatchOptions);
  const fragment = document.createDocumentFragment();
  candidates.forEach((candidate) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'match-option';
    button.dataset.practiceCode = candidate.practiceCode;
    button.dataset.practiceName = candidate.practiceName;

    const title = document.createElement('span');
    title.className = 'match-option-title';
    title.textContent = candidate.practiceName;

    const detail = document.createElement('span');
    detail.className = 'match-option-detail';
    detail.textContent = `${candidate.postcode} • ${candidate.practiceCode}`;

    button.append(title, detail);
    fragment.appendChild(button);
  });
  practiceMatchOptions.appendChild(fragment);
}

function renderVerificationSummary() {
  const pcHub = pcHubById(state.activePcHubId);
  const scHub = scHubById(state.activeScHubId);
  const academicInstitution = academicInstitutionById(state.activeAcademicInstitutionId);
  const primaryCareCtu = primaryCareCtuById(state.activePrimaryCareCtuId);
  const secondaryCareCtu = secondaryCareCtuById(state.activeSecondaryCareCtuId);
  const dataset = state.datasetStatus?.dataset;

  setFieldText(summaryEntered, state.inputPracticeName || state.practiceLabel, 'Not verified yet');
  setFieldText(summaryVerified, state.verifiedPracticeName, 'Not verified yet');
  setFieldText(summaryCode, state.verifiedPracticeCode, 'Not verified yet');
  setFieldText(summaryPostcode, state.verifiedPracticePostcode || state.activePostcode, 'Not verified yet');
  setFieldLink(summaryPcHub, pcHub ? `${pcHub.hubName}: ${pcHub.site}` : null, pcHub?.url, 'Not verified yet');
  setFieldText(
    summaryPcDistance,
    typeof state.activePcDistanceKm === 'number' ? `${state.activePcDistanceKm.toFixed(1)} km` : null,
    'Not verified yet',
  );
  setFieldLink(summaryScHub, scHub ? `${scHub.hubName}: ${scHub.site}` : null, scHub?.url, 'Not verified yet');
  setFieldText(
    summaryScDistance,
    typeof state.activeScDistanceKm === 'number' ? `${state.activeScDistanceKm.toFixed(1)} km` : null,
    'Not verified yet',
  );
  setFieldLink(
    summaryAcademicHub,
    academicInstitution ? `${academicInstitution.institutionCode}: ${academicInstitution.site}` : null,
    academicInstitution?.url,
    'Not verified yet',
  );
  setFieldText(
    summaryAcademicDistance,
    typeof state.activeAcademicDistanceKm === 'number' ? `${state.activeAcademicDistanceKm.toFixed(1)} km` : null,
    'Not verified yet',
  );
  setFieldLink(
    summaryCtuHub,
    primaryCareCtu ? `${primaryCareCtu.ctuCode}: ${primaryCareCtu.site}` : null,
    primaryCareCtu?.url,
    'Not verified yet',
  );
  setFieldText(
    summaryCtuDistance,
    typeof state.activePrimaryCareCtuDistanceKm === 'number' ? `${state.activePrimaryCareCtuDistanceKm.toFixed(1)} km` : null,
    'Not verified yet',
  );
  setFieldLink(
    summaryScCtuHub,
    secondaryCareCtu ? `${secondaryCareCtu.ctuCode}: ${secondaryCareCtu.site}` : null,
    secondaryCareCtu?.url,
    'Not verified yet',
  );
  setFieldText(
    summaryScCtuDistance,
    typeof state.activeSecondaryCareCtuDistanceKm === 'number' ? `${state.activeSecondaryCareCtuDistanceKm.toFixed(1)} km` : null,
    'Not verified yet',
  );

  if (state.verificationSource === 'nhs-england-digital-gp-snapshot') {
    const label = dataset?.publicationLabel
      ? `Official NHS England Digital GP-practice snapshot (${dataset.publicationLabel})`
      : 'Official NHS England Digital GP-practice snapshot';
    setFieldLink(summarySource, label, dataset?.publicationUrl || state.verifiedPracticeUrl, 'Waiting for verification');
  } else {
    setFieldText(summarySource, null, 'Waiting for verification');
  }
}

function renderDatasetStatus() {
  const refresh = state.datasetStatus?.refresh;
  refreshDatasetButton.disabled = Boolean(refresh?.inProgress);
  refreshDatasetButton.textContent = refresh?.inProgress
    ? 'Checking NHS snapshot…'
    : 'Check for newer NHS snapshot';
}

function applyDatasetStatus(statusPayload) {
  state.datasetStatus = statusPayload;
  renderDatasetStatus();
  renderVerificationSummary();
}

async function loadSeededPracticeNames() {
  const response = await fetch('/api/seeded-practices');
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || 'Practice suggestions could not be loaded');
  }
  clearChildren(practiceOptions);
  const fragment = document.createDocumentFragment();
  payload.practices.forEach((entry) => {
    const option = document.createElement('option');
    option.value = entry;
    fragment.appendChild(option);
  });
  practiceOptions.appendChild(fragment);
  if (!state.datasetStatus && payload.dataset) {
    applyDatasetStatus({
      dataset: payload.dataset,
      refresh: {
        inProgress: false,
        lastAttemptedAt: null,
        lastCheckedAt: null,
        lastUpdatedAt: null,
        lastResult: 'idle',
        message: 'Loaded the current practice list.',
        mode: 'startup',
        automaticCheckHours: 12,
      },
    });
  }
}

async function loadDatasetStatus() {
  const response = await fetch('/api/practice-dataset-status');
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || 'Dataset status could not be loaded');
  }
  applyDatasetStatus(payload);
}

async function refreshDatasetStatus() {
  if (state.datasetStatus?.refresh) {
    applyDatasetStatus({
      ...state.datasetStatus,
      refresh: {
        ...state.datasetStatus.refresh,
        inProgress: true,
        message: 'Checking the NHS England Digital publication series for a newer GP-practice mapping snapshot…',
      },
    });
  }

  const response = await fetch('/api/refresh-practice-data', { method: 'POST' });
  const payload = await response.json();
  if (!response.ok || !payload.datasetStatus) {
    throw new Error(payload.error || 'Dataset refresh failed');
  }
  applyDatasetStatus(payload.datasetStatus);
  await loadSeededPracticeNames();
}

function syncLegend() {
  clearChildren(pcLegend);
  clearChildren(scLegend);
  clearChildren(universityLegend);
  clearChildren(ctuLegend);
  clearChildren(scCtuLegend);
  const pcFragment = document.createDocumentFragment();
  pcHubRecords.forEach((hub) => {
    const li = document.createElement('li');
    if (state.activePcHubId === hub.id) li.classList.add('is-active');
    bindLegendHover(li, 'pc', hub.id);
    const index = document.createElement('span');
    index.className = 'hub-index';
    index.textContent = `PC ${hub.id}`;
    li.appendChild(index);
    li.appendChild(createExternalLink(hub.site, hub.url, 'hub-link'));
    pcFragment.appendChild(li);
  });
  pcLegend.appendChild(pcFragment);

  const scFragment = document.createDocumentFragment();
  scHubRecords.forEach((hub) => {
    const li = document.createElement('li');
    if (state.activeScHubId === hub.id) li.classList.add('is-active');
    bindLegendHover(li, 'sc', hub.id);
    const index = document.createElement('span');
    index.className = 'hub-index';
    index.textContent = `SC ${hub.id}`;
    li.appendChild(index);
    li.appendChild(hub.url ? createExternalLink(hub.site, hub.url, 'hub-link') : document.createTextNode(hub.site));
    scFragment.appendChild(li);
  });
  scLegend.appendChild(scFragment);

  const universityFragment = document.createDocumentFragment();
  academicInstitutionRecords.forEach((institution) => {
    const li = document.createElement('li');
    if (state.activeAcademicInstitutionId === institution.id) li.classList.add('is-active');
    bindLegendHover(li, 'university', institution.id);
    const index = document.createElement('span');
    index.className = 'hub-index';
    index.textContent = institution.institutionCode.replace(/(\D)(\d+)/, '$1 $2');
    li.appendChild(index);
    li.appendChild(institution.url ? createExternalLink(institution.site, institution.url, 'hub-link') : document.createTextNode(institution.site));
    universityFragment.appendChild(li);
  });
  universityLegend.appendChild(universityFragment);

  const ctuFragment = document.createDocumentFragment();
  primaryCareCtuRecords.forEach((ctu) => {
    const li = document.createElement('li');
    if (state.activePrimaryCareCtuId === ctu.id) li.classList.add('is-active');
    bindLegendHover(li, 'pc-ctu', ctu.id);
    const index = document.createElement('span');
    index.className = 'hub-index';
    index.textContent = ctu.ctuCode.replace(/(\D)(\d+)/, '$1 $2');
    li.appendChild(index);
    li.appendChild(ctu.url ? createExternalLink(ctu.site, ctu.url, 'hub-link') : document.createTextNode(ctu.site));
    ctuFragment.appendChild(li);
  });
  ctuLegend.appendChild(ctuFragment);

  const scCtuFragment = document.createDocumentFragment();
  secondaryCareCtuRecords.forEach((ctu) => {
    const li = document.createElement('li');
    if (state.activeSecondaryCareCtuId === ctu.id) li.classList.add('is-active');
    bindLegendHover(li, 'sc-ctu', ctu.id);
    const index = document.createElement('span');
    index.className = 'hub-index';
    index.textContent = ctu.ctuCode.replace(/(\D)(\d+)/, '$1 $2');
    li.appendChild(index);
    li.appendChild(ctu.url ? createExternalLink(ctu.site, ctu.url, 'hub-link') : document.createTextNode(ctu.site));
    scCtuFragment.appendChild(li);
  });
  scCtuLegend.appendChild(scCtuFragment);
}

function syncStatus(message = null) {
  if (message) {
    statusHub.textContent = message.title;
    statusDetail.textContent = message.detail;
    return;
  }
  const pcHub = pcHubById(state.activePcHubId);
  const scHub = scHubById(state.activeScHubId);
  const academicInstitution = academicInstitutionById(state.activeAcademicInstitutionId);
  const primaryCareCtu = primaryCareCtuById(state.activePrimaryCareCtuId);
  const secondaryCareCtu = secondaryCareCtuById(state.activeSecondaryCareCtuId);
  if (!pcHub && !scHub && !academicInstitution && !primaryCareCtu && !secondaryCareCtu) {
    statusHub.textContent = 'Waiting for verification';
    statusDetail.textContent = 'Enter a GP practice name and run the verification step.';
    return;
  }
  statusHub.textContent = 'Mapped local support network';
  const fragment = document.createDocumentFragment();
  if (state.verifiedPracticeName) {
    fragment.append(`Verified practice: ${state.verifiedPracticeName}. `);
  }
  fragment.append('Nearest PC-CRDC: ');
  if (pcHub?.url) fragment.appendChild(createExternalLink(pcHub.site, pcHub.url, 'hub-link'));
  else fragment.append(pcHub?.site || 'awaiting data');
  fragment.append('. ');
  fragment.append('Nearest SC-CRDC: ');
  if (scHub?.url) fragment.appendChild(createExternalLink(scHub.site, scHub.url, 'hub-link'));
  else fragment.append(scHub?.site || 'awaiting data');
  fragment.append('.');
  fragment.append(' Nearest academic department: ');
  if (academicInstitution?.url) fragment.appendChild(createExternalLink(academicInstitution.site, academicInstitution.url, 'hub-link'));
  else fragment.append(academicInstitution?.site || 'awaiting data');
  fragment.append('.');
  fragment.append(' Nearest PC-CTU: ');
  if (primaryCareCtu?.url) fragment.appendChild(createExternalLink(primaryCareCtu.site, primaryCareCtu.url, 'hub-link'));
  else fragment.append(primaryCareCtu?.site || 'awaiting data');
  fragment.append('.');
  fragment.append(' Nearest SC-CTU: ');
  if (secondaryCareCtu?.url) fragment.appendChild(createExternalLink(secondaryCareCtu.site, secondaryCareCtu.url, 'hub-link'));
  else fragment.append(secondaryCareCtu?.site || 'awaiting data');
  fragment.append('.');
  if (typeof state.activePcDistanceKm === 'number') {
    fragment.append(` PC-CRDC distance: ${state.activePcDistanceKm.toFixed(1)} km.`);
  }
  if (typeof state.activeScDistanceKm === 'number') {
    fragment.append(` SC-CRDC distance: ${state.activeScDistanceKm.toFixed(1)} km.`);
  }
  if (typeof state.activeAcademicDistanceKm === 'number') {
    fragment.append(` Academic department distance: ${state.activeAcademicDistanceKm.toFixed(1)} km.`);
  }
  if (typeof state.activePrimaryCareCtuDistanceKm === 'number') {
    fragment.append(` PC-CTU distance: ${state.activePrimaryCareCtuDistanceKm.toFixed(1)} km.`);
  }
  if (typeof state.activeSecondaryCareCtuDistanceKm === 'number') {
    fragment.append(` SC-CTU distance: ${state.activeSecondaryCareCtuDistanceKm.toFixed(1)} km.`);
  }
  if (state.verifiedPracticePostcode) {
    fragment.append(` Postcode used: ${state.verifiedPracticePostcode}.`);
  }
  const note = document.createElement('span');
  note.className = 'small-note';
  note.textContent = state.verificationSource === 'nhs-england-digital-gp-snapshot'
    ? 'Verified from the official NHS England Digital GP-practice mapping snapshot.'
    : 'Verified from the current practice dataset.';
  setNodeChildren(statusDetail, fragment, document.createElement('br'), note);
}

function drawDiagram() {
  clearChildren(underlayLayer);
  clearChildren(lineLayer);
  clearChildren(nodeLayer);

  const center = { x: 520, y: 520 };
  const pcHubNode = { x: 850, y: 410, w: 270, h: 106 };
  const scHubNode = { x: 850, y: 560, w: 270, h: 106 };
  const pcCtuNode = { x: 850, y: 710, w: 270, h: 106 };
  const scCtuNode = { x: 850, y: 850, w: 270, h: 106 };
  const industry = { x: 520, y: 152, w: 304, h: 92 };
  const mhra = { x: 210, y: 250, w: 236, h: 88 };
  const universities = { x: 850, y: 252, w: 250, h: 122 };
  const rcgp = { x: 205, y: 430, w: 220, h: 106 };
  const thirdParty = { x: 190, y: 600, w: 320, h: 126 };
  const nihr = { x: 520, y: 872, w: 304, h: 176 };

  const spokes = [industry, mhra, universities, rcgp, thirdParty, nihr, pcHubNode, scHubNode, pcCtuNode, scCtuNode];
  spokes.forEach((node) => {
    const dx = node.x - center.x;
    const dy = node.y - center.y;
    const magnitude = Math.hypot(dx, dy) || 1;
    const startX = center.x + (dx / magnitude) * 140;
    const startY = center.y + (dy / magnitude) * 140;
    const halfW = node.w / 2;
    const halfH = node.h / 2;
    const sx = halfW / Math.abs(dx || 1e-6);
    const sy = halfH / Math.abs(dy || 1e-6);
    const scale = Math.min(sx, sy);
    const endX = node.x - dx * scale;
    const endY = node.y - dy * scale;
    drawLine(lineLayer, { x1: startX, y1: startY, x2: endX, y2: endY, sw: node === nihr ? 4.5 : 3.5 });
  });

  const activePcHub = pcHubById(state.activePcHubId);
  const activeScHub = scHubById(state.activeScHubId);
  const activeAcademicInstitution = academicInstitutionById(state.activeAcademicInstitutionId);
  const activePrimaryCareCtu = primaryCareCtuById(state.activePrimaryCareCtuId);
  const activeSecondaryCareCtu = secondaryCareCtuById(state.activeSecondaryCareCtuId);
  underlayLayer.appendChild(createSvgEl('image', {
    x: MAP_RECT.x + MAP_UNDERLAY_SHIFT_X,
    y: MAP_RECT.y,
    width: MAP_RECT.w,
    height: MAP_RECT.h,
    href: CLEAN_MAP_ASSET_URL,
    'xlink:href': CLEAN_MAP_ASSET_URL,
    opacity: 0.42,
    preserveAspectRatio: 'xMidYMid meet',
    style: 'pointer-events:none;',
  }));

  const { pcPositions, scPositions, universityPositions, pcCtuPositions, scCtuPositions } = layoutProjectedCentres();

  academicInstitutionRecords.forEach((institution) => {
    const point = universityPositions.get(institution.id);
    if (!point) return;
    const start = rectBoundaryPoint(universities, point);
    const { visible, active } = projectedRecordVisualState('university', institution.id, state.activeAcademicInstitutionId);
    if (!visible) return;
    if (visible) {
      drawLine(lineLayer, {
        x1: start.x,
        y1: start.y,
        x2: point.x,
        y2: point.y,
        sw: active ? 2.4 : 1.55,
        stroke: active ? '#1f56cc' : 'rgba(120, 130, 63, 0.42)',
      });
    }
    drawCircle(nodeLayer, { cx: point.x, cy: point.y, r: active ? 17 : 14, fill: active ? '#dce6ff' : '#eef2db', stroke: active ? '#1f56cc' : '#6f7f48', sw: active ? 2.2 : 1.7 });
    drawCircle(nodeLayer, { cx: point.x, cy: point.y, r: active ? 8 : 6.6, fill: '#ffffff', stroke: active ? '#1f56cc' : '#6f7f48', sw: active ? 1.6 : 1.3 });
    drawText(nodeLayer, {
      x: point.x,
      y: point.y + 2.2,
      lines: [String(institution.id)],
      size: active ? (institution.id >= 10 ? 8.1 : 8.8) : institution.id >= 10 ? 7.4 : 8.1,
      weight: 700,
      color: active ? '#1f56cc' : '#596339',
    });
  });

  pcHubRecords.forEach((hub) => {
    const point = pcPositions.get(hub.id);
    if (!point) return;
    const { visible, active } = projectedRecordVisualState('pc', hub.id, state.activePcHubId);
    const start = rectBoundaryPoint(pcHubNode, point);
    if (!visible) return;
    if (visible) {
      drawLine(lineLayer, { x1: start.x, y1: start.y, x2: point.x, y2: point.y, sw: active ? 3.8 : 2.3, stroke: active ? '#1f56cc' : '#2d8096' });
    }
    drawCircle(nodeLayer, { cx: point.x, cy: point.y, r: active ? 25 : 20, fill: active ? '#dce6ff' : '#dff0f5', stroke: active ? '#1f56cc' : '#2a8aa4', sw: active ? 2.6 : 2.2 });
    drawCircle(nodeLayer, { cx: point.x, cy: point.y, r: active ? 13 : 10, fill: '#ffffff', stroke: active ? '#1f56cc' : '#2a8aa4', sw: 2 });
    drawText(nodeLayer, { x: point.x, y: point.y + 4, lines: [`P${hub.id}`], size: active ? 12 : 10, weight: 700, color: active ? '#1f56cc' : '#16697d' });
  });

  scHubRecords.forEach((hub) => {
    const point = scPositions.get(hub.id);
    if (!point) return;
    const { visible, active } = projectedRecordVisualState('sc', hub.id, state.activeScHubId);
    const start = rectBoundaryPoint(scHubNode, point);
    if (!visible) return;
    if (visible) {
      drawLine(lineLayer, { x1: start.x, y1: start.y, x2: point.x, y2: point.y, sw: active ? 3.6 : 2.1, stroke: active ? '#1f56cc' : '#6c5d84' });
    }
    drawCircle(nodeLayer, { cx: point.x, cy: point.y, r: active ? 23 : 18, fill: active ? '#e4e7ff' : '#eee8f7', stroke: active ? '#1f56cc' : '#6c5d84', sw: active ? 2.5 : 2.1 });
    drawCircle(nodeLayer, { cx: point.x, cy: point.y, r: active ? 11 : 8.5, fill: '#ffffff', stroke: active ? '#1f56cc' : '#6c5d84', sw: 1.9 });
    drawText(nodeLayer, { x: point.x, y: point.y + 3.5, lines: [`S${hub.id}`], size: active ? 11 : 9.5, weight: 700, color: active ? '#1f56cc' : '#5a4a73' });
  });

  primaryCareCtuRecords.forEach((ctu) => {
    const point = pcCtuPositions.get(ctu.id);
    if (!point) return;
    const start = rectBoundaryPoint(pcCtuNode, point);
    const { visible, active } = projectedRecordVisualState('pc-ctu', ctu.id, state.activePrimaryCareCtuId);
    if (!visible) return;
    if (visible) {
      drawLine(lineLayer, {
        x1: start.x,
        y1: start.y,
        x2: point.x,
        y2: point.y,
        sw: active ? 2.8 : 1.8,
        stroke: active ? '#1f56cc' : '#b37128',
      });
    }
    drawCircle(nodeLayer, { cx: point.x, cy: point.y, r: active ? 18 : 15, fill: active ? '#dce6ff' : '#f6e4cf', stroke: active ? '#1f56cc' : '#b37128', sw: active ? 2.2 : 1.8 });
    drawCircle(nodeLayer, { cx: point.x, cy: point.y, r: active ? 8.2 : 6.8, fill: '#ffffff', stroke: active ? '#1f56cc' : '#b37128', sw: active ? 1.6 : 1.2 });
    drawText(nodeLayer, {
      x: point.x,
      y: point.y + 2.3,
      lines: [String(ctu.id)],
      size: 8.2,
      weight: 700,
      color: active ? '#1f56cc' : '#8c5515',
    });
  });

  secondaryCareCtuRecords.forEach((ctu) => {
    const point = scCtuPositions.get(ctu.id);
    if (!point) return;
    const start = rectBoundaryPoint(scCtuNode, point);
    const { visible, active } = projectedRecordVisualState('sc-ctu', ctu.id, state.activeSecondaryCareCtuId);
    if (!visible) return;
    if (visible) {
      drawLine(lineLayer, {
        x1: start.x,
        y1: start.y,
        x2: point.x,
        y2: point.y,
        sw: active ? 2.8 : 1.8,
        stroke: active ? '#1f56cc' : '#8b4f66',
      });
    }
    drawCircle(nodeLayer, { cx: point.x, cy: point.y, r: active ? 18 : 15, fill: active ? '#dce6ff' : '#f6e0e8', stroke: active ? '#1f56cc' : '#8b4f66', sw: active ? 2.2 : 1.8 });
    drawCircle(nodeLayer, { cx: point.x, cy: point.y, r: active ? 8.2 : 6.8, fill: '#ffffff', stroke: active ? '#1f56cc' : '#8b4f66', sw: active ? 1.6 : 1.2 });
    drawText(nodeLayer, {
      x: point.x,
      y: point.y + 2.3,
      lines: [String(ctu.id)],
      size: 8.2,
      weight: 700,
      color: active ? '#1f56cc' : '#7b3551',
    });
  });

  drawCircle(nodeLayer, { cx: center.x, cy: center.y, r: 168, fill: '#e5e5e5', stroke: '#e5e5e5', sw: 1 });
  drawCircle(nodeLayer, { cx: center.x, cy: center.y, r: 112, fill: '#ffffff', stroke: '#151515', sw: 3 });
  drawText(nodeLayer, { x: center.x, y: center.y - 8, lines: ['Research Active', 'GP Practice 1'], size: 24, weight: 700 });
  drawText(nodeLayer, {
    x: center.x,
    y: center.y + 70,
    lines: wrap(state.verifiedPracticeName || state.practiceLabel || 'Research Active GP Practice 1', 22).slice(0, 3),
    size: 15,
    color: '#1f56cc',
  });

  const nodeSpecs = [
    { node: industry, lines: ['Industry/Pharma'], size: 20, weight: 700 },
    { node: mhra, lines: ['MHRA', 'CPRD'], size: [20, 16], color: ['#121212', '#1f56cc'], weight: [700, 400], href: [null, DIAGRAM_LINKS.cprd] },
    {
      node: rcgp,
      lines: ['RCGP', '- Research Ready'],
      size: [20, 16],
      color: ['#121212', '#1f56cc'],
      weight: [700, 400],
      href: [null, DIAGRAM_LINKS.researchReady],
      startY: -12,
      step: 28,
    },
    {
      node: thirdParty,
      lines: ['3rd party providers', '- OPC', '- Medicys'],
      size: [20, 16, 16],
      color: ['#121212', '#1f56cc', '#1f56cc'],
      weight: [700, 400, 400],
      href: [null, DIAGRAM_LINKS.opc, DIAGRAM_LINKS.medicys],
      startY: -24,
      step: 28,
    },
  ];

  nodeSpecs.forEach(({ node, lines, size, color, weight, href, startY = -10, step = 24 }) => {
    drawRect(nodeLayer, { x: node.x - node.w / 2, y: node.y - node.h / 2, w: node.w, h: node.h, rx: 18, fill: 'rgba(255,255,255,0.96)', stroke: '#151515', sw: 2.5 });
    if (Array.isArray(color)) {
      lines.forEach((line, index) => {
        drawText(nodeLayer, {
          x: node.x,
          y: node.y + startY + index * step,
          lines: [line],
          size: Array.isArray(size) ? size[index] : size,
          color: color[index],
          weight: Array.isArray(weight) ? weight[index] : weight,
          href: Array.isArray(href) ? href[index] : href,
        });
      });
    } else {
      drawText(nodeLayer, {
        x: node.x,
        y: node.y,
        lines,
        size,
        color: color || '#121212',
        weight: weight || 400,
        href: Array.isArray(href) ? href[0] : href,
      });
    }
  });

  drawRect(nodeLayer, {
    x: universities.x - universities.w / 2,
    y: universities.y - universities.h / 2,
    w: universities.w,
    h: universities.h,
    rx: 18,
    fill: 'rgba(255,255,255,0.96)',
    stroke: activeAcademicInstitution ? '#1f56cc' : '#151515',
    sw: activeAcademicInstitution ? 3.1 : 2.5,
  });
  drawText(nodeLayer, {
    x: universities.x,
    y: universities.y - 18,
    lines: ['Nearest Primary Care', 'University Department'],
    size: 18,
    weight: 700,
  });
  if (activeAcademicInstitution) {
    drawText(nodeLayer, {
      x: universities.x,
      y: universities.y + 12,
      lines: [activeAcademicInstitution.institutionCode],
      size: 18,
      weight: 700,
      color: '#1f56cc',
    });
    drawText(nodeLayer, {
      x: universities.x,
      y: universities.y + 42,
      lines: wrap(activeAcademicInstitution.site, 22).slice(0, 3),
      size: 12.5,
      color: '#1f56cc',
      href: activeAcademicInstitution.url || null,
    });
  } else {
    drawText(nodeLayer, {
      x: universities.x,
      y: universities.y + 20,
      lines: ['Awaiting verification'],
      size: 14,
      color: '#5c5d57',
    });
  }

  drawRect(nodeLayer, {
    x: pcHubNode.x - pcHubNode.w / 2,
    y: pcHubNode.y - pcHubNode.h / 2,
    w: pcHubNode.w,
    h: pcHubNode.h,
    rx: 18,
    fill: 'rgba(255,255,255,0.96)',
    stroke: activePcHub ? '#1f56cc' : '#151515',
    sw: activePcHub ? 3.1 : 2.5,
  });
  drawText(nodeLayer, { x: pcHubNode.x, y: pcHubNode.y - 20, lines: ['Nearest PC-CRDC'], size: 18, weight: 700 });
  if (activePcHub) {
    drawText(nodeLayer, { x: pcHubNode.x, y: pcHubNode.y + 2, lines: [activePcHub.hubName], size: 16, weight: 700, color: '#1f56cc' });
    drawText(nodeLayer, {
      x: pcHubNode.x,
      y: pcHubNode.y + 28,
      lines: wrap(activePcHub.site, 24).slice(0, 2),
      size: 12.5,
      color: '#1f56cc',
      href: activePcHub.url,
    });
  } else {
    drawText(nodeLayer, { x: pcHubNode.x, y: pcHubNode.y + 14, lines: ['Awaiting verification'], size: 13.5, color: '#5c5d57' });
  }

  drawRect(nodeLayer, {
    x: scHubNode.x - scHubNode.w / 2,
    y: scHubNode.y - scHubNode.h / 2,
    w: scHubNode.w,
    h: scHubNode.h,
    rx: 18,
    fill: 'rgba(255,255,255,0.96)',
    stroke: activeScHub ? '#1f56cc' : '#151515',
    sw: activeScHub ? 3.1 : 2.5,
  });
  drawText(nodeLayer, { x: scHubNode.x, y: scHubNode.y - 20, lines: ['Nearest SC-CRDC'], size: 18, weight: 700 });
  if (activeScHub) {
    drawText(nodeLayer, { x: scHubNode.x, y: scHubNode.y + 2, lines: [activeScHub.hubName], size: 16, weight: 700, color: '#1f56cc' });
    drawText(nodeLayer, {
      x: scHubNode.x,
      y: scHubNode.y + 28,
      lines: wrap(activeScHub.site, 22).slice(0, 3),
      size: 12.5,
      color: '#1f56cc',
      href: activeScHub.url || null,
    });
  } else {
    drawText(nodeLayer, { x: scHubNode.x, y: scHubNode.y + 14, lines: ['Awaiting SC data'], size: 13.5, color: '#5c5d57' });
  }

  drawRect(nodeLayer, {
    x: scCtuNode.x - scCtuNode.w / 2,
    y: scCtuNode.y - scCtuNode.h / 2,
    w: scCtuNode.w,
    h: scCtuNode.h,
    rx: 18,
    fill: 'rgba(255,255,255,0.96)',
    stroke: activeSecondaryCareCtu ? '#1f56cc' : '#151515',
    sw: activeSecondaryCareCtu ? 3.0 : 2.3,
  });
  drawText(nodeLayer, {
    x: scCtuNode.x,
    y: scCtuNode.y - 20,
    lines: ['Nearest SC-CTU'],
    size: 18,
    weight: 700,
  });
  if (activeSecondaryCareCtu) {
    drawText(nodeLayer, {
      x: scCtuNode.x,
      y: scCtuNode.y + 2,
      lines: [activeSecondaryCareCtu.ctuCode],
      size: 16,
      weight: 700,
      color: '#1f56cc',
    });
    drawText(nodeLayer, {
      x: scCtuNode.x,
      y: scCtuNode.y + 28,
      lines: wrap(activeSecondaryCareCtu.site, 22).slice(0, 3),
      size: 11.5,
      color: '#1f56cc',
      href: activeSecondaryCareCtu.url || null,
    });
  } else {
    drawText(nodeLayer, {
      x: scCtuNode.x,
      y: scCtuNode.y + 14,
      lines: ['Awaiting CTU data'],
      size: 13.5,
      color: '#5c5d57',
    });
  }

  drawRect(nodeLayer, {
    x: pcCtuNode.x - pcCtuNode.w / 2,
    y: pcCtuNode.y - pcCtuNode.h / 2,
    w: pcCtuNode.w,
    h: pcCtuNode.h,
    rx: 18,
    fill: 'rgba(255,255,255,0.96)',
    stroke: activePrimaryCareCtu ? '#1f56cc' : '#151515',
    sw: activePrimaryCareCtu ? 3.0 : 2.3,
  });
  drawText(nodeLayer, {
    x: pcCtuNode.x,
    y: pcCtuNode.y - 20,
    lines: ['Nearest PC-CTU'],
    size: 18,
    weight: 700,
  });
  if (activePrimaryCareCtu) {
    drawText(nodeLayer, {
      x: pcCtuNode.x,
      y: pcCtuNode.y + 2,
      lines: [activePrimaryCareCtu.ctuCode],
      size: 16,
      weight: 700,
      color: '#1f56cc',
    });
    drawText(nodeLayer, {
      x: pcCtuNode.x,
      y: pcCtuNode.y + 28,
      lines: wrap(activePrimaryCareCtu.site, 24).slice(0, 2),
      size: 12.5,
      color: '#1f56cc',
      href: activePrimaryCareCtu.url || null,
    });
  } else {
    drawText(nodeLayer, {
      x: pcCtuNode.x,
      y: pcCtuNode.y + 14,
      lines: ['Awaiting CTU result'],
      size: 13.5,
      color: '#5c5d57',
    });
  }

  drawRect(nodeLayer, { x: nihr.x - nihr.w / 2, y: nihr.y - nihr.h / 2, w: nihr.w, h: nihr.h, rx: 24, fill: '#fdfdfd', stroke: '#151515', sw: 2.6 });
  drawText(nodeLayer, { x: nihr.x, y: nihr.y - 42, lines: ['NIHR'], size: 20, weight: 700 });
  drawText(nodeLayer, { x: nihr.x, y: nihr.y - 8, lines: ['Industry Hubs'], size: 16, color: '#1f56cc', href: DIAGRAM_LINKS.nihrIndustryHubs });
  drawText(nodeLayer, { x: nihr.x, y: nihr.y + 18, lines: ['Health tech hubs'], size: 16, color: '#1f56cc', href: DIAGRAM_LINKS.nihrHealthTechHubs });
  drawText(nodeLayer, { x: nihr.x, y: nihr.y + 44, lines: ['RDN'], size: 16, color: '#1f56cc', href: DIAGRAM_LINKS.rdn });
  drawText(nodeLayer, { x: nihr.x, y: nihr.y + 68, lines: ['RRDN Agile Teams'], size: 16, color: '#1f56cc' });
}

async function resolvePractice() {
  const requestId = ++activeResolveRequestId;
  const practice = practiceInput.value.trim();
  const postcode = postcodeInput.value.trim();
  if (!practice) {
    syncStatus({ title: 'Practice name required', detail: 'Enter a GP practice name before running verification.' });
    return;
  }

  state.inputPracticeName = practice;
  state.practiceLabel = practice;
  hidePracticeMatchPanel();
  renderVerificationSummary();
  nhsLink.href = postcode ? `${NHS_GP_SEARCH}?locationName=${encodeURIComponent(postcode)}&suppressInvalidLoc=False` : NHS_GP_SEARCH;
  syncStatus({
    title: 'Verifying practice…',
    detail: 'Checking the official GP-practice mapping data, retrieving the practice postcode, and calculating the nearest PC-CRDC, SC-CRDC, academic primary care department, nearest PC-CTU, and nearest SC-CTU.',
  });

  try {
    if (!hasCentreRecordCache()) {
      await loadCentreRecords();
    }

    const url = new URL('/api/resolve-practice', window.location.origin);
    url.searchParams.set('practice', practice);
    if (postcode) url.searchParams.set('postcode', postcode);
    if (state.selectedPracticeCode) url.searchParams.set('practiceCode', state.selectedPracticeCode);

    const response = await fetch(url);
    const payload = await response.json();
    if (requestId !== activeResolveRequestId) return;
    if (!response.ok || !payload.ok) {
      if (payload.needsSelection && Array.isArray(payload.candidates)) {
        clearVerificationState();
        state.selectedPracticeCode = null;
        syncLegend();
        drawDiagram();
        renderVerificationSummary();
        showPracticeMatchPanel(payload.error, payload.candidates);
        syncStatus({
          title: 'Choose a GP practice',
          detail: 'Multiple official GP practices matched that name. Choose the correct one from the list shown in the GP practice card.',
        });
        return;
      }
      throw new Error(payload.error || 'Practice verification failed');
    }

    state.practiceLabel = payload.verifiedPractice.name;
    state.verifiedPracticeName = payload.verifiedPractice.name;
    state.verifiedPracticePostcode = payload.verifiedPractice.postcode;
    state.verifiedPracticeUrl = payload.verifiedPractice.sourceUrl;
    state.verifiedPracticeCode = payload.verifiedPractice.practiceCode;
    state.verificationSource = payload.verifiedPractice.source;
    state.activePcHubId = payload.nearestPcHub.id;
    state.activePcDistanceKm = payload.nearestPcHub.distanceKm;
    state.activeScHubId = payload.nearestScHub.id;
    state.activeScDistanceKm = payload.nearestScHub.distanceKm;
    state.activeAcademicInstitutionId = payload.nearestAcademicInstitution.id;
    state.activeAcademicDistanceKm = payload.nearestAcademicInstitution.distanceKm;
    state.activePrimaryCareCtuId = payload.nearestPrimaryCareCtu.id;
    state.activePrimaryCareCtuDistanceKm = payload.nearestPrimaryCareCtu.distanceKm;
    state.activeSecondaryCareCtuId = payload.nearestSecondaryCareCtu.id;
    state.activeSecondaryCareCtuDistanceKm = payload.nearestSecondaryCareCtu.distanceKm;
    clearHoveredMapRecord();
    state.activePostcode = payload.postcodeLookup.postcode;
    state.selectedPracticeCode = payload.verifiedPractice.practiceCode;
    postcodeInput.value = payload.postcodeLookup.postcode;
    postcodeInput.dataset.autofilled = 'true';
    nhsLink.href = payload.nhsSearchUrl;

    if (payload.dataset && state.datasetStatus?.refresh) {
      applyDatasetStatus({
        dataset: payload.dataset,
        refresh: state.datasetStatus.refresh,
      });
    }

    syncLegend();
    syncStatus();
    drawDiagram();
    renderVerificationSummary();
  } catch (error) {
    if (requestId !== activeResolveRequestId) return;
    clearVerificationState();
    clearHoveredMapRecord();
    state.selectedPracticeCode = null;
    delete postcodeInput.dataset.autofilled;
    hidePracticeMatchPanel();
    syncLegend();
    drawDiagram();
    renderVerificationSummary();
    syncStatus({
      title: 'Verification failed',
      detail: `${error.message}. You can still open the NHS GP search directly and refine the input or add a postcode override.`,
    });
  }
}

practiceInput.addEventListener('input', (event) => {
  const nextPractice = event.target.value.trim();
  const currentVerified = state.verifiedPracticeName?.trim() || '';
  if (postcodeInput.dataset.autofilled === 'true' && nextPractice !== currentVerified) {
    postcodeInput.value = '';
    state.activePostcode = '';
    delete postcodeInput.dataset.autofilled;
    nhsLink.href = NHS_GP_SEARCH;
  }
  if (!nextPractice) {
    clearVerificationState();
    clearHoveredMapRecord();
    state.selectedPracticeCode = null;
    state.inputPracticeName = '';
    state.practiceLabel = 'Research Active GP Practice 1';
    postcodeInput.value = '';
    nhsLink.href = NHS_GP_SEARCH;
    hidePracticeMatchPanel();
    syncLegend();
    syncStatus();
    drawDiagram();
    renderVerificationSummary();
    return;
  }
  if (currentVerified && nextPractice !== currentVerified) {
    clearVerificationState();
    clearHoveredMapRecord();
  }
  state.selectedPracticeCode = null;
  state.inputPracticeName = event.target.value.trim();
  state.practiceLabel = state.inputPracticeName || 'Research Active GP Practice 1';
  hidePracticeMatchPanel();
  syncLegend();
  syncStatus();
  drawDiagram();
  renderVerificationSummary();
});

postcodeInput.addEventListener('input', (event) => {
  const raw = event.target.value.trim();
  delete postcodeInput.dataset.autofilled;
  nhsLink.href = raw ? `${NHS_GP_SEARCH}?locationName=${encodeURIComponent(raw)}&suppressInvalidLoc=False` : NHS_GP_SEARCH;
});

practiceMatchOptions.addEventListener('click', (event) => {
  const button = event.target.closest('.match-option');
  if (!button) return;
  state.selectedPracticeCode = button.dataset.practiceCode || null;
  practiceInput.value = button.dataset.practiceName || '';
  state.inputPracticeName = practiceInput.value.trim();
  state.practiceLabel = state.inputPracticeName || 'Research Active GP Practice 1';
  hidePracticeMatchPanel();
  resolvePractice();
});

resolveButton.addEventListener('click', resolvePractice);
refreshDatasetButton.addEventListener('click', async () => {
  try {
    await refreshDatasetStatus();
    if (state.activePcHubId || state.activeScHubId || state.activeAcademicInstitutionId || state.activePrimaryCareCtuId || state.activeSecondaryCareCtuId) {
      syncStatus();
    } else {
      syncStatus({
        title: 'Dataset check complete',
        detail: 'The GP-practice snapshot status has been refreshed. You can now verify a practice against the latest available local snapshot.',
      });
    }
  } catch (error) {
    if (state.datasetStatus?.refresh) {
      applyDatasetStatus({
        ...state.datasetStatus,
        refresh: {
          ...state.datasetStatus.refresh,
          inProgress: false,
          lastResult: 'error',
          message: error.message,
        },
      });
    }
    renderDatasetStatus();
    syncStatus({ title: 'Dataset refresh failed', detail: error.message });
  }
});

practiceInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') resolvePractice();
});
postcodeInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') resolvePractice();
});

renderVerificationSummary();
renderDatasetStatus();
syncLegend();
drawDiagram();
requestAnimationFrame(syncLegendPanelHeight);
window.addEventListener('resize', syncLegendPanelHeight);

Promise.allSettled([loadSeededPracticeNames(), loadDatasetStatus()]).then((results) => {
  const [practiceResult, datasetResult] = results;
  if (practiceResult.status === 'rejected') {
    syncStatus({ title: 'Practice list unavailable', detail: 'The app is still usable, but the known practice suggestions could not be loaded.' });
  }
  if (datasetResult.status === 'rejected') {
    syncStatus({ title: 'Dataset status unavailable', detail: 'The app is still usable, but the latest NHS snapshot details could not be loaded.' });
  }
});

loadCentreRecords().catch((error) => {
  syncStatus({
    title: 'Centre data unavailable',
    detail: `${error.message}. The app will retry centre lookups when you run a search.`,
  });
});
