export type EvidenceDefinition = {
  type: string;
  label: string;
  category: string;
  requirementLevel: 'required' | 'recommended' | 'optional';
  description: string;
};

export const evidenceDefinitions: Record<string, EvidenceDefinition[]> = {
  INSTRUMENT: [
    { type: 'instrument_front', label: 'Instrument · Front View', category: 'INSTRUMENT', requirementLevel: 'optional', description: 'Overall instrument identification and construction context.' },
    { type: 'nameplate', label: 'Instrument · Nameplate', category: 'INSTRUMENT', requirementLevel: 'optional', description: 'Manufacturer, model, serial and marking context.' },
    { type: 'serial_number', label: 'Instrument · Serial Number', category: 'INSTRUMENT', requirementLevel: 'optional', description: 'Close view of the serial or identification mark.' },
  ],
  'A.4.7': [
    { type: 'eccentricity_setup', label: 'A.4.7 · Eccentricity · Test Setup', category: 'TEST_SETUP', requirementLevel: 'optional', description: 'Load receptor and support arrangement before eccentric loading.' },
    { type: 'load_position', label: 'A.4.7 · Eccentricity · Load Position', category: 'OBSERVATION', requirementLevel: 'optional', description: 'Actual physical load position used for the observation.' },
  ],
  'A.4.12': [
    { type: 'stability_setup', label: 'A.4.12 · Stability · Test Setup', category: 'TEST_SETUP', requirementLevel: 'optional', description: 'Stable-equilibrium setup and configured indication arrangement.' },
    { type: 'indicator_display', label: 'A.4.12 · Indicator Display', category: 'OBSERVATION', requirementLevel: 'optional', description: 'Observed indicator state during the stability procedure.' },
    { type: 'printing_or_storage_setup', label: 'A.4.12 · Printing or Storage Setup', category: 'TEST_SETUP', requirementLevel: 'optional', description: 'Configured printing or data-storage function where applicable.' },
  ],
  'A.4.13': [
    { type: 'site_overview', label: 'A.4.13 · Portable Weighbridge · Site Overview', category: 'SITE', requirementLevel: 'optional', description: 'Agreed site and surrounding installation context.' },
    { type: 'reference_area', label: 'A.4.13 · Portable Weighbridge · Reference Area', category: 'SITE', requirementLevel: 'optional', description: 'Reference area and evenness context.' },
    { type: 'mounting_surface', label: 'A.4.13 · Mounting Surface', category: 'SITE', requirementLevel: 'optional', description: 'Mounting surface conformity and installation context.' },
    { type: 'installation', label: 'A.4.13 · Installation', category: 'SITE', requirementLevel: 'optional', description: 'Installed bridge and support arrangement.' },
  ],
  'A.5.1': [{ type: 'tilt_setup', label: 'A.5.1 · Tilt · Test Setup', category: 'TEST_SETUP', requirementLevel: 'optional', description: 'Tilt arrangement and physical reference.' }],
  'A.5.3': [{ type: 'temperature_setup', label: 'A.5.3 · Temperature · Test Setup', category: 'ENVIRONMENT', requirementLevel: 'optional', description: 'Environmental chamber or temperature condition.' }],
  'A.5.4': [{ type: 'power_source_setup', label: 'A.5.4 · Power · Test Setup', category: 'POWER', requirementLevel: 'optional', description: 'Power source and voltage condition.' }],
  A6: [
    { type: 'endurance_setup', label: 'A.6 · Endurance · Test Setup', category: 'ENDURANCE', requirementLevel: 'optional', description: 'Physical endurance loading arrangement.' },
    { type: 'pre_test_condition', label: 'A.6 · Endurance · Pre-Test Condition', category: 'ENDURANCE', requirementLevel: 'optional', description: 'Instrument condition before endurance loading.' },
    { type: 'post_test_condition', label: 'A.6 · Endurance · Post-Test Condition', category: 'ENDURANCE', requirementLevel: 'optional', description: 'Instrument condition after endurance loading.' },
  ],
};

export function findEvidenceDefinition(testId: string | undefined, evidenceType: string) {
  const definitions = evidenceDefinitions[testId || 'INSTRUMENT'] || evidenceDefinitions.INSTRUMENT;
  return definitions.find(item => item.type === evidenceType) || { type: evidenceType, label: evidenceType.replace(/_/g, ' '), category: 'OTHER', requirementLevel: 'optional' as const, description: 'Supporting evidence.' };
}
