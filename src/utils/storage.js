/**
 * LocalStorage helpers for LowKey with Supabase Sync
 * Provides typed get/set with JSON serialization and background Supabase persistence
 */
import { supabase } from './supabase';
import { generateId } from './helpers';

const STORAGE_PREFIX = 'lowkey_';
const PHOTO_BUCKET = 'party-photos';

/**
 * Save data to localStorage
 * @param {string} key
 * @param {*} value - Will be JSON-serialized
 */
export function save(key, value) {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
  } catch (e) {
    console.warn('Storage save failed:', e);
  }
}

/**
 * Load data from localStorage
 * @param {string} key
 * @param {*} fallback - Default value if key doesn't exist
 * @returns {*} Parsed value or fallback
 */
export function load(key, fallback = null) {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    console.warn('Storage load failed:', e);
    return fallback;
  }
}

/**
 * Remove a key from localStorage
 * @param {string} key
 */
export function remove(key) {
  localStorage.removeItem(STORAGE_PREFIX + key);
}

/**
 * Get all events from storage
 * @returns {Array} Array of event objects
 */
export function getEvents() {
  return load('events', []);
}

/**
 * Save an event (create or update)
 * @param {Object} event
 */
export function saveEvent(event) {
  const events = getEvents();
  const idx = events.findIndex(e => e.id === event.id);
  let updatedEvent;
  
  if (idx >= 0) {
    updatedEvent = { ...events[idx], ...event, updated_at: new Date().toISOString() };
    events[idx] = updatedEvent;
  } else {
    updatedEvent = { 
      ...event, 
      created_at: new Date().toISOString(), 
      updated_at: new Date().toISOString() 
    };
    events.push(updatedEvent);
  }
  save('events', events);

  // Background write to Supabase
  supabase.from('events').upsert(updatedEvent).then(({ error }) => {
    if (error) console.warn('Supabase saveEvent failed, using offline cache:', error.message);
  });
}

/**
 * Get a single event by ID
 * @param {string} id
 * @returns {Object|null}
 */
export function getEvent(id) {
  return getEvents().find(e => e.id === id) || null;
}

/**
 * Get RSVPs for an event
 * @param {string} eventId
 * @returns {Array}
 */
export function getRSVPs(eventId) {
  const all = load('rsvps', []);
  return all.filter(r => r.event_id === eventId);
}

/**
 * Add an RSVP
 * @param {Object} rsvp
 */
export function addRSVP(rsvp) {
  const all = load('rsvps', []);
  const newRsvp = { ...rsvp, created_at: new Date().toISOString() };
  all.push(newRsvp);
  save('rsvps', all);

  // Background write to Supabase
  supabase.from('rsvps').insert(newRsvp).then(({ error }) => {
    if (error) console.warn('Supabase addRSVP failed, using offline cache:', error.message);
  });

  // Notify the host of the new RSVP
  if (newRsvp.status === 'going') {
    const ev = getEvent(newRsvp.event_id);
    notifyHost(newRsvp.event_id, newRsvp.user_id, {
      type: 'rsvp',
      title: 'New RSVP 🎉',
      body: `${newRsvp.guest_name} is coming${ev ? ` to ${ev.name}` : ''}${newRsvp.guest_count > 1 ? ` (+${newRsvp.guest_count - 1})` : ''}`,
    });
  }
}

/**
 * Update an RSVP
 * @param {string} rsvpId
 * @param {Object} updates
 */
export function updateRSVP(rsvpId, updates) {
  const all = load('rsvps', []);
  const idx = all.findIndex(r => r.id === rsvpId);
  if (idx >= 0) {
    all[idx] = { ...all[idx], ...updates, updated_at: new Date().toISOString() };
    save('rsvps', all);

    // Background write to Supabase
    supabase.from('rsvps').update(updates).eq('id', rsvpId).then(({ error }) => {
      if (error) console.warn('Supabase updateRSVP failed:', error.message);
    });
  }
}

/**
 * Delete an RSVP
 * @param {string} rsvpId
 */
export function deleteRSVP(rsvpId) {
  const all = load('rsvps', []);
  const filtered = all.filter(r => r.id !== rsvpId);
  save('rsvps', filtered);

  // Background write to Supabase
  supabase.from('rsvps').delete().eq('id', rsvpId).then(({ error }) => {
    if (error) console.warn('Supabase deleteRSVP failed:', error.message);
  });
}

/**
 * Get expenses for an event
 * @param {string} eventId
 * @returns {Array}
 */
export function getExpenses(eventId) {
  const all = load('expenses', []);
  return all.filter(e => e.event_id === eventId);
}

/**
 * Add an expense
 * @param {Object} expense
 */
export function addExpense(expense) {
  const all = load('expenses', []);
  const newExpense = { ...expense, created_at: new Date().toISOString() };
  all.push(newExpense);
  save('expenses', all);

  // Background write to Supabase
  supabase.from('expenses').insert(newExpense).then(({ error }) => {
    if (error) console.warn('Supabase addExpense failed, using offline cache:', error.message);
  });
}

/**
 * Get photos for an event, automatically cleaning up photos older than 3 days
 * @param {string} eventId
 * @returns {Array}
 */
export function getPhotos(eventId) {
  let all = load('photos', []);
  const event = getEvent(eventId);
  
  if (event && event.date) {
    // Determine the party end time
    const eventEndDate = new Date(event.date);
    if (event.time_end) {
      const [h, m] = event.time_end.split(':').map(Number);
      eventEndDate.setHours(h, m, 0, 0);
      if (event.time_end_next_day) {
        eventEndDate.setDate(eventEndDate.getDate() + 1);
      }
    } else {
      // Fallback: 24h after event date
      eventEndDate.setDate(eventEndDate.getDate() + 1);
    }

    const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
    const expirationDateMs = eventEndDate.getTime() + threeDaysMs;
    const nowMs = new Date().getTime();

    // If current time is past expiration, delete all photos for this event
    if (nowMs > expirationDateMs) {
      const photosToDelete = all.filter(p => p.event_id === eventId);
      if (photosToDelete.length > 0) {
        all = all.filter(p => p.event_id !== eventId);
        save('photos', all);
        // Delete from Supabase
        photosToDelete.forEach(p => {
          supabase.from('photos').delete().eq('id', p.id).then(() => {});
        });
      }
    }
  }

  return all.filter(p => p.event_id === eventId);
}

/**
 * Upload a photo file to Supabase Storage and return its public URL.
 * Returns null on failure so callers can fall back to a local base64 copy.
 * @param {File} file
 * @param {string} eventId
 * @returns {Promise<{ url: string, path: string }|null>}
 */
export async function uploadPhotoFile(file, eventId) {
  try {
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const path = `${eventId}/${generateId()}.${ext}`;
    const { error } = await supabase.storage
      .from(PHOTO_BUCKET)
      .upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type || undefined });
    if (error) {
      console.warn('Storage upload failed, falling back to local copy:', error.message);
      return null;
    }
    const { data } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path);
    return { url: data.publicUrl, path };
  } catch (e) {
    console.warn('uploadPhotoFile error:', e);
    return null;
  }
}

/**
 * Add a photo
 * @param {Object} photo
 */
export function addPhoto(photo) {
  const all = load('photos', []);
  const newPhoto = { ...photo, created_at: new Date().toISOString() };
  all.push(newPhoto);
  save('photos', all);

  // Background write to Supabase
  supabase.from('photos').insert(newPhoto).then(({ error }) => {
    if (error) console.warn('Supabase addPhoto failed, using offline cache:', error.message);
  });

  // Notify the host of the new photo
  notifyHost(newPhoto.event_id, newPhoto.uploaded_by_id, {
    type: 'photo',
    title: 'New photo dropped 📸',
    body: `${newPhoto.uploaded_by || 'A guest'} added to the camera dump`,
  });
}

/**
 * Get payments for an event
 * @param {string} eventId
 * @returns {Array}
 */
export function getPayments(eventId) {
  const all = load('payments', []);
  return all.filter(p => p.event_id === eventId);
}

/**
 * Add a payment record
 * @param {Object} payment
 */
export function addPayment(payment) {
  const all = load('payments', []);
  const newPayment = { ...payment, created_at: new Date().toISOString() };
  all.push(newPayment);
  save('payments', all);

  // Background write to Supabase
  supabase.from('payments').insert(newPayment).then(({ error }) => {
    if (error) console.warn('Supabase addPayment failed, using offline cache:', error.message);
  });

  // Notify the host of the payment
  notifyHost(newPayment.event_id, null, {
    type: 'payment',
    title: 'Payment received 💸',
    body: `${newPayment.paid_by || 'A guest'} paid ₹${Number(newPayment.amount || 0).toLocaleString('en-IN')}`,
  });
}

// ============================================================
//  Comments / Vibe Wall
// ============================================================

/** Get comments (vibe wall) for an event, newest first. */
export function getComments(eventId) {
  const all = load('comments', []);
  return all
    .filter(c => c.event_id === eventId)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

/** Add a comment to an event's vibe wall. */
export function addComment(comment) {
  const all = load('comments', []);
  const newComment = {
    id: `cmt_${generateId()}`,
    ...comment,
    created_at: new Date().toISOString(),
  };
  all.push(newComment);
  save('comments', all);

  supabase.from('comments').insert(newComment).then(({ error }) => {
    if (error) console.warn('Supabase addComment failed, using offline cache:', error.message);
  });

  // Notify the host of the new vibe-wall post
  notifyHost(newComment.event_id, newComment.author_id, {
    type: 'comment',
    title: 'New vibe wall post 💬',
    body: `${newComment.author_name || 'Someone'}: ${String(newComment.body || '').slice(0, 60)}`,
  });
  return newComment;
}

// ============================================================
//  Realtime — live RSVPs, photos, and comments per event
// ============================================================

/**
 * Subscribe to live changes for an event. Pass any of onRsvp / onPhoto / onComment.
 * Each handler receives the Supabase payload ({ eventType, new, old }).
 * @returns {() => void} unsubscribe
 */
export function subscribeToEvent(eventId, handlers = {}) {
  const channel = supabase.channel(`event:${eventId}`);
  const tables = { rsvps: handlers.onRsvp, photos: handlers.onPhoto, comments: handlers.onComment };

  Object.entries(tables).forEach(([table, handler]) => {
    if (!handler) return;
    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table, filter: `event_id=eq.${eventId}` },
      handler
    );
  });

  channel.subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

// ============================================================
//  Notifications
// ============================================================

/** All notifications for a user, newest first. */
export function getNotifications(userId) {
  if (!userId) return [];
  return load('notifications', [])
    .filter(n => n.recipient_id === userId)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

/** Count of unread notifications for a user. */
export function unreadNotificationCount(userId) {
  return getNotifications(userId).filter(n => !n.read).length;
}

/** Create a notification for a recipient (local cache + Supabase). */
export function addNotification({ recipient_id, type, title, body, event_id = null, link = null }) {
  if (!recipient_id) return null;
  const all = load('notifications', []);
  const notification = {
    id: `ntf_${generateId()}`,
    recipient_id,
    type,
    title,
    body,
    event_id,
    link,
    read: false,
    created_at: new Date().toISOString(),
  };
  all.push(notification);
  save('notifications', all);

  supabase.from('notifications').insert(notification).then(({ error }) => {
    if (error) console.warn('addNotification failed:', error.message);
  });
  window.dispatchEvent(new CustomEvent('lowkey_notifications'));
  return notification;
}

/** Mark all of a user's notifications as read. */
export function markNotificationsRead(userId) {
  if (!userId) return;
  const all = load('notifications', []);
  let changed = false;
  const updated = all.map(n => {
    if (n.recipient_id === userId && !n.read) {
      changed = true;
      return { ...n, read: true };
    }
    return n;
  });
  if (!changed) return;
  save('notifications', updated);
  supabase.from('notifications').update({ read: true })
    .eq('recipient_id', userId).eq('read', false)
    .then(({ error }) => { if (error) console.warn('markNotificationsRead failed:', error.message); });
  window.dispatchEvent(new CustomEvent('lowkey_notifications'));
}

/** Subscribe to realtime notification inserts for a user. */
export function subscribeToNotifications(userId, handler) {
  if (!userId) return () => {};
  const channel = supabase
    .channel(`notifications:${userId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${userId}` },
      handler
    )
    .subscribe();
  return () => supabase.removeChannel(channel);
}

/** Notify a party's host about guest activity (skips notifying the actor). */
function notifyHost(eventId, actorId, payload) {
  const ev = getEvent(eventId);
  if (!ev || !ev.host_id) return;
  if (actorId && ev.host_id === actorId) return;
  addNotification({ recipient_id: ev.host_id, event_id: eventId, link: `/party/${eventId}`, ...payload });
}

// ============================================================
//  Authentication — Supabase Auth
//  Passwords are handled entirely by Supabase Auth (hashed in auth.users).
//  We keep a synchronous local cache of the *profile* (never the password) so
//  getCurrentUser() can stay synchronous for React state initializers.
// ============================================================

/** Cache (or clear) the signed-in profile locally. */
function cacheSession(profile) {
  if (profile) save('session', profile);
  else remove('session');
}

/** Fetch the app profile row for an auth user id. */
async function fetchProfile(id) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) {
    console.warn('fetchProfile failed:', error.message);
    return null;
  }
  return data;
}

/** Build a minimal profile from an auth user (fallback before the row syncs). */
function profileFromAuthUser(user) {
  const meta = user.user_metadata || {};
  return {
    id: user.id,
    email: user.email,
    name: meta.name || (user.email ? user.email.split('@')[0] : 'Guest'),
    username: meta.username || null,
    birthdate: meta.birthdate || null,
    phone: meta.phone || null,
    profile_pic_b64: meta.profile_pic_b64 || null,
  };
}

/**
 * Register a new user via Supabase Auth. A DB trigger creates the matching
 * public.profiles row from the sign-up metadata (see supabase/migrations).
 * @returns {Promise<{ success: boolean, error?: string, user?: Object, needsConfirmation?: boolean }>}
 */
export async function registerUser(user) {
  const email = (user.email || '').trim().toLowerCase();
  const { data, error } = await supabase.auth.signUp({
    email,
    password: user.password,
    options: {
      data: {
        name: (user.name || '').trim(),
        username: (user.username || '').trim().toLowerCase(),
        birthdate: user.birthdate || null,
        phone: (user.phone || '').trim() || null,
      },
    },
  });
  if (error) return { success: false, error: error.message };

  const profile = profileFromAuthUser(data.user);

  // No session returned => email confirmation is enabled; user must verify first.
  if (!data.session) {
    return { success: true, needsConfirmation: true, user: profile };
  }

  const full = (await fetchProfile(data.user.id)) || profile;
  cacheSession(full);
  return { success: true, user: full };
}

/**
 * Log in with email + password via Supabase Auth.
 * (Email-only: username→email resolution was removed to avoid an enumeration
 * surface. Users sign up with an email and log in with it.)
 * @returns {Promise<{ success: boolean, error?: string, user?: Object }>}
 */
export async function loginUser(email, password) {
  const normalized = (email || '').trim().toLowerCase();
  if (!normalized.includes('@')) {
    return { success: false, error: 'Please log in with your email address.' };
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email: normalized, password });
  if (error) return { success: false, error: error.message };

  const profile = (await fetchProfile(data.user.id)) || profileFromAuthUser(data.user);
  cacheSession(profile);
  return { success: true, user: profile };
}

/** Current signed-in profile (synchronous, from the local cache). */
export function getCurrentUser() {
  return load('session', null);
}

/** Sign out of Supabase Auth and clear the local cache. */
export async function logoutUser() {
  try {
    await supabase.auth.signOut();
  } catch (e) {
    console.warn('signOut failed:', e);
  }
  cacheSession(null);
}

/**
 * Hydrate the session on app start and subscribe to future auth changes.
 * @param {(profile: Object|null) => void} onChange
 * @returns {() => void} unsubscribe
 */
export function initAuth(onChange) {
  const apply = async (session) => {
    if (session?.user) {
      const profile = (await fetchProfile(session.user.id)) || profileFromAuthUser(session.user);
      cacheSession(profile);
      onChange?.(profile);
    } else {
      cacheSession(null);
      onChange?.(null);
    }
  };

  supabase.auth.getSession().then(({ data }) => apply(data?.session));
  const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => apply(session));

  return () => sub?.subscription?.unsubscribe();
}

/**
 * Update the current user's profile (optimistic local cache + background write).
 */
export function updateUserProfile(userId, updates) {
  const updatesForDb = { ...updates };
  delete updatesForDb.password;

  const current = getCurrentUser();
  if (current && current.id === userId) {
    cacheSession({ ...current, ...updatesForDb });
  }

  supabase.from('profiles').update(updatesForDb).eq('id', userId).then(({ error }) => {
    if (error) console.warn('updateUserProfile failed:', error.message);
    else window.dispatchEvent(new CustomEvent('lowkey_db_sync'));
  });
}

/**
 * Merge function to reconcile local storage data with Supabase records
 */
function mergeById(localArr, remoteArr) {
  const map = new Map();
  localArr.forEach(item => map.set(item.id, item));
  remoteArr.forEach(item => {
    const existing = map.get(item.id);
    map.set(item.id, { ...existing, ...item });
  });
  return Array.from(map.values());
}

/**
 * Asynchronously sync database tables from Supabase into local storage cache
 */
export async function syncWithSupabase() {
  try {
    // 1. Sync profiles -> public.profiles
    const { data: profiles, error: errProfiles } = await supabase.from('profiles').select('*');
    if (!errProfiles && profiles) {
      const localUsers = load('users', []);
      save('users', mergeById(localUsers, profiles));
    }

    // 2. Sync events -> public.events
    const { data: events, error: errEvents } = await supabase.from('events').select('*');
    if (!errEvents && events) {
      const localEvents = load('events', []);
      save('events', mergeById(localEvents, events));
    }

    // 3. Sync rsvps -> public.rsvps
    const { data: rsvps, error: errRsvps } = await supabase.from('rsvps').select('*');
    if (!errRsvps && rsvps) {
      const localRsvps = load('rsvps', []);
      save('rsvps', mergeById(localRsvps, rsvps));
    }

    // 4. Sync expenses -> public.expenses
    const { data: expenses, error: errExpenses } = await supabase.from('expenses').select('*');
    if (!errExpenses && expenses) {
      const localExpenses = load('expenses', []);
      save('expenses', mergeById(localExpenses, expenses));
    }

    // 5. Sync photos -> public.photos
    const { data: photos, error: errPhotos } = await supabase.from('photos').select('*');
    if (!errPhotos && photos) {
      const localPhotos = load('photos', []);
      save('photos', mergeById(localPhotos, photos));
    }

    // 6. Sync payments -> public.payments
    const { data: payments, error: errPayments } = await supabase.from('payments').select('*');
    if (!errPayments && payments) {
      const localPayments = load('payments', []);
      save('payments', mergeById(localPayments, payments));
    }

    // 7. Sync comments -> public.comments
    const { data: comments, error: errComments } = await supabase.from('comments').select('*');
    if (!errComments && comments) {
      const localComments = load('comments', []);
      save('comments', mergeById(localComments, comments));
    }

    // 8. Sync notifications (RLS returns only the current user's rows)
    const { data: notifications, error: errNotifs } = await supabase.from('notifications').select('*');
    if (!errNotifs && notifications) {
      const localNotifs = load('notifications', []);
      save('notifications', mergeById(localNotifs, notifications));
      window.dispatchEvent(new CustomEvent('lowkey_notifications'));
    }

    // Broadcast change to active views
    window.dispatchEvent(new CustomEvent('lowkey_db_sync'));
  } catch (e) {
    console.warn('Supabase sync database offline fallback:', e);
  }
}
