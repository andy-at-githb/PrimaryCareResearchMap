const SVG_NS = 'http://www.w3.org/2000/svg';
const NHS_GP_SEARCH = 'https://www.nhs.uk/service-search/find-a-gp/';
const XLINK_NS = 'http://www.w3.org/1999/xlink';

const DIAGRAM_LINKS = {
  cprd: 'https://www.cprd.com/',
  oxfordPcCtu: 'https://www.phctrials.ox.ac.uk/',
  nihrIndustryHubs: 'https://www.nihr.ac.uk/support-and-services/industry/life-sciences-industry-hub',
  nihrHealthTechHubs: 'https://www.nihr.ac.uk/support-and-services/industry/explore/healthtech-research-centres',
};

const hubRecords = [
  { id: 1, hubName: 'Regional Research Hub 1', site: 'The Adam Practice, Poole, Dorset', url: 'https://www.adampractice.co.uk/' },
  { id: 2, hubName: 'Regional Research Hub 2', site: 'Ashton Medical Group, Ashton-Under-Lyne, Lancashire', url: 'https://www.ashtonmedicalgroup.co.uk/' },
  { id: 3, hubName: 'Regional Research Hub 3', site: 'The Garth Surgery, Guisborough, Cleveland', url: 'https://www.thegarthsurgery.nhs.uk/' },
  { id: 4, hubName: 'Regional Research Hub 4', site: 'Grove Surgery, Thetford, Norfolk', url: 'https://grovesurgerythetford.co.uk/' },
  { id: 5, hubName: 'Regional Research Hub 5', site: 'Hounslow Medical Centre, Middlesex', url: 'https://www.hounslowmedicalcentre.co.uk/' },
  { id: 6, hubName: 'Regional Research Hub 6', site: 'Layton Medical Centre, Blackpool, Lancashire', url: 'https://www.laytonmedicalcentre.co.uk/' },
  { id: 7, hubName: 'Regional Research Hub 7', site: 'Marine Lake Medical Practice, West Kirby, Wirral', url: 'https://marinelakemedicalwirral.nhs.uk/' },
  { id: 8, hubName: 'Regional Research Hub 8', site: 'Mereside Medical, Ely, Cambridgeshire', url: 'https://www.meresidemedical.nhs.uk/' },
  { id: 9, hubName: 'Regional Research Hub 9', site: 'Pier Health Group, Weston-Super-Mare, North Somerset', url: 'https://pierhealth.co.uk/' },
  { id: 10, hubName: 'Regional Research Hub 10', site: 'Rame Group Practice, Torpoint, Cornwall', url: 'https://theramegrouppractice.co.uk/' },
  { id: 11, hubName: 'Regional Research Hub 11', site: 'The University of Nottingham Health Service, Nottingham', url: 'https://www.unhs.co.uk/' },
  { id: 12, hubName: 'Regional Research Hub 12', site: 'Wansford Surgery, Wansford, Peterborough', url: 'https://www.wansfordsurgery.co.uk/' },
  { id: 13, hubName: 'Regional Research Hub 13', site: 'West Walk Surgery, Yate, Bristol', url: 'https://www.westwalksurgery.co.uk/' },
  { id: 14, hubName: 'Regional Research Hub 14', site: 'Windrush Medical Practice, Witney, Oxfordshire', url: 'https://www.windrushmedicalpractice.co.uk/' },
];

const state = {
  inputPracticeName: '',
  practiceLabel: 'Research Active GP Practice 1',
  verifiedPracticeName: null,
  verifiedPracticeAddress: null,
  verifiedPracticePostcode: null,
  verifiedPracticeUrl: null,
  verifiedPracticeCode: null,
  activeHubId: null,
  activeDistanceKm: null,
  activePostcode: '',
  verificationSource: null,
  datasetStatus: null,
};

const practiceInput = document.querySelector('#practice-input');
const practiceOptions = document.querySelector('#practice-options');
const postcodeInput = document.querySelector('#postcode-input');
const resolveButton = document.querySelector('#resolve-button');
const refreshDatasetButton = document.querySelector('#refresh-dataset-button');
const nhsLink = document.querySelector('#nhs-link');
const statusHub = document.querySelector('#status-hub');
const statusDetail = document.querySelector('#status-detail');
const legend = document.querySelector('#hub-legend');
const lineLayer = document.querySelector('#diagram-lines');
const nodeLayer = document.querySelector('#diagram-nodes');

const summaryEntered = document.querySelector('#summary-entered');
const summaryVerified = document.querySelector('#summary-verified');
const summaryCode = document.querySelector('#summary-code');
const summaryPostcode = document.querySelector('#summary-postcode');
const summaryHub = document.querySelector('#summary-hub');
const summaryDistance = document.querySelector('#summary-distance');
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
    ? createSvgEl('a', { href, 'xlink:href': href, target: '_blank' })
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

function polar(cx, cy, radius, angleDeg, yScale = 1) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + Math.cos(rad) * radius, y: cy + Math.sin(rad) * radius * yScale };
}

function hubById(id) {
  return hubRecords.find((hub) => hub.id === id);
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
    const link = document.createElement('a');
    link.href = href;
    link.target = '_blank';
    link.rel = 'noreferrer';
    link.textContent = label;
    node.appendChild(link);
    return;
  }
  node.textContent = label;
}

function renderVerificationSummary() {
  const hub = hubById(state.activeHubId);
  const dataset = state.datasetStatus?.dataset;

  setFieldText(summaryEntered, state.inputPracticeName || state.practiceLabel, 'Not verified yet');
  setFieldText(summaryVerified, state.verifiedPracticeName, 'Not verified yet');
  setFieldText(summaryCode, state.verifiedPracticeCode, 'Not verified yet');
  setFieldText(summaryPostcode, state.verifiedPracticePostcode || state.activePostcode, 'Not verified yet');
  setFieldLink(summaryHub, hub ? `Hub ${hub.id}: ${hub.site}` : null, hub?.url, 'Not verified yet');
  setFieldText(
    summaryDistance,
    typeof state.activeDistanceKm === 'number' ? `${state.activeDistanceKm.toFixed(1)} km` : null,
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
  clearChildren(practiceOptions);
  payload.practices.forEach((entry) => {
    const option = document.createElement('option');
    option.value = entry.fullPracticeName;
    practiceOptions.appendChild(option);
  });
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
  clearChildren(legend);
  hubRecords.forEach((hub) => {
    const li = document.createElement('li');
    if (state.activeHubId === hub.id) li.classList.add('is-active');
    li.innerHTML = `
      <span class="hub-index">Hub ${hub.id}</span>
      <a class="hub-link" href="${hub.url}" target="_blank">${hub.site}</a>
    `;
    legend.appendChild(li);
  });
}

function syncStatus(message = null) {
  if (message) {
    statusHub.textContent = message.title;
    statusDetail.innerHTML = message.detail;
    return;
  }
  const hub = hubById(state.activeHubId);
  if (!hub) {
    statusHub.textContent = 'Waiting for verification';
    statusDetail.textContent = 'Enter a GP practice name and run the verification step.';
    return;
  }
  statusHub.textContent = `Hub ${hub.id}`;
  const distance = typeof state.activeDistanceKm === 'number' ? ` Approximate distance: ${state.activeDistanceKm.toFixed(1)} km.` : '';
  const postcode = state.verifiedPracticePostcode ? ` Postcode used: ${state.verifiedPracticePostcode}.` : '';
  const source = state.verificationSource === 'nhs-england-digital-gp-snapshot'
    ? 'Verified from the official NHS England Digital GP-practice mapping snapshot.'
    : 'Verified from the current practice dataset.';
  const verifiedName = state.verifiedPracticeName ? `Verified practice: ${state.verifiedPracticeName}. ` : '';
  statusDetail.innerHTML = `${verifiedName}Mapped hub: <a class="hub-link" href="${hub.url}" target="_blank">${hub.site}</a>.${distance}${postcode}<br><span class="small-note">${source}</span>`;
}

function drawDiagram() {
  clearChildren(lineLayer);
  clearChildren(nodeLayer);

  const center = { x: 520, y: 520 };
  const hubNode = { x: 200, y: 520, w: 260, h: 106 };
  const industry = { x: 520, y: 152, w: 320, h: 92 };
  const mhra = { x: 218, y: 268, w: 236, h: 88 };
  const universities = { x: 842, y: 268, w: 250, h: 88 };
  const rcgp = { x: 906, y: 480, w: 160, h: 84 };
  const thirdParty = { x: 828, y: 694, w: 280, h: 88 };
  const nihr = { x: 520, y: 872, w: 356, h: 148 };

  const spokes = [industry, mhra, universities, rcgp, thirdParty, nihr, hubNode];
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

  const activeHub = hubById(state.activeHubId);
  const ringCenter = { x: 1130, y: 520 };
  hubRecords.forEach((hub, index) => {
    const point = polar(ringCenter.x, ringCenter.y, 225, -124 + index * 20, 1.62);
    const active = activeHub ? hub.id === activeHub.id : false;
    drawLine(lineLayer, { x1: nihr.x + 20, y1: nihr.y + 45, x2: point.x, y2: point.y, sw: active ? 4 : 2.6, stroke: active ? '#1f56cc' : '#151515' });
    drawCircle(nodeLayer, { cx: point.x, cy: point.y, r: active ? 39 : 31, fill: active ? '#dce6ff' : '#e5e5e5', stroke: active ? '#1f56cc' : '#e5e5e5', sw: 1 });
    drawCircle(nodeLayer, { cx: point.x, cy: point.y, r: active ? 21 : 17, fill: '#ffffff', stroke: active ? '#1f56cc' : '#151515', sw: 2.4 });
    drawText(nodeLayer, { x: point.x, y: point.y + 5, lines: [String(hub.id)], size: active ? 16 : 14, weight: 700, color: active ? '#1f56cc' : '#121212' });
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
    { node: industry, lines: ['Industry/Pharma'], size: 22, weight: 700 },
    { node: mhra, lines: ['MHRA', 'CPRD'], size: 18, color: ['#121212', '#1f56cc'], weight: [700, 400], href: [null, DIAGRAM_LINKS.cprd] },
    { node: universities, lines: ['Universities', 'Oxford University PC-CTU'], size: 18, color: ['#121212', '#1f56cc'], weight: [700, 400], href: [null, DIAGRAM_LINKS.oxfordPcCtu] },
    { node: rcgp, lines: ['RCGP'], size: 18, weight: 700 },
    { node: thirdParty, lines: ['3rd party providers'], size: 18, weight: 400 },
  ];

  nodeSpecs.forEach(({ node, lines, size, color, weight, href }) => {
    drawRect(nodeLayer, { x: node.x - node.w / 2, y: node.y - node.h / 2, w: node.w, h: node.h, rx: 18, fill: 'rgba(255,255,255,0.96)', stroke: '#151515', sw: 2.5 });
    if (Array.isArray(color)) {
      lines.forEach((line, index) => {
        drawText(nodeLayer, {
          x: node.x,
          y: node.y - 10 + index * 24,
          lines: [line],
          size,
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

  drawRect(nodeLayer, { x: hubNode.x - hubNode.w / 2, y: hubNode.y - hubNode.h / 2, w: hubNode.w, h: hubNode.h, rx: 18, fill: 'rgba(255,255,255,0.96)', stroke: activeHub ? '#1f56cc' : '#151515', sw: activeHub ? 3.1 : 2.5 });
  if (activeHub) {
    drawText(nodeLayer, { x: hubNode.x, y: hubNode.y - 18, lines: [`Hub ${activeHub.id}`], size: 22, weight: 700, color: '#1f56cc' });
    drawText(nodeLayer, {
      x: hubNode.x,
      y: hubNode.y + 20,
      lines: wrap(activeHub.site, 22).slice(0, 2),
      size: 14,
      color: '#1f56cc',
      href: activeHub.url,
    });
  } else {
    drawText(nodeLayer, { x: hubNode.x, y: hubNode.y - 6, lines: ['Local PC-CRDC'], size: 22, weight: 700 });
    drawText(nodeLayer, { x: hubNode.x, y: hubNode.y + 24, lines: ['Awaiting verification'], size: 14, color: '#5c5d57' });
  }

  drawRect(nodeLayer, { x: nihr.x - nihr.w / 2, y: nihr.y - nihr.h / 2, w: nihr.w, h: nihr.h, rx: 24, fill: '#fdfdfd', stroke: '#151515', sw: 2.6 });
  drawText(nodeLayer, { x: nihr.x, y: nihr.y - 30, lines: ['NIHR'], size: 22, weight: 700 });
  drawText(nodeLayer, { x: nihr.x, y: nihr.y + 6, lines: ['Industry Hubs'], size: 16, color: '#1f56cc', href: DIAGRAM_LINKS.nihrIndustryHubs });
  drawText(nodeLayer, { x: nihr.x, y: nihr.y + 30, lines: ['Health tech hubs'], size: 16, color: '#1f56cc', href: DIAGRAM_LINKS.nihrHealthTechHubs });
  drawText(nodeLayer, { x: nihr.x, y: nihr.y + 54, lines: ['RRDN Agile teams'], size: 16, color: '#1f56cc' });
}

async function resolvePractice() {
  const practice = practiceInput.value.trim();
  const postcode = postcodeInput.value.trim();
  if (!practice) {
    syncStatus({ title: 'Practice name required', detail: 'Enter a GP practice name before running verification.' });
    return;
  }

  state.inputPracticeName = practice;
  state.practiceLabel = practice;
  renderVerificationSummary();
  nhsLink.href = postcode ? `${NHS_GP_SEARCH}?locationName=${encodeURIComponent(postcode)}&suppressInvalidLoc=False` : NHS_GP_SEARCH;
  syncStatus({ title: 'Verifying practice…', detail: 'Checking the official GP-practice mapping data, retrieving the practice postcode, and calculating the nearest regional research hub.' });

  try {
    const url = new URL('/api/resolve-practice', window.location.origin);
    url.searchParams.set('practice', practice);
    if (postcode) url.searchParams.set('postcode', postcode);

    const response = await fetch(url);
    const payload = await response.json();
    if (!response.ok || !payload.ok) {
      throw new Error(payload.error || 'Practice verification failed');
    }

    state.practiceLabel = payload.verifiedPractice.name;
    state.verifiedPracticeName = payload.verifiedPractice.name;
    state.verifiedPracticeAddress = payload.verifiedPractice.address;
    state.verifiedPracticePostcode = payload.verifiedPractice.postcode;
    state.verifiedPracticeUrl = payload.verifiedPractice.sourceUrl;
    state.verifiedPracticeCode = payload.verifiedPractice.practiceCode;
    state.verificationSource = payload.verifiedPractice.source;
    state.activeHubId = payload.nearestHub.id;
    state.activeDistanceKm = payload.nearestHub.distanceKm;
    state.activePostcode = payload.postcodeLookup.postcode;
    postcodeInput.value = payload.postcodeLookup.postcode;
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
    state.verifiedPracticeName = null;
    state.verifiedPracticeAddress = null;
    state.verifiedPracticePostcode = null;
    state.verifiedPracticeUrl = null;
    state.verifiedPracticeCode = null;
    state.verificationSource = null;
    state.activeHubId = null;
    state.activeDistanceKm = null;
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
  state.inputPracticeName = event.target.value.trim();
  state.practiceLabel = state.inputPracticeName || 'Research Active GP Practice 1';
  drawDiagram();
  renderVerificationSummary();
});

postcodeInput.addEventListener('input', (event) => {
  const raw = event.target.value.trim();
  nhsLink.href = raw ? `${NHS_GP_SEARCH}?locationName=${encodeURIComponent(raw)}&suppressInvalidLoc=False` : NHS_GP_SEARCH;
});

resolveButton.addEventListener('click', resolvePractice);
refreshDatasetButton.addEventListener('click', async () => {
  try {
    await refreshDatasetStatus();
    if (state.activeHubId) {
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

Promise.allSettled([loadSeededPracticeNames(), loadDatasetStatus()]).then((results) => {
  const [practiceResult, datasetResult] = results;
  if (practiceResult.status === 'rejected') {
    syncStatus({ title: 'Practice list unavailable', detail: 'The app is still usable, but the known practice suggestions could not be loaded.' });
  }
  if (datasetResult.status === 'rejected') {
    syncStatus({ title: 'Dataset status unavailable', detail: 'The app is still usable, but the dataset status card could not be loaded.' });
  }
});
