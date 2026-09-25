import { useEffect, useState } from 'react';
import { ArrowLeft, Check, Lock, Pause, Play, Plus, Save, Layers } from 'lucide-react';
import axios from 'axios';
import { Link, useNavigate, useParams } from 'react-router-dom';
import './endurance.css';
import TestProcedureInfo from '../guidance/TestProcedureInfo';
import EvidencePanel from '../evidence/EvidencePanel';
import UnitSelector from '../../shared/UnitSelector';
import { convertMass, isMassUnit, massUnitFactors } from '../metrology/mass';

type MassUnit = keyof typeof massUnitFactors;

const API = (id: string, suffix = '') => `/test-reports/${id}/endurance${suffix}`;
const displayMass = (value: unknown, unit = 'g') => Number.isFinite(Number(value)) ? `${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 6 }).format(Number(value))} ${unit}` : '—';

export default function EnduranceWorkspace() {
  const { reportId = '' } = useParams(); const nav = useNavigate();
  const [data, setData] = useState<any>();
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const load = () => axios.get(API(reportId)).then(response => setData(response.data)).catch((e: any) => setError(e.response?.data?.message || 'Unable to load Endurance.'));
  useEffect(() => { void load(); }, [reportId]);
  useEffect(() => { if (data?.test?.cycleState !== 'RUNNING') return undefined; const timer = window.setInterval(() => void load(), 5000); return () => window.clearInterval(timer); }, [data?.test?.cycleState]);
  const action = async (method: 'post' | 'patch', suffix: string, body?: unknown) => { setBusy(true); setError(''); setNotice(''); try { const response = await axios[method](API(reportId, suffix), body); setData((current: any) => ({ ...current, ...response.data, test: response.data.test || current?.test })); setNotice(response.data.message || 'Saved.'); return response.data; } catch (e: any) { setError(e.response?.data?.message || 'Unable to save the endurance record.'); return undefined; } finally { setBusy(false); } };
  const completeTesting = async () => { const response = await action('patch', '/complete'); if (response?.handoff) nav(`/tester/reports/${reportId}/review`); };
  if (!data) return <main className="endurance-page"><div className="endurance-loading">{error || 'Loading Endurance…'}</div></main>;
  const applicability = data.applicability;
  const test = data.test;
  const snapshot = test?.instrumentSnapshot || data.report?.instrument || {};
  const unit = snapshot.unit || 'g';
  const plan = data.plan || { targetLoad: { value: Number(snapshot.max) / 2, unit } };
  const phases = test?.phases || [];
  const phase = (code: string) => phases.find((item: any) => item.code === code);
  const prototypeWorkflow = test?.phase2SkipMode === 'PROTOTYPE' || phase('A.6.2')?.skipMode === 'PROTOTYPE';
  const start = () => void action('post', '/start');
  return <main className="endurance-page">
    <header className="workspace-top"><Link to={`/tester/reports/${reportId}/influence-factors`}><ArrowLeft size={16} /> A.5 Influence Factors</Link><div className="workspace-brand"><strong>NAWI</strong><span>TEST &amp; REPORT SYSTEM</span></div><span className="endurance-route-label">ROUTE 3 OF 3 · A.6</span></header>
    <section className="endurance-content">
      <div className="endurance-heading"><div><span className="technical-label">ANNEX A · FINAL TEST ROUTE</span><h1>A.6 Endurance</h1><p>Controlled recording of the laboratory endurance operation and durability assessment.</p></div><span className={`endurance-badge ${test?.status === 'COMPLETED' ? 'complete' : ''}`}>{test?.result || applicability?.status || 'READY'}</span></div>
      {error && <div className="endurance-error">{error}</div>}
      {notice && <div className="endurance-notice" role="status">{notice}</div>}
      <section className="endurance-context"><span className="technical-label">INSTRUMENT CONTEXT</span><div className="endurance-context-grid"><span><b>Class</b>{snapshot.accuracyClass || '—'}</span><span><b>Min</b>{displayMass(snapshot.min, unit)}</span><span><b>Max</b>{displayMass(snapshot.max, unit)}</span><span><b>e / d</b>{displayMass(snapshot.e, unit)} / {displayMass(snapshot.d, unit)}</span></div></section>
      {applicability?.status === 'NOT_APPLICABLE' && <section className="endurance-notice"><span className="technical-label">APPLICABILITY</span><h2>Endurance is not applicable</h2><p>{applicability.reason}</p><Link className="endurance-secondary" to={`/tester/reports/${reportId}/review`}>Continue to Review &amp; Submit</Link></section>}
      {applicability?.status === 'APPLICABLE' && !test && <section className="endurance-start"><span className="technical-label">ROUTE 3 · A.6</span><h2>Endurance session</h2><p>The physical operation remains a laboratory activity. This session records its conditions, exactly 100,000 applications, linked pre/post weighing evidence, and audit events.</p><div className="endurance-target"><span>Target endurance load</span><strong>{displayMass(plan.targetLoad?.value, plan.targetLoad?.unit || unit)}</strong><small>Reference derived as approximately 50% of Max; actual load is entered after the session starts.</small></div><div className="endurance-rule">Required endurance applications: <strong>100,000</strong> · Source: OIML R 76-1:2006 Annex A A.6</div><button className="endurance-primary" onClick={start} disabled={busy}><Play size={16} /> Start Endurance</button></section>}
      {test && applicability?.status === 'APPLICABLE' && <>
        <PhaseHeader phase={phase('A.6.1')} number="01" title="Pre-endurance weighing" />
        <section className="endurance-panel"> <p>Pre-endurance weighing establishes the intrinsic error used for the post-endurance durability assessment. It reuses the completed A.4.4 observation and calculation.</p>{test.preWeighing ? <div className="endurance-saved"><Check size={16} /> Linked source {test.preWeighing.sourceObservationId} · error {displayMass(test.preWeighing.correctedErrorEc, unit)}</div> : <button className="endurance-primary" onClick={() => void action('patch', '/pre-weighing')} disabled={busy || phase('A.6.1')?.status === 'COMPLETED'}><Save size={16} /> Link completed A.4.4 baseline</button>}</section>
        <PhaseHeader phase={phase('A.6.2')} number="02" title="100,000 loading applications" />
        <section className="endurance-panel">{!test.loadingConditions ? <ConditionsForm plan={plan} unit={unit} busy={busy} onSave={(body: any) => void action('patch', '/conditions', body)} /> : <CyclePanel test={test} phase={phase('A.6.2')} unit={unit} plan={plan} busy={busy} action={action} />}</section>
        <PhaseHeader phase={phase('A.6.3')} number="03" title="Post-endurance weighing" />
        <section className="endurance-panel">{test.postWeighing ? <><PrototypeNotice active={prototypeWorkflow} /><div className="endurance-saved"><Check size={16} /> Post-endurance weighing recorded · error {displayMass(test.postWeighing.Ec, unit)}</div></> : phase('A.6.3')?.status === 'AVAILABLE' ? <><PrototypeNotice active={prototypeWorkflow} /><PostWeighingForm test={test} unit={unit} busy={busy} onSave={(body: any) => void action('patch', '/post-weighing', body)} /></> : <div className="endurance-locked"><Lock size={16} /> Locked until the endurance loading phase is complete.</div>}</section>
        <PhaseHeader phase={phase('A.6.4')} number="04" title="Durability assessment" />
        <section className="endurance-panel">{test.durabilityAssessment?.supported ? <><PrototypeNotice active={prototypeWorkflow} /><div className="endurance-assessment"><span>Durability error</span><strong>{displayMass(test.durabilityAssessment.durabilityError, unit)}</strong><span>Absolute MPE</span><strong>{displayMass(test.durabilityAssessment.mpeValue, unit)}</strong><b className={test.durabilityAssessment.result === 'PASS' ? 'pass' : 'fail'}>{test.durabilityAssessment.result}</b></div>{test.status !== 'COMPLETED' && <button className="endurance-primary" onClick={() => void completeTesting()} disabled={busy}>Complete Testing <Check size={16} /></button>}{test.status === 'COMPLETED' && <div className="endurance-next"><Check size={18} /><div><strong>Testing Complete</strong><span>All required routes are recorded. A.6 is the final test route.</span></div><Link className="endurance-primary" to={`/tester/reports/${reportId}/review`}>Review &amp; Submit</Link></div>}</> : <div className="endurance-locked"><Lock size={16} /> Locked until post-endurance weighing and durability assessment are complete.</div>}</section>
      </>}
      {applicability?.status !== 'NOT_APPLICABLE' && <EvidencePanel context={{ reportId, testId: 'A.6', instrumentId: data.report?.instrumentId, category: 'ENDURANCE', evidenceType: 'endurance_setup', label: 'A.6 · Endurance · Setup', testName: 'Endurance', oimlReference: 'A.6' }} />}
      {applicability?.status !== 'NOT_APPLICABLE' && <TestProcedureInfo testId="A.6" configuration={{ ...snapshot, applicabilityStatus: applicability?.status }} />}
    </section>
  </main>;
}

function PhaseHeader({ phase, number, title }: any) { return <div className="endurance-phase-header"><span>{phase?.status === 'COMPLETED' ? <Check size={16} /> : phase?.status === 'LOCKED' ? <Lock size={14} /> : number}</span><div><small>PHASE {number}</small><h2>{title}</h2></div><strong>{phase?.status || 'LOCKED'}</strong></div>; }

const confirmationFields = [
  { name: 'loadedEquilibriumConfirmed', label: 'Loaded equilibrium was attained.' },
  { name: 'unloadedEquilibriumConfirmed', label: 'Unloaded equilibrium was attained.' },
  { name: 'appliedForceWithinNormalOperation', label: 'Applied force did not exceed normal loading operation.' },
  { name: 'normalConditionsConfirmed', label: 'Operation was carried out under normal conditions of use.' },
];

function ConditionsForm({ plan, unit, busy, onSave }: any) {
  const [confirmationCount, setConfirmationCount] = useState(0);
  const [observationUnit, setObservationUnit] = useState<MassUnit>(isMassUnit(unit) ? unit : 'g');
  const updateConfirmationCount = (event: React.ChangeEvent<HTMLInputElement>) => {
    const form = event.currentTarget.form;
    const count = form
      ? confirmationFields.filter(field => (form.elements.namedItem(field.name) as HTMLInputElement | null)?.checked).length
      : 0;
    setConfirmationCount(count);
  };

  const targetValue = plan?.targetLoad?.value === undefined ? undefined : convertMass(Number(plan.targetLoad.value), plan.targetLoad.unit || observationUnit, observationUnit);
  return <form className="endurance-form" onSubmit={event => {
    event.preventDefault();
    const body = Object.fromEntries(new FormData(event.currentTarget));
    onSave({ actualLoad: body.actualLoad === '' ? undefined : Number(body.actualLoad), unit: observationUnit, loadingMethod: body.loadingMethod, loadingFrequency: body.loadingFrequency, loadingBehavior: body.loadingBehavior, loadedEquilibriumConfirmed: body.loadedEquilibriumConfirmed === 'on', unloadedEquilibriumConfirmed: body.unloadedEquilibriumConfirmed === 'on', appliedForceWithinNormalOperation: body.appliedForceWithinNormalOperation === 'on', normalConditionsConfirmed: body.normalConditionsConfirmed === 'on', supportingEvidence: body.supportingEvidence || '' });
  }}>
    <div className="endurance-reference"><span>Target reference · approximately 50% of Max</span><strong>{displayMass(targetValue, observationUnit)}</strong><small>Reference derived from Max. Enter the actual endurance load used by the laboratory.</small></div>
    <UnitSelector value={observationUnit} onChange={value => isMassUnit(value) && setObservationUnit(value)} disabled={busy} />
    <label>Actual endurance load ({observationUnit})<input name="actualLoad" type="number" step="any" min="0" required /></label>
    <label>Loading method<select name="loadingMethod" defaultValue="MANUAL"><option value="MANUAL">Manual</option><option value="TEST_EQUIPMENT">Test equipment</option><option value="OTHER">Other</option></select></label>
    <label>Loading frequency / documented description<input name="loadingFrequency" required /></label>
    <label>Loading and unloading behavior<textarea name="loadingBehavior" rows={2} required /></label>
    <fieldset className="endurance-confirmation">
      <legend>PROCEDURE CONFIRMATION</legend>
      <p className="endurance-confirmation-help">These confirmations record the tester's procedural observations; the software does not electronically prove the physical condition.</p>
      <div className="endurance-confirmation-status" aria-live="polite">{confirmationCount} of 4 confirmations recorded</div>
      <div className="endurance-confirmation-grid">
        {confirmationFields.map(field => <label className="endurance-check" key={field.name}><input name={field.name} type="checkbox" required onChange={updateConfirmationCount} /><span>{field.label}</span></label>)}
      </div>
    </fieldset>
    <label>Supporting evidence / notes<textarea name="supportingEvidence" rows={2} /></label>
    <button className="endurance-primary" disabled={busy}><Save size={16} /> Save conditions</button>
  </form>;
}

function PrototypeNotice({ active }: { active: boolean }) { return active ? <div className="endurance-prototype-notice"><strong>SYNTHETIC PROTOTYPE / REGRESSION DATA</strong><span>This phase uses synthetic endurance workflow values. The calculated result remains separate from the prototype classification.</span></div> : null; }

function CyclePanel({ test, phase, unit, plan, busy, action }: any) {
  const progress = (Number(test.completedCycles || 0) / Number(test.targetCycles || 100000)) * 100;
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchSize, setBatchSize] = useState('100');
  const displayUnit: MassUnit = isMassUnit(test.actualLoad?.unit) ? test.actualLoad.unit : (isMassUnit(unit) ? unit : 'g');
  const targetValue = plan?.targetLoad?.value === undefined ? undefined : convertMass(Number(plan.targetLoad.value), plan.targetLoad.unit || displayUnit, displayUnit);
  const record = () => void action('post', '/cycles/record', { count: 1, mode: 'REAL', eventId: `${Date.now()}-${Math.random()}` });
  const recordBatch = (event: React.FormEvent<HTMLFormElement>) => { event.preventDefault(); const count = Number(batchSize); void action('post', '/cycles/record', { count, mode: 'SYNTHETIC', eventId: `${Date.now()}-${Math.random()}` }); setBatchOpen(false); };
  const saveEvent = (event: React.FormEvent<HTMLFormElement>) => { event.preventDefault(); const body = Object.fromEntries(new FormData(event.currentTarget)); void action('post', '/abnormal-event', { eventType: body.eventType, description: body.description, actionTaken: body.actionTaken, continued: body.continued === 'on', evidence: body.evidence || '', applicationCompleted: body.applicationCompleted || 'NONE', eventId: `${Date.now()}-${Math.random()}` }); };
  const syntheticCycles = Number(test.syntheticCycles || 0);
  const prototypeWorkflow = test.phase2SkipMode === 'PROTOTYPE' || phase?.skipMode === 'PROTOTYPE';
  return <div className="cycle-panel">
    <div className="cycle-summary"><div><small>Required</small><strong>{Number(test.targetCycles).toLocaleString('en-IN')}</strong><span>applications</span></div><div><small>Completed</small><strong>{Number(test.completedCycles || 0).toLocaleString('en-IN')}</strong><span>applications</span></div><div><small>Remaining</small><strong>{Number(test.targetCycles - test.completedCycles).toLocaleString('en-IN')}</strong><span>applications</span></div></div>
    <div className="cycle-progress"><div style={{ width: `${Math.min(100, progress)}%` }} /><span>{progress.toFixed(2)}%</span></div>
    {syntheticCycles > 0 && <div className="cycle-synthetic-warning"><strong>SYNTHETIC PROTOTYPE COUNT</strong><span>{syntheticCycles.toLocaleString('en-IN')} applications were added for workflow testing only. They are not laboratory endurance evidence.</span></div>}
    <div className="cycle-load"><span>Target {displayMass(targetValue, displayUnit)}</span><strong>Actual {displayMass(test.actualLoad?.value, displayUnit)}</strong><span>Automatic zero-setting/zero-tracking: configured state retained</span></div>
    {test.cycleState === 'NOT_STARTED' && <button className="endurance-primary" onClick={() => void action('post', '/cycles/start')} disabled={busy}><Play size={16} /> Start cycle session</button>}
    {test.cycleState === 'RUNNING' && <div className="cycle-actions"><button className="endurance-primary" onClick={record} disabled={busy || test.completedCycles >= test.targetCycles}><Plus size={16} /> Record one application</button><button className="endurance-secondary" onClick={() => void action('post', '/cycles/pause')} disabled={busy}><Pause size={16} /> Pause</button><button className="endurance-secondary" onClick={() => setBatchOpen(current => !current)} disabled={busy}><Layers size={16} /> Record batch</button></div>}
    {test.cycleState === 'RUNNING' && batchOpen && <form className="endurance-batch" onSubmit={recordBatch}><strong>SYNTHETIC BATCH ADVANCEMENT</strong><span>Prototype / synthetic only. This does not represent actual laboratory applications.</span><label>Batch size<select value={batchSize} onChange={event => setBatchSize(event.target.value)} disabled={busy}><option value="1">1</option><option value="10">10</option><option value="100">100</option><option value="1000">1,000</option><option value="10000">10,000</option></select></label><button className="endurance-secondary" disabled={busy}>Add batch</button></form>}
    {test.cycleState === 'PAUSED' && <button className="endurance-primary" onClick={() => void action('post', '/cycles/resume')} disabled={busy}><Play size={16} /> Resume</button>}
    {test.cycleState === 'COMPLETED' && <div className="endurance-saved"><Check size={16} /> {syntheticCycles > 0 ? 'Synthetic prototype count reached 100,000. Post-endurance weighing is available for this prototype workflow.' : 'Exactly 100,000 applications recorded. Post-endurance weighing is available.'}</div>}
    {prototypeWorkflow && <PrototypeNotice active />}
    <details className="endurance-event"><summary>Record an abnormal event</summary><form className="endurance-form" onSubmit={saveEvent}><label>Event type<select name="eventType" defaultValue="OTHER"><option value="TEST_EQUIPMENT_INTERRUPTION">Test equipment interruption</option><option value="POWER_INTERRUPTION">Power interruption</option><option value="MECHANICAL_ISSUE">Mechanical issue</option><option value="LOAD_HANDLING_INTERRUPTION">Load handling interruption</option><option value="INSTRUMENT_FAULT">Instrument fault</option><option value="ENVIRONMENTAL_ISSUE">Environmental issue</option><option value="OTHER">Other</option></select></label><label>Description<textarea name="description" rows={2} required /></label><label>Action taken<textarea name="actionTaken" rows={2} required /></label><label className="endurance-check"><input name="continued" type="checkbox" /> Testing continued after the event</label><fieldset className="endurance-event-application"><legend>Application completed during event</legend><label><input name="applicationCompleted" type="radio" value="NONE" defaultChecked /> No application completed</label><label><input name="applicationCompleted" type="radio" value="ONE" /> One application completed</label></fieldset><label>Evidence<textarea name="evidence" rows={2} /></label><button className="endurance-secondary" disabled={busy}>Save abnormal event</button></form></details>
    {test.abnormalEvents?.length > 0 && <div className="endurance-event-history"><span className="technical-label">RECENT ABNORMAL EVENTS</span>{test.abnormalEvents.slice(-5).reverse().map((event: any, index: number) => <span key={`${event.eventId || event.timestamp}-${index}`}>{new Date(event.timestamp).toLocaleString()} · {event.applicationCompleted === 'ONE' ? `1 application recorded · Count ${Number(event.cycleNumber).toLocaleString('en-IN')}` : 'Application count unchanged'}</span>)}</div>}
    <div className="checkpoint-list"><span className="technical-label">SOFTWARE RECOVERY CHECKPOINTS</span>{(test.checkpoints || []).map((checkpoint: any) => <span key={`${checkpoint.cycleNumber}-${checkpoint.timestamp}`}>{Number(checkpoint.cycleNumber).toLocaleString('en-IN')} · {new Date(checkpoint.timestamp).toLocaleString()}</span>)}</div>
  </div>;
}

function PostWeighingForm({ test, unit, busy, onSave }: any) { return <form className="endurance-form" onSubmit={event => { event.preventDefault(); const body = Object.fromEntries(new FormData(event.currentTarget)); onSave({ load: Number(body.load), indication: Number(body.indication), deltaL: Number(body.deltaL), zeroError: Number(body.zeroError || 0), unit, notes: body.notes || '' }); }}><p>Use the same load as the linked pre-endurance baseline so the durability comparison is traceable.</p><label>Actual post-endurance load ({unit})<input name="load" type="number" step="any" min="0" required /></label><label>Indication I ({unit})<input name="indication" type="number" step="any" required /></label><label>Additional load ΔL ({unit})<input name="deltaL" type="number" step="any" min="0" required /></label><label>Zero error E₀ ({unit})<input name="zeroError" type="number" step="any" defaultValue="0" required /></label><label>Notes<textarea name="notes" rows={2} /></label><button className="endurance-primary" disabled={busy}><Save size={16} /> Save post-endurance weighing</button></form>; }
