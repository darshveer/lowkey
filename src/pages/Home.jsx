import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getEvents } from '../utils/storage';
import { formatDate, formatTime } from '../utils/helpers';
import './Home.css';

function Home() {
  const [events, setEvents] = useState([]);

  useEffect(() => {
    setEvents(getEvents());
  }, []);

  return (
    <div className="page home">
      {/* Brand Header */}
      <header className="home-header animate-fade-in-up">
        <div className="home-logo">
          <span className="home-logo__text text-gradient">lowkey</span>
        </div>
        <p className="home-tagline">house parties, simplified ✨</p>
      </header>

      {/* Hero CTA */}
      <section className="home-hero animate-fade-in-up" style={{ animationDelay: '100ms' }}>
        <div className="home-hero__orb home-hero__orb--purple" />
        <div className="home-hero__orb home-hero__orb--blue" />
        <div className="home-hero__card glass-strong">
          <h2 className="home-hero__title">throw a party<br /><span className="text-gradient-aurora">worth talking about</span></h2>
          <p className="home-hero__desc">
            Create aesthetic invites, split the bill, dump photos — all in one place.
          </p>
          <Link to="/create" className="home-hero__cta">
            <button className="home-cta-button">
              <span>Create a Party</span>
              <span className="home-cta-button__emoji">🎉</span>
            </button>
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="home-features stagger" style={{ animationDelay: '200ms' }}>
        <div className="home-feature glass">
          <span className="home-feature__icon">🔗</span>
          <div>
            <h4 className="home-feature__title">WhatsApp RSVP</h4>
            <p className="home-feature__desc">Drop a link. Guests tap. Done.</p>
          </div>
        </div>
        <div className="home-feature glass">
          <span className="home-feature__icon">💰</span>
          <div>
            <h4 className="home-feature__title">The Kitty</h4>
            <p className="home-feature__desc">Split bills. UPI QR. Instant settle.</p>
          </div>
        </div>
        <div className="home-feature glass">
          <span className="home-feature__icon">📸</span>
          <div>
            <h4 className="home-feature__title">Camera Dump</h4>
            <p className="home-feature__desc">Raw photos. Film aesthetic. 2 AM unlock.</p>
          </div>
        </div>
        <div className="home-feature glass">
          <span className="home-feature__icon">🎵</span>
          <div>
            <h4 className="home-feature__title">Collab Playlist</h4>
            <p className="home-feature__desc">Everyone adds tracks before they arrive.</p>
          </div>
        </div>
      </section>

      {/* Active Parties */}
      {events.length > 0 && (
        <section className="home-parties animate-fade-in-up" style={{ animationDelay: '400ms' }}>
          <h3 className="home-section-title">your parties</h3>
          <div className="home-parties__list stack stack-md">
            {events.map((event) => (
              <Link
                key={event.id}
                to={`/party/${event.id}`}
                className="home-party-card glass pressable"
              >
                <div className={`home-party-card__gradient ${event.theme ? `theme-${event.theme}` : 'theme-neon'}`} />
                <div className="home-party-card__content">
                  <h4 className="home-party-card__name">{event.name}</h4>
                  <p className="home-party-card__meta">
                    📅 {formatDate(event.date)} &nbsp;•&nbsp; {formatTime(event.time_start)}
                  </p>
                  <p className="home-party-card__location">📍 {event.location_name}</p>
                </div>
                <div className="home-party-card__arrow">→</div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Demo Links */}
      <section className="home-demo animate-fade-in-up" style={{ animationDelay: '500ms' }}>
        <h3 className="home-section-title">try the demo</h3>
        <div className="stack stack-sm">
          <Link to="/invite/party_xK9mQ2" className="home-demo-link glass pressable">
            <span>🎟️</span> Guest Invite Page
          </Link>
          <Link to="/party/party_aB3nY7" className="home-demo-link glass pressable">
            <span>🎛️</span> Party Dashboard (Live)
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="home-footer">
        <p>made with 💜 for the culture</p>
      </footer>
    </div>
  );
}

export default Home;
