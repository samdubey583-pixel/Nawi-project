import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, Lock, Play, X } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import './test-route.css';

type RoutePhase = { code: string; name: string; status: string; reason: string; source: string };
type RouteTest = { code: string; name: string; status: string; order: number; route?: 'A.4' | 'A.5' | 'A.6'; reason: string; source: string; method?: string; methodLabel?: string; dependency?: { code: string; phase: string }; executionSupported?: boolean; phases?: RoutePhase[] };
type RouteAvailability = { state: string; reason?: string; result?: string; dependencies?: Array<{ code: string; reason: string }> };
const CONFIGURABLE = ['REQUIRES_CONFIGURATION', 'REQUIRES_CONTEXT', 'UNSUPPORTED'];

export default function TestRouteWorkspace() {
  const { reportId = '' } = useParams();
  const nav = useNavigate();
  const [report, setReport] = useState<any>();
  const [tests, setTests] = useState<RouteTest[]>([]);
  const [availability, setAvailability] = useState<Record<string, RouteAvailability>>({});
  const [deferred, setDeferred] = useState<RouteTest[]>([]);
  const [performance, setPerformance] = useState<any>(null);
  const [zeroChecking, setZeroChecking] = useState<any>(null);
  const [zeroSettingBeforeLoading, setZeroSettingBeforeLoading] = useState<any>(null);
  const [tare, setTare] = useState<any>(null);
  const [tareStale, setTareStale] = useState(false);
  const [eccentricity, setEccentricity] = useState<any>(null);
  const [eccentricityStale, setEccentricityStale] = useState(false);
  const [multipleIndicating, setMultipleIndicating] = useState<any>(null);
  const [discrimination, setDiscrimination] = useState<any>(null);
  const [sensitivity, setSensitivity] = useState<any>(null);
  const [repeatability, setRepeatability] = useState<any>(null);
  const [variationWithTime, setVariationWithTime] = useState<any>(null);
  const [stabilityOfEquilibrium, setStabilityOfEquilibrium] = useState<any>(null);
  const [influenceFactors, setInfluenceFactors] = useState<any>(null);
  const [error, setError] = useState('');
  const [comingSoon, setComingSoon] = useState<RouteTest>();

  useEffect(() => {
    let active = true;
    Promise.all([
      axios.get(`/test-reports/${reportId}/applicability`), axios.get(`/test-reports/${reportId}/performance`),
      optionalTestState(`/test-reports/${reportId}/zero-checking`), optionalTestState(`/test-reports/${reportId}/zero-setting-before-loading`),
      optionalTestState(`/test-reports/${reportId}/tare`), optionalTestState(`/test-reports/${reportId}/eccentricity`), optionalTestState(`/test-reports/${reportId}/multiple-indicating-devices`),
      optionalTestState(`/test-reports/${reportId}/discrimination`), optionalTestState(`/test-reports/${reportId}/sensitivity`), optionalTestState(`/test-reports/${reportId}/repeatability`),
      optionalTestState(`/test-reports/${reportId}/variation-with-time`), optionalTestState(`/test-reports/${reportId}/stability-of-equilibrium`), optionalTestState(`/test-reports/${reportId}/influence-factors`),
    ]).then(([applicabilityResponse, performanceResponse, zeroResponse, zeroSettingResponse, tareResponse, eccentricityResponse, multipleIndicatingResponse, discriminationResponse, sensitivityResponse, repeatabilityResponse, variationWithTimeResponse, stabilityResponse, influenceResponse]) => {
      if (!active) return;
      setTests(applicabilityResponse.data.tests || []); setAvailability(applicabilityResponse.data.availability || {}); setDeferred(applicabilityResponse.data.deferred || []); setReport(performanceResponse.data.report); setPerformance(performanceResponse.data.performance);
      setZeroChecking(zeroResponse.data.test); setZeroSettingBeforeLoading(zeroSettingResponse.data.test ? { ...zeroSettingResponse.data.test, stale: zeroSettingResponse.data.stale } : null);
      setTare(tareResponse.data.test); setTareStale(tareResponse.data.stale === true); setEccentricity(eccentricityResponse.data.test); setEccentricityStale(eccentricityResponse.data.stale === true); setMultipleIndicating(multipleIndicatingResponse.data);
      setDiscrimination(discriminationResponse.data); setSensitivity(sensitivityResponse.data); setRepeatability(repeatabilityResponse.data); setVariationWithTime(variationWithTimeResponse.data); setStabilityOfEquilibrium(stabilityResponse.data);
      setInfluenceFactors(influenceResponse.data.test ? { ...influenceResponse.data.test, stale: influenceResponse.data.stale } : null);
    }).catch((requestError: any) => { if (active) setError(formatRouteLoadError(requestError)); });
    return () => { active = false; };
  }, [reportId]);

  const routeOf = (test: RouteTest) => test.route || (test.code === 'A.5' ? 'A.5' : test.code === 'A.6' ? 'A.6' : test.code.startsWith('A.4.') ? 'A.4' : undefined);
  // Keep the completion denominator limited to executable/configuration states.
  // NOT_APPLICABLE clauses are still rendered below so the route never silently
  // skips an evaluated R76 clause.
  const a4Tests = useMemo(() => tests.filter(test => routeOf(test) === 'A.4' && (test.status === 'APPLICABLE' || CONFIGURABLE.includes(test.status))).sort((a, b) => a.order - b.order), [tests]);
  const a4DisplayTests = useMemo(() => tests.filter(test => routeOf(test) === 'A.4' && (test.status === 'APPLICABLE' || CONFIGURABLE.includes(test.status) || test.status === 'NOT_APPLICABLE')).sort((a, b) => a.order - b.order), [tests]);
  const a5 = tests.find(test => routeOf(test) === 'A.5');
  const a4Complete = a4Tests.length > 0
    && a4Tests.every(test => availability[test.code]?.state === 'COMPLETED')
    && (a5?.status === 'NOT_APPLICABLE' || ['READY', 'IN_PROGRESS', 'COMPLETED'].includes(availability['A.5']?.state || ''));
  const implemented = (test: RouteTest) => ['A.4.2', 'A.4.3', 'A.4.4', 'A.4.5', 'A.4.6', 'A.4.7', 'A.4.8', 'A.4.9', 'A.4.10', 'A.4.11', 'A.4.12', 'A.5'].includes(test.code) && test.executionSupported !== false;
  const workspacePath = (test: RouteTest) => test.code === 'A.4.2' ? `/tester/reports/${reportId}/testing/a4-2` : test.code === 'A.4.3' ? `/tester/reports/${reportId}/testing/a4-3` : test.code === 'A.4.5' ? `/tester/reports/${reportId}/testing/a4-5` : test.code === 'A.4.6' ? `/tester/reports/${reportId}/testing/a4-6` : test.code === 'A.4.7' ? `/tester/reports/${reportId}/testing/a4-7` : test.code === 'A.4.8' ? `/tester/reports/${reportId}/testing/a4-8` : test.code === 'A.4.9' ? `/tester/reports/${reportId}/testing/a4-9` : test.code === 'A.4.10' ? `/tester/reports/${reportId}/testing/a4-10` : test.code === 'A.4.11' ? `/tester/reports/${reportId}/testing/a4-11` : test.code === 'A.4.12' ? `/tester/reports/${reportId}/testing/a4-12` : test.code === 'A.5' ? `/tester/reports/${reportId}/influence-factors` : `/tester/reports/${reportId}/testing/a4-4`;

  if (!report) return <main className="test-route-page"><div className="test-route-loading">{error || 'Loading applicable test route…'}</div></main>;
  return <main className="test-route-page">
    <header className="workspace-top"><Link to={`/tester/reports/${reportId}`}><ArrowLeft size={16} /> Verification &amp; Examination</Link><div className="workspace-brand"><strong>NAWI</strong><span>TEST &amp; REPORT SYSTEM</span></div><Link to="/tester/reports">All Test Reports</Link></header>
    <section className="test-route-content">
      <div className="test-route-heading"><div><span className="technical-label">ROUTE 1 OF 3 · A.4</span><h1>A.4 Performance Tests</h1><p>{report.testReportId} · Complete applicable tests; only tests with real source-data dependencies remain gated.</p></div><span className="test-route-badge">{a4Tests.length} required tests</span></div>
      <nav className="test-route-path" aria-label="Test routes"><strong>A.4 Performance Tests</strong><span>→</span><span>A.5 Influence Factors</span><span>→</span><span>A.6 Endurance</span></nav>
      <section className="test-route-intro"><div className="test-route-intro-mark"><Play size={20} /></div><div><span className="technical-label">TEST PLAN</span><h2>Applicable performance sequence</h2><p>Applicability, order, reasons, and references come from the backend rule set. Influence Factors is a separate route and becomes available only after this route is complete.</p></div></section>
      {error && <div className="test-route-error">{error}</div>}
      <section className="test-route-list" aria-label="A.4 performance test route">{a4DisplayTests.map((test, index) => <RouteItem key={test.code} test={test} index={index} routeNumber={test.status === 'NOT_APPLICABLE' ? undefined : a4Tests.findIndex(item => item.code === test.code) + 1} availability={availability[test.code]} implemented={implemented(test)} onOpen={() => implemented(test) ? nav(workspacePath(test)) : setComingSoon(test)} />)}</section>
      {!a4Tests.length && <div className="test-route-empty">No A.4 performance test is currently available for this instrument profile. Review the persisted configuration before continuing.</div>}
      {a4Complete ? <div className="test-route-next-step"><Check size={17} /><div><strong>A.4 Performance Tests complete</strong><span>The next route is Influence Factors.</span></div>{a5?.status === 'NOT_APPLICABLE' ? <span className="route-locked">Influence Factors not applicable</span> : <Link className="route-primary" to={`/tester/reports/${reportId}/influence-factors`}>Continue to Influence Factors →</Link>}</div> : a4Tests.length > 0 && <div className="test-route-next-step pending"><Lock size={17} /><div><strong>Influence Factors is locked</strong><span>Complete all required A.4 performance tests before opening Route 2.</span></div></div>}
      {(deferred.length > 0 || tests.some(test => routeOf(test) === 'A.4' && !a4Tests.includes(test) && test.status !== 'NOT_APPLICABLE')) && <details className="test-route-not-included"><summary>Configuration notes</summary><div>{tests.filter(test => routeOf(test) === 'A.4' && !a4Tests.includes(test) && test.status !== 'NOT_APPLICABLE').map(test => <p key={test.code}><strong>{test.code} · {friendlyName(test)}</strong><span>{test.status.replace(/_/g, ' ')} · {test.reason}</span></p>)}{deferred.map(test => <p key={test.code}><strong>{test.code} · {test.name}</strong><span>{test.status} · {test.reason}</span></p>)}</div></details>}
    </section>
    {comingSoon && <div className="test-route-modal-backdrop" role="presentation" onClick={() => setComingSoon(undefined)}><section className="test-route-modal" role="dialog" aria-modal="true" aria-labelledby="coming-soon-title" onClick={event => event.stopPropagation()}><button className="modal-close" aria-label="Close" onClick={() => setComingSoon(undefined)}><X size={18} /></button><span className="technical-label">{comingSoon.code}</span><h2 id="coming-soon-title">Test Coming Soon</h2><p>This OIML procedure is included in the applicable performance route, but its digital execution module is not yet available.</p><button className="route-primary" onClick={() => setComingSoon(undefined)}>Close</button></section></div>}
  </main>;
}

function RouteItem({ test, index, routeNumber, availability, implemented, onOpen }: { test: RouteTest; index: number; routeNumber?: number; availability?: RouteAvailability; implemented: boolean; onOpen: () => void }) {
  const notApplicable = test.status === 'NOT_APPLICABLE';
  const completed = availability?.state === 'COMPLETED';
  const inProgress = availability?.state === 'IN_PROGRESS';
  const available = availability?.state === 'READY' || inProgress;
  const locked = !completed && !notApplicable && !available;
  const config = available && CONFIGURABLE.includes(test.status);
  const derived = test.code === 'A.4.5';
  const statusLabel: Record<string, string> = { CONFIGURATION_REQUIRED: 'CONFIGURATION REQUIRED', UNSUPPORTED: 'NOT SUPPORTED', DEFERRED: 'DEFERRED', REVALIDATION_REQUIRED: 'REVALIDATION REQUIRED' };
  const availabilityReason = availability?.reason || availability?.dependencies?.[0]?.reason;
  return <article className={`test-route-item ${notApplicable ? 'not-applicable' : completed ? 'completed' : available ? 'active' : 'locked'}`}>
    <div className="test-route-number">{notApplicable ? <span aria-hidden="true">—</span> : completed ? <Check size={18} /> : locked ? <Lock size={16} /> : routeNumber || index + 1}</div>
    <div className="test-route-item-body"><div className="test-route-item-title"><div><span className="test-route-code">{test.code}</span><h3>{friendlyName(test)}</h3><small>{reference(test.source, test.code)}</small></div><span className={`test-route-status ${notApplicable ? 'not-applicable' : completed ? 'complete' : inProgress ? 'progress' : available ? config ? 'config' : 'available' : 'locked'}`}>{notApplicable ? 'NOT APPLICABLE' : completed ? `COMPLETED${availability?.result && availability.result !== 'COMPLETED' ? ` · ${availability.result}` : ''}` : inProgress ? 'IN PROGRESS' : available && config ? 'CONFIGURATION REQUIRED' : available && derived ? 'DERIVED FROM A.4.4' : available ? 'READY' : statusLabel[availability?.state || ''] || 'LOCKED BY DEPENDENCY'}</span></div><p>{derived ? 'No additional weighing observations are required. This comparison is derived from A.4.4.' : test.reason}</p>{locked && !notApplicable && <span className="test-route-lock-note">{availabilityReason || 'This test is waiting for its required source data or an earlier test’s terminal outcome.'}</span>}</div>
    <div className="test-route-action">{notApplicable ? <span className="test-route-na-note">No test required</span> : completed ? <button className="route-secondary" onClick={onOpen} disabled={!implemented}>View {derived ? 'comparison' : 'result'}</button> : available ? <button className="route-primary" onClick={onOpen}><Play size={15} />{inProgress ? 'Continue Test' : config ? 'Review Configuration' : derived ? 'View Comparison' : 'Start Test'}</button> : <span className="route-locked"><Lock size={14} /> Locked</span>}</div>
  </article>;
}

function formatRouteLoadError(requestError: any) {
  const status = requestError?.response?.status; const endpoint = String(requestError?.config?.url || '');
  if (status === 401 || status === 403) return 'You are not authorized to open this test route.';
  if (status === 404 && endpoint.endsWith('/zero-setting-before-loading')) return 'The A.4.3 test-state endpoint is unavailable. Deploy the current server build before opening Testing.';
  if (status === 404) return requestError.response?.data?.message || 'This test report is not available for the current tester.';
  return requestError.response?.data?.message || 'Unable to load the applicable test route.';
}

function optionalTestState(endpoint: string) {
  return axios.get(endpoint).catch((requestError: any) => {
    const status = requestError?.response?.status;
    // These GET endpoints report a dependency/configuration lock with 409
    // while the route itself is still valid. Treat that state as unavailable
    // data for the summary and let the canonical applicability response drive
    // the rendered route card. Authentication, server, and network failures
    // still reject so they remain visible to the tester.
    if (status === 404 || status === 409) return { data: {} };
    throw requestError;
  });
}

function friendlyName(test: RouteTest) {
  const names: Record<string, string> = { 'A.4.2': 'Checking of Zero', 'A.4.3': 'Setting to Zero Before Loading', 'A.4.4': 'Weighing Performance', 'A.4.5': 'Multiple Indicating Devices', 'A.4.6': 'Tare', 'A.4.7': 'Eccentricity', 'A.4.8': 'Discrimination', 'A.4.9': 'Sensitivity', 'A.4.10': 'Repeatability', 'A.4.11': 'Variation of Indication with Time', 'A.4.12': 'Stability of Equilibrium' };
  return names[test.code] || test.name;
}
function reference(source: string, code: string) { return source || `OIML R 76 ${code}`; }
