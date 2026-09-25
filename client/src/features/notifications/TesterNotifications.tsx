import { useEffect, useState } from 'react';
import { Bell, BellRing, ChevronRight } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { markNotificationRead, NOTIFICATIONS_UPDATED_EVENT } from './notificationActions';

export type NotificationItem = { id: string; type: 'MESSAGE' | 'RETEST'; title: string; message: string; reportId: string; testCode?: string; createdAt: string; unread?: boolean; path: string };

export default function TesterNotifications({ compact = false }: { compact?: boolean }) {
  const navigate = useNavigate();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [open, setOpen] = useState(false);
  const load = async () => {
    try {
      const response = await axios.get('/dashboard/notifications');
      setItems(response.data.notifications || []);
    } catch { /* The dashboard remains usable if the optional notification panel is unavailable. */ }
  };
  useEffect(() => { void load(); const timer = window.setInterval(() => void load(), 30000); window.addEventListener(NOTIFICATIONS_UPDATED_EVENT, load); return () => { window.clearInterval(timer); window.removeEventListener(NOTIFICATIONS_UPDATED_EVENT, load); }; }, []);
  const unread = items.filter(item => item.unread).length;
  const trigger = <button className={compact ? 'side-notification-link' : 'notification-trigger'} type="button" aria-label={compact ? 'Open all notifications' : 'Open notifications'} aria-expanded={open} onClick={() => compact ? navigate('/tester/notifications') : setOpen(value => !value)}><span className="notification-icon">{unread ? <BellRing size={18} /> : <Bell size={18} />}</span>{compact && <span className="side-notification-label">Notifications</span>}{unread > 0 && <b className="notification-count">{unread > 9 ? '9+' : unread}</b>}</button>;
  const markRead = async (item: NotificationItem) => { try { await markNotificationRead(item.id); await load(); } catch { /* Leave the item unread when persistence fails. */ } };
  return <div className={compact ? 'side-notifications' : 'notification-center'}>{trigger}{!compact && open && <div className="notification-popover" role="dialog" aria-label="Notifications"><div className="notification-popover-heading"><span><small>TESTER WORKSPACE</small><strong>Notifications</strong></span><b>{unread ? `${unread} new` : 'Up to date'}</b></div>{items.length ? <div className="notification-list">{items.slice(0, 8).map(item => <article className={`notification-item ${item.unread ? 'unread' : ''}`} key={item.id}><Link to={item.path} onClick={() => setOpen(false)}><span className={`notification-kind ${item.type.toLowerCase()}`}>{item.type === 'RETEST' ? '!' : '·'}</span><span><strong>{item.title}</strong><small>{item.reportId}{item.testCode ? ` · ${item.testCode}` : ''}</small><p>{item.message}</p></span><ChevronRight size={15} /></Link>{item.unread && <button className="notification-mark-read" type="button" onClick={() => void markRead(item)}>Mark read</button>}</article>)}</div> : <div className="notification-empty"><Bell size={17} /><p>No reviewer messages or retest requests.</p></div>}</div>}</div>;
}
