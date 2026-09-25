import { useEffect, useState } from 'react';
import { ArrowLeft, ClipboardCheck, FileCheck2, Files, LogOut, Users, Weight } from 'lucide-react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import AmbientShapes from '../ambient/AmbientShapes';
import Logo from '../../components/Logo';
import { isReviewerNavItemActive } from './reviewerNavigation';

// The shell receives auth through the small bridge exported by main.tsx. Keeping
// this wrapper local avoids duplicating the tester shell or weakening route guards.
export default function ReviewerShell({ children, user, logout }: { children: React.ReactNode; user: any; logout: () => Promise<void> }) {
  const location = useLocation(); const navigate = useNavigate(); const [searchParams] = useSearchParams();
  const urlTesterId = searchParams.get('testerId') || '';
  const choosingTester = searchParams.get('chooseTester') === '1';
  const [rememberedTesterId, setRememberedTesterId] = useState(() => window.sessionStorage.getItem('nawi.reviewer.selectedTesterId') || '');
  useEffect(() => {
    if (urlTesterId) { window.sessionStorage.setItem('nawi.reviewer.selectedTesterId', urlTesterId); setRememberedTesterId(urlTesterId); }
    else if (choosingTester) { window.sessionStorage.removeItem('nawi.reviewer.selectedTesterId'); setRememberedTesterId(''); }
  }, [urlTesterId, choosingTester]);
  const selectedTesterId = urlTesterId || (choosingTester ? '' : rememberedTesterId);
  const context = selectedTesterId ? `?testerId=${encodeURIComponent(selectedTesterId)}` : '';
  const links = [
    ['Review Tests', ClipboardCheck, `/reviewer/dashboard${context}`],
    ['Registered Instruments', Weight, `/reviewer/testers?view=instruments${selectedTesterId ? `&testerId=${encodeURIComponent(selectedTesterId)}` : ''}`],
    ['Testers', Users, `/reviewer/testers${context}`],
    ['Reports', Files, `/reviewer/reports${context}`],
    ['Evidence Gallery', FileCheck2, `/reviewer/evidence${context}`],
  ] as const;
  const onDashboard = location.pathname === '/reviewer/dashboard';
  return <div className="reviewer-shell"><AmbientShapes variant="dashboard" /><aside className="reviewer-sidebar"><div className="reviewer-side-brand"><Link className="reviewer-side-logo-link" to={`/reviewer/dashboard${context}`} aria-label="Review dashboard" title="Review dashboard"><Logo dark animated /></Link><small>TEST &amp; REPORT SYSTEM</small></div><nav aria-label="Reviewer workspace"><span className="reviewer-nav-label">REVIEWER WORKSPACE</span>{links.map(([label, Icon, to]) => { const active = isReviewerNavItemActive(label, location.pathname, searchParams); return <Link className={active ? 'active' : ''} to={to} key={label} aria-current={active ? 'page' : undefined}><Icon size={17} />{label}</Link>; })}</nav><div className="reviewer-side-account"><span className="reviewer-nav-label">ACCOUNT</span><b>{user?.firstName} {user?.lastName}</b><small>REVIEWER</small><button onClick={async () => { window.sessionStorage.removeItem('nawi.reviewer.selectedTesterId'); await logout(); navigate('/login'); }}><LogOut size={15} /> Sign out</button></div></aside><div className="reviewer-shell-main"><header className="reviewer-topbar"><span>REVIEWER WORKSPACE</span>{!onDashboard && <button type="button" onClick={() => navigate(`/reviewer/dashboard${context}`)}><ArrowLeft size={15} /> Go back</button>}</header>{children}</div></div>;
}
