/* ============================================================================
 * ChessCoach Pro — Training Academy v2
 *  1) Mistake Trainer (Multi-move PV + SM-2 Spaced Repetition + Theme Filters)
 *  2) Opening Repertoire Drills (ECO Lines + User Openings)
 *  3) Guided Endgame & Tactical Drills vs Stockfish
 *  4) Sparring vs Coach/Stockfish (400–2500 Elo + Blunder Guard)
 * ============================================================================ */
(function (global) {
  'use strict';

  const CC = (global.ChessCoach = global.ChessCoach || {});

  const GUIDED_DRILLS = [
    {
      id: 'drill_mate_queen',
      category: 'Finais Fundamentais',
      title: 'Mate de Dama + Rei',
      desc: 'Encurrale o Rei adversário na borda usando Dama e Rei e aplique xeque-mate sem afogar.',
      fen: '4k3/8/8/8/8/8/8/4K2Q w - - 0 1',
      heroColor: 'w',
      goal: 'win',
      tip: 'Use a Dama a distância de salto de cavalo para restringir o Rei adversário e aproxime seu Rei.'
    },
    {
      id: 'drill_mate_rook',
      category: 'Finais Fundamentais',
      title: 'Mate de Torre + Rei (Método da Caixa)',
      desc: 'Corte as colunas/fileiras com a Torre e aproxime seu Rei para forçar o mate na borda.',
      fen: '4k3/8/8/8/8/8/8/4K2R w - - 0 1',
      heroColor: 'w',
      goal: 'win',
      tip: 'Não dê xeques aleatórios! Use a Torre para tirar fileiras do Rei inimigo e ganhe a oposição com seu Rei.'
    },
    {
      id: 'drill_opposition',
      category: 'Finais de Peões',
      title: 'Oposição de Reis & Promoção',
      desc: 'Conquiste a oposição direta na frente do peão para garantir a coroação.',
      fen: '4k3/8/8/4PK2/8/8/8/8 w - - 0 1',
      heroColor: 'w',
      goal: 'win',
      tip: 'Jogue Ke6! Sempre coloque seu Rei à frente do peão buscando casas-chave na 6ª fila.'
    },
    {
      id: 'drill_lucena',
      category: 'Finais de Torres',
      title: 'Ponte de Lucena (Peão na 7ª)',
      desc: 'Posição mais importante de finais de torres: liberte seu Rei e construa a ponte na 4ª fileira.',
      fen: '3K4/3P2k1/8/8/8/8/2R5/4r3 w - - 0 1',
      heroColor: 'w',
      goal: 'win',
      tip: 'Avance a torre para a 4ª fileira (Rc4!) para bloquear os xeques verticais quando o Rei sair de d8.'
    },
    {
      id: 'drill_philidor',
      category: 'Finais de Torres',
      title: 'Defesa de Philidor (Segurar Empate)',
      desc: 'Defenda-se com peão a menos mantendo sua Torre ativa e impedindo o avanço do Rei branco.',
      fen: '4k3/8/4P3/4K3/8/8/7r/4R3 b - - 0 1',
      heroColor: 'b',
      goal: 'draw',
      tip: 'Use a torre na 6ª fileira (...Rh6!) para impedir que o Rei branco passe, e dê xeques por trás quando o peão avançar!'
    },
    {
      id: 'drill_greek_gift',
      category: 'Padrões Táticos',
      title: 'Sacrifício Grego (Bxh7+)',
      desc: 'Destrua o roque inimigo com o clássico sacrifício de bispo em h7 seguido de Cg5+ e Dh5.',
      fen: 'r1bq1rk1/pppn1ppp/3bp3/3p4/3P4/2NBPN2/PP3PPP/R1BQK2R w KQ - 0 1',
      heroColor: 'w',
      goal: 'win',
      tip: 'Observe que h7 não está defendido por Cf6. Tente 1. Bxh7+ Kxh7 2. Ng5+!'
    },
    {
      id: 'drill_deflection',
      category: 'Padrões Táticos',
      title: 'Desvio & Mate de Corredor',
      desc: 'Explore a fraqueza da 8ª fila do adversário desviando a peça defensora.',
      fen: '3r2k1/5ppp/8/8/8/1Q6/5PPP/3R2K1 w - - 0 1',
      heroColor: 'w',
      goal: 'win',
      tip: 'A torre preta em d8 está sobrecarregada defendendo a 8ª fileira e a casa f8!'
    }
  ];

  // --- SM-2 Spaced Repetition Helpers ---
  function getPuzzleDueStatus(p) {
    if (!p.srs || !p.srs.nextReviewAt) return !p.solved;
    return Date.now() >= p.srs.nextReviewAt;
  }

  function updatePuzzleSrs(puzzle, cleanSuccess) {
    const prev = puzzle.srs || { intervalDays: 0, ease: 2.5, reps: 0, attempts: 0 };
    const attempts = (prev.attempts || 0) + 1;

    if (cleanSuccess) {
      const reps = (prev.reps || 0) + 1;
      const intervalDays =
        reps === 1 ? 1 : reps === 2 ? 3 : Math.round((prev.intervalDays || 3) * (prev.ease || 2.5));
      const ease = Math.min(3.0, (prev.ease || 2.5) + 0.1);
      puzzle.srs = {
        intervalDays,
        ease: Number(ease.toFixed(2)),
        reps,
        attempts,
        nextReviewAt: Date.now() + intervalDays * 86400000,
        lastResult: 'ok'
      };
      puzzle.solved = true;
    } else {
      puzzle.srs = {
        intervalDays: 0,
        ease: Math.max(1.3, (prev.ease || 2.5) - 0.2),
        reps: 0,
        attempts,
        nextReviewAt: Date.now(),
        lastResult: 'fail'
      };
      puzzle.solved = false;
    }
  }

  // --- Academy Controller ---
  class AcademyController {
    constructor(app) {
      this.app = app;
      this.subTab = 'mistakes'; // 'mistakes' | 'openings' | 'drills' | 'sparring'

      // Mistake trainer state
      this.puzzleFilter = 'all';
      this.themeFilter = 'all';
      this.currentPuzzleIndex = 0;
      this.mistakeChess = null;
      this.mistakeSelectedSq = null;
      this.mistakeStepIdx = 0; // tracks multi-move PV progression (0, 2, ...)
      this.mistakeCleanTry = true;

      // Opening trainer state
      this.openingDrills = CC.EcoBook.getRepertoireDrills();
      this.currentOpeningIdx = 0;
      this.openingChess = null;
      this.openingMoveIdx = 0;
      this.openingSelectedSq = null;

      // Guided drills state
      this.currentDrillIdx = 0;
      this.drillChess = null;
      this.drillSelectedSq = null;
      this.drillBusy = false;

      // Sparring state
      this.sparringChess = new global.Chess();
      this.sparringHeroColor = 'w';
      this.sparringElo = 400;
      this.sparringTier = 'match'; // 'below' | 'match' | 'above' | 'manual'
      this.sparringCoachGuard = true;
      this.sparringSelectedSq = null;
      this.sparringBusy = false;
      this.sparringStartFen = new global.Chess().fen();
      this.sparringMoves = [];
    }

    bindControls() {
      // Sub-tab switcher
      document.querySelectorAll('.academy-subtab-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          this.switchSubTab(btn.dataset.subtab);
        });
      });

      // --- Mistake Trainer Controls ---
      document.querySelectorAll('.filter-pill').forEach((btn) => {
        btn.addEventListener('click', () => {
          document.querySelectorAll('.filter-pill').forEach((b) => b.classList.remove('active'));
          btn.classList.add('active');
          this.puzzleFilter = btn.dataset.filter;
          this.currentPuzzleIndex = 0;
          this.renderMistakesView();
        });
      });

      const themeSelect = document.getElementById('puzzle-theme-filter');
      if (themeSelect) {
        themeSelect.addEventListener('change', (e) => {
          this.themeFilter = e.target.value;
          this.currentPuzzleIndex = 0;
          this.renderMistakesView();
        });
      }

      document.getElementById('btn-puzzle-prev')?.addEventListener('click', () => {
        const list = this.getFilteredPuzzles();
        if (!list.length) return;
        this.currentPuzzleIndex = (this.currentPuzzleIndex - 1 + list.length) % list.length;
        this.renderMistakesView();
      });

      document.getElementById('btn-puzzle-next')?.addEventListener('click', () => {
        const list = this.getFilteredPuzzles();
        if (!list.length) return;
        this.currentPuzzleIndex = (this.currentPuzzleIndex + 1) % list.length;
        this.renderMistakesView();
      });

      document.getElementById('btn-puzzle-hint')?.addEventListener('click', () => {
        const puzzle = this.getFilteredPuzzles()[this.currentPuzzleIndex];
        if (!puzzle) return;
        this.mistakeCleanTry = false;
        const expectedUci = this._getExpectedPuzzleUci(puzzle);
        const fromSq = expectedUci.slice(0, 2);
        this.mistakeSelectedSq = fromSq;
        this._renderMistakeBoard(puzzle, [{ from: fromSq, to: fromSq, color: '#eab308' }]);
        document.getElementById('trainer-body').innerHTML = `💡 <strong>Dica:</strong> A peça correta está na casa <strong>${fromSq.toUpperCase()}</strong>. Encontre o destino vencedor!`;
      });

      document.getElementById('btn-puzzle-solution')?.addEventListener('click', () => {
        const puzzle = this.getFilteredPuzzles()[this.currentPuzzleIndex];
        if (!puzzle) return;
        this.mistakeCleanTry = false;
        updatePuzzleSrs(puzzle, false);
        this.app.saveCurrentStore();

        const expectedUci = this._getExpectedPuzzleUci(puzzle);
        const fromSq = expectedUci.slice(0, 2);
        const toSq = expectedUci.slice(2, 4);
        const arrows = [{ from: fromSq, to: toSq, color: '#22c55e' }];
        if (this.mistakeStepIdx === 0 && puzzle.playedUci) {
          arrows.push({ from: puzzle.playedUci.slice(0, 2), to: puzzle.playedUci.slice(2, 4), color: '#ef4444' });
        }
        this._renderMistakeBoard(puzzle, arrows);
        document.getElementById('trainer-title').textContent = `Solução: ${puzzle.bestSan}`;
        document.getElementById('trainer-body').innerHTML = `${puzzle.explanation}`;
      });

      document.getElementById('btn-puzzle-open-game')?.addEventListener('click', () => {
        const puzzle = this.getFilteredPuzzles()[this.currentPuzzleIndex];
        if (!puzzle) return;
        const prof = this.app.getProfile();
        if (prof && prof.analyzedGames[puzzle.gameId]) {
          this.app.loadGameIntoAnalysisView(puzzle.gameId, puzzle.ply);
          this.app.switchTab('tab-analysis');
        }
      });

      // --- Opening Trainer Controls ---
      document.getElementById('opening-drill-select')?.addEventListener('change', (e) => {
        this.currentOpeningIdx = parseInt(e.target.value, 10) || 0;
        this.startOpeningDrill();
      });
      document.getElementById('btn-opening-restart')?.addEventListener('click', () => this.startOpeningDrill());
      document.getElementById('btn-opening-hint')?.addEventListener('click', () => this.showOpeningHint());

      // --- Guided Drills Controls ---
      document.getElementById('guided-drill-select')?.addEventListener('change', (e) => {
        this.currentDrillIdx = parseInt(e.target.value, 10) || 0;
        this.startGuidedDrill();
      });
      document.getElementById('btn-drill-restart')?.addEventListener('click', () => this.startGuidedDrill());
      document.getElementById('btn-drill-tip')?.addEventListener('click', () => {
        const d = GUIDED_DRILLS[this.currentDrillIdx];
        if (d) {
          document.getElementById('drill-feedback').innerHTML = `💡 <strong>Dica do Coach:</strong> ${d.tip}`;
        }
      });

      // --- Sparring Controls ---
      document.getElementById('btn-sparring-start')?.addEventListener('click', () => {
        this.startSparringFromFen(new global.Chess().fen());
      });
      document.querySelectorAll('.sparring-tier-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          this.sparringTier = btn.dataset.tier || 'match';
          this.syncSparringEloWithProfile();
          document.getElementById('sparring-feedback').innerHTML = `🎯 Força do Bot ajustada para <strong>~${this.sparringElo} Elo</strong> (${
            this.sparringTier === 'below'
              ? 'Modo Facilitado — abaixo do seu nível'
              : this.sparringTier === 'above'
              ? 'Modo Desafio — acima do seu nível'
              : 'Calibrado com o seu nível'
          }).`;
        });
      });
      document.getElementById('sparring-elo-select')?.addEventListener('change', (e) => {
        this.sparringElo = parseInt(e.target.value, 10) || 400;
        this.sparringTier = 'manual';
        document.querySelectorAll('.sparring-tier-btn').forEach((b) => b.classList.remove('active'));
        const activePill = document.getElementById('sparring-active-elo-pill');
        if (activePill) activePill.textContent = `~${this.sparringElo} Elo`;
        document.getElementById('sparring-feedback').innerHTML = `🎚️ Bot definido manualmente em <strong>~${this.sparringElo} Elo</strong>.`;
      });
      document.getElementById('sparring-color-select')?.addEventListener('change', (e) => {
        this.sparringHeroColor = e.target.value;
        this.startSparringFromFen(this.sparringStartFen);
      });
      document.getElementById('sparring-coach-guard')?.addEventListener('change', (e) => {
        this.sparringCoachGuard = e.target.checked;
      });
      document.getElementById('btn-sparring-undo')?.addEventListener('click', () => {
        if (this.sparringBusy || this.sparringChess.history().length < 2) return;
        this.sparringChess.undo();
        this.sparringChess.undo();
        this.sparringMoves.splice(-2);
        this.sparringSelectedSq = null;
        this.renderSparringBoard();
      });
    }

    switchSubTab(subTab) {
      this.subTab = subTab;
      document.querySelectorAll('.academy-subtab-btn').forEach((b) => {
        b.classList.toggle('active', b.dataset.subtab === subTab);
      });
      document.querySelectorAll('.academy-panel').forEach((p) => {
        p.classList.toggle('active', p.id === `academy-${subTab}`);
      });

      if (subTab === 'mistakes') this.renderMistakesView();
      else if (subTab === 'openings') this.renderOpeningsView();
      else if (subTab === 'drills') this.renderDrillsView();
      else if (subTab === 'sparring') {
        this.syncSparringEloWithProfile();
        this.renderSparringBoard();
      }
    }

    render() {
      this.switchSubTab(this.subTab);
    }

    // ==================== 1. MISTAKE TRAINER ====================
    getFilteredPuzzles() {
      const prof = this.app.getProfile();
      const all = prof ? prof.puzzles : [];
      let list = all;
      if (this.puzzleFilter === 'due') list = list.filter((p) => getPuzzleDueStatus(p));
      else if (this.puzzleFilter === 'blunder') list = list.filter((p) => p.severity === 'blunder');
      else if (this.puzzleFilter === 'miss') list = list.filter((p) => p.severity === 'miss');
      else if (this.puzzleFilter === 'mistake') list = list.filter((p) => p.severity === 'mistake');
      else if (this.puzzleFilter === 'pending') list = list.filter((p) => !p.solved);

      if (this.themeFilter !== 'all') {
        list = list.filter((p) => (p.themes || []).includes(this.themeFilter));
      }

      // Prioritize due/unsolved puzzles first when viewing all
      return list;
    }

    _getExpectedPuzzleUci(puzzle) {
      if (this.mistakeStepIdx === 0) return puzzle.bestUci;
      if (Array.isArray(puzzle.pv) && puzzle.pv[this.mistakeStepIdx]) {
        return puzzle.pv[this.mistakeStepIdx];
      }
      return puzzle.bestUci;
    }

    renderMistakesView() {
      this.app.updatePuzzleBadgeCount();
      const listEl = document.getElementById('puzzles-list');
      const puzzles = this.getFilteredPuzzles();
      if (!listEl) return;
      listEl.innerHTML = '';

      if (!puzzles.length) {
        listEl.innerHTML = `<div class="muted-text" style="padding:0.85rem">Nenhum exercício neste filtro. Importe partidas ou carregue uma Partida Demo para gerar desafios personalizados!</div>`;
        CC.Board.renderChessboard({
          containerId: 'trainer-board',
          overlayId: 'trainer-overlay',
          fen: new global.Chess().fen(),
          flipped: false
        });
        document.getElementById('trainer-title').textContent = 'Sem desafios pendentes neste filtro';
        document.getElementById('trainer-body').innerHTML = 'Troque o filtro acima ou analise novas partidas na aba <strong>📥 Importar</strong>.';
        return;
      }

      if (this.currentPuzzleIndex >= puzzles.length) this.currentPuzzleIndex = 0;

      puzzles.forEach((p, idx) => {
        const due = getPuzzleDueStatus(p);
        const item = document.createElement('div');
        item.className = `puzzle-item ${idx === this.currentPuzzleIndex ? 'active' : ''}`;
        const themeStr = (p.themes || [])
          .slice(0, 2)
          .map((t) => CC.Analyzer.THEME_LABELS[t] || t)
          .join(' • ');
        item.innerHTML = `
          <div class="game-meta">
            <div class="game-players">
              <span class="move-tag ${p.severity}">${p.symbol}</span>
              L${p.moveNumber}: ${p.playedSan} vs ${p.opponent}
            </div>
            <div class="game-sub">
              ${p.phase}${themeStr ? ` • ${themeStr}` : ''} ${
                p.solved && !due
                  ? '• <strong style="color:#4ade80">✓ Dominado</strong>'
                  : due && p.solved
                  ? '• <strong style="color:#fbbf24">⏰ Revisão SRS</strong>'
                  : ''
              }
            </div>
          </div>
        `;
        item.addEventListener('click', () => {
          this.currentPuzzleIndex = idx;
          this.renderMistakesView();
        });
        listEl.appendChild(item);
      });

      this.loadCurrentPuzzle();
    }

    loadCurrentPuzzle() {
      const puzzle = this.getFilteredPuzzles()[this.currentPuzzleIndex];
      if (!puzzle) return;

      this.mistakeChess = new global.Chess(puzzle.fenBefore);
      this.mistakeSelectedSq = null;
      this.mistakeStepIdx = 0;
      this.mistakeCleanTry = true;

      document.getElementById('puzzle-opponent-label').textContent = `Contra ${puzzle.opponent} (Lance ${puzzle.moveNumber})`;
      document.getElementById('puzzle-phase-label').textContent = `Fase: ${puzzle.phase} | ${puzzle.opening}`;
      document.getElementById('puzzle-severity-pill').textContent = `${puzzle.symbol} ${puzzle.label}`;

      document.getElementById('trainer-badge').textContent = '🎯';
      document.getElementById('trainer-title').textContent = `Você jogou ${puzzle.playedSan} (${puzzle.symbol}) nesta posição`;
      document.getElementById('trainer-subtitle').textContent = `Jogue com as ${puzzle.heroColor === 'w' ? 'Brancas ⬜' : 'Pretas ⬛'} — clique ou arraste a peça`;
      document.getElementById('trainer-body').innerHTML = `Encontre a continuação mais forte do Stockfish para corrigir o erro da partida.`;

      this._renderMistakeBoard(puzzle, [
        { from: puzzle.playedUci.slice(0, 2), to: puzzle.playedUci.slice(2, 4), color: 'rgba(239,68,68,0.45)' }
      ]);
    }

    _renderMistakeBoard(puzzle, arrows = []) {
      const chess = this.mistakeChess;
      const legalTargets = this.mistakeSelectedSq
        ? chess.moves({ square: this.mistakeSelectedSq, verbose: true })
        : [];

      CC.Board.renderChessboard({
        containerId: 'trainer-board',
        overlayId: 'trainer-overlay',
        fen: chess.fen(),
        flipped: puzzle.heroColor === 'b',
        selectedSquare: this.mistakeSelectedSq,
        legalTargets,
        arrows,
        onSquareClick: (sq) => this._handleMistakeClick(sq, puzzle),
        onPieceDrop: (from, to) => this._tryMistakeMove(from, to, puzzle)
      });
    }

    _handleMistakeClick(sq, puzzle) {
      const chess = this.mistakeChess;
      if (this.mistakeSelectedSq && this.mistakeSelectedSq !== sq) {
        const legal = chess.moves({ square: this.mistakeSelectedSq, verbose: true }).find((m) => m.to === sq);
        if (legal) {
          this._tryMistakeMove(this.mistakeSelectedSq, sq, puzzle);
          return;
        }
      }
      const piece = chess.get(sq);
      this.mistakeSelectedSq = piece && piece.color === puzzle.heroColor ? sq : null;
      this._renderMistakeBoard(puzzle);
    }

    _tryMistakeMove(from, to, puzzle) {
      const chess = this.mistakeChess;
      const piece = chess.get(from);
      if (!piece || piece.color !== puzzle.heroColor) return;

      const isPromo = piece.type === 'p' && ((piece.color === 'w' && to[1] === '8') || (piece.color === 'b' && to[1] === '1'));
      const execute = (promo) => {
        const moveAttempt = chess.move({ from, to, promotion: promo || 'q' });
        if (!moveAttempt) {
          this.mistakeSelectedSq = null;
          this._renderMistakeBoard(puzzle);
          return;
        }

        const attemptUci = moveAttempt.from + moveAttempt.to + (moveAttempt.promotion || '');
        const expectedUci = this._getExpectedPuzzleUci(puzzle);
        const expectedSan = CC.Analyzer.uciToSan(chess.fen() ? puzzle.fenBefore : '', expectedUci);
        const isCorrect =
          attemptUci === expectedUci ||
          (this.mistakeStepIdx === 0 && moveAttempt.san === puzzle.bestSan);

        if (isCorrect) {
          CC.Board.playSound('success');
          this.mistakeSelectedSq = null;

          // Check if puzzle has a sharp multi-move PV continuation (pv[1] reply + pv[2] follow-up)
          const hasNextPair =
            Array.isArray(puzzle.pv) &&
            puzzle.pv.length >= this.mistakeStepIdx + 3 &&
            this.mistakeStepIdx < 2;

          if (hasNextPair) {
            const oppUci = puzzle.pv[this.mistakeStepIdx + 1];
            const testOpp = new global.Chess(chess.fen());
            const oppMove = testOpp.move({
              from: oppUci.slice(0, 2),
              to: oppUci.slice(2, 4),
              promotion: oppUci.length > 4 ? oppUci[4] : 'q'
            });
            const heroFollowUci = puzzle.pv[this.mistakeStepIdx + 2];
            const followMove = oppMove
              ? testOpp.move({
                  from: heroFollowUci.slice(0, 2),
                  to: heroFollowUci.slice(2, 4),
                  promotion: heroFollowUci.length > 4 ? heroFollowUci[4] : 'q'
                })
              : null;

            if (oppMove && followMove) {
              this._renderMistakeBoard(puzzle, [{ from: moveAttempt.from, to: moveAttempt.to, color: '#22c55e' }]);
              document.getElementById('trainer-badge').textContent = '🔥';
              document.getElementById('trainer-title').textContent = `Boa! ${moveAttempt.san} — continue a sequência!`;
              document.getElementById('trainer-body').innerHTML = `O adversário responde com <strong>${oppMove.san}</strong>. Encontre o próximo lance vencedor!`;

              setTimeout(() => {
                chess.move({
                  from: oppUci.slice(0, 2),
                  to: oppUci.slice(2, 4),
                  promotion: oppUci.length > 4 ? oppUci[4] : 'q'
                });
                this.mistakeStepIdx += 2;
                CC.Board.playMoveObjSound(oppMove);
                this._renderMistakeBoard(puzzle);
              }, 380);
              return;
            }
          }

          // Completed!
          updatePuzzleSrs(puzzle, this.mistakeCleanTry);
          this.app.saveCurrentStore();
          this.app.updatePuzzleBadgeCount();

          document.getElementById('trainer-badge').textContent = '✅';
          document.getElementById('trainer-title').textContent = `Perfeito! ${moveAttempt.san} domina a posição!`;
          document.getElementById('trainer-body').innerHTML = `<strong style="color:#4ade80">Exercício dominado! Próxima revisão SRS em ${puzzle.srs.intervalDays} dia(s).</strong><br>${puzzle.explanation}`;
          this._renderMistakeBoard(puzzle, [{ from: moveAttempt.from, to: moveAttempt.to, color: '#22c55e' }]);
          return;
        }

        // Wrong move
        this.mistakeCleanTry = false;
        CC.Board.playSound('error');
        chess.undo();
        this.mistakeSelectedSq = null;
        document.getElementById('trainer-badge').textContent = '❌';
        document.getElementById('trainer-title').textContent = `${moveAttempt.san} não é a melhor opção`;
        document.getElementById('trainer-body').innerHTML =
          this.mistakeStepIdx === 0 && moveAttempt.san === puzzle.playedSan
            ? `Esse foi exatamente o erro <strong>${puzzle.playedSan} (${puzzle.symbol})</strong> cometido na partida! Use <strong>💡 Dica de Peça</strong> se precisar.`
            : `<strong>${moveAttempt.san}</strong> deixa vantagem escapar (melhor continuação começa com outra ideia). Tente novamente!`;
        this._renderMistakeBoard(puzzle);
      };

      if (isPromo) {
        CC.Board.askPromotionChoice(piece.color, execute);
      } else {
        execute('q');
      }
    }

    // ==================== 2. OPENING REPERTOIRE TRAINER ====================
    renderOpeningsView() {
      const sel = document.getElementById('opening-drill-select');
      if (sel && sel.options.length === 0) {
        this.openingDrills.forEach((d, idx) => {
          const opt = document.createElement('option');
          opt.value = String(idx);
          opt.textContent = `${d.eco} — ${d.name} (${d.side === 'w' ? 'Brancas' : 'Pretas'}, ${d.moves.length} lances)`;
          sel.appendChild(opt);
        });
      }
      if (!this.openingChess) {
        this.startOpeningDrill();
      } else {
        this._renderOpeningBoard();
      }
    }

    startOpeningDrill() {
      const drill = this.openingDrills[this.currentOpeningIdx];
      if (!drill) return;

      this.openingChess = new global.Chess();
      this.openingMoveIdx = 0;
      this.openingSelectedSq = null;

      document.getElementById('opening-trainer-title').textContent = `${drill.name} (${drill.eco})`;
      document.getElementById('opening-trainer-sub').textContent = `Você joga com as ${
        drill.side === 'w' ? 'Brancas ⬜' : 'Pretas ⬛'
      } • Sequência: ${drill.moves.length} lances teóricos`;
      document.getElementById('opening-trainer-feedback').innerHTML = `Jogue os lances corretos da linha teórica no tabuleiro!`;

      this._advanceOpeningOpponent();
    }

    _advanceOpeningOpponent() {
      const drill = this.openingDrills[this.currentOpeningIdx];
      if (!drill) return;

      if (this.openingMoveIdx >= drill.moves.length) {
        CC.Board.playSound('success');
        const prof = this.app.getProfile();
        if (prof) {
          prof.drillStats = prof.drillStats || { endgamesCompleted: [], openingsPracticed: {}, sparringWins: 0, sparringGames: 0 };
          prof.drillStats.openingsPracticed[drill.id] = (prof.drillStats.openingsPracticed[drill.id] || 0) + 1;
          this.app.saveCurrentStore();
        }
        document.getElementById('opening-trainer-feedback').innerHTML =
          `<strong style="color:#4ade80">🎉 Linha completa dominada!</strong> Sequência: <code>${drill.moves.join(' ')}</code>.`;
        this._renderOpeningBoard();
        return;
      }

      if (this.openingChess.turn() !== drill.side) {
        const oppSan = drill.moves[this.openingMoveIdx];
        this._renderOpeningBoard();
        setTimeout(async () => {
          const probe = new global.Chess(this.openingChess.fen());
          const previewMv = probe.move(oppSan);
          if (previewMv && CC.Board.animateMove) {
            await CC.Board.animateMove('opening-board', previewMv.from, previewMv.to, 320);
          }
          const mv = this.openingChess.move(oppSan);
          if (mv) {
            CC.Board.playMoveObjSound(mv);
            this.openingMoveIdx++;
            this._advanceOpeningOpponent();
          }
        }, 420);
      } else {
        this._renderOpeningBoard();
      }
    }

    showOpeningHint() {
      const drill = this.openingDrills[this.currentOpeningIdx];
      if (!drill || this.openingMoveIdx >= drill.moves.length) return;
      const expectedSan = drill.moves[this.openingMoveIdx];
      const probe = new global.Chess(this.openingChess.fen());
      const mv = probe.move(expectedSan);
      if (mv) {
        this._renderOpeningBoard([{ from: mv.from, to: mv.to, color: '#eab308' }]);
        document.getElementById('opening-trainer-feedback').innerHTML = `💡 <strong>Dica teórica:</strong> O lance principal aqui é <strong>${expectedSan}</strong>.`;
      }
    }

    _renderOpeningBoard(arrows = []) {
      const drill = this.openingDrills[this.currentOpeningIdx];
      const chess = this.openingChess;
      if (!drill || !chess) return;

      const legalTargets = this.openingSelectedSq
        ? chess.moves({ square: this.openingSelectedSq, verbose: true })
        : [];
      const hist = chess.history({ verbose: true });
      const last = hist.length ? hist[hist.length - 1] : null;

      CC.Board.renderChessboard({
        containerId: 'opening-board',
        overlayId: 'opening-overlay',
        fen: chess.fen(),
        flipped: drill.side === 'b',
        lastMove: last ? { from: last.from, to: last.to, isBot: last.color !== drill.side } : null,
        selectedSquare: this.openingSelectedSq,
        legalTargets,
        arrows,
        onSquareClick: (sq) => {
          if (chess.turn() !== drill.side) return;
          if (this.openingSelectedSq && this.openingSelectedSq !== sq) {
            const legal = chess.moves({ square: this.openingSelectedSq, verbose: true }).find((m) => m.to === sq);
            if (legal) {
              this._tryOpeningMove(this.openingSelectedSq, sq);
              return;
            }
          }
          const piece = chess.get(sq);
          this.openingSelectedSq = piece && piece.color === drill.side ? sq : null;
          this._renderOpeningBoard();
        },
        onPieceDrop: (from, to) => this._tryOpeningMove(from, to)
      });
    }

    _tryOpeningMove(from, to) {
      const drill = this.openingDrills[this.currentOpeningIdx];
      const chess = this.openingChess;
      if (!drill || chess.turn() !== drill.side || this.openingMoveIdx >= drill.moves.length) return;

      const mv = chess.move({ from, to, promotion: 'q' });
      if (!mv) {
        this.openingSelectedSq = null;
        this._renderOpeningBoard();
        return;
      }

      const expectedSan = drill.moves[this.openingMoveIdx];
      if (mv.san === expectedSan) {
        CC.Board.playMoveObjSound(mv);
        this.openingSelectedSq = null;
        this.openingMoveIdx++;
        document.getElementById('opening-trainer-feedback').innerHTML = `✅ <strong>${mv.san}</strong> — Correto!`;
        this._advanceOpeningOpponent();
      } else {
        CC.Board.playSound('error');
        chess.undo();
        this.openingSelectedSq = null;
        document.getElementById('opening-trainer-feedback').innerHTML = `❌ <strong>${mv.san}</strong> sai desta linha teórica. Tente outro lance ou clique em <strong>💡 Dica</strong>.`;
        this._renderOpeningBoard();
      }
    }

    // ==================== 3. GUIDED ENDGAME & TACTIC DRILLS ====================
    renderDrillsView() {
      const sel = document.getElementById('guided-drill-select');
      if (sel && sel.options.length === 0) {
        GUIDED_DRILLS.forEach((d, idx) => {
          const opt = document.createElement('option');
          opt.value = String(idx);
          opt.textContent = `[${d.category}] ${d.title}`;
          sel.appendChild(opt);
        });
      }
      if (!this.drillChess) {
        this.startGuidedDrill();
      } else {
        this._renderDrillBoard();
      }
    }

    startGuidedDrill() {
      const d = GUIDED_DRILLS[this.currentDrillIdx];
      if (!d) return;
      this.drillChess = new global.Chess(d.fen);
      this.drillSelectedSq = null;
      this.drillBusy = false;

      document.getElementById('drill-title').textContent = `${d.title} (${d.category})`;
      document.getElementById('drill-sub').textContent = d.desc;
      document.getElementById('drill-feedback').innerHTML = `Você joga de ${
        d.heroColor === 'w' ? 'Brancas ⬜' : 'Pretas ⬛'
      } contra o Stockfish Máximo. Execute seu plano!`;
      this._renderDrillBoard();
    }

    _renderDrillBoard(arrows = []) {
      const d = GUIDED_DRILLS[this.currentDrillIdx];
      const chess = this.drillChess;
      if (!d || !chess) return;

      const legalTargets = this.drillSelectedSq
        ? chess.moves({ square: this.drillSelectedSq, verbose: true })
        : [];
      const hist = chess.history({ verbose: true });
      const last = hist.length ? hist[hist.length - 1] : null;
      const isBotLast = Boolean(last && last.color !== d.heroColor);
      const boardArrows =
        arrows && arrows.length
          ? arrows
          : isBotLast
          ? [{ from: last.from, to: last.to, color: 'rgba(56, 189, 248, 0.72)' }]
          : [];

      CC.Board.renderChessboard({
        containerId: 'drill-board',
        overlayId: 'drill-overlay',
        fen: chess.fen(),
        flipped: d.heroColor === 'b',
        lastMove: last ? { from: last.from, to: last.to, isBot: isBotLast } : null,
        selectedSquare: this.drillSelectedSq,
        legalTargets,
        arrows: boardArrows,
        onSquareClick: (sq) => {
          if (this.drillBusy || chess.turn() !== d.heroColor || chess.game_over()) return;
          if (this.drillSelectedSq && this.drillSelectedSq !== sq) {
            const legal = chess.moves({ square: this.drillSelectedSq, verbose: true }).find((m) => m.to === sq);
            if (legal) {
              this._tryDrillMove(this.drillSelectedSq, sq);
              return;
            }
          }
          const piece = chess.get(sq);
          this.drillSelectedSq = piece && piece.color === d.heroColor ? sq : null;
          this._renderDrillBoard();
        },
        onPieceDrop: (from, to) => this._tryDrillMove(from, to)
      });
    }

    async _tryDrillMove(from, to) {
      const d = GUIDED_DRILLS[this.currentDrillIdx];
      const chess = this.drillChess;
      if (!d || this.drillBusy || chess.turn() !== d.heroColor || chess.game_over()) return;

      const piece = chess.get(from);
      if (!piece || piece.color !== d.heroColor) return;
      const isPromo = piece.type === 'p' && ((piece.color === 'w' && to[1] === '8') || (piece.color === 'b' && to[1] === '1'));

      const execute = async (promo) => {
        const mv = chess.move({ from, to, promotion: promo || 'q' });
        if (!mv) {
          this.drillSelectedSq = null;
          this._renderDrillBoard();
          return;
        }
        CC.Board.playMoveObjSound(mv);
        this.drillSelectedSq = null;
        this._renderDrillBoard();

        if (chess.game_over()) {
          this._handleDrillGameOver(d, chess);
          return;
        }

        // Let Stockfish reply strongly with smooth pacing & animation
        this.drillBusy = true;
        document.getElementById('drill-feedback').innerHTML = `<span class="bot-thinking-inline"><span class="bot-pulse-dot"></span> Stockfish calculando defesa...</span>`;
        const [replyUci] = await Promise.all([
          this.app.engine.playBotMove(chess.fen(), 2300),
          new Promise((r) => setTimeout(r, 450))
        ]);
        this.drillBusy = false;

        if (replyUci) {
          const fromSq = replyUci.slice(0, 2);
          const toSq = replyUci.slice(2, 4);
          if (CC.Board.animateMove) {
            await CC.Board.animateMove('drill-board', fromSq, toSq, 340);
          }
          const rm = chess.move({
            from: fromSq,
            to: toSq,
            promotion: replyUci.length > 4 ? replyUci[4] : 'q'
          });
          if (rm) {
            CC.Board.playMoveObjSound(rm);
            const pName = (CC.Analyzer && CC.Analyzer.PIECE_NAMES_PT && CC.Analyzer.PIECE_NAMES_PT[rm.piece]) || 'Peça';
            document.getElementById('drill-feedback').innerHTML = `🤖 <strong>Stockfish jogou <code>${rm.san}</code></strong> (${pName} de <code>${fromSq.toUpperCase()}</code> → <code>${toSq.toUpperCase()}</code>). Sua vez!`;
          }
        }
        this._renderDrillBoard();

        if (chess.game_over()) {
          this._handleDrillGameOver(d, chess);
        }
      };

      if (isPromo) CC.Board.askPromotionChoice(piece.color, execute);
      else execute('q');
    }

    _handleDrillGameOver(d, chess) {
      const heroWon =
        chess.in_checkmate() && chess.turn() !== d.heroColor;
      const drew = chess.in_draw() || chess.in_stalemate() || chess.in_threefold_repetition();

      const success = (d.goal === 'win' && heroWon) || (d.goal === 'draw' && (drew || heroWon));
      if (success) {
        CC.Board.playSound('success');
        const prof = this.app.getProfile();
        if (prof) {
          prof.drillStats = prof.drillStats || { endgamesCompleted: [], openingsPracticed: {}, sparringWins: 0, sparringGames: 0 };
          if (!prof.drillStats.endgamesCompleted.includes(d.id)) {
            prof.drillStats.endgamesCompleted.push(d.id);
          }
          this.app.saveCurrentStore();
        }
        document.getElementById('drill-feedback').innerHTML = `<strong style="color:#4ade80">🏆 Exercício Concluído com Sucesso!</strong>`;
      } else {
        CC.Board.playSound('error');
        document.getElementById('drill-feedback').innerHTML = `<strong style="color:#f87171">⚠️ Resultado inesperado (${
          chess.in_stalemate() ? 'Afogamento!' : 'Fim de jogo'
        }). Clique em Reiniciar e tente novamente!</strong>`;
      }
    }

    // ==================== 4. SPARRING VS COACH / STOCKFISH ====================
    getUserAccountBaseElo() {
      const prof = this.app.getProfile();
      if (prof && prof.stats) {
        const rating = prof.stats.rapid || prof.stats.blitz || prof.stats.bullet;
        if (rating && !isNaN(rating)) {
          return {
            elo: Math.max(150, Math.min(2500, Math.round(Number(rating)))),
            source: `Conta @${prof.username || prof.name} (${rating} Elo)`
          };
        }
      }
      if (prof && prof.analyzedGames) {
        const games = Object.values(prof.analyzedGames).filter((g) => !String(g.id || '').startsWith('demo-'));
        for (const g of games) {
          const r = g.heroColor === 'b' ? parseInt(g.blackRating, 10) : parseInt(g.whiteRating, 10);
          if (r && !isNaN(r) && r >= 100) {
            return {
              elo: Math.max(150, Math.min(2500, r)),
              source: `Partidas de ${prof.name} (~${r} Elo)`
            };
          }
        }
      }
      return {
        elo: 400,
        source: prof && prof.username ? `Perfil @${prof.username} (Base 400 Elo)` : 'Base Iniciante (vincule Chess.com p/ calibrar)'
      };
    }

    syncSparringEloWithProfile() {
      const { elo: baseElo, source } = this.getUserAccountBaseElo();
      const step = baseElo <= 500 ? 150 : 200;
      const belowElo = Math.max(150, baseElo - step);
      const matchElo = Math.max(150, Math.min(2500, baseElo));
      const aboveElo = Math.min(2500, baseElo + 200);

      const infoEl = document.getElementById('sparring-account-info');
      if (infoEl) infoEl.textContent = `🎯 ${source}`;

      const belowLbl = document.getElementById('tier-below-label');
      const matchLbl = document.getElementById('tier-match-label');
      const aboveLbl = document.getElementById('tier-above-label');
      if (belowLbl) belowLbl.textContent = `(~${belowElo})`;
      if (matchLbl) matchLbl.textContent = `(~${matchElo})`;
      if (aboveLbl) aboveLbl.textContent = `(~${aboveElo})`;

      if (this.sparringTier !== 'manual') {
        this.sparringElo =
          this.sparringTier === 'below' ? belowElo : this.sparringTier === 'above' ? aboveElo : matchElo;

        document.querySelectorAll('.sparring-tier-btn').forEach((btn) => {
          btn.classList.toggle('active', btn.dataset.tier === this.sparringTier);
        });

        const sel = document.getElementById('sparring-elo-select');
        if (sel) {
          let customOpt = document.getElementById('sparring-opt-adaptive');
          if (!customOpt) {
            customOpt = document.createElement('option');
            customOpt.id = 'sparring-opt-adaptive';
            sel.insertBefore(customOpt, sel.firstChild);
          }
          const tierName =
            this.sparringTier === 'below'
              ? '🟢 Facilitado'
              : this.sparringTier === 'above'
              ? '🔥 Desafio'
              : '🎯 Seu Nível';
          customOpt.value = String(this.sparringElo);
          customOpt.textContent = `${tierName} (~${this.sparringElo} Elo)`;
          sel.value = String(this.sparringElo);
        }
      }

      const activePill = document.getElementById('sparring-active-elo-pill');
      if (activePill) activePill.textContent = `~${this.sparringElo} Elo`;
    }

    startSparringFromFen(fen, heroColor = null) {
      this.syncSparringEloWithProfile();
      this.sparringStartFen = fen || new global.Chess().fen();
      this.sparringChess = new global.Chess(this.sparringStartFen);
      if (heroColor) {
        this.sparringHeroColor = heroColor;
        const colorSel = document.getElementById('sparring-color-select');
        if (colorSel) colorSel.value = heroColor;
      }
      this.sparringSelectedSq = null;
      this.sparringBusy = false;
      this.sparringMoves = [];

      document.getElementById('sparring-feedback').innerHTML = `Partida iniciada! Você joga de ${
        this.sparringHeroColor === 'w' ? 'Brancas ⬜' : 'Pretas ⬛'
      } contra Bot <strong>~${this.sparringElo} Elo</strong>.`;

      this.renderSparringBoard();
      if (this.sparringChess.turn() !== this.sparringHeroColor) {
        this._playSparringBotTurn();
      }
    }

    renderSparringBoard(arrows = []) {
      const chess = this.sparringChess;
      const legalTargets = this.sparringSelectedSq
        ? chess.moves({ square: this.sparringSelectedSq, verbose: true })
        : [];
      const hist = chess.history({ verbose: true });
      const last = hist.length ? hist[hist.length - 1] : null;
      const isBotLast = Boolean(last && last.color !== this.sparringHeroColor);
      const boardArrows =
        arrows && arrows.length
          ? arrows
          : isBotLast
          ? [{ from: last.from, to: last.to, color: 'rgba(56, 189, 248, 0.78)' }]
          : [];

      CC.Board.renderChessboard({
        containerId: 'sparring-board',
        overlayId: 'sparring-overlay',
        fen: chess.fen(),
        flipped: this.sparringHeroColor === 'b',
        lastMove: last ? { from: last.from, to: last.to, isBot: isBotLast } : null,
        selectedSquare: this.sparringSelectedSq,
        legalTargets,
        arrows: boardArrows,
        onSquareClick: (sq) => {
          if (this.sparringBusy || chess.turn() !== this.sparringHeroColor || chess.game_over()) return;
          if (this.sparringSelectedSq && this.sparringSelectedSq !== sq) {
            const legal = chess.moves({ square: this.sparringSelectedSq, verbose: true }).find((m) => m.to === sq);
            if (legal) {
              this._trySparringMove(this.sparringSelectedSq, sq);
              return;
            }
          }
          const piece = chess.get(sq);
          this.sparringSelectedSq = piece && piece.color === this.sparringHeroColor ? sq : null;
          this.renderSparringBoard();
        },
        onPieceDrop: (from, to) => this._trySparringMove(from, to)
      });

      const histBox = document.getElementById('sparring-moves-log');
      if (histBox) {
        histBox.textContent = hist.map((m, i) => (i % 2 === 0 ? `${Math.floor(i / 2) + 1}.${m.san}` : m.san)).join(' ') || 'Nenhum lance ainda.';
      }
    }

    async _trySparringMove(from, to) {
      const chess = this.sparringChess;
      if (this.sparringBusy || chess.turn() !== this.sparringHeroColor || chess.game_over()) return;

      const piece = chess.get(from);
      if (!piece || piece.color !== this.sparringHeroColor) return;
      const isPromo = piece.type === 'p' && ((piece.color === 'w' && to[1] === '8') || (piece.color === 'b' && to[1] === '1'));

      const execute = async (promo) => {
        const fenBefore = chess.fen();
        const mv = chess.move({ from, to, promotion: promo || 'q' });
        if (!mv) {
          this.sparringSelectedSq = null;
          this.renderSparringBoard();
          return;
        }

        // Coach Guard: warn player before letting a major blunder happen!
        if (this.sparringCoachGuard && !chess.game_over()) {
          this.sparringBusy = true;
          const [evalBefore, evalAfter] = await Promise.all([
            this.app.engine.evaluateFen(fenBefore, { depth: 8, movetimeMs: 650, tag: 'sparring' }),
            this.app.engine.evaluateFen(chess.fen(), { depth: 8, movetimeMs: 650, tag: 'sparring' })
          ]);
          this.sparringBusy = false;
          const pBefore = this.sparringHeroColor === 'w' ? evalBefore.cp : -evalBefore.cp;
          const pAfter = this.sparringHeroColor === 'w' ? evalAfter.cp : -evalAfter.cp;

          if (pBefore - pAfter >= 165 && evalBefore.bestMoveUci && evalBefore.bestMoveUci !== from + to + (promo || '')) {
            CC.Board.playSound('error');
            chess.undo();
            this.sparringSelectedSq = null;
            const bestSan = CC.Analyzer.uciToSan(fenBefore, evalBefore.bestMoveUci);
            document.getElementById('sparring-feedback').innerHTML = `🛡️ <strong>Alerta do Coach:</strong> <strong>${mv.san}</strong> perderia cerca de <strong>${(
              (pBefore - pAfter) /
              100
            ).toFixed(1)} peões</strong>! Tente outra jogada (dica: considere algo como <strong>${bestSan}</strong>).`;
            this.renderSparringBoard([{ from: evalBefore.bestMoveUci.slice(0, 2), to: evalBefore.bestMoveUci.slice(2, 4), color: 'rgba(234,179,8,0.65)' }]);
            return;
          }
        }

        CC.Board.playMoveObjSound(mv);
        this.sparringSelectedSq = null;
        this.sparringMoves.push(mv.san);
        this.renderSparringBoard();

        if (chess.game_over()) {
          this._finishSparringGame();
          return;
        }

        await this._playSparringBotTurn();
      };

      if (isPromo) CC.Board.askPromotionChoice(piece.color, execute);
      else execute('q');
    }

    async _playSparringBotTurn() {
      const chess = this.sparringChess;
      if (chess.game_over()) return;
      this.sparringBusy = true;
      document.getElementById('sparring-feedback').innerHTML = `<span class="bot-thinking-inline"><span class="bot-pulse-dot"></span> 🤖 Bot (~${this.sparringElo} Elo) pensando no lance...</span>`;

      // Ensure a comfortable minimum visual pause (480ms) so the player clearly sees their own move before the bot glides
      const [uci] = await Promise.all([
        this.app.engine.playBotMove(chess.fen(), this.sparringElo),
        new Promise((r) => setTimeout(r, 480))
      ]);
      this.sparringBusy = false;

      if (uci) {
        const fromSq = uci.slice(0, 2);
        const toSq = uci.slice(2, 4);
        if (CC.Board.animateMove) {
          await CC.Board.animateMove('sparring-board', fromSq, toSq, 360);
        }
        const mv = chess.move({
          from: fromSq,
          to: toSq,
          promotion: uci.length > 4 ? uci[4] : 'q'
        });
        if (mv) {
          CC.Board.playMoveObjSound(mv);
          this.sparringMoves.push(mv.san);
          const pName = (CC.Analyzer && CC.Analyzer.PIECE_NAMES_PT && CC.Analyzer.PIECE_NAMES_PT[mv.piece]) || 'Peça';
          document.getElementById('sparring-feedback').innerHTML = `🤖 <strong>Lance do Bot (~${this.sparringElo} Elo):</strong> moveu <strong>${pName}</strong> de <code>${fromSq.toUpperCase()}</code> → <code>${toSq.toUpperCase()}</code> (<strong>${mv.san}</strong>). Sua vez!`;
        }
      }
      this.renderSparringBoard();

      if (chess.game_over()) {
        this._finishSparringGame();
      }
    }

    _finishSparringGame() {
      const chess = this.sparringChess;
      let msg = 'Empate!';
      const won = chess.in_checkmate() && chess.turn() !== this.sparringHeroColor;
      if (won) {
        CC.Board.playSound('success');
        msg = '🏆 Vitória! Você derrotou o Bot!';
      } else if (chess.in_checkmate()) {
        CC.Board.playSound('error');
        msg = 'Derrota por xeque-mate. Que tal analisar esta partida?';
      }

      const prof = this.app.getProfile();
      if (prof) {
        prof.drillStats = prof.drillStats || { endgamesCompleted: [], openingsPracticed: {}, sparringWins: 0, sparringGames: 0 };
        prof.drillStats.sparringGames++;
        if (won) prof.drillStats.sparringWins++;
        this.app.saveCurrentStore();
      }
      document.getElementById('sparring-feedback').innerHTML = `<strong>${msg}</strong>`;
    }
  }

  CC.GUIDED_DRILLS = GUIDED_DRILLS;
  CC.AcademyController = AcademyController;
})(window);
