/**
 * Contract Assertion Helpers for SQDIS API testing
 */
import assert from 'node:assert';

export function assertSuccess(res, expectedStatus = 200, context = '') {
  assert.strictEqual(
    res.status,
    expectedStatus,
    `Expected status ${expectedStatus} but got ${res.status}. Context: ${context}. Body: ${JSON.stringify(res.data)}`
  );
}

export function assertError(res, expectedStatus, messageMatch = null, context = '') {
  assert.strictEqual(
    res.status,
    expectedStatus,
    `Expected error status ${expectedStatus} but got ${res.status}. Context: ${context}. Body: ${JSON.stringify(res.data)}`
  );

  if (messageMatch && res.data) {
    const rawMsg = typeof res.data.message === 'string'
      ? res.data.message
      : Array.isArray(res.data.message)
      ? res.data.message.join(' ')
      : JSON.stringify(res.data);

    if (messageMatch instanceof RegExp) {
      assert.match(rawMsg, messageMatch, `Expected error message to match ${messageMatch}, got "${rawMsg}"`);
    } else {
      assert.ok(
        rawMsg.toLowerCase().includes(String(messageMatch).toLowerCase()),
        `Expected error message to include "${messageMatch}", got "${rawMsg}"`
      );
    }
  }
}

export function assertPaginatedEnvelope(body, context = '') {
  assert.ok(body && typeof body === 'object', `Expected body to be an object, got ${typeof body}`);
  // In SQDIS, paginated envelopes have either `data` or `items` array, and a numeric `total`
  const hasArray = Array.isArray(body.data) || Array.isArray(body.items);
  assert.ok(hasArray, `Paginated response must contain an array in 'data' or 'items'. Context: ${context}`);
  assert.strictEqual(typeof body.total, 'number', `Paginated response must contain numeric 'total'. Context: ${context}`);
}

export function assertProperties(obj, properties, context = '') {
  assert.ok(obj && typeof obj === 'object', `Expected object to inspect properties. Context: ${context}`);
  for (const prop of properties) {
    assert.ok(
      prop in obj,
      `Expected property '${prop}' in object keys [${Object.keys(obj).join(', ')}]. Context: ${context}`
    );
  }
}
