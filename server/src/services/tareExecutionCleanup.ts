import { TareTest } from '../models/TareTest.js';
import { TestReport } from '../models/TestReport.js';

export const RESETTABLE_TARE_PHASE = 'A.4.6.2' as const;

export function resetTarePhaseDocument(test: any, phaseCode: string) {
  if (phaseCode !== RESETTABLE_TARE_PHASE) throw new Error(`Only ${RESETTABLE_TARE_PHASE} execution cleanup is supported.`);
  const phase = test?.phases?.find((item: any) => item.code === phaseCode);
  if (!phase) throw new Error(`${phaseCode} phase was not found on the tare execution.`);
  const removed = { observationCount: phase.observations?.length || 0, result: phase.result, calculations: phase.calculations, status: phase.status, completedAt: phase.completedAt };
  phase.status = phase.applicability === 'APPLICABLE' ? 'AVAILABLE' : phase.applicability;
  phase.observations = [];
  phase.result = undefined;
  phase.calculations = undefined;
  phase.accuracyLimit = undefined;
  phase.tareSettingError = undefined;
  phase.notes = undefined;
  phase.completedAt = undefined;
  test.status = 'IN_PROGRESS';
  test.result = 'NOT_DETERMINED';
  test.completedAt = undefined;
  test.events = (test.events || []).filter((event: any) => event.action !== 'TARE_SETTING_ACCURACY_RECORDED');
  return removed;
}

export async function resetTarePhaseExecution(reportNumber: string, phaseCode: string) {
  if (!reportNumber || phaseCode !== RESETTABLE_TARE_PHASE) throw new Error(`Explicit report number and phase ${RESETTABLE_TARE_PHASE} are required.`);
  const report: any = await TestReport.findOne({ testReportId: reportNumber });
  if (!report) throw new Error(`Report ${reportNumber} was not found.`);
  const test: any = await TareTest.findOne({ reportId: report._id });
  if (!test) throw new Error(`No tare execution exists for report ${reportNumber}.`);
  const removed = resetTarePhaseDocument(test, phaseCode);
  await test.save();
  return { reportId: report._id.toString(), reportNumber, phaseCode, removed, preservedPhaseCounts: test.phases.map((phase: any) => ({ code: phase.code, observations: phase.observations?.length || 0 })) };
}
