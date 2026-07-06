/**
 * Achievement definitions + derivation logic.
 * Icons live in components/AchievementBadge.jsx (keyed by `key`).
 */

export const ACHIEVEMENTS = [
  { key: 'first_party',   name: 'Host Debut',    desc: 'Threw your first party',        tier: 'bronze', check: (s) => s.partiesHosted >= 1 },
  { key: 'seasoned_host', name: 'Seasoned Host', desc: 'Hosted 5+ parties',             tier: 'gold',   check: (s) => s.partiesHosted >= 5 },
  { key: 'crowd_puller',  name: 'Crowd Puller',  desc: '25+ guests at one party',       tier: 'silver', check: (s) => s.maxGoing >= 25 },
  { key: 'sold_out',      name: 'Sold Out',      desc: 'Filled a party to capacity',    tier: 'gold',   check: (s) => s.soldOut },
  { key: 'kitty_master',  name: 'Kitty Master',  desc: 'Collected ₹10k across parties', tier: 'gold',   check: (s) => s.totalCollected >= 10000 },
  { key: 'night_owl',     name: 'Night Owl',     desc: 'Hosted a party past 2 AM',      tier: 'silver', check: (s) => s.hostedLateNight },
  { key: 'shutterbug',    name: 'Shutterbug',    desc: 'Added 10+ photos',              tier: 'bronze', check: (s) => s.photosUploaded >= 10 },
  { key: 'socialite',     name: 'Socialite',     desc: "RSVP'd to 5+ parties",          tier: 'silver', check: (s) => s.partiesAttended >= 5 },
  { key: 'verified',      name: 'Verified 21+',  desc: 'Age-verified profile',          tier: 'bronze', check: (s) => s.ageVerified },
];

function ageFrom(dob) {
  if (!dob) return 0;
  const d = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}

/**
 * Compute host/guest stats + insights for a user from cached collections.
 * @param {{ events, rsvps, payments, photos, user }} data
 */
export function computeStats({ events = [], rsvps = [], payments = [], photos = [], user = null }) {
  const uid = user?.id;
  const name = (user?.name || '').toLowerCase();
  const todayStr = new Date().toISOString().split('T')[0];

  const hosted = events.filter((e) => e.host_id === uid);
  const hostedIds = new Set(hosted.map((e) => e.id));

  const goingForEvent = (eventId) =>
    rsvps
      .filter((r) => r.event_id === eventId && r.status === 'going')
      .reduce((sum, r) => sum + (r.guest_count || 1), 0);

  let maxGoing = 0;
  let totalGuests = 0;
  let soldOut = false;
  hosted.forEach((e) => {
    const going = goingForEvent(e.id);
    totalGuests += going;
    if (going > maxGoing) maxGoing = going;
    if (e.capacity && going >= e.capacity) soldOut = true;
  });

  const totalCollected = payments
    .filter((p) => hostedIds.has(p.event_id) && p.status !== 'failed')
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);

  const hostedLateNight = hosted.some(
    (e) => e.time_end_next_day || (e.time_end && e.time_end <= '04:00')
  );

  const photosUploaded = photos.filter(
    (p) => (uid && p.uploaded_by_id === uid) || (name && (p.uploaded_by || '').toLowerCase() === name)
  ).length;

  const partiesAttended = rsvps.filter(
    (r) => r.status === 'going' && ((uid && r.user_id === uid) || (name && (r.guest_name || '').toLowerCase() === name))
  ).length;

  const upcoming = hosted.filter((e) => e.date >= todayStr).length;
  const past = hosted.length - upcoming;
  const avgGuests = hosted.length ? Math.round(totalGuests / hosted.length) : 0;

  return {
    partiesHosted: hosted.length,
    upcoming,
    past,
    totalGuests,
    avgGuests,
    maxGoing,
    soldOut,
    totalCollected,
    hostedLateNight,
    photosUploaded,
    partiesAttended,
    ageVerified: ageFrom(user?.birthdate) >= 21,
  };
}

/** Keys of achievements the stats satisfy. */
export function earnedKeys(stats) {
  return ACHIEVEMENTS.filter((a) => a.check(stats)).map((a) => a.key);
}
