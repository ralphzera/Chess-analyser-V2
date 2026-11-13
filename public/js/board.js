/* ============================================================================
 * ChessCoach Pro — Interactive Chessboard v2
 * Pointer Drag & Drop + Click-to-Move + Promotion Picker + SVG Arrows + Audio
 * ============================================================================ */
(function (global) {
  'use strict';

  const CC = (global.ChessCoach = global.ChessCoach || {});

  const PIECE_SVGS = {
    wP: `<svg viewBox="0 0 45 45" class="piece-svg"><path d="M 22.5,9 C 19.5,9 17,11.5 17,14.5 C 17,16.8 18.4,18.7 20.4,19.5 C 17,21 15,24.5 15,29 L 30,29 C 30,24.5 28,21 24.6,19.5 C 26.6,18.7 28,16.8 28,14.5 C 28,11.5 25.5,9 22.5,9 z M 11.5,37 C 11.5,37 11.5,33 14.5,31.5 L 30.5,31.5 C 33.5,33 33.5,37 33.5,37 L 11.5,37 z" fill="#fff" stroke="#1e293b" stroke-width="2" stroke-linecap="round"/></svg>`,
    wR: `<svg viewBox="0 0 45 45" class="piece-svg"><g fill="#fff" stroke="#1e293b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M 9,39 L 36,39 L 36,36 L 9,36 L 9,39 z M 12,36 L 12,32 L 33,32 L 33,36 L 12,36 z M 11,14 L 11,9 L 15,9 L 15,11 L 20,11 L 20,9 L 25,9 L 25,11 L 30,11 L 30,9 L 34,9 L 34,14"/><path d="M 34,14 L 31,17 L 14,17 L 11,14"/><path d="M 31,17 L 31,29.5 L 14,29.5 L 14,17"/><path d="M 14,29.5 L 12,32 L 33,32 L 31,29.5"/></g></svg>`,
    wN: `<svg viewBox="0 0 45 45" class="piece-svg"><g fill="#fff" stroke="#1e293b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M 22,10 C 32.5,11 38.5,18 38,39 L 15,39 C 15,30 25,32.5 23,18"/><path d="M 24,18 C 24.38,20.91 18.45,25.37 16,27 C 13,29 13.18,31.34 11,31 C 9.958,30.06 12.41,27.96 11,28 C 10,28 11.19,29.23 10,30 C 9,30 5.997,31 6,26 C 6,24 12,14 12,14 C 12,14 13.89,12.1 14,10.5 C 13.27,9.506 13.5,8.5 13.5,7.5 C 14.5,6.5 16.5,10 16.5,10 L 18.5,10 C 18.5,10 19.28,8.008 21,7 C 22,7 22,10 22,10"/><circle cx="15.5" cy="14.5" r="1" fill="#1e293b"/></g></svg>`,
    wB: `<svg viewBox="0 0 45 45" class="piece-svg"><g fill="#fff" stroke="#1e293b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M 9,36 C 12.39,35.03 19.11,36.43 22.5,34 C 25.89,36.43 32.61,35.03 36,36 C 36,36 37.65,36.54 39,38 C 38.32,38.97 37.35,38.99 36,38.5 C 32.61,37.53 25.89,38.96 22.5,37.5 C 19.11,38.96 12.39,37.53 9,38.5 C 7.646,38.99 6.677,38.97 6,38 C 7.354,36.06 9,36 9,36 z"/><path d="M 15,32 C 17.5,34.5 27.5,34.5 30,32 C 30.5,30.5 30,30 30,30 C 30,27.5 27.5,26 27.5,26 C 33,24.5 33.5,14.5 22.5,10.5 C 11.5,14.5 12,24.5 17.5,26 C 17.5,26 15,27.5 15,30 C 15,30 14.5,30.5 15,32 z"/><circle cx="22.5" cy="8" r="2.2"/><path d="M 19.5,17.5 L 25.5,17.5 M 22.5,14.5 L 22.5,20.5"/></g></svg>`,
    wQ: `<svg viewBox="0 0 45 45" class="piece-svg"><g fill="#fff" stroke="#1e293b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M 9,26 C 17.5,24.5 30,24.5 36,26 L 38.5,13.5 L 31,25 L 30.7,10.9 L 25.5,24.5 L 22.5,10 L 19.5,24.5 L 14.3,10.9 L 14,25 L 6.5,13.5 L 9,26 z"/><path d="M 9,26 C 9,28 10.5,28 11.5,30 C 12.5,31.5 12.5,31 12,33.5 C 10.5,34.5 11,36 11,36 C 9.5,37.5 11,38.5 11,38.5 C 17.5,39.5 27.5,39.5 34,38.5 C 34,38.5 35.5,37.5 34,36 C 34,36 34.5,34.5 33,33.5 C 32.5,31 32.5,31.5 33.5,30 C 34.5,28 36,28 36,26 C 27.5,24.5 17.5,24.5 9,26 z"/><circle cx="6" cy="12" r="1.8"/><circle cx="14" cy="9" r="1.8"/><circle cx="22.5" cy="8" r="1.8"/><circle cx="31" cy="9" r="1.8"/><circle cx="39" cy="12" r="1.8"/></g></svg>`,
    wK: `<svg viewBox="0 0 45 45" class="piece-svg"><g fill="#fff" stroke="#1e293b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M 22.5,11.63 L 22.5,6 M 20,8 L 25,8"/><path d="M 22.5,25 C 22.5,25 27,17.5 25.5,14.5 C 25.5,14.5 24.5,12 22.5,12 C 20.5,12 19.5,14.5 19.5,14.5 C 18,17.5 22.5,25 22.5,25"/><path d="M 11.5,37 C 17,40.5 27,40.5 32.5,37 L 32.5,30 C 32.5,30 41.5,25.5 38.5,19.5 C 34.5,13 25,16 22.5,23.5 L 22.5,27 L 22.5,23.5 C 19,16 9.5,13 6.5,19.5 C 3.5,25.5 11.5,29.5 11.5,29.5 L 11.5,37 z"/></g></svg>`,
    bP: `<svg viewBox="0 0 45 45" class="piece-svg"><path d="M 22.5,9 C 19.5,9 17,11.5 17,14.5 C 17,16.8 18.4,18.7 20.4,19.5 C 17,21 15,24.5 15,29 L 30,29 C 30,24.5 28,21 24.6,19.5 C 26.6,18.7 28,16.8 28,14.5 C 28,11.5 25.5,9 22.5,9 z M 11.5,37 C 11.5,37 11.5,33 14.5,31.5 L 30.5,31.5 C 33.5,33 33.5,37 33.5,37 L 11.5,37 z" fill="#1e293b" stroke="#f8fafc" stroke-width="1.6" stroke-linecap="round"/></svg>`,
    bR: `<svg viewBox="0 0 45 45" class="piece-svg"><g fill="#1e293b" stroke="#f8fafc" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M 9,39 L 36,39 L 36,36 L 9,36 L 9,39 z M 12,36 L 12,32 L 33,32 L 33,36 L 12,36 z M 11,14 L 11,9 L 15,9 L 15,11 L 20,11 L 20,9 L 25,9 L 25,11 L 30,11 L 30,9 L 34,9 L 34,14"/><path d="M 34,14 L 31,17 L 14,17 L 11,14"/><path d="M 31,17 L 31,29.5 L 14,29.5 L 14,17"/><path d="M 14,29.5 L 12,32 L 33,32 L 31,29.5"/></g></svg>`,
    bN: `<svg viewBox="0 0 45 45" class="piece-svg"><g fill="#1e293b" stroke="#f8fafc" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M 22,10 C 32.5,11 38.5,18 38,39 L 15,39 C 15,30 25,32.5 23,18"/><path d="M 24,18 C 24.38,20.91 18.45,25.37 16,27 C 13,29 13.18,31.34 11,31 C 9.958,30.06 12.41,27.96 11,28 C 10,28 11.19,29.23 10,30 C 9,30 5.997,31 6,26 C 6,24 12,14 12,14 C 12,14 13.89,12.1 14,10.5 C 13.27,9.506 13.5,8.5 13.5,7.5 C 14.5,6.5 16.5,10 16.5,10 L 18.5,10 C 18.5,10 19.28,8.008 21,7 C 22,7 22,10 22,10"/><circle cx="15.5" cy="14.5" r="1" fill="#f8fafc"/></g></svg>`,
    bB: `<svg viewBox="0 0 45 45" class="piece-svg"><g fill="#1e293b" stroke="#f8fafc" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M 9,36 C 12.39,35.03 19.11,36.43 22.5,34 C 25.89,36.43 32.61,35.03 36,36 C 36,36 37.65,36.54 39,38 C 38.32,38.97 37.35,38.99 36,38.5 C 32.61,37.53 25.89,38.96 22.5,37.5 C 19.11,38.96 12.39,37.53 9,38.5 C 7.646,38.99 6.677,38.97 6,38 C 7.354,36.06 9,36 9,36 z"/><path d="M 15,32 C 17.5,34.5 27.5,34.5 30,32 C 30.5,30.5 30,30 30,30 C 30,27.5 27.5,26 27.5,26 C 33,24.5 33.5,14.5 22.5,10.5 C 11.5,14.5 12,24.5 17.5,26 C 17.5,26 15,27.5 15,30 C 15,30 14.5,30.5 15,32 z"/><circle cx="22.5" cy="8" r="2.2"/><path d="M 19.5,17.5 L 25.5,17.5 M 22.5,14.5 L 22.5,20.5"/></g></svg>`,
    bQ: `<svg viewBox="0 0 45 45" class="piece-svg"><g fill="#1e293b" stroke="#f8fafc" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M 9,26 C 17.5,24.5 30,24.5 36,26 L 38.5,13.5 L 31,25 L 30.7,10.9 L 25.5,24.5 L 22.5,10 L 19.5,24.5 L 14.3,10.9 L 14,25 L 6.5,13.5 L 9,26 z"/><path d="M 9,26 C 9,28 10.5,28 11.5,30 C 12.5,31.5 12.5,31 12,33.5 C 10.5,34.5 11,36 11,36 C 9.5,37.5 11,38.5 11,38.5 C 17.5,39.5 27.5,39.5 34,38.5 C 34,38.5 35.5,37.5 34,36 C 34,36 34.5,34.5 33,33.5 C 32.5,31 32.5,31.5 33.5,30 C 34.5,28 36,28 36,26 C 27.5,24.5 17.5,24.5 9,26 z"/><circle cx="6" cy="12" r="1.8"/><circle cx="14" cy="9" r="1.8"/><circle cx="22.5" cy="8" r="1.8"/><circle cx="31" cy="9" r="1.8"/><circle cx="39" cy="12" r="1.8"/></g></svg>`,
    bK: `<svg viewBox="0 0 45 45" class="piece-svg"><g fill="#1e293b" stroke="#f8fafc" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M 22.5,11.63 L 22.5,6 M 20,8 L 25,8"/><path d="M 22.5,25 C 22.5,25 27,17.5 25.5,14.5 C 25.5,14.5 24.5,12 22.5,12 C 20.5,12 19.5,14.5 19.5,14.5 C 18,17.5 22.5,25 22.5,25"/><path d="M 11.5,37 C 17,40.5 27,40.5 32.5,37 L 32.5,30 C 32.5,30 41.5,25.5 38.5,19.5 C 34.5,13 25,16 22.5,23.5 L 22.5,27 L 22.5,23.5 C 19,16 9.5,13 6.5,19.5 C 3.5,25.5 11.5,29.5 11.5,29.5 L 11.5,37 z"/></g></svg>`
  };

  // --- Lightweight Web Audio Sound Synthesizer (Zero external assets) ---
  let audioCtx = null;
  let soundEnabled = localStorage.getItem('chesscoach_sound') !== 'off';

  function setSoundEnabled(enabled) {
    soundEnabled = Boolean(enabled);
    try {
      localStorage.setItem('chesscoach_sound', soundEnabled ? 'on' : 'off');
    } catch (_) {}
  }

  function isSoundEnabled() {
    return soundEnabled;
  }

  function playSound(kind = 'move') {
    if (!soundEnabled) return;
    const AudioCtor = global.AudioContext || global.webkitAudioContext;
    if (!AudioCtor) return;
    try {
      if (!audioCtx) audioCtx = new AudioCtor();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const now = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);

      if (kind === 'capture') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.exponentialRampToValueAtTime(95, now + 0.08);
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
        osc.start(now);
        osc.stop(now + 0.095);
      } else if (kind === 'check') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(520, now);
        osc.frequency.exponentialRampToValueAtTime(320, now + 0.14);
        gain.gain.setValueAtTime(0.16, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        osc.start(now);
        osc.stop(now + 0.16);
      } else if (kind === 'success') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523, now);
        osc.frequency.setValueAtTime(659, now + 0.07);
        gain.gain.setValueAtTime(0.14, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
        osc.start(now);
        osc.stop(now + 0.23);
      } else if (kind === 'error') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(175, now);
        osc.frequency.exponentialRampToValueAtTime(115, now + 0.15);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
        osc.start(now);
        osc.stop(now + 0.17);
      } else {
        // Clean wooden tap for normal move / castle
        osc.type = 'sine';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.exponentialRampToValueAtTime(140, now + 0.055);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
        osc.start(now);
        osc.stop(now + 0.065);
      }
    } catch (_) {}
  }

  function playMoveObjSound(moveObj) {
    if (!moveObj) return;
    if (moveObj.san && (moveObj.san.includes('+') || moveObj.san.includes('#'))) {
      playSound('check');
    } else if (moveObj.captured) {
      playSound('capture');
    } else {
      playSound('move');
    }
  }

  // --- Promotion Picker Modal ---
  function askPromotionChoice(color, onSelect) {
    let modal = document.getElementById('promotion-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'promotion-modal';
      modal.className = 'promo-modal hidden';
      document.body.appendChild(modal);
    }
    const pieces = ['q', 'r', 'b', 'n'];
    modal.innerHTML = `
      <div class="promo-dialog">
        <div class="promo-title">Escolha a promoção</div>
        <div class="promo-choices">
          ${pieces
            .map((p) => {
              const key = `${color}${p.toUpperCase()}`;
              return `<button class="promo-btn" data-promo="${p}">${PIECE_SVGS[key]}</button>`;
            })
            .join('')}
        </div>
      </div>
    `;
    modal.classList.remove('hidden');
    modal.querySelectorAll('.promo-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const promo = btn.dataset.promo;
        modal.classList.add('hidden');
        onSelect(promo);
      });
    });
    modal.onclick = (e) => {
      if (e.target === modal) {
        modal.classList.add('hidden');
        onSelect('q');
      }
    };
  }

  function squareToCoords(sq, flipped) {
    const file = sq.charCodeAt(0) - 97;
    const rank = 8 - parseInt(sq[1], 10);
    const col = flipped ? 7 - file : file;
    const row = flipped ? 7 - rank : rank;
    return { x: col * 100 + 50, y: row * 100 + 50 };
  }

  function drawBoardArrows(svgEl, arrows, flipped) {
    svgEl.innerHTML = '';
    if (!arrows || !arrows.length) return;

    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const uid = svgEl.id || 'board';

    arrows.forEach((a, idx) => {
      const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
      marker.setAttribute('id', `arrow-${uid}-${idx}`);
      marker.setAttribute('markerWidth', '4.2');
      marker.setAttribute('markerHeight', '4.2');
      marker.setAttribute('refX', '2.5');
      marker.setAttribute('refY', '2.1');
      marker.setAttribute('orient', 'auto');

      const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      polygon.setAttribute('points', '0 0, 4.2 2.1, 0 4.2');
      polygon.setAttribute('fill', a.color || '#22c55e');
      marker.appendChild(polygon);
      defs.appendChild(marker);
    });
    svgEl.appendChild(defs);

    arrows.forEach((a, idx) => {
      if (!a.from || !a.to) return;
      if (a.from === a.to) {
        // Draw highlight circle on square when from === to (e.g. piece hint)
        const p = squareToCoords(a.from, flipped);
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', p.x);
        circle.setAttribute('cy', p.y);
        circle.setAttribute('r', '40');
        circle.setAttribute('fill', 'none');
        circle.setAttribute('stroke', a.color || '#eab308');
        circle.setAttribute('stroke-width', '8');
        circle.setAttribute('opacity', String(a.opacity ?? 0.85));
        svgEl.appendChild(circle);
        return;
      }

      const p1 = squareToCoords(a.from, flipped);
      const p2 = squareToCoords(a.to, flipped);
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const len = Math.hypot(dx, dy);
      if (len === 0) return;

      const endX = p2.x - (dx / len) * 22;
      const endY = p2.y - (dy / len) * 22;

      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', p1.x);
      line.setAttribute('y1', p1.y);
      line.setAttribute('x2', endX);
      line.setAttribute('y2', endY);
      line.setAttribute('stroke', a.color || '#22c55e');
      line.setAttribute('stroke-width', String(a.width || 14));
      line.setAttribute('stroke-linecap', 'round');
      line.setAttribute('opacity', String(a.opacity ?? 0.82));
      line.setAttribute('marker-end', `url(#arrow-${uid}-${idx})`);
      svgEl.appendChild(line);
    });
  }

  function renderChessboard({
    containerId,
    overlayId,
    fen,
    flipped = false,
    lastMove = null,
    selectedSquare = null,
    legalTargets = [],
    badge = null,
    arrows = [],
    onSquareClick = null,
    onPieceDrop = null
  }) {
    const container = document.getElementById(containerId);
    const overlay = overlayId ? document.getElementById(overlayId) : null;
    if (!container) return;

    const chess = new global.Chess(fen);
    const board = chess.board();
    const inCheckColor = chess.in_check() ? chess.turn() : null;
    container.innerHTML = '';

    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

    for (let displayRow = 0; displayRow < 8; displayRow++) {
      for (let displayCol = 0; displayCol < 8; displayCol++) {
        const r = flipped ? 7 - displayRow : displayRow;
        const c = flipped ? 7 - displayCol : displayCol;

        const sqName = `${files[c]}${8 - r}`;
        const isLight = (r + c) % 2 === 0;
        const piece = board[r][c];

        const sqDiv = document.createElement('div');
        sqDiv.className = `square ${isLight ? 'light' : 'dark'}`;
        sqDiv.dataset.square = sqName;

        if (lastMove && (lastMove.from === sqName || lastMove.to === sqName)) {
          sqDiv.classList.add('last-move');
        }
        if (selectedSquare === sqName) {
          sqDiv.classList.add('selected');
        }
        if (inCheckColor && piece && piece.type === 'k' && piece.color === inCheckColor) {
          sqDiv.classList.add('in-check');
        }

        const legalMove = legalTargets.find((m) => m.to === sqName);
        if (legalMove) {
          sqDiv.classList.add(piece ? 'legal-capture' : 'legal-target');
        }

        if (displayCol === 0) {
          const rankSpan = document.createElement('span');
          rankSpan.className = 'coord-rank';
          rankSpan.textContent = 8 - r;
          sqDiv.appendChild(rankSpan);
        }
        if (displayRow === 7) {
          const fileSpan = document.createElement('span');
          fileSpan.className = 'coord-file';
          fileSpan.textContent = files[c];
          sqDiv.appendChild(fileSpan);
        }

        if (piece) {
          const key = `${piece.color}${piece.type.toUpperCase()}`;
          sqDiv.insertAdjacentHTML('beforeend', PIECE_SVGS[key] || '');
        }

        if (badge && badge.square === sqName) {
          const bEl = document.createElement('div');
          bEl.className = `sq-badge ${badge.type}`;
          bEl.textContent = badge.symbol;
          sqDiv.appendChild(bEl);
        }

        // Pointer drag-and-drop + click support
        if (onSquareClick || onPieceDrop) {
          sqDiv.addEventListener('pointerdown', (ev) => {
            if (ev.button !== 0) return;

            if (!onPieceDrop || !piece) {
              if (onSquareClick) onSquareClick(sqName);
              return;
            }

            // If user already had another square selected and clicked a legal target square (capture!), treat as click
            if (selectedSquare && selectedSquare !== sqName && legalTargets.some((m) => m.to === sqName)) {
              if (onSquareClick) onSquareClick(sqName);
              return;
            }

            const startX = ev.clientX;
            const startY = ev.clientY;
            let dragging = false;
            let ghost = null;
            const pieceSvgEl = sqDiv.querySelector('.piece-svg');

            const onMove = (moveEv) => {
              const dist = Math.hypot(moveEv.clientX - startX, moveEv.clientY - startY);
              if (!dragging && dist > 6 && pieceSvgEl) {
                dragging = true;
                pieceSvgEl.style.opacity = '0.25';
                ghost = pieceSvgEl.cloneNode(true);
                ghost.classList.add('drag-piece-ghost');
                const rect = sqDiv.getBoundingClientRect();
                ghost.style.width = `${rect.width * 0.92}px`;
                ghost.style.height = `${rect.height * 0.92}px`;
                document.body.appendChild(ghost);
              }
              if (dragging && ghost) {
                ghost.style.left = `${moveEv.clientX}px`;
                ghost.style.top = `${moveEv.clientY}px`;
              }
            };

            const cleanup = () => {
              window.removeEventListener('pointermove', onMove);
              window.removeEventListener('pointerup', onUp);
              window.removeEventListener('pointercancel', onCancel);
              if (ghost && ghost.parentNode) ghost.parentNode.removeChild(ghost);
              if (pieceSvgEl) pieceSvgEl.style.opacity = '';
            };

            const onUp = (upEv) => {
              cleanup();
              if (!dragging) {
                if (onSquareClick) onSquareClick(sqName);
                return;
              }
              const targetEl = document.elementFromPoint(upEv.clientX, upEv.clientY);
              const targetSqDiv = targetEl ? targetEl.closest('.square') : null;
              const targetSq = targetSqDiv ? targetSqDiv.dataset.square : null;
              if (targetSq && targetSq !== sqName && container.contains(targetSqDiv)) {
                onPieceDrop(sqName, targetSq);
              }
            };

            const onCancel = () => cleanup();

            window.addEventListener('pointermove', onMove);
            window.addEventListener('pointerup', onUp);
            window.addEventListener('pointercancel', onCancel);
          });
        }

        container.appendChild(sqDiv);
      }
    }

    if (overlay) {
      drawBoardArrows(overlay, arrows, flipped);
    }
  }

  CC.Board = {
    PIECE_SVGS,
    renderChessboard,
    askPromotionChoice,
    playSound,
    playMoveObjSound,
    setSoundEnabled,
    isSoundEnabled
  };
})(window);
