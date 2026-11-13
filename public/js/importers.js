/* ============================================================================
 * ChessCoach Pro — Multi-Platform Importer (Chess.com, Lichess, PGN, Demos)
 * ============================================================================ */
(function (global) {
  'use strict';

  const CC = (global.ChessCoach = global.ChessCoach || {});

  async function fetchJsonWithFallback(proxyPath, directUrl, headers = {}) {
    if (global.location.protocol !== 'file:' && proxyPath) {
      try {
        const r = await fetch(proxyPath, { headers });
        if (r.ok) return await r.json();
      } catch (_) {}
    }
    const r2 = await fetch(directUrl, { headers });
    if (!r2.ok) throw new Error(`HTTP ${r2.status}`);
    return await r2.json();
  }

  async function fetchChessComAccount(rawUsername, timeClassFilter = 'all') {
    const username = rawUsername.trim().toLowerCase();
    const [profileData, statsData, archivesData] = await Promise.all([
      fetchJsonWithFallback(
        `/api/chesscom/player/${encodeURIComponent(username)}`,
        `https://api.chess.com/pub/player/${encodeURIComponent(username)}`
      ).catch(() => null),
      fetchJsonWithFallback(
        `/api/chesscom/player/${encodeURIComponent(username)}/stats`,
        `https://api.chess.com/pub/player/${encodeURIComponent(username)}/stats`
      ).catch(() => null),
      fetchJsonWithFallback(
        `/api/chesscom/player/${encodeURIComponent(username)}/games/archives`,
        `https://api.chess.com/pub/player/${encodeURIComponent(username)}/games/archives`
      )
    ]);

    const archives = archivesData.archives || [];
    const recentArchives = archives.slice(-2).reverse();
    let rawGames = [];

    for (const archiveUrl of recentArchives) {
      const pathPart = archiveUrl.replace('https://api.chess.com/pub/', '');
      const monthData = await fetchJsonWithFallback(`/api/chesscom/${pathPart}`, archiveUrl);
      if (monthData && Array.isArray(monthData.games)) {
        rawGames.push(...monthData.games.reverse());
      }
      if (rawGames.length >= 40) break;
    }

    const parsedGames = [];
    for (const g of rawGames) {
      if (!g.pgn || (g.rules && g.rules !== 'chess')) continue;
      if (timeClassFilter !== 'all' && g.time_class !== timeClassFilter) continue;

      const isWhite = g.white && g.white.username && g.white.username.toLowerCase() === username;
      const heroColor = isWhite ? 'w' : 'b';
      const heroObj = isWhite ? g.white : g.black;
      const resultStr =
        heroObj.result === 'win'
          ? 'Vitória'
          : ['checkmated', 'timeout', 'resigned', 'abandoned'].includes(heroObj.result)
          ? 'Derrota'
          : 'Empate';

      const headers = CC.Analyzer.parsePgnHeaders(g.pgn);
      parsedGames.push({
        id: g.uuid || `cc-${g.end_time}`,
        platform: 'chesscom',
        white: g.white.username,
        black: g.black.username,
        whiteRating: g.white.rating,
        blackRating: g.black.rating,
        heroColor,
        heroOutcome: resultStr,
        result: g.white.result === 'win' ? '1-0' : g.black.result === 'win' ? '0-1' : '1/2-1/2',
        timeClass: g.time_class || 'rapid',
        date: g.end_time ? new Date(g.end_time * 1000).toLocaleDateString('pt-BR') : 'Recente',
        opening: CC.EcoBook.detectOpeningFromMoves(null, headers),
        pgn: g.pgn
      });

      if (parsedGames.length >= 25) break;
    }

    const mappedStats = statsData
      ? {
          rapid: statsData.chess_rapid?.last?.rating || null,
          blitz: statsData.chess_blitz?.last?.rating || null,
          bullet: statsData.chess_bullet?.last?.rating || null
        }
      : null;

    return {
      platform: 'chesscom',
      username,
      displayName: profileData?.username || username,
      avatar: profileData?.avatar || null,
      stats: mappedStats,
      games: parsedGames
    };
  }

  async function fetchLichessAccount(rawUsername, timeClassFilter = 'all') {
    const username = rawUsername.trim();
    const userRes = await fetch(`https://lichess.org/api/user/${encodeURIComponent(username)}`);
    if (!userRes.ok) throw new Error(`Lichess HTTP ${userRes.status}`);
    const userData = await userRes.json();

    const perfParam =
      timeClassFilter === 'all'
        ? 'bullet,blitz,rapid,classical'
        : timeClassFilter === 'daily'
        ? 'correspondence'
        : timeClassFilter;

    const gamesUrl = `https://lichess.org/api/games/user/${encodeURIComponent(
      username
    )}?max=25&pgnInJson=true&clocks=true&opening=true&perfType=${encodeURIComponent(perfParam)}`;

    const gamesRes = await fetch(gamesUrl, {
      headers: { Accept: 'application/x-ndjson' }
    });
    if (!gamesRes.ok) throw new Error(`Lichess games HTTP ${gamesRes.status}`);
    const ndjsonText = await gamesRes.text();

    const lines = ndjsonText
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    const parsedGames = [];
    const lowerUser = username.toLowerCase();

    for (const line of lines) {
      let g;
      try {
        g = JSON.parse(line);
      } catch (_) {
        continue;
      }
      if (!g.pgn || (g.variant && g.variant !== 'standard')) continue;

      const wName = g.players?.white?.user?.name || 'Brancas';
      const bName = g.players?.black?.user?.name || 'Pretas';
      const isWhite = wName.toLowerCase() === lowerUser;
      const heroColor = isWhite ? 'w' : 'b';

      let heroOutcome = 'Empate';
      if (g.winner) {
        heroOutcome = (g.winner === 'white' && isWhite) || (g.winner === 'black' && !isWhite) ? 'Vitória' : 'Derrota';
      }

      const headers = CC.Analyzer.parsePgnHeaders(g.pgn);
      const openingName = g.opening?.name
        ? `${g.opening.name}${g.opening.eco ? ` (${g.opening.eco})` : ''}`
        : CC.EcoBook.detectOpeningFromMoves(null, headers);

      parsedGames.push({
        id: `li-${g.id}`,
        platform: 'lichess',
        white: wName,
        black: bName,
        whiteRating: g.players?.white?.rating || '—',
        blackRating: g.players?.black?.rating || '—',
        heroColor,
        heroOutcome,
        result: g.winner === 'white' ? '1-0' : g.winner === 'black' ? '0-1' : '1/2-1/2',
        timeClass: g.perf || g.speed || 'rapid',
        date: g.createdAt ? new Date(g.createdAt).toLocaleDateString('pt-BR') : 'Recente',
        opening: openingName,
        pgn: g.pgn
      });
    }

    const perfs = userData.perfs || {};
    const mappedStats = {
      rapid: perfs.rapid?.rating || null,
      blitz: perfs.blitz?.rating || null,
      bullet: perfs.bullet?.rating || null
    };

    return {
      platform: 'lichess',
      username: userData.username || username,
      displayName: userData.username || username,
      avatar: null,
      stats: mappedStats,
      games: parsedGames
    };
  }

  function splitMultiplePgns(rawText) {
    const trimmed = (rawText || '').trim();
    if (!trimmed) return [];
    // Split at [Event ...] boundaries when multiple games are pasted or uploaded
    const chunks = trimmed.split(/(?=\[Event\s+")/g).map((c) => c.trim()).filter(Boolean);
    return chunks.length ? chunks : [trimmed];
  }

  function parseManualPgnToGameMeta(pgn, heroHint = '') {
    const headers = CC.Analyzer.parsePgnHeaders(pgn);
    const white = headers.White || 'Brancas';
    const black = headers.Black || 'Pretas';
    const hint = (heroHint || '').trim().toLowerCase();

    let heroColor = 'w';
    if (hint && black.toLowerCase().includes(hint) && !white.toLowerCase().includes(hint)) {
      heroColor = 'b';
    }

    let heroOutcome = 'Empate';
    if (headers.Result === '1-0') heroOutcome = heroColor === 'w' ? 'Vitória' : 'Derrota';
    else if (headers.Result === '0-1') heroOutcome = heroColor === 'b' ? 'Vitória' : 'Derrota';

    return {
      id: `pgn-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      platform: 'pgn',
      white,
      black,
      whiteRating: headers.WhiteElo || '—',
      blackRating: headers.BlackElo || '—',
      heroColor,
      heroOutcome,
      result: headers.Result || '*',
      timeClass: headers.TimeControl || 'custom',
      date: headers.Date || new Date().toLocaleDateString('pt-BR'),
      opening: CC.EcoBook.detectOpeningFromMoves(null, headers),
      pgn
    };
  }

  CC.Importers = {
    fetchChessComAccount,
    fetchLichessAccount,
    splitMultiplePgns,
    parseManualPgnToGameMeta
  };
})(window);
