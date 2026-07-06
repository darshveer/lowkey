import { useState, useEffect, lazy, Suspense } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import Home from './pages/Home';
import Navbar from './components/Navbar';
import SvgDecor from './components/SvgDecor';
import AnimatedBackground from './components/AnimatedBackground';
import CursorGlow from './components/CursorGlow';
import Logo from './components/Logo';
import { getCurrentUser, logoutUser, initAuth } from './utils/storage';
import './App.css';

// Route-level code splitting keeps the initial bundle lean — the heavier
// creator / dashboard / invite views (with QR + payment deps) load on demand.
const CreatorStudio = lazy(() => import('./pages/CreatorStudio'));
const GuestInvite = lazy(() => import('./pages/GuestInvite'));
const PartyDashboard = lazy(() => import('./pages/PartyDashboard'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));

function RouteFallback() {
  return (
    <div className="route-fallback" role="status" aria-live="polite">
      <Logo size={56} className="route-fallback__logo" />
      <div className="route-fallback__spinner" />
    </div>
  );
}

function App() {
  const location = useLocation();
  const [currentUser, setCurrentUser] = useState(() => getCurrentUser());
  const [activeTab, setActiveTab] = useState('discover');
  const [loginRedirect, setLoginRedirect] = useState(false);

  // Hydrate the Supabase Auth session on load and subscribe to auth changes.
  useEffect(() => {
    const unsubscribe = initAuth((profile) => setCurrentUser(profile));
    return unsubscribe;
  }, []);

  // Keep the session in sync when other parts of the app mutate the user
  // (e.g. profile-picture upload dispatches `lowkey_db_sync`).
  useEffect(() => {
    const syncUser = () => setCurrentUser(getCurrentUser());
    window.addEventListener('lowkey_db_sync', syncUser);
    return () => window.removeEventListener('lowkey_db_sync', syncUser);
  }, []);

  const handleLogout = async () => {
    await logoutUser();
    setCurrentUser(null);
    setActiveTab('discover');
  };

  return (
    <div className="app">
      <AnimatedBackground />
      <CursorGlow />
      <SvgDecor variant="ambient" />
      <Navbar
        currentUser={currentUser}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        setLoginRedirect={setLoginRedirect}
        onLogout={handleLogout}
      />
      <Suspense fallback={<RouteFallback />}>
        <Routes location={location}>
          <Route
            path="/"
            element={
              <Home
                currentUser={currentUser}
                setCurrentUser={setCurrentUser}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                loginRedirect={loginRedirect}
                setLoginRedirect={setLoginRedirect}
              />
            }
          />
          <Route path="/create" element={<CreatorStudio />} />
          <Route
            path="/profile"
            element={<ProfilePage currentUser={currentUser} setCurrentUser={setCurrentUser} />}
          />
          <Route path="/invite/:eventId" element={<GuestInvite key={location.pathname} />} />
          <Route path="/party/:eventId" element={<PartyDashboard key={location.pathname} />} />
        </Routes>
      </Suspense>
      <footer className="footer-culture">
        made with 💜 for the culture
      </footer>
    </div>
  );
}

export default App;
