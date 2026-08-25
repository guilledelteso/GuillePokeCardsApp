/* ─── Guille PokeCards App — Main App Controller ─────────────────────────── */

const App = (() => {
  // ── State ────────────────────────────────────────────────────────────────
  let state = {
    view: 'browse',
    sets: [],
    currentSet: null,
    searchQuery: '',
    searchResults: [],
    loading: false,
    installPrompt: null,
    offline: !navigator.onLine,
  };

  // ── DOM refs ─────────────────────────────────────────────────────────────
  const $ = id => document.getElementById(id);
  const dom = {};

  function initDom() {
    dom.pageTitle    = $('page-title');
    dom.backBtn      = $('back-btn');
    dom.installBtn   = $('install-btn');
    dom.exportBtn    = $('export-btn');
    dom.importBtn    = $('import-btn');
    dom.importFile   = $('import-file');
    dom.navItems     = document.querySelectorAll('.nav-item');
    dom.views        = document.querySelectorAll('.view');
    dom.modalOverlay = $('modal-overlay');
    dom.cardModal    = $('card-modal');
    dom.toastContainer = $('toast-container');
    dom.offlineBar   = $('offline-bar');
    dom.progressBar  = $('progress-bar');
    dom.collBadge    = $('coll-badge');
    dom.wishBadge    = $('wish-badge');
    dom.searchInput  = $('search-input');
  }

  // ── Type colors ──────────────────────────────────────────────────────────
  const typeEmoji = {
    Fire:'🔥', Water:'💧', Grass:'🌿', Electric:'⚡', Psychic:'🔮',
    Ice:'❄️', Dragon:'🐉', Dark:'🌑', Fairy:'✨', Fighting:'🥊',
    Poison:'☠️', Ground:'🌍', Flying:'🌬️', Bug:'🐛', Rock:'🪨',
    Ghost:'👻', Steel:'⚙️', Normal:'⬜', Colorless:'⭐',
  };

  // ── Router ───────────────────────────────────────────────────────────────
  function navigate(view, opts = {}) {
    state.view = view;
    if (opts.set) state.currentSet = opts.set;

    // Show/hide views
    dom.views.forEach(v => {
      const show = v.dataset.view === view || (view === 'set' && v.dataset.view === 'set');
      v.hidden = !show;
    });

    // Update nav
    dom.navItems.forEach(item => {
      const active = item.dataset.view === view || (view === 'set' && item.dataset.view === 'browse');
      item.classList.toggle('active', active);
    });

    // Update back btn + title
    if (view === 'set' && state.currentSet) {
      dom.backBtn.hidden = false;
      dom.pageTitle.textContent = state.currentSet.name || 'Set';
    } else {
      dom.backBtn.hidden = true;
      const titles = { browse:'Guille PokeCards App', search:'Buscar Cartas', collection:'Mi Colección', wishlist:'Lista de Deseos' };
      dom.pageTitle.textContent = titles[view] || 'Guille PokeCards App';
    }

    // Render the active view
    switch (view) {
      case 'browse':     renderBrowse();     break;
      case 'set':        renderSet();        break;
      case 'search':
        renderSearch();
        setTimeout(() => dom.searchInput?.focus(), 100);
        break;
      case 'collection': renderCollection(); break;
      case 'wishlist':   renderWishlist();   break;
    }
  }

  // ── Browse view ──────────────────────────────────────────────────────────
  async function renderBrowse() {
    const grid = $('sets-grid');
    if (!grid) return;

    if (state.sets.length > 0) {
      grid.innerHTML = buildSetsHtml(state.sets);
      return;
    }

    // Show loading skeletons
    grid.innerHTML = buildSetSkeletons(12);
    setLoading(true);

    try {
      const sets = await API.getSets();
      state.sets = (sets || []).sort((a, b) => {
        // Sort by releaseDate descending; sets without date go last
        if (!a.releaseDate && !b.releaseDate) return 0;
        if (!a.releaseDate) return 1;
        if (!b.releaseDate) return -1;
        return b.releaseDate.localeCompare(a.releaseDate);
      });
      grid.innerHTML = buildSetsHtml(state.sets);
    } catch (e) {
      grid.innerHTML = buildErrorHtml('No se pudieron cargar los sets.', () => {
        state.sets = [];
        renderBrowse();
      });
    } finally {
      setLoading(false);
    }
  }

  function buildSetSkeletons(n) {
    return Array.from({ length: n }, () => `
      <div class="skeleton-card">
        <div class="skeleton-img" style="aspect-ratio:16/9"></div>
        <div class="skeleton-info">
          <div class="skeleton-text" style="width:80%"></div>
          <div class="skeleton-text" style="width:50%;margin-top:6px"></div>
        </div>
      </div>`).join('');
  }

  function buildSetsHtml(sets) {
    if (!sets.length) return buildEmptyHtml('📦', 'Sin sets', 'No se encontraron sets.');

    // Group by series (approximated via release year)
    const groups = {};
    for (const s of sets) {
      const year = s.releaseDate ? s.releaseDate.slice(0, 4) : 'Clásico';
      if (!groups[year]) groups[year] = [];
      groups[year].push(s);
    }

    const years = Object.keys(groups).sort((a, b) => b - a);
    return years.map(year => `
      <div class="series-section">
        <div class="series-title">${year}</div>
        <div class="sets-grid">
          ${groups[year].map(s => buildSetCardHtml(s)).join('')}
        </div>
      </div>`).join('');
  }

  function buildSetCardHtml(s) {
    const count = s.cardCount?.official ?? s.cardCount?.total ?? '?';
    const logo = s.logo ? `<img class="set-logo" src="${API.logoUrl(s.logo)}" alt="${esc(s.name)}" loading="lazy" onerror="this.parentNode.innerHTML='<span class=set-logo-placeholder>${esc(s.name)}</span>'">` :
      `<span class="set-logo-placeholder">${esc(s.name)}</span>`;
    const date = s.releaseDate ? new Date(s.releaseDate).toLocaleDateString('es-ES', {month:'short', year:'numeric'}) : '';
    return `
      <div class="set-card" data-set-id="${esc(s.id)}" tabindex="0" role="button" aria-label="Ver set ${esc(s.name)}">
        <div class="set-logo-wrap">${logo}</div>
        <div class="set-info">
          <div class="set-name" title="${esc(s.name)}">${esc(s.name)}</div>
          <div class="set-meta">
            <span>${date}</span>
            <span class="set-count">${count} cartas</span>
          </div>
        </div>
      </div>`;
  }

  // ── Set view ─────────────────────────────────────────────────────────────
  async function renderSet() {
    const grid = $('set-cards-grid');
    if (!grid || !state.currentSet) return;

    // Show skeleton while loading full set
    if (!state.currentSet.cards) {
      grid.innerHTML = buildCardSkeletons(20);
      setLoading(true);
      try {
        const fullSet = await API.getSet(state.currentSet.id);
        state.currentSet = fullSet;
      } catch (e) {
        grid.innerHTML = buildErrorHtml('No se pudo cargar el set.', renderSet);
        setLoading(false);
        return;
      } finally {
        setLoading(false);
      }
    }

    const set = state.currentSet;
    const cards = set.cards || [];

    const logoTag = set.logo
      ? `<img class="set-detail-logo" src="${API.logoUrl(set.logo)}" alt="${esc(set.name)}" onerror="this.style.display='none'">`
      : '';
    const date = set.releaseDate ? new Date(set.releaseDate).toLocaleDateString('es-ES', {day:'numeric',month:'long',year:'numeric'}) : '';

    grid.innerHTML = `
      <div class="view-content" style="padding-top:0">
        <div class="breadcrumb">
          <span class="breadcrumb-item" data-nav="browse">Explorar</span>
          <span class="breadcrumb-sep">›</span>
          <span class="breadcrumb-current">${esc(set.name)}</span>
        </div>
        <div class="set-detail-header">
          ${logoTag}
          <div class="set-detail-info">
            <div class="set-detail-name">${esc(set.name)}</div>
            <div class="set-detail-meta">
              ${date ? `<span>📅 ${date}</span>` : ''}
              <span>🃏 ${cards.length} cartas</span>
              ${set.legal?.standard ? '<span class="tag" style="font-size:11px">Standard</span>' : ''}
            </div>
          </div>
        </div>
        <div class="cards-grid">
          ${cards.map(c => buildCardItemHtml(c)).join('')}
        </div>
      </div>`;

    attachCardEvents(grid);
  }

  function buildCardSkeletons(n) {
    return `<div class="view-content" style="padding-top:0">
      <div class="cards-grid">${Array.from({length:n}, () => `
        <div class="skeleton-card">
          <div class="skeleton-img"></div>
          <div class="skeleton-info">
            <div class="skeleton-text" style="width:75%"></div>
            <div class="skeleton-text" style="width:40%;margin-top:4px"></div>
          </div>
        </div>`).join('')}
      </div>
    </div>`;
  }

  function buildCardItemHtml(card) {
    const inCol = Storage.isInCollection(card.id);
    const inWish = Storage.isInWishlist(card.id);
    const qty = Storage.getQuantity(card.id);
    const imgSrc = API.imgHigh(card.image);
    const imgTag = imgSrc
      ? `<img class="card-img loading" src="${imgSrc}" alt="${esc(card.name)}" loading="lazy" onload="this.classList.remove('loading');this.classList.add('loaded');this.previousElementSibling&&this.previousElementSibling.remove()" onerror="this.style.display='none';this.previousElementSibling&&this.previousElementSibling.remove()">`
      : '';

    const types = card.types || [];
    const typeBadge = types.length
      ? `<span class="type-badge type-${types[0]}">${typeEmoji[types[0]] || ''} ${esc(types[0])}</span>`
      : '';

    return `
      <div class="card-item" data-card-id="${esc(card.id)}" tabindex="0" role="button" aria-label="${esc(card.name)}">
        <div class="card-img-wrap">
          ${imgSrc ? '<div class="card-img-skeleton"></div>' : ''}
          ${imgTag}
          <div class="card-overlay">
            <button class="card-action ${inWish ? 'active' : ''}" data-action="wishlist" data-card-id="${esc(card.id)}" title="${inWish ? 'Quitar de deseos' : 'Añadir a deseos'}" aria-label="Lista de deseos">
              ${inWish ? '♥' : '♡'}
            </button>
            <button class="card-action ${inCol ? 'active' : ''}" data-action="collect" data-card-id="${esc(card.id)}" title="${inCol ? 'Quitar de colección' : 'Añadir a colección'}" aria-label="Colección">
              ${inCol ? '✓' : '+'}
            </button>
          </div>
        </div>
        ${qty > 0 ? `<div class="owned-badge">×${qty}</div>` : ''}
        ${inWish ? '<div class="wishlist-marker">♥</div>' : ''}
        <div class="card-info">
          <div class="card-name" title="${esc(card.name)}">${esc(card.name)}</div>
          <div class="card-meta">
            <span class="card-number">#${esc(card.localId ?? '')}</span>
            ${typeBadge}
          </div>
        </div>
      </div>`;
  }

  function attachCardEvents(container) {
    container.querySelectorAll('.card-item').forEach(el => {
      el.addEventListener('click', e => {
        // Check if clicking an action button
        const action = e.target.closest('[data-action]');
        if (action) {
          e.stopPropagation();
          handleCardAction(action.dataset.action, action.dataset.cardId, el);
          return;
        }
        // Open detail
        const cardId = el.dataset.cardId;
        if (cardId) openCardModal(cardId);
      });
      el.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.click(); }
      });
    });

    // Breadcrumb navigation
    container.querySelectorAll('[data-nav]').forEach(el => {
      el.addEventListener('click', () => navigate(el.dataset.nav));
    });

    // Set card clicks
    container.querySelectorAll('.set-card').forEach(el => {
      el.addEventListener('click', () => {
        const id = el.dataset.setId;
        if (id) openSet({ id, name: el.querySelector('.set-name')?.textContent });
      });
      el.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.click(); }
      });
    });
  }

  function handleCardAction(action, cardId, cardEl) {
    // We need the card data. For quick actions, build minimal card from the DOM
    const name = cardEl.querySelector('.card-name')?.textContent || cardId;
    const img  = cardEl.querySelector('.card-img')?.src?.replace(/\/low\.webp$/, '') || null;
    const localId = cardEl.querySelector('.card-number')?.textContent?.replace('#','') || null;
    const card = { id: cardId, name, image: img ? img.replace('/low.webp','') : null, localId };

    if (action === 'collect') {
      const added = Storage.toggleCollection(card);
      toast(added ? `✓ ${name} añadida a la colección` : `${name} eliminada de la colección`, added ? 'success' : 'info');
    } else if (action === 'wishlist') {
      const added = Storage.toggleWishlist(card);
      toast(added ? `♥ ${name} en lista de deseos` : `${name} eliminada de la lista`, added ? 'info' : 'info');
    }

    // Re-render the card in place
    const setId = state.currentSet?.id;
    const setName = state.currentSet?.name;
    const cards = state.currentSet?.cards || state.searchResults || [];
    const cardData = cards.find(c => c.id === cardId) || card;
    const newHtml = buildCardItemHtml(cardData);
    const tmp = document.createElement('div');
    tmp.innerHTML = newHtml;
    const newEl = tmp.firstElementChild;
    cardEl.replaceWith(newEl);
    attachCardEvents(newEl.parentElement);
    updateBadges();
  }

  function openSet(set) {
    state.currentSet = set;
    navigate('set', { set });
  }

  // ── Search view ──────────────────────────────────────────────────────────
  let searchDebounce = null;

  function renderSearch() {
    const results = $('search-results');
    if (!results) return;
    if (!state.searchQuery) {
      results.innerHTML = `
        <div class="search-hint">
          <div class="search-hint-icon">🔍</div>
          <p>Escribe el nombre de una carta para buscar</p>
        </div>`;
      return;
    }
    if (state.searchResults.length) {
      results.innerHTML = state.searchResults.map(c => buildCardItemHtml(c)).join('');
      attachCardEvents(results);
    }
  }

  async function doSearch(query) {
    if (!query.trim()) {
      state.searchQuery = '';
      state.searchResults = [];
      renderSearch();
      return;
    }

    state.searchQuery = query;
    const results = $('search-results');
    if (!results) return;
    results.innerHTML = buildCardSkeletons(8).replace('view-content','').replace('padding-top:0','');
    setLoading(true);

    try {
      const data = await API.searchByName(query);
      state.searchResults = data || [];
      if (!state.searchResults.length) {
        results.innerHTML = buildEmptyHtml('🃏', 'Sin resultados', `No se encontraron cartas para "${esc(query)}".`);
      } else {
        results.innerHTML = state.searchResults.map(c => buildCardItemHtml(c)).join('');
        attachCardEvents(results);
      }
    } catch (e) {
      results.innerHTML = buildErrorHtml('Error en la búsqueda. Revisa tu conexión.', () => doSearch(query));
    } finally {
      setLoading(false);
    }
  }

  // ── Collection view ──────────────────────────────────────────────────────
  function renderCollection() {
    const content = $('collection-content');
    if (!content) return;

    const col = Storage.getCollection();
    const items = Object.values(col);
    const stats = Storage.getStats();

    if (!items.length) {
      content.innerHTML = `
        <div class="collection-stats">
          <div class="stat-card"><div class="stat-value">0</div><div class="stat-label">Cartas únicas</div></div>
          <div class="stat-card"><div class="stat-value">0</div><div class="stat-label">Total cartas</div></div>
          <div class="stat-card"><div class="stat-value">0</div><div class="stat-label">En deseos</div></div>
        </div>
        ${buildEmptyHtml('📦', 'Colección vacía', 'Explora los sets y añade cartas a tu colección pulsando el botón +.')}`;
      return;
    }

    content.innerHTML = `
      <div class="collection-stats">
        <div class="stat-card"><div class="stat-value">${stats.uniqueCards}</div><div class="stat-label">Cartas únicas</div></div>
        <div class="stat-card"><div class="stat-value">${stats.totalCards}</div><div class="stat-label">Total cartas</div></div>
        <div class="stat-card"><div class="stat-value">${stats.wishlistCount}</div><div class="stat-label">En deseos</div></div>
      </div>
      <div class="collection-grid">
        ${items.map(({ card, qty }) => buildCollectionCardHtml(card, qty)).join('')}
      </div>`;

    attachCollectionEvents(content);
  }

  function buildCollectionCardHtml(card, qty) {
    const imgSrc = API.imgHigh(card.image);
    return `
      <div class="collection-card" data-card-id="${esc(card.id)}">
        <div class="collection-card-img-wrap" data-open-card="${esc(card.id)}">
          <img src="${imgSrc || ''}" alt="${esc(card.name)}" loading="lazy" onerror="this.src=''">
          <button class="remove-btn" data-remove="${esc(card.id)}" title="Eliminar de colección" aria-label="Eliminar">
            <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div class="collection-card-body">
          <div class="collection-card-name" title="${esc(card.name)}">${esc(card.name)}</div>
          <div class="collection-card-set">${esc(card.set?.name ?? '')}</div>
          <div class="quantity-control" data-card-id="${esc(card.id)}">
            <button class="qty-btn" data-qty-dec="${esc(card.id)}" aria-label="Reducir cantidad">−</button>
            <span class="qty-value">${qty}</span>
            <button class="qty-btn" data-qty-inc="${esc(card.id)}" aria-label="Aumentar cantidad">+</button>
          </div>
        </div>
      </div>`;
  }

  function attachCollectionEvents(container) {
    container.querySelectorAll('[data-open-card]').forEach(el => {
      el.addEventListener('click', e => {
        if (e.target.closest('[data-remove]')) return;
        openCardModal(el.dataset.openCard);
      });
    });

    container.querySelectorAll('[data-remove]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const id = btn.dataset.remove;
        const name = btn.closest('.collection-card')?.querySelector('.collection-card-name')?.textContent || id;
        Storage.removeFromCollection(id);
        toast(`${name} eliminada de la colección`);
        renderCollection();
        updateBadges();
      });
    });

    container.querySelectorAll('[data-qty-inc]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.qtyInc;
        const cur = Storage.getQuantity(id);
        Storage.setQuantity(id, cur + 1);
        btn.closest('.quantity-control').querySelector('.qty-value').textContent = cur + 1;
      });
    });

    container.querySelectorAll('[data-qty-dec]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.qtyDec;
        const cur = Storage.getQuantity(id);
        if (cur <= 1) {
          const name = btn.closest('.collection-card')?.querySelector('.collection-card-name')?.textContent || id;
          Storage.removeFromCollection(id);
          toast(`${name} eliminada de la colección`);
          renderCollection();
          updateBadges();
        } else {
          Storage.setQuantity(id, cur - 1);
          btn.closest('.quantity-control').querySelector('.qty-value').textContent = cur - 1;
        }
      });
    });
  }

  // ── Wishlist view ─────────────────────────────────────────────────────────
  function renderWishlist() {
    const grid = $('wishlist-grid');
    if (!grid) return;

    const wl = Storage.getWishlist();
    const items = Object.values(wl);

    if (!items.length) {
      grid.innerHTML = buildEmptyHtml('♡', 'Lista de deseos vacía', 'Explora los sets y añade cartas que quieras conseguir pulsando ♡.');
      return;
    }

    grid.innerHTML = items.map(({ card }) => buildCardItemHtml(card)).join('');
    attachCardEvents(grid);
  }

  // ── Card Detail Modal ─────────────────────────────────────────────────────
  async function openCardModal(cardId) {
    dom.cardModal.innerHTML = buildModalLoadingHtml();
    dom.modalOverlay.hidden = false;
    document.body.style.overflow = 'hidden';

    try {
      const card = await API.getCard(cardId);
      if (!card) { dom.cardModal.innerHTML = '<div class="modal-body">Carta no encontrada.</div>'; return; }
      renderCardModal(card);
    } catch (e) {
      dom.cardModal.innerHTML = `<div class="modal-body"><p>Error cargando la carta.</p><button class="btn btn-secondary" id="modal-retry">Reintentar</button></div>`;
      $('modal-retry')?.addEventListener('click', () => openCardModal(cardId));
    }
  }

  function buildModalLoadingHtml() {
    return `<div class="modal-header"><div></div><button class="modal-close" id="modal-close-btn" aria-label="Cerrar"><svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></div>
    <div class="modal-body" style="display:flex;align-items:center;justify-content:center;min-height:200px">
      <div style="text-align:center;color:var(--text3)"><div style="font-size:36px;margin-bottom:12px">🃏</div><p>Cargando carta...</p></div>
    </div>`;
  }

  function renderCardModal(card) {
    const inCol = Storage.isInCollection(card.id);
    const inWish = Storage.isInWishlist(card.id);
    const qty = Storage.getQuantity(card.id);
    const imgSrc = API.imgHigh(card.image);

    const types = (card.types || []).map(t =>
      `<span class="tag type-badge type-${t}">${typeEmoji[t] || ''} ${esc(t)}</span>`).join('');

    const weaknesses = (card.weaknesses || []).map(w =>
      `<span class="tag">${esc(w.type)} ${esc(w.value || '')}</span>`).join('');

    const attacks = (card.attacks || []).map(a => `
      <div class="attack-item">
        <div class="attack-header">
          <span class="attack-name">${esc(a.name)}</span>
          ${a.damage ? `<span class="attack-damage">${esc(String(a.damage))}</span>` : ''}
        </div>
        ${a.cost?.length ? `<div class="attack-cost">${a.cost.map(c => `<span class="energy-pip" title="${esc(c)}">${typeEmoji[c]||'⚪'}</span>`).join('')}</div>` : ''}
        ${a.effect ? `<div class="attack-effect">${esc(a.effect)}</div>` : ''}
      </div>`).join('');

    const abilities = (card.abilities || []).map(ab => `
      <div class="attack-item">
        <div class="attack-header">
          <span class="attack-name">${esc(ab.name)}</span>
          <span class="tag" style="font-size:10px">${esc(ab.type || 'Habilidad')}</span>
        </div>
        ${ab.effect ? `<div class="attack-effect">${esc(ab.effect)}</div>` : ''}
      </div>`).join('');

    dom.cardModal.innerHTML = `
      <div class="modal-header">
        <div style="font-size:var(--text-sm);color:var(--text3)">${esc(card.set?.name || '')}</div>
        <button class="modal-close" id="modal-close-btn" aria-label="Cerrar">
          <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div class="modal-body">
        <div class="card-detail-grid">
          <div class="card-detail-img-wrap">
            <img src="${imgSrc || ''}" alt="${esc(card.name)}" onerror="this.src=''">
          </div>
          <div class="card-detail-info">
            <div class="card-detail-name">${esc(card.name)}</div>
            <div class="card-detail-set">${esc(card.set?.name || '')} · #${esc(card.localId || '')}</div>
            <div class="card-tags">
              ${types}
              ${card.rarity ? `<span class="tag rarity-${(card.rarity||'').replace(/\s/g,'-')}">${esc(card.rarity)}</span>` : ''}
              ${card.stage ? `<span class="tag">${esc(card.stage)}</span>` : ''}
            </div>
            <div class="card-detail-stats">
              ${card.hp ? `<div class="stat-item"><div class="stat-item-label">HP</div><div class="stat-item-value" style="color:var(--error)">${esc(String(card.hp))}</div></div>` : ''}
              ${card.illustrator ? `<div class="stat-item"><div class="stat-item-label">Ilustrador</div><div class="stat-item-value" style="font-size:11px">${esc(card.illustrator)}</div></div>` : ''}
              ${card.retreat !== undefined ? `<div class="stat-item"><div class="stat-item-label">Retirada</div><div class="stat-item-value">${Array(card.retreat).fill('⭕').join('')||'—'}</div></div>` : ''}
              ${weaknesses ? `<div class="stat-item"><div class="stat-item-label">Debilidades</div><div class="stat-item-value">${weaknesses}</div></div>` : ''}
              ${card.evolveFrom ? `<div class="stat-item"><div class="stat-item-label">Evoluciona de</div><div class="stat-item-value">${esc(card.evolveFrom)}</div></div>` : ''}
              ${card.dexId?.length ? `<div class="stat-item"><div class="stat-item-label">Pokédex</div><div class="stat-item-value">#${card.dexId.join(', ')}</div></div>` : ''}
            </div>
            ${card.description ? `<div class="card-description">${esc(card.description)}</div>` : ''}
          </div>
        </div>
        ${abilities ? `<div class="card-section-title">Habilidades</div>${abilities}` : ''}
        ${attacks   ? `<div class="card-section-title">Ataques</div>${attacks}` : ''}

        ${buildPricingHtml(card.pricing)}

        ${inCol ? `
          <div class="card-section-title">En tu colección</div>
          <div class="quantity-control" id="modal-qty-ctrl" data-card-id="${esc(card.id)}" style="max-width:140px">
            <button class="qty-btn" id="modal-qty-dec">−</button>
            <span class="qty-value" id="modal-qty-val">${qty}</span>
            <button class="qty-btn" id="modal-qty-inc">+</button>
          </div>` : ''}
      </div>
      <div class="modal-footer">
        <button class="btn ${inCol ? 'btn-secondary' : 'btn-primary'}" id="modal-collect-btn" data-card-id="${esc(card.id)}">
          ${inCol ? '✓ En colección' : '+ Añadir a colección'}
        </button>
        <button class="btn btn-ghost" id="modal-wish-btn" data-card-id="${esc(card.id)}" style="${inWish ? 'color:var(--error)' : ''}">
          ${inWish ? '♥ En deseos' : '♡ Lista de deseos'}
        </button>
      </div>`;

    // Modal events
    $('modal-close-btn')?.addEventListener('click', closeModal);

    $('modal-collect-btn')?.addEventListener('click', () => {
      const btn = $('modal-collect-btn');
      const isIn = Storage.isInCollection(card.id);
      if (isIn) {
        Storage.removeFromCollection(card.id);
        toast(`${card.name} eliminada de la colección`);
      } else {
        Storage.addToCollection(card, 1);
        toast(`✓ ${card.name} añadida a la colección`, 'success');
      }
      updateBadges();
      // Re-render modal with updated state
      renderCardModal(card);
    });

    $('modal-wish-btn')?.addEventListener('click', () => {
      const isIn = Storage.isInWishlist(card.id);
      if (isIn) {
        Storage.removeFromWishlist(card.id);
        toast(`${card.name} eliminada de la lista`);
      } else {
        Storage.addToWishlist(card);
        toast(`♥ ${card.name} añadida a la lista de deseos`, 'info');
      }
      updateBadges();
      renderCardModal(card);
    });

    $('modal-qty-inc')?.addEventListener('click', () => {
      const cur = Storage.getQuantity(card.id);
      Storage.setQuantity(card.id, cur + 1);
      $('modal-qty-val').textContent = cur + 1;
    });

    $('modal-qty-dec')?.addEventListener('click', () => {
      const cur = Storage.getQuantity(card.id);
      if (cur <= 1) {
        Storage.removeFromCollection(card.id);
        updateBadges();
        renderCardModal(card);
        toast(`${card.name} eliminada de la colección`);
      } else {
        Storage.setQuantity(card.id, cur - 1);
        $('modal-qty-val').textContent = cur - 1;
      }
    });
  }

  // ── Pricing helpers ───────────────────────────────────────────────────────
  function buildSparkline(points, color) {
    if (points.length < 2) return '';
    const W = 260, H = 72, P = 10;
    const vals = points.map(p => p.v);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const range = max - min || 0.01;
    const xs = points.map((_, i) => P + (i / (points.length - 1)) * (W - P * 2));
    const ys = vals.map(v => H - P - ((v - min) / range) * (H - P * 2));
    const line = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ');
    const area = `${line} L${xs[xs.length-1].toFixed(1)},${H - P} L${xs[0].toFixed(1)},${H - P} Z`;
    const dots = xs.map((x, i) => `<circle cx="${x.toFixed(1)}" cy="${ys[i].toFixed(1)}" r="3.5" fill="${color}" stroke="var(--surface)" stroke-width="1.5"/>`).join('');
    const fillOpacity = 'rgba(' + (color === '#107c10' ? '16,124,16' : '164,38,44') + ',0.1)';
    return `<svg class="sparkline-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
      <path d="${area}" fill="${fillOpacity}"/>
      <path d="${line}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      ${dots}
    </svg>`;
  }

  function buildPricingHtml(pricing) {
    if (!pricing) return '';
    const cm  = pricing.cardmarket;
    const tcp = pricing.tcgplayer;
    if (!cm && !tcp) return '';

    const fmt = (n, sym) => n != null ? `${sym}${Number(n).toFixed(2)}` : null;
    const trendClass = (val, ref) => val == null || ref == null ? '' : val >= ref ? 'price-up' : 'price-down';
    const trendArrow = (val, ref) => val == null || ref == null ? '' : val >= ref ? '▲' : '▼';

    let html = `<div class="card-section-title">💰 Precios de Mercado</div><div class="pricing-wrap">`;

    // ── Cardmarket ──────────────────────────────────────────────────────────
    if (cm) {
      // Pick normal or holo values (whichever is available)
      const avg   = cm.avg   ?? cm['avg-holo'];
      const low   = cm.low   ?? cm['low-holo'];
      const trend = cm.trend ?? cm['trend-holo'];
      const a1    = cm.avg1  ?? cm['avg1-holo'];
      const a7    = cm.avg7  ?? cm['avg7-holo'];
      const a30   = cm.avg30 ?? cm['avg30-holo'];
      const updated = cm.updated ? new Date(cm.updated).toLocaleDateString('es-ES', {day:'2-digit',month:'short',year:'numeric'}) : '';

      const pts = [
        { label: '−30d', v: a30 }, { label: '−7d', v: a7 },
        { label: '−1d',  v: a1  }, { label: 'Hoy', v: avg },
      ].filter(p => p.v != null);

      const rising = pts.length > 1 && pts[pts.length-1].v >= pts[0].v;
      const color  = rising ? '#107c10' : '#a4262c';

      html += `<div class="price-provider">
        <div class="price-provider-head">
          <span class="price-prov-name">🇪🇺 Cardmarket</span>
          <span class="price-prov-unit">EUR</span>
        </div>
        <div class="price-row">
          ${avg  != null ? `<div class="price-box price-box-main"><div class="price-box-label">Precio medio</div><div class="price-box-val">€${Number(avg).toFixed(2)}</div></div>` : ''}
          ${low  != null ? `<div class="price-box"><div class="price-box-label">Mínimo</div><div class="price-box-val">€${Number(low).toFixed(2)}</div></div>` : ''}
          ${trend != null ? `<div class="price-box"><div class="price-box-label">Tendencia</div><div class="price-box-val ${trendClass(trend,avg)}">${trendArrow(trend,avg)} €${Number(trend).toFixed(2)}</div></div>` : ''}
        </div>
        ${pts.length > 1 ? `
          <div class="price-chart-wrap">
            <div class="price-chart-title">Evolución histórica</div>
            ${buildSparkline(pts, color)}
            <div class="price-chart-labels">
              ${pts.map(p => `<div class="price-chart-pt"><span class="price-chart-period">${p.label}</span><span class="price-chart-val" style="color:${color}">€${Number(p.v).toFixed(2)}</span></div>`).join('')}
            </div>
          </div>` : ''}
        ${updated ? `<div class="price-updated">Actualizado: ${updated}</div>` : ''}
      </div>`;
    }

    // ── TCGPlayer ────────────────────────────────────────────────────────────
    if (tcp) {
      const variantMap = {
        normal:              'Normal',
        holofoil:            'Holo',
        reverseHolofoil:     'Reverse Holo',
        '1stEditionNormal':  '1ª Ed. Normal',
        '1stEditionHolofoil':'1ª Ed. Holo',
      };
      const variants = Object.keys(variantMap).filter(k => tcp[k]);
      const updated  = tcp.updated ? new Date(tcp.updated).toLocaleDateString('es-ES', {day:'2-digit',month:'short',year:'numeric'}) : '';

      if (variants.length) {
        html += `<div class="price-provider">
          <div class="price-provider-head">
            <span class="price-prov-name">🇺🇸 TCGPlayer</span>
            <span class="price-prov-unit">USD</span>
          </div>`;

        for (const vk of variants) {
          const d = tcp[vk];
          html += `<div class="tcgp-variant">
            <div class="tcgp-variant-label">${variantMap[vk]}</div>
            <div class="price-row">
              ${d.marketPrice  != null ? `<div class="price-box price-box-main"><div class="price-box-label">Mercado</div><div class="price-box-val">$${Number(d.marketPrice).toFixed(2)}</div></div>` : ''}
              ${d.lowPrice     != null ? `<div class="price-box"><div class="price-box-label">Mínimo</div><div class="price-box-val">$${Number(d.lowPrice).toFixed(2)}</div></div>` : ''}
              ${d.midPrice     != null ? `<div class="price-box"><div class="price-box-label">Medio</div><div class="price-box-val">$${Number(d.midPrice).toFixed(2)}</div></div>` : ''}
              ${d.highPrice    != null ? `<div class="price-box"><div class="price-box-label">Máximo</div><div class="price-box-val">$${Number(d.highPrice).toFixed(2)}</div></div>` : ''}
            </div>
          </div>`;
        }

        if (updated) html += `<div class="price-updated">Actualizado: ${updated}</div>`;
        html += `</div>`;
      }
    }

    html += `</div>`;
    return html;
  }

  function closeModal() {
    dom.modalOverlay.hidden = true;
    document.body.style.overflow = '';
    // If we came from collection/wishlist, re-render it
    if (state.view === 'collection') renderCollection();
    if (state.view === 'wishlist')   renderWishlist();
  }

  // ── Utilities ─────────────────────────────────────────────────────────────
  function esc(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  function buildEmptyHtml(icon, title, desc) {
    return `<div class="empty-state"><div class="empty-icon">${icon}</div><div class="empty-title">${esc(title)}</div><p class="empty-desc">${esc(desc)}</p></div>`;
  }

  function buildErrorHtml(msg, retry) {
    const id = 'err-retry-' + Date.now();
    setTimeout(() => document.getElementById(id)?.addEventListener('click', retry), 0);
    return `<div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-title">Error</div><p class="empty-desc">${esc(msg)}</p><button class="btn btn-primary" id="${id}">Reintentar</button></div>`;
  }

  function setLoading(on) {
    state.loading = on;
    dom.progressBar.hidden = !on;
  }

  function updateBadges() {
    const stats = Storage.getStats();
    dom.collBadge.textContent = stats.uniqueCards;
    dom.collBadge.hidden = stats.uniqueCards === 0;
    dom.wishBadge.textContent = stats.wishlistCount;
    dom.wishBadge.hidden = stats.wishlistCount === 0;
  }

  function toast(msg, type = '') {
    const el = document.createElement('div');
    el.className = `toast${type ? ' '+type : ''}`;
    el.textContent = msg;
    dom.toastContainer.appendChild(el);
    setTimeout(() => {
      el.classList.add('removing');
      el.addEventListener('animationend', () => el.remove());
    }, 2800);
  }

  // ── Import / Export ────────────────────────────────────────────────────────
  function doExport() {
    const data = Storage.exportData();
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pokedex-tcg-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast('Colección exportada ✓', 'success');
  }

  function doImport(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      try {
        Storage.importData(e.target.result);
        updateBadges();
        // Re-render current view
        navigate(state.view);
        toast('Colección importada ✓', 'success');
      } catch (err) {
        toast(err.message || 'Error al importar', 'error');
      }
    };
    reader.readAsText(file);
  }

  // ── PWA install ────────────────────────────────────────────────────────────
  function handleInstall() {
    if (!state.installPrompt) return;
    state.installPrompt.prompt();
    state.installPrompt.userChoice.then(res => {
      if (res.outcome === 'accepted') {
        dom.installBtn.hidden = true;
        toast('App instalada ✓', 'success');
      }
      state.installPrompt = null;
    });
  }

  // ── Init ──────────────────────────────────────────────────────────────────
  function init() {
    initDom();

    // Service worker + auto-update
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).catch(console.warn);
    }

    // Offline detection
    function handleOnline()  { state.offline = false; dom.offlineBar.classList.remove('visible'); }
    function handleOffline() { state.offline = true;  dom.offlineBar.classList.add('visible'); }
    window.addEventListener('online',  handleOnline);
    window.addEventListener('offline', handleOffline);
    if (!navigator.onLine) handleOffline();

    // PWA install prompt
    window.addEventListener('beforeinstallprompt', e => {
      e.preventDefault();
      state.installPrompt = e;
      dom.installBtn.hidden = false;
    });
    dom.installBtn?.addEventListener('click', handleInstall);

    // Header buttons
    dom.exportBtn?.addEventListener('click', doExport);
    dom.importBtn?.addEventListener('click', () => dom.importFile?.click());
    dom.importFile?.addEventListener('change', e => {
      doImport(e.target.files[0]);
      e.target.value = '';
    });

    // Back button
    dom.backBtn?.addEventListener('click', () => navigate('browse'));

    // Bottom nav
    dom.navItems.forEach(item => {
      item.addEventListener('click', () => navigate(item.dataset.view));
    });

    // Modal overlay click to close
    dom.modalOverlay?.addEventListener('click', e => {
      if (e.target === dom.modalOverlay) closeModal();
    });

    // Escape key
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !dom.modalOverlay.hidden) closeModal();
    });

    // Sets grid delegation (for dynamic content)
    $('sets-grid')?.addEventListener('click', e => {
      const card = e.target.closest('.set-card');
      if (card) openSet({ id: card.dataset.setId, name: card.querySelector('.set-name')?.textContent });
    });
    $('sets-grid')?.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        const card = e.target.closest('.set-card');
        if (card) { e.preventDefault(); openSet({ id: card.dataset.setId, name: card.querySelector('.set-name')?.textContent }); }
      }
    });

    // Search input
    dom.searchInput?.addEventListener('input', e => {
      clearTimeout(searchDebounce);
      const q = e.target.value;
      const clearBtn = $('search-clear');
      if (clearBtn) clearBtn.style.display = q ? '' : 'none';
      searchDebounce = setTimeout(() => {
        if (state.view === 'search') doSearch(q);
      }, 350);
    });

    dom.searchInput?.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        clearTimeout(searchDebounce);
        doSearch(e.target.value);
      }
    });

    $('search-clear')?.addEventListener('click', () => {
      dom.searchInput.value = '';
      $('search-clear').style.display = 'none';
      doSearch('');
      dom.searchInput.focus();
    });

    // Check URL param for initial view
    const urlView = new URLSearchParams(location.search).get('view');

    // Initial render
    updateBadges();
    navigate(urlView && ['browse','search','collection','wishlist'].includes(urlView) ? urlView : 'browse');
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', App.init);
