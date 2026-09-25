import assert from 'node:assert/strict';
import test from 'node:test';
import { buildReviewerTesterDirectory } from './reviewerDirectory.js';

test('reviewer directory includes real testers with submitted work and excludes synthetic or empty accounts', () => {
  const users = [
    { _id: 'real-1', firstName: 'New', lastName: 'Tester', email: 'new.tester@example.com' },
    { _id: 'empty', firstName: 'Empty', lastName: 'Tester', email: 'empty@example.com' },
    { _id: 'runner', firstName: 'QA', lastName: 'Runner', email: 'qa.runner@example.invalid' },
  ];
  const reports = [{ _id: 'report-1', testReportId: 'TR-NEW', status: 'AWAITING_REVIEW', testerId: 'real-1', submittedBy: 'real-1', instrument: { typeDesignation: 'NEW-01' } }];
  const directory = buildReviewerTesterDirectory(users, reports);
  assert.deepEqual(directory.map(item => item.email), ['new.tester@example.com']);
  assert.deepEqual(directory[0]?.reports.map(item => item.reportNumber), ['TR-NEW']);
});

test('reviewer directory does not duplicate a report linked through tester and submitter fields', () => {
  const users = [{ _id: 'real-1', firstName: 'New', lastName: 'Tester', email: 'new.tester@example.com' }];
  const reports = [{ _id: 'report-1', testReportId: 'TR-NEW', status: 'COMPLETED', testerId: 'real-1', submittedBy: 'real-1' }];
  const directory = buildReviewerTesterDirectory(users, reports);
  assert.equal(directory[0]?.reports.length, 1);
});

test('reviewer directory includes a tester with active test records so both workspaces are selectable', () => {
  const users = [{ _id: 'active-tester', firstName: 'Active', lastName: 'Tester', email: 'active.tester@example.com' }];
  const reports = [{ _id: 'report-2', testReportId: 'TR-ACTIVE', status: 'TESTING', testerId: 'active-tester', instrument: { typeDesignation: 'ACTIVE-01' } }];
  const directory = buildReviewerTesterDirectory(users, reports);
  assert.equal(directory[0]?.email, 'active.tester@example.com');
  assert.equal(directory[0]?.reports[0]?.status, 'TESTING');
});
