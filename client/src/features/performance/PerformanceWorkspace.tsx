import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, Play, Save } from 'lucide-react';
import { Link, useLocation, useParams } from 'react-router-dom';
import axios from 'axios';
import './performance.css';
import './performance-overrides.css';

const instructions = [
  'Prepare the instrument for the weighing test.',
  'Establish the zero reference.',
  'Apply the displayed/recommended test load.',
  'Record the indicated value.',
  'Perform the changeover procedure.',
  'Record the additional load ΔL when the indication changes by one scale interval.',
  'The system calculates the error and compliance result.',
];

const massUnits = ['mg', 'g', 'kg', 't'];

export default function PerformanceWorkspace() {
  const { reportId: routeReportId = '' } = useParams();
  const location = useLocation();
  const reportId = routeReportId || location.pathname.match(/^\/tester\/reports\/([^/]+)\/testing$/)?.[1] || '';
  const [report, setReport] = useState<any>();
  const [test, setTest] = useState<any>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [zero, setZero] = useState({ zeroIndication: '', deltaL0: '', unit: 'g' });
  const [extra, setExtra] = useState<any[]>([]);

  useEffect(() => {
    void axios.get(`/test-reports/${reportId}/performance`).then(response => {
      setReport(response.data.report);
      setTest(response.data.performance);
      const saved = response.data.performance?.zeroReference;
      const instrumentUnit = response.data.performance?.instrumentSnapshot?.unit || response.data.report?.instrument?.unit || 'g';
      if (saved) {
        setZero({ zeroIndication: String(saved.inputZeroIndication ?? saved.zeroIndication), deltaL0: String(saved.inputDeltaL0 ?? saved.deltaL0), unit: saved.unit || instrumentUnit });
      } else {
        setZero(current => ({ ...current, unit: instrumentUnit }));
      }
    }).catch(e => setError(e.response?.data?.message || 'Unable to load this performance test.'));
  }, [reportId]);

  const instrumentUnit = test?.instrumentSnapshot?.unit || report?.instrument?.unit || 'g';
  const start = async () => { setBusy(true); try { const response = await axios.post(`/test-reports/${reportId}/performance/start`); setTest(response.data.performance); setReport(response.data.report); setZero(current => ({ ...current, unit: response.data.performance?.instrumentSnapshot?.unit || response.data.report?.instrument?.unit || 'g' })); setError(''); } catch (e: any) { setError(e.response?.data?.message || 'Unable to start testing.'); } finally { setBusy(false); } };
  const saveZero = async () => { setBusy(true); try { const response = await axios.patch(`/test-reports/${reportId}/performance/zero`, { unit: zero.unit || instrumentUnit, zeroIndication: Number(zero.zeroIndication), deltaL0: Number(zero.deltaL0) }); setTest(response.data.performance); setError(''); } catch (e: any) { setError(e.response?.data?.message || 'Unable to save zero reference.'); } finally { setBusy(false); } };
  const savePoint = async (sequence: number, values: any, isExtra = false) => { setBusy(true); try { const response = await axios[isExtra ? 'post' : 'patch'](`/test-reports/${reportId}/performance/load-points${isExtra ? '' : `/${sequence}`}`, { ...values, unit: values.unit || instrumentUnit }); setTest(response.data.performance); if (isExtra) setExtra(rows => rows.map(row => row.sequence === sequence ? { ...row, sequence: response.data.point.sequence, saved: true } : row)); setError(''); } catch (e: any) { setError(e.response?.data?.message || 'Unable to save load point.'); } finally { setBusy(false); } };
  const complete = async () => { setBusy(true); try { const response = await axios.post(`/test-reports/${reportId}/performance/complete`); setTest(response.data.performance); setReport(response.data.report); setError(''); } catch (e: any) { setError(e.response?.data?.message || 'Complete all required load points first.'); } finally { setBusy(false); } };

  const rows = useMemo(() => [...(test?.loadPlan || []), ...extra], [test?.loadPlan, extra]);
  const points = test?.loadPoints || [];
  const distinctLoadCount = new Set(points.filter((point: any) => Number.isFinite(Number(point.loadL))).map((point: any) => Number(point.loadL))).size;
  const completed = test?.status === 'COMPLETED';
  const supported = test?.supported !== false;
  const pass = points.filter((point: any) => (point.complianceResult || point.result) === 'PASS').length;
  const canComplete = supported && Boolean(test?.zeroReference && test.zeroReference.calculatedE0 !== undefined && test.zeroReference.calculatedE0 !== null) && distinctLoadCount >= 10 && points.length >= 10 && points.every((point: any) => point.result && point.result !== 'NOT_CALCULATED');

  if (!report) return <main className="performance-page"><div className="performance-loading">{error || 'Loading testing workspace…'}</div></main>;
  const unit = instrumentUnit;
  return <main className="performance-page">
    <header className="performance-top"><Link to={`/tester/reports/${reportId}/testing`}><ArrowLeft size={16} /> Testing route</Link><span>TESTING</span><div className="performance-top-actions">{completed ? <Link className="performance-review-top" to={`/tester/reports/${reportId}/test-conditions`}>Complete Test Conditions</Link> : <span className="performance-review-top">Testing in progress</span>}<Link to="/tester/reports">All Test Reports</Link></div></header>
    <section className="performance-content">
      <div className="performance-heading"><div><span className="technical-label">A.4.4 · WEIGHING PERFORMANCE</span><h1>Testing</h1><p>Guided manual weighing observations for {report.instrument?.typeDesignation || 'this instrument'}.</p></div><strong className={completed ? 'performance-complete' : ''}>{completed ? `Completed · ${test.result}` : test ? 'In Progress' : 'Not Started'}</strong></div>
      <div className="performance-meta"><div><small>Manufacturer</small><b>{report.manufacturer?.name || report.applicant?.name}</b></div><div><small>Instrument</small><b>{report.instrument?.typeDesignation}</b></div><div><small>Assigned Tester</small><b>{test?.testerNameSnapshot || report.testerNameSnapshot || 'Assigned tester'}</b></div><div><small>Accuracy Class</small><b>{report.instrument?.accuracyClass || 'Not configured'}</b></div><div><small>Indication Type</small><b>{report.instrument?.indicationType || 'Not configured'}</b></div><div><small>Max / Min</small><b>{formatMass(report.instrument?.max, unit)} / {formatMass(report.instrument?.min, unit)}</b></div><div><small>e / d / n</small><b>{formatMass(report.instrument?.e, unit)} / {formatMass(report.instrument?.d, unit)} / {formatNumber(report.instrument?.n)}</b></div></div>
      {!test ? <section className="performance-start"><Play size={24} /><div><h2>A.4.4 Weighing Performance</h2><p>The software guides the tester; the physical weighing procedure is performed by the tester.</p></div><button className="performance-primary" onClick={start} disabled={busy}><Play size={16} /> Begin Test</button></section> : <>
        {!supported && <div className="performance-warning"><strong>Configuration required</strong><br />Instrument configuration is incomplete. Complete the required metrological characteristics before recording observations.<br /><Link to={`/tester/reports/${reportId}`}>Return to the report</Link></div>}
        <section className="performance-panel instructions"><h2>Guided instructions</h2><ol>{instructions.map((item, index) => <li key={item}><span>{index + 1}</span>{item}</li>)}</ol></section>
        <section className="performance-panel"><div className="panel-title"><div><span className="technical-label">ZERO REFERENCE</span><h2>Establish E0</h2><p>Use the applicable changeover method, then record the observed zero indication and additional load ΔL0.</p></div><strong>{test.zeroReference?.calculatedE0 === undefined || test.zeroReference?.calculatedE0 === null ? 'Not recorded' : `E0 ${format(test.zeroReference.calculatedE0)} ${unit}`}</strong></div><div className="zero-load">Zero load: <b>0 {unit}</b></div><div className="compact-fields"><label>Zero indication I0 ({zero.unit || unit})<input type="number" step="any" value={zero.zeroIndication} disabled={completed || !supported} onChange={e => setZero({ ...zero, zeroIndication: e.target.value })} /></label><label>Additional load ΔL0 ({zero.unit || unit})<input type="number" min="0" step="any" value={zero.deltaL0} disabled={completed || !supported} onChange={e => setZero({ ...zero, deltaL0: e.target.value })} /></label><label>Observation unit<select aria-label="Zero reference observation unit" value={zero.unit} disabled={completed || !supported} onChange={e => setZero({ ...zero, unit: e.target.value })}>{massUnits.map(option => <option key={option} value={option}>{option}</option>)}</select></label><button className="performance-secondary" onClick={saveZero} disabled={completed || !supported || busy}><Save size={15} /> Save zero reference</button></div>{zero.deltaL0 !== '' && Number(zero.deltaL0) < 0 && <small className="field-error">Additional load ΔL0 cannot be negative.</small>}<p className="calculation-help">E0 is calculated from the zero-reference observations in the instrument unit; it is not manually entered.</p></section>
        <section className="performance-panel"><div className="panel-title"><div><span className="technical-label">RECOMMENDED TEST PLAN</span><h2>Progressive load observations</h2><p>Recommended loads are system suggestions. Enter the actual physical observations separately. Each observation has its own reference unit.</p></div><strong>Recommended plan: {test.loadPlan?.length || 0} loads · Actual observations: {distinctLoadCount} / 10</strong></div><div className="characteristics">Class <b>{test.instrumentSnapshot?.accuracyClass || 'Not configured'}</b> · Instrument unit <b>{unit}</b> · Min <b>{formatMass(test.instrumentSnapshot?.min, unit)}</b> · Max <b>{formatMass(test.instrumentSnapshot?.max, unit)}</b> · e <b>{formatMass(test.instrumentSnapshot?.e, unit)}</b> · d <b>{formatMass(test.instrumentSnapshot?.d, unit)}</b> · n <b>{formatNumber(test.instrumentSnapshot?.n)}</b></div><div className="table-wrap"><table><thead><tr><th>#</th><th>Direction</th><th>Recommended Load ({unit}) <small>(System recommendation)</small></th><th>Observation unit</th><th>Actual Load L</th><th>Indication I</th><th>ΔL</th><th>P ({unit})</th><th>E ({unit})</th><th>Ec ({unit})</th><th>MPE ({unit})</th><th>Result</th><th /></tr></thead><tbody>{rows.map((row: any) => { const point = points.find((item: any) => item.sequence === row.sequence); return <LoadRow key={row.sequence} row={row} point={point} unit={unit} locked={completed || !supported} busy={busy} onSave={values => savePoint(row.sequence, values, Boolean(row.saved || !test.loadPlan.some((item: any) => item.sequence === row.sequence)))} />; })}</tbody></table></div><button className="performance-secondary" onClick={() => setExtra(items => [...items, { sequence: Math.max(0, ...rows.map((row: any) => row.sequence)) + 1, direction: 'INCREASING', recommendedLoad: '', unit, loadL: '', indicationI: '', deltaL: '' }])} disabled={completed || !supported}><span>+</span> Add Load Point</button></section>
        <div className="performance-summary"><div><small>Load points passed</small><b>{pass}</b></div><div><small>Load points failed</small><b>{points.filter((point: any) => (point.complianceResult || point.result) === 'FAIL').length}</b></div><div><small>Overall result</small><b>{completed ? test.result : supported ? 'Not complete' : 'CONFIGURATION REQUIRED'}</b></div>{completed ? <Link className="performance-primary" to={`/tester/reports/${reportId}/test-conditions`}><Check size={16} /> Complete Test Conditions</Link> : <button className="performance-primary" onClick={complete} disabled={busy || !canComplete}><Check size={16} /> Complete A.4.4 Test</button>}</div>
      </>}
    </section>{error && <div className="performance-error">{error}</div>}
  </main>;
}

function format(value: number) { return Number(value).toFixed(4); }
function formatNumber(value: unknown) { return Number.isFinite(Number(value)) ? new Intl.NumberFormat('en-IN', { maximumFractionDigits: 4 }).format(Number(value)) : '—'; }
function formatMass(value: unknown, unit: string) { return Number.isFinite(Number(value)) ? `${formatNumber(value)} ${unit}` : '—'; }
function LoadRow({ row, point, unit, locked, busy, onSave }: { row: any; point?: any; unit: string; locked: boolean; busy: boolean; onSave: (values: any) => void }) {
  const [values, setValues] = useState({ direction: point?.direction || row.direction, recommendedLoad: point?.recommendedLoad ?? row.recommendedLoad, unit: point?.unit || row.unit || unit, loadL: point?.inputLoadL ?? point?.loadL ?? '', indicationI: point?.inputIndicationI ?? point?.indicationI ?? '', deltaL: point?.inputDeltaL ?? point?.deltaL ?? '' });
  useEffect(() => { if (point) setValues({ direction: point.direction, recommendedLoad: point.recommendedLoad ?? row.recommendedLoad, unit: point.unit || row.unit || unit, loadL: point.inputLoadL ?? point.loadL ?? '', indicationI: point.inputIndicationI ?? point.indicationI ?? '', deltaL: point.inputDeltaL ?? point.deltaL ?? '' }); }, [point?.updatedAt, point?.sequence, row.recommendedLoad, row.unit, unit]);
  const mpeValue = point?.mpeValue ?? point?.mpe;
  const result = point?.complianceResult || point?.result;
  return <tr><td>{row.sequence}</td><td><select disabled={locked} value={values.direction} onChange={e => setValues({ ...values, direction: e.target.value })}><option value="INCREASING">Increasing</option><option value="DECREASING">Decreasing</option></select></td><td><output className="recommended-load" aria-label={`Recommended load ${row.sequence}`}>{row.recommendedLoad === '' || row.recommendedLoad === undefined ? '—' : formatMass(row.recommendedLoad, unit)}</output></td><td><select disabled={locked} aria-label={`Observation unit for load point ${row.sequence}`} value={values.unit} onChange={e => setValues({ ...values, unit: e.target.value })}>{massUnits.map(option => <option key={option} value={option}>{option}</option>)}</select></td><td><input aria-label={`Actual load L for point ${row.sequence} in ${values.unit}`} disabled={locked} type="number" min="0" step="any" value={values.loadL} onChange={e => setValues({ ...values, loadL: e.target.value })} /></td><td><input aria-label={`Indication I for point ${row.sequence} in ${values.unit}`} disabled={locked} type="number" step="any" value={values.indicationI} onChange={e => setValues({ ...values, indicationI: e.target.value })} /></td><td><input aria-label={`Delta L for point ${row.sequence} in ${values.unit}`} disabled={locked} type="number" min="0" step="any" value={values.deltaL} onChange={e => setValues({ ...values, deltaL: e.target.value })} /></td><td>{point ? formatMass(point.trueIndicationP, unit) : '—'}</td><td>{point ? formatMass(point.rawErrorE, unit) : '—'}</td><td>{point ? formatMass(point.correctedErrorEc, unit) : '—'}</td><td>{mpeValue === undefined ? '—' : <span className="mpe-value">±{formatMass(mpeValue, unit)}<details className="mpe-details"><summary>Why?</summary><div>{point.accuracyClass && <strong>Class {point.accuracyClass}</strong>}{point.m !== undefined && <span>m = L / e = {formatMass(point.loadL, unit)} / {formatMass(point.e, unit)} = {format(point.m)}e</span>}{point.rangeLabel && <span>{point.rangeLabel}</span>}<span>MPE = ±{point.mpeMultiplier}e = ±{formatMass(mpeValue, unit)}</span><small>{point.ruleReference || 'OIML R 76-1:2006 §3.5.1 Table 6'}</small></div></details></span>}</td><td><span className={`point-result ${result?.toLowerCase() || ''}`}>{result || '—'}</span></td><td><button className="save-point" onClick={() => onSave(values)} disabled={locked || busy || [values.loadL, values.indicationI, values.deltaL].some(value => value === '')} aria-label={`Save load point ${row.sequence}`}><Save size={14} /></button></td></tr>;
}
