import { useEffect, useState } from 'react';
import { AlertCircle, ArrowLeft, Bell, ChevronRight, MessageSquare } from 'lucide-react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import type { NotificationItem } from './TesterNotifications';
import { markNotificationRead, NOTIFICATIONS_UPDATED_EVENT } from './notificationActions';

const dateLabel = (value: unknown) => value ? new Date(String(value)).toLocaleString() : 'Not recorded';

export default function TesterNotificationsPage() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [error, setError] = useState('');
  const load = () => axios.get('/dashboard/notifications').then(response => setItems(response.data.notifications || [])).catch((requestError: any) => setError(requestError.response?.data?.message || 'Unable to load notifications.'));
  useEffect(() => { void load(); window.addEventListener(NOTIFICATIONS_UPDATED_EVENT, load); return () => window.removeEventListener(NOTIFICATIONS_UPDATED_EVENT, load); }, []);
  const markRead = async (id: string) => { try { await markNotificationRead(id); await load(); } catch (requestError: any) { setError(requestError.response?.data?.message || 'Unable to mark this notification as read.'); } };
  return <main className="notifications-page"><Link className="notifications-back" to="/tester/dashboard"><ArrowLeft size={16} /> Back to dashboard</Link><header className="notifications-page-header"><div><span className="technical-label">TESTER WORKSPACE</span><h1>Notifications</h1><p>Reviewer messages and retest requests for your reports.</p></div><Bell size={28} /></header>{error && <div className="notifications-error" role="alert"><AlertCircle size={17} /> {error}</div>}{items.length ? <section className="notifications-full-list" aria-label="All notifications">{items.map(item => <article className={`notifications-full-item ${item.type.toLowerCase()}${item.unread ? ' unread' : ''}`} key={item.id}><Link to={item.path}><span className="notifications-full-icon">{item.type === 'RETEST' ? <AlertCircle size={18} /> : <MessageSquare size={18} />}</span><span><strong>{item.title}</strong><small>{item.reportId}{item.testCode ? ` · ${item.testCode}` : ''} · {dateLabel(item.createdAt)}</small><p>{item.message}</p></span><ChevronRight size={17} /></Link>{item.unread && <button type="button" className="notification-mark-read" onClick={() => void markRead(item.id)}>Mark as read</button>}</article>)}</section> : <section className="notifications-empty-page"><Bell size={30} /><h2>No notifications</h2><p>Reviewer messages and retest requests will appear here.</p></section>}</main>;
}
