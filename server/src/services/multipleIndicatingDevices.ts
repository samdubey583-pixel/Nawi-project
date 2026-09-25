import { getMpe } from './mpeRules.js';
import { convertMass, isMassUnit, type MassUnit } from './mass.js';

export const MULTIPLE_INDICATING_TEST_VERSION = 'R76-A4.5-1.0';
export const MULTIPLE_INDICATING_SOURCE = 'OIML R 76-1:2006 §3.6.3; comparison during Annex A A.4.4';
export const MULTIPLE_INDICATING_RULE_REFERENCE = 'OIML R 76-1:2006 §3.6.3';

export type DerivedIndication = {
  deviceId: string;
  label: string;
  type?: 'DISPLAY' | 'PRINTING' | 'TARE_WEIGHING' | 'OTHER';
  indication: number;
  unit: string;
};

export type IndicationComparison = {
  sourceObservationId: string;
  sequence: number;
  direction: string;
  load: number;
  unit: string;
  devices: DerivedIndication[];
  difference?: number;
  limit?: number;
  limitUnit?: string;
  ruleReference: string;
  ruleVersion: string;
  result: 'PASS' | 'FAIL' | 'INCOMPLETE';
};

export function recordMissingDeviceIndication(input: {
  performance: any; sequence: number; indication: number; unit: string; reportStatus: string;
}) {
  const test = input.performance;
  if (input.reportStatus !== 'TESTING' || test?.status !== 'COMPLETED') throw new Error('Only a completed A.4.4 source on an actively testing report can receive a missing Device 2 observation.');
  if (test.instrumentSnapshot?.multipleIndicatingDevices !== true) throw new Error('The persisted instrument is not configured with multiple indicating devices.');
  if (!Number.isSafeInteger(input.sequence) || !Number.isFinite(input.indication) || !isMassUnit(input.unit)) throw new Error('Enter a valid sequence, indication, and supported mass unit.');
  const point = (test.loadPoints || []).find((item: any) => Number(item.sequence) === input.sequence);
  if (!point) throw new Error('The requested A.4.4 observation does not exist.');
  const devices = Array.isArray(point.indicatingDevices) ? point.indicatingDevices : [];
  if (!devices.some((device: any) => device.deviceId === 'DEVICE_1')) throw new Error('The source observation has no recorded Device 1 indication.');
  if (devices.some((device: any) => device.deviceId === 'DEVICE_2')) throw new Error('Device 2 is already recorded for this observation; existing readings are not overwritten.');
  const instrumentUnit: MassUnit = isMassUnit(test.instrumentSnapshot?.unit) ? test.instrumentSnapshot.unit : 'g';
  const indication = convertMass(input.indication, input.unit as MassUnit, instrumentUnit);
  point.indicatingDevices ||= [];
  point.indicatingDevices.push({ deviceId: 'DEVICE_2', label: 'Device 2', type: 'DISPLAY', unit: input.unit, inputIndication: input.indication, indication });
  point.updatedAt = new Date();
  return point;
}

export function sourceFingerprint(performance: any) {
  return JSON.stringify({
    performanceId: String(performance?._id || ''),
    updatedAt: performance?.updatedAt ? new Date(performance.updatedAt).toISOString() : null,
    status: performance?.status,
    points: (performance?.loadPoints || []).map((point: any) => ({
      sequence: point.sequence,
      direction: point.direction,
      loadL: point.loadL,
      indicationI: point.indicationI,
      indicatingDevices: point.indicatingDevices || [],
      result: point.result,
      updatedAt: point.updatedAt ? new Date(point.updatedAt).toISOString() : null,
    })),
  });
}

function normalizedDevices(point: any): DerivedIndication[] {
  return Array.isArray(point?.indicatingDevices)
    ? point.indicatingDevices
      .filter((device: any) => Number.isFinite(Number(device.indication)))
      .map((device: any) => ({
        deviceId: String(device.deviceId || device.label || 'DEVICE'),
        label: String(device.label || device.deviceId || 'Indicating device'),
        type: device.type,
        indication: Number(device.indication),
        unit: String(device.unit || 'g'),
      }))
    : [];
}

function comparisonLimit(devices: DerivedIndication[], point: any, snapshot: any) {
  const hasDisplayPrintingPair = devices.some((left, leftIndex) => devices.some((right, rightIndex) => leftIndex < rightIndex && ((left.type === 'DISPLAY' && right.type === 'PRINTING') || (left.type === 'PRINTING' && right.type === 'DISPLAY'))));
  if (hasDisplayPrintingPair) return { limit: 0, ruleReference: `${MULTIPLE_INDICATING_RULE_REFERENCE} (digital displaying and printing devices)` };
  const mpe = getMpe(String(snapshot?.accuracyClass || ''), Number(point.loadL), Number(snapshot?.e), { min: Number(snapshot?.min), max: Number(snapshot?.max), unit: String(snapshot?.unit || 'g'), rangeType: 'single-range' });
  if (!mpe.supported) return { limit: undefined, ruleReference: mpe.reason };
  return { limit: Math.abs(mpe.mpeValue), ruleReference: `${MULTIPLE_INDICATING_RULE_REFERENCE}; applicable MPE ${mpe.ruleReference}` };
}

export function deriveMultipleIndicatingComparisons(performance: any) {
  const snapshot = performance?.instrumentSnapshot || {};
  const points = performance?.loadPoints || [];
  const comparisons: IndicationComparison[] = [];
  for (const point of points) {
    const devices = normalizedDevices(point);
    if (devices.length < 2) {
      comparisons.push({ sourceObservationId: `${String(performance?._id || 'performance')}:${point.sequence}`, sequence: Number(point.sequence), direction: String(point.direction || 'INCREASING'), load: Number(point.loadL), unit: String(snapshot.unit || point.unit || 'g'), devices, ruleReference: MULTIPLE_INDICATING_RULE_REFERENCE, ruleVersion: MULTIPLE_INDICATING_TEST_VERSION, result: 'INCOMPLETE' });
      continue;
    }
    for (let leftIndex = 0; leftIndex < devices.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < devices.length; rightIndex += 1) {
        const comparedDevices = [devices[leftIndex], devices[rightIndex]];
        const rule = comparisonLimit(comparedDevices, point, snapshot);
        const difference = Math.abs(comparedDevices[0].indication - comparedDevices[1].indication);
        comparisons.push({ sourceObservationId: `${String(performance?._id || 'performance')}:${point.sequence}`, sequence: Number(point.sequence), direction: String(point.direction || 'INCREASING'), load: Number(point.loadL), unit: String(snapshot.unit || point.unit || 'g'), devices: comparedDevices, difference, limit: rule.limit, limitUnit: String(snapshot.unit || point.unit || 'g'), ruleReference: rule.ruleReference, ruleVersion: MULTIPLE_INDICATING_TEST_VERSION, result: rule.limit === undefined ? 'INCOMPLETE' : difference <= rule.limit ? 'PASS' : 'FAIL' });
      }
    }
  }
  const result = performance?.status !== 'COMPLETED' || comparisons.some(item => item.result === 'INCOMPLETE')
    ? 'INCOMPLETE'
    : comparisons.some(item => item.result === 'FAIL') ? 'FAIL' : comparisons.length ? 'PASS' : 'INCOMPLETE';
  return { comparisons, result };
}
