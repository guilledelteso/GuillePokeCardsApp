/* localStorage-backed collection & wishlist manager */
const Storage = (() => {
  const KEYS = {
    collection: 'ptcg_collection_v2',
    wishlist:   'ptcg_wishlist_v2',
  };

  function load(key) {
    try {
      return JSON.parse(localStorage.getItem(key)) || {};
    } catch { return {}; }
  }

  function save(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
      return true;
    } catch (e) {
      console.error('Storage save failed:', e);
      return false;
    }
  }

  /* ── Collection ──────────────────────────────────────────────────────── */
  // Stored as: { [cardId]: { card: {id,name,image,localId,set?}, qty: number } }

  function getCollection() { return load(KEYS.collection); }

  function addToCollection(card, qty = 1) {
    const col = getCollection();
    if (col[card.id]) {
      col[card.id].qty += qty;
    } else {
      col[card.id] = { card: normalizeCard(card), qty };
    }
    save(KEYS.collection, col);
    return col[card.id].qty;
  }

  function setQuantity(cardId, qty) {
    const col = getCollection();
    if (qty <= 0) {
      delete col[cardId];
    } else if (col[cardId]) {
      col[cardId].qty = qty;
    }
    save(KEYS.collection, col);
  }

  function removeFromCollection(cardId) {
    const col = getCollection();
    delete col[cardId];
    save(KEYS.collection, col);
  }

  function getQuantity(cardId) {
    return getCollection()[cardId]?.qty ?? 0;
  }

  function isInCollection(cardId) {
    return cardId in getCollection();
  }

  /* ── Wishlist ─────────────────────────────────────────────────────────── */
  // Stored as: { [cardId]: { card: normalizedCard } }

  function getWishlist() { return load(KEYS.wishlist); }

  function addToWishlist(card) {
    const wl = getWishlist();
    wl[card.id] = { card: normalizeCard(card) };
    save(KEYS.wishlist, wl);
  }

  function removeFromWishlist(cardId) {
    const wl = getWishlist();
    delete wl[cardId];
    save(KEYS.wishlist, wl);
  }

  function isInWishlist(cardId) {
    return cardId in getWishlist();
  }

  /* ── Toggle helpers ───────────────────────────────────────────────────── */
  function toggleCollection(card) {
    if (isInCollection(card.id)) {
      removeFromCollection(card.id);
      return false;
    } else {
      addToCollection(card, 1);
      return true;
    }
  }

  function toggleWishlist(card) {
    if (isInWishlist(card.id)) {
      removeFromWishlist(card.id);
      return false;
    } else {
      addToWishlist(card);
      return true;
    }
  }

  /* ── Stats ───────────────────────────────────────────────────────────── */
  function getStats() {
    const col = getCollection();
    const wl  = getWishlist();
    const ids = Object.keys(col);
    const totalQty = ids.reduce((sum, id) => sum + (col[id].qty || 0), 0);
    return {
      uniqueCards: ids.length,
      totalCards:  totalQty,
      wishlistCount: Object.keys(wl).length,
    };
  }

  /* ── Import / Export ─────────────────────────────────────────────────── */
  function exportData() {
    return {
      version: 2,
      exportedAt: new Date().toISOString(),
      collection: getCollection(),
      wishlist:   getWishlist(),
    };
  }

  function importData(raw) {
    let data;
    try { data = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch {
      throw new Error('El archivo no es un JSON válido.');
    }
    if (!data || typeof data !== 'object') throw new Error('Formato incorrecto.');

    // Support both v1 (arrays) and v2 (objects)
    if (data.collection && typeof data.collection === 'object') {
      save(KEYS.collection, data.collection);
    }
    if (data.wishlist && typeof data.wishlist === 'object') {
      save(KEYS.wishlist, data.wishlist);
    }
    return true;
  }

  /* ── Utilities ────────────────────────────────────────────────────────── */
  function normalizeCard(card) {
    return {
      id:      card.id,
      name:    card.name,
      image:   card.image ?? null,
      localId: card.localId ?? null,
      rarity:  card.rarity ?? null,
      types:   card.types ?? null,
      set: card.set
        ? { id: card.set.id, name: card.set.name }
        : null,
    };
  }

  return {
    getCollection, addToCollection, setQuantity, removeFromCollection,
    getQuantity, isInCollection, toggleCollection,
    getWishlist, addToWishlist, removeFromWishlist, isInWishlist, toggleWishlist,
    getStats,
    exportData, importData,
  };
})();
