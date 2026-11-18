// Fetches watch history and ratings from Simkl API (Movies, TV Shows, Anime).
// Uses SIMKL_CLIENT_ID and SIMKL_USER_TOKEN (or SIMKL_ACCESS_TOKEN) from env.

const SIMKL_API_BASE = 'https://api.simkl.com';
const USER_PROFILE_URL = 'https://simkl.com/8304955/';

// Curated favorites & recent fallback when credentials are not yet configured in env.
const FALLBACK_FAVORITES = [
  {
    title: 'Interstellar',
    year: 2014,
    category: 'movie',
    categoryLabel: 'Movie',
    rating: 10,
    poster: 'https://wsrv.nl/?url=https://simkl.in/posters/21/2143004052303c734_m.webp&w=300&fit=cover',
    url: 'https://simkl.com/movies/214300/interstellar',
  },
  {
    title: 'Severance',
    year: 2022,
    category: 'show',
    categoryLabel: 'Show',
    rating: 10,
    poster: 'https://wsrv.nl/?url=https://simkl.in/posters/12/12555627230494cf5_m.webp&w=300&fit=cover',
    url: 'https://simkl.com/tv/1255562/severance',
  },
  {
    title: 'Attack on Titan',
    year: 2013,
    category: 'anime',
    categoryLabel: 'Anime',
    rating: 10,
    poster: 'https://wsrv.nl/?url=https://simkl.in/posters/39/3983271789c0bfbb_m.webp&w=300&fit=cover',
    url: 'https://simkl.com/anime/39832/shingeki-no-kyojin',
  },
  {
    title: 'Spirited Away',
    year: 2001,
    category: 'anime',
    categoryLabel: 'Anime',
    rating: 10,
    poster: 'https://wsrv.nl/?url=https://simkl.in/posters/39/3932404e38e8ec43_m.webp&w=300&fit=cover',
    url: 'https://simkl.com/anime/39324/sen-to-chihiro-no-kamikakushi',
  },
  {
    title: 'Better Call Saul',
    year: 2015,
    category: 'show',
    categoryLabel: 'Show',
    rating: 10,
    poster: 'https://wsrv.nl/?url=https://simkl.in/posters/45/45680456184852c0_m.webp&w=300&fit=cover',
    url: 'https://simkl.com/tv/456804/better-call-saul',
  },
  {
    title: 'Arcane',
    year: 2021,
    category: 'anime',
    categoryLabel: 'Show',
    rating: 10,
    poster: 'https://wsrv.nl/?url=https://simkl.in/posters/11/1183204928b57fb4_m.webp&w=300&fit=cover',
    url: 'https://simkl.com/tv/1183204/arcane',
  },
];

const FALLBACK_RECENT = [
  {
    title: 'Dune: Part Two',
    year: 2024,
    category: 'movie',
    categoryLabel: 'Movie',
    watchedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    rating: 9,
    poster: 'https://wsrv.nl/?url=https://simkl.in/posters/17/1739834241071d87e_m.webp&w=300&fit=cover',
    url: 'https://simkl.com/movies/1739834/dune-part-two',
  },
  {
    title: 'Frieren: Beyond Journey\'s End',
    year: 2023,
    category: 'anime',
    categoryLabel: 'Anime',
    watchedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    rating: 10,
    poster: 'https://wsrv.nl/?url=https://simkl.in/posters/19/19441160866d9255a_m.webp&w=300&fit=cover',
    url: 'https://simkl.com/anime/1944116/sousou-no-frieren',
  },
  {
    title: 'Succession',
    year: 2018,
    category: 'show',
    categoryLabel: 'Show',
    watchedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
    rating: 10,
    poster: 'https://wsrv.nl/?url=https://simkl.in/posters/76/7679808a385f02f8_m.webp&w=300&fit=cover',
    url: 'https://simkl.com/tv/767980/succession',
  },
  {
    title: 'Oppenheimer',
    year: 2023,
    category: 'movie',
    categoryLabel: 'Movie',
    watchedAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(),
    rating: 9,
    poster: 'https://wsrv.nl/?url=https://simkl.in/posters/17/1723224795b28d090_m.webp&w=300&fit=cover',
    url: 'https://simkl.com/movies/1723224/oppenheimer',
  },
];

/**
 * Normalizes an item from Simkl API payload
 */
function normalizeItem(raw, category) {
  const meta = raw.movie || raw.show || raw.shows || raw.anime || raw;
  const title = meta.title || raw.title || 'Untitled';
  const year = meta.year || raw.year || null;
  const poster = meta.poster || raw.poster || null;
  const rating = raw.user_rating != null ? Number(raw.user_rating) : (raw.rating != null ? Number(raw.rating) : null);
  const watchedAt = raw.last_watched_at || raw.watched_at || raw.user_rated_at || null;
  const ids = meta.ids || raw.ids || {};
  const slug = ids.slug || ids.simkl || '';

  const simklUrl = slug
    ? `https://simkl.com/${category === 'movie' ? 'movies' : category === 'show' ? 'tv' : 'anime'}/${slug}`
    : USER_PROFILE_URL;

  const posterUrl = poster
    ? (poster.startsWith('http') ? poster : `https://wsrv.nl/?url=https://simkl.in/posters/${poster}_m.webp&w=300&fit=cover`)
    : null;

  return {
    title,
    year,
    poster: posterUrl,
    rating,
    watchedAt,
    category,
    categoryLabel: category === 'movie' ? 'Movie' : category === 'show' ? 'Show' : 'Anime',
    url: simklUrl,
  };
}

/**
 * Format relative date (e.g. "Yesterday", "3 days ago", "12 Oct")
 */
export function formatWatchedDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;

  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Fetches all media items from Simkl and separates into Recently Watched and 10/10 Favorites.
 */
export async function getSimklData() {
  const clientId = process.env.SIMKL_CLIENT_ID || '';
  const userToken = process.env.SIMKL_USER_TOKEN || process.env.SIMKL_ACCESS_TOKEN || '';

  if (!clientId || !userToken) {
    return {
      isLive: false,
      hasCredentials: false,
      profileUrl: USER_PROFILE_URL,
      recentlyWatched: FALLBACK_RECENT,
      favorites: FALLBACK_FAVORITES,
    };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(`${SIMKL_API_BASE}/sync/all-items?extended=full`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${userToken}`,
        'simkl-api-key': clientId,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      console.warn(`[simkl] API responded with status ${res.status}: ${res.statusText}`);
      return {
        isLive: false,
        hasCredentials: true,
        profileUrl: USER_PROFILE_URL,
        recentlyWatched: FALLBACK_RECENT,
        favorites: FALLBACK_FAVORITES,
      };
    }

    const data = await res.json();
    const movies = Array.isArray(data.movies) ? data.movies.map((m) => normalizeItem(m, 'movie')) : [];
    const shows = Array.isArray(data.shows) ? data.shows.map((s) => normalizeItem(s, 'show')) : [];
    const anime = Array.isArray(data.anime) ? data.anime.map((a) => normalizeItem(a, 'anime')) : [];

    const allItems = [...movies, ...shows, ...anime];

    // 1. Recently Watched: items with watchedAt, sorted descending
    const recentlyWatched = allItems
      .filter((item) => Boolean(item.watchedAt))
      .sort((a, b) => new Date(b.watchedAt).getTime() - new Date(a.watchedAt).getTime())
      .slice(0, 10);

    // 2. All-Time Favorites: items with rating == 10
    const favorites = allItems
      .filter((item) => item.rating === 10)
      .sort((a, b) => (b.watchedAt ? new Date(b.watchedAt).getTime() : 0) - (a.watchedAt ? new Date(a.watchedAt).getTime() : 0))
      .slice(0, 12);

    return {
      isLive: true,
      hasCredentials: true,
      profileUrl: USER_PROFILE_URL,
      recentlyWatched: recentlyWatched.length > 0 ? recentlyWatched : FALLBACK_RECENT,
      favorites: favorites.length > 0 ? favorites : FALLBACK_FAVORITES,
    };
  } catch (err) {
    console.error('[simkl] Error fetching live watch history:', err.message);
    return {
      isLive: false,
      hasCredentials: true,
      profileUrl: USER_PROFILE_URL,
      recentlyWatched: FALLBACK_RECENT,
      favorites: FALLBACK_FAVORITES,
    };
  }
}
