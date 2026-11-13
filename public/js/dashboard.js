/* ============================================================================
 * ChessCoach Pro — Player Development Dashboard
 *  - 6-Axis Skill Radar (Canvas)
 *  - Accuracy Progression Chart (Canvas)
 *  - Tactical Themes & Time Management Diagnostics
 *  - Personalized Weekly Training Plan with 1-Click Drill Launchers
 * ============================================================================ */
(function (global) {
  'use strict';

  const CC = (global.ChessCoach = global.ChessCoach || {});

  function drawRadarChart(canvas, radarData) {
    if (!canvas || !radarData) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2 + 4;
    const radius = Math.min(w, h) * 0.34;

    ctx.clearRect(0, 0, w, h);

    const labels = Object.keys(radarData);
    const values = Object.values(radarData);
    const n = labels.length;

    // Concentric hexagon rings
    for (let ring = 1; ring <= 4; ring++) {
      const r = (radius * ring) / 4;
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n;
        const x = cx + r * Math.cos(angle);
        const y = cy + r * Math.sin(angle);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.22)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Spokes & Labels
    ctx.font = 'bold 11px Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let i = 0; i < n; i++) {
      const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n;
      const xEnd = cx + radius * Math.cos(angle);
      const yEnd = cy + radius * Math.sin(angle);

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(xEnd, yEnd);
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
      ctx.stroke();

      const lx = cx + (radius + 26) * Math.cos(angle);
      const ly = cy + (radius + 20) * Math.sin(angle);
      ctx.fillStyle = '#cbd5e1';
      ctx.fillText(`${labels[i]} (${values[i]})`, lx, ly);
    }

    // Value Polygon
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const ratio = Math.max(0.15, Math.min(1, values[i] / 100));
      const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n;
      const x = cx + radius * ratio * Math.cos(angle);
      const y = cy + radius * ratio * Math.sin(angle);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(16, 185, 129, 0.28)';
    ctx.fill();
    ctx.strokeStyle = '#34d399';
    ctx.lineWidth = 2.2;
    ctx.stroke();

    // Dots
    for (let i = 0; i < n; i++) {
      const ratio = Math.max(0.15, Math.min(1, values[i] / 100));
      const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n;
      const x = cx + radius * ratio * Math.cos(angle);
      const y = cy + radius * ratio * Math.sin(angle);
      ctx.beginPath();
      ctx.arc(x, y, 3.8, 0, Math.PI * 2);
      ctx.fillStyle = '#34d399';
      ctx.fill();
    }
  }

  function drawTrendChart(canvas, games) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    if (!games.length) {
      ctx.fillStyle = '#64748b';
      ctx.font = '12px Segoe UI, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Analise partidas para ver sua evolução de precisão', w / 2, h / 2);
      return;
    }

    const sorted = [...games]
      .sort((a, b) => new Date(a.analyzedAt || 0) - new Date(b.analyzedAt || 0))
      .slice(-15);

    const padX = 24;
    const padY = 16;
    const plotW = w - padX * 2;
    const plotH = h - padY * 2;

    // Guide lines 50% / 75% / 90%
    [50, 75, 90].forEach((pct) => {
      const y = padY + (1 - pct / 100) * plotH;
      ctx.beginPath();
      ctx.moveTo(padX, y);
      ctx.lineTo(w - padX, y);
      ctx.strokeStyle = 'rgba(148,163,184,0.16)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = '#64748b';
      ctx.font = '10px Segoe UI, sans-serif';
      ctx.fillText(`${pct}%`, 2, y + 3);
    });

    if (sorted.length === 1) {
      const acc = sorted[0].heroAccuracy || 0;
      const y = padY + (1 - acc / 100) * plotH;
      ctx.beginPath();
      ctx.arc(w / 2, y, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#38bdf8';
      ctx.fill();
      return;
    }

    ctx.beginPath();
    sorted.forEach((g, idx) => {
      const x = padX + (idx / (sorted.length - 1)) * plotW;
      const y = padY + (1 - (g.heroAccuracy || 0) / 100) * plotH;
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.4;
    ctx.stroke();

    sorted.forEach((g, idx) => {
      const x = padX + (idx / (sorted.length - 1)) * plotW;
      const y = padY + (1 - (g.heroAccuracy || 0) / 100) * plotH;
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fillStyle =
        g.heroOutcome === 'Vitória' ? '#34d399' : g.heroOutcome === 'Derrota' ? '#f87171' : '#94a3b8';
      ctx.fill();
    });
  }

  function renderDashboard(app) {
    const prof = app.getProfile();
    const games = prof ? Object.values(prof.analyzedGames || {}) : [];
    const puzzles = prof ? prof.puzzles || [] : [];

    document.getElementById('kpi-games').textContent = games.length;

    if (!games.length) {
      document.getElementById('kpi-record').textContent = '0V / 0E / 0D';
      document.getElementById('kpi-accuracy').textContent = '—%';
      document.getElementById('kpi-perf-elo').textContent = '—';
      document.getElementById('kpi-blunders-per-game').textContent = '0.0';
      document.getElementById('kpi-total-mistakes').textContent = '0 erros mapeados';
      document.getElementById('kpi-puzzles-solved').textContent = '0 / 0';
      drawRadarChart(document.getElementById('radar-chart'), {
        Abertura: 50,
        Tática: 50,
        Posicional: 50,
        Finais: 50,
        Tempo: 50,
        Defesa: 50
      });
      drawTrendChart(document.getElementById('trend-chart'), []);
      document.getElementById('phase-stats-container').innerHTML =
        '<div class="muted-text">Analise pelo menos uma partida para desbloquear seu diagnóstico completo.</div>';
      document.getElementById('phase-diagnosis').innerHTML =
        '📌 Dica: Você pode carregar uma <strong>Partida Demo</strong> na aba <em>Importar</em> para testar todos os gráficos agora mesmo!';
      document.getElementById('themes-breakdown').innerHTML = '';
      document.getElementById('study-plan-list').innerHTML = '';
      document.getElementById('openings-tbody').innerHTML = '';
      return;
    }

    const wins = games.filter((g) => g.heroOutcome === 'Vitória').length;
    const losses = games.filter((g) => g.heroOutcome === 'Derrota').length;
    const draws = games.length - wins - losses;
    document.getElementById('kpi-record').textContent = `${wins}V / ${draws}E / ${losses}D`;

    const avgAcc = (games.reduce((acc, g) => acc + (g.heroAccuracy || 0), 0) / games.length).toFixed(1);
    document.getElementById('kpi-accuracy').textContent = `${avgAcc}%`;

    const totalBlunders = games.reduce((acc, g) => acc + (g.counts?.blunder || 0), 0);
    const totalMistakes = games.reduce(
      (acc, g) =>
        acc +
        (g.counts?.blunder || 0) +
        (g.counts?.mistake || 0) +
        (g.counts?.miss || 0) +
        (g.counts?.inaccuracy || 0),
      0
    );

    document.getElementById('kpi-blunders-per-game').textContent = (totalBlunders / games.length).toFixed(1);
    document.getElementById('kpi-total-mistakes').textContent = `${totalMistakes} erros/imprecisões mapeados`;

    const solvedCount = puzzles.filter((p) => p.solved).length;
    document.getElementById('kpi-puzzles-solved').textContent = `${solvedCount} / ${puzzles.length}`;

    // Player Development Metrics (Radar + Perf Elo + Tactical Themes + Time)
    const dev = CC.Analyzer.computePlayerDevelopmentMetrics(games);
    document.getElementById('kpi-perf-elo').textContent = dev.avgPerfElo ? `~${dev.avgPerfElo}` : '—';

    drawRadarChart(document.getElementById('radar-chart'), dev.radar);
    drawTrendChart(document.getElementById('trend-chart'), games);

    // Phase Breakdown
    const phases = {
      Abertura: { totalMoves: 0, errors: 0, blunders: 0 },
      'Meio-Jogo': { totalMoves: 0, errors: 0, blunders: 0 },
      Final: { totalMoves: 0, errors: 0, blunders: 0 }
    };

    games.forEach((g) => {
      (g.moves || []).forEach((m) => {
        if (m.color !== g.heroColor) return;
        const ph = phases[m.phase] || phases['Meio-Jogo'];
        ph.totalMoves++;
        if (['inaccuracy', 'mistake', 'blunder', 'miss'].includes(m.classification?.type)) ph.errors++;
        if (m.classification?.type === 'blunder') ph.blunders++;
      });
    });

    const phaseContainer = document.getElementById('phase-stats-container');
    phaseContainer.innerHTML = '';

    let worstPhase = 'Meio-Jogo';
    let worstRate = -1;
    Object.entries(phases).forEach(([phaseName, stats]) => {
      const errRate = stats.totalMoves ? Math.round((stats.errors / stats.totalMoves) * 100) : 0;
      if (errRate > worstRate && stats.totalMoves > 0) {
        worstRate = errRate;
        worstPhase = phaseName;
      }
      const barColor = errRate >= 30 ? 'var(--c-blunder)' : errRate >= 18 ? 'var(--c-mistake)' : 'var(--accent)';
      const row = document.createElement('div');
      row.className = 'phase-row';
      row.innerHTML = `
        <div class="phase-row-top">
          <span>${phaseName} (${stats.totalMoves} lances)</span>
          <span>${stats.errors} erros (${stats.blunders} capivaras ??) — ${errRate}%</span>
        </div>
        <div class="phase-bar-bg">
          <div class="phase-bar-fill" style="width:${Math.min(100, errRate * 2)}%; background:${barColor}"></div>
        </div>
      `;
      phaseContainer.appendChild(row);
    });

    const phaseAdvice = {
      Abertura:
        '📌 <strong>Foco: Abertura</strong> — Desenvolva peças leves rápido, lute pelo centro e faça o roque antes de lançar ataques.',
      'Meio-Jogo':
        '📌 <strong>Foco: Meio-Jogo Tático</strong> — Antes de cada lance, verifique Xeques, Capturas e Ameaças do adversário.',
      Final:
        '📌 <strong>Foco: Finais</strong> — Ative seu Rei no final e treine oposição e finais de torres na Academia!'
    };
    document.getElementById('phase-diagnosis').innerHTML = phaseAdvice[worstPhase];

    // Tactical Themes & Time Breakdown
    const themesEl = document.getElementById('themes-breakdown');
    const sortedThemes = Object.entries(dev.themeCounts).sort((a, b) => b[1] - a[1]);
    if (!sortedThemes.length) {
      themesEl.innerHTML = '<div class="muted-text">Nenhum padrão crítico recorrente detectado até agora.</div>';
    } else {
      const timeSummary =
        dev.avgTimePerMove !== null
          ? `<div class="review-box" style="margin-bottom:0.55rem;">⏱️ <strong>Tempo médio por lance:</strong> ${dev.avgTimePerMove}s • <strong>Erros apressados (&lt;3.5s):</strong> ${dev.rushedBlunders} • <strong>Erros em apuro (&lt;30s):</strong> ${dev.timeTroubleBlunders}</div>`
          : '';
      themesEl.innerHTML =
        timeSummary +
        sortedThemes
          .slice(0, 6)
          .map(([key, count]) => {
            const label = CC.Analyzer.THEME_LABELS[key] || key;
            return `<div class="theme-stat-row">
              <span>${label}</span>
              <button class="jump-ply-btn theme-launch-btn" data-theme="${key}">${count}x — Treinar ▶</button>
            </div>`;
          })
          .join('');

      themesEl.querySelectorAll('.theme-launch-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          const themeKey = btn.dataset.theme;
          app.academy.puzzleFilter = 'all';
          app.academy.themeFilter = themeKey;
          const themeSel = document.getElementById('puzzle-theme-filter');
          if (themeSel) themeSel.value = themeKey;
          app.academy.currentPuzzleIndex = 0;
          app.switchTab('tab-trainer');
          app.academy.switchSubTab('mistakes');
        });
      });
    }

    // Personalized Weekly Study Plan
    const planEl = document.getElementById('study-plan-list');
    const topTheme = sortedThemes[0] ? sortedThemes[0][0] : null;
    const dueCount = puzzles.filter((p) => !p.solved || (p.srs && Date.now() >= p.srs.nextReviewAt)).length;

    const planItems = [
      {
        title: `1. Revisão Espaçada (SRS): ${dueCount} exercício(s) pendente(s)`,
        desc: 'Corrija exatamente os erros que você cometeu em suas próprias partidas.',
        btn: 'Abrir Treino de Erros',
        action: () => {
          app.academy.puzzleFilter = 'due';
          app.switchTab('tab-trainer');
          app.academy.switchSubTab('mistakes');
        }
      },
      {
        title:
          worstPhase === 'Abertura'
            ? '2. Reforçar Repertório de Aberturas'
            : worstPhase === 'Final'
            ? '2. Dominar Finais Essenciais'
            : `2. Eliminar ${topTheme ? CC.Analyzer.THEME_LABELS[topTheme] || topTheme : 'Erros Táticos'}`,
        desc:
          worstPhase === 'Abertura'
            ? 'Pratique os primeiros 6–8 lances teóricos das principais aberturas.'
            : worstPhase === 'Final'
            ? 'Treine Mate de Torre, Oposição e Ponte de Lucena contra Stockfish.'
            : 'Treine tática focada no seu padrão de erro mais frequente e use o Alerta do Coach.',
        btn: worstPhase === 'Abertura' ? 'Treinar Aberturas' : worstPhase === 'Final' ? 'Treinar Finais' : 'Treinar Tema',
        action: () => {
          app.switchTab('tab-trainer');
          if (worstPhase === 'Abertura') app.academy.switchSubTab('openings');
          else if (worstPhase === 'Final') app.academy.switchSubTab('drills');
          else {
            app.academy.themeFilter = topTheme || 'all';
            app.academy.switchSubTab('mistakes');
          }
        }
      },
      {
        title:
          dev.rushedBlunders > 0
            ? '3. Controle de Impulsividade (Checar antes de clicar)'
            : '3. Sparring com Alerta de Capivara Ativo',
        desc:
          dev.rushedBlunders > 0
            ? `Você cometeu ${dev.rushedBlunders} erro(s) graves gastando menos de 3.5s! Jogue uma partida de treino com o Alerta do Coach ligado.`
            : 'Jogue contra o Bot calibrado perto do seu Elo para consolidar o cálculo sem pressa.',
        btn: 'Iniciar Sparring',
        action: () => {
          app.switchTab('tab-trainer');
          app.academy.switchSubTab('sparring');
        }
      }
    ];

    planEl.innerHTML = planItems
      .map(
        (item, idx) => `
        <div class="study-plan-item">
          <div>
            <strong>${item.title}</strong>
            <div class="game-sub">${item.desc}</div>
          </div>
          <button class="btn-secondary small study-action-btn" data-idx="${idx}">${item.btn}</button>
        </div>`
      )
      .join('');

    planEl.querySelectorAll('.study-action-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx, 10);
        if (planItems[idx]) planItems[idx].action();
      });
    });

    // Openings Table (grouped by opening + heroColor)
    const openingMap = {};
    games.forEach((g) => {
      const op = g.opening || 'Abertura Clássica';
      const colorLabel = g.heroColor === 'w' ? '⬜ Brancas' : '⬛ Pretas';
      const key = `${op}__${g.heroColor}`;
      if (!openingMap[key]) {
        openingMap[key] = { op, colorLabel, games: 0, accSum: 0, severeErrors: 0 };
      }
      openingMap[key].games++;
      openingMap[key].accSum += g.heroAccuracy || 0;
      openingMap[key].severeErrors +=
        (g.counts?.blunder || 0) + (g.counts?.mistake || 0) + (g.counts?.miss || 0);
    });

    const openingsTbody = document.getElementById('openings-tbody');
    openingsTbody.innerHTML = '';

    Object.values(openingMap)
      .sort((a, b) => b.severeErrors - a.severeErrors)
      .forEach((data) => {
        const avg = (data.accSum / data.games).toFixed(1);
        const errPerGame = (data.severeErrors / data.games).toFixed(1);
        const statusHtml =
          errPerGame >= 2.0
            ? `<span class="badge-result loss">Crítico</span>`
            : errPerGame >= 1.0
            ? `<span class="badge-result draw">Atenção</span>`
            : `<span class="badge-result win">Sólido</span>`;

        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><strong>${data.op}</strong><div class="game-sub">${data.colorLabel}</div></td>
          <td>${data.games}</td>
          <td>${avg}%</td>
          <td>${data.severeErrors} (${errPerGame}/jogo)</td>
          <td>${statusHtml}</td>
        `;
        openingsTbody.appendChild(tr);
      });
  }

  CC.Dashboard = {
    renderDashboard
  };
})(window);
