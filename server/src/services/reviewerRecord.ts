const HIDDEN_FIELDS = new Set([
  '_id', '__v', 'reportId', 'sourceFingerprint', 'events', 'revisionHistory',
  'testerId', 'reviewerId', 'actorId', 'uploadedBy', 'updatedBy',
  'mobileSessionId', 'verificationSessionId', 'previousAttemptRef',
  'currentAttemptRef', 'engineVersion', 'ruleSetId', 'ruleVersion',
  '_doc', '$__', '$isNew', 'isNew', '$locals', '$op', 'activePaths', '__parentArray', '$parent', 'parentArray',
  'buffer', 'rawBuffer', 'binaryData', '_bsontype',
]);

const FIELD_LABELS: Record<string, string> = {
  inputLoadL: 'Load (tester input)',
  loadL: 'Load',
  inputIndicationI: 'Indication (tester input)',
  indicationI: 'Indication',
  inputDeltaL: 'Additional load ΔL (tester input)',
  deltaL: 'Additional load ΔL',
  trueIndicationP: 'Calculated indication P',
  rawErrorE: 'Error E',
  correctedErrorEc: 'Corrected error Ec',
  mpeValue: 'MPE',
  mpeUnit: 'MPE unit',
  calculatedE0: 'Calculated zero error E0',
  zeroIndication: 'Zero indication I0',
  deltaL0: 'Additional zero load ΔL0',
  accuracyLimit: 'Applicable limit',
  limit: 'Applicable limit',
  difference: 'Difference',
  operatorNotes: 'Tester notes',
  notes: 'Tester notes',
  testerNotes: 'Tester notes',
  completedAt: 'Completed at',
  startedAt: 'Started at',
  recordedAt: 'Recorded at',
};

type ReviewField = { label: string; value: unknown };
type ReviewSection = { label: string; rows: Array<Record<string, unknown>> };

const isHidden = (key: string) => {
  if (HIDDEN_FIELDS.has(key)) return true;
  return /(?:^|_)(?:id|ids)$/i.test(key) || /(?:Id|IDs)$/.test(key);
};

function plainRecordData(value: any): any {
  if (value == null || value instanceof Date) return value;
  if (Buffer.isBuffer(value) || ArrayBuffer.isView(value) || value instanceof ArrayBuffer) return undefined;
  if (Array.isArray(value)) return value.map(plainRecordData);
  if (typeof value.toObject === 'function') {
    return plainRecordData(value.toObject({ depopulate: true, getters: false, virtuals: false, flattenMaps: true }));
  }
  if (typeof value === 'object') {
    if (value.type === 'Buffer' && Array.isArray(value.data)) return undefined;
    if (value._bsontype === 'Binary') return undefined;
    return Object.fromEntries(Object.entries(value)
      .filter(([key]) => !isHidden(key))
      .map(([key, child]) => [key, plainRecordData(child)]));
  }
  return value;
}

const humanize = (key: string) => FIELD_LABELS[key] || key
  .replace(/([a-z])([A-Z])/g, '$1 $2')
  .replace(/[_-]+/g, ' ')
  .replace(/\s+/g, ' ')
  .replace(/^./, character => character.toUpperCase());

const pathLabel = (path: string) => path.split('.').map(humanize).join(' · ');

const scalar = (value: unknown): unknown => {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return value;
};

const measurement = (value: any) => Boolean(value && typeof value === 'object' && !Array.isArray(value)
  && Object.prototype.hasOwnProperty.call(value, 'value')
  && Object.prototype.hasOwnProperty.call(value, 'unit')
  && (value.value === null || ['string', 'number'].includes(typeof value.value)));

function display(value: unknown): unknown {
  if (measurement(value)) {
    const item = value as { value: unknown; unit: unknown };
    const numeric = scalar(item.value);
    return numeric === null || numeric === undefined || numeric === '' ? 'Not recorded' : `${numeric} ${String(item.unit || '')}`.trim();
  }
  return scalar(value);
}

function flattenRow(value: unknown, prefix: string, row: Record<string, unknown>, nested: ReviewSection[]) {
  if (value === null || value === undefined || typeof value !== 'object' || value instanceof Date) {
    if (prefix) row[pathLabel(prefix)] = display(value);
    return;
  }
  if (measurement(value)) {
    row[pathLabel(prefix)] = display(value);
    return;
  }
  if (Array.isArray(value)) {
    if (value.length) nested.push({ label: pathLabel(prefix), rows: value.map((item, index) => {
      const child: Record<string, unknown> = {};
      flattenRow(item, '', child, []);
      return child;
    }).filter(item => Object.keys(item).length) });
    return;
  }
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (!isHidden(key)) flattenRow(child, prefix ? `${prefix}.${key}` : key, row, nested);
  }
}

function addValue(value: unknown, path: string, fields: ReviewField[], sections: ReviewSection[]) {
  if (value === null || value === undefined || typeof value !== 'object' || value instanceof Date || measurement(value)) {
    fields.push({ label: pathLabel(path), value: display(value) });
    return;
  }
  if (Array.isArray(value)) {
    const rows: Array<Record<string, unknown>> = [];
    const nested: ReviewSection[] = [];
    value.forEach((item, index) => {
      const row: Record<string, unknown> = {};
      flattenRow(item, '', row, nested);
      if (Object.keys(row).length) rows.push(row);
      else if (item !== null && item !== undefined) rows.push({ Value: display(item) });
      if (nested.length) {
        const children = nested.splice(0);
        for (const child of children) child.label = `${pathLabel(path)} · ${child.label}`;
        sections.push(...children);
      }
      if (index === value.length - 1 && nested.length) sections.push(...nested.splice(0));
    });
    if (rows.length) sections.push({ label: pathLabel(path), rows });
    return;
  }
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (!isHidden(key)) addValue(child, `${path}.${key}`, fields, sections);
  }
}

export function reviewRecord(record: any) {
  if (!record) return null;
  const normalized = plainRecordData(record);
  const fields: ReviewField[] = [];
  const sections: ReviewSection[] = [];
  for (const [key, value] of Object.entries(normalized)) {
    if (!isHidden(key)) addValue(value, key, fields, sections);
  }
  return {
    status: normalized.status || null,
    result: normalized.result || normalized.durabilityAssessment?.result || null,
    fields,
    sections,
  };
}
