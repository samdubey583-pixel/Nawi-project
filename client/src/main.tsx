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
import { HistoryPage, InstrumentDetail, InstrumentEdit, InstrumentRegistration, InstrumentRepository } from './features/instruments/InstrumentRepository';
import './styles.css';
import './features/dashboard.css';
import './features/ambient/ambient-shapes.css';
import './features/primary-actions.css';
import TesterDashboardWorkspace from './features/dashboard/TesterDashboardWorkspace';
import MobileEvidencePage from './features/evidence/MobileEvidencePage';
import './features/evidence/evidence.css';
import ReviewerDashboard from './features/reviewer/ReviewerDashboard';
import ReviewerReportDetail from './features/reviewer/ReviewerReportDetail';
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

function Logo({ dark = false, animated = false }: { dark?: boolean; animated?: boolean }) {
  const leftPan = useRef<SVGGElement>(null);
  const rightPan = useRef<SVGGElement>(null);
  useEffect(() => {
    if (!animated) return;
    const motionScale = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? .55 : 1;
    let frame = 0;
    const animate = (time: number) => {
      const lift = Math.sin(time / 520) * 3.2 * motionScale;
      if (leftPan.current) leftPan.current.style.transform = `translateY(${lift}px) rotate(${lift * .28}deg)`;
      if (rightPan.current) rightPan.current.style.transform = `translateY(${-lift}px) rotate(${-lift * .28}deg)`;
      frame = window.requestAnimationFrame(animate);
    };
    frame = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frame);
  }, [animated]);
  return <div className={`logo ${dark ? 'dark' : ''} ${animated ? 'animated-balance' : ''}`}><svg viewBox="0 0 40 34" aria-hidden="true"><path d="M20 4v22M7 9h26M10 27h20M14 30h12" /><g ref={leftPan} className="balance-pan balance-pan-left"><path d="M7 9l-5 11h10L7 9Z" /></g><g ref={rightPan} className="balance-pan balance-pan-right"><path d="M33 9l-5 11h10L33 9Z" /></g></svg><span>NAWI</span></div>;
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
  return <main className={`page ${scroll ? 'auth-scroll' : ''}`} onMouseMove={moveCard} onMouseLeave={resetCard}><AmbientShapes variant="login" /><header className="site-header"><Link className="auth-logo-link" to="/login"><Logo dark animated /></Link><span className="pill">OIML R-76</span><span className="header-product">Test &amp; Report System</span></header><section className="auth-card" style={style}><section className="hero-panel"><p className="eyebrow">NAWI TEST &amp; REPORT SYSTEM</p><h2>Precision in<br />every<br /><em>measurement.</em></h2><p className="hero-copy">Build, manage and review test records with confidence. A modern platform for OIML R-76 compliance.</p><div className="feature-row"><span>Trusted<br />Records</span><span>Transparent<br />Process</span><span>Global<br />Standards</span></div><div className="hero-foot">OIML R-76 • Legal Metrology • Digital Workflow</div></section><section className="form-panel"><div className="form-content"><div className="blue-rule" /><h1>{title}</h1><p className="sub">{subtitle}</p>{children}</div></section></section><footer>© 2026 NAWI | Legal Metrology | Digital Workflow</footer></main>;
}
function Login() {
  const { login } = useAuth(); const nav = useNavigate(); const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  return <AuthLayout title="Welcome back" subtitle="Sign in to your NAWI workspace"><form onSubmit={async event => { event.preventDefault(); setBusy(true); try { const response = await axios.post('/auth/login', { email, password }); login(response.data.user); nav('/'); } catch (error: any) { setError(error.response?.data?.message || 'Unable to sign in.'); } finally { setBusy(false); } }}><Field label="Email address" value={email} onChange={setEmail} placeholder="you@organisation.gov" icon={<Mail />} /><Password label="Password" value={password} onChange={setPassword} placeholder="Enter your password" />{error && <div className="error">{error}</div>}<div className="row"><Link to="/forgot-password">Forgot password?</Link></div><button className="primary" disabled={busy} aria-busy={busy}>{busy ? 'Signing in…' : 'Sign in'}<ChevronRight /></button><p className="switch">New to the system? <Link to="/signup">Create an account</Link></p></form></AuthLayout>;
}
function Signup() {
  const { login } = useAuth(); const nav = useNavigate(); const [values, setValues] = useState({ firstName: '', lastName: '', email: '', password: '', confirm: '' }); const [terms, setTerms] = useState(false); const [error, setError] = useState(''); const set = (key: keyof typeof values, value: string) => setValues(current => ({ ...current, [key]: value }));
  return <AuthLayout scroll title="Create your account" subtitle="Set up your account to begin working with NAWI test records and reports."><form onSubmit={async event => { event.preventDefault(); if (values.password !== values.confirm) return setError('Passwords do not match.'); if (!terms) return setError('Please accept the Terms and Conditions.'); try { const response = await axios.post('/auth/register', { ...values, terms }); login(response.data.user); nav('/'); } catch (error: any) { setError(error.response?.data?.message || 'Unable to create account.'); } }}><div className="twocol"><Field label="First name" value={values.firstName} onChange={value => set('firstName', value)} /><Field label="Last name" value={values.lastName} onChange={value => set('lastName', value)} /></div><Field label="Email address" value={values.email} onChange={value => set('email', value)} placeholder="you@organisation.gov" icon={<Mail />} /><Password label="Password" value={values.password} onChange={value => set('password', value)} placeholder="Create a password" /><Password label="Confirm password" value={values.confirm} onChange={value => set('confirm', value)} placeholder="Repeat your password" /><small className="hint">Use at least 8 characters with a mix of letters and numbers.</small><label className="check"><input type="checkbox" checked={terms} onChange={event => setTerms(event.target.checked)} /> I agree to the Terms and Conditions</label>{error && <div className="error">{error}</div>}<button className="primary">Create account<ChevronRight /></button><p className="switch">Already have an account? <Link to="/login">Sign in</Link></p></form></AuthLayout>;
}
function SimpleAuth() { const [email, setEmail] = useState(''); const [message, setMessage] = useState(''); return <AuthLayout scroll title="Recover your account" subtitle="We’ll help you get back into your NAWI workspace."><form onSubmit={async event => { event.preventDefault(); const response = await axios.post('/auth/forgot-password', { email }); setMessage(response.data?.message || 'Request completed.'); }}><Field label="Email address" value={email} onChange={setEmail} placeholder="you@organisation.gov" icon={<Mail />} />{message && <div className="success">{message}</div>}<button className="primary">Send reset instructions<ChevronRight /></button><p className="switch"><Link to="/login">Back to sign in</Link></p></form></AuthLayout>; }

const navItems = [['Dashboard', LayoutDashboard, '/tester/dashboard'], ['Test Reports', Files, '/tester/reports'], ['Instruments', Weight, '/tester/instruments'], ['History', History, '/tester/history']] as const;
function AppShell({ children }: { children: React.ReactNode }) { const { user, logout } = useAuth(); const location = useLocation(); const shellHeading = location.pathname.startsWith('/tester/instruments') ? 'Instruments' : location.pathname.startsWith('/tester/history') ? 'History' : location.pathname.startsWith('/tester/reports') ? 'Test Reports' : 'Dashboard'; return <div className="app-shell"><aside><div className="side-brand"><Link className="side-logo-link" to="/login"><Logo dark /></Link><small>TEST &amp; REPORT SYSTEM</small></div><nav className="side-nav">{navItems.map(([label, Icon, to]) => <Link className={location.pathname === to || (to !== '/tester/dashboard' && location.pathname.startsWith(`${to}/`)) ? 'active' : ''} to={to} key={label}><Icon size={18} />{label}</Link>)}</nav><div className="side-user"><div className="avatar">{user?.firstName[0]}{user?.lastName[0]}</div><div><b>{user?.firstName} {user?.lastName}</b><small>TESTER</small></div><button aria-label="Sign out" onClick={logout}><LogOut size={16} /></button></div></aside><div className="app-main"><header className="app-top"><div><span className="crumb">TESTER WORKSPACE</span><h2>{shellHeading}</h2></div><div className="top-user"><span>{user?.firstName} {user?.lastName}</span><span className="badge">TESTER</span><button className="logout" onClick={logout}><LogOut size={15} /> Sign out</button></div></header>{children}</div></div>; }
function TesterPage({ children }: { children: React.ReactNode }) { const { user, loading } = useAuth(); if (loading) return <div className="loading">Loading secure workspace…</div>; if (!user) return <Navigate to="/login" />; if (user.role !== 'TESTER') return <Navigate to="/" />; return <>{children}</>; }
function Guard({ role, children }: { role: Role; children?: React.ReactNode }) { const { user, loading } = useAuth(); if (loading) return <div className="loading">Loading secure workspace…</div>; if (!user) return <Navigate to="/login" />; if (user.role !== role) return <Navigate to="/" />; if (children) return <>{children}</>; return role === 'TESTER' ? <AppShell><TesterDashboardWorkspace user={user} /></AppShell> : <AppShell><main className="dashboard"><h1>{role} workspace</h1></main></AppShell>; }
function Home() { const { user } = useAuth(); return user ? <Navigate to={`/${user.role.toLowerCase()}/dashboard`} /> : <Navigate to="/login" />; }
 function App() { return <Provider><Routes><Route path="/login" element={<Login />} /><Route path="/signup" element={<Signup />} /><Route path="/forgot-password" element={<SimpleAuth />} /><Route path="/reset-password" element={<SimpleAuth />} /><Route path="/mobile/evidence/:token" element={<MobileEvidencePage />} /><Route path="/tester/dashboard" element={<Guard role="TESTER" />} /><Route path="/tester/instruments" element={<TesterPage><AppShell><InstrumentRepository /></AppShell></TesterPage>} /><Route path="/tester/instruments/new" element={<TesterPage><AppShell><InstrumentRegistration /></AppShell></TesterPage>} /><Route path="/tester/instruments/:instrumentId/edit" element={<TesterPage><AppShell><InstrumentEdit /></AppShell></TesterPage>} /><Route path="/tester/instruments/:instrumentId" element={<TesterPage><AppShell><InstrumentDetail /></AppShell></TesterPage>} /><Route path="/tester/sessions" element={<Guard role="TESTER" />} /><Route path="/tester/reports" element={<TesterPage><AppShell><TesterReports /></AppShell></TesterPage>} /><Route path="/tester/new-report" element={<TesterPage><TestReportWorkflow /></TesterPage>} /><Route path="/tester/reports/:reportId/edit" element={<TesterPage><ReportApplicationEdit /></TesterPage>} /><Route path="/tester/reports/:reportId/laboratory" element={<TesterPage><LaboratoryEnvironmentWorkspace /></TesterPage>} /><Route path="/tester/reports/:reportId/testing" element={<TesterPage><TestRouteWorkspace /></TesterPage>} /><Route path="/tester/reports/:reportId/influence-factors" element={<TesterPage><InfluenceFactorsWorkspace /></TesterPage>} /><Route path="/tester/reports/:reportId/endurance" element={<TesterPage><EnduranceWorkspace /></TesterPage>} /><Route path="/tester/reports/:reportId/testing/a5" element={<TesterPage><InfluenceFactorsWorkspace /></TesterPage>} /><Route path="/tester/reports/:reportId/testing/a4-2" element={<TesterPage><ZeroCheckingWorkspace /></TesterPage>} /><Route path="/tester/reports/:reportId/testing/a4-3" element={<TesterPage><ZeroSettingBeforeLoadingWorkspace /></TesterPage>} /><Route path="/tester/reports/:reportId/testing/a4-4" element={<TesterPage><PerformanceWorkspace /></TesterPage>} /><Route path="/tester/reports/:reportId/testing/a4-5" element={<TesterPage><MultipleIndicatingDevicesWorkspace /></TesterPage>} /><Route path="/tester/reports/:reportId/testing/a4-6" element={<TesterPage><TareWorkspace /></TesterPage>} /><Route path="/tester/reports/:reportId/testing/a4-7" element={<TesterPage><EccentricityWorkspace /></TesterPage>} /><Route path="/tester/reports/:reportId/testing/a4-8" element={<TesterPage><DiscriminationWorkspace /></TesterPage>} /><Route path="/tester/reports/:reportId/testing/a4-9" element={<TesterPage><SensitivityWorkspace /></TesterPage>} /><Route path="/tester/reports/:reportId/testing/a4-10" element={<TesterPage><RepeatabilityWorkspace /></TesterPage>} /><Route path="/tester/reports/:reportId/testing/a4-11" element={<TesterPage><VariationWithTimeWorkspace /></TesterPage>} /><Route path="/tester/reports/:reportId/testing/a4-12" element={<TesterPage><StabilityOfEquilibriumWorkspace /></TesterPage>} /><Route path="/tester/reports/:reportId/test-conditions" element={<TesterPage><CompleteTestConditionsWorkspace /></TesterPage>} /><Route path="/tester/reports/:reportId/review" element={<TesterPage><FinalReportWorkspace /></TesterPage>} /><Route path="/tester/reports/:reportId/final-report" element={<TesterPage><FinalReportWorkspace /></TesterPage>} /><Route path="/tester/reports/:reportId" element={<TesterPage><VerificationWorkspace /></TesterPage>} /><Route path="/tester/history" element={<TesterPage><AppShell><HistoryPage /></AppShell></TesterPage>} /><Route path="/reviewer/dashboard" element={<Guard role="REVIEWER"><ReviewerDashboard /></Guard>} /><Route path="/reviewer/reports/:reportId" element={<Guard role="REVIEWER"><ReviewerReportDetail /></Guard>} /><Route path="/admin/dashboard" element={<Guard role="ADMIN" />} /><Route path="*" element={<Home />} /></Routes></Provider>; }
type NawiHotContext = { data: { root?: ReturnType<typeof createRoot> } };
const hot = (import.meta as ImportMeta & { hot?: NawiHotContext }).hot;
const rootElement = document.getElementById('root')!;
const windowWithRoot = window as Window & { __nawiReactRoot?: ReturnType<typeof createRoot> };
const root = windowWithRoot.__nawiReactRoot ?? hot?.data.root ?? createRoot(rootElement);
windowWithRoot.__nawiReactRoot = root;
if (hot) hot.data.root = root;
root.render(<BrowserRouter><App /></BrowserRouter>);
