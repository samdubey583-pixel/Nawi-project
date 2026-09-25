import assert from 'node:assert/strict';
import test from 'node:test';
import { buildReviewerInstrumentRepository } from './reviewerInstruments.js';

test('reviewer tester repository includes registered instruments across active, closed, and no-report states', () => {
  const instruments = [
    { _id: 'active', registeredBy: 'tester-1', typeDesignation: 'ACTIVE' },
    { _id: 'closed', registeredBy: 'tester-1', typeDesignation: 'CLOSED' },
    { _id: 'unused', registeredBy: 'tester-1', typeDesignation: 'NO REPORT YET' },
    { _id: 'other', registeredBy: 'tester-2', typeDesignation: 'OTHER TESTER' },
  ];
  const reports = [
    { _id: 'r1', instrumentId: 'active', testerId: 'tester-1', submittedBy: 'tester-1', testReportId: 'TR-ACTIVE', status: 'TESTING', updatedAt: '2026-09-23T10:00:00Z' },
    { _id: 'r2', instrumentId: 'closed', testerId: 'tester-1', submittedBy: 'tester-1', testReportId: 'TR-CLOSED', status: 'COMPLETED', updatedAt: '2026-09-23T11:00:00Z' },
    { _id: 'r3', instrumentId: 'other', testerId: 'tester-1', submittedBy: 'tester-2', testReportId: 'TR-CROSS-OWNER', status: 'AWAITING_REVIEW', updatedAt: '2026-09-23T12:00:00Z' },
  ];
  const result = buildReviewerInstrumentRepository(instruments, reports, 'tester-1');
  assert.deepEqual(result.map(item => item.id), ['active', 'closed', 'unused']);
  assert.equal(result[0]?.latestReport?.status, 'TESTING');
  assert.equal(result[1]?.latestReport?.status, 'COMPLETED');
  assert.equal(result[2]?.latestReport, null);
});

test('reviewer instrument row uses newest persisted report for that tester and instrument', () => {
  const instruments = [{ _id: 'i1', registeredBy: 'tester-1', typeDesignation: 'SCALE' }];
  const reports = [
    { _id: 'old', instrumentId: 'i1', testerId: 'tester-1', testReportId: 'TR-OLD', status: 'COMPLETED', updatedAt: '2026-09-20T10:00:00Z' },
    { _id: 'new', instrumentId: 'i1', submittedBy: 'tester-1', testReportId: 'TR-NEW', status: 'AWAITING_REVIEW', updatedAt: '2026-09-23T10:00:00Z' },
  ];
  const result = buildReviewerInstrumentRepository(instruments, reports, 'tester-1');
  assert.equal(result[0]?.latestReport?.reportNumber, 'TR-NEW');
  assert.equal(result[0]?.latestReport?.status, 'AWAITING_REVIEW');
});
