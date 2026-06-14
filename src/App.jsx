import { useState } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import CreatorStudio from './pages/CreatorStudio';
import GuestInvite from './pages/GuestInvite';
import PartyDashboard from './pages/PartyDashboard';
import Home from './pages/Home';
import Navbar from './components/Navbar';
import SvgDecor from './components/SvgDecor';
import { getCurrentUser, logoutUser } from './utils/storage';
import './App.css';

function App() {
  const location = useLocation();
  const [currentUser, setCurrentUser] = useState(() => getCurrentUser());
  const [activeTab, setActiveTab] = useState('discover');
  const [loginRedirect, setLoginRedirect] = useState(false);

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
      <footer className="footer-culture">
        made with 💜 for the culture
      </footer>
    </div>
  );
}

export default App;
