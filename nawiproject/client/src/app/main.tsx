import React from 'react';
import { createRoot } from 'react-dom/client';
import axios from 'axios';
import { BrowserRouter, Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import { LogOut, LayoutDashboard, Weight, Files, History } from 'lucide-react';
import TestReportWorkflow from '../features/test-reports/NewTestReport/TestReportWorkflow';
import TesterReports from '../features/test-reports/Review/TesterReports';
import VerificationWorkspace from '../features/test-reports/Review/VerificationWorkspace';
import PerformanceWorkspace from '../testing/a4/a4-4-weighing-performance/WeighingPerformanceWorkspace';
import FinalReportWorkspace from '../features/test-reports/FinalReport/FinalReportWorkspace';
import LaboratoryEnvironmentWorkspace from '../features/test-reports/LaboratoryEnvironmentWorkspace';
import CompleteTestConditionsWorkspace from '../features/test-reports/CompleteTestConditionsWorkspace';
import TestRouteWorkspace from '../features/test-reports/TestRouteWorkspace';
import VariationWithTimeWorkspace from '../testing/a4/a4-11-variation-with-time/VariationWithTimeWorkspace';
import StabilityOfEquilibriumWorkspace from '../testing/a4/a4-12-stability-of-equilibrium/StabilityOfEquilibriumWorkspace';
import ZeroCheckingWorkspace from '../testing/a4/a4-2-zero-checking/ZeroCheckingWorkspace';
import ZeroSettingBeforeLoadingWorkspace from '../testing/a4/a4-3-setting-to-zero/ZeroSettingBeforeLoadingWorkspace';
import TareWorkspace from '../testing/a4/a4-6-tare/TareWorkspace';
import EccentricityWorkspace from '../testing/a4/a4-7-eccentricity/EccentricityWorkspace';
import MultipleIndicatingDevicesWorkspace from '../testing/a4/a4-5-multiple-indicating-devices/MultipleIndicatingDevicesWorkspace';
import DiscriminationWorkspace from '../testing/a4/a4-8-discrimination/DiscriminationWorkspace';
import SensitivityWorkspace from '../testing/a4/a4-9-sensitivity/SensitivityWorkspace';
import RepeatabilityWorkspace from '../testing/a4/a4-10-repeatability/RepeatabilityWorkspace';
import InfluenceFactorsWorkspace from '../testing/a5/a5-4-voltage/InfluenceFactorsWorkspace';
import EnduranceWorkspace from '../testing/a6/a6-endurance/EnduranceWorkspace';
import AmbientShapes from '../shared/components/ambient/AmbientShapes';
import ReportApplicationEdit from '../features/test-reports/ReportApplicationEdit';
import { HistoryPage, InstrumentDetail, InstrumentEdit, InstrumentRegistration, InstrumentRepository } from '../features/instruments/InstrumentRepository';
import '../styles/globals.css';
import '../features/dashboard/dashboard.css';
import '../shared/components/ambient/ambient-shapes.css';
import '../shared/components/primary-actions.css';
import TesterDashboardWorkspace from '../features/dashboard/DashboardPage';
import { AuthProvider, useAuth, type Role } from './providers/AuthProvider';
import { LoginPage, SignupPage, SimpleAuthPage } from '../features/login/LoginPage';
import Logo from '../shared/components/Logo';
axios.defaults.baseURL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
axios.defaults.withCredentials = true;

const navItems = [['Dashboard', LayoutDashboard, '/tester/dashboard'], ['Test Reports', Files, '/tester/reports'], ['Instruments', Weight, '/tester/instruments'], ['History', History, '/tester/history']] as const;
function AppShell({ children }: { children: React.ReactNode }) { const { user, logout } = useAuth(); const location = useLocation(); const shellHeading = location.pathname.startsWith('/tester/instruments') ? 'Instruments' : location.pathname.startsWith('/tester/history') ? 'History' : location.pathname.startsWith('/tester/reports') ? 'Test Reports' : 'Dashboard'; return <div className="app-shell"><aside><div className="side-brand"><Link className="side-logo-link" to="/login"><Logo dark /></Link><small>TEST &amp; REPORT SYSTEM</small></div><nav className="side-nav">{navItems.map(([label, Icon, to]) => <Link className={location.pathname === to || (to !== '/tester/dashboard' && location.pathname.startsWith(`${to}/`)) ? 'active' : ''} to={to} key={label}><Icon size={18} />{label}</Link>)}</nav><div className="side-user"><div className="avatar">{user?.firstName[0]}{user?.lastName[0]}</div><div><b>{user?.firstName} {user?.lastName}</b><small>TESTER</small></div><button aria-label="Sign out" onClick={logout}><LogOut size={16} /></button></div></aside><div className="app-main"><header className="app-top"><div><span className="crumb">TESTER WORKSPACE</span><h2>{shellHeading}</h2></div><div className="top-user"><span>{user?.firstName} {user?.lastName}</span><span className="badge">TESTER</span><button className="logout" onClick={logout}><LogOut size={15} /> Sign out</button></div></header>{children}</div></div>; }
function TesterPage({ children }: { children: React.ReactNode }) { const { user, loading } = useAuth(); if (loading) return <div className="loading">Loading secure workspace…</div>; if (!user) return <Navigate to="/login" />; if (user.role !== 'TESTER') return <Navigate to="/" />; return <>{children}</>; }
function Guard({ role }: { role: Role }) { const { user, loading } = useAuth(); if (loading) return <div className="loading">Loading secure workspace…</div>; if (!user) return <Navigate to="/login" />; if (user.role !== role) return <Navigate to="/" />; return role === 'TESTER' ? <AppShell><TesterDashboardWorkspace user={user} /></AppShell> : <AppShell><main className="dashboard"><h1>{role} workspace</h1></main></AppShell>; }
function Home() { const { user } = useAuth(); return user ? <Navigate to={`/${user.role.toLowerCase()}/dashboard`} /> : <Navigate to="/login" />; }
 function App() { return <AuthProvider><Routes><Route path="/login" element={<LoginPage />} /><Route path="/signup" element={<SignupPage />} /><Route path="/forgot-password" element={<SimpleAuthPage />} /><Route path="/reset-password" element={<SimpleAuthPage />} /><Route path="/tester/dashboard" element={<Guard role="TESTER" />} /><Route path="/tester/instruments" element={<TesterPage><AppShell><InstrumentRepository /></AppShell></TesterPage>} /><Route path="/tester/instruments/new" element={<TesterPage><AppShell><InstrumentRegistration /></AppShell></TesterPage>} /><Route path="/tester/instruments/:instrumentId/edit" element={<TesterPage><AppShell><InstrumentEdit /></AppShell></TesterPage>} /><Route path="/tester/instruments/:instrumentId" element={<TesterPage><AppShell><InstrumentDetail /></AppShell></TesterPage>} /><Route path="/tester/sessions" element={<Guard role="TESTER" />} /><Route path="/tester/reports" element={<TesterPage><AppShell><TesterReports /></AppShell></TesterPage>} /><Route path="/tester/new-report" element={<TesterPage><TestReportWorkflow /></TesterPage>} /><Route path="/tester/reports/:reportId/edit" element={<TesterPage><ReportApplicationEdit /></TesterPage>} /><Route path="/tester/reports/:reportId/laboratory" element={<TesterPage><LaboratoryEnvironmentWorkspace /></TesterPage>} /><Route path="/tester/reports/:reportId/testing" element={<TesterPage><TestRouteWorkspace /></TesterPage>} /><Route path="/tester/reports/:reportId/influence-factors" element={<TesterPage><InfluenceFactorsWorkspace /></TesterPage>} /><Route path="/tester/reports/:reportId/endurance" element={<TesterPage><EnduranceWorkspace /></TesterPage>} /><Route path="/tester/reports/:reportId/testing/a5" element={<TesterPage><InfluenceFactorsWorkspace /></TesterPage>} /><Route path="/tester/reports/:reportId/testing/a4-2" element={<TesterPage><ZeroCheckingWorkspace /></TesterPage>} /><Route path="/tester/reports/:reportId/testing/a4-3" element={<TesterPage><ZeroSettingBeforeLoadingWorkspace /></TesterPage>} /><Route path="/tester/reports/:reportId/testing/a4-4" element={<TesterPage><PerformanceWorkspace /></TesterPage>} /><Route path="/tester/reports/:reportId/testing/a4-5" element={<TesterPage><MultipleIndicatingDevicesWorkspace /></TesterPage>} /><Route path="/tester/reports/:reportId/testing/a4-6" element={<TesterPage><TareWorkspace /></TesterPage>} /><Route path="/tester/reports/:reportId/testing/a4-7" element={<TesterPage><EccentricityWorkspace /></TesterPage>} /><Route path="/tester/reports/:reportId/testing/a4-8" element={<TesterPage><DiscriminationWorkspace /></TesterPage>} /><Route path="/tester/reports/:reportId/testing/a4-9" element={<TesterPage><SensitivityWorkspace /></TesterPage>} /><Route path="/tester/reports/:reportId/testing/a4-10" element={<TesterPage><RepeatabilityWorkspace /></TesterPage>} /><Route path="/tester/reports/:reportId/testing/a4-11" element={<TesterPage><VariationWithTimeWorkspace /></TesterPage>} /><Route path="/tester/reports/:reportId/testing/a4-12" element={<TesterPage><StabilityOfEquilibriumWorkspace /></TesterPage>} /><Route path="/tester/reports/:reportId/test-conditions" element={<TesterPage><CompleteTestConditionsWorkspace /></TesterPage>} /><Route path="/tester/reports/:reportId/review" element={<TesterPage><FinalReportWorkspace /></TesterPage>} /><Route path="/tester/reports/:reportId/final-report" element={<TesterPage><FinalReportWorkspace /></TesterPage>} /><Route path="/tester/reports/:reportId" element={<TesterPage><VerificationWorkspace /></TesterPage>} /><Route path="/tester/history" element={<TesterPage><AppShell><HistoryPage /></AppShell></TesterPage>} /><Route path="/reviewer/dashboard" element={<Guard role="REVIEWER" />} /><Route path="/admin/dashboard" element={<Guard role="ADMIN" />} /><Route path="*" element={<Home />} /></Routes></AuthProvider>; }
type NawiHotContext = { data: { root?: ReturnType<typeof createRoot> } };
const hot = (import.meta as ImportMeta & { hot?: NawiHotContext }).hot;
const rootElement = document.getElementById('root')!;
const windowWithRoot = window as Window & { __nawiReactRoot?: ReturnType<typeof createRoot> };
const root = windowWithRoot.__nawiReactRoot ?? hot?.data.root ?? createRoot(rootElement);
windowWithRoot.__nawiReactRoot = root;
if (hot) hot.data.root = root;
root.render(<BrowserRouter><App /></BrowserRouter>);
