import { useEffect, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getEvents, updateUserProfile, addNotification } from '../utils/storage';
import { formatINR, formatDate, getInitials, getAvatarGradient } from '../utils/helpers';
import { ACHIEVEMENTS, computeStats, earnedKeys } from '../data/achievements';
import AchievementBadge from '../components/AchievementBadge';
import Reveal from '../components/Reveal';
import { useToast } from '../hooks/useToast';
import './ProfilePage.css';

function readCache(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || '[]');
  } catch {
    return [];
  }
}

export default function ProfilePage({ currentUser, setCurrentUser }) {
  const navigate = useNavigate();
  const { show } = useToast();
  const fileRef = useRef(null);
  const persistedRef = useRef(false);

  // Not signed in → send to login
  useEffect(() => {
    if (!currentUser) navigate('/', { state: { tab: 'login', redirect: false } });
  }, [currentUser, navigate]);

  const events = useMemo(() => getEvents(), []);
  const stats = useMemo(
    () =>
      computeStats({
        events,
        rsvps: readCache('lowkey_rsvps'),
        payments: readCache('lowkey_payments'),
        photos: readCache('lowkey_photos'),
        user: currentUser,
      }),
    [events, currentUser]
  );

  const earned = useMemo(() => new Set(earnedKeys(stats)), [stats]);

  const hostedParties = useMemo(() => {
    if (!currentUser) return [];
    const today = new Date().toISOString().split('T')[0];
    return events
      .filter((e) => e.host_id === currentUser.id)
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .map((e) => ({ ...e, expired: e.date < today }));
  }, [events, currentUser]);

  // Persist newly-earned achievements to the profile + notify the user once.
  useEffect(() => {
    if (!currentUser || persistedRef.current) return;
    const stored = new Set((currentUser.achievements || []).map((a) => a.key || a));
    const fresh = [...earned].filter((k) => !stored.has(k));
    if (fresh.length === 0) return;

    persistedRef.current = true;
    const nowIso = new Date().toISOString();
    const merged = [
      ...(currentUser.achievements || []),
      ...fresh.map((key) => ({ key, earned_at: nowIso })),
    ];
    updateUserProfile(currentUser.id, { achievements: merged });
    fresh.forEach((key) => {
      const meta = ACHIEVEMENTS.find((a) => a.key === key);
      addNotification({
        recipient_id: currentUser.id,
        type: 'achievement',
        title: 'Achievement unlocked 🏆',
        body: meta ? `${meta.name} — ${meta.desc}` : 'You earned a new badge',
        link: '/profile',
      });
    });
    show(`Unlocked ${fresh.length} achievement${fresh.length > 1 ? 's' : ''}! 🏆`, 'success');
  }, [earned, currentUser, show]);

  if (!currentUser) return null;

  const handlePicUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      updateUserProfile(currentUser.id, { profile_pic_b64: reader.result });
      setCurrentUser?.({ ...currentUser, profile_pic_b64: reader.result });
      show('Profile photo updated', 'success');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const nextParty = hostedParties.find((p) => !p.expired);
  const earnedCount = earned.size;

  const INSIGHTS = [
    { label: 'Parties hosted', value: stats.partiesHosted, accent: 'purple' },
    { label: 'Upcoming', value: stats.upcoming, accent: 'blue' },
    { label: 'Guests hosted', value: stats.totalGuests, accent: 'pink' },
    { label: 'Collected', value: formatINR(stats.totalCollected), accent: 'lime' },
    { label: 'Avg / party', value: stats.avgGuests, accent: 'blue' },
    { label: 'Parties attended', value: stats.partiesAttended, accent: 'purple' },
  ];

  return (
    <div className="page profile-page">
      {/* Header */}
      <section className="profile-header glass-strong">
        <button
          className="profile-avatar-btn"
          onClick={() => fileRef.current?.click()}
          title="Change photo"
          type="button"
        >
          {currentUser.profile_pic_b64 ? (
            <img src={currentUser.profile_pic_b64} alt={currentUser.name} className="profile-avatar-img" />
          ) : (
            <span className="profile-avatar-fallback" style={{ background: getAvatarGradient(currentUser.name || 'U') }}>
              {getInitials(currentUser.name || 'U')}
            </span>
          )}
          <span className="profile-avatar-edit">✎</span>
        </button>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={handlePicUpload} />

        <div className="profile-identity">
          <h1 className="profile-name">{currentUser.name}</h1>
          {currentUser.username && <p className="profile-username">@{currentUser.username}</p>}
          <div className="profile-chips">
            {stats.ageVerified && <span className="profile-chip profile-chip--lime">✓ 21+ Verified</span>}
            <span className="profile-chip">🏆 {earnedCount}/{ACHIEVEMENTS.length} badges</span>
          </div>
        </div>

        <button className="profile-create-btn" onClick={() => navigate('/create')} type="button">
          + New party
        </button>
      </section>

      {/* Next party highlight */}
      {nextParty && (
        <Link to={`/party/${nextParty.id}`} className="profile-next glass pressable">
          <div>
            <span className="profile-next__label">Your next party</span>
            <h3 className="profile-next__name">{nextParty.name}</h3>
            <p className="profile-next__meta">{formatDate(nextParty.date)} · {nextParty.location_name || 'TBA'}</p>
          </div>
          <span className="profile-next__arrow">→</span>
        </Link>
      )}

      {/* Insights */}
      <Reveal as="section" className="profile-section" variant="up">
        <h2 className="profile-section__title">Host Insights</h2>
        <div className="profile-insights">
          {INSIGHTS.map((s) => (
            <div key={s.label} className={`profile-stat profile-stat--${s.accent}`}>
              <span className="profile-stat__value">{s.value}</span>
              <span className="profile-stat__label">{s.label}</span>
            </div>
          ))}
        </div>
      </Reveal>

      {/* Achievements */}
      <Reveal as="section" className="profile-section" variant="up">
        <div className="profile-section__row">
          <h2 className="profile-section__title">Achievements</h2>
          <span className="profile-section__meta">{earnedCount} of {ACHIEVEMENTS.length} unlocked</span>
        </div>
        <div className="profile-badges">
          {ACHIEVEMENTS.map((a) => (
            <AchievementBadge key={a.key} achievement={a} earned={earned.has(a.key)} />
          ))}
        </div>
      </Reveal>

      {/* Hosted parties */}
      <Reveal as="section" className="profile-section" variant="up">
        <h2 className="profile-section__title">Your Parties</h2>
        {hostedParties.length === 0 ? (
          <div className="profile-empty glass">
            <p>You haven't hosted a party yet.</p>
            <button className="profile-empty__btn" onClick={() => navigate('/create')} type="button">
              Throw your first one
            </button>
          </div>
        ) : (
          <div className="profile-party-list">
            {hostedParties.map((p) => (
              <Link key={p.id} to={`/party/${p.id}`} className={`profile-party glass pressable ${p.expired ? 'is-expired' : ''}`}>
                <div className={`profile-party__accent theme-${p.theme || 'neon'}`} />
                <div className="profile-party__body">
                  <h4 className="profile-party__name">{p.name}</h4>
                  <p className="profile-party__meta">{formatDate(p.date)}{p.expired ? ' · wrapped' : ''}</p>
                </div>
                <span className="profile-party__arrow">→</span>
              </Link>
            ))}
          </div>
        )}
      </Reveal>
    </div>
  );
}
