/* ============================================================================
 * ChessCoach Pro — Social Sharing, Visual Card PNG, Annotated PGN & Backup
 * ============================================================================ */
(function (global) {
  'use strict';

  const CC = (global.ChessCoach = global.ChessCoach || {});

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function renderMatchCardCanvas(game) {
    const canvas = document.createElement('canvas');
    canvas.width = 900;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');

    // Background gradient
    const grad = ctx.createLinearGradient(0, 0, 900, 480);
    grad.addColorStop(0, '#0b1120');
    grad.addColorStop(1, '#172554');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 900, 480);

    // Top bar
    ctx.fillStyle = '#10b981';
    ctx.fillRect(0, 0, 900, 6);

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 26px Segoe UI, sans-serif';
    ctx.fillText('♟️ ChessCoach Pro — Resumo da Partida', 36, 52);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '16px Segoe UI, sans-serif';
    ctx.fillText(`${game.opening || 'Abertura Clássica'} • ${game.date || ''}`, 36, 80);

    // Player boxes
    const drawPlayerBox = (x, title, name, rating, acc, isHero) => {
      roundRect(ctx, x, 108, 402, 132, 14);
      ctx.fillStyle = isHero ? 'rgba(16, 185, 129, 0.14)' : 'rgba(30, 41, 59, 0.85)';
      ctx.fill();
      ctx.strokeStyle = isHero ? '#10b981' : '#334155';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 14px Segoe UI, sans-serif';
      ctx.fillText(title, x + 20, 136);

      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 22px Segoe UI, sans-serif';
      ctx.fillText(`${name} (${rating || '—'})`.slice(0, 28), x + 20, 170);

      ctx.fillStyle = '#34d399';
      ctx.font = 'bold 34px Segoe UI, sans-serif';
      ctx.fillText(`${acc}%`, x + 20, 218);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '14px Segoe UI, sans-serif';
      ctx.fillText('Precisão CAPS2', x + 132, 214);
    };

    drawPlayerBox(36, '⬜ BRANCAS', game.white, game.whiteRating, game.whiteAccuracy, game.heroColor === 'w');
    drawPlayerBox(462, '⬛ PRETAS', game.black, game.blackRating, game.blackAccuracy, game.heroColor === 'b');

    // Hero badges & Elo Perf
    const c = game.counts || {};
    const chips = [
      { label: `!! ${c.brilliant || 0} Brilhantes`, color: '#2dd4bf' },
      { label: `! ${c.great || 0} Grandes`, color: '#60a5fa' },
      { label: `★ ${c.best || 0} Melhores`, color: '#4ade80' },
      { label: `?! ${c.inaccuracy || 0} Imprec.`, color: '#facc15' },
      { label: `? ${c.mistake || 0} Erros`, color: '#fb923c' },
      { label: `?? ${c.blunder || 0} Capivaras`, color: '#f87171' }
    ];

    let cx = 36;
    chips.forEach((ch) => {
      roundRect(ctx, cx, 262, 132, 42, 8);
      ctx.fillStyle = '#0f172a';
      ctx.fill();
      ctx.strokeStyle = ch.color;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = ch.color;
      ctx.font = 'bold 13px Segoe UI, sans-serif';
      ctx.fillText(ch.label, cx + 10, 288);
      cx += 139;
    });

    // Mini eval graph box
    roundRect(ctx, 36, 324, 828, 108, 12);
    ctx.fillStyle = '#0b1120';
    ctx.fill();
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Draw graph
    const moves = game.moves || [];
    if (moves.length > 0) {
      ctx.strokeStyle = '#334155';
      ctx.beginPath();
      ctx.moveTo(46, 378);
      ctx.lineTo(854, 378);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(46, 378);
      moves.forEach((m, i) => {
        const x = 46 + ((i + 1) / moves.length) * 808;
        const clamped = Math.max(-700, Math.min(700, m.cpAfter || 0));
        const y = 378 - (clamped / 700) * 42;
        ctx.lineTo(x, y);
      });
      ctx.strokeStyle = '#34d399';
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }

    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 14px Segoe UI, sans-serif';
    ctx.fillText(
      `Resultado: ${game.heroOutcome || game.result}${
        game.estimatedElo ? `  |  Elo de Performance Estimado: ~${game.estimatedElo}` : ''
      }`,
      36,
      458
    );

    return canvas;
  }

  function buildShareTextSummary(game) {
    const c = game.counts || {};
    return [
      `♟️ *ChessCoach Pro — Análise Stockfish MultiPV*`,
      `⬜ ${game.white} (${game.whiteRating || '?'}) vs ⬛ ${game.black} (${game.blackRating || '?'})`,
      `📚 Abertura: ${game.opening || 'Clássica'}`,
      `📊 Precisão: Brancas ${game.whiteAccuracy}% | Pretas ${game.blackAccuracy}%`,
      game.estimatedElo ? `🏆 Performance estimada: ~${game.estimatedElo} Elo` : null,
      `✨ Lances: !! ${c.brilliant || 0} | ! ${c.great || 0} | ★ ${c.best || 0} | ?! ${c.inaccuracy || 0} | ? ${c.mistake || 0} | ?? ${c.blunder || 0}`
    ]
      .filter(Boolean)
      .join('\n');
  }

  function openShareModal(game) {
    if (!game) return;
    const modal = document.getElementById('share-modal');
    const previewContainer = document.getElementById('share-card-preview');
    const textArea = document.getElementById('share-summary-text');
    if (!modal || !previewContainer || !textArea) return;

    const canvas = renderMatchCardCanvas(game);
    previewContainer.innerHTML = '';
    canvas.style.width = '100%';
    canvas.style.height = 'auto';
    canvas.style.borderRadius = '10px';
    previewContainer.appendChild(canvas);

    textArea.value = buildShareTextSummary(game);
    modal.classList.remove('hidden');

    document.getElementById('btn-download-card-png').onclick = () => {
      const a = document.createElement('a');
      a.download = `ChessCoach-${game.white}-vs-${game.black}.png`.replace(/[^a-zA-Z0-9._-]/g, '_');
      a.href = canvas.toDataURL('image/png');
      a.click();
    };

    document.getElementById('btn-copy-summary-text').onclick = async () => {
      try {
        await navigator.clipboard.writeText(textArea.value);
        document.getElementById('share-copy-status').textContent = '✅ Resumo copiado! Cole no WhatsApp ou Discord.';
      } catch (_) {
        textArea.select();
        document.execCommand('copy');
        document.getElementById('share-copy-status').textContent = '✅ Texto selecionado/copiado!';
      }
    };

    document.getElementById('btn-download-annotated-pgn').onclick = () => downloadAnnotatedPgn(game);
  }

  function downloadAnnotatedPgn(game) {
    if (!game || !Array.isArray(game.moves)) return;
    const nagMap = {
      brilliant: '$3',
      great: '$1',
      inaccuracy: '$6',
      mistake: '$2',
      miss: '$2',
      blunder: '$4'
    };

    const headerLines = [
      `[Event "ChessCoach Pro Analysis"]`,
      `[White "${game.white}"]`,
      `[Black "${game.black}"]`,
      `[Result "${game.result || '*'}"]`,
      `[Opening "${game.opening || 'Abertura Clássica'}"]`,
      `[WhiteAccuracy "${game.whiteAccuracy}%"]`,
      `[BlackAccuracy "${game.blackAccuracy}%"]`
    ];

    const moveTokens = [];
    game.moves.forEach((m) => {
      if (m.color === 'w') moveTokens.push(`${m.moveNumber}.`);
      const nag = nagMap[m.classification?.type] || '';
      const evalPawns = (m.cpAfter / 100).toFixed(2);
      const commentParts = [`[%eval ${m.cpAfter >= 0 ? '+' : ''}${evalPawns}]`];
      if (m.bestSan && m.bestUci !== m.uci && ['inaccuracy', 'mistake', 'miss', 'blunder'].includes(m.classification?.type)) {
        commentParts.push(`Melhor: ${m.bestSan}${m.pvSanLine ? ` (${m.pvSanLine})` : ''}`);
      }
      moveTokens.push(`${m.san}${nag ? ' ' + nag : ''} { ${commentParts.join(' | ')} }`);
    });
    moveTokens.push(game.result || '*');

    const fullPgn = `${headerLines.join('\n')}\n\n${moveTokens.join(' ')}\n`;
    const blob = new Blob([fullPgn], { type: 'application/x-chess-pgn;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ChessCoach-${game.white}-vs-${game.black}.pgn`.replace(/[^a-zA-Z0-9._-]/g, '_');
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadProfileBackup(storeRoot) {
    const blob = new Blob([JSON.stringify(storeRoot, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ChessCoach-Backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  CC.Share = {
    openShareModal,
    downloadAnnotatedPgn,
    downloadProfileBackup
  };
})(window);
