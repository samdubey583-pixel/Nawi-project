import { isPrototypeWorkflow } from './endurance.js';

/**
 * Keep synthetic classification independent from the mathematical result.
 * A configured simulator is an explicit persisted indication that the report
 * contains modeled workflow data, even when A.6 is not applicable.
 */
export function isSyntheticPrototypeReport(report: any, endurance?: any): boolean {
  const simulatorUsed = String(report?.instrumentSetup?.simulatorUsed || '').trim().toUpperCase() === 'YES';
  const labeledSynthetic = /synthetic prototype|regression data/i.test(
    `${report?.instrumentSetup?.notes || ''} ${report?.testPreparation?.notes || ''}`,
  );
  return simulatorUsed || labeledSynthetic || Number(endurance?.syntheticCycles || 0) > 0 || isPrototypeWorkflow(endurance);
}
