import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, Lock, Play, Save } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import axios from 'axios';
import './discrimination.css';
import './discrimination-stage.css';
import TestProcedureInfo from '../guidance/TestProcedureInfo';
import EvidencePanel from '../evidence/EvidencePanel';

const units = ['mg', 'g', 'kg', 't'];
const format = (value: unknown, unit?: string) => Number.isFinite(Number(value)) ? `${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 9 }).format(Number(value))}${unit ? ` ${unit}` : ''}` : '—';

export default function DiscriminationWorkspace() {
  const { reportId = '' } = useParams();
  const [data, setData] = useState<any>(); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const load = async () => { setError(''); try { const response = await axios.get(`/test-reports/${reportId}/discrimination`); setData(response.data); } catch (e: any) { setError(e.response?.data?.message || 'Unable to load the discrimination test.'); } };
  useEffect(() => { void load(); }, [reportId]);
  const start = async () => { setBusy(true); try { const response = await axios.post(`/test-reports/${reportId}/discrimination/start`); setData((current: any) => ({ ...current, ...response.data, test: response.data.test })); setError(''); } catch (e: any) { setError(e.response?.data?.message || 'Unable to start the discrimination test.'); } finally { setBusy(false); } };
  if (!data) return <main className="discrimination-page"><div className="discrimination-loading">{error || 'Loading discrimination test…'}</div></main>;
  const { applicability, test } = data; const unit = test?.instrumentSnapshot?.unit || data.report?.instrument?.unit || 'g'; const stages = test?.stages || []; const activeIndex = stages.findIndex((stage: any) => stage.status !== 'COMPLETED'); const active = activeIndex >= 0 ? stages[activeIndex] : null;
  const supported = applicability?.executionSupported === true && ['A.4.8.1', 'A.4.8.2'].includes(applicability?.method);
  const analog = applicability?.method === 'A.4.8.1';
  return <main className="discrimination-page">
    <header className="discrimination-top"><Link to={`/tester/reports/${reportId}/testing`}><ArrowLeft size={16} /> Testing route</Link><div><strong>NAWI</strong><span>TEST &amp; REPORT SYSTEM</span></div><span>OIML R 76 A.4.8</span></header>
    <section className="discrimination-content">
      <header className="discrimination-heading"><div><span className="technical-label">TESTING · {applicability?.method || 'A.4.8'}</span><h1>Discrimination</h1><p>{analog ? 'At Min, ½ Max, and Max, apply the prescribed extra load at equilibrium and record the observed displacement.' : 'Verify unambiguous one-scale-interval transitions at three derived test loads.'}</p></div><span className={`discrimination-status ${String(test?.status || applicability?.status || '').toLowerCase()}`}>{test?.result && test.result !== 'NOT_DETERMINED' ? test.result : test?.status || applicability?.status}</span></header>
      {error && <div className="discrimination-error">{error}</div>}
      <section className="discrimination-context"><div><small>Class</small><strong>{data.report?.instrument?.accuracyClass || test?.instrumentSnapshot?.accuracyClass || '—'}</strong></div><div><small>Min</small><strong>{format(test?.instrumentSnapshot?.min ?? data.report?.instrument?.min, unit)}</strong></div><div><small>Max</small><strong>{format(test?.instrumentSnapshot?.max ?? data.report?.instrument?.max, unit)}</strong></div><div><small>e</small><strong>{format(test?.instrumentSnapshot?.e ?? data.report?.instrument?.e, unit)}</strong></div><div><small>d</small><strong>{format(test?.instrumentSnapshot?.d ?? data.report?.instrument?.d, unit)}</strong></div><div><small>Unit</small><strong>{unit}</strong></div></section>
      {!supported ? <section className="discrimination-panel"><span className="technical-label">EXECUTION UNAVAILABLE</span><h2>{applicability?.status === 'NOT_APPLICABLE' ? 'A.4.8 is not applicable' : 'Configuration required'}</h2><p>{applicability?.reason || 'Complete the instrument configuration before starting this procedure.'}</p><Link className="discrimination-secondary" to={`/tester/reports/${reportId}/testing`}>Back to Testing</Link></section> : !test ? <section className="discrimination-panel discrimination-start"><div><span className="technical-label">{analog ? 'ANALOG / NON-SELF-INDICATING' : 'DIGITAL INDICATION'}</span><h2>Three-load discrimination procedure</h2><p>{analog ? 'A.4.8.1 applies at Min, ½ Max, and Max. Required extra loads are derived from the configured class/MPE and the OIML minimum load; record the actual physical response.' : 'A.4.8.2 applies at Min, ½ Max, and Max. The targets and derived increments are read-only; enter only physical observations.'}</p></div><button className="discrimination-primary" disabled={busy} onClick={() => void start()}><Play size={16} /> Start Test</button></section> : <>
        <EvidencePanel context={{ reportId, testId: 'A.4.8', subtestId: applicability?.method, instrumentId: data.report?.instrumentId, category: 'TEST_SETUP', evidenceType: 'discrimination_setup', label: `${applicability?.method} · Discrimination · Test Setup`, title: `${applicability?.method} · Discrimination`, testName: `${applicability?.method} · Discrimination`, oimlReference: applicability?.method, addLabel: 'Add Photo', mobileLabel: 'Capture from Phone' }} />
        <section className="discrimination-progress" aria-label="Discrimination stages">{stages.map((stage: any, index: number) => <div className={stage.status === 'COMPLETED' ? 'complete' : index === activeIndex ? 'active' : 'locked'} key={stage.stageId}><span>{stage.status === 'COMPLETED' ? <Check size={15} /> : stage.status === 'LOCKED' ? <Lock size={14} /> : index + 1}</span><strong>{stage.label}</strong><small>{format(stage.targetLoad?.value, stage.targetLoad?.unit || unit)}</small></div>)}</section>
        {active ? analog ? <AnalogStageForm key={`${active.stageId}-${active.observation?.recordedAt || 'new'}`} stage={active} unit={unit} nonSelf={test?.instrumentSnapshot?.indicationType === 'Non-self-indicating'} busy={busy} onSubmit={async values => { setBusy(true); try { const response = await axios.patch(`/test-reports/${reportId}/discrimination/stages/${active.stageId}`, values); setData((current: any) => ({ ...current, test: response.data.test })); setError(''); } catch (e: any) { setError(e.response?.data?.message || 'Unable to save the discrimination observation.'); } finally { setBusy(false); } }} /> : <StageForm key={`${active.stageId}-${active.observation?.recordedAt || 'new'}`} stage={active} unit={unit} busy={busy} onSubmit={async values => { setBusy(true); try { const response = await axios.patch(`/test-reports/${reportId}/discrimination/stages/${active.stageId}`, values); setData((current: any) => ({ ...current, test: response.data.test })); setError(''); } catch (e: any) { setError(e.response?.data?.message || 'Unable to save the discrimination observation.'); } finally { setBusy(false); } }} /> : <section className="discrimination-panel discrimination-complete"><Check size={24} /><h2>A.4.8 Discrimination completed · {test.result}</h2><p>All three {analog ? 'analog/non-self-indicating' : 'digital-indication'} load stages were evaluated from the saved observations.</p><Link className="discrimination-secondary" to={`/tester/reports/${reportId}/testing`}>Return to Testing</Link></section>}
        <section className="discrimination-panel"><div className="discrimination-panel-title"><div><span className="technical-label">TRACEABILITY</span><h2>OIML procedure</h2></div><span>OIML R 76-1:2006 {analog ? '§3.8.1 / §3.8.2.1 · Annex A A.4.8.1' : 'Annex A A.4.8.2'}</span></div><p>{analog ? 'The extra load is derived from the configured MPE (0.4 × MPE for non-self-indicating, MPE for analog self-indicating), with the 1 mg minimum. Analog displacement is evaluated against 0.7 × extra load; non-self-indicating procedures record visible displacement.' : 'This digital-indication procedure is for type examination and instruments with d ≥ 5 mg. The application preserves the recommended increment quantity separately from actual observation values.'}</p></section>
        <TestProcedureInfo testId="A.4.8" configuration={{ ...(test?.instrumentSnapshot || data.report?.instrument || {}), method: applicability?.method }} />
      </>}
    </section>
  </main>;
}

function StageForm({ stage, unit, busy, onSubmit }: { stage: any; unit: string; busy: boolean; onSubmit: (values: any) => Promise<void> }) {
  const saved = stage.observation || {};
  const [values, setValues] = useState({
    baseLoad: String(stage.targetLoad?.value ?? ''),
    startingIndication: String(saved.inputStartingIndication ?? ''),
    removedAdditionalLoad: String(saved.inputRemovedAdditionalLoad ?? ''),
    lowerIndication: String(saved.inputLowerIndication ?? saved.lowerIndication ?? ''),
    upperIndication: String(saved.inputUpperIndication ?? ''),
    unit: saved.unit || unit,
    notes: saved.notes || '',
  });
  const set = (key: string, value: string) => setValues(current => ({ ...current, [key]: value }));
  const derived = useMemo(() => {
    const oneTenthD = Number(stage.oneTenthD?.value);
    const onePointFourD = Number(stage.onePointFourD?.value);
    const d = Number.isFinite(oneTenthD) ? oneTenthD * 10 : undefined;
    const starting = values.startingIndication.trim() === '' ? undefined : Number(values.startingIndication);
    const lower = values.lowerIndication.trim() === '' ? undefined : Number(values.lowerIndication);
    const final = values.upperIndication.trim() === '' ? undefined : Number(values.upperIndication);
    const expectedLower = Number.isFinite(starting) && Number.isFinite(d) ? starting! - d! : undefined;
    const observedLowerChange = Number.isFinite(starting) && Number.isFinite(lower) ? starting! - lower! : undefined;
    const observedChange = Number.isFinite(starting) && Number.isFinite(final) ? final! - starting! : undefined;
    const lowerPass = Number.isFinite(lower) && Number.isFinite(expectedLower) && Math.abs(lower! - expectedLower!) <= 1e-9;
    const upperPass = Number.isFinite(observedChange) && Number.isFinite(d) && Math.abs(observedChange! - d!) <= 1e-9;
    const complete = Number.isFinite(lower) && Number.isFinite(observedChange) && Number.isFinite(d);
    const result = complete ? lowerPass && upperPass ? 'PASS' : 'FAIL' : 'INCOMPLETE';
    return { d, oneTenthD, onePointFourD, expectedLower, observedLowerChange, observedChange, result };
  }, [stage.onePointFourD?.value, stage.oneTenthD?.value, values.startingIndication, values.lowerIndication, values.upperIndication]);
  const required = [values.startingIndication, values.removedAdditionalLoad, values.lowerIndication, values.upperIndication].every(value => value.trim() !== '' && Number.isFinite(Number(value)));
  const submit = (complete: boolean) => {
    if (!required || !Number.isFinite(derived.d) || !Number.isFinite(derived.oneTenthD) || !Number.isFinite(derived.onePointFourD)) return;
    void onSubmit({
      baseLoad: Number(values.baseLoad),
      startingIndication: Number(values.startingIndication),
      additionalIncrementCount: Number(stage.recommendedIncrementCount ?? 10),
      removedAdditionalLoad: Number(values.removedAdditionalLoad),
      lowerIndication: Number(values.lowerIndication),
      restoredIncrement: derived.oneTenthD,
      appliedAdditionalLoad: derived.onePointFourD,
      upperIndication: Number(values.upperIndication),
      unit: values.unit,
      notes: values.notes,
      complete,
    });
  };
  return <section className="discrimination-panel discrimination-stage">
    <div className="discrimination-panel-title"><div><span className="technical-label">A.4.8.2 · DISCRIMINATION</span><h2>Discrimination</h2><p>Record the actual indications for the {stage.label} load. The prescribed additions and the comparison are calculated from the configured scale interval.</p></div><strong>{stage.status.replace(/_/g, ' ')}</strong></div>
    <div className="discrimination-stage-meta"><span>Test load: <b>{format(stage.targetLoad?.value, stage.targetLoad?.unit || unit)}</b></span><label>Observation unit<select value={values.unit} onChange={event => set('unit', event.target.value)}>{units.map(option => <option key={option}>{option}</option>)}</select></label></div>
    <div className="discrimination-step-grid">
      <section className="discrimination-step"><span className="discrimination-step-number">1</span><div><span className="technical-label">INITIAL INDICATION</span><h3>Indication I1</h3><label className="discrimination-input-label"><span>Observed indication ({values.unit})</span><input aria-label={`Indication I1 (${values.unit})`} type="number" step="any" value={values.startingIndication} onChange={event => set('startingIndication', event.target.value)} /></label></div></section>
      <section className="discrimination-step"><span className="discrimination-step-number">2</span><div><span className="technical-label">REMOVE ADDITIONAL WEIGHTS</span><h3>Removed load ΔL</h3><label className="discrimination-input-label"><span>Actual removed load ({values.unit})</span><input aria-label={`Removed load ΔL (${values.unit})`} type="number" min="0" step="any" value={values.removedAdditionalLoad} onChange={event => set('removedAdditionalLoad', event.target.value)} /></label><label className="discrimination-input-label"><span>Observed indication after removal (I − d, {values.unit})</span><input aria-label={`Observed lower indication I minus d (${values.unit})`} type="number" step="any" value={values.lowerIndication} onChange={event => set('lowerIndication', event.target.value)} /></label><div className="discrimination-readonly"><small>Expected indication I1 − d</small><b>{format(derived.expectedLower, values.unit)}</b></div></div></section>
      <section className="discrimination-step discrimination-procedure-step"><span className="discrimination-step-number">3</span><div><span className="technical-label">PRESCRIBED ADDITIONAL WEIGHTS</span><h3>System-derived values</h3><div className="discrimination-procedure-values"><div><small>Restore one increment</small><b>1/10d = {format(derived.oneTenthD, values.unit)}</b></div><div><small>Then add</small><b>1.4d = {format(derived.onePointFourD, values.unit)}</b></div></div><p className="discrimination-note">Suggested starting additions: {stage.recommendedIncrementCount ?? 10} × 1/10d = {format(derived.oneTenthD !== undefined && stage.recommendedIncrementCount !== undefined ? derived.oneTenthD * stage.recommendedIncrementCount : undefined, values.unit)}</p></div></section>
      <section className="discrimination-step"><span className="discrimination-step-number">4</span><div><span className="technical-label">FINAL INDICATION</span><h3>Indication I2</h3><label className="discrimination-input-label"><span>Observed indication ({values.unit})</span><input aria-label={`Indication I2 (${values.unit})`} type="number" step="any" value={values.upperIndication} onChange={event => set('upperIndication', event.target.value)} /></label></div></section>
    </div>
    <section className="discrimination-check" aria-live="polite"><div><small>Observed lower change I1 − Ilower</small><b>{format(derived.observedLowerChange, values.unit)}</b></div><div><small>Observed upper change I2 − I1</small><b>{format(derived.observedChange, values.unit)}</b></div><div><small>Required change</small><b>d = {format(derived.d, values.unit)}</b></div><div className={`discrimination-check-result ${derived.result.toLowerCase()}`}><small>Both transitions</small><b>{derived.result}</b></div></section>
    <div className="discrimination-fields discrimination-fields-secondary"><label className="discrimination-notes">Operator notes<textarea value={values.notes} onChange={event => set('notes', event.target.value)} /></label></div>
    <div className="discrimination-actions"><button className="discrimination-secondary" disabled={busy || !required} onClick={() => submit(false)}><Save size={15} /> Save observation</button><button className="discrimination-primary" disabled={busy || !required} onClick={() => submit(true)}><Check size={16} /> Complete stage</button></div>
    {!required && <p className="discrimination-validation-note">Enter I1, the removed load ΔL, the observed lower indication, and I2 to record this observation.</p>}
  </section>;
}

function AnalogStageForm({ stage, unit, nonSelf, busy, onSubmit }: { stage: any; unit: string; nonSelf: boolean; busy: boolean; onSubmit: (values: any) => Promise<void> }) {
  const saved = stage.observation || {};
  const [displacement, setDisplacement] = useState(String(saved.inputDisplacement ?? saved.permanentDisplacement ?? ''));
  const [visible, setVisible] = useState<boolean | undefined>(typeof saved.visibleDisplacement === 'boolean' ? saved.visibleDisplacement : undefined);
  const [notes, setNotes] = useState(saved.notes || '');
  const requiredExtraLoad = Number(stage.requiredExtraLoad?.value);
  const threshold = Number(saved.displacementThreshold ?? (nonSelf ? NaN : requiredExtraLoad * 0.7));
  const ready = nonSelf ? typeof visible === 'boolean' : displacement.trim() !== '' && Number.isFinite(Number(displacement)) && Number(displacement) >= 0;
  return <section className="discrimination-panel discrimination-stage">
    <div className="discrimination-panel-title"><div><span className="technical-label">A.4.8.1 · {nonSelf ? 'NON-SELF-INDICATING' : 'ANALOG INDICATION'}</span><h2>{stage.label} discrimination observation</h2><p>Apply/remove the prescribed extra load gently while the instrument is at equilibrium. Record only the observed response.</p></div><strong>{String(stage.status).replace(/_/g, ' ')}</strong></div>
    <div className="discrimination-derived"><div><small>Derived test load</small><b>{format(stage.targetLoad?.value, stage.targetLoad?.unit || unit)}</b></div><div><small>Prescribed extra load</small><b>{format(requiredExtraLoad, unit)}</b></div>{!nonSelf && <div><small>Minimum displacement</small><b>{format(threshold, unit)}</b></div>}<div><small>Basis</small><b>{nonSelf ? '0.4 × MPE, ≥ 1 mg' : 'MPE, ≥ 1 mg'}</b></div></div>
    {nonSelf ? <label className="discrimination-analog-check"><input type="checkbox" checked={visible === true} onChange={event => setVisible(event.target.checked)} /><span><b>Visible indicating-element displacement observed</b><small>Check only after observing a visible change when the prescribed extra load is gently placed or withdrawn at equilibrium.</small></span></label> : <label className="discrimination-input-label"><span>Observed permanent displacement ({unit}, mass-equivalent)</span><input aria-label={`Permanent displacement (${unit})`} type="number" min="0" step="any" value={displacement} onChange={event => setDisplacement(event.target.value)} /><small>Must be at least 0.7 × the prescribed extra load for analog self-indicating instruments.</small></label>}
    <label className="discrimination-input-label discrimination-notes"><span>Tester notes</span><textarea value={notes} onChange={event => setNotes(event.target.value)} /></label>
    <div className="discrimination-check"><div><small>Required extra load</small><b>{format(requiredExtraLoad, unit)}</b></div>{!nonSelf && <div><small>Observed displacement</small><b>{format(displacement.trim() ? Number(displacement) : undefined, unit)}</b></div>}<div className={`discrimination-check-result ${ready ? 'pass' : 'incomplete'}`}><small>Observation</small><b>{ready ? 'RECORDED' : 'REQUIRED'}</b></div></div>
    <div className="discrimination-actions"><button className="discrimination-primary" disabled={busy || !ready || !Number.isFinite(requiredExtraLoad)} onClick={() => void onSubmit({ baseLoad: Number(stage.targetLoad?.value), unit: stage.targetLoad?.unit || unit, ...(nonSelf ? { visibleDisplacement: visible } : { displacement: Number(displacement) }), notes, complete: true })}><Check size={16} /> Save &amp; Complete Stage</button></div>
  </section>;
}
