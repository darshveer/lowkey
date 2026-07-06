import { useState, useEffect, lazy, Suspense } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import Home from './pages/Home';
import Navbar from './components/Navbar';
import SvgDecor from './components/SvgDecor';
import { getCurrentUser, logoutUser } from './utils/storage';
import './App.css';

// Route-level code splitting keeps the initial bundle lean — the heavier
// creator / dashboard / invite views (with QR + payment deps) load on demand.
const CreatorStudio = lazy(() => import('./pages/CreatorStudio'));
const GuestInvite = lazy(() => import('./pages/GuestInvite'));
const PartyDashboard = lazy(() => import('./pages/PartyDashboard'));

function RouteFallback() {
  return (
    <div className="route-fallback" role="status" aria-live="polite">
      <div className="route-fallback__spinner" />
    </div>
  );
}

function App() {
  const location = useLocation();
  const [currentUser, setCurrentUser] = useState(() => getCurrentUser());
  const [activeTab, setActiveTab] = useState('discover');
  const [loginRedirect, setLoginRedirect] = useState(false);

  // Keep the session in sync when other parts of the app mutate the user
  // (e.g. profile-picture upload dispatches `lowkey_db_sync`).
  useEffect(() => {
    const syncUser = () => setCurrentUser(getCurrentUser());
    window.addEventListener('lowkey_db_sync', syncUser);
    return () => window.removeEventListener('lowkey_db_sync', syncUser);
  }, []);

  const handleLogout = () => {
    logoutUser();
    setCurrentUser(null);
    setActiveTab('discover');
  };

  return (
    <div className="app">
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
