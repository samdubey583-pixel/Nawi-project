import test from 'node:test';
import assert from 'node:assert/strict';
import { applicationMetadataValidationMessage, canEditReportMetadata, normalizeIndianPhone } from './reportMetadata.js';

test('editable report states follow the existing workflow lock', () => {
  assert.equal(canEditReportMetadata({ status: 'TESTING', stage: 'TESTING' }), true);
  assert.equal(canEditReportMetadata({ status: 'AWAITING_REVIEW', stage: 'REVIEW' }), false);
  assert.equal(canEditReportMetadata({ status: 'UNDER_REVIEW', stage: 'REVIEW' }), false);
  assert.equal(canEditReportMetadata({ status: 'COMPLETED', stage: 'FINAL_REPORT' }), false);
});

test('Indian phone validation preserves the canonical country prefix', () => {
  assert.equal(normalizeIndianPhone('9876543210'), '+91 9876543210');
  assert.equal(normalizeIndianPhone('+91 9876543210'), '+91 9876543210');
  assert.equal(normalizeIndianPhone('98765'), null);
});

test('application metadata validation rejects malformed contact data', () => {
  assert.equal(applicationMetadataValidationMessage({ email: 'bad', phone: '9876543210' }), 'Enter a valid email address.');
  assert.equal(applicationMetadataValidationMessage({ email: 'a@example.com', phone: '98765' }), 'Enter a valid 10-digit Indian mobile number.');
  assert.equal(applicationMetadataValidationMessage({ referenceMode: 'external', externalApplicationReference: '', email: 'a@example.com', phone: '9876543210' }), 'External application reference is required when external reference mode is selected.');
  assert.equal(applicationMetadataValidationMessage({ email: 'a@example.com', phone: '9876543210' }), null);
});
