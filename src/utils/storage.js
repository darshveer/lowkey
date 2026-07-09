/**
 * LocalStorage helpers for LowKey with Supabase Sync
 * Provides typed get/set with JSON serialization and background Supabase persistence
 */
import { supabase } from './supabase';
import { generateId, computePaymentDeadline } from './helpers';

const STORAGE_PREFIX = 'lowkey_';
const PHOTO_BUCKET = 'party-photos';

/** Hours a waitlist-promoted guest gets to pay — tighter, since a spot was freed for them. */
const PROMOTED_PAYMENT_DEADLINE_HOURS = 1;
/** How far ahead of a deadline the one-time payment reminder fires. */
const PAYMENT_REMINDER_LEAD_HOURS = 2;

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
 * Report a failed Supabase write. Logs it AND broadcasts an event so the UI can
 * surface it (a silent console.warn hid schema/connection problems before).
 * @param {string} context - human label, e.g. 'saving your party'
 * @param {Object} error - the Supabase error
 */
function reportSyncError(context, error) {
  const message = error?.message || String(error);
  console.warn(`Supabase write failed (${context}):`, message);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('lowkey_sync_error', { detail: { context, message } }));
  }
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
    if (error) reportSyncError('saving your party', error);
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
    if (error) reportSyncError('saving RSVP', error);
  });

  // Notify the host of the new RSVP
  if (newRsvp.status === 'going') {
    const ev = getEvent(newRsvp.event_id);
    notifyHost(newRsvp.event_id, newRsvp.user_id, {
      type: 'rsvp',
      title: 'New RSVP',
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
      if (error) reportSyncError('updating RSVP', error);
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
    if (error) reportSyncError('saving expense', error);
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
    if (error) reportSyncError('saving photo', error);
  });

  // Notify the host of the new photo
  notifyHost(newPhoto.event_id, newPhoto.uploaded_by_id, {
    type: 'photo',
    title: 'New photo dropped',
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
 * Add a payment record. Status starts 'pending' — a UTR submission is proof
 * of an attempted payment, not a verified one. The host (or a co-host)
 * approves or declines it via updatePayment().
 * @param {Object} payment
 */
export function addPayment(payment) {
  const all = load('payments', []);
  const newPayment = { status: 'pending', ...payment, created_at: new Date().toISOString() };
  all.push(newPayment);
  save('payments', all);

  // Background write to Supabase
  supabase.from('payments').insert(newPayment).then(({ error }) => {
    if (error) reportSyncError('saving payment', error);
  });

  // Notify the host a payment is awaiting their review
  notifyHost(newPayment.event_id, null, {
    type: 'payment',
    title: 'Payment awaiting approval',
    body: `${newPayment.paid_by || 'A guest'} submitted a UTR for ₹${Number(newPayment.amount || 0).toLocaleString('en-IN')}`,
  });
}

/**
 * Approve or decline a submitted payment. For a cover-charge payment
 * (rsvp_id set), this flips the linked RSVP's cover_paid flag — which,
 * together with the 1-day-out window, gates that guest's entry QR — and
 * notifies them of the outcome. Kitty-split payments (rsvp_id null) just
 * update status; the host settles those via the existing "Mark paid" toggle.
 * @param {string} paymentId
 * @param {'pending'|'approved'|'declined'} status
 */
export function updatePayment(paymentId, status) {
  const all = load('payments', []);
  const idx = all.findIndex(p => p.id === paymentId);
  if (idx < 0) return null;
  const updated = { ...all[idx], status };
  all[idx] = updated;
  save('payments', all);

  supabase.from('payments').update({ status }).eq('id', paymentId).then(({ error }) => {
    if (error) reportSyncError('updating payment', error);
  });

  if (updated.rsvp_id && (status === 'approved' || status === 'declined')) {
    const approved = status === 'approved';
    updateRSVP(updated.rsvp_id, { cover_paid: approved });
    const rsvp = load('rsvps', []).find(r => r.id === updated.rsvp_id);
    if (rsvp?.user_id) {
      addNotification({
        recipient_id: rsvp.user_id,
        event_id: updated.event_id,
        type: 'payment',
        title: approved ? 'Payment approved' : 'Payment needs another look',
        body: approved
          ? "Your host approved your payment — your entry QR unlocks closer to the party."
          : "Your host couldn't verify that payment. Please resubmit your UTR.",
        link: `/invite/${updated.event_id}`,
      });
    }
  }

  window.dispatchEvent(new CustomEvent('lowkey_db_sync'));
  return updated;
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
    if (error) reportSyncError('posting to the vibe wall', error);
  });

  // Notify the host of the new vibe-wall post
  notifyHost(newComment.event_id, newComment.author_id, {
    type: 'comment',
    title: 'New vibe wall post',
    body: `${newComment.author_name || 'Someone'}: ${String(newComment.body || '').slice(0, 60)}`,
  });
  return newComment;
}

/**
 * Remove a comment from the local cache only. Used to reconcile realtime
 * DELETE events so a post removed elsewhere doesn't resurrect from
 * localStorage on the next page load (the sync merge never removes rows).
 */
export function removeLocalComment(commentId) {
  const all = load('comments', []);
  if (all.some(c => c.id === commentId)) {
    save('comments', all.filter(c => c.id !== commentId));
  }
}

/**
 * Delete a vibe-wall comment (author removing their own post, or the host
 * moderating the wall). Cloud enforcement lives in RLS (migration 0011):
 * only the comment's author or the event's host can delete the row.
 */
export function deleteComment(commentId) {
  removeLocalComment(commentId);

  supabase.from('comments').delete().eq('id', commentId).then(({ error }) => {
    if (error) reportSyncError('deleting the post', error);
  });
  window.dispatchEvent(new CustomEvent('lowkey_db_sync'));
}

// ============================================================
//  Realtime — live RSVPs, photos, and comments per event
// ============================================================

// Monotonic counter so every subscription gets a UNIQUE channel topic. Multiple
// components can subscribe to the same event (e.g. the dashboard + the embedded
// vibe wall) — sharing a topic makes supabase-js throw "cannot add callbacks
// after subscribe()", which would crash the page.
let channelSeq = 0;

/**
 * Subscribe to live changes for an event. Pass any of onRsvp / onPhoto / onComment.
 * Each handler receives the Supabase payload ({ eventType, new, old }).
 * @returns {() => void} unsubscribe
 */
export function subscribeToEvent(eventId, handlers = {}) {
  const channel = supabase.channel(`event:${eventId}:${++channelSeq}`);
  const tables = { rsvps: handlers.onRsvp, photos: handlers.onPhoto, comments: handlers.onComment, payments: handlers.onPayment };

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

/**
 * Create a notification for a recipient (local cache + Supabase).
 * Pass a stable `id` for events that can be produced by more than one sweep
 * (payment expiry/reminder/waitlist run on the invite, the dashboard, and the
 * pg_cron job) — a deterministic id makes it idempotent, so the same expiry
 * never yields two "Spot released" notifications. Without one, a random id is used.
 */
export function addNotification({ id, recipient_id, type, title, body, event_id = null, link = null }) {
  if (!recipient_id) return null;
  const all = load('notifications', []);
  const notifId = id || `ntf_${generateId()}`;
  // Idempotency: if this exact notification already exists locally, do nothing.
  if (all.some((n) => n.id === notifId)) return all.find((n) => n.id === notifId);
  const notification = {
    id: notifId,
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

  // upsert + ignoreDuplicates: a deterministic id may already exist server-side
  // (another sweep or the cron inserted it) — that's expected, not an error.
  supabase.from('notifications').upsert(notification, { onConflict: 'id', ignoreDuplicates: true }).then(({ error }) => {
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
    .channel(`notifications:${userId}:${++channelSeq}`)
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
//  Announcements — host broadcast to all "going" guests
// ============================================================

export function getAnnouncements(eventId) {
  return load('announcements', [])
    .filter(a => a.event_id === eventId)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

export function addAnnouncement({ event_id, body, author_name }) {
  const all = load('announcements', []);
  const ann = {
    id: `ann_${generateId()}`,
    event_id,
    body: String(body || '').trim(),
    author_name: author_name || 'Host',
    created_at: new Date().toISOString(),
  };
  all.push(ann);
  save('announcements', all);
  supabase.from('announcements').insert(ann).then(({ error }) => {
    if (error) reportSyncError('sending announcement', error);
  });

  // Push a notification to every going guest with an account.
  const ev = getEvent(event_id);
  getRSVPs(event_id)
    .filter(r => r.status === 'going' && r.user_id && (!ev || r.user_id !== ev.host_id))
    .forEach(r => addNotification({
      recipient_id: r.user_id,
      event_id,
      type: 'announcement',
      title: `${ev?.name || 'Party'} update`,
      body: ann.body,
      link: `/invite/${event_id}`,
    }));
  return ann;
}

// ============================================================
//  Song requests — collaborative playlist queue
// ============================================================

export function getSongRequests(eventId) {
  return load('song_requests', [])
    .filter(s => s.event_id === eventId)
    .sort((a, b) => (b.votes || 0) - (a.votes || 0) || new Date(a.created_at) - new Date(b.created_at));
}

export function addSongRequest({ event_id, title, requested_by }) {
  const all = load('song_requests', []);
  const song = {
    id: `song_${generateId()}`,
    event_id,
    title: String(title || '').trim(),
    requested_by: requested_by || 'Guest',
    votes: 1,
    created_at: new Date().toISOString(),
  };
  all.push(song);
  save('song_requests', all);
  supabase.from('song_requests').insert(song).then(({ error }) => {
    if (error) console.warn('addSongRequest failed:', error.message);
  });
  notifyHost(event_id, null, {
    type: 'song',
    title: 'New song request',
    body: `${song.requested_by} added "${song.title}"`,
  });
  return song;
}

export function voteSongRequest(songId) {
  const all = load('song_requests', []);
  const idx = all.findIndex(s => s.id === songId);
  if (idx < 0) return null;
  all[idx] = { ...all[idx], votes: (all[idx].votes || 0) + 1 };
  save('song_requests', all);
  supabase.from('song_requests').update({ votes: all[idx].votes }).eq('id', songId)
    .then(({ error }) => { if (error) console.warn('voteSongRequest failed:', error.message); });
  return all[idx];
}

// ============================================================
//  Profiles — synced public profile lookups (party-member peeks)
// ============================================================

/** A synced profile by auth user id (from the local cache pulled on sync). */
export function getProfile(userId) {
  if (!userId) return null;
  return load('users', []).find(u => u.id === userId) || null;
}

/** A synced profile by email, case-insensitive. Used for co-host lookup. */
export function findProfileByEmail(email) {
  const q = String(email || '').trim().toLowerCase();
  if (!q) return null;
  return load('users', []).find(u => (u.email || '').toLowerCase() === q) || null;
}

// ============================================================
//  Follows + activity feed
// ============================================================

export function getFollowing(userId) {
  return load('follows', []).filter(f => f.follower_id === userId).map(f => f.host_id);
}

export function isFollowing(userId, hostId) {
  return load('follows', []).some(f => f.follower_id === userId && f.host_id === hostId);
}

/** Follow / unfollow a host. Returns the new following state. */
export function toggleFollow(userId, hostId) {
  if (!userId || !hostId || userId === hostId) return false;
  const all = load('follows', []);
  const exists = all.find(f => f.follower_id === userId && f.host_id === hostId);
  let following;
  if (exists) {
    save('follows', all.filter(f => !(f.follower_id === userId && f.host_id === hostId)));
    supabase.from('follows').delete().eq('follower_id', userId).eq('host_id', hostId).then(() => {});
    following = false;
  } else {
    const row = { id: `flw_${generateId()}`, follower_id: userId, host_id: hostId, created_at: new Date().toISOString() };
    all.push(row);
    save('follows', all);
    supabase.from('follows').insert(row).then(() => {});
    following = true;
  }
  window.dispatchEvent(new CustomEvent('lowkey_db_sync'));
  return following;
}

/** Upcoming discoverable events hosted by people the user follows. */
export function getActivityFeed(userId) {
  if (!userId) return [];
  const followed = new Set(getFollowing(userId));
  const today = new Date().toISOString().split('T')[0];
  return getEvents()
    .filter(e => followed.has(e.host_id) && e.date >= today && e.discoverable !== false)
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

// ============================================================
//  Duplicate a party (template)
// ============================================================

export function duplicateEvent(eventId, hostUser) {
  const ev = getEvent(eventId);
  if (!ev) return null;
  const copy = {
    ...ev,
    id: generateId(),
    name: `${ev.name} (copy)`,
    host_id: hostUser?.id || ev.host_id,
    host_name: hostUser?.name || ev.host_name,
    date: '',
    time_start: '',
    time_end: '',
    status: 'live',
    photo_dump_unlocked: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  saveEvent(copy);
  return copy;
}

// ============================================================
//  Waitlist
// ============================================================

/** Seats currently taken by "going" RSVPs. */
export function goingCountFor(eventId) {
  return getRSVPs(eventId)
    .filter(r => r.status === 'going')
    .reduce((sum, r) => sum + (r.guest_count || 1), 0);
}

// ============================================================
//  Party lifecycle — start / archive / delete
// ============================================================

/** Host starts the party — activates guest entry QRs and pings going guests. */
export function startEvent(eventId) {
  const ev = getEvent(eventId);
  if (!ev) return null;
  const updated = { ...ev, started: true, started_at: new Date().toISOString() };
  saveEvent(updated);
  getRSVPs(eventId)
    .filter(r => r.status === 'going' && r.user_id && r.user_id !== ev.host_id)
    .forEach(r => addNotification({
      recipient_id: r.user_id,
      event_id: eventId,
      type: 'start',
      title: `${ev.name} has started!`,
      body: 'The party has started — check your entry pass.',
      link: `/invite/${eventId}`,
    }));
  return updated;
}

/** Archive a finished party (hidden from discovery; kept for the record). */
export function archiveEvent(eventId) {
  const ev = getEvent(eventId);
  if (!ev) return null;
  const updated = { ...ev, archived: true, discoverable: false };
  saveEvent(updated);
  return updated;
}

/** Delete a party and all of its related rows (local + Supabase). */
export function deleteEvent(eventId) {
  save('events', getEvents().filter(e => e.id !== eventId));
  const childKeys = ['rsvps', 'expenses', 'photos', 'comments', 'song_requests', 'announcements'];
  childKeys.forEach(key => save(key, load(key, []).filter(x => x.event_id !== eventId)));

  supabase.from('events').delete().eq('id', eventId).then(({ error }) => {
    if (error) console.warn('deleteEvent (events) failed:', error.message);
  });
  childKeys.forEach(table =>
    supabase.from(table).delete().eq('event_id', eventId).then(() => {})
  );
  window.dispatchEvent(new CustomEvent('lowkey_db_sync'));
}

/** Promote the earliest waitlisted RSVP to "going" if capacity allows. */
export function promoteWaitlist(eventId) {
  const ev = getEvent(eventId);
  if (!ev || !ev.capacity) return;
  const free = ev.capacity - goingCountFor(eventId);
  if (free <= 0) return;
  const next = getRSVPs(eventId)
    .filter(r => r.status === 'waitlist' && (r.guest_count || 1) <= free)
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))[0];
  if (!next) return;

  // A promoted guest gets a much tighter payment window — the spot was just
  // freed up, so it shouldn't sit reserved-but-unpaid as long as a fresh RSVP.
  const needsPayment = Number(ev.cover_charge) > 0;
  const updates = { status: 'going' };
  if (needsPayment) {
    updates.payment_deadline_at = computePaymentDeadline(PROMOTED_PAYMENT_DEADLINE_HOURS);
    updates.payment_reminder_sent = false;
    updates.cover_paid = false;
  }
  updateRSVP(next.id, updates);

  if (next.user_id) {
    addNotification({
      id: `ntf_promoted_${next.id}`, // deterministic → one promotion notice per RSVP
      recipient_id: next.user_id,
      event_id: eventId,
      type: 'waitlist',
      title: "You're off the waitlist!",
      body: needsPayment
        ? `A spot opened up at ${ev.name} — pay within 1 hour to keep it.`
        : `A spot opened up at ${ev.name} — you're in.`,
      link: `/invite/${eventId}`,
    });
  }
}

/**
 * Client-side lazy sweep for a single event: expires 'going' RSVPs whose
 * payment deadline has passed without an approved payment (freeing the spot
 * for the next waitlisted guest), and sends a one-time reminder as a
 * deadline approaches. There is no background job in this architecture, so
 * this runs whenever a page that cares (the invite page, the dashboard)
 * mounts — same lazy-on-read idea as getPhotos' expiry purge, just exposed
 * explicitly rather than embedded in a getter, since this one can cascade
 * into a waitlist promotion and mustn't recurse into itself.
 * @param {string} eventId
 */
export function checkPaymentDeadlines(eventId) {
  try {
    const nowMs = Date.now();
    const forEvent = load('rsvps', []).filter(r => r.event_id === eventId && r.status === 'going' && r.payment_deadline_at);

    const toExpire = [];
    const toRemind = [];
    forEvent.forEach(r => {
      if (r.cover_paid) return;
      const deadlineMs = new Date(r.payment_deadline_at).getTime();
      if (deadlineMs < nowMs) {
        toExpire.push(r);
      } else if (!r.payment_reminder_sent && (deadlineMs - nowMs) / 3600000 <= PAYMENT_REMINDER_LEAD_HOURS) {
        toRemind.push(r);
      }
    });

    toRemind.forEach(r => {
      updateRSVP(r.id, { payment_reminder_sent: true });
      if (r.user_id) {
        const hoursLeft = Math.max(1, Math.round((new Date(r.payment_deadline_at).getTime() - nowMs) / 3600000));
        addNotification({
          id: `ntf_remind_${r.id}`, // deterministic → one reminder per RSVP, even if swept twice
          recipient_id: r.user_id,
          event_id: eventId,
          type: 'payment',
          title: 'Payment reminder',
          body: `Submit your UTR within ${hoursLeft}h to keep your spot.`,
          link: `/invite/${eventId}`,
        });
      }
    });

    toExpire.forEach(r => {
      deleteRSVP(r.id);
      if (r.user_id) {
        addNotification({
          id: `ntf_expired_${r.id}`, // deterministic → one "Spot released" per RSVP across all sweeps
          recipient_id: r.user_id,
          event_id: eventId,
          type: 'payment',
          title: 'Spot released',
          body: "Your RSVP was removed — payment wasn't confirmed in time. RSVP again if there's room.",
          link: `/invite/${eventId}`,
        });
      }
    });

    if (toExpire.length > 0) promoteWaitlist(eventId);
  } catch (e) {
    console.warn('checkPaymentDeadlines failed:', e);
  }
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
export async function registerUser(user, captchaToken) {
  const email = (user.email || '').trim().toLowerCase();
  const { data, error } = await supabase.auth.signUp({
    email,
    password: user.password,
    options: {
      // Present only when Turnstile is configured; Supabase ignores it if CAPTCHA
      // protection is off, and requires it when on.
      ...(captchaToken ? { captchaToken } : {}),
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
export async function loginUser(email, password, captchaToken) {
  const normalized = (email || '').trim().toLowerCase();
  if (!normalized.includes('@')) {
    return { success: false, error: 'Please log in with your email address.' };
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: normalized,
    password,
    ...(captchaToken ? { options: { captchaToken } } : {}),
  });
  if (error) return { success: false, error: error.message };

  const profile = (await fetchProfile(data.user.id)) || profileFromAuthUser(data.user);
  cacheSession(profile);
  return { success: true, user: profile };
}

/**
 * Start the Google OAuth sign-in flow. This redirects the browser to Google and
 * back to the app; supabase-js then detects the session in the return URL and
 * `initAuth`'s onAuthStateChange handler hydrates the profile automatically.
 *
 * Google supplies name + email but NOT username / birthdate, so a first-time
 * Google user lands with an incomplete profile — App.jsx's ProfileCompletionModal
 * collects those before they can host/RSVP (birthdate powers the 21+ alcohol gate).
 *
 * The Google client ID/secret live in the Supabase dashboard (Auth → Providers →
 * Google), never in this browser bundle. No new VITE_* env var is required.
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export async function signInWithGoogle() {
  // Return to the CURRENT origin so this works in dev (localhost) and prod alike;
  // both must be listed under Supabase → Auth → URL Configuration → Redirect URLs.
  const redirectTo = window.location.origin;
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      // Always let the user pick which Google account, even if already signed in.
      queryParams: { prompt: 'select_account' },
    },
  });
  if (error) return { success: false, error: error.message };
  // On success the browser is navigating away to Google; nothing else to do here.
  return { success: true };
}

/** True when a signed-in profile is missing the fields Google OAuth can't supply. */
export function isProfileIncomplete(profile) {
  return !!profile && (!profile.username || !profile.birthdate);
}

/**
 * Fill in the username / birthdate (and optional phone) a Google user lacks.
 * Awaited (unlike updateUserProfile's fire-and-forget) so the UI can surface a
 * taken-username conflict. RLS `profiles_self_update` scopes this to auth.uid()=id.
 * @returns {Promise<{ success: boolean, error?: string, user?: Object }>}
 */
export async function completeProfile(userId, { username, birthdate, phone }) {
  const updates = {
    username: (username || '').trim().toLowerCase(),
    birthdate: birthdate || null,
    phone: (phone || '').trim() || null,
  };

  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .maybeSingle();

  if (error) {
    // 23505 = unique_violation: the chosen username is taken.
    if (error.code === '23505' || /duplicate|unique/i.test(error.message || '')) {
      return { success: false, error: 'That username is already taken — try another.' };
    }
    return { success: false, error: error.message };
  }

  const current = getCurrentUser();
  const merged = { ...(current || { id: userId }), ...updates };
  if (current && current.id === userId) cacheSession(merged);
  window.dispatchEvent(new CustomEvent('lowkey_db_sync'));
  return { success: true, user: merged };
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

/** Wipe every LowKey localStorage key (used on account deletion). */
function clearAllLocalData() {
  try {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(STORAGE_PREFIX)) keys.push(k);
    }
    keys.forEach((k) => localStorage.removeItem(k));
  } catch (e) {
    console.warn('clearAllLocalData failed:', e);
  }
}

/**
 * Permanently delete the signed-in user's account and all their data via the
 * `delete_my_account` RPC (a SECURITY DEFINER function — see migration 0015).
 * The function acts on auth.uid() only, so it can delete no one but the caller.
 * On success we sign out and wipe the local cache. This is irreversible.
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export async function deleteMyAccount() {
  const user = getCurrentUser();
  if (!user) return { success: false, error: 'You are not signed in.' };

  const { error } = await supabase.rpc('delete_my_account');
  if (error) {
    // A missing function (migration 0015 not run) or any DB error is surfaced,
    // not swallowed — deletion must never *appear* to succeed when it didn't.
    return { success: false, error: error.message };
  }

  try {
    await supabase.auth.signOut();
  } catch (e) {
    console.warn('signOut after account deletion failed:', e);
  }
  clearAllLocalData();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('lowkey_db_sync'));
  }
  return { success: true };
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

    // 9-11. Sync announcements / song requests / follows
    const extras = [
      ['announcements', 'announcements'],
      ['song_requests', 'song_requests'],
      ['follows', 'follows'],
    ];
    for (const [table, key] of extras) {
      const { data, error } = await supabase.from(table).select('*');
      if (!error && data) save(key, mergeById(load(key, []), data));
    }

    // Broadcast change to active views
    window.dispatchEvent(new CustomEvent('lowkey_db_sync'));
  } catch (e) {
    console.warn('Supabase sync database offline fallback:', e);
  }
}

/**
 * Manually re-push the current user's locally-cached data to Supabase, then
 * pull the latest. Recovery tool for when background writes previously failed
 * (e.g. a schema mismatch). Only pushes rows the signed-in user owns so RLS
 * doesn't reject them, and returns the first real error for diagnosis.
 * @returns {Promise<{ pushed: number, failed: number, firstError: string|null, needsAuth: boolean }>}
 */
export async function resyncToCloud() {
  const me = getCurrentUser();
  const myId = me?.id;
  if (!myId) {
    return { pushed: 0, failed: 0, firstError: 'You must be signed in to re-sync.', needsAuth: true };
  }

  let pushed = 0;
  let failed = 0;
  let firstError = null;

  const push = async (key, table, rows) => {
    for (const row of rows) {
      const { error } = await supabase.from(table).upsert(row);
      if (error) {
        failed++;
        if (!firstError) firstError = `${table}: ${error.message}`;
      } else {
        pushed++;
      }
    }
  };

  // My hosted events + everything that belongs to them (host-writable), plus my
  // own RSVPs. Rows owned by other people are intentionally skipped (RLS).
  const myEvents = load('events', []).filter(e => e.host_id === myId);
  const myEventIds = new Set(myEvents.map(e => e.id));
  const childrenOfMine = (key) => load(key, []).filter(r => myEventIds.has(r.event_id));

  await push('events', 'events', myEvents);
  await push('rsvps', 'rsvps', load('rsvps', []).filter(r => r.user_id === myId));
  await push('expenses', 'expenses', childrenOfMine('expenses'));
  await push('photos', 'photos', childrenOfMine('photos'));
  await push('comments', 'comments', childrenOfMine('comments'));
  await push('announcements', 'announcements', childrenOfMine('announcements'));

  await syncWithSupabase();
  return { pushed, failed, firstError, needsAuth: false };
}
