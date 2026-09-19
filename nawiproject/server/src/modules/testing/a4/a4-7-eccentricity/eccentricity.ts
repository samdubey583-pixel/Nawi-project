import { evaluateCompliance } from '../../calculations/common/compliance.js';
import { getMpe } from '../../calculations/mpe/mpeRules.js';
import { calculateChangeoverError } from '../../calculations/changeover/weighingCalculations.js';
import { isMassUnit, type MassUnit } from '../../calculations/common/mass.js';
import type { EccentricityPositionApplicability, InstrumentProfile } from '../../engine/testApplicability.js';

export const ECCENTRICITY_TEST_VERSION = 'R76-A4.7-1.0';
export const ECCENTRICITY_SOURCE = 'OIML R 76-1:2006 Annex A A.4.7; calculation A.4.4.3';

export function eccentricityPositions(method: string, supportPointCount?: number): EccentricityPositionApplicability[] {
  if (method === 'A.4.7.1') return ['Quarter 1', 'Quarter 2', 'Quarter 3', 'Quarter 4'].map((label, index) => ({ positionId: `POSITION_${index + 1}`, label, loadingArea: 'Approximately one quarter of the load-receptor surface.', geometry: 'quarter' as const }));
  if (method === 'A.4.7.2' || method === 'A.4.7.3') return Array.from({ length: supportPointCount || 0 }, (_, index) => ({ positionId: `SUPPORT_${index + 1}`, label: `Support ${index + 1}`, supportIndex: index + 1, loadingArea: method === 'A.4.7.2' ? 'Approximately 1/n of the load-receptor surface around this support.' : 'The applicable loading area at this support point.', geometry: method === 'A.4.7.2' ? 'support' as const : 'special' as const }));
  if (method === 'A.4.7.4') return ['Beginning', 'Middle', 'End'].map((label, index) => ({ positionId: `ROLLING_${index + 1}`, label, loadingArea: 'Position on the load receptor in the normal driving direction.', geometry: 'rolling' as const }));
  return [];
}

export function calculationForPosition(input: { loadL: number; indicationI: number; deltaL: number; e0: number; e: number; accuracyClass: string; min: number; max: number; unit?: string }) {
  const unit: MassUnit = isMassUnit(input.unit) ? input.unit : 'g';
  const calculation = calculateChangeoverError(input.loadL, input.indicationI, input.deltaL, input.e, input.e0);
  const mpe = getMpe(input.accuracyClass, input.loadL, input.e, { min: input.min, max: input.max, unit, rangeType: 'single-range', loadType: 'GROSS' });
  if (!mpe.supported) return { supported: false as const, reason: mpe.reason };
  return {
    supported: true as const,
    ...calculation,
    calculatedE0: input.e0,
    mpe: { ...mpe },
    complianceResult: evaluateCompliance(calculation.correctedErrorEc, mpe.mpeValue),
    provenance: { calculationSource: 'OIML R 76-1:2006 A.4.4.3', mpeRuleSetId: mpe.ruleSetId, mpeRuleReference: mpe.ruleReference, mpeRuleVersion: mpe.ruleVersion },
  };
}

export function eccentricityFingerprint(profile: InstrumentProfile) {
  return JSON.stringify({ accuracyClass: profile.accuracyClass, indicationType: profile.indicationType, unit: profile.unit, min: profile.minimumCapacity, max: profile.maximumCapacity, e: profile.e, d: profile.d, loadReceptorType: profile.loadReceptorType, numberOfSupportPoints: profile.numberOfSupportPoints, rollingLoad: profile.rollingLoad, mobileInstrument: profile.mobileInstrument });
}
