/* ============================================================================
 * ChessCoach Pro — Precision Move Classifier, Clock & Tactical Theme Analyzer
 * ============================================================================ */
(function (global) {
  'use strict';

  const CC = (global.ChessCoach = global.ChessCoach || {});

  const PIECE_WEIGHTS = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 99 };
  const PIECE_NAMES_PT = {
    p: 'peão',
    n: 'cavalo',
    b: 'bispo',
    r: 'torre',
    q: 'dama',
    k: 'rei'
  };

  const THEME_LABELS = {
    peca_pendurada: 'Peça Pendurada',
    captura_perdida: 'Captura Perdida',
    garfo: 'Garfo / Ataque Duplo',
    mate_perdido: 'Mate Perdido',
    mate_permitido: 'Mate Permitido',
    seguranca_rei: 'Segurança do Rei',
    vitoria_perdida: 'Vitória Perdida',
    abertura: 'Teoria de Abertura',
    final: 'Técnica de Final',
    apuro_tempo: 'Apuro de Tempo',
    lance_apressado: 'Erro Apressado (<3s)',
    posicional: 'Erro Posicional'
  };

  function cpToWinProb(cp) {
    const clamped = Math.max(-4000, Math.min(4000, cp));
    return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * clamped)) - 1);
  }

  function computeMoveAccuracy(effectiveLoss) {
    if (effectiveLoss <= 0) return 100;
    const raw = 103.1668 * Math.exp(-0.04354 * effectiveLoss) - 3.1669;
    return Math.max(0, Math.min(100, Number(raw.toFixed(1))));
  }

  function computeGameAccuracy(moveAccs) {
    if (!moveAccs || !moveAccs.length) return 0;
    const arithMean = moveAccs.reduce((a, b) => a + b, 0) / moveAccs.length;
    const safeAccs = moveAccs.map((a) => Math.max(15, a));
    const harmMean = safeAccs.length / safeAccs.reduce((acc, v) => acc + 1 / v, 0);
    const combined = 0.45 * harmMean + 0.55 * arithMean;
    return Number(Math.max(8, Math.min(100, combined)).toFixed(1));
  }

  function getMaterialPoints(fen, color) {
    const weights = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
    const boardPart = fen.split(' ')[0];
    let total = 0;
    for (const ch of boardPart) {
      const lower = ch.toLowerCase();
      if (weights[lower] !== undefined) {
        const isWhite = ch === ch.toUpperCase();
        if ((color === 'w' && isWhite) || (color === 'b' && !isWhite)) {
          total += weights[lower];
        }
      }
    }
    return total;
  }

  function getGamePhase(ply, fen) {
    if (ply <= 18) return 'Abertura';
    const boardPart = fen.split(' ')[0];
    const pieces = boardPart.replace(/[^qrbnQRBN]/g, '').length;
    if (pieces <= 6 || ply >= 66) return 'Final';
    return 'Meio-Jogo';
  }

  // Approximate Static Exchange Evaluation (SEE) on a target square using legal captures
  function estimateSquareExchangeLoss(fen, targetSq, heroColor) {
    const sim = new global.Chess(fen);
    if (sim.turn() === heroColor) return 0;

    let heroLoss = 0;
    let maxHeroDrop = 0;

    for (let ply = 0; ply < 6; ply++) {
      const moves = sim
        .moves({ verbose: true })
        .filter((m) => m.to === targetSq && m.captured);
      if (!moves.length) break;

      // Pick lowest-value attacker
      moves.sort((a, b) => (PIECE_WEIGHTS[a.piece] || 1) - (PIECE_WEIGHTS[b.piece] || 1));
      const chosen = moves[0];
      const capVal = PIECE_WEIGHTS[chosen.captured] || 1;

      if (chosen.color !== heroColor) {
        heroLoss += capVal;
        maxHeroDrop = Math.max(maxHeroDrop, heroLoss);
      } else {
        heroLoss -= capVal;
        // Hero can stop recapturing if exchange turns negative, so don't force worsening
      }
      sim.move(chosen);
    }

    return Math.max(0, heroLoss);
  }

  // True Brilliant (!!) detection: checks net material sacrifice rather than equal trades like Bxf6
  function detectTrueSacrifice(fenBefore, fenAfter, moveObj) {
    if (!moveObj || !moveObj.to) return false;
    const heroColor = moveObj.color;
    const capturedVal = moveObj.captured ? PIECE_WEIGHTS[moveObj.captured] || 1 : 0;
    const movedVal = PIECE_WEIGHTS[moveObj.piece] || 1;

    // 1. Check SEE on the destination square
    const destLoss = estimateSquareExchangeLoss(fenAfter, moveObj.to, heroColor);
    const netDestSac = destLoss - capturedVal;
    if (movedVal >= 3 && netDestSac >= 1.8) {
      return true;
    }

    // 2. Check if another valuable hero piece (N/B/R/Q) was left newly hanging as a tactical decoy/sacrifice
    const afterChess = new global.Chess(fenAfter);
    const oppCaptures = afterChess
      .moves({ verbose: true })
      .filter((m) => m.captured && PIECE_WEIGHTS[m.captured] >= 3 && m.to !== moveObj.to);

    for (const cap of oppCaptures) {
      const lossAfter = estimateSquareExchangeLoss(fenAfter, cap.to, heroColor);
      if (lossAfter >= 2.5) {
        // Make sure it wasn't simply an unavoidable piece already hanging identically before
        const simBeforeOpp = fenBefore.split(' ');
        simBeforeOpp[1] = heroColor === 'w' ? 'b' : 'w';
        simBeforeOpp[3] = '-';
        try {
          const lossBefore = estimateSquareExchangeLoss(simBeforeOpp.join(' '), cap.to, heroColor);
          if (lossAfter > lossBefore + 0.5) return true;
        } catch (_) {
          return true;
        }
      }
    }

    return false;
  }

  function uciToMoveObj(fen, uciMove) {
    if (!uciMove || uciMove.length < 4) return null;
    const temp = new global.Chess(fen);
    return temp.move({
      from: uciMove.slice(0, 2),
      to: uciMove.slice(2, 4),
      promotion: uciMove.length > 4 ? uciMove[4] : 'q'
    });
  }

  function uciToSan(fen, uciMove) {
    if (!uciMove || uciMove.length < 4) return uciMove || '—';
    const m = uciToMoveObj(fen, uciMove);
    return m ? m.san : uciMove;
  }

  function uciPvToSanLine(fen, pvArray, maxPlies = 6) {
    if (!Array.isArray(pvArray) || !pvArray.length) return '';
    const temp = new global.Chess(fen);
    const sanMoves = [];
    for (let i = 0; i < Math.min(pvArray.length, maxPlies); i++) {
      const uci = pvArray[i];
      if (!uci || uci.length < 4) break;
      const m = temp.move({
        from: uci.slice(0, 2),
        to: uci.slice(2, 4),
        promotion: uci.length > 4 ? uci[4] : 'q'
      });
      if (!m) break;
      sanMoves.push(m.san);
    }
    return sanMoves.join(' → ');
  }

  // Count how many valuable opponent pieces (>= N/B/R/Q or K) are attacked by the moved piece after a move
  function isForkMove(fenBefore, uciMove) {
    if (!uciMove || uciMove.length < 4) return false;
    const g = new global.Chess(fenBefore);
    const mv = g.move({
      from: uciMove.slice(0, 2),
      to: uciMove.slice(2, 4),
      promotion: uciMove.length > 4 ? uciMove[4] : 'q'
    });
    if (!mv) return false;

    const attackerColor = mv.color;
    const targetColor = attackerColor === 'w' ? 'b' : 'w';
    // Flip turn back to attackerColor to inspect squares attacked from mv.to
    const parts = g.fen().split(' ');
    parts[1] = attackerColor;
    parts[3] = '-';
    try {
      const probe = new global.Chess(parts.join(' '));
      const attacks = probe.moves({ square: mv.to, verbose: true });
      const attackedTargets = new Set();
      attacks.forEach((a) => {
        if (a.captured) {
          const piece = probe.get(a.to);
          if (piece && piece.color === targetColor && PIECE_WEIGHTS[piece.type] >= 3) {
            attackedTargets.add(a.to);
          }
        }
      });
      // Include check if the move itself gave check
      if (mv.san.includes('+')) attackedTargets.add('KING');
      return attackedTargets.size >= 2;
    } catch (_) {
      return false;
    }
  }

  function detectTacticalThemes({
    fenBefore,
    fenAfter,
    moveObj,
    bestUci,
    bestSan,
    oppBestUci,
    cpBefore,
    cpAfter,
    mateBefore,
    mateAfter,
    classificationType,
    phase,
    isTimeTrouble,
    isRushedError
  }) {
    const themes = [];
    const color = moveObj.color;
    const playerCpBefore = color === 'w' ? cpBefore : -cpBefore;
    const playerCpAfter = color === 'w' ? cpAfter : -cpAfter;
    const playerMateBefore = mateBefore !== null && mateBefore !== undefined ? (color === 'w' ? mateBefore : -mateBefore) : null;
    const playerMateAfter = mateAfter !== null && mateAfter !== undefined ? (color === 'w' ? mateAfter : -mateAfter) : null;

    const isError = ['inaccuracy', 'mistake', 'blunder', 'miss'].includes(classificationType);

    if (isError) {
      if (playerMateBefore !== null && playerMateBefore > 0 && (playerMateAfter === null || playerMateAfter <= 0)) {
        themes.push('mate_perdido');
      }
      if (playerMateAfter !== null && playerMateAfter < 0 && (playerMateBefore === null || playerMateBefore >= 0)) {
        themes.push('mate_permitido');
      }
      if (classificationType === 'miss') {
        themes.push('vitoria_perdida');
      }

      // Check if opponent's top reply captures a hanging piece or forks
      if (oppBestUci) {
        const oppMove = uciToMoveObj(fenAfter, oppBestUci);
        if (oppMove && oppMove.captured && PIECE_WEIGHTS[oppMove.captured] >= 3) {
          themes.push('peca_pendurada');
        }
        if (isForkMove(fenAfter, oppBestUci)) {
          themes.push('garfo');
        }
      }

      // Check if player missed a fork or winning capture
      if (bestUci && bestUci !== moveObj.from + moveObj.to + (moveObj.promotion || '')) {
        if (isForkMove(fenBefore, bestUci)) {
          if (!themes.includes('garfo')) themes.push('garfo');
        }
        if (bestSan && bestSan.includes('x') && !moveObj.san.includes('x') && playerCpBefore - playerCpAfter >= 90) {
          themes.push('captura_perdida');
        }
      }

      if (moveObj.san.startsWith('K') || bestSan === 'O-O' || bestSan === 'O-O-O') {
        themes.push('seguranca_rei');
      }

      if (isTimeTrouble) themes.push('apuro_tempo');
      if (isRushedError) themes.push('lance_apressado');

      if (!themes.length) {
        if (phase === 'Abertura') themes.push('abertura');
        else if (phase === 'Final') themes.push('final');
        else themes.push('posicional');
      }
    }

    return themes;
  }

  function classifyMoveV2({
    ply,
    fenBefore,
    fenAfter,
    moveObj,
    evalBefore,
    evalAfter
  }) {
    const color = moveObj.color;
    const playedUci = moveObj.from + moveObj.to + (moveObj.promotion || '');
    const lines = evalBefore.lines || [];
    const bestLine = lines[0] || {
      cp: evalBefore.cp,
      mate: evalBefore.mate,
      bestMoveUci: evalBefore.bestMoveUci
    };
    const secondLine = lines[1] || null;

    const bestUci = bestLine.bestMoveUci || evalBefore.bestMoveUci || playedUci;
    const isBestMove = playedUci === bestUci;

    // Check if played move is inside MultiPV top 3 for apples-to-apples comparison
    const matchingLine = lines.find((l) => l.bestMoveUci === playedUci) || null;

    const cpBefore = bestLine.cp;
    // Use matching MultiPV line if available at the same search depth to avoid horizon noise
    const cpAfterForLoss = matchingLine ? matchingLine.cp : evalAfter.cp;
    const cpAfter = evalAfter.cp;

    const playerCpBefore = color === 'w' ? cpBefore : -cpBefore;
    const playerCpAfter = color === 'w' ? cpAfterForLoss : -cpAfterForLoss;
    const playerCpActualAfter = color === 'w' ? cpAfter : -cpAfter;

    const playerWinBefore = cpToWinProb(playerCpBefore);
    const playerWinAfter = cpToWinProb(playerCpAfter);
    const winLoss = isBestMove ? 0 : Math.max(0, playerWinBefore - playerWinAfter);
    const winGain = playerWinAfter - playerWinBefore;
    const cpDrop = isBestMove ? 0 : Math.max(0, playerCpBefore - playerCpAfter);

    const playerMateBefore =
      bestLine.mate !== null && bestLine.mate !== undefined
        ? color === 'w'
          ? bestLine.mate
          : -bestLine.mate
        : null;
    const playerMateAfter =
      evalAfter.mate !== null && evalAfter.mate !== undefined
        ? color === 'w'
          ? evalAfter.mate
          : -evalAfter.mate
        : null;

    let effectiveLoss = 0;
    if (!isBestMove) {
      if (playerMateBefore !== null && playerMateBefore > 0 && (playerMateAfter === null || playerMateAfter <= 0)) {
        // Missed a forced checkmate!
        effectiveLoss = Math.max(winLoss, 12.5);
      } else if (playerMateAfter !== null && playerMateAfter < 0 && (playerMateBefore === null || playerMateBefore >= 0)) {
        // Blundered into forced checkmate!
        effectiveLoss = Math.max(winLoss, 24.0);
      } else {
        const damping = 1 + Math.min(4.0, Math.abs(playerCpBefore) / 700);
        const scaledCp = cpDrop / damping / 12.5;
        effectiveLoss = Math.max(winLoss, scaledCp);
        if (cpDrop > 15 && effectiveLoss < 0.8) effectiveLoss = 0.8;
      }
    }

    const moveAcc = computeMoveAccuracy(effectiveLoss);

    // 1. Opening Book via real ECO Transposition Trie
    const isBook =
      CC.EcoBook &&
      CC.EcoBook.isBookMove(fenBefore, fenAfter, moveObj.san, ply) &&
      (playerMateAfter === null || playerMateAfter > -1) &&
      playerCpActualAfter >= -300;

    if (isBook) {
      return {
        classification: { type: 'book', symbol: '📖', label: 'Lance Teórico (Livro)', accuracy: 100 },
        winLoss: 0,
        cpDrop: 0,
        isBook: true,
        bestUci
      };
    }

    // MultiPV gap between #1 and #2
    let gapToSecondCp = 0;
    if (secondLine) {
      const pBest = color === 'w' ? bestLine.cp : -bestLine.cp;
      const pSecond = color === 'w' ? secondLine.cp : -secondLine.cp;
      gapToSecondCp = Math.max(0, pBest - pSecond);
    }

    const isTopChoice = isBestMove || effectiveLoss <= 0.9;

    // 2. Brilliant (!!) — Top move involving a TRUE net material sacrifice in a non-trivial position
    if (
      isTopChoice &&
      ply > 6 &&
      playerCpActualAfter >= -50 &&
      playerWinBefore < 86 &&
      playerWinAfter >= 45 &&
      detectTrueSacrifice(fenBefore, fenAfter, moveObj) &&
      (gapToSecondCp >= 35 || isBestMove)
    ) {
      return {
        classification: { type: 'brilliant', symbol: '!!', label: 'Lance Brilhante', accuracy: 100 },
        winLoss: Number(winLoss.toFixed(1)),
        cpDrop: Math.round(cpDrop),
        isBook: false,
        bestUci
      };
    }

    // 3. Great Move (!) — Only move holding/winning (MultiPV gap >= 110 cp) or dramatic tactical turnaround
    if (
      isTopChoice &&
      ply > 6 &&
      playerWinBefore < 88 &&
      (gapToSecondCp >= 115 ||
        winGain >= 9.5 ||
        (isBestMove && moveObj.san.includes('+') && gapToSecondCp >= 65 && playerWinBefore >= 20))
    ) {
      return {
        classification: { type: 'great', symbol: '!', label: 'Grande Lance', accuracy: 100 },
        winLoss: Number(winLoss.toFixed(1)),
        cpDrop: Math.round(cpDrop),
        isBook: false,
        bestUci
      };
    }

    // 4. Best Move (★)
    if (isBestMove) {
      return {
        classification: { type: 'best', symbol: '★', label: 'Melhor Lance', accuracy: 100 },
        winLoss: 0,
        cpDrop: 0,
        isBook: false,
        bestUci
      };
    }

    // 5. Excellent (👍)
    if (effectiveLoss <= 2.3) {
      return {
        classification: { type: 'excellent', symbol: '👍', label: 'Lance Excelente', accuracy: moveAcc },
        winLoss: Number(winLoss.toFixed(1)),
        cpDrop: Math.round(cpDrop),
        isBook: false,
        bestUci
      };
    }

    // 6. Good (✓)
    if (effectiveLoss <= 5.2) {
      return {
        classification: { type: 'good', symbol: '✓', label: 'Bom Lance', accuracy: moveAcc },
        winLoss: Number(winLoss.toFixed(1)),
        cpDrop: Math.round(cpDrop),
        isBook: false,
        bestUci
      };
    }

    // 7. Inaccuracy (?!)
    if (effectiveLoss <= 10.5) {
      return {
        classification: { type: 'inaccuracy', symbol: '?!', label: 'Imprecisão', accuracy: moveAcc },
        winLoss: Number(winLoss.toFixed(1)),
        cpDrop: Math.round(cpDrop),
        isBook: false,
        bestUci
      };
    }

    // 8. Missed Win (🎯) — Dropped from clearly winning (>=78% win prob) back to roughly equal (still >= -75cp)
    if (
      (playerWinBefore >= 78 || (playerMateBefore !== null && playerMateBefore > 0)) &&
      playerWinAfter <= 62 &&
      playerCpActualAfter >= -80 &&
      winLoss >= 14
    ) {
      return {
        classification: { type: 'miss', symbol: '🎯', label: 'Vitória Perdida', accuracy: moveAcc },
        winLoss: Number(winLoss.toFixed(1)),
        cpDrop: Math.round(cpDrop),
        isBook: false,
        bestUci
      };
    }

    // 9. Mistake (?)
    if (effectiveLoss <= 19.5) {
      return {
        classification: { type: 'mistake', symbol: '?', label: 'Erro', accuracy: moveAcc },
        winLoss: Number(winLoss.toFixed(1)),
        cpDrop: Math.round(cpDrop),
        isBook: false,
        bestUci
      };
    }

    // 10. Blunder (??)
    return {
      classification: { type: 'blunder', symbol: '??', label: 'Capivara (Erro Grave)', accuracy: moveAcc },
      winLoss: Number(winLoss.toFixed(1)),
      cpDrop: Math.round(cpDrop),
      isBook: false,
      bestUci
    };
  }

  function buildCoachExplanationV2({
    fenBefore,
    playedSan,
    bestSan,
    bestUci,
    classification,
    cpBefore,
    cpAfter,
    phase,
    pvSanLine,
    themes,
    timeSpentSec,
    clockSec
  }) {
    const diffPawns = Math.abs(cpAfter - cpBefore) / 100;
    const gameBefore = new global.Chess(fenBefore);
    const bestFromPiece = bestUci ? gameBefore.get(bestUci.slice(0, 2)) : null;
    const bestToPiece = bestUci ? gameBefore.get(bestUci.slice(2, 4)) : null;
    const bestPieceLabel = bestFromPiece ? PIECE_NAMES_PT[bestFromPiece.type] : 'peça';

    const timeNote =
      timeSpentSec !== null && timeSpentSec !== undefined
        ? `<span class="coach-time-pill">⏱️ Pensou ${timeSpentSec.toFixed(1)}s${
            clockSec !== null ? ` (restavam ${formatClock(clockSec)})` : ''
          }</span>`
        : '';

    if (classification.type === 'book') {
      return `📖 <strong>LANCE TEÓRICO:</strong> <strong>${playedSan}</strong> segue a teoria sólida de abertura. ${timeNote}`;
    }
    if (classification.type === 'brilliant') {
      return `💎 <strong>LANCE BRILHANTE (!!):</strong> Sacrifício tático genuíno! Com <strong>${playedSan}</strong> na fase de <strong>${phase}</strong>, você entregou material para abrir um ataque decisivo. Sequência: <code>${pvSanLine || playedSan}</code>. ${timeNote}`;
    }
    if (classification.type === 'great') {
      return `❗ <strong>GRANDE LANCE (!):</strong> Lance único e cirúrgico! <strong>${playedSan}</strong> era a única jogada que mantinha a vantagem ou salvava a posição. Linha: <code>${pvSanLine || playedSan}</code>. ${timeNote}`;
    }
    if (classification.type === 'best') {
      return `★ <strong>MELHOR LANCE:</strong> Escolha #1 do Stockfish na fase de <strong>${phase}</strong>. Continuação: <code>${pvSanLine || playedSan}</code>. ${timeNote}`;
    }
    if (classification.type === 'excellent') {
      return `👍 <strong>LANCE EXCELENTE:</strong> <strong>${playedSan}</strong> mantém praticamente a mesma força da 1ª opção (<strong>${bestSan}</strong>). ${timeNote}`;
    }
    if (classification.type === 'good') {
      return `✓ <strong>BOM LANCE:</strong> <strong>${playedSan}</strong> é sólido. O motor preferia ligeiramente <strong>${bestSan}</strong> com o ${bestPieceLabel}, mas a posição segue firme. ${timeNote}`;
    }

    const details = [];
    if (themes.includes('mate_perdido')) {
      details.push(`havia um <strong>xeque-mate forçado</strong> disponível com <strong>${bestSan}</strong>`);
    }
    if (themes.includes('mate_permitido')) {
      details.push(`este lance permitiu uma rede de <strong>xeque-mate forçado</strong> contra o seu Rei`);
    }
    if (themes.includes('peca_pendurada')) {
      details.push(`deixou peça desprotegida ou exposta a captura vantajosa do adversário`);
    }
    if (themes.includes('garfo')) {
      details.push(`envolveu um tema de <strong>garfo / ataque duplo</strong> decisivo`);
    }
    if (bestToPiece && themes.includes('captura_perdida')) {
      details.push(`deixou escapar a captura de um(a) <strong>${PIECE_NAMES_PT[bestToPiece.type]}</strong> em <strong>${bestUci.slice(2, 4)}</strong>`);
    }
    if (themes.includes('seguranca_rei')) {
      details.push(`priorize a <strong>segurança do Rei / roque</strong> antes de abrir o centro`);
    }
    if (themes.includes('lance_apressado')) {
      details.push(`jogado muito rápido (<strong>${timeSpentSec.toFixed(1)}s</strong>) mesmo com tempo sobrando no relógio`);
    } else if (themes.includes('apuro_tempo')) {
      details.push(`cometido sob <strong>apuro de tempo</strong>`);
    }

    if (!details.length) {
      details.push(`custou cerca de <strong>${diffPawns.toFixed(1)} peões</strong> de avaliação na fase de <strong>${phase}</strong>`);
    }

    const themeBadges = (themes || [])
      .map((t) => `<span class="theme-chip">${THEME_LABELS[t] || t}</span>`)
      .join(' ');

    return `Você jogou <strong>${playedSan}</strong> (${classification.symbol}), mas o melhor era <strong>${bestSan}</strong> (${bestPieceLabel}). Diagnóstico: ${details.join('; ')}.<br><div style="margin-top:0.35rem;display:flex;flex-wrap:wrap;gap:0.35rem;align-items:center;">${themeBadges} ${timeNote}</div><div style="margin-top:0.35rem;color:#93c5fd">💡 Linha do Stockfish: <strong>${pvSanLine || bestSan}</strong></div>`;
  }

  // Parse PGN headers + extract [%clk H:MM:SS.d] per move cleanly
  function parsePgnHeaders(pgn) {
    const headers = {};
    const regex = /\[(\w+)\s+"([^"]*)"\]/g;
    let m;
    while ((m = regex.exec(pgn)) !== null) {
      headers[m[1]] = m[2];
    }
    return headers;
  }

  function parseClockToSec(str) {
    const parts = str.split(':').map(Number);
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return null;
  }

  function formatClock(sec) {
    if (sec === null || sec === undefined || isNaN(sec)) return '—';
    const s = Math.max(0, Math.round(sec));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${r < 10 ? '0' : ''}${r}`;
  }

  function parseTimeControl(tc) {
    if (!tc || tc === '-') return { baseSec: null, incSec: 0 };
    const m = tc.match(/^(\d+)(?:\+(\d+))?$/);
    if (!m) return { baseSec: null, incSec: 0 };
    return { baseSec: parseInt(m[1], 10), incSec: m[2] ? parseInt(m[2], 10) : 0 };
  }

  function extractClocksPerPly(rawPgn) {
    // Mask comments {...} first so [%clk ...] brackets are never stripped as PGN headers
    const comments = [];
    let body = String(rawPgn || '').replace(/\{([^}]*)\}/g, (_, inner) => {
      const idx = comments.length;
      comments.push(inner);
      return ` __CLKCMT_${idx}__ `;
    });

    // Strip PGN tag headers [...] and nested parenthetical variations (...)
    body = body.replace(/\[[^\]]*\]/g, ' ');
    let prev;
    do {
      prev = body;
      body = body.replace(/\([^()]*\)/g, ' ');
    } while (body !== prev);

    const tokens = body.trim().split(/\s+/).filter(Boolean);
    const clocks = [];
    let plyIndex = -1;

    for (const tok of tokens) {
      const cmtMatch = tok.match(/^__CLKCMT_(\d+)__$/);
      if (cmtMatch) {
        if (plyIndex >= 0 && clocks[plyIndex] === undefined) {
          const inner = comments[parseInt(cmtMatch[1], 10)] || '';
          const clkMatch = inner.match(/\[%clk\s+(\d+:\d+(?::\d+(?:\.\d+)?)?)\]/i);
          if (clkMatch) clocks[plyIndex] = parseClockToSec(clkMatch[1]);
        }
        continue;
      }
      const cleanTok = tok.replace(/^\d+\.+/, '');
      if (!cleanTok || /^\$\d+$/.test(cleanTok) || /^(1-0|0-1|1\/2-1\/2|\*)$/.test(cleanTok)) {
        continue;
      }
      plyIndex++;
    }
    return clocks;
  }

  function cleanPgnForChessJs(rawPgn) {
    let text = String(rawPgn || '')
      .replace(/\r\n/g, '\n')
      .replace(/\{[^}]*\}/g, ' ');
    let prev;
    do {
      prev = text;
      text = text.replace(/\([^()]*\)/g, ' ');
    } while (text !== prev);

    return text
      .replace(/\d+\.\.\./g, ' ')
      .replace(/\$\d+/g, ' ')
      .replace(/\]\s+\[/g, ']\n[')
      .replace(/(\])\s*\n(?=\s*\d+\.)/, '$1\n\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  // Estimate Performance Elo from Game Accuracy + Opponent Rating
  function estimateGamePerformanceElo(accuracy, oppRating, heroOutcome) {
    const opp = parseInt(oppRating, 10);
    // Pure accuracy-to-Elo baseline curve (45% -> ~500, 65% -> ~1000, 80% -> ~1500, 90% -> ~2000, 96% -> ~2400)
    const accCurve = Math.round(Math.max(250, Math.min(2750, (accuracy - 28) * 34)));
    if (!opp || isNaN(opp)) return accCurve;
    const outcomeBonus = heroOutcome === 'Vitória' ? 180 : heroOutcome === 'Derrota' ? -180 : 0;
    const oppPerf = Math.max(200, opp + outcomeBonus);
    return Math.round(0.6 * accCurve + 0.4 * oppPerf);
  }

  // Compute 6-Axis Player Skill Profile (0..100) across analyzed games
  function computePlayerDevelopmentMetrics(games) {
    const metrics = {
      opening: [],
      tactics: [],
      positional: [],
      endgame: [],
      timeMgmt: [],
      defense: [],
      themeCounts: {},
      perfElos: [],
      rushedBlunders: 0,
      timeTroubleBlunders: 0,
      timedMovesCount: 0,
      totalTimeSpent: 0
    };

    games.forEach((g) => {
      if (g.estimatedElo) metrics.perfElos.push(g.estimatedElo);
      const heroMoves = (g.moves || []).filter((m) => m.color === g.heroColor);
      heroMoves.forEach((m) => {
        const acc = m.classification?.accuracy ?? 75;
        if (m.phase === 'Abertura') metrics.opening.push(acc);
        else if (m.phase === 'Final') metrics.endgame.push(acc);
        else metrics.positional.push(acc);

        const cpBeforeHero = m.color === 'w' ? m.cpBefore : -m.cpBefore;
        if (cpBeforeHero < -120) {
          metrics.defense.push(acc);
        }

        // Tactics: captures, checks, blunders, brilliant/great, tactical themes
        const isTactical =
          ['brilliant', 'great', 'blunder', 'miss'].includes(m.classification?.type) ||
          (m.themes || []).some((t) => ['garfo', 'peca_pendurada', 'captura_perdida', 'mate_perdido', 'mate_permitido'].includes(t));
        if (isTactical) {
          metrics.tactics.push(acc);
        } else {
          metrics.tactics.push(Math.min(100, acc + 6));
        }

        (m.themes || []).forEach((t) => {
          metrics.themeCounts[t] = (metrics.themeCounts[t] || 0) + 1;
        });

        if (m.timeSpentSec !== null && m.timeSpentSec !== undefined) {
          metrics.timedMovesCount++;
          metrics.totalTimeSpent += m.timeSpentSec;
          if (m.isRushedError && ['mistake', 'blunder'].includes(m.classification?.type)) {
            metrics.rushedBlunders++;
            metrics.timeMgmt.push(35);
          } else if (m.isTimeTrouble && ['mistake', 'blunder'].includes(m.classification?.type)) {
            metrics.timeTroubleBlunders++;
            metrics.timeMgmt.push(45);
          } else {
            metrics.timeMgmt.push(Math.min(100, Math.max(55, acc)));
          }
        }
      });
    });

    const avg = (arr, fallback = 65) =>
      arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : fallback;

    const radar = {
      Abertura: avg(metrics.opening, 65),
      Tática: avg(metrics.tactics, 60),
      Posicional: avg(metrics.positional, 65),
      Finais: avg(metrics.endgame, 62),
      Tempo: avg(metrics.timeMgmt, 72),
      Defesa: avg(metrics.defense, 60)
    };

    const avgPerfElo = metrics.perfElos.length
      ? Math.round(metrics.perfElos.reduce((a, b) => a + b, 0) / metrics.perfElos.length)
      : null;

    return {
      radar,
      avgPerfElo,
      themeCounts: metrics.themeCounts,
      rushedBlunders: metrics.rushedBlunders,
      timeTroubleBlunders: metrics.timeTroubleBlunders,
      avgTimePerMove: metrics.timedMovesCount
        ? Number((metrics.totalTimeSpent / metrics.timedMovesCount).toFixed(1))
        : null
    };
  }

  CC.Analyzer = {
    PIECE_WEIGHTS,
    PIECE_NAMES_PT,
    THEME_LABELS,
    cpToWinProb,
    computeMoveAccuracy,
    computeGameAccuracy,
    getMaterialPoints,
    getGamePhase,
    classifyMoveV2,
    detectTacticalThemes,
    buildCoachExplanationV2,
    uciToSan,
    uciPvToSanLine,
    parsePgnHeaders,
    parseTimeControl,
    extractClocksPerPly,
    cleanPgnForChessJs,
    formatClock,
    estimateGamePerformanceElo,
    computePlayerDevelopmentMetrics
  };
})(window);
