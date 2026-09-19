import { Schema, model } from 'mongoose';

export const CHECKLIST_ITEMS = [
  { id: 'a1-technical-information', section: 'A.1', title: 'Technical information and data', source: 'R 76-2, checklist 17, 8.2.1.1' },
  { id: 'a1-descriptive-documents', section: 'A.1', title: 'Applicable descriptive documents', source: 'R 76-2, checklist 17, 8.2.1.2' },
  { id: 'a1-specific-declaration', section: 'A.1', title: 'Specific declaration of the manufacturer', source: 'R 76-2, checklist 17, 5.3.6.1' },
  { id: 'a1-tilting-limit', section: 'A.1', title: 'Limiting value of tilting defined by the manufacturer', source: 'R 76-2, checklist 17, 3.9.1.1' },
  { id: 'a1-components', section: 'A.1', title: 'Specifications of components', source: 'R 76-2, checklist 17, 3.10.2' },
  { id: 'a2-documents', section: 'A.2', title: 'Documents', source: 'R 76-2, checklist 17, 8.2.2' },
  { id: 'a2-functions', section: 'A.2', title: 'Functions (spot checks)', source: 'R 76-2, checklist 17, 8.2.2' },
  { id: 'a2-other-reports', section: 'A.2', title: 'Test reports from other authorities', source: 'R 76-2, checklist 17, 8.2.2' },
  { id: 'a31-characteristics', section: 'A.3.1', title: 'Metrological characteristics noted according to the Test Report Format', source: 'R 76-1, Annex A.3.1; R 76-2' },
  { id: 'a32-manufacturer-mark', section: 'A.3.2', title: "Manufacturer's mark or name", source: 'R 76-2, checklist 17, 7.1.1' },
  { id: 'a32-accuracy-class', section: 'A.3.2', title: 'Accuracy class', source: 'R 76-2, checklist 17, 7.1.1' },
  { id: 'a32-max', section: 'A.3.2', title: 'Maximum capacity, Max, Max1, Max2, ...', source: 'R 76-2, checklist 17, 7.1.1' },
  { id: 'a32-min', section: 'A.3.2', title: 'Minimum capacity, Min', source: 'R 76-2, checklist 17, 7.1.1' },
  { id: 'a32-e', section: 'A.3.2', title: 'Verification scale interval, e, e1, e2, ...', source: 'R 76-2, checklist 17, 7.1.1' },
  { id: 'a32-serial', section: 'A.3.2', title: 'Serial number', source: 'R 76-2, checklist 17, 7.1.2' },
  { id: 'a32-identification-marks', section: 'A.3.2', title: 'Identification marks on separate but associated units', source: 'R 76-2, checklist 17, 7.1.2' },
  { id: 'a32-type-approval', section: 'A.3.2', title: 'Type approval mark', source: 'R 76-2, checklist 17, 7.1.2' },
  { id: 'a32-d', section: 'A.3.2', title: 'Scale interval, d (d < e)', source: 'R 76-2, checklist 17, 7.1.2' },
  { id: 'a32-software', section: 'A.3.2', title: 'Software identification (if applicable)', source: 'R 76-2, checklist 17, 7.1.2' },
  { id: 'a33-verification-mark-removal', section: 'A.3.3', title: 'Verification mark cannot be removed', source: 'R 76-2, checklist 17, 7.2' },
  { id: 'a33-verification-mark-application', section: 'A.3.3', title: 'Verification mark permits easy application', source: 'R 76-2, checklist 17, 7.2' },
  { id: 'a33-verification-mark-visibility', section: 'A.3.3', title: 'Verification mark is visible without moving the instrument in service', source: 'R 76-2, checklist 17, 7.2' },
  { id: 'a33-support', section: 'A.3.3', title: 'Verification mark support or space ensures conservation of the mark', source: 'R 76-2, checklist 17, 7.2.2' },
  { id: 'a33-securing-location-form', section: 'A.3.3', title: 'Securing of components and preset controls: location and form', source: 'R 76-2, checklist 17, 4.1.2.4' },
  { id: 'a33-software-status', section: 'A.3.3', title: 'Legal status of the instrument recognizable by software means', source: 'R 76-2, checklist 17, 4.1.2.4' },
  { id: 'a33-intervention', section: 'A.3.3', title: 'Evidence of any intervention', source: 'R 76-2, checklist 17, 4.1.2.4' },
  { id: 'a33-parameter-protection', section: 'A.3.3', title: 'Protection against changes of parameters and reference numbers', source: 'R 76-2, checklist 17, 4.1.2.4' },
  { id: 'a33-reference-number', section: 'A.3.3', title: 'Facilities for affixing the reference number', source: 'R 76-2, checklist 17, 4.1.2.4' },
  { id: 'a33-span-adjustment', section: 'A.3.3', title: 'External influence impossible after securing for span adjustment device', source: 'R 76-2, checklist 17, 4.1.2.5' },
  { id: 'a33-gravity-compensation', section: 'A.3.3', title: 'External influence on or access to gravity compensation impossible after securing', source: 'R 76-2, checklist 17, 4.1.2.6' },
] as const;

export const MVP_VERIFICATION_SECTIONS = [
  { sectionCode: 'A1', title: 'A.1 Administrative Examination', description: 'Review the submitted documentation and technical information.' },
  { sectionCode: 'A2', title: 'A.2 Construction vs Documentation', description: 'Check whether the physical instrument corresponds to the submitted documentation.' },
  { sectionCode: 'A3', title: 'A.3 Initial Examination', description: "Check the instrument's metrological characteristics, descriptive markings, and securing arrangements." },
] as const;

const itemSchema = new Schema({ itemId: { type: String, required: true }, section: { type: String, required: true }, title: { type: String, required: true }, source: { type: String, required: true }, status: { type: String, enum: ['NOT_CHECKED', 'SATISFACTORY', 'ISSUE_FOUND', 'MATCHES_DOCUMENTATION', 'DISCREPANCY_FOUND', 'NOT_APPLICABLE'], default: 'NOT_CHECKED' }, observation: { type: String, default: '' }, discrepancy: { type: String, default: '' } }, { _id: false });
const resultSchema = new Schema({ sectionCode: { type: String, enum: ['A1', 'A2', 'A3'], required: true }, title: { type: String, required: true }, description: { type: String, required: true }, status: { type: String, enum: ['NOT_CHECKED', 'PASS', 'FAIL', 'NOT_APPLICABLE'], default: 'NOT_CHECKED' }, observation: { type: String, default: '' }, updatedAt: Date, updatedBy: Schema.Types.ObjectId }, { _id: false });
const eventSchema = new Schema({ sequenceNumber: Number, previousHash: String, currentHash: { type: String, required: true }, action: { type: String, required: true }, userId: Schema.Types.ObjectId, userNameSnapshot: String, role: String, checklistItemId: String, metadata: Schema.Types.Mixed, timestamp: { type: Date, default: Date.now } }, { _id: false });
const sessionSchema = new Schema({ reportId: { type: Schema.Types.ObjectId, ref: 'TestReport', required: true, unique: true, index: true }, testerId: { type: Schema.Types.ObjectId, ref: 'User', required: true }, testerNameSnapshot: { type: String, required: true }, testerRole: { type: String, required: true }, status: { type: String, enum: ['IN_PROGRESS', 'COMPLETED'], default: 'IN_PROGRESS' }, overallStatus: { type: String, enum: ['NOT_CHECKED', 'PASSED', 'ISSUE_FOUND'], default: 'NOT_CHECKED' }, startedAt: { type: Date, required: true }, completedAt: Date, results: { type: [resultSchema], default: [] }, items: { type: [itemSchema], required: true }, events: { type: [eventSchema], default: [] } }, { timestamps: true, collection: 'verificationSessions' });
export const VerificationSession = model('VerificationSession', sessionSchema);
