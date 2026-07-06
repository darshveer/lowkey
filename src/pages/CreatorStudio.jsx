import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import GlassCard from '../components/GlassCard';
import AddressSearch from '../components/AddressSearch';
import LocationPicker from '../components/LocationPicker';
import { generateId, shareLink, shareToWhatsApp } from '../utils/helpers';
import { saveEvent, getCurrentUser } from '../utils/storage';
import { DISCOVERY_CITIES, PARTY_THEMES } from '../data/mockData';
import SvgDecor from '../components/SvgDecor';
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
  const [customTags, setCustomTags] = useState([]);
  const [removedTags, setRemovedTags] = useState([]);
  const [tagInput, setTagInput] = useState('');
  const [date, setDate] = useState('');
  const [timeStart, setTimeStart] = useState('');
  const [timeEnd, setTimeEnd] = useState('');
  const [city, setCity] = useState('Bengaluru');
  const [locationName, setLocationName] = useState('');
  const [locationAddress, setLocationAddress] = useState('');
  const [locationLat, setLocationLat] = useState(null);
  const [locationLng, setLocationLng] = useState(null);
  const [mapTarget, setMapTarget] = useState(null); // fly-to target for the map picker
  const [theme, setTheme] = useState('neon');
  const [vibeOption, setVibeOption] = useState('');
  const [customVibe, setCustomVibe] = useState('');
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
  const [externalPhotoLink, setExternalPhotoLink] = useState('');

  /** Returns true if end time is on the next day relative to start time */
  const isNextDay = timeStart && timeEnd && timeEnd < timeStart;

  const SUGGESTED_TAGS = ['21+', 'House Party', 'Late Night', 'Techno', 'Bollywood', 'Aesthetic', 'Chill', 'Games', 'BYOB', 'Rooftop', 'Pool Party'];

  // Derive tags from current choices
  const derivedAutoTags = useMemo(() => {
    const tags = [];
    if (city && city !== 'All') tags.push(city);
    const finalVibe = vibeOption === 'custom' ? customVibe : vibeOption;
    if (finalVibe) tags.push(finalVibe);
    if (containsAlcohol) tags.push('BYOB');
    if (hasPersonalDj) tags.push('DJ Set');
    if (coverCharge && Number(coverCharge) > 0) tags.push('Cover Charge');
    if (theme && theme !== 'none') {
      const themeName = PARTY_THEMES.find(t => t.id === theme)?.name;
      if (themeName) tags.push(themeName);
    }
    return tags.filter(Boolean);
  }, [city, vibeOption, customVibe, containsAlcohol, hasPersonalDj, coverCharge, theme]);

  // Combined tags: auto-derived (filtered by blacklist) + custom tags
  const activeTags = useMemo(() => {
    const filteredAuto = derivedAutoTags.filter(tag => !removedTags.includes(tag));
    return [...new Set([...filteredAuto, ...customTags])];
  }, [derivedAutoTags, removedTags, customTags]);

  const handleToggleTag = (tag) => {
    const normalized = tag.trim();
    if (!normalized) return;

    if (activeTags.includes(normalized)) {
      if (derivedAutoTags.includes(normalized)) {
        setRemovedTags(prev => [...prev, normalized]);
      } else {
        setCustomTags(prev => prev.filter(t => t !== normalized));
      }
    } else {
      if (derivedAutoTags.includes(normalized)) {
        setRemovedTags(prev => prev.filter(t => t !== normalized));
      } else {
        setCustomTags(prev => [...prev, normalized]);
      }
    }
  };

  const handleAddCustomTag = (e) => {
    e?.preventDefault();
    const clean = tagInput.trim();
    if (!clean) return;
    if (!activeTags.includes(clean)) {
      if (derivedAutoTags.includes(clean)) {
        setRemovedTags(prev => prev.filter(t => t !== clean));
      } else {
        setCustomTags(prev => [...prev, clean]);
      }
    }
    setTagInput('');
  };

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
      tagline: activeTags.map(t => '#' + t).join(' '),
      date,
      time_start: timeStart,
      time_end: timeEnd,
      time_end_next_day: isNextDay,
      city,
      location_name: locationName.trim(),
      location_address: locationAddress.trim(),
      location_lat: locationLat,
      location_lng: locationLng,
      theme,
      spotify_playlist_url: spotifyUrl.trim() || null,
      upi_id: upiId.trim() || null,
      cover_charge: coverCharge ? Number(coverCharge) : 0,
      capacity: capacity ? Number(capacity) : null,
      discoverable: true,
      vibe_tags: activeTags,
      has_personal_dj: hasPersonalDj,
      dj_name: hasPersonalDj ? djName.trim() : '',
      dj_genre: hasPersonalDj ? djGenre.trim() : '',
      dj_profile_url: hasPersonalDj ? djProfileUrl.trim() : '',
      dj_instagram: hasPersonalDj ? djInstagram.trim() : '',
      status: 'live',
      photo_dump_unlocked: false,
      contains_alcohol: containsAlcohol,
      external_photo_link: externalPhotoLink.trim() || null,
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
        <label className="creator-field__label">Party Tags <span style={{ fontWeight: 400, textTransform: 'none', opacity: 0.6 }}>(instead of tagline)</span></label>
        
        {/* Active tags pills */}
        <div className="creator-tags-list">
          {activeTags.map(tag => (
            <span key={tag} className="creator-tag-chip">
              #{tag.toLowerCase()}
              <button type="button" className="creator-tag-chip__remove" onClick={() => handleToggleTag(tag)}>✕</button>
            </span>
          ))}
          {activeTags.length === 0 && (
            <span className="creator-tags-empty">No tags added yet. Auto-tags will populate as you fill options!</span>
          )}
        </div>

        {/* Input box */}
        <div className="creator-tag-input-row">
          <input
            className="input-glass creator-tag-input"
            type="text"
            placeholder="add custom tag..."
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddCustomTag();
              }
            }}
            maxLength={20}
          />
          <button type="button" className="creator-tag-add-btn" onClick={handleAddCustomTag}>Add</button>
        </div>

        {/* Suggested tags */}
        <div className="creator-tag-suggestions-label">Suggestions</div>
        <div className="creator-tag-suggestions">
          {SUGGESTED_TAGS.map(tag => {
            const isSelected = activeTags.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                className={`creator-tag-suggest-btn ${isSelected ? 'selected' : ''}`}
                onClick={() => handleToggleTag(tag)}
              >
                {tag}
              </button>
            );
          })}
        </div>
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
          <label className="creator-field__label">
            End
            {isNextDay && (
              <span className="creator-next-day-badge">+1 day</span>
            )}
          </label>
          <input
            className="input-glass"
            type="time"
            value={timeEnd}
            onChange={(e) => setTimeEnd(e.target.value)}
          />
          {isNextDay && (
            <span className="creator-next-day-hint">Party goes past midnight into the next day</span>
          )}
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
        <AddressSearch
          value={locationAddress}
          placeholder="Search address on OpenStreetMap…"
          onChange={(v) => setLocationAddress(v)}
          onSelect={(place) => {
            setLocationAddress(place.label);
            setLocationLat(place.lat);
            setLocationLng(place.lng);
            if (!locationName.trim()) setLocationName(place.name);
            // Fly the map to the searched place so the pin can be fine-tuned.
            setMapTarget({ lat: place.lat, lng: place.lng });
          }}
        />
        <p className="creator-field__hint">
          Search a place, then drag the map to drop an exact pin. Guests get a live map & directions.
        </p>
      </div>

      <div className="creator-field">
        <LocationPicker
          target={mapTarget}
          onConfirm={({ lat, lng, address }) => {
            setLocationLat(lat);
            setLocationLng(lng);
            if (address) setLocationAddress(address);
          }}
        />
      </div>
    </div>
  );

  // Built-in vibe options
  const VIBE_OPTIONS = [
    { value: '', label: 'Pick a vibe...' },
    { value: 'rooftop', label: 'Rooftop' },
    { value: 'house party', label: 'House Party' },
    { value: 'sundowner', label: 'Sundowner' },
    { value: 'late night', label: 'Late Night' },
    { value: 'pool party', label: 'Pool Party' },
    { value: 'birthday', label: 'Birthday' },
    { value: 'potluck', label: 'Potluck' },
    { value: 'bonfire', label: 'Bonfire' },
    { value: 'custom', label: 'Custom...' },
  ];

  const renderVibe = () => (
    <div className="creator-fields">
      {/* Visual theme selector grid */}
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

      {/* Vibe dropdown */}
      <div className="creator-field">
        <label className="creator-field__label">Party Vibe</label>
        <select
          className="input-glass"
          value={vibeOption}
          onChange={(e) => setVibeOption(e.target.value)}
        >
          {VIBE_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        {vibeOption === 'custom' && (
          <input
            className="input-glass"
            type="text"
            placeholder="describe your vibe..."
            value={customVibe}
            onChange={(e) => setCustomVibe(e.target.value)}
            maxLength={60}
            style={{ marginTop: 'var(--space-sm)' }}
            autoFocus
          />
        )}
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

      <div className="creator-field" style={{ marginTop: 'var(--space-xl)' }}>
        <label className="creator-field__label">External Photo Dump Link (Optional)</label>
        <input
          className="input-glass"
          type="url"
          placeholder="Google Drive, Apple Photos album link"
          value={externalPhotoLink}
          onChange={(e) => setExternalPhotoLink(e.target.value)}
        />
        <div className="creator-tip" style={{ marginTop: 'var(--space-sm)' }}>
          <span className="creator-tip__text">
            To save data, you can host your images externally. If provided, guests will be redirected to this link instead of uploading locally.
          </span>
        </div>
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
          {activeTags.length > 0 && (
            <div className="creator-preview__tags">
              {activeTags.map(tag => (
                <span key={tag} className="preview-tag-chip">#{tag.toLowerCase()}</span>
              ))}
            </div>
          )}
          {date && (
            <div className="creator-preview__date">
              {previewDate()}
              {timeStart && ` · ${previewTime(timeStart)}`}
              {timeEnd && ` – ${previewTime(timeEnd)}`}
              {isNextDay && <span style={{ marginLeft: '6px', fontSize: '0.75em', opacity: 0.7, fontWeight: 700 }}>+1</span>}
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
        <button
          className="creator-create-btn"
          onClick={handleCreate}
          type="button"
        >
          Create Party
        </button>
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
      <SvgDecor variant="grid" />

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
