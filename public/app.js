/* ============================================================================
 * ChessCoach Pro — Main Application Controller
 * Ties together:
 *  - Multi-Profile Store (Chess.com, Lichess, PGN, Demos)
 *  - Stockfish MultiPV 3 Analyzer + Clock & Theme Diagnostics
 *  - Interactive Analysis Board with "What If?" Sandbox Exploration
 *  - Training Academy (SRS Mistakes, Openings, Drills, Sparring)
 *  - Player Development Dashboard & Social Share Card
 * ============================================================================ */
(function (global) {
  'use strict';

  const CC = (global.ChessCoach = global.ChessCoach || {});

  const app = {
    engine: null,
    storeRoot: { version: 2, activeProfileId: null, profiles: {} },
    currentGameId: null,
    currentPly: 0,
    boardFlipped: false,
    previewInterval: null,

    // Sandbox / Live MultiPV Analysis state
    sandboxActive: false,
    sandboxChess: null,
    sandboxSelectedSq: null,
    liveEngineEnabled: false,
    liveMultiPvLines: [],
    sandboxDebounceTimer: null,

    // Analysis cancellation
    analysisCancelled: false,

    // Fetched list from Chess.com / Lichess
    fetchedGames: [],
    academy: null,

    getProfile() {
      return CC.Store.getActiveProfile(this.storeRoot);
    },

    async saveCurrentStore() {
      await CC.Store.saveStore(this.storeRoot);
    },

    updatePuzzleBadgeCount() {
      const prof = this.getProfile();
      const badge = document.getElementById('badge-puzzles');
      if (!badge) return;
      if (!prof) {
        badge.textContent = '0';
        return;
      }
      const due = (prof.puzzles || []).filter((p) => !p.solved || (p.srs && Date.now() >= p.srs.nextReviewAt)).length;
      badge.textContent = String(due);
    },

    switchTab(tabId) {
      document.querySelectorAll('.nav-btn').forEach((b) => {
        b.classList.toggle('active', b.dataset.tab === tabId);
      });
      document.querySelectorAll('.tab-panel').forEach((p) => {
        p.classList.toggle('active', p.id === tabId);
      });

      if (tabId === 'tab-trainer') {
        this.academy.render();
      } else if (tabId === 'tab-dashboard') {
        CC.Dashboard.renderDashboard(this);
      } else if (tabId === 'tab-analysis') {
        this.renderAnalysisStep();
      }
    }
  };

  // ==================== INITIALIZATION ====================
  window.addEventListener('DOMContentLoaded', async () => {
    app.engine = new CC.StockfishEngine();
    app.academy = new CC.AcademyController(app);

    app.storeRoot = await CC.Store.loadStore();

    bindNavigation();
    bindSidebarControls();
    bindOnboardingControls();
    bindAnalysisControls();
    bindImportControls();
    app.academy.bindControls();

    refreshAllViews();

    const prof = app.getProfile();
    if (!prof) {
      openOnboardingModal();
    } else {
      const gameIds = Object.keys(prof.analyzedGames || {});
      if (gameIds.length > 0) {
        app.loadGameIntoAnalysisView(gameIds[0]);
      } else {
        app.switchTab('tab-import');
      }
    }
  });

  function refreshAllViews() {
    renderProfileSidebar();
    renderSavedGamesList();
    app.updatePuzzleBadgeCount();

    const prof = app.getProfile();
    if (prof) {
      const ids = Object.keys(prof.analyzedGames || {});
      if (!app.currentGameId || !prof.analyzedGames[app.currentGameId]) {
        app.currentGameId = ids.length ? ids[0] : null;
      }
    } else {
      app.currentGameId = null;
    }

    if (app.currentGameId) {
      app.loadGameIntoAnalysisView(app.currentGameId);
    } else {
      renderEmptyAnalysisBoard();
    }

    CC.Dashboard.renderDashboard(app);
    if (app.academy && typeof app.academy.syncSparringEloWithProfile === 'function') {
      app.academy.syncSparringEloWithProfile();
    }
  }

  function renderEmptyAnalysisBoard() {
    CC.Board.renderChessboard({
      containerId: 'chessboard',
      overlayId: 'board-overlay',
      fen: new Chess().fen(),
      flipped: app.boardFlipped,
      onSquareClick: (sq) => handleAnalysisBoardClick(sq),
      onPieceDrop: (from, to) => trySandboxMove(from, to)
    });
    document.getElementById('moves-tbody').innerHTML = '';
    document.getElementById('holistic-review-body').innerHTML =
      'Selecione ou importe uma partida para ver o diagnóstico completo por fase, tema tático e gestão de tempo.';
    document.getElementById('coach-title').textContent = 'Pronto para Analisar';
    document.getElementById('coach-subtitle').textContent = 'Importe uma partida ou arraste peças no tabuleiro para explorar';
    document.getElementById('coach-body').innerHTML =
      'Clique em <strong>📥 Importar / Contas</strong> para conectar Chess.com, Lichess, colar PGN ou carregar nossas <strong>Partidas Demo</strong>. Você também pode mover peças livremente aqui para usar o <strong>Sandbox com Stockfish ao vivo</strong>!';
  }

  // ==================== SIDEBAR & NAVIGATION ====================
  function bindNavigation() {
    document.querySelectorAll('.nav-btn').forEach((btn) => {
      btn.addEventListener('click', () => app.switchTab(btn.dataset.tab));
    });
  }

  function bindSidebarControls() {
    // Board size slider
    const slider = document.getElementById('board-size-slider');
    const label = document.getElementById('board-size-label');
    if (slider) {
      const applySize = (px) => {
        document.documentElement.style.setProperty('--board-size', `${px}px`);
        if (label) label.textContent = `${px}px`;
      };
      const savedSize = localStorage.getItem('chesscoach_board_size');
      if (savedSize) {
        slider.value = savedSize;
        applySize(savedSize);
      } else {
        const ideal = Math.max(280, Math.min(380, window.innerHeight - 230));
        slider.value = ideal;
        applySize(ideal);
      }
      slider.addEventListener('input', (e) => {
        applySize(e.target.value);
        localStorage.setItem('chesscoach_board_size', e.target.value);
      });
    }

    // Sound toggle
    const soundBtn = document.getElementById('btn-toggle-sound');
    const updateSoundLabel = () => {
      if (!soundBtn) return;
      soundBtn.textContent = CC.Board.isSoundEnabled() ? '🔊 Som: ON' : '🔇 Som: OFF';
    };
    updateSoundLabel();
    soundBtn?.addEventListener('click', () => {
      CC.Board.setSoundEnabled(!CC.Board.isSoundEnabled());
      updateSoundLabel();
    });

    // Profile selector & add profile
    const profileSel = document.getElementById('profile-select');
    profileSel?.addEventListener('change', async (e) => {
      app.storeRoot.activeProfileId = e.target.value || null;
      app.currentGameId = null;
      app.currentPly = 0;
      app.sandboxActive = false;
      await app.saveCurrentStore();
      refreshAllViews();
    });

    document.getElementById('btn-new-profile')?.addEventListener('click', () => {
      openOnboardingModal();
    });

    document.getElementById('btn-sidebar-sync')?.addEventListener('click', () => {
      const prof = app.getProfile();
      app.switchTab('tab-import');
      if (prof && prof.username) {
        document.getElementById('import-platform').value = prof.platform === 'lichess' ? 'lichess' : 'chesscom';
        document.getElementById('chesscom-username').value = prof.username;
        fetchRemoteGames();
      } else {
        document.getElementById('chesscom-username').focus();
      }
    });
  }

  function renderProfileSidebar() {
    const prof = app.getProfile();
    const userLabel = document.getElementById('profile-username-label');
    const ratingsLabel = document.getElementById('profile-ratings-label');
    const avatarImg = document.getElementById('profile-avatar');
    const syncBtn = document.getElementById('btn-sidebar-sync');
    const profileSel = document.getElementById('profile-select');

    // Populate multi-profile switcher
    if (profileSel) {
      const profiles = Object.values(app.storeRoot.profiles || {});
      profileSel.innerHTML = '';
      if (!profiles.length) {
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = 'Nenhum perfil criado';
        profileSel.appendChild(opt);
      } else {
        profiles.forEach((p) => {
          const opt = document.createElement('option');
          opt.value = p.id;
          const plat = p.platform === 'lichess' ? 'Lichess' : p.platform === 'chesscom' ? 'Chess.com' : 'Local';
          opt.textContent = `${p.name} (${plat})`;
          if (p.id === app.storeRoot.activeProfileId) opt.selected = true;
          profileSel.appendChild(opt);
        });
      }
    }

    if (!prof) {
      userLabel.textContent = 'Conta não vinculada';
      ratingsLabel.textContent = 'Crie seu perfil para começar';
      syncBtn.textContent = '🔗 Vincular Conta';
      return;
    }

    userLabel.textContent = prof.name || prof.username || 'Jogador';
    if (prof.profile?.avatar) {
      avatarImg.src = prof.profile.avatar;
    }

    const st = prof.stats || {};
    const parts = [];
    if (st.rapid) parts.push(`Rapid: ${st.rapid}`);
    if (st.blitz) parts.push(`Blitz: ${st.blitz}`);
    if (st.bullet) parts.push(`Bullet: ${st.bullet}`);
    ratingsLabel.textContent = parts.length
      ? parts.join(' • ')
      : prof.platform === 'lichess'
      ? 'Conta Lichess vinculada'
      : prof.platform === 'chesscom'
      ? 'Conta Chess.com vinculada'
      : 'Perfil Local (PGN / Demo)';
    syncBtn.textContent = prof.username ? '🔄 Sincronizar Partidas' : '📥 Importar Partidas';
  }

  // ==================== ONBOARDING MODAL ====================
  function openOnboardingModal() {
    const modal = document.getElementById('onboarding-modal');
    if (modal) modal.classList.remove('hidden');
  }

  function closeOnboardingModal() {
    const modal = document.getElementById('onboarding-modal');
    if (modal) modal.classList.add('hidden');
  }

  function bindOnboardingControls() {
    document.getElementById('btn-close-onboarding')?.addEventListener('click', closeOnboardingModal);

    document.getElementById('btn-onboard-connect')?.addEventListener('click', async () => {
      const platform = document.getElementById('onboard-platform').value;
      const username = document.getElementById('onboard-username').value.trim();
      const statusEl = document.getElementById('onboard-status');

      if (!username) {
        statusEl.textContent = '⚠️ Digite um nome de usuário ou apelido.';
        return;
      }

      if (platform === 'custom') {
        const id = `local:${username.toLowerCase().replace(/\s+/g, '_')}`;
        CC.Store.upsertProfile(app.storeRoot, {
          id,
          name: username,
          platform: 'custom',
          username: ''
        });
        await app.saveCurrentStore();
        closeOnboardingModal();
        refreshAllViews();
        app.switchTab('tab-import');
        return;
      }

      statusEl.textContent = `⏳ Buscando ${username} em ${platform === 'lichess' ? 'Lichess.org' : 'Chess.com'}...`;
      document.getElementById('import-platform').value = platform;
      document.getElementById('chesscom-username').value = username;
      const ok = await fetchRemoteGames();
      if (ok) {
        closeOnboardingModal();
        app.switchTab('tab-import');
      } else {
        statusEl.textContent = `❌ Usuário "${username}" não encontrado em ${platform}.`;
      }
    });

    document.getElementById('btn-onboard-demo')?.addEventListener('click', async () => {
      closeOnboardingModal();
      await loadAndAnalyzeDemoGames();
    });
  }

  async function loadAndAnalyzeDemoGames() {
    let prof = app.getProfile();
    if (!prof) {
      prof = CC.Store.upsertProfile(app.storeRoot, {
        id: 'local:demo',
        name: 'Perfil Demo',
        platform: 'custom',
        username: ''
      });
      await app.saveCurrentStore();
      renderProfileSidebar();
    }

    const demos = global.DEMO_GAMES || [];
    if (!demos.length) return;
    app.switchTab('tab-analysis');
    for (let i = 0; i < demos.length; i++) {
      if (app.analysisCancelled) break;
      await analyzeAndSaveGame(demos[i], i === 0, { maxDepth: 9, maxMovetimeMs: 420 });
    }
    app.analysisCancelled = false;
    refreshAllViews();
  }

  // ==================== ANALYSIS PIPELINE (v2 MultiPV + Clocks + Themes) ====================
  async function analyzeAndSaveGame(gameMeta, switchToAnalysis = true, opts = {}) {
    const chess = new Chess();
    let loaded = chess.load_pgn(gameMeta.pgn, { sloppy: true });
    if (!loaded) {
      loaded = chess.load_pgn(CC.Analyzer.cleanPgnForChessJs(gameMeta.pgn), { sloppy: true });
    }
    if (!loaded) {
      alert('Não foi possível ler o PGN desta partida.');
      return;
    }

    const history = chess.history({ verbose: true });
    if (!history.length) return;

    // Ensure profile exists
    let prof = app.getProfile();
    if (!prof) {
      prof = CC.Store.upsertProfile(app.storeRoot, {
        id: 'local:default',
        name: gameMeta.heroColor === 'b' ? gameMeta.black : gameMeta.white,
        platform: 'custom'
      });
    }

    app.analysisCancelled = false;
    const progressBox = document.getElementById('analysis-progress-box');
    const progressTitle = document.getElementById('progress-title');
    const progressPct = document.getElementById('progress-pct');
    const progressFill = document.getElementById('progress-fill');

    if (switchToAnalysis) app.switchTab('tab-analysis');
    progressBox.classList.remove('hidden');

    const depthSelect = document.getElementById('engine-depth');
    const baseDepth = parseInt(depthSelect ? depthSelect.value : '12', 10) || 12;
    const requestedDepth = opts.maxDepth ? Math.min(baseDepth, opts.maxDepth) : baseDepth;

    // Extract clocks & TimeControl
    const headers = CC.Analyzer.parsePgnHeaders(gameMeta.pgn);
    const { baseSec, incSec } = CC.Analyzer.parseTimeControl(headers.TimeControl);
    const clocksPerPly = CC.Analyzer.extractClocksPerPly(gameMeta.pgn);

    // Update opening name using real ECO trie + headers
    const detectedOpening = CC.EcoBook.detectOpeningFromMoves(
      history.map((m) => m.san),
      headers
    );
    const finalOpening = detectedOpening || gameMeta.opening || 'Abertura Clássica';

    const replay = new Chess();
    const positions = [{ fen: replay.fen(), move: null }];
    for (const m of history) {
      replay.move(m);
      positions.push({ fen: replay.fen(), move: m });
    }

    // Reset Stockfish hash cleanly once per game (never mid-game!)
    await app.engine.newGame();

    const evals = [];
    for (let i = 0; i < positions.length; i++) {
      if (app.analysisCancelled) {
        progressBox.classList.add('hidden');
        return;
      }

      const pct = Math.round(((i + 1) / positions.length) * 100);
      progressTitle.textContent = `Stockfish MultiPV: lance ${i}/${positions.length - 1} (${gameMeta.white} vs ${gameMeta.black})`;
      progressPct.textContent = `${pct}%`;
      progressFill.style.width = `${pct}%`;

      const inBookPos = i <= 12 && CC.EcoBook.lookupPosition(positions[i].fen);
      const effectiveDepth = inBookPos ? Math.min(requestedDepth, 8) : requestedDepth;
      const movetimeCap = opts.maxMovetimeMs || (requestedDepth >= 14 ? 2200 : requestedDepth >= 12 ? 950 : 480);

      const res = await app.engine.evaluateFen(positions[i].fen, {
        depth: effectiveDepth,
        movetimeMs: movetimeCap,
        multiPv: 3,
        skillLevel: 20,
        tag: 'game-analysis'
      });

      if (res.aborted || app.analysisCancelled) {
        progressBox.classList.add('hidden');
        return;
      }
      evals.push(res);
    }

    // Compute clock usage per move
    const lastClock = { w: baseSec, b: baseSec };
    const analyzedMoves = [];
    const counts = {
      brilliant: 0,
      great: 0,
      best: 0,
      excellent: 0,
      good: 0,
      book: 0,
      inaccuracy: 0,
      mistake: 0,
      miss: 0,
      blunder: 0
    };
    const whiteAccs = [];
    const blackAccs = [];

    for (let i = 0; i < history.length; i++) {
      const moveObj = history[i];
      const fenBefore = positions[i].fen;
      const fenAfter = positions[i + 1].fen;
      const evalBefore = evals[i];
      const evalAfter = evals[i + 1];

      const ply = i + 1;
      const playedUci = moveObj.from + moveObj.to + (moveObj.promotion || '');

      // Clock calculations
      const clk = clocksPerPly[i] !== undefined ? clocksPerPly[i] : null;
      let timeSpentSec = null;
      if (clk !== null) {
        if (lastClock[moveObj.color] !== null && lastClock[moveObj.color] !== undefined) {
          timeSpentSec = Math.max(0, Number((lastClock[moveObj.color] + incSec - clk).toFixed(1)));
        } else {
          timeSpentSec = 0;
        }
        lastClock[moveObj.color] = clk;
      }

      const isTimeTrouble =
        clk !== null && (clk <= 30 || (baseSec && clk <= baseSec * 0.12 && clk <= 60));

      const clsRes = CC.Analyzer.classifyMoveV2({
        ply,
        fenBefore,
        fenAfter,
        moveObj,
        evalBefore,
        evalAfter
      });

      const classification = clsRes.classification;
      const bestUci = clsRes.bestUci;
      const bestSan = CC.Analyzer.uciToSan(fenBefore, bestUci);
      const phase = CC.Analyzer.getGamePhase(ply, fenBefore);
      const pvSanLine = CC.Analyzer.uciPvToSanLine(fenBefore, evalBefore.pv, 6);

      const isRushedError =
        ['inaccuracy', 'mistake', 'miss', 'blunder'].includes(classification.type) &&
        timeSpentSec !== null &&
        timeSpentSec <= 3.5 &&
        clk !== null &&
        clk >= 45;

      const themes = CC.Analyzer.detectTacticalThemes({
        fenBefore,
        fenAfter,
        moveObj,
        bestUci,
        bestSan,
        oppBestUci: evalAfter.bestMoveUci,
        cpBefore: evalBefore.cp,
        cpAfter: evalAfter.cp,
        mateBefore: evalBefore.mate,
        mateAfter: evalAfter.mate,
        classificationType: classification.type,
        phase,
        isTimeTrouble,
        isRushedError
      });

      const explanation = CC.Analyzer.buildCoachExplanationV2({
        fenBefore,
        playedSan: moveObj.san,
        bestSan,
        bestUci,
        classification,
        cpBefore: evalBefore.cp,
        cpAfter: evalAfter.cp,
        phase,
        pvSanLine,
        themes,
        timeSpentSec,
        clockSec: clk
      });

      if (moveObj.color === 'w') whiteAccs.push(classification.accuracy);
      else blackAccs.push(classification.accuracy);

      if (moveObj.color === gameMeta.heroColor) {
        counts[classification.type] = (counts[classification.type] || 0) + 1;
      }

      const moveRecord = {
        ply,
        moveNumber: Math.floor(i / 2) + 1,
        color: moveObj.color,
        san: moveObj.san,
        uci: playedUci,
        from: moveObj.from,
        to: moveObj.to,
        fenBefore,
        fenAfter,
        cpBefore: evalBefore.cp,
        cpAfter: evalAfter.cp,
        mateAfter: evalAfter.mate,
        bestUci,
        bestFrom: bestUci ? bestUci.slice(0, 2) : null,
        bestTo: bestUci ? bestUci.slice(2, 4) : null,
        bestSan,
        pv: evalBefore.pv || [],
        pvSanLine,
        multiPvLines: (evalBefore.lines || []).slice(0, 3),
        winLoss: clsRes.winLoss,
        cpDrop: clsRes.cpDrop,
        classification,
        phase,
        themes,
        clockSec: clk,
        timeSpentSec,
        isTimeTrouble,
        isRushedError,
        explanation
      };

      analyzedMoves.push(moveRecord);

      // Generate SRS Puzzle for hero errors
      if (
        moveObj.color === gameMeta.heroColor &&
        ['inaccuracy', 'mistake', 'miss', 'blunder'].includes(classification.type) &&
        bestUci &&
        bestUci !== playedUci
      ) {
        const puzzleId = `${gameMeta.id}_ply_${ply}`;
        const existingIdx = prof.puzzles.findIndex((p) => p.id === puzzleId);
        const existingPuzzle = existingIdx >= 0 ? prof.puzzles[existingIdx] : null;
        const puzzleData = {
          id: puzzleId,
          gameId: gameMeta.id,
          ply,
          moveNumber: Math.floor(i / 2) + 1,
          heroColor: gameMeta.heroColor,
          opponent: gameMeta.heroColor === 'w' ? gameMeta.black : gameMeta.white,
          opening: finalOpening,
          phase,
          themes,
          fenBefore,
          playedSan: moveObj.san,
          playedUci,
          bestSan,
          bestUci,
          pv: evalBefore.pv || [bestUci],
          pvSanLine,
          severity: classification.type,
          symbol: classification.symbol,
          label: classification.label,
          explanation,
          solved: existingPuzzle ? existingPuzzle.solved : false,
          srs: existingPuzzle ? existingPuzzle.srs : null
        };

        if (existingIdx >= 0) prof.puzzles[existingIdx] = puzzleData;
        else prof.puzzles.unshift(puzzleData);
      }
    }

    const wAcc = CC.Analyzer.computeGameAccuracy(whiteAccs);
    const bAcc = CC.Analyzer.computeGameAccuracy(blackAccs);
    const heroAcc = gameMeta.heroColor === 'w' ? wAcc : bAcc;
    const oppRating = gameMeta.heroColor === 'w' ? gameMeta.blackRating : gameMeta.whiteRating;

    const analyzedGame = {
      ...gameMeta,
      opening: finalOpening,
      initialFen: positions[0].fen,
      whiteAccuracy: wAcc,
      blackAccuracy: bAcc,
      heroAccuracy: heroAcc,
      estimatedElo: CC.Analyzer.estimateGamePerformanceElo(heroAcc, oppRating, gameMeta.heroOutcome),
      counts,
      moves: analyzedMoves,
      analyzedAt: new Date().toISOString()
    };

    prof.analyzedGames[gameMeta.id] = analyzedGame;
    app.currentGameId = gameMeta.id;
    await app.saveCurrentStore();

    progressBox.classList.add('hidden');
    app.updatePuzzleBadgeCount();
    renderSavedGamesList();

    if (switchToAnalysis) {
      app.loadGameIntoAnalysisView(gameMeta.id);
    }
  }

  // ==================== TAB 1: ANALYSIS VIEW + SANDBOX ====================
  app.loadGameIntoAnalysisView = function (gameId, startPly = 0) {
    const prof = app.getProfile();
    const game = prof ? prof.analyzedGames[gameId] : null;
    if (!game) return;

    stopPreviewLine();
    app.sandboxActive = false;
    app.sandboxChess = null;
    app.sandboxSelectedSq = null;
    app.currentGameId = gameId;
    app.currentPly = Math.max(0, Math.min(startPly, (game.moves || []).length));
    app.boardFlipped = game.heroColor === 'b';

    document.getElementById('game-opening-label').textContent = game.opening || 'Abertura';
    const c = game.counts || {};
    const setCnt = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };
    setCnt('cnt-brilliant', c.brilliant || 0);
    setCnt('cnt-great', c.great || 0);
    setCnt('cnt-best', c.best || 0);
    setCnt('cnt-excellent', c.excellent || 0);
    setCnt('cnt-good', (c.good || 0) + (c.book || 0));
    setCnt('cnt-inaccuracy', c.inaccuracy || 0);
    setCnt('cnt-mistake', (c.mistake || 0) + (c.miss || 0));
    setCnt('cnt-blunder', c.blunder || 0);

    renderPlayerHeaders(game);
    renderHolisticGameReview(game);
    renderMovesTable(game);
    app.renderAnalysisStep();
  };

  function getActiveAnalysisFen() {
    if (app.sandboxActive && app.sandboxChess) return app.sandboxChess.fen();
    const prof = app.getProfile();
    const game = prof ? prof.analyzedGames[app.currentGameId] : null;
    if (!game) return new Chess().fen();
    const m = app.currentPly > 0 ? game.moves[app.currentPly - 1] : null;
    return m ? m.fenAfter : game.initialFen;
  }

  function handleAnalysisBoardClick(sq) {
    stopPreviewLine();
    const fen = getActiveAnalysisFen();
    const chess = app.sandboxActive && app.sandboxChess ? app.sandboxChess : new Chess(fen);

    if (app.sandboxSelectedSq && app.sandboxSelectedSq !== sq) {
      const legal = chess.moves({ square: app.sandboxSelectedSq, verbose: true }).find((m) => m.to === sq);
      if (legal) {
        trySandboxMove(app.sandboxSelectedSq, sq);
        return;
      }
    }

    const piece = chess.get(sq);
    app.sandboxSelectedSq = piece && piece.color === chess.turn() ? sq : null;
    if (app.liveEngineEnabled && !app.sandboxActive) {
      drawAnalysisBoardOnly(fen, app.liveMultiPvLines);
    } else {
      app.renderAnalysisStep();
    }
  }

  function trySandboxMove(from, to) {
    stopPreviewLine();
    const currentFen = getActiveAnalysisFen();
    const probe = app.sandboxActive && app.sandboxChess ? app.sandboxChess : new Chess(currentFen);
    const piece = probe.get(from);
    if (!piece || piece.color !== probe.turn()) return;

    const isPromo =
      piece.type === 'p' && ((piece.color === 'w' && to[1] === '8') || (piece.color === 'b' && to[1] === '1'));

    const execute = (promo) => {
      if (!app.sandboxActive || !app.sandboxChess) {
        app.sandboxChess = new Chess(currentFen);
      }
      const mv = app.sandboxChess.move({ from, to, promotion: promo || 'q' });
      if (!mv) {
        app.sandboxSelectedSq = null;
        app.renderAnalysisStep();
        return;
      }
      CC.Board.playMoveObjSound(mv);
      app.sandboxActive = true;
      app.sandboxSelectedSq = null;
      app.renderAnalysisStep();
      runLiveSandboxEvaluation(app.sandboxChess.fen());
    };

    if (isPromo) CC.Board.askPromotionChoice(piece.color, execute);
    else execute('q');
  }

  function exitSandboxMode() {
    app.sandboxActive = false;
    app.sandboxChess = null;
    app.sandboxSelectedSq = null;
    app.liveMultiPvLines = [];
    app.engine.abortTag('sandbox');
    app.renderAnalysisStep();
  }

  function runLiveSandboxEvaluation(fen) {
    clearTimeout(app.sandboxDebounceTimer);
    app.engine.abortTag('sandbox');

    const linesBox = document.getElementById('live-multipv-list');
    if (linesBox) linesBox.innerHTML = '<div class="muted-text">⚡ Stockfish calculando Top 3 linhas...</div>';

    app.sandboxDebounceTimer = setTimeout(async () => {
      const res = await app.engine.evaluateFen(fen, {
        depth: 12,
        movetimeMs: 1800,
        multiPv: 3,
        skillLevel: 20,
        tag: 'sandbox'
      });
      if (res.aborted) return;
      if (getActiveAnalysisFen() !== fen) return;

      app.liveMultiPvLines = res.lines || [];
      updateEvalBar(res.cp, res.mate);
      renderMultiPvPanel(fen, app.liveMultiPvLines);

      // Refresh arrows to show #1 (green) and #2 (cyan)
      drawAnalysisBoardOnly(fen, res.lines);
    }, 90);
  }

  function renderMultiPvPanel(fen, lines) {
    const box = document.getElementById('live-multipv-list');
    const card = document.getElementById('live-multipv-card');
    if (!box || !card) return;

    if (!lines || !lines.length) {
      box.innerHTML = '<div class="muted-text">Ative o Motor Ao Vivo ou mova uma peça para explorar variações.</div>';
      return;
    }

    box.innerHTML = lines
      .slice(0, 3)
      .map((l, idx) => {
        const scoreStr =
          l.mate !== null && l.mate !== undefined
            ? `${l.mate > 0 ? '+' : '-'}M${Math.abs(l.mate)}`
            : `${l.cp >= 0 ? '+' : ''}${(l.cp / 100).toFixed(2)}`;
        const sanLine = CC.Analyzer.uciPvToSanLine(fen, l.pv || [], 6);
        const cls = l.cp >= 50 ? 'pos' : l.cp <= -50 ? 'neg' : 'eq';
        return `<div class="multipv-row" data-uci="${l.bestMoveUci || ''}">
          <span class="multipv-score ${cls}">${scoreStr}</span>
          <span class="multipv-line">${idx === 0 ? '★ ' : ''}${sanLine || '—'}</span>
        </div>`;
      })
      .join('');

    box.querySelectorAll('.multipv-row').forEach((row) => {
      row.addEventListener('click', () => {
        const uci = row.dataset.uci;
        if (uci && uci.length >= 4) {
          trySandboxMove(uci.slice(0, 2), uci.slice(2, 4));
        }
      });
    });
  }

  function drawAnalysisBoardOnly(fen, liveLines = []) {
    const chess = new Chess(fen);
    const legalTargets = app.sandboxSelectedSq
      ? chess.moves({ square: app.sandboxSelectedSq, verbose: true })
      : [];

    const arrows = [];
    if (liveLines && liveLines.length) {
      if (liveLines[0]?.bestMoveUci) {
        const u = liveLines[0].bestMoveUci;
        arrows.push({ from: u.slice(0, 2), to: u.slice(2, 4), color: '#22c55e' });
      }
      if (liveLines[1]?.bestMoveUci) {
        const u = liveLines[1].bestMoveUci;
        arrows.push({ from: u.slice(0, 2), to: u.slice(2, 4), color: '#38bdf8', width: 10, opacity: 0.65 });
      }
    }

    const hist = app.sandboxChess ? app.sandboxChess.history({ verbose: true }) : [];
    const last = hist.length ? hist[hist.length - 1] : null;

    CC.Board.renderChessboard({
      containerId: 'chessboard',
      overlayId: 'board-overlay',
      fen,
      flipped: app.boardFlipped,
      lastMove: last ? { from: last.from, to: last.to } : null,
      selectedSquare: app.sandboxSelectedSq,
      legalTargets,
      arrows,
      onSquareClick: (sq) => handleAnalysisBoardClick(sq),
      onPieceDrop: (from, to) => trySandboxMove(from, to)
    });
  }

  app.renderAnalysisStep = function () {
    const sandboxBanner = document.getElementById('sandbox-banner');
    const sandboxMovesEl = document.getElementById('sandbox-moves-text');

    if (app.sandboxActive && app.sandboxChess) {
      if (sandboxBanner) sandboxBanner.classList.remove('hidden');
      if (sandboxMovesEl) {
        const hist = app.sandboxChess.history();
        sandboxMovesEl.textContent = hist.length ? `Variação: ${hist.slice(-6).join(' ')}` : 'Explorando variação';
      }
      const fen = app.sandboxChess.fen();
      drawAnalysisBoardOnly(fen, app.liveMultiPvLines);
      document.getElementById('live-multipv-card')?.classList.remove('hidden');
      return;
    }

    if (sandboxBanner) sandboxBanner.classList.add('hidden');

    const prof = app.getProfile();
    const game = prof ? prof.analyzedGames[app.currentGameId] : null;
    if (!game) {
      const fen = new Chess().fen();
      drawAnalysisBoardOnly(fen, app.liveMultiPvLines);
      if (app.liveEngineEnabled) {
        document.getElementById('live-multipv-card')?.classList.remove('hidden');
        runLiveSandboxEvaluation(fen);
      }
      return;
    }

    const ply = app.currentPly;
    const moveRecord = ply > 0 ? game.moves[ply - 1] : null;
    const fen = moveRecord ? moveRecord.fenAfter : game.initialFen;

    document.querySelectorAll('#moves-tbody .move-cell').forEach((cell) => {
      const isCurrent = parseInt(cell.dataset.ply, 10) === ply;
      cell.classList.toggle('active', isCurrent);
      if (isCurrent) cell.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });

    const arrows = [];
    let badge = null;

    if (moveRecord) {
      badge = {
        square: moveRecord.to,
        type: moveRecord.classification.type,
        symbol: moveRecord.classification.symbol
      };
      const isError = ['inaccuracy', 'mistake', 'miss', 'blunder'].includes(moveRecord.classification.type);
      arrows.push({
        from: moveRecord.from,
        to: moveRecord.to,
        color: isError ? '#ef4444' : '#38bdf8'
      });
      if (moveRecord.bestFrom && moveRecord.bestTo && moveRecord.bestUci !== moveRecord.uci) {
        arrows.push({ from: moveRecord.bestFrom, to: moveRecord.bestTo, color: '#22c55e' });
      }
    }

    const chess = new Chess(fen);
    const legalTargets = app.sandboxSelectedSq
      ? chess.moves({ square: app.sandboxSelectedSq, verbose: true })
      : [];

    CC.Board.renderChessboard({
      containerId: 'chessboard',
      overlayId: 'board-overlay',
      fen,
      flipped: app.boardFlipped,
      lastMove: moveRecord ? { from: moveRecord.from, to: moveRecord.to } : null,
      selectedSquare: app.sandboxSelectedSq,
      legalTargets,
      badge,
      arrows,
      onSquareClick: (sq) => handleAnalysisBoardClick(sq),
      onPieceDrop: (from, to) => trySandboxMove(from, to)
    });

    const cp = moveRecord ? moveRecord.cpAfter : 25;
    const mate = moveRecord ? moveRecord.mateAfter : null;
    updateEvalBar(cp, mate);
    updateCoachCard(game, moveRecord);
    drawEvalChart(game, ply);

    // Show stored MultiPV or run Live Engine
    const mpvCard = document.getElementById('live-multipv-card');
    if (app.liveEngineEnabled) {
      mpvCard?.classList.remove('hidden');
      runLiveSandboxEvaluation(fen);
    } else if (moveRecord && Array.isArray(moveRecord.multiPvLines) && moveRecord.multiPvLines.length) {
      mpvCard?.classList.remove('hidden');
      renderMultiPvPanel(moveRecord.fenBefore, moveRecord.multiPvLines);
    } else {
      mpvCard?.classList.add('hidden');
    }
  };

  function updateEvalBar(cp, mate) {
    const whitePct = CC.Analyzer.cpToWinProb(cp);
    const barWhite = document.getElementById('eval-bar-white');
    const label = document.getElementById('eval-score-label');
    if (!barWhite || !label) return;

    barWhite.style.height = `${Math.max(4, Math.min(96, whitePct))}%`;

    if (mate !== null && mate !== undefined) {
      label.textContent = `${mate > 0 ? '+' : '-'}M${Math.abs(mate)}`;
    } else {
      const pawns = (cp / 100).toFixed(1);
      label.textContent = cp > 0 ? `+${pawns}` : pawns;
    }
  }

  function updateCoachCard(game, moveRecord) {
    const card = document.getElementById('coach-card');
    const badge = document.getElementById('coach-badge');
    const title = document.getElementById('coach-title');
    const subtitle = document.getElementById('coach-subtitle');
    const body = document.getElementById('coach-body');
    const btnBestLine = document.getElementById('btn-play-best-line');
    const btnTrainPos = document.getElementById('btn-train-this-pos');
    const btnSparringPos = document.getElementById('btn-sparring-from-pos');

    card.className = 'coach-card';

    if (!moveRecord) {
      badge.textContent = '♟️';
      title.textContent = `${game.white} vs ${game.black} (${game.opening})`;
      subtitle.textContent = `Sua precisão: ${game.heroAccuracy}% | Perf. Estimada: ~${
        game.estimatedElo || '—'
      } Elo | Capivaras (??): ${game.counts.blunder || 0}`;
      body.innerHTML = `Use as setas (<code>←</code> <code>→</code>) ou clique em qualquer peça para explorar variações no <strong>Sandbox</strong>. Setas <strong style="color:#22c55e">verdes</strong> mostram o melhor lance e <strong style="color:#ef4444">vermelhas</strong> onde houve erro.`;
      btnBestLine.classList.add('hidden');
      btnTrainPos.classList.add('hidden');
      btnSparringPos?.classList.remove('hidden');
      return;
    }

    const cls = moveRecord.classification;
    card.classList.add(cls.type);
    badge.textContent = cls.symbol;

    const sideName = moveRecord.color === 'w' ? 'Brancas' : 'Pretas';
    title.textContent = `Lance ${moveRecord.moveNumber} (${sideName}): ${moveRecord.san} — ${cls.label}`;
    subtitle.textContent = `Fase: ${moveRecord.phase} | Eval: ${(moveRecord.cpAfter / 100).toFixed(2)} | Melhor: ${moveRecord.bestSan}`;
    body.innerHTML = moveRecord.explanation;

    const hasBetter = moveRecord.bestUci && moveRecord.bestUci !== moveRecord.uci;
    btnBestLine.classList.toggle('hidden', !hasBetter);
    btnTrainPos.classList.toggle('hidden', !hasBetter);
    btnSparringPos?.classList.remove('hidden');
  }

  function renderPlayerHeaders(game) {
    const topIsBlack = !app.boardFlipped;
    const topName = topIsBlack ? game.black : game.white;
    const topRating = topIsBlack ? game.blackRating : game.whiteRating;
    const topAcc = topIsBlack ? game.blackAccuracy : game.whiteAccuracy;

    const botName = topIsBlack ? game.white : game.black;
    const botRating = topIsBlack ? game.whiteRating : game.blackRating;
    const botAcc = topIsBlack ? game.whiteAccuracy : game.blackAccuracy;

    document.getElementById('top-player-color').textContent = topIsBlack ? '⬛' : '⬜';
    document.getElementById('top-player-name').textContent = topName;
    document.getElementById('top-player-rating').textContent = `Rating: ${topRating || '—'}`;
    document.getElementById('top-player-acc').textContent = `Precisão: ${topAcc}%`;

    document.getElementById('bottom-player-color').textContent = topIsBlack ? '⬜' : '⬛';
    document.getElementById('bottom-player-name').textContent = botName;
    document.getElementById('bottom-player-rating').textContent = `Rating: ${botRating || '—'}`;
    document.getElementById('bottom-player-acc').textContent = `Precisão: ${botAcc}%`;
  }

  function renderMovesTable(game) {
    const tbody = document.getElementById('moves-tbody');
    tbody.innerHTML = '';

    for (let i = 0; i < game.moves.length; i += 2) {
      const wMove = game.moves[i];
      const bMove = game.moves[i + 1];

      const tr = document.createElement('tr');
      const numTd = document.createElement('td');
      numTd.textContent = `${wMove.moveNumber}.`;
      tr.appendChild(numTd);

      const createMoveCell = (m) => {
        const td = document.createElement('td');
        if (!m) return td;
        td.className = 'move-cell';
        td.dataset.ply = m.ply;
        const showTag = [
          'brilliant',
          'great',
          'best',
          'excellent',
          'book',
          'inaccuracy',
          'mistake',
          'miss',
          'blunder'
        ].includes(m.classification.type);
        const clkHtml =
          m.clockSec !== null && m.clockSec !== undefined
            ? `<span class="move-clk">${CC.Analyzer.formatClock(m.clockSec)}</span>`
            : '';
        td.innerHTML = `${m.san}${
          showTag
            ? `<span class="move-tag ${m.classification.type}" title="${m.classification.label}">${m.classification.symbol}</span>`
            : ''
        }${clkHtml}`;
        td.addEventListener('click', () => {
          stopPreviewLine();
          app.sandboxActive = false;
          app.sandboxChess = null;
          app.currentPly = m.ply;
          app.renderAnalysisStep();
        });
        return td;
      };

      tr.appendChild(createMoveCell(wMove));
      tr.appendChild(createMoveCell(bMove));
      tbody.appendChild(tr);
    }
  }

  function renderHolisticGameReview(game) {
    const container = document.getElementById('holistic-review-body');
    const badge = document.getElementById('review-phase-badge');
    if (!container || !game || !Array.isArray(game.moves)) return;

    const heroMoves = game.moves.filter((m) => m.color === (game.heroColor || 'w'));
    if (!heroMoves.length) return;

    const phases = {
      Abertura: { accs: [], errors: [] },
      'Meio-Jogo': { accs: [], errors: [] },
      Final: { accs: [], errors: [] }
    };

    const missedCaptures = [];
    const tacticalBlunders = [];
    const brilliantOrGreat = [];
    const rushedErrors = [];
    let outOfBookMove = null;

    heroMoves.forEach((m) => {
      const ph = phases[m.phase] || phases['Meio-Jogo'];
      ph.accs.push(m.classification.accuracy ?? 80);
      const t = m.classification.type;
      if (t !== 'book' && !outOfBookMove && m.ply <= 18) outOfBookMove = m;
      if (['brilliant', 'great'].includes(t)) brilliantOrGreat.push(m);
      if (['inaccuracy', 'mistake', 'miss', 'blunder'].includes(t)) {
        ph.errors.push(m);
        if (t === 'blunder' || t === 'miss') tacticalBlunders.push(m);
        if (m.bestSan && m.bestSan.includes('x') && !m.san.includes('x')) missedCaptures.push(m);
        if (m.isRushedError) rushedErrors.push(m);
      }
    });

    const avgPhase = (arr) => (arr.length ? `${Math.round(CC.Analyzer.computeGameAccuracy(arr))}%` : '—');
    let worstPhase = 'Meio-Jogo';
    let lowestScore = 999;
    Object.entries(phases).forEach(([name, data]) => {
      if (data.accs.length > 0) {
        const avg = data.accs.reduce((a, b) => a + b, 0) / data.accs.length;
        if (avg < lowestScore) {
          lowestScore = avg;
          worstPhase = name;
        }
      }
    });
    if (badge) badge.textContent = `Foco: ${worstPhase} • ~${game.estimatedElo || '—'} Elo`;

    const sortedErrors = [...heroMoves]
      .filter((m) => ['blunder', 'miss', 'mistake', 'inaccuracy'].includes(m.classification.type))
      .sort((a, b) => b.winLoss - a.winLoss);
    const criticalError = sortedErrors[0] || null;

    const makeJumpBtn = (m, customText) =>
      `<button class="jump-ply-btn" data-jump-ply="${m.ply}">${
        customText || `${m.moveNumber}. ${m.san} (${m.classification.symbol})`
      }</button>`;

    const improvements = [];
    if (tacticalBlunders.length) {
      improvements.push(
        `<li><strong>Momentos Decisivos (?? / 🎯):</strong> Revise ${tacticalBlunders
          .slice(0, 3)
          .map((m) => makeJumpBtn(m))
          .join(' ')} — maiores quedas de probabilidade de vitória.</li>`
      );
    }
    if (missedCaptures.length) {
      improvements.push(
        `<li><strong>Capturas Perdidas:</strong> Veja ${missedCaptures
          .slice(0, 3)
          .map((m) => makeJumpBtn(m, `${m.moveNumber}. ${m.san} → ${m.bestSan}`))
          .join(' ')}.</li>`
      );
    }
    if (rushedErrors.length) {
      improvements.push(
        `<li><strong>Erros Apressados (&lt;3.5s):</strong> Você jogou rápido demais em ${rushedErrors
          .slice(0, 2)
          .map((m) => makeJumpBtn(m))
          .join(' ')} mesmo tendo tempo no relógio!</li>`
      );
    }
    if (outOfBookMove) {
      improvements.push(
        `<li><strong>Saída da Teoria:</strong> No lance ${makeJumpBtn(outOfBookMove, `${outOfBookMove.moveNumber}. ${outOfBookMove.san}`)} a partida saiu das linhas principais conhecidas (${game.opening}).</li>`
      );
    }

    const strengthHtml = brilliantOrGreat.length
      ? `<div class="review-box good">💎 <strong>Destaques:</strong> Você encontrou lances de alto impacto em ${brilliantOrGreat.map((m) => makeJumpBtn(m)).join(' ')}!</div>`
      : `<div class="review-box good">✅ <strong>Resumo:</strong> Precisão geral de <strong>${game.heroAccuracy}%</strong> (Performance estimada: <strong>~${game.estimatedElo || '—'} Elo</strong>).</div>`;

    const criticalHtml = criticalError
      ? `<div class="review-box warn">⚠️ <strong>Momento Crítico:</strong> Em ${makeJumpBtn(criticalError)}, o melhor era <strong>${criticalError.bestSan}</strong> (<code>${criticalError.pvSanLine || criticalError.bestSan}</code>).</div>`
      : '';

    container.innerHTML = `
      <div class="review-phase-grid">
        <div class="review-phase-item"><div class="review-phase-name">Abertura</div><div class="review-phase-val" style="color:${phases.Abertura.errors.length > 2 ? '#fbbf24' : '#34d399'}">${avgPhase(phases.Abertura.accs)}</div></div>
        <div class="review-phase-item"><div class="review-phase-name">Meio-Jogo</div><div class="review-phase-val" style="color:${phases['Meio-Jogo'].errors.length > 2 ? '#f87171' : '#34d399'}">${avgPhase(phases['Meio-Jogo'].accs)}</div></div>
        <div class="review-phase-item"><div class="review-phase-name">Final</div><div class="review-phase-val" style="color:#38bdf8">${avgPhase(phases.Final.accs)}</div></div>
      </div>
      ${strengthHtml}
      ${criticalHtml}
      <ul style="margin:0.25rem 0 0 1.1rem; display:flex; flex-direction:column; gap:0.25rem;">
        ${improvements.length ? improvements.join('') : '<li>Partida muito consistente! Poucos erros táticos relevantes.</li>'}
      </ul>
    `;

    container.querySelectorAll('.jump-ply-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const targetPly = parseInt(btn.dataset.jumpPly, 10);
        if (!isNaN(targetPly)) {
          stopPreviewLine();
          app.sandboxActive = false;
          app.sandboxChess = null;
          app.currentPly = targetPly;
          app.renderAnalysisStep();
        }
      });
    });
  }

  function drawEvalChart(game, currentPly) {
    const canvas = document.getElementById('eval-chart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();

    if (!game.moves.length) return;
    const total = game.moves.length;
    const getPoint = (idx, cp) => ({
      x: (idx / total) * w,
      y: h / 2 - (Math.max(-800, Math.min(800, cp)) / 800) * (h / 2 - 8)
    });

    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    game.moves.forEach((m, i) => {
      const pt = getPoint(i + 1, m.cpAfter);
      ctx.lineTo(pt.x, pt.y);
    });
    ctx.lineTo(w, h / 2);
    ctx.closePath();
    ctx.fillStyle = 'rgba(52, 211, 153, 0.18)';
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    game.moves.forEach((m, i) => {
      const pt = getPoint(i + 1, m.cpAfter);
      ctx.lineTo(pt.x, pt.y);
    });
    ctx.strokeStyle = '#34d399';
    ctx.lineWidth = 2;
    ctx.stroke();

    game.moves.forEach((m, i) => {
      const t = m.classification.type;
      if (['brilliant', 'great', 'blunder', 'miss', 'mistake'].includes(t)) {
        const pt = getPoint(i + 1, m.cpAfter);
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, t === 'brilliant' ? 5 : 3.8, 0, Math.PI * 2);
        const colorMap = {
          brilliant: '#1baca6',
          great: '#5c8bb0',
          blunder: '#ef4444',
          miss: '#a855f7',
          mistake: '#f97316'
        };
        ctx.fillStyle = colorMap[t] || '#ef4444';
        ctx.fill();
      }
    });

    if (currentPly > 0) {
      const curX = (currentPly / total) * w;
      ctx.strokeStyle = '#f8fafc';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(curX, 0);
      ctx.lineTo(curX, h);
      ctx.stroke();
    }

    canvas.onclick = (e) => {
      const rect = canvas.getBoundingClientRect();
      const ratio = (e.clientX - rect.left) / rect.width;
      const ply = Math.max(1, Math.min(total, Math.round(ratio * total)));
      stopPreviewLine();
      app.sandboxActive = false;
      app.sandboxChess = null;
      app.currentPly = ply;
      app.renderAnalysisStep();
    };
  }

  function stopPreviewLine() {
    if (app.previewInterval) {
      clearInterval(app.previewInterval);
      app.previewInterval = null;
    }
  }

  function bindAnalysisControls() {
    document.getElementById('btn-flip')?.addEventListener('click', () => {
      app.boardFlipped = !app.boardFlipped;
      const prof = app.getProfile();
      const game = prof ? prof.analyzedGames[app.currentGameId] : null;
      if (game) renderPlayerHeaders(game);
      app.renderAnalysisStep();
    });

    document.getElementById('btn-first')?.addEventListener('click', () => {
      stopPreviewLine();
      exitSandboxMode();
      app.currentPly = 0;
      app.renderAnalysisStep();
    });

    document.getElementById('btn-prev')?.addEventListener('click', () => {
      stopPreviewLine();
      if (app.sandboxActive && app.sandboxChess) {
        if (app.sandboxChess.history().length > 0) {
          app.sandboxChess.undo();
          if (app.sandboxChess.history().length === 0) exitSandboxMode();
          else {
            app.renderAnalysisStep();
            runLiveSandboxEvaluation(app.sandboxChess.fen());
          }
          return;
        }
        exitSandboxMode();
        return;
      }
      if (app.currentPly > 0) {
        app.currentPly--;
        app.renderAnalysisStep();
      }
    });

    document.getElementById('btn-next')?.addEventListener('click', () => {
      stopPreviewLine();
      if (app.sandboxActive) exitSandboxMode();
      const prof = app.getProfile();
      const game = prof ? prof.analyzedGames[app.currentGameId] : null;
      if (game && app.currentPly < game.moves.length) {
        app.currentPly++;
        const m = game.moves[app.currentPly - 1];
        if (m) CC.Board.playSound(m.san.includes('+') || m.san.includes('#') ? 'check' : m.san.includes('x') ? 'capture' : 'move');
        app.renderAnalysisStep();
      }
    });

    document.getElementById('btn-last')?.addEventListener('click', () => {
      stopPreviewLine();
      if (app.sandboxActive) exitSandboxMode();
      const prof = app.getProfile();
      const game = prof ? prof.analyzedGames[app.currentGameId] : null;
      if (game) {
        app.currentPly = game.moves.length;
        app.renderAnalysisStep();
      }
    });

    document.getElementById('btn-next-mistake')?.addEventListener('click', () => {
      stopPreviewLine();
      if (app.sandboxActive) exitSandboxMode();
      const prof = app.getProfile();
      const game = prof ? prof.analyzedGames[app.currentGameId] : null;
      if (!game) return;
      const errTypes = ['blunder', 'miss', 'mistake', 'inaccuracy'];
      let nextMove = game.moves.find(
        (m) => m.ply > app.currentPly && m.color === game.heroColor && errTypes.includes(m.classification.type)
      );
      if (!nextMove) {
        nextMove = game.moves.find((m) => m.color === game.heroColor && errTypes.includes(m.classification.type));
      }
      if (nextMove) {
        app.currentPly = nextMove.ply;
        app.renderAnalysisStep();
      }
    });

    document.getElementById('btn-exit-sandbox')?.addEventListener('click', exitSandboxMode);

    document.getElementById('btn-toggle-live-engine')?.addEventListener('click', (e) => {
      app.liveEngineEnabled = !app.liveEngineEnabled;
      e.currentTarget.classList.toggle('active-toggle', app.liveEngineEnabled);
      e.currentTarget.textContent = app.liveEngineEnabled ? '⚡ Motor Ao Vivo: ON' : '⚡ Motor Ao Vivo';
      if (!app.liveEngineEnabled) app.engine.abortTag('sandbox');
      app.renderAnalysisStep();
    });

    document.getElementById('btn-cancel-analysis')?.addEventListener('click', () => {
      app.analysisCancelled = true;
      app.engine.abortTag('game-analysis');
      document.getElementById('analysis-progress-box')?.classList.add('hidden');
    });

    document.getElementById('btn-play-best-line')?.addEventListener('click', () => {
      stopPreviewLine();
      const prof = app.getProfile();
      const game = prof ? prof.analyzedGames[app.currentGameId] : null;
      if (!game || app.currentPly === 0) return;
      const moveRecord = game.moves[app.currentPly - 1];
      if (!moveRecord || !moveRecord.pv || !moveRecord.pv.length) return;

      const tempChess = new Chess(moveRecord.fenBefore);
      let stepIdx = 0;
      app.previewInterval = setInterval(() => {
        if (stepIdx >= Math.min(moveRecord.pv.length, 6)) {
          stopPreviewLine();
          return;
        }
        const uci = moveRecord.pv[stepIdx];
        const m = tempChess.move({
          from: uci.slice(0, 2),
          to: uci.slice(2, 4),
          promotion: uci.length > 4 ? uci[4] : 'q'
        });
        if (!m) {
          stopPreviewLine();
          return;
        }
        CC.Board.playMoveObjSound(m);
        CC.Board.renderChessboard({
          containerId: 'chessboard',
          overlayId: 'board-overlay',
          fen: tempChess.fen(),
          flipped: app.boardFlipped,
          lastMove: { from: m.from, to: m.to },
          arrows: [{ from: m.from, to: m.to, color: '#22c55e' }]
        });
        stepIdx++;
      }, 850);
    });

    document.getElementById('btn-train-this-pos')?.addEventListener('click', () => {
      const prof = app.getProfile();
      const game = prof ? prof.analyzedGames[app.currentGameId] : null;
      if (!game || app.currentPly === 0 || !prof) return;
      const puzzleId = `${game.id}_ply_${app.currentPly}`;
      const idx = prof.puzzles.findIndex((p) => p.id === puzzleId);
      if (idx >= 0) {
        app.academy.puzzleFilter = 'all';
        app.academy.themeFilter = 'all';
        app.academy.currentPuzzleIndex = idx;
        app.switchTab('tab-trainer');
        app.academy.switchSubTab('mistakes');
      }
    });

    document.getElementById('btn-sparring-from-pos')?.addEventListener('click', () => {
      const prof = app.getProfile();
      const game = prof ? prof.analyzedGames[app.currentGameId] : null;
      const fen = getActiveAnalysisFen();
      const color = game ? game.heroColor : fen.split(' ')[1];
      app.switchTab('tab-trainer');
      app.academy.switchSubTab('sparring');
      app.academy.startSparringFromFen(fen, color);
    });

    document.getElementById('btn-share-game')?.addEventListener('click', () => {
      const prof = app.getProfile();
      const game = prof ? prof.analyzedGames[app.currentGameId] : null;
      if (game) CC.Share.openShareModal(game);
    });

    document.getElementById('btn-close-share')?.addEventListener('click', () => {
      document.getElementById('share-modal')?.classList.add('hidden');
    });

    document.getElementById('btn-reanalyze')?.addEventListener('click', async () => {
      const prof = app.getProfile();
      const game = prof ? prof.analyzedGames[app.currentGameId] : null;
      if (game) await analyzeAndSaveGame(game, true);
    });

    window.addEventListener('keydown', (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;
      const activeTab = document.querySelector('.tab-panel.active');
      if (!activeTab || activeTab.id !== 'tab-analysis') return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        document.getElementById('btn-prev').click();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        document.getElementById('btn-next').click();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        document.getElementById('btn-first').click();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        document.getElementById('btn-last').click();
      } else if (e.key.toLowerCase() === 'f') {
        e.preventDefault();
        document.getElementById('btn-flip').click();
      }
    });
  }

  // ==================== TAB 2: IMPORTERS & SAVED GAMES ====================
  function bindImportControls() {
    document.getElementById('btn-fetch-games')?.addEventListener('click', fetchRemoteGames);
    document.getElementById('chesscom-username')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') fetchRemoteGames();
    });

    document.getElementById('btn-batch-analyze')?.addEventListener('click', async () => {
      const toAnalyze = app.fetchedGames.slice(0, 5);
      for (const g of toAnalyze) {
        if (app.analysisCancelled) break;
        await analyzeAndSaveGame(g, true);
      }
    });

    document.getElementById('btn-batch-analyze-10')?.addEventListener('click', async () => {
      const toAnalyze = app.fetchedGames.slice(0, 10);
      for (const g of toAnalyze) {
        if (app.analysisCancelled) break;
        await analyzeAndSaveGame(g, true);
      }
    });

    document.getElementById('btn-load-demos')?.addEventListener('click', loadAndAnalyzeDemoGames);

    document.getElementById('btn-analyze-pgn')?.addEventListener('click', async () => {
      const raw = document.getElementById('pgn-input').value.trim();
      if (!raw) {
        alert('Cole ao menos um PGN válido.');
        return;
      }
      const heroHint = document.getElementById('pgn-hero-name').value.trim() || app.getProfile()?.username || '';
      const chunks = CC.Importers.splitMultiplePgns(raw);
      for (let i = 0; i < chunks.length; i++) {
        if (app.analysisCancelled) break;
        const meta = CC.Importers.parseManualPgnToGameMeta(chunks[i], heroHint);
        await analyzeAndSaveGame(meta, i === chunks.length - 1);
      }
    });

    document.getElementById('pgn-file-input')?.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const text = await file.text();
      document.getElementById('pgn-input').value = text;
    });

    document.getElementById('btn-clear-history')?.addEventListener('click', async () => {
      const prof = app.getProfile();
      if (!prof) return;
      if (!confirm(`Limpar todas as partidas analisadas e exercícios do perfil "${prof.name}"?`)) return;
      prof.analyzedGames = {};
      prof.puzzles = [];
      app.currentGameId = null;
      await app.saveCurrentStore();
      refreshAllViews();
    });

    document.getElementById('saved-games-search')?.addEventListener('input', () => {
      renderSavedGamesList();
    });

    document.getElementById('btn-export-backup')?.addEventListener('click', () => {
      CC.Share.downloadProfileBackup(app.storeRoot);
    });

    document.getElementById('backup-file-input')?.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const parsed = JSON.parse(await file.text());
        if (parsed && parsed.profiles) {
          app.storeRoot = parsed;
          await app.saveCurrentStore();
          refreshAllViews();
          alert('✅ Backup restaurado com sucesso!');
        } else {
          alert('Arquivo JSON inválido.');
        }
      } catch (err) {
        alert('Erro ao ler backup: ' + err.message);
      }
    });
  }

  async function fetchRemoteGames() {
    const platform = document.getElementById('import-platform').value;
    const usernameInput = document.getElementById('chesscom-username');
    const timeClassFilter = document.getElementById('chesscom-timeclass').value;
    const statusEl = document.getElementById('fetch-status');
    const listEl = document.getElementById('chesscom-games-list');
    const batchBar = document.getElementById('batch-bar');

    const username = usernameInput.value.trim();
    if (!username) {
      statusEl.textContent = '⚠️ Digite o nome de usuário.';
      return false;
    }

    statusEl.textContent = `⏳ Buscando perfil e partidas de "${username}" no ${
      platform === 'lichess' ? 'Lichess.org' : 'Chess.com'
    }...`;
    listEl.innerHTML = '';
    batchBar.classList.add('hidden');

    try {
      const res =
        platform === 'lichess'
          ? await CC.Importers.fetchLichessAccount(username, timeClassFilter)
          : await CC.Importers.fetchChessComAccount(username, timeClassFilter);

      const profileId = `${res.platform}:${res.username.toLowerCase()}`;
      CC.Store.upsertProfile(app.storeRoot, {
        id: profileId,
        name: res.displayName,
        platform: res.platform,
        username: res.username,
        profile: { username: res.displayName, avatar: res.avatar },
        stats: res.stats
      });

      app.fetchedGames = res.games;
      await app.saveCurrentStore();
      renderProfileSidebar();
      renderSavedGamesList();
      app.updatePuzzleBadgeCount();

      statusEl.textContent = `✅ Conta ${res.displayName} (${
        res.platform === 'lichess' ? 'Lichess' : 'Chess.com'
      }) vinculada! ${res.games.length} partidas recentes encontradas.`;

      if (res.games.length > 0) {
        batchBar.classList.remove('hidden');
        document.getElementById('games-found-count').textContent = `${res.games.length} partidas carregadas`;
      }

      renderFetchedGamesList(res.games);
      return true;
    } catch (err) {
      statusEl.textContent = `❌ Erro ao buscar "${username}" (${err.message}). Verifique o nome de usuário e a conexão.`;
      return false;
    }
  }

  function renderFetchedGamesList(games) {
    const listEl = document.getElementById('chesscom-games-list');
    const prof = app.getProfile();
    listEl.innerHTML = '';

    games.forEach((g) => {
      const already = Boolean(prof && prof.analyzedGames[g.id]);
      const badgeClass = g.heroOutcome === 'Vitória' ? 'win' : g.heroOutcome === 'Derrota' ? 'loss' : 'draw';

      const item = document.createElement('div');
      item.className = 'game-item';
      item.innerHTML = `
        <div class="game-meta">
          <div class="game-players">
            <span class="badge-result ${badgeClass}">${g.heroOutcome || g.result}</span>
            ⬜ ${g.white} (${g.whiteRating}) vs ⬛ ${g.black} (${g.blackRating})
          </div>
          <div class="game-sub">📚 ${g.opening} • ⏱️ ${String(g.timeClass).toUpperCase()} • 📅 ${g.date}</div>
        </div>
        <div>
          <button class="btn-primary small">${already ? '🔍 Ver' : '⚡ Analisar'}</button>
        </div>
      `;
      item.querySelector('button').addEventListener('click', async () => {
        if (prof && prof.analyzedGames[g.id]) {
          app.loadGameIntoAnalysisView(g.id);
          app.switchTab('tab-analysis');
        } else {
          await analyzeAndSaveGame(g, true);
        }
      });
      listEl.appendChild(item);
    });
  }

  function renderSavedGamesList() {
    const listEl = document.getElementById('saved-games-list');
    const countEl = document.getElementById('saved-games-count');
    const searchVal = (document.getElementById('saved-games-search')?.value || '').trim().toLowerCase();
    const prof = app.getProfile();

    const allGames = prof
      ? Object.values(prof.analyzedGames || {}).sort((a, b) => new Date(b.analyzedAt || 0) - new Date(a.analyzedAt || 0))
      : [];

    const games = searchVal
      ? allGames.filter(
          (g) =>
            (g.white || '').toLowerCase().includes(searchVal) ||
            (g.black || '').toLowerCase().includes(searchVal) ||
            (g.opening || '').toLowerCase().includes(searchVal)
        )
      : allGames;

    if (countEl) countEl.textContent = allGames.length;
    if (!listEl) return;
    listEl.innerHTML = '';

    if (!games.length) {
      listEl.innerHTML = `<div class="muted-text" style="padding:0.65rem">Nenhuma partida analisada ainda neste perfil. Busque no Chess.com / Lichess ou clique em <strong>✨ Carregar Partidas Demo</strong>!</div>`;
      return;
    }

    games.forEach((g) => {
      const item = document.createElement('div');
      item.className = 'game-item';
      const brilBadge =
        g.counts && g.counts.brilliant
          ? ` • <strong style="color:#2dd4bf">!! ${g.counts.brilliant}</strong>`
          : '';
      item.innerHTML = `
        <div class="game-meta">
          <div class="game-players">⬜ ${g.white} (${g.whiteRating}) vs ⬛ ${g.black} (${g.blackRating})</div>
          <div class="game-sub">
            📚 ${g.opening} • Precisão: <strong style="color:#34d399">${g.heroAccuracy}%</strong>${brilBadge} • ?? <strong style="color:#f87171">${g.counts?.blunder || 0}</strong>
          </div>
        </div>
        <div style="display:flex; gap:0.3rem;">
          <button class="btn-secondary small btn-open-game">Abrir</button>
          <button class="btn-secondary small btn-share-saved" title="Card / Exportar">📤</button>
          <button class="btn-secondary small btn-del-game" title="Remover" style="color:#f87171;">🗑️</button>
        </div>
      `;
      item.querySelector('.btn-open-game').addEventListener('click', () => {
        app.loadGameIntoAnalysisView(g.id);
        app.switchTab('tab-analysis');
      });
      item.querySelector('.btn-share-saved').addEventListener('click', () => {
        CC.Share.openShareModal(g);
      });
      item.querySelector('.btn-del-game').addEventListener('click', async () => {
        delete prof.analyzedGames[g.id];
        prof.puzzles = (prof.puzzles || []).filter((p) => p.gameId !== g.id);
        await app.saveCurrentStore();
        refreshAllViews();
      });
      listEl.appendChild(item);
    });
  }

  CC.App = app;
})(window);
