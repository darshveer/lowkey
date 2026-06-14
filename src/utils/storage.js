/**
 * LocalStorage helpers for LowKey
 * Provides typed get/set with JSON serialization
 */

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
  if (idx >= 0) {
    events[idx] = { ...events[idx], ...event, updated_at: new Date().toISOString() };
  } else {
    events.push({ ...event, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
  }
  save('events', events);
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
  all.push({ ...rsvp, created_at: new Date().toISOString() });
  save('rsvps', all);
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
  all.push({ ...expense, created_at: new Date().toISOString() });
  save('expenses', all);
}

/**
 * Get photos for an event
 * @param {string} eventId
 * @returns {Array}
 */
export function getPhotos(eventId) {
  const all = load('photos', []);
  return all.filter(p => p.event_id === eventId);
}

/**
 * Add a photo
 * @param {Object} photo
 */
export function addPhoto(photo) {
  const all = load('photos', []);
  all.push({ ...photo, created_at: new Date().toISOString() });
  save('photos', all);
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
