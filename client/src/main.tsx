import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import axios from 'axios';
import { BrowserRouter, useNavigate, Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import { LogOut, LayoutDashboard, Weight, ClipboardCheck, Files, History, Search, Plus, ChevronRight, ArrowRight, FileText, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import TestReportWorkflow from './features/test-reports/TestReportWorkflow';
import TesterReports from './features/verification/TesterReports';
import VerificationWorkspace from './features/verification/VerificationWorkspace';
import PerformanceWorkspace from './features/performance/PerformanceWorkspace';
import FinalReportWorkspace from './features/test-reports/FinalReportWorkspace';
import LaboratoryEnvironmentWorkspace from './features/test-reports/LaboratoryEnvironmentWorkspace';
import CompleteTestConditionsWorkspace from './features/test-reports/CompleteTestConditionsWorkspace';
import TestRouteWorkspace from './features/test-reports/TestRouteWorkspace';
import ZeroCheckingWorkspace from './features/zero-checking/ZeroCheckingWorkspace';
import ZeroSettingBeforeLoadingWorkspace from './features/zero-setting/ZeroSettingBeforeLoadingWorkspace';
import { HistoryPage, InstrumentDetail, InstrumentEdit, InstrumentRegistration, InstrumentRepository } from './features/instruments/InstrumentRepository';
import './styles.css';

axios.defaults.baseURL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
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
  const shapeRefs = useRef<Array<HTMLSpanElement | null>>([]);
  useEffect(() => {
    const motionScale = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? .55 : 1;
    let frame = 0;
    const animateAtmosphere = (time: number) => {
      const seconds = time / 1000;
      const motions = [
        [Math.sin(seconds * .78) * 70 + Math.cos(seconds * .36) * 18, Math.cos(seconds * .64) * 55, Math.sin(seconds * .28) * 5, 1 + Math.sin(seconds * .42) * .035],
        [Math.cos(seconds * .61) * 62, Math.sin(seconds * .73) * 70 + Math.cos(seconds * .29) * 15, Math.cos(seconds * .31) * 6, 1 + Math.cos(seconds * .38) * .045],
        [Math.sin(seconds * .52) * 76, Math.cos(seconds * .67) * 54, Math.sin(seconds * .24) * 4, 1 + Math.sin(seconds * .33) * .04],
        [Math.cos(seconds * .88) * 45, Math.sin(seconds * .58) * 42, Math.sin(seconds * .45) * 7, 1 + Math.cos(seconds * .52) * .06],
      ];
      shapeRefs.current.forEach((shape, index) => {
        if (!shape) return;
        const [x, y, rotation, scale] = motions[index];
        shape.style.transform = `translate3d(${x * motionScale}px, ${y * motionScale}px, 0) rotate(${rotation * motionScale}deg) scale(${1 + ((scale - 1) * motionScale)})`;
      });
      frame = window.requestAnimationFrame(animateAtmosphere);
    };
    frame = window.requestAnimationFrame(animateAtmosphere);
    return () => window.cancelAnimationFrame(frame);
  }, []);
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
  return <main className={`page ${scroll ? 'auth-scroll' : ''}`} onMouseMove={moveCard} onMouseLeave={resetCard}><div className="auth-ambient" aria-hidden="true"><span ref={node => { shapeRefs.current[0] = node; }} className="auth-shape auth-shape-one" /><span ref={node => { shapeRefs.current[1] = node; }} className="auth-shape auth-shape-two" /><span ref={node => { shapeRefs.current[2] = node; }} className="auth-shape auth-shape-three" /><span ref={node => { shapeRefs.current[3] = node; }} className="auth-shape auth-shape-four" /></div><header className="site-header"><Link className="auth-logo-link" to="/login"><Logo dark animated /></Link><span className="pill">OIML R-76</span><span className="header-product">Test &amp; Report System</span></header><section className="auth-card" style={style}><section className="hero-panel"><p className="eyebrow">NAWI TEST &amp; REPORT SYSTEM</p><h2>Precision in<br />every<br /><em>measurement.</em></h2><p className="hero-copy">Build, manage and review test records with confidence. A modern platform for OIML R-76 compliance.</p><div className="feature-row"><span>Trusted<br />Records</span><span>Transparent<br />Process</span><span>Global<br />Standards</span></div><div className="hero-foot">OIML R-76 • Legal Metrology • Digital Workflow</div></section><section className="form-panel"><div className="form-content"><div className="blue-rule" /><h1>{title}</h1><p className="sub">{subtitle}</p>{children}</div></section></section><footer>© 2026 NAWI | Legal Metrology | Digital Workflow</footer></main>;
}
function Login() {
  const { login } = useAuth(); const nav = useNavigate(); const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  return <AuthLayout title="Welcome back" subtitle="Sign in to your NAWI workspace"><form onSubmit={async event => { event.preventDefault(); setBusy(true); try { const response = await axios.post('/auth/login', { email, password }); login(response.data.user); nav('/'); } catch (error: any) { setError(error.response?.data?.message || 'Unable to sign in.'); } finally { setBusy(false); } }}><Field label="Email address" value={email} onChange={setEmail} placeholder="you@organisation.gov" icon={<Mail />} /><Password label="Password" value={password} onChange={setPassword} placeholder="Enter your password" />{error && <div className="error">{error}</div>}<div className="row"><Link to="/forgot-password">Forgot password?</Link></div><button className="primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}<ChevronRight /></button><p className="switch">New to the system? <Link to="/signup">Create an account</Link></p></form></AuthLayout>;
}
function Signup() {
  const { login } = useAuth(); const nav = useNavigate(); const [values, setValues] = useState({ firstName: '', lastName: '', email: '', password: '', confirm: '' }); const [terms, setTerms] = useState(false); const [error, setError] = useState(''); const set = (key: keyof typeof values, value: string) => setValues(current => ({ ...current, [key]: value }));
  return <AuthLayout scroll title="Create your account" subtitle="Set up your account to begin working with NAWI test records and reports."><form onSubmit={async event => { event.preventDefault(); if (values.password !== values.confirm) return setError('Passwords do not match.'); if (!terms) return setError('Please accept the Terms and Conditions.'); try { const response = await axios.post('/auth/register', { ...values, terms }); login(response.data.user); nav('/'); } catch (error: any) { setError(error.response?.data?.message || 'Unable to create account.'); } }}><div className="twocol"><Field label="First name" value={values.firstName} onChange={value => set('firstName', value)} /><Field label="Last name" value={values.lastName} onChange={value => set('lastName', value)} /></div><Field label="Email address" value={values.email} onChange={value => set('email', value)} placeholder="you@organisation.gov" icon={<Mail />} /><Password label="Password" value={values.password} onChange={value => set('password', value)} placeholder="Create a password" /><Password label="Confirm password" value={values.confirm} onChange={value => set('confirm', value)} placeholder="Repeat your password" /><small className="hint">Use at least 8 characters with a mix of letters and numbers.</small><label className="check"><input type="checkbox" checked={terms} onChange={event => setTerms(event.target.checked)} /> I agree to the Terms and Conditions</label>{error && <div className="error">{error}</div>}<button className="primary">Create account<ChevronRight /></button><p className="switch">Already have an account? <Link to="/login">Sign in</Link></p></form></AuthLayout>;
}
function SimpleAuth() { const [email, setEmail] = useState(''); const [message, setMessage] = useState(''); return <AuthLayout scroll title="Recover your account" subtitle="We’ll help you get back into your NAWI workspace."><form onSubmit={async event => { event.preventDefault(); const response = await axios.post('/auth/forgot-password', { email }); setMessage(response.data?.message || 'Request completed.'); }}><Field label="Email address" value={email} onChange={setEmail} placeholder="you@organisation.gov" icon={<Mail />} />{message && <div className="success">{message}</div>}<button className="primary">Send reset instructions<ChevronRight /></button><p className="switch"><Link to="/login">Back to sign in</Link></p></form></AuthLayout>; }

const navItems = [['Dashboard', LayoutDashboard, '/tester/dashboard'], ['Test Reports', Files, '/tester/reports'], ['Instruments', Weight, '/tester/instruments'], ['History', History, '/tester/history']] as const;
function AppShell({ children }: { children: React.ReactNode }) { const { user, logout } = useAuth(); const location = useLocation(); const shellHeading = location.pathname.startsWith('/tester/instruments') ? 'Instruments' : location.pathname.startsWith('/tester/history') ? 'History' : location.pathname.startsWith('/tester/reports') ? 'Test Reports' : 'Dashboard'; return <div className="app-shell"><aside><div className="side-brand"><Link className="side-logo-link" to="/login"><Logo dark /></Link><small>TEST &amp; REPORT SYSTEM</small></div><nav className="side-nav">{navItems.map(([label, Icon, to]) => <Link className={location.pathname === to || (to !== '/tester/dashboard' && location.pathname.startsWith(`${to}/`)) ? 'active' : ''} to={to} key={label}><Icon size={18} />{label}</Link>)}</nav><div className="side-user"><div className="avatar">{user?.firstName[0]}{user?.lastName[0]}</div><div><b>{user?.firstName} {user?.lastName}</b><small>TESTER</small></div><button aria-label="Sign out" onClick={logout}><LogOut size={16} /></button></div></aside><div className="app-main"><header className="app-top"><div><span className="crumb">TESTER WORKSPACE</span><h2>{shellHeading}</h2></div><div className="top-user"><span>{user?.firstName} {user?.lastName}</span><span className="badge">TESTER</span><button className="logout" onClick={logout}><LogOut size={15} /> Sign out</button></div></header>{children}</div></div>; }
function Empty({ icon, title, copy, action }: { icon: React.ReactNode; title: string; copy: string; action: string }) { return <div className="empty"><div className="empty-icon">{icon}</div><b>{title}</b><p>{copy}</p><button className="secondary"><Plus size={15} />{action}</button></div>; }
function Stat({ icon, label }: { icon: React.ReactNode; label: string }) { return <div className="stat"><div className="stat-icon">{icon}</div><strong>0</strong><span>{label}</span></div>; }
function TesterDashboard() { const { user } = useAuth(); return <AppShell><main className="dashboard"><div className="welcome-row"><div><span className="crumb">OVERVIEW</span><h1>Good morning, {user?.firstName}</h1><p>Manage your NAWI testing workflow, instruments and reports from one workspace.</p></div><div className="welcome-actions"><Link className="primary small" to="/tester/new-report"><Plus size={17} /> New Test Report</Link><Link className="secondary" to="/tester/instruments">Register Instrument</Link></div></div><section className="stats"><Stat icon={<Weight />} label="Instruments" /><Stat icon={<ClipboardCheck />} label="In Progress" /><Stat icon={<FileText />} label="Completed" /><Stat icon={<Search />} label="Under Review" /></section><section className="workflow"><h2>Testing workflow</h2><p>Your journey from instrument registration to a traceable report.</p><div className="steps">{['Instrument', 'Test Session', 'Observations', 'Validation', 'Calculation', 'Compliance', 'Report'].map((stage, index) => <React.Fragment key={stage}><div className="step"><span>{index + 1}</span>{stage}</div>{index < 6 && <ChevronRight size={14} />}</React.Fragment>)}</div></section><div className="dashboard-grid"><section className="section-card wide"><div className="section-heading"><h2>Recent Test Sessions</h2><Link to="/tester/sessions">View all <ArrowRight /></Link></div><Empty icon={<ClipboardCheck />} title="No test sessions yet" copy="Start a new test report to begin a testing session." action="Start a Test" /></section><section className="section-card"><div className="section-heading"><h2>Quick Actions</h2></div><div className="quick-list"><Link to="/tester/new-report"><Plus /><span><b>New Test Report</b><small>Begin a testing session</small></span><ChevronRight /></Link><Link to="/tester/instruments"><Weight /><span><b>Register Instrument</b><small>Add to your repository</small></span><ChevronRight /></Link><Link to="/tester/history"><Search /><span><b>Search History</b><small>Find past reports</small></span><ChevronRight /></Link></div></section><section className="section-card"><div className="section-heading"><h2>My Instruments</h2></div><Empty icon={<Weight />} title="No instruments registered" copy="Register a NAWI to begin a test session." action="Register Instrument" /></section><section className="section-card wide"><div className="section-heading"><h2>Recent Reports</h2><Link to="/tester/reports">View report history <ArrowRight /></Link></div><Empty icon={<Files />} title="No reports yet" copy="Completed test reports will appear here." action="New Test Report" /></section></div></main></AppShell>; }
function TesterPage({ children }: { children: React.ReactNode }) { const { user, loading } = useAuth(); if (loading) return <div className="loading">Loading secure workspace…</div>; if (!user) return <Navigate to="/login" />; if (user.role !== 'TESTER') return <Navigate to="/" />; return <>{children}</>; }
function Guard({ role }: { role: Role }) { const { user, loading } = useAuth(); if (loading) return <div className="loading">Loading secure workspace…</div>; if (!user) return <Navigate to="/login" />; if (user.role !== role) return <Navigate to="/" />; return role === 'TESTER' ? <TesterDashboard /> : <AppShell><main className="dashboard"><h1>{role} workspace</h1></main></AppShell>; }
function Home() { const { user } = useAuth(); return user ? <Navigate to={`/${user.role.toLowerCase()}/dashboard`} /> : <Navigate to="/login" />; }
function App() { return <Provider><Routes><Route path="/login" element={<Login />} /><Route path="/signup" element={<Signup />} /><Route path="/forgot-password" element={<SimpleAuth />} /><Route path="/reset-password" element={<SimpleAuth />} /><Route path="/tester/dashboard" element={<Guard role="TESTER" />} /><Route path="/tester/instruments" element={<TesterPage><AppShell><InstrumentRepository /></AppShell></TesterPage>} /><Route path="/tester/instruments/new" element={<TesterPage><AppShell><InstrumentRegistration /></AppShell></TesterPage>} /><Route path="/tester/instruments/:instrumentId/edit" element={<TesterPage><AppShell><InstrumentEdit /></AppShell></TesterPage>} /><Route path="/tester/instruments/:instrumentId" element={<TesterPage><AppShell><InstrumentDetail /></AppShell></TesterPage>} /><Route path="/tester/sessions" element={<Guard role="TESTER" />} /><Route path="/tester/reports" element={<TesterPage><AppShell><TesterReports /></AppShell></TesterPage>} /><Route path="/tester/new-report" element={<TesterPage><TestReportWorkflow /></TesterPage>} /><Route path="/tester/reports/:reportId/laboratory" element={<TesterPage><LaboratoryEnvironmentWorkspace /></TesterPage>} /><Route path="/tester/reports/:reportId/testing" element={<TesterPage><TestRouteWorkspace /></TesterPage>} /><Route path="/tester/reports/:reportId/testing/a4-2" element={<TesterPage><ZeroCheckingWorkspace /></TesterPage>} /><Route path="/tester/reports/:reportId/testing/a4-3" element={<TesterPage><ZeroSettingBeforeLoadingWorkspace /></TesterPage>} /><Route path="/tester/reports/:reportId/testing/a4-4" element={<TesterPage><PerformanceWorkspace /></TesterPage>} /><Route path="/tester/reports/:reportId/test-conditions" element={<TesterPage><CompleteTestConditionsWorkspace /></TesterPage>} /><Route path="/tester/reports/:reportId/review" element={<TesterPage><FinalReportWorkspace /></TesterPage>} /><Route path="/tester/reports/:reportId/final-report" element={<TesterPage><FinalReportWorkspace /></TesterPage>} /><Route path="/tester/reports/:reportId" element={<TesterPage><VerificationWorkspace /></TesterPage>} /><Route path="/tester/history" element={<TesterPage><AppShell><HistoryPage /></AppShell></TesterPage>} /><Route path="/reviewer/dashboard" element={<Guard role="REVIEWER" />} /><Route path="/admin/dashboard" element={<Guard role="ADMIN" />} /><Route path="*" element={<Home />} /></Routes></Provider>; }
type NawiHotContext = { data: { root?: ReturnType<typeof createRoot> } };
const hot = (import.meta as ImportMeta & { hot?: NawiHotContext }).hot;
const rootElement = document.getElementById('root')!;
const windowWithRoot = window as Window & { __nawiReactRoot?: ReturnType<typeof createRoot> };
const root = windowWithRoot.__nawiReactRoot ?? hot?.data.root ?? createRoot(rootElement);
windowWithRoot.__nawiReactRoot = root;
if (hot) hot.data.root = root;
root.render(<BrowserRouter><App /></BrowserRouter>);
