import { useEffect, useState } from 'react';
import { ArrowLeft, Check, Lock, Play, Save } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import './zero-setting.css';
import TestProcedureInfo from '../guidance/TestProcedureInfo';

export default function ZeroSettingBeforeLoadingWorkspace() {
  const { reportId = '' } = useParams();
  const nav = useNavigate();
  const [state, setState] = useState<any>();
  const [confirmed, setConfirmed] = useState(false);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try { const response = await axios.get(`/test-reports/${reportId}/zero-setting-before-loading`); setState(response.data); setConfirmed(response.data.test?.zeroReferenceEstablished === true); setNotes(response.data.test?.operatorNotes || ''); setError(''); }
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
    try { const response = await axios.post(`/test-reports/${reportId}/zero-setting-before-loading/complete`, { zeroReferenceEstablished: true, operatorNotes: notes }); setState((current: any) => ({ ...current, ...response.data })); setConfirmed(true); setError(''); }
    catch (e: any) { setError(e.response?.data?.message || 'Unable to complete A.4.3.'); }
    finally { setBusy(false); }
  };

  if (!state) return <main className="zero-setting-page"><div className="zero-setting-loading">{error || 'Loading Setting to Zero Before Loading…'}</div></main>;
  const applicability = state.applicability;
  const test = state.test;
  const completed = test?.status === 'COMPLETED' && !state.stale;
  const source = state.source;
  const supported = applicability?.status === 'APPLICABLE' && applicability?.executionSupported !== false && applicability?.method === 'A.4.3(b)';
  const canStart = !test || state.stale || test.status === 'REVALIDATION_REQUIRED';
  return <main className="zero-setting-page">
    <Header reportId={reportId} />
    <section className="zero-setting-content">
      <div className="zero-setting-heading"><div><span className="technical-label">A.4.3 · OIML R 76-1:2006 ANNEX A</span><h1>Setting to Zero Before Loading</h1><p>{state.report.testReportId} · Establish the zero reference before subsequent weighing.</p></div><span className={`zero-setting-status ${completed ? 'complete' : ''}`}>{completed ? `COMPLETED · ${test.result}` : test?.status === 'REVALIDATION_REQUIRED' || state.stale ? 'REVALIDATION REQUIRED' : test ? 'IN PROGRESS' : 'AVAILABLE'}</span></div>
      {applicability?.status !== 'APPLICABLE' && <section className="zero-setting-panel zero-setting-error"><h2>A.4.3 unavailable</h2><p>{applicability?.reason || 'Instrument configuration is required before this procedure can start.'}</p><Link className="zero-setting-secondary" to={`/tester/reports/${reportId}/testing`}>Back to Testing</Link></section>}
      {applicability?.status === 'APPLICABLE' && <>
        <section className="zero-setting-panel zero-setting-method"><div><span className="technical-label">APPLICABLE METHOD</span><h2>{applicability.methodLabel || applicability.method}</h2><p>Regulatory procedure: deviation from zero is determined according to A.4.2.3.</p><p className="zero-setting-source">Dependency · A.4.2.3 Accuracy of Zero-setting</p></div>{supported ? <button className="zero-setting-primary" onClick={begin} disabled={busy || !canStart}><Play size={16} /> {test?.status === 'REVALIDATION_REQUIRED' || state.stale ? 'Start Revalidation' : 'Begin A.4.3'}</button> : <span className="zero-setting-procedural"><Lock size={15} /> Procedural module required</span>}</section>
        {applicability.executionSupported === false && <section className="zero-setting-panel zero-setting-notice"><h2>Procedural observation required</h2><p>This A.4.3(a) path is included by the instrument configuration, but this implementation does not provide an automated completion or invented compliance result for it.</p></section>}
        {supported && !source && <section className="zero-setting-panel zero-setting-dependency"><h2>Complete A.4.2.3 first</h2><p>A.4.3 references the authoritative A.4.2.3 zero-setting accuracy result. No observations are entered again here.</p><Link className="zero-setting-secondary" to={`/tester/reports/${reportId}/testing/a4-2`}>Open A.4.2 Checking of Zero</Link></section>}
        {supported && source && <SourceEvidence source={source} />}
        {supported && test && !completed && <section className="zero-setting-panel zero-setting-confirm"><div><span className="technical-label">CONFIRMATION</span><h2>Zero reference established before loading</h2><p>The read-only A.4.2.3 result above is the zero deviation carried into subsequent weighing. Confirm only after the physical procedure has been completed.</p></div><label className="zero-setting-check"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} /> Confirm zero reference established before loading</label><label className="zero-setting-notes"><span>Operator notes (optional)</span><textarea value={notes} onChange={event => setNotes(event.target.value)} /></label><button className="zero-setting-primary" onClick={complete} disabled={!confirmed || busy}><Save size={16} /> Confirm zero reference established before loading</button></section>}
        {completed && <section className="zero-setting-panel zero-setting-complete"><Check size={25} /><div><h2>A.4.3 completed · {test.result}</h2><p>The A.4.2.3 zero deviation was confirmed as the zero reference before loading. The A.4.2.3 result was carried forward as {test.result}; no second measurement or compliance calculation was created.</p><Link className="zero-setting-primary" to={`/tester/reports/${reportId}/testing`}>Return to Test Route</Link></div></section>}
      </>}
      {error && <div className="zero-setting-error-message">{error}</div>}
      <section className="zero-setting-panel zero-setting-trace"><span className="technical-label">TRACEABILITY</span><p>OIML R 76-1:2006 Annex A A.4.3(b), using the completed A.4.2.3 result and its existing A.4.4.3 changeover/MPE calculation evidence.</p></section>
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
