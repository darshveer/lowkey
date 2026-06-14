/**
 * LocalStorage helpers for LowKey with Supabase Sync
 * Provides typed get/set with JSON serialization and background Supabase persistence
 */
import { supabase } from './supabase';

const STORAGE_PREFIX = 'lowkey_';

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
}

/**
 * Get all users from storage
 * @returns {Array}
 */
export function getUsers() {
  return load('users', []);
}

/**
 * Register a new user
 * @param {Object} user
 * @returns {Object} { success: boolean, error?: string, user?: Object }
 */
export function registerUser(user) {
  const users = getUsers();
  const normalizedEmail = user.email.toLowerCase().trim();
  const normalizedUsername = user.username.toLowerCase().trim();
  
  const exists = users.find(u => u.email.toLowerCase().trim() === normalizedEmail || u.username.toLowerCase().trim() === normalizedUsername);
  if (exists) {
    return { success: false, error: 'Username or Email already exists' };
  }

  const newUser = {
    ...user,
    id: 'user_' + Math.random().toString(36).substring(2, 11),
    created_at: new Date().toISOString()
  };

  users.push(newUser);
  save('users', users);
  
  // Background write to Supabase profiles
  supabase.from('profiles').insert(newUser).then(({ error }) => {
    if (error) console.warn('Supabase registerUser failed, using offline cache:', error.message);
  });

  // Auto login on signup
  save('session', newUser);
  return { success: true, user: newUser };
}

/**
 * Log in a user
 * @param {string} emailOrUsername
 * @param {string} password
 * @returns {Object} { success: boolean, error?: string, user?: Object }
 */
export function loginUser(emailOrUsername, password) {
  const users = getUsers();
  const searchKey = emailOrUsername.toLowerCase().trim();
  
  const user = users.find(u => 
    u.email.toLowerCase().trim() === searchKey || 
    u.username.toLowerCase().trim() === searchKey
  );

  if (!user || user.password !== password) {
    return { success: false, error: 'Invalid username/email or password' };
  }

  save('session', user);
  return { success: true, user };
}

/**
 * Get current logged in user session
 * @returns {Object|null}
 */
export function getCurrentUser() {
  return load('session', null);
}

/**
 * Log out current user
 */
export function logoutUser() {
  remove('session');
}

/**
 * Update a user profile
 * @param {string} userId
 * @param {Object} updates
 */
export function updateUserProfile(userId, updates) {
  const users = getUsers();
  const idx = users.findIndex(u => u.id === userId);
  
  if (idx >= 0) {
    const updatedUser = { ...users[idx], ...updates, updated_at: new Date().toISOString() };
    users[idx] = updatedUser;
    save('users', users);
    
    // Update active session if it's the current user
    const currentSession = getCurrentUser();
    if (currentSession && currentSession.id === userId) {
      save('session', updatedUser);
    }

    // Background write to Supabase profiles
    supabase.from('profiles').update(updates).eq('id', userId).then(({ error }) => {
      if (error) console.warn('Supabase updateUserProfile failed:', error.message);
    });
  }
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

    // Broadcast change to active views
    window.dispatchEvent(new CustomEvent('lowkey_db_sync'));
  } catch (e) {
    console.warn('Supabase sync database offline fallback:', e);
  }
}
