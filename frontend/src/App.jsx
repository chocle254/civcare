import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Loader from './components/Loader';
import ErrorBoundary from './components/ErrorBoundary';
import PatientSidebar from './components/PatientSidebar';
import PrivacyGate from './components/PrivacyGate';
import Register       from './pages/patient/Register';
import './index.css';

const Privacy = lazy(() => import('./pages/Privacy'));
const Chat = lazy(() => import('./pages/patient/Chat'));
const HospitalSelect = lazy(() => import('./pages/patient/HospitalSelect'));
const ArrivalConfirm = lazy(() => import('./pages/patient/ArrivalConfirm'));
const Medications = lazy(() => import('./pages/patient/Medications'));
const Consultation = lazy(() => import('./pages/patient/Consultation'));
const Payment = lazy(() => import('./pages/patient/Payment'));
const RateExperience = lazy(() => import('./pages/patient/RateExperience'));
const DoctorLogin = lazy(() => import('./pages/doctor/Login'));
const Dashboard = lazy(() => import('./pages/doctor/Dashboard'));
const PatientProfile = lazy(() => import('./pages/doctor/PatientProfile'));
const Verdict = lazy(() => import('./pages/doctor/Verdict'));
const RateAI = lazy(() => import('./pages/doctor/RateAI'));
const ActiveConsult = lazy(() => import('./pages/doctor/ActiveConsult'));
const SessionDashboard = lazy(() => import('./pages/patient/SessionDashboard'));
const Profile = lazy(() => import('./pages/patient/Profile'));
const ConsultationWaiting = lazy(() => import('./pages/patient/ConsultationWaiting'));
const DiagnosisHistory = lazy(() => import('./pages/patient/DiagnosisHistory'));
const Analytics = lazy(() => import('./pages/analytics/Analytics'));
const Admin = lazy(() => import('./pages/admin/Admin'));
const HospitalRegister = lazy(() => import('./pages/HospitalRegister'));

function GuardedRoutes({ children }) {
  const { pathname } = useLocation();
  // Each page downloads only when first opened, so the first screen doesn't
  // wait for maps, charts and PDF tools it never uses.
  return (
    <ErrorBoundary resetKey={pathname}>
      <Suspense fallback={<Loader />}>{children}</Suspense>
    </ErrorBoundary>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <PatientSidebar />
      <PrivacyGate />
      <GuardedRoutes>
      <Routes>
        {/* Patient */}
        <Route path="/"                    element={<Register />} />
        <Route path="/chat"                element={<Chat />} />
        <Route path="/hospitals"           element={<HospitalSelect />} />
        <Route path="/arrival"             element={<ArrivalConfirm />} />
        <Route path="/medications"         element={<Medications />} />
        <Route path="/consultation"        element={<Consultation />} />
        <Route path="/payment"             element={<Payment />} />
        <Route path="/rate"                element={<RateExperience />} />
        <Route path="/dashboard"           element={<SessionDashboard />} />
        <Route path="/profile"             element={<Profile />} />
        <Route path="/consultation/waiting" element={<ConsultationWaiting />} />
        <Route path="/diagnosis-history"   element={<DiagnosisHistory />} />
        <Route path="/analytics"           element={<Analytics />} />
        <Route path="/privacy"             element={<Privacy />} />
        {/* Doctor */}
        <Route path="/doctor"              element={<DoctorLogin />} />
        <Route path="/doctor/dashboard"    element={<Dashboard />} />
        <Route path="/doctor/patient/:id"  element={<PatientProfile />} />
        <Route path="/doctor/verdict/:id"  element={<Verdict />} />
        <Route path="/doctor/rate/:id"     element={<RateAI />} />
        <Route path="/doctor/consult/:id"  element={<ActiveConsult />} />

        {/* Catch all */}
        {/* CivCare team and hospitals */}
        <Route path="/admin"             element={<Admin />} />
        <Route path="/hospital/register" element={<HospitalRegister />} />

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
      </GuardedRoutes>
    </BrowserRouter>
  );
}
