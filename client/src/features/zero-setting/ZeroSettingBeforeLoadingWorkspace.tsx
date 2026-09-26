import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Check, Lock, Play, Save } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import './zero-setting.css';
import TestProcedureInfo from '../guidance/TestProcedureInfo';
import EvidencePanel from '../evidence/EvidencePanel';

export default function ZeroSettingBeforeLoadingWorkspace() {
  const { reportId = '' } = useParams();
  const nav = useNavigate();
  const [state, setState] = useState<any>();
  const [modeConfirmations, setModeConfirmations] = useState({ physical: false, syntheticSimulation: false });
  const [executionMode, setExecutionMode] = useState<'PHYSICAL' | 'SYNTHETIC_SIMULATION'>('PHYSICAL');
  const [notes, setNotes] = useState('');
  const [procedureObservations, setProcedureObservations] = useState({ halfIntervalWeightApplied: false, indicationAlternatedAtZero: false, halfIntervalWeightRemoved: false, centreOfZeroReferenceReached: false });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [draftSaving, setDraftSaving] = useState(false);
  const draftQueue = useRef<Promise<unknown>>(Promise.resolve());

  const saveDraft = (draft: { executionMode: 'PHYSICAL' | 'SYNTHETIC_SIMULATION'; modeConfirmations: { physical: boolean; syntheticSimulation: boolean }; operatorNotes: string; procedureObservations: typeof procedureObservations }) => {
    setDraftSaving(true);
    setError('');
    const request = draftQueue.current.catch(() => undefined).then(() => axios.post(`/test-reports/${reportId}/zero-setting-before-loading/draft`, draft));
    draftQueue.current = request;
    void request.then(() => setError(''), (e: any) => setError(e.response?.data?.message || 'Unable to save A.4.3 progress.')).finally(() => setDraftSaving(false));
  };

  const load = async () => {
    try { const response = await axios.get(`/test-reports/${reportId}/zero-setting-before-loading`); setState(response.data); const loadedMode = response.data.test?.executionMode || 'PHYSICAL'; setExecutionMode(loadedMode); setModeConfirmations(response.data.test?.modeConfirmations || { physical: loadedMode === 'PHYSICAL' && response.data.test?.zeroReferenceEstablished === true, syntheticSimulation: loadedMode === 'SYNTHETIC_SIMULATION' && response.data.test?.zeroReferenceEstablished === true }); setNotes(response.data.test?.operatorNotes || ''); setProcedureObservations({ halfIntervalWeightApplied: false, indicationAlternatedAtZero: false, halfIntervalWeightRemoved: false, centreOfZeroReferenceReached: false, ...(response.data.test?.procedureObservations || {}) }); setError(''); }
    catch (e: any) { setError(e.response?.data?.message || 'Unable to load Setting to Zero Before Loading.'); }
  };
  useEffect(() => { void load(); }, [reportId]);

  const begin = async () => {
    setBusy(true);
    try { const response = await axios.post(`/test-reports/${reportId}/zero-setting-before-loading/start`); setState((current: any) => ({ ...current, ...response.data, source: response.data.source, stale: false })); setError(''); }
    catch (e: any) { setError(e.response?.data?.message || 'Unable to start A.4.3.'); }
    finally { setBusy(false); }
  };
  const complete = async () => {
    setBusy(true);
    try { await draftQueue.current.catch(() => undefined); const response = await axios.post(`/test-reports/${reportId}/zero-setting-before-loading/complete`, { executionMode, modeConfirmations, operatorNotes: notes, ...(applicability?.method === 'A.4.3(a)' && executionMode === 'PHYSICAL' ? { procedureObservations } : {}) }); setState((current: any) => ({ ...current, ...response.data })); setModeConfirmations(current => ({ ...current, [executionMode === 'PHYSICAL' ? 'physical' : 'syntheticSimulation']: true })); setError(''); }
    catch (e: any) { setError(e.response?.data?.message || 'Unable to complete A.4.3.'); }
    finally { setBusy(false); }
  };

  if (!state) return <main className="zero-setting-page"><div className="zero-setting-loading">{error || 'Loading Setting to Zero Before Loading…'}</div></main>;
  const applicability = state.applicability;
  const test = state.test;
  const completed = test?.status === 'COMPLETED' && !state.stale;
  const source = state.source;
  const supported = applicability?.status === 'APPLICABLE' && applicability?.executionSupported === true && ['A.4.3(a)', 'A.4.3(b)'].includes(applicability?.method);
  const nonAutomatic = applicability?.method === 'A.4.3(a)';
  const procedureReady = Object.values(procedureObservations).every(Boolean);
  const selectedModeConfirmed = executionMode === 'PHYSICAL' ? modeConfirmations.physical : modeConfirmations.syntheticSimulation;
  const syntheticNoteReady = /synthetic|simulation|regression/i.test(notes);
  const draft = (overrides: Partial<{ executionMode: 'PHYSICAL' | 'SYNTHETIC_SIMULATION'; modeConfirmations: typeof modeConfirmations; operatorNotes: string; procedureObservations: typeof procedureObservations }> = {}) => ({ executionMode, modeConfirmations, operatorNotes: notes, procedureObservations, ...overrides });
  const canStart = !test || state.stale || test.status === 'REVALIDATION_REQUIRED';
  return <main className="zero-setting-page">
    <Header reportId={reportId} />
    <section className="zero-setting-content">
      <div className="zero-setting-heading"><div><span className="technical-label">A.4.3 · OIML R 76-1:2006 ANNEX A</span><h1>Setting to Zero Before Loading</h1><p>{state.report.testReportId} · Establish the zero reference before subsequent weighing.</p></div><span className={`zero-setting-status ${completed ? 'complete' : ''}`}>{completed ? `COMPLETED · ${test.result}` : test?.status === 'REVALIDATION_REQUIRED' || state.stale ? 'REVALIDATION REQUIRED' : test ? 'IN PROGRESS' : 'AVAILABLE'}</span></div>
      {applicability?.status !== 'APPLICABLE' && <section className="zero-setting-panel zero-setting-error"><h2>A.4.3 unavailable</h2><p>{applicability?.reason || 'Instrument configuration is required before this procedure can start.'}</p><Link className="zero-setting-secondary" to={`/tester/reports/${reportId}/testing`}>Back to Testing</Link></section>}
      {applicability?.status === 'APPLICABLE' && <>
        <section className="zero-setting-panel zero-setting-method"><div><span className="technical-label">APPLICABLE METHOD</span><h2>{applicability.methodLabel || applicability.method}</h2><p>{nonAutomatic ? 'Record the half-scale-interval placement, alternating indication, removal and centre-of-zero reference steps.' : 'Regulatory procedure: deviation from zero is determined according to A.4.2.3.'}</p>{!nonAutomatic && <p className="zero-setting-source">Dependency · A.4.2.3 Accuracy of Zero-setting</p>}</div>{supported && !test ? <button className="zero-setting-primary" onClick={begin} disabled={busy || !canStart}><Play size={16} /> Begin A.4.3</button> : supported && (test?.status === 'REVALIDATION_REQUIRED' || state.stale) ? <button className="zero-setting-primary" onClick={begin} disabled={busy || !canStart}><Play size={16} /> Start Revalidation</button> : null}</section>
        {supported && !nonAutomatic && !source && <section className="zero-setting-panel zero-setting-dependency"><h2>Complete A.4.2.3 first</h2><p>A.4.3(b) references the authoritative A.4.2.3 zero-setting accuracy result. No observations are entered again here.</p><Link className="zero-setting-secondary" to={`/tester/reports/${reportId}/testing/a4-2`}>Open A.4.2 Checking of Zero</Link></section>}
        {supported && !nonAutomatic && source && <SourceEvidence source={source} />}
        {supported && test && !completed && <section className="zero-setting-panel zero-setting-confirm"><div><span className="technical-label">{nonAutomatic ? 'PROCEDURAL OBSERVATIONS' : 'CONFIRMATION'}</span><h2>{nonAutomatic ? 'Half-scale-interval zero-setting procedure' : 'Zero reference established before loading'}</h2><p>{nonAutomatic ? 'Following OIML R 76-1:2006 Annex A A.4.3(a), record each observed step. A synthetic prototype simulation does not claim a physical procedure was performed.' : 'The read-only A.4.2.3 result above is the zero deviation carried into subsequent weighing. Select the mode actually used. A synthetic simulation is recorded separately and must not be read as a physical procedure.'}</p></div>{nonAutomatic && executionMode === 'PHYSICAL' && <fieldset className="zero-setting-mode zero-setting-procedure-checks"><legend>Observed procedure steps</legend>{([['halfIntervalWeightApplied', 'Weights equivalent to half a scale interval placed on the load receptor'], ['indicationAlternatedAtZero', 'Indication adjusted until alternating between zero and one scale interval'], ['halfIntervalWeightRemoved', 'Half-scale-interval weights removed'], ['centreOfZeroReferenceReached', 'Centre-of-zero reference position attained']] as const).map(([key, label]) => <label key={key}><input type="checkbox" checked={procedureObservations[key]} onChange={event => { const next = { ...procedureObservations, [key]: event.target.checked }; setProcedureObservations(next); saveDraft(draft({ procedureObservations: next })); }} /> {label}</label>)}</fieldset>}<fieldset className="zero-setting-mode"><legend>Execution mode</legend><label><input type="radio" name="executionMode" checked={executionMode === 'PHYSICAL'} onChange={() => { setExecutionMode('PHYSICAL'); saveDraft(draft({ executionMode: 'PHYSICAL' })); }} /> Physical procedure</label><label><input type="radio" name="executionMode" checked={executionMode === 'SYNTHETIC_SIMULATION'} onChange={() => { setExecutionMode('SYNTHETIC_SIMULATION'); saveDraft(draft({ executionMode: 'SYNTHETIC_SIMULATION' })); }} /> Synthetic prototype simulation</label></fieldset><label className="zero-setting-check"><input type="checkbox" checked={executionMode === 'PHYSICAL' ? modeConfirmations.physical : modeConfirmations.syntheticSimulation} onChange={event => { const key = executionMode === 'PHYSICAL' ? 'physical' : 'syntheticSimulation'; const next = { ...modeConfirmations, [key]: event.target.checked }; setModeConfirmations(next); saveDraft(draft({ modeConfirmations: next })); }} /> {executionMode === 'PHYSICAL' ? 'Confirm the physical zero reference procedure was performed' : 'Confirm the synthetic A.4.3 workflow simulation was performed'}</label><label className="zero-setting-notes"><span>Operator notes {executionMode === 'SYNTHETIC_SIMULATION' ? '(required; identify synthetic simulation)' : '(optional)'}</span><textarea value={notes} onChange={event => setNotes(event.target.value)} onBlur={() => saveDraft(draft())} placeholder={executionMode === 'SYNTHETIC_SIMULATION' ? 'Synthetic prototype simulation; no physical instrument procedure performed.' : 'Record relevant procedural notes.'} /></label><div className="zero-setting-completion-action">{draftSaving && <span role="status">Saving progress…</span>}<button className="zero-setting-primary" onClick={complete} disabled={!selectedModeConfirmed || busy || draftSaving || (executionMode === 'SYNTHETIC_SIMULATION' && !syntheticNoteReady) || (executionMode === 'PHYSICAL' && nonAutomatic && !procedureReady)}><Save size={16} /> Complete A.4.3</button></div></section>}
      {completed && <section className="zero-setting-panel zero-setting-complete"><Check size={25} /><div><h2>A.4.3 completed · {test.result}</h2><p>{nonAutomatic ? test.executionMode === 'SYNTHETIC_SIMULATION' ? 'Synthetic simulation workflow completed. PASS identifies the completed simulation flow; it does not claim physical procedure observations.' : 'The recorded result is based on the saved A.4.3(a) physical procedural observations.' : `The A.4.2.3 zero deviation was carried forward as ${test.result}; no second measurement or compliance calculation was created.`} Execution mode: {test.executionMode === 'SYNTHETIC_SIMULATION' ? 'Synthetic prototype simulation' : 'Physical procedure'}.</p>{test.operatorNotes && <p className="zero-setting-source">Tester note · {test.operatorNotes}</p>}<Link className="zero-setting-primary" to={`/tester/reports/${reportId}/testing`}>Return to Test Route</Link></div></section>}
      </>}
      {error && <div className="zero-setting-error-message">{error}</div>}
      <section className="zero-setting-panel zero-setting-trace"><span className="technical-label">TRACEABILITY</span><p>{nonAutomatic ? test?.executionMode === 'SYNTHETIC_SIMULATION' ? 'OIML R 76-1:2006 Annex A A.4.3(a) is represented here by a synthetic workflow simulation; no physical procedure observations or metrological result are asserted.' : test?.status === 'COMPLETED' ? 'OIML R 76-1:2006 Annex A A.4.3(a): the completed physical record is evaluated from its four persisted procedural observations.' : 'OIML R 76-1:2006 Annex A A.4.3(a): physical mode requires all four observed procedural steps before completion.' : 'OIML R 76-1:2006 Annex A A.4.3(b), using the completed A.4.2.3 result and its existing A.4.4.3 changeover/MPE calculation evidence.'}</p></section>
      {applicability?.status !== 'NOT_APPLICABLE' && <EvidencePanel context={{ reportId, testId: 'A.4.3', instrumentId: state.report?.instrumentId, category: 'TEST_SETUP', evidenceType: 'zero_setting_before_loading_setup', label: 'A.4.3 · Setting to Zero Before Loading · Test Setup', title: 'A.4.3 · Setting to Zero Before Loading', testName: 'Setting to Zero Before Loading', oimlReference: 'A.4.3', addLabel: 'Add Evidence', desktopLabel: 'Upload from PC', mobileLabel: 'Capture from Phone' }} />}
      {applicability?.status !== 'NOT_APPLICABLE' && <TestProcedureInfo testId="A.4.3" configuration={{ ...(state.test?.instrumentSnapshot || state.report?.instrument || {}), method: applicability?.method, applicabilityStatus: applicability?.status }} />}
    </section>
  </main>;
}

function Header({ reportId }: { reportId: string }) { return <header className="zero-setting-top"><Link to={`/tester/reports/${reportId}/testing`}><ArrowLeft size={16} /> Testing route</Link><div className="zero-setting-brand"><strong>NAWI</strong><span>TEST &amp; REPORT SYSTEM</span></div><Link to="/tester/reports">All Test Reports</Link></header>; }

function SourceEvidence({ source }: { source: any }) {
  const observations = source.observations || {};
  const calculations = source.calculations || {};
  const input = (key: string, fallback: unknown) => observations[`input${key}`] ?? fallback;
  const observationUnit = observations.unit || calculations.mpeUnit || 'g';
  const calculationUnit = calculations.mpeUnit || observationUnit;
  const value = (item: unknown) => Number.isFinite(Number(item)) ? Number(item).toFixed(4) : '—';
  const rows = [
    ['Zero indication I₀', input('ZeroIndicationI0', observations.zeroIndicationI0), observationUnit],
    ['Additional load ΔL₀', input('DeltaL0', observations.deltaL0), observationUnit],
    ['Test load L', input('LoadL', observations.loadL), observationUnit],
    ['Indication I', input('IndicationI', observations.indicationI), observationUnit],
    ['Additional load ΔL', input('DeltaL', observations.deltaL), observationUnit],
    ['P', calculations.trueIndicationP, calculationUnit],
    ['E', calculations.rawErrorE, calculationUnit],
    ['E₀', calculations.calculatedE0, calculationUnit],
    ['E_c', calculations.correctedErrorEc, calculationUnit],
    ['MPE', calculations.mpeValue === undefined ? undefined : `±${value(calculations.mpeValue)}`, calculationUnit],
  ];
  return <section className="zero-setting-panel zero-setting-evidence"><div className="zero-setting-section-heading"><div><span className="technical-label">SOURCE EVIDENCE · A.4.2.3</span><h2>Read-only zero-setting accuracy result</h2></div><strong className={String(source.result || calculations.result).toLowerCase()}>{source.result || calculations.result}</strong></div><p className="zero-setting-evidence-copy">These are the persisted observations and calculations from A.4.2.3. A.4.3 does not duplicate or recalculate them.</p><div className="zero-setting-values">{rows.map(([label, item, unit]) => <div key={String(label)}><span>{displayMathLabel(String(label))}</span><strong>{typeof item === 'string' && item.startsWith('±') ? item : value(item)} {unit}</strong></div>)}<div><span>A.4.2.3 result</span><strong className={String(source.result || calculations.result).toLowerCase()}>{source.result || calculations.result}</strong></div></div><small>{calculations.ruleReference || 'OIML R 76-1:2006 §3.5.1 Table 6'} · zero deviation carried forward: {value(calculations.calculatedE0)} {calculationUnit}</small></section>;
}

function displayMathLabel(label: string) {
  if (label === 'I₀') return <span className="math-variable" aria-label="I sub zero">I<sub>0</sub></span>;
  if (label === 'ΔL₀') return <span className="math-variable" aria-label="delta L sub zero">ΔL<sub>0</sub></span>;
  if (label === 'E₀') return <span className="math-variable" aria-label="E sub zero">E<sub>0</sub></span>;
  if (label === 'E_c') return <span className="math-variable" aria-label="E sub c">E<sub>c</sub></span>;
  return label;
}
