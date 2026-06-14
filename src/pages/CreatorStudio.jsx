import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import GlassCard from '../components/GlassCard';
import GlowButton from '../components/GlowButton';
import { generateId, shareLink, shareToWhatsApp } from '../utils/helpers';
import { saveEvent, getCurrentUser } from '../utils/storage';
import { DISCOVERY_CITIES, PARTY_THEMES } from '../data/mockData';
import './CreatorStudio.css';

/** Step labels for the progress indicator */
const STEPS = [
  { key: 'basics', label: 'step 1 of 5', title: 'the basics' },
  { key: 'when-where', label: 'step 2 of 5', title: 'when & where' },
  { key: 'vibe', label: 'step 3 of 5', title: 'set the vibe' },
  { key: 'kitty', label: 'step 4 of 5', title: 'the kitty' },
  { key: 'preview', label: 'step 5 of 5', title: 'preview & share' },
];

/**
 * CreatorStudio — Host-side multi-step party creation form.
 * Collects party details, theme, UPI, then shows preview with share options.
 * @returns {JSX.Element}
 */
export default function CreatorStudio() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [toast, setToast] = useState('');

  // --- Form state ---
  const [name, setName] = useState('');
  const [tagline, setTagline] = useState('');
  const [date, setDate] = useState('');
  const [timeStart, setTimeStart] = useState('');
  const [timeEnd, setTimeEnd] = useState('');
  const [city, setCity] = useState('Bengaluru');
  const [locationName, setLocationName] = useState('');
  const [locationAddress, setLocationAddress] = useState('');
  const [theme, setTheme] = useState('neon');
  const [spotifyUrl, setSpotifyUrl] = useState('');
  const [upiId, setUpiId] = useState('');
  const [coverCharge, setCoverCharge] = useState('');
  const [capacity, setCapacity] = useState('');
  const [hasPersonalDj, setHasPersonalDj] = useState(false);
  const [djName, setDjName] = useState('');
  const [djGenre, setDjGenre] = useState('');
  const [djProfileUrl, setDjProfileUrl] = useState('');
  const [djInstagram, setDjInstagram] = useState('');
  const [containsAlcohol, setContainsAlcohol] = useState(false);

  // Generated on create
  const [eventId, setEventId] = useState('');

  /** Show a toast notification briefly */
  const flash = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2200);
  };

  /** Can proceed from current step? */
  const canProceed = () => {
    switch (step) {
      case 0: return name.trim().length > 0;
      case 1: return date && timeStart;
      case 2: return !!theme;
      case 3: return true; // UPI is optional-ish, let them skip
      case 4: return true;
      default: return true;
    }
  };

  const goNext = () => {
    if (step < STEPS.length - 1 && canProceed()) setStep(step + 1);
  };

  const goBack = () => {
    if (step > 0) setStep(step - 1);
  };

  /** Build the shareable invite link */
  const getShareUrl = (id) => `${window.location.origin}/invite/${id || eventId}`;

  /** Copy invite link to clipboard */
  const handleCopyLink = async () => {
    const id = eventId || generateId();
    if (!eventId) setEventId(id);
    const url = getShareUrl(id);
    const shared = await shareLink({ title: name, text: `You're invited to ${name}!`, url });
    if (shared) flash('Link copied! 🔗');
  };

  /** Share invite via WhatsApp */
  const handleWhatsApp = () => {
    const id = eventId || generateId();
    if (!eventId) setEventId(id);
    shareToWhatsApp(`You're invited to ${name} 🎉`, getShareUrl(id));
  };

  /** Create the party and navigate to dashboard */
  const handleCreate = () => {
    const id = eventId || generateId();
    const currentUser = getCurrentUser();

    const event = {
      id,
      host_id: currentUser ? currentUser.id : 'local_host',
      host_name: currentUser ? currentUser.name : 'You',
      name: name.trim(),
      tagline: tagline.trim(),
      date,
      time_start: timeStart,
      time_end: timeEnd,
      city,
      location_name: locationName.trim(),
      location_address: locationAddress.trim(),
      theme,
      spotify_playlist_url: spotifyUrl.trim() || null,
      upi_id: upiId.trim() || null,
      cover_charge: coverCharge ? Number(coverCharge) : 0,
      capacity: capacity ? Number(capacity) : null,
      discoverable: true,
      vibe_tags: [city, hasPersonalDj ? 'DJ set' : 'playlist', containsAlcohol ? 'BYOB' : ''].filter(Boolean),
      has_personal_dj: hasPersonalDj,
      dj_name: hasPersonalDj ? djName.trim() : '',
      dj_genre: hasPersonalDj ? djGenre.trim() : '',
      dj_profile_url: hasPersonalDj ? djProfileUrl.trim() : '',
      dj_instagram: hasPersonalDj ? djInstagram.trim() : '',
      status: 'live',
      photo_dump_unlocked: false,
      contains_alcohol: containsAlcohol,
    };

    saveEvent(event);
    navigate(`/party/${id}`);
  };

  /** Format date for preview display */
  const previewDate = () => {
    if (!date) return '';
    try {
      return new Date(date).toLocaleDateString('en-IN', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      });
    } catch {
      return date;
    }
  };

  /** Format time for preview */
  const previewTime = (t) => {
    if (!t) return '';
    const [h, m] = t.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour = h % 12 || 12;
    return `${hour}:${m.toString().padStart(2, '0')} ${ampm}`;
  };

  /** Get the CSS class for the selected theme */
  const selectedTheme = PARTY_THEMES.find((t) => t.id === theme);

  // ----------------------------------------------------------------
  // RENDER STEPS
  // ----------------------------------------------------------------

  const renderBasics = () => (
    <div className="creator-fields">
      <div className="creator-field">
        <input
          className="creator-input--hero"
          type="text"
          placeholder="name your party"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          maxLength={60}
        />
      </div>

      <div className="creator-field">
        <input
          className="input-glass"
          type="text"
          placeholder="keep it lowkey or go all out..."
          value={tagline}
          onChange={(e) => setTagline(e.target.value)}
          maxLength={120}
        />
      </div>
    </div>
  );

  const renderWhenWhere = () => (
    <div className="creator-fields">
      <div className="creator-field">
        <label className="creator-field__label">Date</label>
        <input
          className="input-glass"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          min={new Date().toISOString().split('T')[0]}
        />
      </div>

      <div className="creator-time-row">
        <div className="creator-field">
          <label className="creator-field__label">Start</label>
          <input
            className="input-glass"
            type="time"
            value={timeStart}
            onChange={(e) => setTimeStart(e.target.value)}
          />
        </div>
        <div className="creator-field">
          <label className="creator-field__label">End</label>
          <input
            className="input-glass"
            type="time"
            value={timeEnd}
            onChange={(e) => setTimeEnd(e.target.value)}
          />
        </div>
      </div>

      <div className="creator-field">
        <label className="creator-field__label">City</label>
        <select
          className="input-glass"
          value={city}
          onChange={(e) => setCity(e.target.value)}
        >
          {DISCOVERY_CITIES.filter(c => c !== 'All').map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      <div className="creator-field">
        <label className="creator-field__label">Spot</label>
        <input
          className="input-glass"
          type="text"
          placeholder="My Terrace, Koramangala"
          value={locationName}
          onChange={(e) => setLocationName(e.target.value)}
        />
      </div>

      <div className="creator-field">
        <label className="creator-field__label">Address</label>
        <input
          className="input-glass"
          type="text"
          placeholder="full address for directions"
          value={locationAddress}
          onChange={(e) => setLocationAddress(e.target.value)}
        />
      </div>
    </div>
  );

  const renderVibe = () => (
    <div className="creator-fields">
      <div className="creator-themes">
        {PARTY_THEMES.map((t) => (
          <div
            key={t.id}
            className={`creator-theme-card ${t.className}${theme === t.id ? ' creator-theme-card--selected' : ''}`}
            onClick={() => setTheme(t.id)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && setTheme(t.id)}
            aria-label={`Select ${t.name} theme`}
            aria-pressed={theme === t.id}
          >
            <span className="creator-theme-card__emoji">{t.emoji}</span>
            <span className="creator-theme-card__name">{t.name}</span>
          </div>
        ))}
      </div>

      <div className="creator-field">
        <label className="creator-field__label">Spotify Playlist (optional)</label>
        <div className="creator-spotify-row">
          <span className="creator-spotify-row__icon">🎵</span>
          <input
            className="input-glass"
            type="url"
            placeholder="paste playlist link"
            value={spotifyUrl}
            onChange={(e) => setSpotifyUrl(e.target.value)}
          />
        </div>
      </div>

      <div className="creator-dj-card">
        <button
          className="creator-dj-card__toggle"
          type="button"
          onClick={() => setHasPersonalDj(!hasPersonalDj)}
          aria-pressed={hasPersonalDj}
        >
          <span>
            <strong>Personal DJ</strong>
            <small>Show guests who is playing the set.</small>
          </span>
          <span className={`creator-dj-card__switch${hasPersonalDj ? ' creator-dj-card__switch--active' : ''}`} />
        </button>

        {hasPersonalDj && (
          <div className="creator-dj-card__fields">
            <input
              className="input-glass"
              type="text"
              placeholder="DJ name"
              value={djName}
              onChange={(e) => setDjName(e.target.value)}
              maxLength={80}
            />
            <input
              className="input-glass"
              type="text"
              placeholder="genre or vibe: Afro house, Bolly-tech..."
              value={djGenre}
              onChange={(e) => setDjGenre(e.target.value)}
              maxLength={120}
            />
            <input
              className="input-glass"
              type="url"
              placeholder="profile link, SoundCloud, Spotify, website"
              value={djProfileUrl}
              onChange={(e) => setDjProfileUrl(e.target.value)}
            />
            <input
              className="input-glass"
              type="url"
              placeholder="Instagram link"
              value={djInstagram}
              onChange={(e) => setDjInstagram(e.target.value)}
            />
          </div>
        )}
      </div>

      <div className="creator-dj-card" style={{ marginTop: '16px' }}>
        <button
          className="creator-dj-card__toggle"
          type="button"
          onClick={() => setContainsAlcohol(!containsAlcohol)}
          aria-pressed={containsAlcohol}
        >
          <span>
            <strong>Contains Alcohol / BYOB</strong>
            <small>Require age verification (21+) for guests who RSVP</small>
          </span>
          <span className={`creator-dj-card__switch${containsAlcohol ? ' creator-dj-card__switch--active' : ''}`} />
        </button>
      </div>
    </div>
  );

  const renderKitty = () => (
    <div className="creator-fields">
      <div className="creator-time-row">
        <div className="creator-field">
          <label className="creator-field__label">Cover charge</label>
          <input
            className="input-glass"
            type="number"
            min="0"
            inputMode="numeric"
            placeholder="0"
            value={coverCharge}
            onChange={(e) => setCoverCharge(e.target.value)}
          />
        </div>
        <div className="creator-field">
          <label className="creator-field__label">Capacity</label>
          <input
            className="input-glass"
            type="number"
            min="1"
            inputMode="numeric"
            placeholder="40"
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
          />
        </div>
      </div>

      <div className="creator-field">
        <label className="creator-field__label">Your UPI ID</label>
        <input
          className="input-glass"
          type="text"
          placeholder="yourname@upi"
          value={upiId}
          onChange={(e) => setUpiId(e.target.value)}
        />
      </div>

      <div className="creator-tip">
        <span className="creator-tip__icon">💡</span>
        <span className="creator-tip__text">
          Guests can split bills and pay you directly via UPI. 
          Add your ID so everyone knows where to send their share.
        </span>
      </div>
    </div>
  );

  const renderPreview = () => (
    <div className="creator-fields">
      {/* Mini invite card preview */}
      <GlassCard className="creator-preview" noPadding>
        <div
          className={`creator-preview__card ${selectedTheme?.className || 'theme-neon'}`}
        >
          <div className="creator-preview__name">
            {name || 'Your Party'}
          </div>
          {tagline && (
            <div className="creator-preview__tagline">{tagline}</div>
          )}
          {date && (
            <div className="creator-preview__date">
              {previewDate()}
              {timeStart && ` · ${previewTime(timeStart)}`}
              {timeEnd && ` – ${previewTime(timeEnd)}`}
            </div>
          )}
          {locationName && (
            <div className="creator-preview__location">📍 {locationName}</div>
          )}
          {hasPersonalDj && djName && (
            <div className="creator-preview__dj">DJ {djName}</div>
          )}
        </div>
      </GlassCard>

      {/* Share actions */}
      <div className="creator-share-buttons">
        <button
          className="creator-share-btn creator-share-btn--copy"
          onClick={handleCopyLink}
          type="button"
        >
          🔗 Copy Invite Link
        </button>
        <button
          className="creator-share-btn creator-share-btn--whatsapp"
          onClick={handleWhatsApp}
          type="button"
        >
          💬 Share to WhatsApp
        </button>
      </div>

      {/* Create CTA */}
      <div className="creator-cta">
        <GlowButton
          variant="purple"
          size="large"
          onClick={handleCreate}
          fullWidth
        >
          Create Party
        </GlowButton>
      </div>
    </div>
  );

  /** Render the current step's content */
  const renderCurrentStep = () => {
    switch (step) {
      case 0: return renderBasics();
      case 1: return renderWhenWhere();
      case 2: return renderVibe();
      case 3: return renderKitty();
      case 4: return renderPreview();
      default: return null;
    }
  };

  const currentStepData = STEPS[step];
  const isFirstStep = step === 0;
  const isLastStep = step === STEPS.length - 1;

  return (
    <div className="creator-page">
      {/* Top bar */}
      <div className="creator-topbar">
        <span className="creator-topbar__logo brand-cursive text-gradient">lowkey</span>
        <button
          className="creator-topbar__close"
          onClick={() => navigate('/')}
          aria-label="Close"
          type="button"
        >
          ✕
        </button>
      </div>

      {/* Step dots */}
      <div className="creator-dots" role="progressbar" aria-valuenow={step + 1} aria-valuemin={1} aria-valuemax={STEPS.length}>
        {STEPS.map((s, i) => (
          <div
            key={s.key}
            className={`creator-dots__dot${i === step ? ' creator-dots__dot--active' : ''}${i < step ? ' creator-dots__dot--done' : ''}`}
          />
        ))}
      </div>

      {/* Step content (keyed for re-mount animation) */}
      <div className="creator-step" key={currentStepData.key}>
        <span className="creator-step__label">{currentStepData.label}</span>
        <h2 className="creator-step__title">{currentStepData.title}</h2>
        {renderCurrentStep()}
      </div>

      <div className="creator-spacer" />

      {/* Back / Next navigation (hidden on last step since CTA is inline) */}
      {!isLastStep && (
        <div className="creator-nav">
          {!isFirstStep ? (
            <button
              className="creator-nav__btn creator-nav__btn--back"
              onClick={goBack}
              type="button"
            >
              ← Back
            </button>
          ) : (
            <span />
          )}
          <button
            className="creator-nav__btn creator-nav__btn--next"
            onClick={goNext}
            disabled={!canProceed()}
            type="button"
          >
            Next →
          </button>
        </div>
      )}

      {isLastStep && (
        <div className="creator-nav">
          <button
            className="creator-nav__btn creator-nav__btn--back"
            onClick={goBack}
            type="button"
          >
            ← Back
          </button>
          <span />
        </div>
      )}

      {/* Toast */}
      {toast && <div className="creator-toast">{toast}</div>}
    </div>
  );
}
