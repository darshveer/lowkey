/**
 * App configuration data (cities + poster themes).
 * All placeholder parties/users have been removed — the app now shows only
 * real, user-created parties committed to Supabase.
 */

export const DISCOVERY_CITIES = [
  'All',
  'Bengaluru',
  'Mumbai',
  'Delhi NCR',
  'Pune',
  'Hyderabad',
  'Goa',
];

/**
 * Theme gradient configs for poster selection
 */
export const PARTY_THEMES = [
  {
    id: 'neon',
    name: 'Neon Night',
    className: 'theme-neon',
    emoji: '💜',
    description: 'Purple neon glow',
  },
  {
    id: 'retro',
    name: 'Retro Wave',
    className: 'theme-retro',
    emoji: '🌅',
    description: 'Warm vintage vibes',
  },
  {
    id: 'minimal',
    name: 'Midnight',
    className: 'theme-minimal',
    emoji: '🖤',
    description: 'Clean & dark',
  },
  {
    id: 'psychedelic',
    name: 'Psychedelic',
    className: 'theme-psychedelic',
    emoji: '🍄',
    description: 'Trippy color shifts',
  },
];

// Placeholder ids seeded by earlier demo builds — purged from local caches below.
const LEGACY_PLACEHOLDER_EVENT_IDS = ['party_xK9mQ2', 'party_aB3nY7'];

// Stray mock parties that only ever lived in localStorage (never synced to
// Supabase), matched by name since their ids differ per browser.
const MOCK_EVENT_NAMES = ['here'];

/**
 * One-time cleanup of legacy placeholder data (Arjun Mehta + demo parties) that
 * older builds seeded into localStorage. Also clears any stale auto-login session
 * so it can't shadow real Supabase Auth. Safe to call on every load.
 */
export function clearLegacyPlaceholders() {
  try {
    const purge = (key, keep) => {
      const arr = JSON.parse(localStorage.getItem(key) || '[]');
      if (!Array.isArray(arr)) return;
      const filtered = arr.filter(keep);
      if (filtered.length !== arr.length) {
        localStorage.setItem(key, JSON.stringify(filtered));
      }
    };

    // Collect ids to purge: known legacy ids + any local mock party matched by name.
    const purgeIds = new Set(LEGACY_PLACEHOLDER_EVENT_IDS);
    const events = JSON.parse(localStorage.getItem('lowkey_events') || '[]');
    if (Array.isArray(events)) {
      events.forEach((e) => {
        if (MOCK_EVENT_NAMES.includes(String(e?.name || '').trim().toLowerCase())) {
          purgeIds.add(e.id);
        }
      });
    }

    purge('lowkey_events', (e) => !purgeIds.has(e.id));
    purge('lowkey_rsvps', (r) => !purgeIds.has(r.event_id));
    purge('lowkey_expenses', (x) => !purgeIds.has(x.event_id));
    purge('lowkey_photos', (p) => !purgeIds.has(p.event_id));
    purge('lowkey_comments', (c) => !purgeIds.has(c.event_id));
    purge('lowkey_announcements', (a) => !purgeIds.has(a.event_id));
    purge('lowkey_song_requests', (s) => !purgeIds.has(s.event_id));

    // Remove the old mock "arjun" user and any stale non-Supabase session.
    const users = JSON.parse(localStorage.getItem('lowkey_users') || '[]');
    if (Array.isArray(users)) {
      const cleaned = users.filter((u) => u.username !== 'arjun' && u.id !== 'host_001');
      if (cleaned.length !== users.length) {
        localStorage.setItem('lowkey_users', JSON.stringify(cleaned));
      }
    }
    const session = JSON.parse(localStorage.getItem('lowkey_session') || 'null');
    if (session && (session.username === 'arjun' || session.id === 'host_001')) {
      localStorage.removeItem('lowkey_session');
    }
    localStorage.removeItem('lowkey_seeded');
  } catch (e) {
    console.warn('clearLegacyPlaceholders failed:', e);
  }
}
