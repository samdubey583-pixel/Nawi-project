import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { AlertTriangle, ArrowRight, ChevronRight, ClipboardCheck, FileText, Plus, Search, Weight } from 'lucide-react';
import AmbientShapes from '../ambient/AmbientShapes';

type TesterDashboardWorkspaceProps = { user?: { firstName?: string } | null };

const statusLabel = (value: unknown) => String(value || '—').replace(/_/g, ' ');
const dateLabel = (value: unknown) => value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(String(value))) : 'No activity recorded';

export default function TesterDashboardWorkspace({ user }: TesterDashboardWorkspaceProps) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/dashboard');
      setData(response.data);
      setError('');
    } catch (requestError: any) {
      setError(requestError.response?.data?.message || 'Unable to load live dashboard data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  if (loading && !data) return <main className="dashboard dashboard-state"><div className="dashboard-loading">Loading live dashboard workspace…</div></main>;
  if (error && !data) return <main className="dashboard dashboard-state"><div className="dashboard-error" role="alert"><AlertTriangle size={18} /><div><strong>Dashboard unavailable</strong><p>{error}</p><button className="secondary" onClick={() => void load()}>Try again</button></div></div></main>;

  const activeReports = data?.activeReports || [];
  const awaitingReports = data?.awaitingReview || [];
  const recentCompleted = data?.recentCompleted || [];
  const attentionItems = data?.attentionItems || [];
  const sessions = data?.history || data?.recentActivity || data?.recentSessions || [];
  const instruments = data?.instrumentSnapshot || [];
  const workflow = data?.workflowSummary || {};
  const authority = data?.authorityCommunicationSummary || { supported: false, items: [], emptyMessage: 'Authority communication will appear here when a report requires review or clarification.' };
  const stat = (key: string) => Number(data?.[key] || 0);

  return <main className="dashboard dashboard-workspace">
    <AmbientShapes variant="dashboard" />
    <div className="welcome-row">
      <div><span className="crumb">TESTER WORKSPACE · OVERVIEW</span><h1>Good morning, {user?.firstName || 'Tester'}</h1><p>See active verifications, required actions and the latest report activity in one place.</p></div>
      <div className="welcome-actions"><Link className="primary small" to="/tester/new-report"><Plus size={17} /> New Test Report</Link><Link className="secondary" to="/tester/instruments"><Weight size={16} /> Register Instrument</Link></div>
    </div>
    {error && <div className="dashboard-error" role="alert"><AlertTriangle size={16} /> {error} <button className="dashboard-retry" onClick={() => void load()}>Refresh</button></div>}

    <section className="stats" aria-label="Live summary">
      <DashboardStat icon={<Weight />} label="Instruments" value={stat('instrumentsCount')} />
      <DashboardStat icon={<ClipboardCheck />} label="Active Tests" value={stat('activeTests')} />
      <DashboardStat icon={<Search />} label="Awaiting Review" value={stat('awaitingReview')} />
      <DashboardStat icon={<AlertTriangle />} label="Changes Requested" value={stat('changesRequested')} />
      <DashboardStat icon={<FileText />} label="Completed Reports" value={stat('completedReports')} />
    </section>

    <div className="dashboard-grid dashboard-operational-grid">
      <section className="section-card wide dashboard-section">
        <div className="section-heading"><div><span className="dashboard-kicker">ACTIVE WORKSPACE</span><h2>Current Work</h2></div><Link to="/tester/reports">View all active reports <ArrowRight /></Link></div>
        {activeReports.length ? <div className="dashboard-report-list">{activeReports.slice(0, 6).map((item: any) => <DashboardReportRow item={item} key={item.reportId} />)}</div> : <DashboardEmpty icon={<ClipboardCheck />} title="No active verifications" copy="New and in-progress reports will appear here." action="New Test Report" to="/tester/new-report" />}
        {activeReports.length > 6 && <Link className="dashboard-more" to="/tester/reports">View all active reports <ArrowRight size={15} /></Link>}
      </section>

      <section className="section-card wide dashboard-section">
        <div className="section-heading"><div><span className="dashboard-kicker">SUBMITTED REPORTS</span><h2>Awaiting Review</h2></div><Link to="/tester/reports">View reports <ArrowRight /></Link></div>
        {awaitingReports.length ? <div className="dashboard-report-list">{awaitingReports.slice(0, 6).map((item: any) => <DashboardReportRow item={item} key={item.reportId} />)}</div> : <DashboardEmpty icon={<Search />} title="No reports awaiting review" copy="Submitted reports will appear here while the authority review is pending." action="View Reports" to="/tester/reports" />}
      </section>

      {recentCompleted.length > 0 && <section className="section-card dashboard-section">
        <div className="section-heading"><div><span className="dashboard-kicker">REPORT RECORDS</span><h2>Recent Completed Reports</h2></div></div>
        <div className="dashboard-session-list">{recentCompleted.slice(0, 5).map((item: any) => <Link className="dashboard-session" to={item.resumePath || `/tester/reports/${item.reportId}/review`} key={item.reportId}><span className="dashboard-row-icon"><FileText size={18} /></span><span><b>{item.reportId}</b><strong>{item.instrument} · {item.currentTest?.code || item.stage}</strong><small>{statusLabel(item.status)} · {dateLabel(item.date)}</small></span><ChevronRight size={16} /></Link>)}</div>
      </section>}

      {attentionItems.length > 0 && <section className="section-card wide dashboard-section attention-section">
        <div className="section-heading"><div><span className="dashboard-kicker">ACTION QUEUE</span><h2>Requires Immediate Attention</h2></div><AlertTriangle size={18} /></div>
        <div className="dashboard-attention-list">{attentionItems.slice(0, 5).map((item: any) => <Link className="attention-item" to={item.path} key={item.id}><AlertTriangle size={17} /><span><b>{item.reportId || item.testId}</b><strong>{item.title}</strong><small>{item.reason}</small></span><ChevronRight size={16} /></Link>)}</div>
      </section>}

      <section className="section-card dashboard-section workflow-summary-card">
        <div className="section-heading"><div><span className="dashboard-kicker">STATE SUMMARY</span><h2>Work Queue</h2></div></div>
        <div className="workflow-summary"><WorkflowMetric label="Testing" value={workflow.testing} /><WorkflowMetric label="Awaiting Review" value={workflow.awaitingReview} /><WorkflowMetric label="Changes Requested" value={workflow.changesRequested} /><WorkflowMetric label="Retest Required" value={workflow.retestRequired} /><WorkflowMetric label="Completed" value={workflow.completed} /></div>
      </section>

      <section className="section-card dashboard-section">
        <div className="section-heading"><div><span className="dashboard-kicker">REPORT RECORDS</span><h2>History</h2></div><Link to="/tester/history">View full history <ArrowRight /></Link></div>
        {sessions.length ? <div className="dashboard-session-list">{sessions.slice(0, 8).map((item: any) => <Link className="dashboard-session" to={item.resumePath || `/tester/reports/${item.reportId}`} key={item.reportId}><span className="dashboard-row-icon"><ClipboardCheck size={18} /></span><span><b>{item.reportId}</b><strong>{item.instrument} · {item.currentTest?.code || item.stage}</strong><small>{statusLabel(item.status)} · {dateLabel(item.lastActivity || item.date)}</small></span><ChevronRight size={16} /></Link>)}</div> : <DashboardEmpty icon={<ClipboardCheck />} title="No test reports yet" copy="Start a new verification session to begin building your report history." action="New Test Report" to="/tester/new-report" />}
      </section>

      <section className="section-card dashboard-section">
        <div className="section-heading"><div><span className="dashboard-kicker">REPOSITORY</span><h2>Instruments</h2></div><Link to="/tester/instruments">View all <ArrowRight /></Link></div>
        {instruments.length ? <div className="dashboard-instrument-list">{instruments.slice(0, 4).map((item: any) => <Link className="dashboard-instrument" to={`/tester/instruments/${item.id}`} key={item.id}><Weight size={18} /><span><b>{item.model || 'Instrument'}</b><strong>{item.accuracyClass || 'Class not recorded'} · Max {item.max ?? '—'} {item.unit || ''}</strong><small>{item.lastTest ? `Last test: ${item.lastTest.reportId}` : 'No tests yet'}</small></span><ChevronRight size={16} /></Link>)}</div> : <DashboardEmpty icon={<Weight />} title="No instruments registered" copy="Register an instrument to begin testing." action="Register Instrument" to="/tester/instruments" />}
        {data?.instrumentsCount > instruments.length && <Link className="dashboard-more" to="/tester/instruments">View all instruments <ArrowRight size={15} /></Link>}
      </section>

      <section className="section-card dashboard-section authority-card">
        <div className="section-heading"><div><span className="dashboard-kicker">REVIEW CONTEXT</span><h2>Authority Communication</h2></div></div>
        {authority.items?.length ? <div className="authority-list">{authority.items.slice(0, 4).map((item: any) => <Link className="authority-item" to={item.path || `/tester/reports/${item.reportId}`} key={item.id}><span><b>{item.title}</b><strong>{item.reportId} · {item.testId || item.instrument || 'Report'}</strong><small>{item.reason || item.message || 'Open report communication'}</small></span><ChevronRight size={16} /></Link>)}</div> : <div className="authority-empty"><div className="empty-icon"><Search size={18} /></div><b>No active authority requests.</b><p>{authority.emptyMessage}</p><span className="authority-placeholder">Contact Authority <ArrowRight size={15} /></span></div>}
      </section>

    </div>
  </main>;
}

function DashboardStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) { return <div className="stat"><div className="stat-icon">{icon}</div><strong>{value}</strong><span>{label}</span></div>; }
function WorkflowMetric({ label, value }: { label: string; value: number }) { return <div><span>{label}</span><strong>{value}</strong></div>; }
function DashboardReportRow({ item }: { item: any }) { const remaining = Object.values(item.routeProgress || {}).reduce((sum: number, route: any) => sum + Number(route.unresolved || 0), 0); return <Link className="dashboard-report-row" to={item.resumePath || `/tester/reports/${item.reportId}`}><span><b>{item.reportId}</b><strong>{item.instrument} · {item.currentTest?.code || item.stage}</strong><small>{item.currentTest?.name || statusLabel(item.status)} · {statusLabel(item.status)} · {dateLabel(item.date)}</small></span><div className="report-route-progress">{(['A.4', 'A.5', 'A.6'] as const).map(route => <span key={route} className={item.routeProgress?.[route]?.state?.toLowerCase() || 'locked'}>{route} {item.routeProgress?.[route]?.state === 'LOCKED' ? 'Locked' : `${item.routeProgress?.[route]?.completed ?? 0}/${item.routeProgress?.[route]?.total ?? 0}`}</span>)}</div><span className="dashboard-row-action">{item.actionLabel || 'Resume Testing'} <ArrowRight size={15} /></span>{remaining > 0 && <small className="dashboard-work-remaining">{remaining} tests remaining</small>}</Link>; }
function DashboardEmpty({ icon, title, copy, action, to }: { icon: React.ReactNode; title: string; copy: string; action: string; to: string }) { return <div className="dashboard-empty"><div className="empty-icon">{icon}</div><b>{title}</b><p>{copy}</p><Link className="secondary" to={to}><Plus size={15} /> {action}</Link></div>; }
