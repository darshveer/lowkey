/**
 * Mock data for LowKey demo
 * Populated with realistic Indian Gen-Z party scenarios
 */

export const MOCK_HOST = {
  id: 'host_001',
  name: 'Arjun Mehta',
  phone: '+919876543210',
  avatar_url: null,
};

export const MOCK_EVENT = {
  id: 'party_xK9mQ2',
  host_id: 'host_001',
  host_name: 'Arjun Mehta',
  name: 'Rooftop Sundowner',
  tagline: 'golden hour vibes & good people only ✨',
  city: 'Bengaluru',
  date: '2026-06-21',
  time_start: '18:00',
  time_end: '23:30',
  location_name: "Arjun's Terrace, Koramangala",
  location_lat: 12.9352,
  location_lng: 77.6245,
  location_address: '4th Block, Koramangala, Bengaluru 560034',
  theme: 'neon',
  poster_url: null,
  spotify_playlist_url: 'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M',
  upi_id: 'arjun@okicici',
  cover_charge: 499,
  capacity: 45,
  discoverable: true,
  vibe_tags: ['rooftop', 'sundowner', 'byob'],
  has_personal_dj: true,
  dj_name: 'Naina K',
  dj_profile_url: 'https://soundcloud.com/',
  dj_instagram: 'https://instagram.com/',
  dj_genre: 'Afro house, Bolly-tech',
  status: 'live',
  photo_dump_unlocked: false,
  contains_alcohol: true,
};

export const MOCK_EVENT_ACTIVE = {
  ...MOCK_EVENT,
  id: 'party_aB3nY7',
  name: 'Midnight Terrace Jam',
  tagline: 'byob, fairy lights, and questionable playlists 🌙',
  date: new Date().toISOString().split('T')[0], // Today
  time_start: (() => {
    const now = new Date();
    now.setHours(now.getHours() + 1);
    return `${now.getHours().toString().padStart(2, '0')}:00`;
  })(),
  time_end: '03:00',
  city: 'Bengaluru',
  theme: 'psychedelic',
  cover_charge: 350,
  capacity: 30,
  discoverable: true,
  vibe_tags: ['terrace', 'late night', 'friends of friends'],
  has_personal_dj: false,
  dj_name: '',
  dj_profile_url: '',
  dj_instagram: '',
  dj_genre: '',
  status: 'active',
  photo_dump_unlocked: true,
};

export const DISCOVERY_CITIES = [
  'All',
  'Bengaluru',
  'Mumbai',
  'Delhi NCR',
  'Pune',
  'Hyderabad',
  'Goa',
];

export const MOCK_RSVPS = [
  {
    id: 'rsvp_001',
    event_id: 'party_xK9mQ2',
    guest_name: 'Priya Sharma',
    guest_phone: null,
    status: 'going',
    poll_food: 'nonveg',
    poll_drinks: 'byob',
    poll_staying: 'cab',
    plus_one_requested: false,
    plus_one_name: null,
    plus_one_approved: null,
  },
  {
    id: 'rsvp_002',
    event_id: 'party_xK9mQ2',
    guest_name: 'Rohit Verma',
    guest_phone: null,
    status: 'going',
    poll_food: 'nonveg',
    poll_drinks: 'byob',
    poll_staying: 'staying',
    plus_one_requested: true,
    plus_one_name: 'Sneha',
    plus_one_approved: true,
  },
  {
    id: 'rsvp_003',
    event_id: 'party_xK9mQ2',
    guest_name: 'Ananya Iyer',
    guest_phone: null,
    status: 'going',
    poll_food: 'veg',
    poll_drinks: 'mocktails',
    poll_staying: 'cab',
    plus_one_requested: false,
    plus_one_name: null,
    plus_one_approved: null,
  },
  {
    id: 'rsvp_004',
    event_id: 'party_xK9mQ2',
    guest_name: 'Kabir Singh',
    guest_phone: null,
    status: 'going',
    poll_food: 'nonveg',
    poll_drinks: 'byob',
    poll_staying: 'staying',
    plus_one_requested: true,
    plus_one_name: 'Riya',
    plus_one_approved: null, // pending
  },
  {
    id: 'rsvp_005',
    event_id: 'party_xK9mQ2',
    guest_name: 'Meera Nair',
    guest_phone: null,
    status: 'going',
    poll_food: 'vegan',
    poll_drinks: 'mocktails',
    poll_staying: 'cab',
    plus_one_requested: false,
    plus_one_name: null,
    plus_one_approved: null,
  },
  {
    id: 'rsvp_006',
    event_id: 'party_xK9mQ2',
    guest_name: 'Vikram Reddy',
    guest_phone: null,
    status: 'going',
    poll_food: 'nonveg',
    poll_drinks: 'byob',
    poll_staying: 'staying',
    plus_one_requested: false,
    plus_one_name: null,
    plus_one_approved: null,
  },
  {
    id: 'rsvp_007',
    event_id: 'party_xK9mQ2',
    guest_name: 'Tara Khanna',
    guest_phone: null,
    status: 'maybe',
    poll_food: null,
    poll_drinks: null,
    poll_staying: null,
    plus_one_requested: false,
    plus_one_name: null,
    plus_one_approved: null,
  },
];

export const MOCK_EXPENSES = [
  {
    id: 'exp_001',
    event_id: 'party_xK9mQ2',
    description: 'Swiggy - Biryani + Starters',
    amount: 3200,
    paid_by: 'Arjun Mehta',
    split_type: 'equal',
    upi_id: 'arjun@okicici',
  },
  {
    id: 'exp_002',
    event_id: 'party_xK9mQ2',
    description: 'BYOB - Mixer & Ice',
    amount: 800,
    paid_by: 'Rohit Verma',
    split_type: 'equal',
    upi_id: 'rohit@paytm',
  },
];

export const MOCK_PHOTOS = [
  {
    id: 'photo_001',
    event_id: 'party_xK9mQ2',
    uploaded_by: 'Priya Sharma',
    photo_url: null,
    caption: 'golden hour hits different',
    filter: 'film',
    created_at: '2026-06-21T22:15:00',
  },
  {
    id: 'photo_002',
    event_id: 'party_xK9mQ2',
    uploaded_by: 'Rohit Verma',
    photo_url: null,
    caption: null,
    filter: 'raw',
    created_at: '2026-06-21T23:30:00',
  },
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

export const MOCK_USER = {
  id: 'host_001',
  username: 'arjun',
  email: 'arjun@lowkey.com',
  password: 'password',
  name: 'Arjun Mehta',
  birthdate: '2000-01-01', // 26 years old
  phone: '+919876543210'
};

/**
 * Load mock data into localStorage (call once on first load)
 */
export function seedMockData() {
  // Ensure user is present in users database
  const existingUsers = JSON.parse(localStorage.getItem('lowkey_users') || '[]');
  if (!existingUsers.some(u => u.username === MOCK_USER.username)) {
    existingUsers.push(MOCK_USER);
    localStorage.setItem('lowkey_users', JSON.stringify(existingUsers));
  }
  
  // Set default session if empty
  if (!localStorage.getItem('lowkey_session')) {
    localStorage.setItem('lowkey_session', JSON.stringify(MOCK_USER));
  }

  const seeded = localStorage.getItem('lowkey_seeded');
  if (seeded) {
    const existingEvents = JSON.parse(localStorage.getItem('lowkey_events') || '[]');
    const demoEvents = [MOCK_EVENT, MOCK_EVENT_ACTIVE];
    const mergedEvents = existingEvents.map(event => {
      const demo = demoEvents.find(item => item.id === event.id);
      return demo ? { ...demo, ...event } : event;
    });
    demoEvents.forEach(demo => {
      if (!mergedEvents.some(event => event.id === demo.id)) {
        mergedEvents.push(demo);
      }
    });
    localStorage.setItem('lowkey_events', JSON.stringify(mergedEvents));
    return;
  }

  localStorage.setItem('lowkey_events', JSON.stringify([MOCK_EVENT, MOCK_EVENT_ACTIVE]));
  localStorage.setItem('lowkey_rsvps', JSON.stringify(MOCK_RSVPS));
  localStorage.setItem('lowkey_expenses', JSON.stringify(MOCK_EXPENSES));
  localStorage.setItem('lowkey_photos', JSON.stringify(MOCK_PHOTOS));
  localStorage.setItem('lowkey_seeded', 'true');
}
