/* ============================================================================
 * ChessCoach Pro — Multi-Profile Local & Server Store Manager
 * Supports multiple local profiles (great for sharing with friends!),
 * JSON Backup Export/Import, localStorage + optional Node server /api/store.
 * ============================================================================ */
(function (global) {
  'use strict';

  const CC = (global.ChessCoach = global.ChessCoach || {});
  const STORAGE_KEY = 'chesscoach_pro_v2_store';

  function createEmptyProfile({ id, name, platform = 'custom', username = '', profile = null, stats = null }) {
    return {
      id: id || `prof_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: name || username || 'Novo Jogador',
      platform, // 'chesscom' | 'lichess' | 'custom'
      username: username || '',
      profile: profile || null,
      stats: stats || null,
      analyzedGames: {},
      puzzles: [],
      drillStats: {
        endgamesCompleted: [],
        openingsPracticed: {},
        sparringWins: 0,
        sparringGames: 0
      },
      createdAt: new Date().toISOString()
    };
  }

  function migrateStore(raw) {
    if (!raw || typeof raw !== 'object') {
      return { version: 2, activeProfileId: null, profiles: {} };
    }
    // Migrate v1 single-profile shape cleanly if found on local server
    if (!raw.profiles && (raw.analyzedGames || raw.username)) {
      const hasGames = raw.analyzedGames && Object.keys(raw.analyzedGames).length > 0;
      if (!raw.username && !hasGames) {
        return { version: 2, activeProfileId: null, profiles: {} };
      }
      const id = raw.username ? `chesscom:${raw.username.toLowerCase()}` : 'local:default';
      const prof = createEmptyProfile({
        id,
        name: raw.profile?.username || raw.username || 'Perfil Local',
        platform: raw.username ? 'chesscom' : 'custom',
        username: raw.username || '',
        profile: raw.profile || null,
        stats: raw.stats || null
      });
      prof.analyzedGames = raw.analyzedGames || {};
      prof.puzzles = Array.isArray(raw.puzzles) ? raw.puzzles : [];
      return {
        version: 2,
        activeProfileId: id,
        profiles: { [id]: prof }
      };
    }

    return {
      version: 2,
      activeProfileId: raw.activeProfileId || null,
      profiles: raw.profiles && typeof raw.profiles === 'object' ? raw.profiles : {}
    };
  }

  async function loadStore() {
    let loaded = null;

    if (global.location.protocol !== 'file:') {
      try {
        const res = await fetch('/api/store');
        if (res.ok) loaded = await res.json();
      } catch (_) {}
    }

    if (!loaded || (!loaded.profiles && !loaded.analyzedGames)) {
      try {
        const localRaw = localStorage.getItem(STORAGE_KEY);
        if (localRaw) loaded = JSON.parse(localRaw);
      } catch (_) {}
    }

    if (!loaded && global.INITIAL_STORE_SEED) {
      loaded = global.INITIAL_STORE_SEED;
    }

    const root = migrateStore(loaded);
    if (root.activeProfileId && !root.profiles[root.activeProfileId]) {
      const keys = Object.keys(root.profiles);
      root.activeProfileId = keys.length ? keys[0] : null;
    }
    if (!root.activeProfileId) {
      const keys = Object.keys(root.profiles);
      if (keys.length) root.activeProfileId = keys[0];
    }

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(root));
    } catch (_) {}

    return root;
  }

  async function saveStore(root) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(root));
    } catch (e) {
      console.warn('localStorage cheio:', e);
    }

    if (global.location.protocol === 'file:') return;

    try {
      await fetch('/api/store', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(root)
      });
    } catch (_) {
      // Static web hosting (GitHub Pages / Netlify) uses localStorage
    }
  }

  function getActiveProfile(root) {
    if (!root || !root.activeProfileId) return null;
    return root.profiles[root.activeProfileId] || null;
  }

  function upsertProfile(root, profileData) {
    const id = profileData.id;
    if (!root.profiles[id]) {
      root.profiles[id] = createEmptyProfile(profileData);
    } else {
      Object.assign(root.profiles[id], profileData);
    }
    root.activeProfileId = id;
    return root.profiles[id];
  }

  function deleteProfile(root, id) {
    delete root.profiles[id];
    const keys = Object.keys(root.profiles);
    root.activeProfileId = keys.length ? keys[0] : null;
  }

  CC.Store = {
    createEmptyProfile,
    loadStore,
    saveStore,
    getActiveProfile,
    upsertProfile,
    deleteProfile
  };
})(window);
