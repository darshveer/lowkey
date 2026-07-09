import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getEvents, updateUserProfile, addNotification, duplicateEvent, resyncToCloud, deleteMyAccount } from '../utils/storage';
import { formatINR, formatDate, getInitials, getAvatarGradient, safeImageSrc } from '../utils/helpers';
import { ACHIEVEMENTS, computeStats, earnedKeys } from '../data/achievements';
import AchievementBadge from '../components/AchievementBadge';
import Reveal from '../components/Reveal';
import ConfirmDialog from '../components/ConfirmDialog';
import { useToast } from '../hooks/useToast';
import { useTransition } from '../hooks/useTransition';
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
  const { playTransition } = useTransition();
  const fileRef = useRef(null);
  const persistedRef = useRef(false);
  const [resyncing, setResyncing] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleConfirmDelete = async () => {
    setDeleteOpen(false);
    setDeleting(true);
    let result;
    // The curtain covers the screen while the account and all its data are wiped.
    await playTransition(async () => {
      result = await deleteMyAccount();
      if (result.success) {
        setCurrentUser?.(null);
        navigate('/');
      }
    });
    setDeleting(false);
    if (result && !result.success) {
      show(`Couldn't delete your account — ${result.error}`, 'error', 9000);
    } else if (result?.success) {
      show('Your account and all its data were permanently deleted.', 'success', 6000);
    }
  };

  const handleResync = async () => {
    setResyncing(true);
    show('Re-syncing with the cloud…', 'info');
    try {
      const { pushed, failed, firstError } = await resyncToCloud();
      if (failed > 0 && firstError) {
        console.error('Re-sync error:', firstError);
        show(`Synced ${pushed}, ${failed} failed — ${firstError}`, 'error', 9000);
      } else if (pushed === 0) {
        show('Nothing to sync — no parties hosted by you on this device.', 'info', 5000);
      } else {
        show(`Re-synced ${pushed} item${pushed > 1 ? 's' : ''} to the cloud.`, 'success', 5000);
      }
    } catch (e) {
      show(`Re-sync failed — ${e.message || 'check your connection'}.`, 'error');
    } finally {
      setResyncing(false);
    }
  };

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

  // Hosted-parties tabs + search. "Archived" = explicitly archived; "Active" =
  // everything else (upcoming + wrapped-but-not-archived).
  const [partyTab, setPartyTab] = useState('active');
  const [partyQuery, setPartyQuery] = useState('');

  const visibleParties = useMemo(() => {
    const q = partyQuery.trim().toLowerCase();
    return hostedParties
      .filter((p) => (partyTab === 'archived' ? p.archived : !p.archived))
      .filter((p) => {
        if (!q) return true;
        const haystack = [
          p.name,
          p.location_name,
          p.location_address,
          p.city,
          ...(p.vibe_tags || []),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(q);
      });
  }, [hostedParties, partyTab, partyQuery]);

  const activeCount = useMemo(() => hostedParties.filter((p) => !p.archived).length, [hostedParties]);
  const archivedCount = useMemo(() => hostedParties.filter((p) => p.archived).length, [hostedParties]);

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
        title: 'Achievement unlocked',
        body: meta ? `${meta.name} — ${meta.desc}` : 'You earned a new badge',
        link: '/profile',
      });
    });
    show(`Unlocked ${fresh.length} achievement${fresh.length > 1 ? 's' : ''}!`, 'success');
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
          {safeImageSrc(currentUser.profile_pic_b64, { allowRemote: false }) ? (
            <img src={safeImageSrc(currentUser.profile_pic_b64, { allowRemote: false })} alt={currentUser.name} className="profile-avatar-img" />
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

        <div className="profile-header-actions">
          <button className="profile-create-btn" onClick={() => navigate('/create')} type="button">
            + New party
          </button>
          <button
            className="profile-resync-btn"
            onClick={handleResync}
            disabled={resyncing}
            type="button"
            title="Re-push your local data to the cloud and pull the latest"
          >
            {resyncing ? '☁️ Syncing…' : '☁️ Re-sync'}
          </button>
        </div>
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
          <>
            <div className="profile-party-tabs">
              <button
                type="button"
                className={`profile-party-tab${partyTab === 'active' ? ' is-active' : ''}`}
                onClick={() => setPartyTab('active')}
              >
                Active <span className="profile-party-tab__count">{activeCount}</span>
              </button>
              <button
                type="button"
                className={`profile-party-tab${partyTab === 'archived' ? ' is-active' : ''}`}
                onClick={() => setPartyTab('archived')}
              >
                Archived <span className="profile-party-tab__count">{archivedCount}</span>
              </button>
            </div>

            <div className="profile-party-search">
              <input
                className="profile-party-search__input"
                type="search"
                value={partyQuery}
                onChange={(e) => setPartyQuery(e.target.value)}
                placeholder="Search your parties by name, venue, city or tag…"
                aria-label="Search your hosted parties"
              />
            </div>

            {visibleParties.length === 0 ? (
              <div className="profile-empty glass">
                <p>
                  {partyQuery.trim()
                    ? `No ${partyTab} parties match "${partyQuery.trim()}".`
                    : partyTab === 'archived'
                      ? 'No archived parties yet.'
                      : 'No active parties right now.'}
                </p>
              </div>
            ) : (
              <div className="profile-party-list">
                {visibleParties.map((p) => (
                  <div key={p.id} className={`profile-party glass ${p.expired ? 'is-expired' : ''}`}>
                    <Link to={`/party/${p.id}`} className="profile-party__link pressable">
                      <div className={`profile-party__accent theme-${p.theme || 'neon'}`} />
                      <div className="profile-party__body">
                        <h4 className="profile-party__name">{p.name}</h4>
                        <p className="profile-party__meta">
                          {formatDate(p.date)}
                          {p.archived ? ' · archived' : p.expired ? ' · wrapped' : ''}
                        </p>
                      </div>
                    </Link>
                    <button
                      type="button"
                      className="profile-party__dup"
                      title="Duplicate as a template"
                      onClick={() => {
                        const copy = duplicateEvent(p.id, currentUser);
                        if (copy) {
                          show('Party duplicated — set a new date', 'success');
                          navigate(`/party/${copy.id}`);
                        }
                      }}
                    >
                      ⧉ Duplicate
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </Reveal>

      {/* Danger zone — permanent account deletion */}
      <Reveal as="section" className="profile-section profile-danger" variant="up">
        <h2 className="profile-section__title">Danger Zone</h2>
        <div className="profile-danger__card glass">
          <div className="profile-danger__text">
            <h3 className="profile-danger__title">Delete account</h3>
            <p className="profile-danger__desc">
              Permanently deletes your login, profile, every party you host (and its guests’
              RSVPs, payments, and photos), plus your own RSVPs, comments, and follows. This
              cannot be undone.
            </p>
          </div>
          <button
            type="button"
            className="profile-danger__btn"
            onClick={() => setDeleteOpen(true)}
            disabled={deleting}
          >
            {deleting ? 'Deleting…' : 'Delete account'}
          </button>
        </div>
      </Reveal>

      <ConfirmDialog
        open={deleteOpen}
        title="Delete your account?"
        message="This permanently erases your account and everything tied to it — your hosted parties and their guests’ data, your RSVPs, comments, and follows. This action cannot be undone."
        confirmLabel="Delete forever"
        cancelLabel="Keep my account"
        danger
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteOpen(false)}
      />
    </div>
  );
}
