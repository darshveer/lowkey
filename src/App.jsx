import { Routes, Route, Link, useLocation } from 'react-router-dom';
import CreatorStudio from './pages/CreatorStudio';
import GuestInvite from './pages/GuestInvite';
import PartyDashboard from './pages/PartyDashboard';
import Home from './pages/Home';
import './App.css';

function App() {
  const location = useLocation();

  return (
    <div className="app">
      <Routes location={location}>
        <Route path="/" element={<Home />} />
        <Route path="/create" element={<CreatorStudio />} />
        <Route path="/invite/:eventId" element={<GuestInvite />} />
        <Route path="/party/:eventId" element={<PartyDashboard />} />
      </Routes>
    </div>
  );
}

export default App;
