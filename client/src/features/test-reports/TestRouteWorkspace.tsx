import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, ChevronRight, Lock, Play, X } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import './test-route.css';

type RoutePhase = { code: string; name: string; status: string; reason: string; source: string };
type RouteTest = { code: string; name: string; status: string; order: number; reason: string; source: string; method?: string; methodLabel?: string; dependency?: { code: string; phase: string }; executionSupported?: boolean; phases?: RoutePhase[] };

export default function TestRouteWorkspace() {
  const { reportId = '' } = useParams();
  const nav = useNavigate();
  const [report, setReport] = useState<any>();
  const [tests, setTests] = useState<RouteTest[]>([]);
  const [deferred, setDeferred] = useState<RouteTest[]>([]);
  const [performance, setPerformance] = useState<any>(null);
  const [zeroChecking, setZeroChecking] = useState<any>(null);
  const [zeroSettingBeforeLoading, setZeroSettingBeforeLoading] = useState<any>(null);
  const [error, setError] = useState('');
  const [comingSoon, setComingSoon] = useState<RouteTest>();

  useEffect(() => {
    let active = true;
    Promise.all([axios.get(`/test-reports/${reportId}/applicability`), axios.get(`/test-reports/${reportId}/performance`), axios.get(`/test-reports/${reportId}/zero-checking`), axios.get(`/test-reports/${reportId}/zero-setting-before-loading`)]).then(([applicabilityResponse, performanceResponse, zeroResponse, zeroSettingResponse]) => {
      if (!active) return;
      setTests(applicabilityResponse.data.tests || []);
      setDeferred(applicabilityResponse.data.deferred || []);
      setReport(performanceResponse.data.report);
      setPerformance(performanceResponse.data.performance);
      setZeroChecking(zeroResponse.data.test);
      setZeroSettingBeforeLoading(zeroSettingResponse.data.test ? { ...zeroSettingResponse.data.test, stale: zeroSettingResponse.data.stale } : null);
    }).catch((requestError: any) => { if (active) setError(formatRouteLoadError(requestError)); });
    return () => { active = false; };
  }, [reportId]);

  const applicable = useMemo(() => tests.filter(test => test.status === 'APPLICABLE').sort((a, b) => a.order - b.order), [tests]);
  const completedCodes = useMemo(() => new Set([...(zeroChecking?.status === 'COMPLETED' ? ['A.4.2'] : []), ...(zeroSettingBeforeLoading?.status === 'COMPLETED' && !zeroSettingBeforeLoading?.stale ? ['A.4.3'] : []), ...(performance?.status === 'COMPLETED' ? ['A.4.4'] : [])]), [performance?.status, zeroChecking?.status, zeroSettingBeforeLoading?.status, zeroSettingBeforeLoading?.stale]);
  const currentIndex = applicable.findIndex(test => !completedCodes.has(test.code));
  const implemented = (test: RouteTest) => (test.code === 'A.4.2' || test.code === 'A.4.4' || test.code === 'A.4.3') && test.executionSupported !== false;
  const workspacePath = (test: RouteTest) => test.code === 'A.4.2' ? `/tester/reports/${reportId}/testing/a4-2` : test.code === 'A.4.3' ? `/tester/reports/${reportId}/testing/a4-3` : `/tester/reports/${reportId}/testing/a4-4`;

  if (!report) return <main className="test-route-page"><div className="test-route-loading">{error || 'Loading applicable test route…'}</div></main>;
  return <main className="test-route-page">
    <header className="workspace-top"><Link to={`/tester/reports/${reportId}`}><ArrowLeft size={16} /> Verification &amp; Examination</Link><div className="workspace-brand"><strong>NAWI</strong><span>TEST &amp; REPORT SYSTEM</span></div><Link to="/tester/reports">All Test Reports</Link></header>
    <section className="test-route-content">
      <div className="test-route-heading"><div><span className="technical-label">TESTING · APPLICABLE ROUTE</span><h1>Testing</h1><p>{report.testReportId} · Follow the generated OIML Annex A test route in order.</p></div><span className="test-route-badge">{applicable.length} applicable tests</span></div>
      <section className="test-route-intro"><div className="test-route-intro-mark"><Play size={20} /></div><div><span className="technical-label">TEST PLAN</span><h2>Applicable test sequence</h2><p>Applicability, order, reasons, and references come from the instrument profile and backend rule set. Complete each available procedure before continuing.</p></div></section>
      {error && <div className="test-route-error">{error}</div>}
      <section className="test-route-list" aria-label="Applicable OIML test route">{applicable.map((test, index) => {
        const completed = completedCodes.has(test.code);
        const inProgress = !completed && ((test.code === 'A.4.2' && zeroChecking?.status === 'IN_PROGRESS') || (test.code === 'A.4.3' && zeroSettingBeforeLoading?.status === 'IN_PROGRESS') || (test.code === 'A.4.4' && performance?.status === 'IN_PROGRESS'));
        const available = !completed && index === currentIndex;
        const locked = !completed && !available;
        return <article className={`test-route-item ${completed ? 'completed' : inProgress || available ? 'active' : 'locked'}`} key={test.code}>
          <div className="test-route-number">{completed ? <Check size={18} /> : locked ? <Lock size={16} /> : test.order}</div>
          <div className="test-route-item-body"><div className="test-route-item-title"><div><span className="test-route-code">{test.code}</span><h3>{friendlyName(test)}</h3><small>{reference(test.source, test.code)}</small></div><span className={`test-route-status ${completed ? 'complete' : inProgress ? 'progress' : available ? 'available' : 'locked'}`}>{completed ? 'COMPLETED' : inProgress ? 'IN PROGRESS' : available ? 'AVAILABLE' : 'LOCKED'}</span></div><p>{test.reason}</p>{locked && <span className="test-route-lock-note">Complete the previous test first</span>}</div>
          <div className="test-route-action">{completed ? <button className="route-secondary" onClick={() => implemented(test) && nav(workspacePath(test))} disabled={!implemented(test)}>View result</button> : available || inProgress ? <button className="route-primary" onClick={() => implemented(test) ? nav(workspacePath(test)) : setComingSoon(test)}><Play size={15} />{inProgress ? 'Continue Test' : 'Start Test'}</button> : <span className="route-locked"><Lock size={14} /> Locked</span>}</div>
        </article>;
      })}</section>
      {!applicable.length && <div className="test-route-empty">No applicable Annex A test is ready for this instrument profile. Review the configuration reasons below.</div>}
      {performance?.status === 'COMPLETED' && zeroChecking?.status === 'COMPLETED' && (!applicable.some(test => test.code === 'A.4.3') || zeroSettingBeforeLoading?.status === 'COMPLETED') && <div className="test-route-next-step"><Check size={17} /><div><strong>Testing route complete</strong><span>Complete the final session conditions before opening Review &amp; Submit.</span></div><Link className="route-primary" to={`/tester/reports/${reportId}/test-conditions`}>Complete Test Conditions</Link></div>}
      {(tests.some(test => test.status !== 'APPLICABLE') || deferred.length > 0) && <details className="test-route-not-included"><summary>Not included in active test sequence</summary><div>{tests.filter(test => test.status !== 'APPLICABLE').map(test => <p key={test.code}><strong>{test.code} · {test.name}</strong><span>{test.status.replace(/_/g, ' ')} · {test.reason}</span></p>)}{deferred.map(test => <p key={test.code}><strong>{test.code} · {test.name}</strong><span>{test.status} · {test.reason}</span></p>)}</div></details>}
    </section>
    {comingSoon && <div className="test-route-modal-backdrop" role="presentation" onClick={() => setComingSoon(undefined)}><section className="test-route-modal" role="dialog" aria-modal="true" aria-labelledby="coming-soon-title" onClick={event => event.stopPropagation()}><button className="modal-close" aria-label="Close" onClick={() => setComingSoon(undefined)}><X size={18} /></button><span className="technical-label">{comingSoon.code}</span><h2 id="coming-soon-title">Test Coming Soon</h2><p>This OIML procedure is included in the applicable test route, but its digital execution module is not yet available.</p><button className="route-primary" onClick={() => setComingSoon(undefined)}>Close</button></section></div>}
  </main>;
}

function formatRouteLoadError(requestError: any) {
  const status = requestError?.response?.status;
  const endpoint = String(requestError?.config?.url || '');
  if (status === 401 || status === 403) return 'You are not authorized to open this test route.';
  if (status === 404 && endpoint.endsWith('/zero-setting-before-loading')) return 'The A.4.3 test-state endpoint is unavailable. Deploy the current server build before opening Testing.';
  if (status === 404) return requestError.response?.data?.message || 'This test report is not available for the current tester.';
  return requestError.response?.data?.message || 'Unable to load the applicable test route.';
}

function friendlyName(test: RouteTest) {
  const names: Record<string, string> = { 'A.4.2': 'Checking of Zero', 'A.4.3': 'Setting to Zero Before Loading', 'A.4.4': 'Weighing Performance', 'A.4.6': 'Tare', 'A.4.7': 'Eccentricity', 'A.4.8': 'Discrimination', 'A.4.10': 'Repeatability', 'A.4.11': 'Variation of Indication with Time', 'A.4.12': 'Stability of Equilibrium', 'A.5.3': 'Influence Factor Tests', A5: 'Influence Factor Tests', A6: 'Endurance' };
  return names[test.code] || test.name;
}

function reference(source: string, code: string) {
  return source || `OIML R 76 ${code}`;
}
