import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import Home from './pages/Home';
import Navbar from './components/Navbar';
import SvgDecor from './components/SvgDecor';
import AnimatedBackground from './components/AnimatedBackground';
import CursorGlow from './components/CursorGlow';
import LogoLoader from './components/LogoLoader';
import ProfileCompletionModal from './components/ProfileCompletionModal';
import { getCurrentUser, logoutUser, initAuth } from './utils/storage';
import { useToast } from './hooks/useToast';
import { useTransition } from './hooks/useTransition';
import './App.css';

// Route-level code splitting keeps the initial bundle lean — the heavier
// creator / dashboard / invite views (with QR + payment deps) load on demand.
const CreatorStudio = lazy(() => import('./pages/CreatorStudio'));
const GuestInvite = lazy(() => import('./pages/GuestInvite'));
const PartyDashboard = lazy(() => import('./pages/PartyDashboard'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));

function RouteFallback() {
  return (
    <div className="route-fallback">
      <LogoLoader size={60} label="" />
    </div>
  );
}

function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const { show } = useToast();
  const { playTransition, playReveal } = useTransition();
  // True on this page load if we just returned from a Google OAuth redirect (flag
  // set in main.jsx before supabase strips the URL). Consumed once, below.
  const oauthReturn = useRef(false);
  const [currentUser, setCurrentUser] = useState(() => getCurrentUser());
  const [activeTab, setActiveTab] = useState('discover');
  const [loginRedirect, setLoginRedirect] = useState(false);

  // Read (and clear) the OAuth-return flag once, so a Google sign-in this load
  // gets the split-curtain reveal when the session hydrates.
  useEffect(() => {
    try {
      if (sessionStorage.getItem('lowkey_oauth_return')) {
        sessionStorage.removeItem('lowkey_oauth_return');
        oauthReturn.current = true;
      }
    } catch { /* ignore */ }
  }, []);

  // Hydrate the Supabase Auth session on load and subscribe to auth changes.
  useEffect(() => {
    const unsubscribe = initAuth((profile) => setCurrentUser(profile));
    return unsubscribe;
  }, []);

  // When a Google sign-in lands (currentUser becomes set on an OAuth-return load),
  // play the reveal once — the panels split apart onto the signed-in app (or the
  // profile-completion modal, for first-time Google users).
  useEffect(() => {
    if (oauthReturn.current && currentUser) {
      oauthReturn.current = false;
      playReveal();
    }
  }, [currentUser, playReveal]);

  // Surface cloud-write failures (throttled) so they're never silent again.
  useEffect(() => {
    let cooling = false;
    const onSyncError = () => {
      if (cooling) return;
      cooling = true;
      show(
        "Saved locally, but couldn't sync to the cloud. Check your Supabase connection/schema, then re-sync from your profile.",
        'error',
        6000
      );
      setTimeout(() => { cooling = false; }, 15000);
    };
    window.addEventListener('lowkey_sync_error', onSyncError);
    return () => window.removeEventListener('lowkey_sync_error', onSyncError);
  }, [show]);

  // Keep the session in sync when other parts of the app mutate the user
  // (e.g. profile-picture upload dispatches `lowkey_db_sync`).
  useEffect(() => {
    const syncUser = () => setCurrentUser(getCurrentUser());
    window.addEventListener('lowkey_db_sync', syncUser);
    return () => window.removeEventListener('lowkey_db_sync', syncUser);
  }, []);

  const handleLogout = () => {
    // Play the split-curtain while we tear down the session behind it.
    playTransition(async () => {
      await logoutUser();
      setCurrentUser(null);
      setActiveTab('discover');
      navigate('/');
    });
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
        {/* Keyed by pathname so each navigation replays a soft fade/slide-in
            (see .route-view in App.css); reduced-motion is neutralized globally. */}
        <div className="route-view" key={location.pathname}>
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
        </div>
      </Suspense>
      <footer className="footer-culture">
        made with 💜 for the culture
      </footer>
      {/* Shown app-wide when a Google sign-in leaves the profile without a
          username / birthdate — blocks until completed (birthdate = 21+ gate). */}
      <ProfileCompletionModal currentUser={currentUser} setCurrentUser={setCurrentUser} />
    </div>
  );
}

export default App;
