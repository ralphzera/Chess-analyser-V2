/* ============================================================================
 * ChessCoach Pro — Stockfish UCI Engine Manager v2
 * Supports:
 *  - Serialized command queue (no race conditions between Analysis, Sandbox, Sparring)
 *  - MultiPV 1..3 candidate lines
 *  - Hash table caching across moves (ucinewgame per game)
 *  - Skill Level (0..20) + human-like low-Elo Sparring presets
 *  - Improved alpha-beta offline fallback (only if WebWorker cannot start)
 * ============================================================================ */
(function (global) {
  'use strict';

  const CC = (global.ChessCoach = global.ChessCoach || {});

  function mateToCp(mate) {
    if (mate === 0) return -10000;
    return mate > 0 ? 10000 - Math.min(99, mate) * 10 : -10000 + Math.min(99, Math.abs(mate)) * 10;
  }

  class StockfishEngine {
    constructor() {
      this.worker = null;
      this.isReady = false;
      this.useFallback = false;
      this.initPromise = null;

      this._queue = [];
      this._busy = false;
      this._activeTask = null;
      this._currentOptions = { multiPv: 1, skillLevel: 20, hash: 16 };
      this._tagEpoch = new Map();

      this.initPromise = this._init();
    }

    _updateStatusUI(ready, title, sub) {
      const dot = document.getElementById('engine-dot');
      const nameEl = document.getElementById('engine-name');
      const subEl = document.getElementById('engine-sub');
      if (dot) dot.classList.toggle('ready', ready);
      if (nameEl) nameEl.textContent = title;
      if (subEl) subEl.textContent = sub;
    }

    _init() {
      return new Promise((resolve) => {
        try {
          if (global.STOCKFISH_WORKER_CODE) {
            const blob = new Blob([global.STOCKFISH_WORKER_CODE], { type: 'application/javascript' });
            this.worker = new Worker(URL.createObjectURL(blob));
          } else {
            this.worker = new Worker('/api/stockfish.js');
          }

          this.bootError = null;
          let bootStep = 'uci';
          const bootTimer = setTimeout(() => {
            if (!this.isReady) {
              this.bootError = 'timeout';
              this._enableFallback();
              resolve(false);
            }
          }, 12000);

          this.worker.onmessage = (e) => {
            const line = typeof e.data === 'string' ? e.data.trim() : '';
            if (!line) return;

            if (!this.isReady) {
              if (line === 'uciok' && bootStep === 'uci') {
                bootStep = 'ready';
                this.worker.postMessage('setoption name Hash value 16');
                this.worker.postMessage('setoption name Contempt value 0');
                this.worker.postMessage('setoption name Analysis Contempt value Off');
                this.worker.postMessage('setoption name Skill Level value 20');
                this.worker.postMessage('setoption name MultiPV value 1');
                this.worker.postMessage('isready');
                return;
              }
              if (line === 'readyok') {
                this.isReady = true;
                clearTimeout(bootTimer);
                this._updateStatusUI(true, 'Stockfish 10 WASM/JS', 'MultiPV + Hash ativo');
                resolve(true);
                return;
              }
            }

            this._handleMessage(line);
          };

          this.worker.onerror = (ev) => {
            clearTimeout(bootTimer);
            this.bootError = ev?.message || 'worker error';
            this._enableFallback();
            resolve(false);
          };

          this.worker.postMessage('uci');
        } catch (err) {
          this.bootError = err?.message || String(err);
          this._enableFallback();
          resolve(false);
        }
      });
    }

    _enableFallback() {
      this.useFallback = true;
      this.isReady = true;
      this._updateStatusUI(true, 'Engine Tática Local', 'Fallback Alpha-Beta ativo');
    }

    _handleMessage(line) {
      const task = this._activeTask;
      if (!task) return;

      if (task.type === 'ready' && line === 'readyok') {
        this._finishActiveTask(true);
        return;
      }

      if (task.type === 'search') {
        if (line.startsWith('info ') && line.includes(' score ')) {
          const depthMatch = line.match(/\bdepth (\d+)/);
          const mpvMatch = line.match(/\bmultipv (\d+)/);
          const cpMatch = line.match(/\bscore cp (-?\d+)/);
          const mateMatch = line.match(/\bscore mate (-?\d+)/);
          const pvMatch = line.match(/\bpv (.+)$/);

          const depth = depthMatch ? parseInt(depthMatch[1], 10) : 0;
          const mpv = mpvMatch ? parseInt(mpvMatch[1], 10) : 1;

          let cp = 0;
          let mate = null;
          if (cpMatch) {
            cp = parseInt(cpMatch[1], 10);
          } else if (mateMatch) {
            mate = parseInt(mateMatch[1], 10);
            cp = mateToCp(mate);
          }

          const pv = pvMatch
            ? pvMatch[1]
                .trim()
                .split(/\s+/)
                .filter((m) => m && m !== '(none)')
            : [];

          const prev = task.slots.get(mpv);
          const isBound = line.includes(' upperbound') || line.includes(' lowerbound');
          // Ignore aspiration-window fail-low/fail-high bound noise once we have an exact score for this PV
          if (isBound && prev && !prev.isBound) {
            return;
          }
          if (!prev || depth > prev.depth || (prev.isBound && !isBound) || (depth === prev.depth && pv.length >= prev.pv.length)) {
            task.slots.set(mpv, {
              multipv: mpv,
              depth,
              cp,
              mate,
              pv,
              isBound,
              bestMoveUci: pv[0] || (prev ? prev.bestMoveUci : null)
            });
          }

          if (depth === 0 && line.includes('score mate 0')) {
            this._finishSearchTask(null);
            return;
          }
        }

        if (line.startsWith('bestmove ')) {
          const parts = line.split(/\s+/);
          const bestMoveUci = parts[1] && parts[1] !== '(none)' ? parts[1] : null;
          this._finishSearchTask(bestMoveUci);
        }
      }
    }

    _finishActiveTask(result) {
      const task = this._activeTask;
      if (!task) return;
      if (task.timer) {
        clearTimeout(task.timer);
        task.timer = null;
      }
      if (task.graceTimer) {
        clearTimeout(task.graceTimer);
        task.graceTimer = null;
      }
      this._activeTask = null;
      this._busy = false;
      task.resolve(result);
      this._pump();
    }

    _finishSearchTask(bestMoveUci) {
      const task = this._activeTask;
      if (!task) return;
      if (task.aborted) {
        this._finishActiveTask({ aborted: true, bestMoveUci: null, cp: 0, mate: null, pv: [], lines: [] });
        return;
      }
      const turn = task.turn;

      // Sort MultiPV lines 1..N
      const rawLines = Array.from(task.slots.values()).sort((a, b) => a.multipv - b.multipv);

      const normalizeLine = (entry) => ({
        multipv: entry.multipv,
        depth: entry.depth,
        cp: turn === 'w' ? entry.cp : -entry.cp,
        mate: entry.mate !== null ? (turn === 'w' ? entry.mate : -entry.mate) : null,
        sideCp: entry.cp,
        sideMate: entry.mate,
        pv: entry.pv || [],
        bestMoveUci: entry.bestMoveUci || (entry.pv && entry.pv[0]) || null
      });

      const lines = rawLines.map(normalizeLine);

      // Ensure line #1 matches bestmove if Stockfish gave bestmove without pv line
      if (lines.length === 0) {
        const fb = this.fallbackEvaluate(task.fen, turn);
        this._finishActiveTask({
          bestMoveUci: bestMoveUci || fb.bestMoveUci,
          cp: fb.cp,
          mate: fb.mate,
          pv: bestMoveUci ? [bestMoveUci] : fb.pv,
          depthReached: 2,
          lines: [
            {
              multipv: 1,
              depth: 2,
              cp: fb.cp,
              mate: fb.mate,
              pv: bestMoveUci ? [bestMoveUci] : fb.pv,
              bestMoveUci: bestMoveUci || fb.bestMoveUci
            }
          ]
        });
        return;
      }

      if (bestMoveUci && lines[0] && !lines[0].bestMoveUci) {
        lines[0].bestMoveUci = bestMoveUci;
        if (!lines[0].pv.length) lines[0].pv = [bestMoveUci];
      }

      const primary = lines[0];
      this._finishActiveTask({
        bestMoveUci: bestMoveUci || primary.bestMoveUci,
        cp: primary.cp,
        mate: primary.mate,
        pv: primary.pv,
        depthReached: primary.depth,
        lines
      });
    }

    _enqueue(job) {
      return new Promise((resolve) => {
        const epoch = job.tag ? (this._tagEpoch.get(job.tag) || 0) : 0;
        this._queue.push({ ...job, epoch, resolve });
        this._pump();
      });
    }

    _pump() {
      if (this._busy || this._queue.length === 0) return;
      const job = this._queue.shift();

      if (job.tag && job.epoch < (this._tagEpoch.get(job.tag) || 0)) {
        job.resolve({ aborted: true, bestMoveUci: null, cp: 0, mate: null, pv: [], lines: [] });
        this._pump();
        return;
      }

      this._busy = true;

      if (job.kind === 'newgame') {
        if (!this.useFallback && this.worker) {
          this.worker.postMessage('ucinewgame');
          this._activeTask = {
            type: 'ready',
            resolve: job.resolve,
            timer: setTimeout(() => this._finishActiveTask(true), 1500)
          };
          this.worker.postMessage('isready');
        } else {
          this._busy = false;
          job.resolve(true);
          this._pump();
        }
        return;
      }

      if (job.kind === 'search') {
        const { fen, depth = 12, movetimeMs = null, multiPv = 1, skillLevel = 20 } = job;
        const turn = fen.split(' ')[1] || 'w';

        // Handle terminal positions immediately (prevents Stockfish 10 hang on 0 moves)
        const checkGame = new global.Chess(fen);
        if (checkGame.moves().length === 0) {
          const inMate = checkGame.in_checkmate();
          const cp = inMate ? (turn === 'w' ? -10000 : 10000) : 0;
          const mate = inMate ? (turn === 'w' ? -1 : 1) : null;
          this._busy = false;
          job.resolve({
            bestMoveUci: null,
            cp,
            mate,
            pv: [],
            depthReached: 0,
            lines: [{ multipv: 1, depth: 0, cp, mate, pv: [], bestMoveUci: null }]
          });
          this._pump();
          return;
        }

        if (this.useFallback || !this.worker || !this.isReady) {
          const fb = this.fallbackEvaluate(fen, turn);
          this._busy = false;
          job.resolve({
            ...fb,
            depthReached: 2,
            lines: [{ multipv: 1, depth: 2, cp: fb.cp, mate: fb.mate, pv: fb.pv, bestMoveUci: fb.bestMoveUci }]
          });
          this._pump();
          return;
        }

        // Update UCI options only when changed
        if (this._currentOptions.multiPv !== multiPv) {
          this.worker.postMessage(`setoption name MultiPV value ${multiPv}`);
          this._currentOptions.multiPv = multiPv;
        }
        if (this._currentOptions.skillLevel !== skillLevel) {
          this.worker.postMessage(`setoption name Skill Level value ${skillLevel}`);
          this._currentOptions.skillLevel = skillLevel;
        }

        const softCapMs = movetimeMs || Math.max(2500, depth * 450);

        const task = {
          type: 'search',
          fen,
          turn,
          tag: job.tag || null,
          aborted: false,
          slots: new Map(),
          resolve: job.resolve,
          graceTimer: null,
          timer: null
        };
        task.timer = setTimeout(() => {
          if (this._activeTask !== task) return;
          try {
            this.worker.postMessage('stop');
          } catch (_) {}
          // Give Stockfish 200ms to emit final bestmove from deepest depth already searched
          task.graceTimer = setTimeout(() => {
            if (this._activeTask === task) {
              const topSlot = task.slots.get(1);
              const best = topSlot ? topSlot.bestMoveUci : null;
              this._finishSearchTask(best);
            }
          }, 200);
        }, softCapMs);

        this._activeTask = task;

        this.worker.postMessage(`position fen ${fen}`);
        if (job.exactMovetime && movetimeMs) {
          this.worker.postMessage(`go movetime ${movetimeMs}`);
        } else {
          this.worker.postMessage(`go depth ${depth}`);
        }
      }
    }

    async ensureReady() {
      await this.initPromise;
    }

    async newGame() {
      await this.ensureReady();
      return this._enqueue({ kind: 'newgame' });
    }

    abortTag(tag) {
      if (!tag) return;
      this._tagEpoch.set(tag, (this._tagEpoch.get(tag) || 0) + 1);
      const kept = [];
      for (const j of this._queue) {
        if (j.tag === tag) {
          j.resolve({ aborted: true, bestMoveUci: null, cp: 0, mate: null, pv: [], lines: [] });
        } else {
          kept.push(j);
        }
      }
      this._queue = kept;
      if (this._activeTask && this._activeTask.type === 'search' && this._activeTask.tag === tag) {
        this._activeTask.aborted = true;
        try {
          this.worker.postMessage('stop');
        } catch (_) {}
      }
    }

    async evaluateFen(fen, opts = {}) {
      await this.ensureReady();
      // Backward compatibility if second arg is a number (depth)
      const options = typeof opts === 'number' ? { depth: opts } : opts;
      return this._enqueue({
        kind: 'search',
        fen,
        depth: options.depth || 12,
        movetimeMs: options.movetimeMs || null,
        exactMovetime: Boolean(options.exactMovetime),
        multiPv: options.multiPv || 1,
        skillLevel: options.skillLevel !== undefined ? options.skillLevel : 20,
        tag: options.tag || null
      });
    }

    // Play a sparring bot move calibrated to approximate Elo preset
    async playBotMove(fen, eloPreset = 1200) {
      await this.ensureReady();
      const chess = new global.Chess(fen);
      const legal = chess.moves({ verbose: true });
      if (!legal.length) return null;
      if (legal.length === 1) return legal[0].from + legal[0].to + (legal[0].promotion || '');

      // Map Elo to Stockfish Skill Level (0..20) + MultiPV candidate pool for low Elos
      let skillLevel = 20;
      let depth = 10;
      let multiPv = 1;
      let maxDropCp = 0;

      if (eloPreset <= 500) {
        skillLevel = 0;
        depth = 4;
        multiPv = 4;
        maxDropCp = 260;
      } else if (eloPreset <= 900) {
        skillLevel = 2;
        depth = 6;
        multiPv = 3;
        maxDropCp = 140;
      } else if (eloPreset <= 1300) {
        skillLevel = 6;
        depth = 8;
        multiPv = 2;
        maxDropCp = 65;
      } else if (eloPreset <= 1750) {
        skillLevel = 12;
        depth = 10;
        multiPv = 1;
      } else if (eloPreset <= 2150) {
        skillLevel = 17;
        depth = 12;
        multiPv = 1;
      } else {
        skillLevel = 20;
        depth = 13;
        multiPv = 1;
      }

      const res = await this.evaluateFen(fen, {
        depth,
        movetimeMs: 1400,
        multiPv,
        skillLevel,
        tag: 'sparring'
      });

      if (multiPv > 1 && res.lines && res.lines.length > 1) {
        const bestSideCp = res.lines[0].sideCp;
        const pool = res.lines.filter((l) => bestSideCp - l.sideCp <= maxDropCp && l.bestMoveUci);
        if (pool.length > 1) {
          // Weighted random pick favoring stronger lines slightly less at beginner level
          const r = Math.random();
          if (eloPreset <= 550 && r < 0.55) {
            return pool[Math.min(pool.length - 1, Math.floor(Math.random() * pool.length))].bestMoveUci;
          }
          if (eloPreset <= 1250 && r < 0.35) {
            return pool[1].bestMoveUci;
          }
        }
      }

      return res.bestMoveUci || (legal[0].from + legal[0].to + (legal[0].promotion || ''));
    }

    // Improved alpha-beta depth-2 evaluator if WebWorker fails to load
    fallbackEvaluate(fen, turn) {
      const chess = new global.Chess(fen);
      const values = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };

      const evalBoard = (game) => {
        if (game.in_checkmate()) return game.turn() === 'w' ? -10000 : 10000;
        if (game.in_draw()) return 0;
        const b = game.board();
        let score = 0;
        for (let r = 0; r < 8; r++) {
          for (let c = 0; c < 8; c++) {
            const p = b[r][c];
            if (!p) continue;
            const centerBonus = (3.5 - Math.abs(3.5 - r)) * 6 + (3.5 - Math.abs(3.5 - c)) * 6;
            const v = values[p.type] + (p.type !== 'k' ? centerBonus : 0);
            score += p.color === 'w' ? v : -v;
          }
        }
        return score;
      };

      const moves = chess.moves({ verbose: true });
      if (!moves.length) {
        return {
          bestMoveUci: null,
          cp: evalBoard(chess),
          mate: chess.in_checkmate() ? (turn === 'w' ? -1 : 1) : null,
          pv: []
        };
      }

      // Order captures first for better alpha-beta pruning
      moves.sort((a, b) => (b.captured ? 1 : 0) - (a.captured ? 1 : 0));

      let bestMove = moves[0];
      let bestScore = turn === 'w' ? -Infinity : Infinity;

      for (const m of moves) {
        chess.move(m);
        const oppMoves = chess.moves({ verbose: true });
        oppMoves.sort((a, b) => (b.captured ? 1 : 0) - (a.captured ? 1 : 0));

        let replyScore = evalBoard(chess);
        if (oppMoves.length > 0) {
          for (const om of oppMoves.slice(0, 16)) {
            chess.move(om);
            const s = evalBoard(chess);
            if (turn === 'w') replyScore = Math.min(replyScore, s);
            else replyScore = Math.max(replyScore, s);
            chess.undo();
          }
        }
        chess.undo();

        if (turn === 'w' && replyScore > bestScore) {
          bestScore = replyScore;
          bestMove = m;
        } else if (turn === 'b' && replyScore < bestScore) {
          bestScore = replyScore;
          bestMove = m;
        }
      }

      const uci = bestMove.from + bestMove.to + (bestMove.promotion || '');
      return { bestMoveUci: uci, cp: Math.round(bestScore), mate: null, pv: [uci] };
    }
  }

  CC.StockfishEngine = StockfishEngine;
})(window);
