import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, Clock3, Lock, Play } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import axios from 'axios';
import './stability-of-equilibrium.css';
import './stability-docs.css';
import TestProcedureInfo from '../guidance/TestProcedureInfo';
import EvidencePanel from '../evidence/EvidencePanel';
import UnitSelector from '../../shared/UnitSelector';

const fmt = (value: unknown, unit = 'g') => value === undefined || value === null || value === '' || !Number.isFinite(Number(value)) ? '—' : `${Number(value)} ${unit}`;
const documentationDetailsField = 'manufacturerDocumentationDetails';
const legacyDocumentationFields = [
  ['Stable-equilibrium principle', 'stableEquilibriumPrinciple'],
  ['Stable-equilibrium criterion', 'stableEquilibriumCriterion'],
  ['Adjustable parameters', 'adjustableParameters'],
  ['Non-adjustable parameters', 'nonAdjustableParameters'],
  ['Parameter security', 'parameterSecurityMethod'],
  ['Worst-case adjustment', 'worstCaseAdjustment'],
] as const;
const consolidateDocumentationDetails = (documentation: Record<string, unknown> = {}) => {
  const current = typeof documentation[documentationDetailsField] === 'string' ? documentation[documentationDetailsField].trim() : '';
  if (current) return current;
  return legacyDocumentationFields.map(([label, field]) => ({ label, value: typeof documentation[field] === 'string' ? documentation[field].trim() : '' })).filter(item => item.value).map(item => `${item.label}:\n${item.value}`).join('\n\n');
};
const emptyDocumentation = {
  [documentationDetailsField]: '', documentationAvailable: '', basicPrincipleDocumented: '', criteriaDocumented: '', adjustableParametersDocumented: '', nonAdjustableParametersDocumented: '', parameterSecurityDocumented: '', worstCaseAdjustmentIdentified: '', manufacturerDocumentationReference: '', evidenceReference: '',
};
const documentationChecks = [
  ['documentationAvailable', 'Manufacturer stable-equilibrium documentation available', ['Yes', 'No']],
  ['basicPrincipleDocumented', 'Basic principle / function documented', ['Yes', 'No']],
  ['criteriaDocumented', 'Stable-equilibrium criteria documented', ['Yes', 'No']],
  ['adjustableParametersDocumented', 'Adjustable parameters documented', ['Yes', 'No', 'Not applicable']],
  ['nonAdjustableParametersDocumented', 'Non-adjustable parameters documented', ['Yes', 'No', 'Not applicable']],
  ['parameterSecurityDocumented', 'Parameter security documented', ['Yes', 'No', 'Not applicable']],
  ['worstCaseAdjustmentIdentified', 'Worst-case adjustment identified', ['Yes', 'No', 'Not applicable']],
] as const;

type Form = Record<string, string>;
const emptyZeroForm: Form = { zeroLoad: '', indicationI0: '', deltaL: '' };
const emptyTareForm: Form = { tareLoad: '', indicationI0: '', deltaL: '' };

export default function StabilityOfEquilibriumWorkspace() {
  const { reportId = '' } = useParams();
  const [data, setData] = useState<any>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [observationUnit, setObservationUnit] = useState('g');
  const [docs, setDocs] = useState<Record<string, string>>(emptyDocumentation);
  const [actualLoad, setActualLoad] = useState('');
  const [printed, setPrinted] = useState('');
  const [sequence, setSequence] = useState('');
  const [functionTested, setFunctionTested] = useState('PRINT');
  const [disturbed, setDisturbed] = useState(false);
  const [immediate, setImmediate] = useState(false);
  const [continuous, setContinuous] = useState<Record<string, string>>({});
  const [zeroTrackingOffConfirmed, setZeroTrackingOffConfirmed] = useState(false);
  const [zeroForm, setZeroForm] = useState<Form>(emptyZeroForm);
  const [tareForm, setTareForm] = useState<Form>(emptyTareForm);

  const load = async () => {
    try {
      const response = await axios.get(`/test-reports/${reportId}/stability-of-equilibrium`);
      setData(response.data);
      const savedOperations = response.data.test?.continuousDisturbance?.operations || [];
      if (savedOperations.length) setContinuous(Object.fromEntries(savedOperations.map((item: any) => [item.operation, item.observed])));
      if (response.data.test?.documentation) setDocs({ ...emptyDocumentation, ...response.data.test.documentation, [documentationDetailsField]: consolidateDocumentationDetails(response.data.test.documentation) });
      if (response.data.test?.instrumentSnapshot?.unit) setObservationUnit(response.data.test.instrumentSnapshot.unit);
    } catch (e: any) { setError(e.response?.data?.message || 'Unable to load Stability of equilibrium.'); }
  };
  useEffect(() => { void load(); }, [reportId]);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 250); return () => window.clearInterval(timer); }, []);

  const action = async (request: () => Promise<any>) => {
    setBusy(true); setError('');
    try {
      const response = await request();
      setData((current: any) => ({ ...current, ...response.data, test: response.data.test || current?.test }));
      const savedOperations = response.data.test?.continuousDisturbance?.operations || [];
      if (savedOperations.length) setContinuous(Object.fromEntries(savedOperations.map((item: any) => [item.operation, item.observed])));
      return response;
    } catch (e: any) { setError(e.response?.data?.message || 'Unable to save Stability of equilibrium.'); return undefined; }
    finally { setBusy(false); }
  };

  const test = data?.test;
  const snapshot = test?.instrumentSnapshot || {};
  const unit = snapshot.unit || 'g';
  const plan = test?.plan || data?.applicability?.plan || {};
  const phase = (code: string) => test?.phases?.find((item: any) => item.code === code);
  const phase2 = phase('A.4.12.2');
  const activeOperations: string[] = plan.applicableOperations || [];
  const configuredAutomaticZero = String(snapshot.zeroSettingMethod || '').toLowerCase() === 'automatic' || snapshot.zeroTracking === true;
  const derivedLoadL0 = configuredAutomaticZero && Number.isFinite(Number(snapshot.e)) ? 10 * Number(snapshot.e) : 0;
  const completeDocs = Boolean(docs[documentationDetailsField]?.trim()) && documentationChecks.every(([field]) => docs[field]);
  const sequenceValues = useMemo(() => sequence.split(',').map(value => Number(value.trim())).filter(value => Number.isFinite(value)), [sequence]);
  const elapsed = test?.printStorage?.commandStartedAt ? Math.max(0, (now - new Date(test.printStorage.commandStartedAt).getTime()) / 1000) : 0;
  const printRepetitions: any[] = test?.printStorage?.repetitions || [];
  const printCount = printRepetitions.length;
  const printRepetition = test?.printStorage?.currentRepetition || printCount + 1;

  if (!data) return <main className="stability-page"><div className="stability-loading">{error || 'Loading A.4.12…'}</div></main>;
  if (!test) return <main className="stability-page"><header className="stability-top"><Link to={`/tester/reports/${reportId}/testing`}><ArrowLeft size={16} /> Testing</Link><strong>NAWI · TEST &amp; REPORT SYSTEM</strong></header><section className="stability-content"><h1>Stability of Equilibrium</h1><p>{data.applicability?.reason}</p>{error && <div className="stability-error">{error}</div>}{data.applicability?.status === 'NOT_APPLICABLE' ? <span className="stability-na-note">No test required</span> : <button className="stability-primary" disabled={busy || data.applicability?.executionSupported === false} onClick={() => void action(() => axios.post(`/test-reports/${reportId}/stability-of-equilibrium/start`))}><Play size={15} /> Start Test</button>}</section></main>;

  const saveDocs = () => action(() => axios.patch(`/test-reports/${reportId}/stability-of-equilibrium/documentation`, { manufacturerDocumentationDetails: docs[documentationDetailsField], ...Object.fromEntries(documentationChecks.map(([field]) => [field, docs[field]])), manufacturerDocumentationReference: docs.manufacturerDocumentationReference, evidenceReference: docs.evidenceReference }));
  const saveSetup = () => action(() => axios.patch(`/test-reports/${reportId}/stability-of-equilibrium/setup`, { actualLoad: Number(actualLoad), actualLoadUnit: observationUnit, notes: '' }));
  const startPrint = () => action(() => axios.patch(`/test-reports/${reportId}/stability-of-equilibrium/print-storage/start`, { repetition: printRepetition, functionTested, disturbanceConfirmed: true, initiatedImmediatelyConfirmed: true }));
  const finishPrint = () => action(() => axios.patch(`/test-reports/${reportId}/stability-of-equilibrium/print-storage/complete`, { repetition: printRepetition, printedValue: Number(printed), printedValueUnit: observationUnit, observedValues: sequenceValues, observedValueUnit: observationUnit }));
  const updateForm = (branch: 'zero' | 'tare', key: string, value: string) => (branch === 'zero' ? setZeroForm(current => ({ ...current, [key]: value })) : setTareForm(current => ({ ...current, [key]: value })));
  const saveRepetition = async (code: 'A.4.12.3' | 'A.4.12.4') => {
    const branch = code === 'A.4.12.3' ? 'zero' : 'tare';
    const form = branch === 'zero' ? zeroForm : tareForm;
    const count = (code === 'A.4.12.3' ? test.zeroSetting?.repetitions : test.tare?.repetitions)?.length || 0;
    const values = branch === 'zero'
      ? { zeroLoad: Number(form.zeroLoad), indicationI0: Number(form.indicationI0), deltaL: Number(form.deltaL) }
      : Object.fromEntries(Object.entries(form).map(([key, value]) => [key, Number(value)]));
    const payload: Record<string, unknown> = { ...values, repetition: count + 1, unit: observationUnit, disturbanceConfirmed: true, operationAttemptedImmediately: true, blockedBeforeStable: true, stableAfterConfirmed: true, zeroTrackingOffConfirmed };
    const response = await action(() => axios.patch(`/test-reports/${reportId}/stability-of-equilibrium/${branch === 'zero' ? 'zero-setting' : 'tare'}/repetitions/${payload.repetition}`, payload));
    if (response) { if (branch === 'zero') setZeroForm(emptyZeroForm); else setTareForm(emptyTareForm); }
  };
  const saveContinuous = () => action(() => axios.patch(`/test-reports/${reportId}/stability-of-equilibrium/continuous-disturbance`, { continuousDisturbanceConfirmed: true, operations: activeOperations.map(operation => ({ operation, observed: continuous[operation] })) }));
  const complete = () => action(() => axios.patch(`/test-reports/${reportId}/stability-of-equilibrium/complete`));

  return <main className="stability-page">
    <header className="stability-top"><Link to={`/tester/reports/${reportId}/testing`}><ArrowLeft size={16} /> Testing</Link><div><strong>NAWI</strong><span>TEST &amp; REPORT SYSTEM</span></div><span>{data.report?.testReportId}</span></header>
    <section className="stability-content">
      <div className="stability-heading"><div><span className="stability-kicker">A.4 · PERFORMANCE TEST</span><h1>Stability of Equilibrium</h1><p>Annex A A.4.12 · stable-equilibrium behavior and function inhibition.</p></div><span className={`stability-status ${String(test.result).toLowerCase()}`}>{test.status === 'COMPLETED' ? test.result : test.status.replace(/_/g, ' ')}</span></div>
      {error && <div className="stability-error">{error}</div>}
      <section className="stability-context"><div><small>Accuracy class</small><strong>{snapshot.accuracyClass || '—'}</strong></div><div><small>Max</small><strong>{fmt(snapshot.max, unit)}</strong></div><div><small>e</small><strong>{fmt(snapshot.e, unit)}</strong></div><div><small>d</small><strong>{fmt(snapshot.d, unit)}</strong></div><div><small>Recommended test load</small><strong>{fmt(plan.targetLoad?.value, unit)}</strong><small>0.50 × Max · recommendation</small></div></section>
      <section className="stability-unit"><UnitSelector value={observationUnit} onChange={setObservationUnit} disabled={test.status === 'COMPLETED' || busy} /><p>Use one observation unit for the actual load and all stability readings. Values remain stored in the configured instrument unit.</p></section>

      <section className="stability-section"><span className="stability-kicker">A.4.12.1</span><h2>Stability documentation / configuration review</h2><p>Record manufacturer-provided information only. This review is separate from the physical stability observations.</p><div className="stability-check-grid">{documentationChecks.map(([field, label, options]) => <label key={field}>{label}<select value={docs[field] || ''} onChange={event => setDocs({ ...docs, [field]: event.target.value })}><option value="">Select</option>{options.map(option => <option key={option}>{option}</option>)}</select></label>)}</div><div className="stability-fields stability-documentation-fields"><label className="stability-documentation-details">Manufacturer documentation details<small>Record the manufacturer-provided stable-equilibrium principle, criteria, adjustable and non-adjustable parameters, parameter security, and identified worst-case adjustment.</small><textarea value={docs[documentationDetailsField] || ''} onChange={event => setDocs({ ...docs, [documentationDetailsField]: event.target.value })} placeholder="Enter the manufacturer-documented stability information here. Record only information supported by the manufacturer's documentation." /></label><label>Manufacturer documentation reference<input value={docs.manufacturerDocumentationReference} onChange={event => setDocs({ ...docs, manufacturerDocumentationReference: event.target.value })} /></label><label>Evidence reference<input value={docs.evidenceReference} onChange={event => setDocs({ ...docs, evidenceReference: event.target.value })} /></label></div><button className="stability-secondary" disabled={busy || test.status === 'COMPLETED' || !completeDocs} onClick={() => void saveDocs()}>Save documentation review</button>{test.documentation?.reviewedAt && <span className="stability-saved-note">Documentation review saved · {test.phases.find((item: any) => item.code === 'A.4.12.1')?.result}</span>}</section>

      <section className="stability-section"><span className="stability-kicker">TEST SETUP</span><h2>Primary stability test</h2><div className="stability-setup"><div><small>Recommended target</small><strong>0.50 × Max · {fmt(plan.targetLoad?.value, unit)}</strong><p>OIML permits up to 50% of Max or a load in the relevant operating range. Record the actual load observed by the tester.</p></div><label>Actual test load ({observationUnit})<input type="number" min="0" step="any" value={actualLoad} onChange={event => setActualLoad(event.target.value)} disabled={test.status === 'COMPLETED'} /></label><button className="stability-secondary" disabled={busy || test.status === 'COMPLETED' || !test.documentation || !actualLoad} onClick={() => void saveSetup()}>Save actual load</button></div>{test.setup?.actualLoad && <p className="stability-saved-note">Recorded actual load: {fmt(test.setup.actualLoad.value, unit)}</p>}</section>

      {phase2?.applicability === 'APPLICABLE' && <section className="stability-section"><span className="stability-kicker">A.4.12.2</span><h2>Printing / data-storage stability</h2><p>Five repetitions. After one disturbance, initiate the configured function immediately and observe the indication for five seconds. Stable-equilibrium tolerance: 1e = {fmt(plan.printStorageInterval?.value ?? snapshot.e, unit)}.</p><div className="stability-progress-label">{printCount} / 5 repetitions</div>{test.printStorage?.status !== 'COMPLETED' && !test.printStorage?.commandStartedAt && <div className="stability-setup"><label>Function tested<select value={functionTested} onChange={event => setFunctionTested(event.target.value)} disabled={test.status === 'COMPLETED'}>{activeOperations.filter(item => item === 'PRINT' || item === 'STORE').map(item => <option key={item}>{item}</option>)}</select></label><label className="stability-check-label"><input type="checkbox" checked={disturbed} onChange={event => setDisturbed(event.target.checked)} /> I manually disturbed equilibrium.</label><label className="stability-check-label"><input type="checkbox" checked={immediate} onChange={event => setImmediate(event.target.checked)} /> I initiated the command immediately.</label><button className="stability-primary" disabled={busy || !test.setup || !disturbed || !immediate || test.status === 'COMPLETED'} onClick={() => void startPrint()}><Clock3 size={15} /> Start repetition {printRepetition} / 5</button></div>}{test.printStorage?.commandStartedAt && test.printStorage?.status !== 'COMPLETED' && <div className="stability-observe"><strong>{Math.max(0, 5 - elapsed).toFixed(3)} s</strong><span>Server timestamp is authoritative; this timer is a display aid.</span><label>First printed / stored value ({observationUnit})<input type="number" step="any" value={printed} onChange={event => setPrinted(event.target.value)} /></label><label>Observed indication sequence during five seconds ({observationUnit})<textarea value={sequence} onChange={event => setSequence(event.target.value)} placeholder="Enter actual readings separated by commas" /></label><small>Derived minimum: {sequenceValues.length ? fmt(Math.min(...sequenceValues), observationUnit) : '—'} · Derived maximum: {sequenceValues.length ? fmt(Math.max(...sequenceValues), observationUnit) : '—'}</small><button className="stability-primary" disabled={busy || elapsed < 5 || !printed || !sequenceValues.length} onClick={() => void finishPrint()}>Evaluate repetition {printRepetition}</button></div>}{printRepetitions.length > 0 && <div className="stability-results"><div className="stability-results-header"><strong>Repetition</strong><strong>Observed range</strong><strong>Result</strong></div>{printRepetitions.map((item: any) => <div className="stability-results-row" key={item.repetition}><span>{item.repetition} / 5</span><span>{fmt(item.minimumValue, unit)} – {fmt(item.maximumValue, unit)}</span><strong>{item.result}</strong></div>)}</div>}</section>}

      {(phase('A.4.12.3')?.applicability === 'APPLICABLE' || phase('A.4.12.4')?.applicability === 'APPLICABLE') && <section className="stability-condition"><strong>ZERO-SETTING / TARE PROCEDURE CONFIRMATION</strong><p>These confirmations record the tester’s procedural observations; they do not electronically prove the physical condition.</p><label className="stability-check-label"><input type="checkbox" checked={zeroTrackingOffConfirmed} onChange={event => setZeroTrackingOffConfirmed(event.target.checked)} disabled={test.status === 'COMPLETED'} /> Automatic zero-setting / zero-tracking was OFF during each stability repetition.</label></section>}

      {(['A.4.12.3', 'A.4.12.4'] as const).map(code => { const item = phase(code); if (item?.applicability !== 'APPLICABLE') return null; const isZero = code === 'A.4.12.3'; const branch = isZero ? test.zeroSetting : test.tare; const count = branch?.repetitions?.length || 0; const form = isZero ? zeroForm : tareForm; return <section className="stability-section" key={code}><span className="stability-kicker">{code}</span><h2>{isZero ? 'Zero-setting stability' : 'Tare-balancing stability'}</h2><p>Five actual repetitions are required. Earlier {isZero ? 'A.4.2.3' : 'A.4.6.2'} records provide the calculation method, not substitute repetitions.</p>{isZero && <p className="stability-formula">E₀ = I₀ + ½e − ΔL − L₀. L₀ = 10e only when automatic zero-setting / zero-tracking is in operation.</p>}<div className="stability-progress-label">{count} / 5 repetitions</div><div className="stability-progress">{Array.from({ length: 5 }, (_, index) => <span key={index} className={index < count ? 'done' : index === count ? 'active' : 'locked'}>{index < count ? <Check size={13} /> : index === count ? index + 1 : <Lock size={13} />}</span>)}</div>{count < 5 && <div className="stability-fields stability-repetition-form">{isZero ? <><label>Zero-load (&lt;4% Max) ({observationUnit})<input type="number" min="0" step="any" value={form.zeroLoad || ''} onChange={event => updateForm('zero', 'zeroLoad', event.target.value)} /></label><label>L₀ (10e, only if automatic zero-setting / zero-tracking is ON)<output className="stability-readonly-value">{zeroTrackingOffConfirmed ? 'Not applied (OFF confirmed)' : fmt(derivedLoadL0, observationUnit)}</output></label><label>Indication I₀ after zero-setting ({observationUnit})<input type="number" step="any" value={form.indicationI0 || ''} onChange={event => updateForm('zero', 'indicationI0', event.target.value)} /></label><label>Additional load ΔL ({observationUnit})<input type="number" min="0" step="any" value={form.deltaL || ''} onChange={event => updateForm('zero', 'deltaL', event.target.value)} /></label></> : <><label>Tare load ({observationUnit})<input type="number" min="0" step="any" value={form.tareLoad || ''} onChange={event => updateForm('tare', 'tareLoad', event.target.value)} /></label><label>Indication I₀ ({observationUnit})<input type="number" step="any" value={form.indicationI0 || ''} onChange={event => updateForm('tare', 'indicationI0', event.target.value)} /></label><label>ΔL ({observationUnit})<input type="number" min="0" step="any" value={form.deltaL || ''} onChange={event => updateForm('tare', 'deltaL', event.target.value)} /></label></>}<button className="stability-secondary" disabled={busy || test.status === 'COMPLETED' || !test.setup || !zeroTrackingOffConfirmed || item.status === 'LOCKED' || Object.values(form).some(value => value.trim() === '')} onClick={() => void saveRepetition(code)}>Save repetition {count + 1} / 5</button></div>}{isZero && count > 0 && <div className="stability-results"><div className="stability-results-header stability-zero-results-header"><strong>Repetition</strong><strong>E₀</strong><strong>Limit</strong><strong>Result</strong></div>{branch.repetitions.map((entry: any) => <div className="stability-results-row stability-zero-results-row" key={entry.repetition}><span>{entry.repetition} / 5</span><span>{fmt(entry.calculatedE0, observationUnit)}</span><span>{fmt(entry.accuracyLimit, observationUnit)}</span><strong>{entry.result}</strong></div>)}</div>}{!isZero && count >= 5 && <strong>{branch.result}</strong>}</section>; })}

      {phase('A.4.12.5')?.applicability === 'APPLICABLE' && <section className="stability-section"><span className="stability-kicker">A.4.12.5</span><h2>Continuous-disturbance inhibition</h2><p>Record each applicable function while continuous disturbance remains active. BLOCKED = PASS; EXECUTED = FAIL.</p><div className="stability-operations">{activeOperations.map(operation => <label key={operation}>{operation}<select value={continuous[operation] || ''} onChange={event => setContinuous({ ...continuous, [operation]: event.target.value })} disabled={test.status === 'COMPLETED'}><option value="">Select observed state</option><option>BLOCKED</option><option>EXECUTED</option></select><small>{test.continuousDisturbance?.operations?.find((item: any) => item.operation === operation) ? `Saved: ${test.continuousDisturbance.operations.find((item: any) => item.operation === operation).observed}` : 'Not saved'}</small></label>)}</div><button className="stability-secondary" disabled={busy || test.status === 'COMPLETED' || !activeOperations.length || activeOperations.some(operation => !continuous[operation])} onClick={() => void saveContinuous()}>Save inhibition observations</button>{test.continuousDisturbance?.result && <div className="stability-results stability-inhibition-result"><strong>Overall A.4.12.5</strong><strong>{test.continuousDisturbance.result}</strong></div>}</section>}

      <section className="stability-section stability-trace"><span className="stability-kicker">TRACEABILITY</span><h2>OIML R 76 traceability</h2><div className="stability-trace-grid"><div><small>Standard</small><strong>OIML R 76-1:2006</strong></div><div><small>Requirement</small><strong>§4.4.2 Stable equilibrium</strong></div><div><small>Test</small><strong>Annex A A.4.12</strong></div><div><small>Test areas</small><strong>Documentation · print/storage · zero-setting · tare · continuous disturbance</strong></div><div><small>Criteria</small><strong>Print/storage: 1e · zero/tare: relevant accuracy criterion · zero/tare stability: five repetitions</strong></div><div><small>Report form</small><strong>OIML R 76-2:2007 Section 7</strong></div></div>{test.status === 'IN_PROGRESS' && <button className="stability-primary" disabled={busy} onClick={() => void complete()}>Complete A.4.12</button>}{test.status === 'COMPLETED' && <Link className="stability-secondary" to={`/tester/reports/${reportId}/testing`}>Return to Testing</Link>}</section>
      <EvidencePanel context={{ reportId, testId: 'A.4.12', instrumentId: data.report?.instrumentId, category: 'TEST_SETUP', evidenceType: 'stability_setup', label: 'A.4.12 · Stability · Test Setup', testName: 'Stability of Equilibrium', oimlReference: 'A.4.12' }} />
      {data.applicability?.status !== 'NOT_APPLICABLE' && <TestProcedureInfo testId="A.4.12" configuration={{ ...snapshot, activeOperations, printingCapability: snapshot.printingCapability, dataStorageCapability: snapshot.dataStorageCapability, zeroSettingCapability: snapshot.zeroSettingCapability, tareCapability: snapshot.tareCapability, mobileInstrument: snapshot.mobileInstrument, applicabilityStatus: data.applicability?.status }} />}
    </section>
  </main>;
}
