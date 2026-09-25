import assert from 'node:assert/strict';
import test from 'node:test';
import { deleteInstrumentReportGraph } from './instrumentDeletion.js';

test('deletes only artifacts belonging to the selected reports, before deleting their parents', async () => {
  const ids = ['report-a', 'report-b'];
  const operations: string[] = [];
  const childModels = ['performance', 'evidence', 'messages'].map(name => ({
    async deleteMany(filter: any) {
      operations.push(name);
      assert.deepEqual(filter, { reportId: { $in: ids } });
      return { deletedCount: 2 };
    },
  }));
  const reports = {
    async deleteMany(filter: any) {
      operations.push('reports');
      assert.deepEqual(filter, { _id: { $in: ids } });
      assert.deepEqual(operations, ['performance', 'evidence', 'messages', 'reports']);
      return { deletedCount: 2 };
    },
  };

  assert.deepEqual(await deleteInstrumentReportGraph(ids, childModels, reports), { deletedArtifacts: 6, deletedReports: 2 });
});

test('does not touch any collection when the instrument has no reports', async () => {
  let touched = false;
  const child = { async deleteMany() { touched = true; return { deletedCount: 0 }; } };
  const reports = { async deleteMany() { touched = true; return { deletedCount: 0 }; } };
  assert.deepEqual(await deleteInstrumentReportGraph([], [child], reports), { deletedArtifacts: 0, deletedReports: 0 });
  assert.equal(touched, false);
});

test('keeps report parents if any child cleanup fails so deletion can be retried safely', async () => {
  let parentDeleted = false;
  const child = { async deleteMany() { throw new Error('temporary database failure'); } };
  const reports = { async deleteMany() { parentDeleted = true; return { deletedCount: 1 }; } };
  await assert.rejects(() => deleteInstrumentReportGraph(['report-a'], [child], reports), /temporary database failure/);
  assert.equal(parentDeleted, false);
});
