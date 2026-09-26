import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import axios from 'axios';
import { BrowserRouter, useNavigate, Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import { LogOut, LayoutDashboard, Weight, Files, History, ChevronRight, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import TestReportWorkflow from './features/test-reports/TestReportWorkflow';
import TesterReports from './features/verification/TesterReports';
import VerificationWorkspace from './features/verification/VerificationWorkspace';
import PerformanceWorkspace from './features/performance/PerformanceWorkspace';
import FinalReportWorkspace from './features/test-reports/FinalReportWorkspace';
import LaboratoryEnvironmentWorkspace from './features/test-reports/LaboratoryEnvironmentWorkspace';
import CompleteTestConditionsWorkspace from './features/test-reports/CompleteTestConditionsWorkspace';
import TestRouteWorkspace from './features/test-reports/TestRouteWorkspace';
import VariationWithTimeWorkspace from './features/test-reports/VariationWithTimeWorkspace';
import StabilityOfEquilibriumWorkspace from './features/test-reports/StabilityOfEquilibriumWorkspace';
import ZeroCheckingWorkspace from './features/zero-checking/ZeroCheckingWorkspace';
import ZeroSettingBeforeLoadingWorkspace from './features/zero-setting/ZeroSettingBeforeLoadingWorkspace';
import TareWorkspace from './features/tare/TareWorkspace';
import EccentricityWorkspace from './features/test-reports/EccentricityWorkspace';
import MultipleIndicatingDevicesWorkspace from './features/test-reports/MultipleIndicatingDevicesWorkspace';
import DiscriminationWorkspace from './features/test-reports/DiscriminationWorkspace';
import SensitivityWorkspace from './features/test-reports/SensitivityWorkspace';
import RepeatabilityWorkspace from './features/test-reports/RepeatabilityWorkspace';
import InfluenceFactorsWorkspace from './features/test-reports/InfluenceFactorsWorkspace';
import EnduranceWorkspace from './features/test-reports/EnduranceWorkspace';
import AmbientShapes from './features/ambient/AmbientShapes';
import ReportApplicationEdit from './features/test-reports/ReportApplicationEdit';
import { HistoryPage, InstrumentEdit, InstrumentRegistration, InstrumentRepository } from './features/instruments/InstrumentRepository';
import InstrumentRecordPage from './features/instruments/InstrumentRecordPage';
import './styles.css';
import './features/dashboard.css';
import './features/ambient/ambient-shapes.css';
import './features/primary-actions.css';
import TesterDashboardWorkspace from './features/dashboard/TesterDashboardWorkspace';
import MobileEvidencePage from './features/evidence/MobileEvidencePage';
import './features/evidence/evidence.css';
import ReviewerDashboard from './features/reviewer/ReviewerDashboard';
import ReviewerReportDetail from './features/reviewer/ReviewerReportDetail';
import ReviewerTestDetail from './features/reviewer/ReviewerTestDetail';
import ReviewerTesterDirectory from './features/reviewer/ReviewerTesterDirectory';
import ReviewerEvidenceGallery from './features/reviewer/ReviewerEvidenceGallery';
import ReviewerShell from './features/reviewer/ReviewerShell';
import Logo from './components/Logo';
import TesterNotifications from './features/notifications/TesterNotifications';
import TesterNotificationsPage from './features/notifications/TesterNotificationsPage';
axios.defaults.baseURL = import.meta.env.VITE_API_URL || '/api';
axios.defaults.withCredentials = true;

type Role = 'TESTER' | 'REVIEWER' | 'ADMIN';
type User = { id: string; firstName: string; lastName: string; email: string; role: Role };
const Auth = createContext<any>({ user: null, loading: true, login: () => {}, logout: async () => {} });
const useAuth = () => useContext(Auth);

function Provider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { axios.get('/auth/me').then(response => setUser(response.data.user)).catch(() => {}).finally(() => setLoading(false)); }, []);
  const logout = async () => { await axios.post('/auth/logout'); setUser(null); };
  return <Auth.Provider value={{ user, loading, login: setUser, logout }}>{children}</Auth.Provider>;
}


function Field({ label, value, onChange, placeholder, icon }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; icon?: React.ReactNode }) {
  return <label className="field"><span>{label}</span><div className="input-wrap">{icon}<input value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} /></div></label>;
}
function Password({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  const [show, setShow] = useState(false);
  return <label className="field"><span>{label}</span><div className="input-wrap"><Lock /><input type={show ? 'text' : 'password'} value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} /><button type="button" aria-label="Show or hide password" onClick={() => setShow(!show)}>{show ? <EyeOff /> : <Eye />}</button></div></label>;
}
function AuthLayout({ children, title, subtitle, scroll = false }: { children: React.ReactNode; title: string; subtitle: string; scroll?: boolean }) {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const moveCard = (event: React.MouseEvent<HTMLElement>) => {
    if (window.innerWidth <= 760) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - (bounds.left + bounds.width / 2)) / bounds.width;
    const y = (event.clientY - (bounds.top + bounds.height / 2)) / bounds.height;
    setOffset({ x: Number((x * 3.5).toFixed(2)), y: Number((y * 2.5).toFixed(2)) });
  };
  const resetCard = () => setOffset({ x: 0, y: 0 });
  const style = {
    '--card-x': `${offset.x}px`,
    '--card-y': `${offset.y}px`,
    '--card-rx': `${(offset.x / 3.5 * 0.35).toFixed(3)}deg`,
    '--card-ry': `${(-offset.y / 2.5 * 0.25).toFixed(3)}deg`,
  } as React.CSSProperties;
  return <main className={`page ${scroll ? 'auth-scroll' : ''}`} onMouseMove={moveCard} onMouseLeave={resetCard}><AmbientShapes variant="login" /><header className="site-header"><Link className="auth-logo-link" to="/login"><Logo dark animated /></Link><span className="pill">OIML R-76</span><span className="header-product">Test &amp; Report System</span></header><section className="auth-card" style={style}><section className="hero-panel"><p className="eyebrow">NAWI TEST &amp; REPORT SYSTEM</p><h2>Precision in<br />every<br /><em>measurement.</em></h2><p className="hero-copy">Build, manage and review test records with confidence. A modern platform for OIML R-76 compliance.</p><div className="feature-row"><span>Trusted<br />Records</span><span>Transparent<br />Process</span><span>Global<br />Standards</span></div><div className="hero-foot">OIML R-76 • Legal Metrology • Digital Workflow</div></section><section className="form-panel"><div className="form-content"><div className="blue-rule" /><h1>{title}</h1><p className="sub">{subtitle}</p><DemoAccess />{children}</div></section></section><footer>© 2026 NAWI | Legal Metrology | Digital Workflow</footer></main>;
}
function Login() {
  const { login } = useAuth(); const nav = useNavigate(); const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [role, setRole] = useState<'TESTER' | 'REVIEWER'>('TESTER'); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  return <AuthLayout title="Welcome back" subtitle="Sign in to your NAWI workspace"><form onSubmit={async event => { event.preventDefault(); setError(''); setBusy(true); try { const response = await axios.post('/auth/login', { email, password }); const authenticatedUser = response.data.user as User; if (authenticatedUser.role !== role) { await axios.post('/auth/logout').catch(() => undefined); setError(`This account is registered as ${authenticatedUser.role === 'REVIEWER' ? 'Reviewer' : 'Tester'}. Select the matching sign-in method.`); return; } login(authenticatedUser); nav(authenticatedUser.role === 'REVIEWER' ? '/reviewer/dashboard' : '/tester/dashboard'); } catch (error: any) { setError(error.response?.data?.message || 'Unable to sign in.'); } finally { setBusy(false); } }}><RoleSegment label="Sign in as" value={role} onChange={setRole} /><Field label="Email address" value={email} onChange={setEmail} placeholder="you@organisation.gov" icon={<Mail />} /><Password label="Password" value={password} onChange={setPassword} placeholder="Enter your password" />{error && <div className="error" role="alert">{error}</div>}<div className="row"><Link to="/forgot-password">Forgot password?</Link></div><button className="primary" disabled={busy} aria-busy={busy}>{busy ? 'Signing in…' : 'Sign in'}<ChevronRight /></button><p className="switch">New to the system? <Link to="/signup">Create an account</Link></p></form></AuthLayout>;
}
function DemoAccess() {
  const { login } = useAuth(); const nav = useNavigate(); const [open, setOpen] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const enter = async (role: 'TESTER' | 'REVIEWER') => { setBusy(true); setError(''); try { const response = await axios.post('/auth/demo-login', { role }); const user = response.data.user as User; login(user); nav(user.role === 'REVIEWER' ? '/reviewer/dashboard' : '/tester/dashboard'); } catch (cause: any) { setError(cause.response?.data?.message || 'Unable to open demo workspace.'); } finally { setBusy(false); } };
  return <><button type="button" className="demo-entry" onClick={() => setOpen(true)}><span>TRY DEMO</span><small>Explore the NAWI workspace</small><ChevronRight size={18} /></button>{open && <div className="demo-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !busy) setOpen(false); }}><section className="demo-modal" role="dialog" aria-modal="true" aria-labelledby="demo-title"><button type="button" className="demo-modal-close" aria-label="Close demo selection" onClick={() => setOpen(false)} disabled={busy}>×</button><span className="eyebrow">NAWI · DEMO WORKSPACE</span><h2 id="demo-title">Choose your workspace</h2><p>Open the existing application with isolated demo data. No credentials needed.</p><div className="demo-role-options"><button type="button" disabled={busy} onClick={() => void enter('TESTER')}><strong>Demo Tester</strong><small>Register and test instruments</small><ChevronRight size={18} /></button><button type="button" disabled={busy} onClick={() => void enter('REVIEWER')}><strong>Demo Reviewer</strong><small>Review demo tester submissions</small><ChevronRight size={18} /></button></div>{busy && <p className="demo-status" role="status">Opening secure demo session…</p>}{error && <div className="error" role="alert">{error}</div>}</section></div>}</>;
}
function RoleSegment({ label, value, onChange }: { label: string; value: 'TESTER' | 'REVIEWER'; onChange: (value: 'TESTER' | 'REVIEWER') => void }) {
  const roleDescription = value === 'TESTER' ? 'Tester workspace · test execution' : 'Reviewer workspace · authority review';
  return <fieldset className={`role-segment role-${value.toLowerCase()}`}>
    <legend>{label}</legend>
    <div role="group" aria-label={label}>
      {(['TESTER', 'REVIEWER'] as const).map(option => <button type="button" key={option} className={value === option ? 'selected' : ''} aria-pressed={value === option} onClick={() => onChange(option)}>{option === 'TESTER' ? 'Tester' : 'Reviewer'}</button>)}
    </div>
    <span className="role-segment-caption" aria-live="polite">{roleDescription}</span>
  </fieldset>;
}
function Signup() {
  const { login } = useAuth(); const nav = useNavigate(); const [values, setValues] = useState({ firstName: '', lastName: '', email: '', password: '', confirm: '', role: 'TESTER' as 'TESTER' | 'REVIEWER' }); const [terms, setTerms] = useState(false); const [error, setError] = useState(''); const set = (key: keyof typeof values, value: string) => setValues(current => ({ ...current, [key]: value }));
  return <AuthLayout scroll title="Create your account" subtitle="Set up your account to begin working with NAWI test records and reports."><form onSubmit={async event => { event.preventDefault(); if (values.password !== values.confirm) return setError('Passwords do not match.'); if (!terms) return setError('Please accept the Terms and Conditions.'); try { const response = await axios.post('/auth/register', { ...values, terms }); login(response.data.user); nav(values.role === 'REVIEWER' ? '/reviewer/dashboard' : '/tester/dashboard'); } catch (error: any) { setError(error.response?.data?.message || 'Unable to create account.'); } }}><div className="twocol"><Field label="First name" value={values.firstName} onChange={value => set('firstName', value)} /><Field label="Last name" value={values.lastName} onChange={value => set('lastName', value)} /></div><Field label="Email address" value={values.email} onChange={value => set('email', value)} placeholder="you@organisation.gov" icon={<Mail />} /><RoleSegment label="Account type" value={values.role} onChange={role => set('role', role)} /><Password label="Password" value={values.password} onChange={value => set('password', value)} placeholder="Create a password" /><Password label="Confirm password" value={values.confirm} onChange={value => set('confirm', value)} placeholder="Repeat your password" /><small className="hint">Use at least 8 characters with a mix of letters and numbers.</small><label className="check"><input type="checkbox" checked={terms} onChange={event => setTerms(event.target.checked)} /> I agree to the Terms and Conditions</label>{error && <div className="error">{error}</div>}<button className="primary">Create account<ChevronRight /></button><p className="switch">Already have an account? <Link to="/login">Sign in</Link></p></form></AuthLayout>;
}
function SimpleAuth() { const [email, setEmail] = useState(''); const [message, setMessage] = useState(''); return <AuthLayout scroll title="Recover your account" subtitle="We’ll help you get back into your NAWI workspace."><form onSubmit={async event => { event.preventDefault(); const response = await axios.post('/auth/forgot-password', { email }); setMessage(response.data?.message || 'Request completed.'); }}><Field label="Email address" value={email} onChange={setEmail} placeholder="you@organisation.gov" icon={<Mail />} />{message && <div className="success">{message}</div>}<button className="primary">Send reset instructions<ChevronRight /></button><p className="switch"><Link to="/login">Back to sign in</Link></p></form></AuthLayout>; }

const navItems = [['Dashboard', LayoutDashboard, '/tester/dashboard'], ['Test Reports', Files, '/tester/reports'], ['Instruments', Weight, '/tester/instruments'], ['History', History, '/tester/history']] as const;
function AppShell({ children }: { children: React.ReactNode }) { const { user, logout } = useAuth(); const location = useLocation(); const shellHeading = location.pathname.startsWith('/tester/instruments') ? 'Instruments' : location.pathname.startsWith('/tester/history') ? 'History' : location.pathname.startsWith('/tester/reports') ? 'Test Reports' : 'Dashboard'; return <div className="app-shell"><aside><div className="side-brand"><Link className="side-logo-link" to="/tester/dashboard" aria-label="Tester dashboard" title="Tester dashboard"><Logo dark /></Link><small>TEST &amp; REPORT SYSTEM</small></div><nav className="side-nav">{navItems.map(([label, Icon, to]) => <Link className={location.pathname === to || (to !== '/tester/dashboard' && location.pathname.startsWith(`${to}/`)) ? 'active' : ''} to={to} key={label}><Icon size={18} />{label}</Link>)}<TesterNotifications compact /></nav><div className="side-user"><div className="avatar">{user?.firstName[0]}{user?.lastName[0]}</div><div><b>{user?.firstName} {user?.lastName}</b><small>TESTER</small></div><button aria-label="Sign out" onClick={logout}><LogOut size={16} /></button></div></aside><div className="app-main"><header className="app-top"><div><span className="crumb">TESTER WORKSPACE</span><h2>{shellHeading}</h2></div><div className="top-user"><span>{user?.firstName} {user?.lastName}</span><span className="badge">TESTER</span><TesterNotifications /><button className="logout" onClick={logout}><LogOut size={15} /> Sign out</button></div></header>{children}</div></div>; }
function TesterPage({ children }: { children: React.ReactNode }) { const { user, loading } = useAuth(); if (loading) return <div className="loading">Loading secure workspace…</div>; if (!user) return <Navigate to="/login" />; if (user.role !== 'TESTER') return <Navigate to="/" />; return <>{children}</>; }
function Guard({ role, children }: { role: Role; children?: React.ReactNode }) { const { user, loading } = useAuth(); if (loading) return <div className="loading">Loading secure workspace…</div>; if (!user) return <Navigate to="/login" />; if (user.role !== role) return <Navigate to="/" />; if (children) return role === 'REVIEWER' ? <ReviewerRoute reviewerId={user.id}>{children}</ReviewerRoute> : <>{children}</>; return role === 'TESTER' ? <AppShell><TesterDashboardWorkspace user={user} /></AppShell> : <ReviewerRoute reviewerId={user.id}><main className="dashboard"><h1>{role} workspace</h1></main></ReviewerRoute>; }
function ReviewerRoute({ children, reviewerId }: { children: React.ReactNode; reviewerId?: string }) { const { user, logout } = useAuth(); const reviewerChild = React.isValidElement(children) ? React.cloneElement(children as React.ReactElement<any>, { reviewerId }) : children; return <ReviewerShell user={user} logout={logout}>{reviewerChild}</ReviewerShell>; }
function Home() { const { user } = useAuth(); return user ? <Navigate to={`/${user.role.toLowerCase()}/dashboard`} /> : <Navigate to="/login" />; }
 function App() { return <Provider><Routes><Route path="/login" element={<Login />} /><Route path="/signup" element={<Signup />} /><Route path="/forgot-password" element={<SimpleAuth />} /><Route path="/reset-password" element={<SimpleAuth />} /><Route path="/mobile/evidence/:token" element={<MobileEvidencePage />} /><Route path="/tester/dashboard" element={<Guard role="TESTER" />} /><Route path="/tester/notifications" element={<TesterPage><AppShell><TesterNotificationsPage /></AppShell></TesterPage>} /><Route path="/tester/instruments" element={<TesterPage><AppShell><InstrumentRepository /></AppShell></TesterPage>} /><Route path="/tester/instruments/new" element={<TesterPage><AppShell><InstrumentRegistration /></AppShell></TesterPage>} /><Route path="/tester/instruments/:instrumentId/edit" element={<TesterPage><AppShell><InstrumentEdit /></AppShell></TesterPage>} /><Route path="/tester/instruments/:instrumentId" element={<TesterPage><InstrumentRecordPage /></TesterPage>} /><Route path="/tester/sessions" element={<Guard role="TESTER" />} /><Route path="/tester/reports" element={<TesterPage><AppShell><TesterReports /></AppShell></TesterPage>} /><Route path="/tester/new-report" element={<TesterPage><TestReportWorkflow /></TesterPage>} /><Route path="/tester/reports/:reportId/edit" element={<TesterPage><ReportApplicationEdit /></TesterPage>} /><Route path="/tester/reports/:reportId/laboratory" element={<TesterPage><LaboratoryEnvironmentWorkspace /></TesterPage>} /><Route path="/tester/reports/:reportId/testing" element={<TesterPage><TestRouteWorkspace /></TesterPage>} /><Route path="/tester/reports/:reportId/influence-factors" element={<TesterPage><InfluenceFactorsWorkspace /></TesterPage>} /><Route path="/tester/reports/:reportId/endurance" element={<TesterPage><EnduranceWorkspace /></TesterPage>} /><Route path="/tester/reports/:reportId/testing/a5" element={<TesterPage><InfluenceFactorsWorkspace /></TesterPage>} /><Route path="/tester/reports/:reportId/testing/a4-2" element={<TesterPage><ZeroCheckingWorkspace /></TesterPage>} /><Route path="/tester/reports/:reportId/testing/a4-3" element={<TesterPage><ZeroSettingBeforeLoadingWorkspace /></TesterPage>} /><Route path="/tester/reports/:reportId/testing/a4-4" element={<TesterPage><PerformanceWorkspace /></TesterPage>} /><Route path="/tester/reports/:reportId/testing/a4-5" element={<TesterPage><MultipleIndicatingDevicesWorkspace /></TesterPage>} /><Route path="/tester/reports/:reportId/testing/a4-6" element={<TesterPage><TareWorkspace /></TesterPage>} /><Route path="/tester/reports/:reportId/testing/a4-7" element={<TesterPage><EccentricityWorkspace /></TesterPage>} /><Route path="/tester/reports/:reportId/testing/a4-8" element={<TesterPage><DiscriminationWorkspace /></TesterPage>} /><Route path="/tester/reports/:reportId/testing/a4-9" element={<TesterPage><SensitivityWorkspace /></TesterPage>} /><Route path="/tester/reports/:reportId/testing/a4-10" element={<TesterPage><RepeatabilityWorkspace /></TesterPage>} /><Route path="/tester/reports/:reportId/testing/a4-11" element={<TesterPage><VariationWithTimeWorkspace /></TesterPage>} /><Route path="/tester/reports/:reportId/testing/a4-12" element={<TesterPage><StabilityOfEquilibriumWorkspace /></TesterPage>} /><Route path="/tester/reports/:reportId/test-conditions" element={<TesterPage><CompleteTestConditionsWorkspace /></TesterPage>} /><Route path="/tester/reports/:reportId/review" element={<TesterPage><FinalReportWorkspace /></TesterPage>} /><Route path="/tester/reports/:reportId/final-report" element={<TesterPage><FinalReportWorkspace /></TesterPage>} /><Route path="/tester/reports/:reportId" element={<TesterPage><VerificationWorkspace /></TesterPage>} /><Route path="/tester/history" element={<TesterPage><AppShell><HistoryPage /></AppShell></TesterPage>} /><Route path="/reviewer/dashboard" element={<Guard role="REVIEWER"><ReviewerDashboard /></Guard>} /><Route path="/reviewer/reports" element={<Guard role="REVIEWER"><ReviewerDashboard /></Guard>} /><Route path="/reviewer/reports/:reportId/tests/:testCode" element={<Guard role="REVIEWER"><ReviewerTestDetail /></Guard>} /><Route path="/reviewer/reports/:reportId" element={<Guard role="REVIEWER"><ReviewerReportDetail /></Guard>} /><Route path="/reviewer/testers" element={<Guard role="REVIEWER"><ReviewerTesterDirectory /></Guard>} /><Route path="/reviewer/evidence" element={<Guard role="REVIEWER"><ReviewerEvidenceGallery /></Guard>} /><Route path="/authority/dashboard" element={<Guard role="REVIEWER"><Navigate to="/reviewer/dashboard" replace /></Guard>} /><Route path="/authority/reports" element={<Guard role="REVIEWER"><Navigate to="/reviewer/reports" replace /></Guard>} /><Route path="/authority/reports/:reportId" element={<Guard role="REVIEWER"><Navigate to="/reviewer/reports/:reportId" replace /></Guard>} /><Route path="/authority/evidence" element={<Guard role="REVIEWER"><Navigate to="/reviewer/evidence" replace /></Guard>} /><Route path="/admin/dashboard" element={<Guard role="ADMIN" />} /><Route path="*" element={<Home />} /></Routes></Provider>; }
type NawiHotContext = { data: { root?: ReturnType<typeof createRoot> } };
const hot = (import.meta as ImportMeta & { hot?: NawiHotContext }).hot;
const rootElement = document.getElementById('root')!;
const windowWithRoot = window as Window & { __nawiReactRoot?: ReturnType<typeof createRoot> };
const root = windowWithRoot.__nawiReactRoot ?? hot?.data.root ?? createRoot(rootElement);
windowWithRoot.__nawiReactRoot = root;
if (hot) hot.data.root = root;
root.render(<BrowserRouter><App /></BrowserRouter>);
