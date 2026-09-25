import { useEffect, useState } from 'react';
import { AlertCircle, ArrowRight, ClipboardList, FileCheck2, MessageSquare, Users } from 'lucide-react';
import axios from 'axios';
import { Link, useLocation, useSearchParams } from 'react-router-dom';

const dateLabel = (value: unknown) => value ? new Date(String(value)).toLocaleString() : 'Not recorded';
const messageDisplayText = (message: any) => {
  const status = String(message.status || '').replace(/_/g, ' ').toLowerCase();
  if (/\bis in the reviewer queue\b/i.test(String(message.message || '')) && !['awaiting review', 'under review'].includes(status)) {
    return `Earlier submission receipt · this report is now ${status || 'in its current workflow state'}.`;
  }
  return message.message;
};

export default function ReviewerDashboard() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [notificationBusy, setNotificationBusy] = useState('');
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const urlTesterId = searchParams.get('testerId') || '';
  const choosingTester = searchParams.get('chooseTester') === '1';
  const selectedTesterId = urlTesterId || (choosingTester ? '' : window.sessionStorage.getItem('nawi.reviewer.selectedTesterId') || '');
  useEffect(() => {
    if (urlTesterId) window.sessionStorage.setItem('nawi.reviewer.selectedTesterId', urlTesterId);
    else if (choosingTester) window.sessionStorage.removeItem('nawi.reviewer.selectedTesterId');
  }, [urlTesterId, choosingTester]);
  const context = selectedTesterId ? `?testerId=${encodeURIComponent(selectedTesterId)}` : '';
  const load = async () => { try { const [reportsResponse, testersResponse, notificationsResponse] = await Promise.all([axios.get(`/reviewer/reports${context}`), axios.get('/reviewer/testers'), axios.get(`/reviewer/notifications${context}`)]); setData({ ...reportsResponse.data, testers: testersResponse.data.testers || [], notifications: notificationsResponse.data.notifications || [] }); setError(''); } catch (e: any) { setError(e.response?.data?.message || 'Unable to load the reviewer workspace.'); } };
  useEffect(() => { void load(); }, [context]);
  const markNotificationRead = async (item: any) => {
    setNotificationBusy(item.id);
    try {
      await axios.patch(`/reviewer/notifications/${encodeURIComponent(item.id)}/read${context}`);
      await load();
    } catch (e: any) {
      setError(e.response?.data?.message || 'Unable to mark this notification as read.');
    } finally { setNotificationBusy(''); }
  };
  if (!data) return <main className="reviewer-page"><div className="reviewer-empty">{error || 'Loading reviewer workspace…'}</div></main>;
  const counts = data.counts || {};
  const queue = data.queue || [];
  const fullReportsView = location.pathname === '/reviewer/reports';
  const queuePreview = fullReportsView ? queue : queue.slice(0, 5);
  const decisionsPreview = fullReportsView ? (data.recentDecisions || []) : (data.recentDecisions || []).slice(0, 5);
  const testers = data.testers || [];
  const messages = data.messages || [];
  const notifications = data.notifications || [];
  const selectedTester = testers.find((tester: any) => tester.id === selectedTesterId);
  const hasContext = Boolean(selectedTesterId && selectedTester);
  return <main className="reviewer-page">
    <header className="reviewer-header"><div><span className="technical-label">AUTHORITY WORKSPACE</span><h1>{fullReportsView ? 'Reports' : 'Review Tests'}</h1><p>{hasContext ? `Reviewing submitted records for ${selectedTester.name}.` : 'Choose a tester, then inspect submitted NAWI test records and make an authoritative decision.'}</p></div>{hasContext && <Link className="reviewer-context-switch" to="/reviewer/dashboard?chooseTester=1"><Users size={15} /> Change tester</Link>}</header>
    {error && <div className="tare-error" role="alert">{error}</div>}
    {!hasContext && !fullReportsView && <section className="reviewer-section reviewer-context-empty"><div className="reviewer-section-heading"><div><span className="technical-label">REVIEW CONTEXT</span><h2>Choose a tester</h2></div></div><p className="review-empty">Select a tester to load their instruments, reports, evidence, messages, and review queue.</p></section>}
    {!hasContext && fullReportsView && <section className="reviewer-section reviewer-context-empty"><div className="reviewer-section-heading"><div><span className="technical-label">REVIEW CONTEXT</span><h2>Please select a tester</h2></div></div><p className="review-empty">Reports are shown within a tester context. Choose a tester from the Review Tests page first.</p><Link className="dashboard-more" to="/reviewer/dashboard">Choose a tester <ArrowRight size={15} /></Link></section>}
    {hasContext && <section className="reviewer-stats" aria-label="Review summary">
      <ReviewerStat icon={<ClipboardList />} label="Awaiting Review" value={counts.awaitingReview} />
      <ReviewerStat icon={<ClipboardList />} label="Under Review" value={counts.underReview} />
      <ReviewerStat icon={<Users />} label="Approved" value={counts.approved} />
      <ReviewerStat icon={<FileCheck2 />} label="Rejected" value={counts.rejected} />
      <ReviewerStat icon={<ClipboardList />} label="Retest Required" value={counts.retestRequired} />
    </section>}
    <nav className="reviewer-tools" aria-label="Reviewer resources">{hasContext && <><Link to={`/reviewer/testers?testerId=${selectedTesterId}`}><Users size={16} /> Tester directory</Link><Link to={`/reviewer/evidence?testerId=${selectedTesterId}`}><FileCheck2 size={16} /> Evidence gallery</Link></>}</nav>
    {!hasContext && !fullReportsView && <section className="reviewer-section"><div className="reviewer-section-heading"><div><span className="technical-label">TESTERS</span><h2>Choose a tester to review</h2></div><span>{testers.length} with test records</span></div>{testers.length ? <div className="reviewer-directory-grid reviewer-dashboard-testers">{testers.slice(0, 5).map((tester: any) => <Link className="reviewer-panel reviewer-tester-card" to={`/reviewer/dashboard?testerId=${tester.id}`} key={tester.id}><span className="technical-label">TESTER</span><h2>{tester.name}</h2><p>{tester.email}</p><strong>{tester.reports.length} test record{tester.reports.length === 1 ? '' : 's'}</strong><ArrowRight size={16} /></Link>)}</div> : <div className="reviewer-empty">No tester records are available yet.</div>}{testers.length > 5 && <Link className="dashboard-more" to="/reviewer/testers">View all testers <ArrowRight size={15} /></Link>}</section>}
    {hasContext && <section className="reviewer-section"><div className="reviewer-section-heading"><div><span className="technical-label">REVIEW QUEUE</span><h2>Reports awaiting review</h2></div><span>{queue.length} open</span></div>
      {queue.length ? <div className="reviewer-list">{queuePreview.map((item: any) => <ReviewQueueCard item={item} key={item.id} />)}</div> : <div className="reviewer-empty">No submitted reports are waiting for review.</div>}
      {!fullReportsView && queue.length > 5 && <Link className="dashboard-more" to={`/reviewer/reports?testerId=${selectedTesterId}`}>View all reports <ArrowRight size={15} /></Link>}
    </section>}
    {notifications.length > 0 && <section className="reviewer-section reviewer-notification-panel"><div className="reviewer-section-heading"><div><span className="technical-label">NOTIFICATIONS</span><h2>Tester activity</h2></div><span>{notifications.filter((item: any) => item.unread).length ? `${notifications.filter((item: any) => item.unread).length} unread` : `${notifications.length} recent`}</span></div><div className="reviewer-notification-list">{notifications.slice(0, 8).map((item: any) => <article className={`reviewer-notification-item ${String(item.type || '').toLowerCase()}${item.unread ? ' unread' : ''}`} key={item.id}><Link className="reviewer-notification-link" to={item.path}><span className="reviewer-notification-icon">{item.type === 'MESSAGE' ? <MessageSquare size={17} /> : <AlertCircle size={17} />}</span><span><strong>{item.title}</strong><small>{item.reportId} · {item.testerName || 'Tester'} · {dateLabel(item.createdAt)}</small><p>{messageDisplayText({ message: item.message, status: item.status })}</p></span><ArrowRight size={16} /></Link>{item.unread && <button type="button" className="reviewer-notification-read" disabled={notificationBusy === item.id} onClick={() => void markNotificationRead(item)}>{notificationBusy === item.id ? 'Saving…' : 'Mark read'}</button>}</article>)}</div></section>}
    {messages.length > 0 && (!fullReportsView || hasContext) && <section className="reviewer-section"><div className="reviewer-section-heading"><div><span className="technical-label">AUTHORITY COMMUNICATION</span><h2>Latest messages</h2></div><span>{messages.length} recent</span></div><div className="reviewer-message-list">{messages.slice(0, 5).map((message: any) => <Link className="reviewer-dashboard-message" to={`/reviewer/reports/${message.reportNumber}`} key={message.id}><div><strong>{message.subject}</strong><small>{message.senderNameSnapshot} · {message.senderRole} · {dateLabel(message.createdAt)}</small></div><p>{messageDisplayText(message)}</p><small>{message.reportNumber} · {String(message.status).replace(/_/g, ' ')}</small></Link>)}</div></section>}
    {hasContext && !!(data.recentDecisions || []).length && <section className="reviewer-section"><div className="reviewer-section-heading"><div><span className="technical-label">DECISION HISTORY</span><h2>Recent decisions</h2></div></div><div className="reviewer-list">{decisionsPreview.map((item: any) => <ReviewQueueCard item={item} key={item.id} />)}</div>{!fullReportsView && data.recentDecisions.length > 5 && <Link className="dashboard-more" to={`/reviewer/reports?testerId=${selectedTesterId}`}>View all decisions <ArrowRight size={15} /></Link>}</section>}
  </main>;
}

function ReviewerStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: unknown }) { return <div className="reviewer-stat"><span>{icon}</span><strong>{Number(value || 0)}</strong><small>{label}</small></div>; }
function ReviewQueueCard({ item }: { item: any }) { const closed = item.status === 'COMPLETED' || item.status === 'REJECTED'; return <Link className="reviewer-card" to={`/reviewer/reports/${item.reportNumber || item.id}`}><div><span className="technical-label">{String(item.status || '').replace(/_/g, ' ')}</span><h2>{item.reportNumber}</h2><p>{item.instrument?.typeDesignation || 'Instrument'} · {item.tester || 'Tester not recorded'}</p>{item.prototype && <small className="reviewer-prototype">SYNTHETIC PROTOTYPE / REGRESSION DATA</small>}</div><div><strong>{item.overallResult || 'INCOMPLETE'}</strong><small>{closed ? dateLabel(item.reviewedAt) : dateLabel(item.submittedForReviewAt || item.updatedAt)}</small><ArrowRight size={17} /></div></Link>; }
