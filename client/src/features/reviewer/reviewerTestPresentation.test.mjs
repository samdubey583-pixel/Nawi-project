import assert from 'node:assert/strict';
import test from 'node:test';
import { reviewerTestPresentation } from './reviewerTestPresentation.ts';

const executionRecord = {
  record: { fields: [{ label: 'Tester name', value: 'Demo Tester' }, { label: 'Test version', value: 'R76-1' }] },
};

test('NOT_APPLICABLE uses the generic N/A presentation and suppresses execution affordances', () => {
  for (const code of ['A.4.5', 'A.4.9', 'A.4.13', 'A.5.4.1', 'A.6']) {
    const view = reviewerTestPresentation({
      ...executionRecord,
      code,
      status: 'NOT_APPLICABLE',
      applicability: 'NOT_APPLICABLE',
      reason: 'Instrument configuration does not include this feature.',
    }, 2);
    assert.equal(view.isNotApplicable, true, code);
    assert.equal(view.showDetailsLink, false, code);
    assert.equal(view.showRecordedValues, false, code);
    assert.equal(view.showEvidenceCount, false, code);
    assert.equal(view.reason, 'Instrument configuration does not include this feature.', code);
  }
});

test('N/A prefix is removed from the reason while retaining its authoritative explanation', () => {
  const view = reviewerTestPresentation({
    status: 'NOT_APPLICABLE',
    reason: 'Not applicable: A.4.9 is the sensitivity test for a non-self-indicating instrument.',
  });
  assert.equal(view.result, 'NOT_APPLICABLE');
  assert.equal(view.reason, 'A.4.9 is the sensitivity test for a non-self-indicating instrument.');
});

test('PASS and FAIL executable cards retain details, recorded values, and evidence count', () => {
  for (const result of ['PASS', 'FAIL']) {
    const view = reviewerTestPresentation({ ...executionRecord, status: 'COMPLETED', result }, 1);
    assert.equal(view.isNotApplicable, false);
    assert.equal(view.showDetailsLink, true);
    assert.equal(view.showRecordedValues, true);
    assert.equal(view.showEvidenceCount, true);
  }
});

test('UNSUPPORTED, BLOCKED, and REQUIRES_CONFIGURATION do not become N/A', () => {
  for (const status of ['UNSUPPORTED', 'BLOCKED', 'LOCKED', 'REQUIRES_CONFIGURATION']) {
    const view = reviewerTestPresentation({ status, applicability: 'NOT_APPLICABLE' });
    assert.equal(view.isNotApplicable, false, status);
    assert.equal(view.showDetailsLink, true, status);
  }
});
