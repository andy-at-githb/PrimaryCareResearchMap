#!/usr/bin/env node

const BASE_URL = process.env.APP_BASE_URL || 'http://127.0.0.1:10000';

async function requestJson(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, options);
  const body = await response.text();
  let payload = null;
  try {
    payload = body ? JSON.parse(body) : null;
  } catch (error) {
    throw new Error(`Expected JSON from ${path}, received: ${body.slice(0, 160)}`);
  }
  return { response, payload };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function run() {
  const checks = [];

  const healthResponse = await fetch(`${BASE_URL}/healthz`);
  const healthText = await healthResponse.text();
  assert(healthResponse.ok && healthText.trim() === 'ok', 'Health check failed');
  checks.push('healthz');

  const seeded = await requestJson('/api/seeded-practices');
  assert(seeded.response.ok, 'Seeded practices endpoint failed');
  assert(Array.isArray(seeded.payload.practices) && seeded.payload.practices.length > 1000, 'Seeded practice list looks wrong');
  assert(typeof seeded.payload.practices[0] === 'string', 'Seeded practice entries should be strings');
  checks.push('seeded-practices');

  const datasetStatus = await requestJson('/api/practice-dataset-status');
  assert(datasetStatus.response.ok, 'Dataset status endpoint failed');
  assert(datasetStatus.payload?.dataset?.rowCount > 1000, 'Dataset status did not report a loaded practice snapshot');
  checks.push('dataset-status');

  const centres = await requestJson('/api/centre-records');
  assert(centres.response.ok, 'Centre records endpoint failed');
  assert(centres.payload.pcHubRecords?.length === 14, 'Expected 14 PC-CRDC records');
  assert(centres.payload.scHubRecords?.length === 15, 'Expected 15 SC-CRDC records');
  checks.push('centre-records');

  const adam = await requestJson('/api/resolve-practice?practice=The%20Adam%20Practice');
  assert(adam.response.ok && adam.payload.ok, 'Known practice lookup failed');
  assert(adam.payload.verifiedPractice.practiceCode === 'J81006', 'Known practice did not resolve to The Adam Practice code');
  assert(adam.payload.nearestPcHub.id === 1, 'Known practice did not resolve to expected nearest PC-CRDC');
  checks.push('known-practice');

  const ambiguous = await requestJson('/api/resolve-practice?practice=Park%20Surgery');
  assert(ambiguous.response.status === 409, 'Ambiguous practice should require selection');
  assert(ambiguous.payload.needsSelection === true, 'Ambiguous response missing needsSelection flag');
  assert(Array.isArray(ambiguous.payload.candidates) && ambiguous.payload.candidates.length > 1, 'Ambiguous response missing candidate practices');
  checks.push('ambiguous-practice');

  const selectedCandidate = ambiguous.payload.candidates[0];
  const selected = await requestJson(
    `/api/resolve-practice?practice=${encodeURIComponent(selectedCandidate.practiceName)}&practiceCode=${encodeURIComponent(selectedCandidate.practiceCode)}`,
  );
  assert(selected.response.ok && selected.payload.ok, 'Selected ambiguous practice did not resolve');
  assert(selected.payload.verifiedPractice.practiceCode === selectedCandidate.practiceCode, 'Selected ambiguous practice resolved to the wrong practice code');
  checks.push('ambiguous-selection');

  const unknown = await requestJson('/api/resolve-practice?practice=zzzz%20not%20a%20real%20practice');
  assert(unknown.response.status === 502, 'Unknown practice should return verification failure');
  checks.push('unknown-practice');

  console.log(`Smoke test passed for ${BASE_URL}`);
  console.log(`Checks: ${checks.join(', ')}`);
}

run().catch((error) => {
  console.error(`Smoke test failed for ${BASE_URL}`);
  console.error(error.message);
  process.exitCode = 1;
});
