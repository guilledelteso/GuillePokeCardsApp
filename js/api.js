/* TCGDex API wrapper with in-memory cache */
const API = (() => {
  const BASE = 'https://api.tcgdex.net/v2/en';
  const cache = new Map();
  const TTL = {
    sets:   60 * 60 * 1000,  // 1h — sets don't change often
    set:    30 * 60 * 1000,  // 30m
    card:  120 * 60 * 1000,  // 2h — cards are stable
    search:  5 * 60 * 1000,  // 5m
  };

  async function fetchJSON(url, ttl = 60000) {
    const entry = cache.get(url);
    if (entry && Date.now() - entry.ts < ttl) return entry.data;

    const res = await fetch(url);
    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error(`API error ${res.status}: ${url}`);
    }
    const data = await res.json();
    cache.set(url, { data, ts: Date.now() });
    return data;
  }

  return {
    /** Fetch all sets (brief info: id, name, logo, cardCount) */
    getSets() {
      return fetchJSON(`${BASE}/sets`, TTL.sets);
    },

    /** Fetch a full set with cards array */
    getSet(id) {
      return fetchJSON(`${BASE}/sets/${id}`, TTL.set);
    },

    /** Fetch full card detail */
    getCard(id) {
      return fetchJSON(`${BASE}/cards/${id}`, TTL.card);
    },

    /** Search cards by name. Returns array of brief card objects. */
    searchByName(name) {
      const q = encodeURIComponent(name.trim());
      return fetchJSON(`${BASE}/cards?name=${q}`, TTL.search);
    },

    /**
     * Construct the full image URL from a card's `image` base string.
     * quality: 'high' | 'low'   format: 'webp' | 'png'
     */
    imgUrl(base, quality = 'low', format = 'webp') {
      if (!base) return null;
      return `${base}/${quality}.${format}`;
    },

    imgHigh(base) { return this.imgUrl(base, 'high', 'webp'); },
    imgLow(base)  { return this.imgUrl(base, 'low',  'webp'); },

    /** Logo URL — logos don't use quality subfolders, just append .png */
    logoUrl(base) { return base ? `${base}.png` : null; },

    /** Clear in-memory cache (useful for forced refresh) */
    clearCache() { cache.clear(); },
  };
})();
