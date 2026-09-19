import { useEffect, useState } from 'react';
import { ArrowLeft, Check, RefreshCw } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import axios from 'axios';
import './multiple-indicating.css';
import TestProcedureInfo from '../guidance/TestProcedureInfo';

const format = (value: unknown, unit = 'g') => Number.isFinite(Number(value)) ? `${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 6 }).format(Number(value))} ${unit}` : '—';

export default function MultipleIndicatingDevicesWorkspace() {
  const { reportId = '' } = useParams();
  const [data, setData] = useState<any>(null); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const load = async () => { setBusy(true); setError(''); try { const response = await axios.get(`/test-reports/${reportId}/multiple-indicating-devices`); setData(response.data); } catch (e: any) { setError(e.response?.data?.message || 'Unable to load the multiple-indicating-device comparison.'); } finally { setBusy(false); } };
  useEffect(() => { void load(); }, [reportId]);
  if (!data) return <main className="multiple-indicating-page"><div className="multiple-indicating-loading">{error || 'Loading comparison…'}</div></main>;
  const applicability = data.applicability; const test = data.test; const status = data.status; const comparisons = test?.comparisons || []; const sourceComplete = data.sourceComplete;
  return <main className="multiple-indicating-page">
    <header className="multiple-indicating-top"><Link to={`/tester/reports/${reportId}/testing`}><ArrowLeft size={16} /> Testing route</Link><div><strong>NAWI</strong><span>TEST &amp; REPORT SYSTEM</span></div><Link to={`/tester/reports/${reportId}/testing/a4-4`}>Source A.4.4</Link></header>
    <section className="multiple-indicating-content"><header className="multiple-indicating-heading"><div><span className="technical-label">TESTING · A.4.5</span><h1>Multiple Indicating Devices</h1><p>Compare indications recorded during the existing A.4.4 weighing observations.</p></div><span className={`multiple-indicating-status ${String(status).toLowerCase().replace(/_/g, '-')}`}>{status === 'PASS' || status === 'FAIL' ? status : status.replace(/_/g, ' ')}</span></header>
      {error && <div className="multiple-indicating-error">{error}</div>}
      {status === 'NOT_APPLICABLE' ? <section className="multiple-indicating-panel"><span className="technical-label">NOT APPLICABLE</span><h2>One indicating device configured</h2><p>{applicability?.reason || 'Instrument has only one indicating device.'}</p><Link className="multiple-indicating-secondary" to={`/tester/reports/${reportId}/testing`}>Back to Testing</Link></section> : <>
        <section className="multiple-indicating-source"><div><span className="technical-label">SOURCE TEST</span><h2>A.4.4 Weighing Performance</h2><p>Derived from A.4.4 · no additional weighing observations are required.</p></div><div><small>Source observations</small><strong>{data.sourceTest?.observationCount || 0}</strong><span>{sourceComplete ? 'Completed' : 'Waiting for completion'}</span></div></section>
        {status === 'WAITING_FOR_SOURCE_TEST' ? <section className="multiple-indicating-panel"><h2>Waiting for A.4.4</h2><p>Complete the source weighing-performance test before this comparison can be derived.</p><Link className="multiple-indicating-secondary" to={`/tester/reports/${reportId}/testing/a4-4`}>Open A.4.4</Link></section> : <section className="multiple-indicating-panel"><div className="multiple-indicating-panel-heading"><div><span className="technical-label">COMPARISON RESULT</span><h2>{test ? 'Indication comparison' : 'Comparison incomplete'}</h2><p>{test?.source || 'A.4.5 is derived from the persisted A.4.4 observation set.'}</p></div><button className="multiple-indicating-secondary" onClick={() => void load()} disabled={busy}><RefreshCw size={15} /> Refresh comparison</button></div>{!comparisons.length || comparisons.some((comparison: any) => comparison.result === 'INCOMPLETE') ? <div className="multiple-indicating-incomplete"><strong>INCOMPLETE</strong><span>Each completed A.4.4 observation needs indications from every configured device.</span></div> : <div className="multiple-indicating-table-wrap"><table><thead><tr><th>Load</th><th>Direction</th><th>Devices compared</th><th>Difference</th><th>Limit</th><th>Result</th></tr></thead><tbody>{comparisons.map((comparison: any, index: number) => <tr key={`${comparison.sourceObservationId}-${index}`}><td>{format(comparison.load, comparison.unit)}</td><td>{comparison.direction === 'DECREASING' ? 'Decreasing' : 'Increasing'}</td><td><div className="multiple-indicating-devices">{comparison.devices.map((device: any) => <span key={device.deviceId}>{device.label}: {format(device.indication, device.unit || comparison.unit)}</span>)}</div></td><td>{format(comparison.difference, comparison.unit)}</td><td>{comparison.limit === 0 ? `0 ${comparison.limitUnit}` : format(comparison.limit, comparison.limitUnit)}</td><td><strong className={`multiple-indicating-result ${String(comparison.result).toLowerCase()}`}>{comparison.result}</strong></td></tr>)}</tbody></table></div>}</section>}
        <section className="multiple-indicating-trace"><Check size={17} /><div><strong>Derived from A.4.4</strong><span>Rule: OIML R 76-1:2006 §3.6.3. The comparison is calculated from the persisted A.4.4 observations and its applicable MPE.</span></div></section>
        <TestProcedureInfo testId="A.4.5" configuration={{ ...(test?.instrumentSnapshot || data.report?.instrument || {}), applicabilityStatus: status }} />
      </>}
    </section>
  </main>;
}
