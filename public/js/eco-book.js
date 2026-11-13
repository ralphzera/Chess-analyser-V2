/* ============================================================================
 * ChessCoach Pro — ECO Opening Book & Transposition Explorer
 * Builds an in-memory FEN-based opening trie for exact opening detection,
 * book-move classification, and Opening Repertoire Training drills.
 * ============================================================================ */
(function (global) {
  'use strict';

  const CC = (global.ChessCoach = global.ChessCoach || {});

  // Curated ECO lines (SAN sequences up to ~12 plies) covering major openings
  const ECO_LINES = [
    // King's Pawn (1. e4)
    { eco: 'B00', name: 'Abertura do Peão do Rei', side: 'w', moves: ['e4'] },
    { eco: 'C20', name: 'Jogo Aberto (1.e4 e5)', side: 'b', moves: ['e4', 'e5'] },
    { eco: 'C23', name: 'Abertura do Bispo', side: 'w', moves: ['e4', 'e5', 'Bc4'] },
    { eco: 'C24', name: 'Abertura do Bispo (Defesa Berlim)', side: 'b', moves: ['e4', 'e5', 'Bc4', 'Nf6'] },
    { eco: 'C25', name: 'Abertura Vienense', side: 'w', moves: ['e4', 'e5', 'Nc3'] },
    { eco: 'C26', name: 'Abertura Vienense (Falkbeer)', side: 'w', moves: ['e4', 'e5', 'Nc3', 'Nf6'] },
    { eco: 'C29', name: 'Gambito Vienense', side: 'w', moves: ['e4', 'e5', 'Nc3', 'Nf6', 'f4'] },
    { eco: 'C30', name: 'Gambito do Rei', side: 'w', moves: ['e4', 'e5', 'f4'] },
    { eco: 'C33', name: 'Gambito do Rei Aceito', side: 'w', moves: ['e4', 'e5', 'f4', 'exf4'] },
    { eco: 'C31', name: 'Contragambito Falkbeer', side: 'b', moves: ['e4', 'e5', 'f4', 'd5'] },
    { eco: 'C40', name: 'Abertura do Cavalo do Rei', side: 'w', moves: ['e4', 'e5', 'Nf3'] },
    { eco: 'C41', name: 'Defesa Philidor', side: 'b', moves: ['e4', 'e5', 'Nf3', 'd6'] },
    { eco: 'C41', name: 'Defesa Philidor (Troca)', side: 'b', moves: ['e4', 'e5', 'Nf3', 'd6', 'd4', 'exd4', 'Nxd4', 'Nf6', 'Nc3', 'Be7'] },
    { eco: 'C42', name: 'Defesa Petroff (Russa)', side: 'b', moves: ['e4', 'e5', 'Nf3', 'Nf6'] },
    { eco: 'C42', name: 'Defesa Petroff Clássica', side: 'b', moves: ['e4', 'e5', 'Nf3', 'Nf6', 'Nxe5', 'd6', 'Nf3', 'Nxe4', 'd4', 'd5'] },
    { eco: 'C44', name: 'Abertura Escocesa', side: 'w', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'd4'] },
    { eco: 'C45', name: 'Abertura Escocesa (Variante Principal)', side: 'w', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'd4', 'exd4', 'Nxd4'] },
    { eco: 'C45', name: 'Escocesa Clássica (4...Bc5)', side: 'w', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'd4', 'exd4', 'Nxd4', 'Bc5', 'Be3', 'Qf6', 'c3'] },
    { eco: 'C45', name: 'Escocesa Schmidt (4...Nf6)', side: 'w', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'd4', 'exd4', 'Nxd4', 'Nf6', 'Nxc6', 'bxc6'] },
    { eco: 'C46', name: 'Abertura dos Três Cavalos', side: 'w', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Nc3'] },
    { eco: 'C47', name: 'Abertura dos Quatro Cavalos', side: 'w', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Nc3', 'Nf6'] },
    { eco: 'C48', name: 'Quatro Cavalos Espanhola', side: 'w', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Nc3', 'Nf6', 'Bb5'] },
    { eco: 'C50', name: 'Abertura Italiana', side: 'w', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4'] },
    { eco: 'C50', name: 'Italiana — Giuoco Pianissimo', side: 'w', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'd3', 'Nf6', 'c3', 'd6', 'O-O'] },
    { eco: 'C53', name: 'Italiana — Giuoco Piano', side: 'w', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'c3', 'Nf6', 'd4', 'exd4', 'cxd4'] },
    { eco: 'C51', name: 'Gambito Evans', side: 'w', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'b4', 'Bxb4', 'c3', 'Ba5'] },
    { eco: 'C55', name: 'Defesa dos Dois Cavalos', side: 'b', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6'] },
    { eco: 'C57', name: 'Italiana — Ataque Fried Liver / Polerio', side: 'w', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6', 'Ng5', 'd5', 'exd5', 'Na5'] },
    { eco: 'C58', name: 'Italiana — Dois Cavalos (5...Na5)', side: 'b', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6', 'Ng5', 'd5', 'exd5', 'Na5', 'Bb5+', 'c6'] },
    { eco: 'C60', name: 'Ruy López (Espanhola)', side: 'w', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5'] },
    { eco: 'C65', name: 'Ruy López — Defesa Berlim', side: 'b', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'Nf6', 'O-O', 'Nxe4'] },
    { eco: 'C68', name: 'Ruy López — Variante das Trocas', side: 'w', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Bxc6', 'dxc6'] },
    { eco: 'C70', name: 'Ruy López — Defesa Morphy', side: 'b', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Ba4', 'Nf6', 'O-O', 'Be7'] },
    { eco: 'C84', name: 'Ruy López Fechada', side: 'w', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Ba4', 'Nf6', 'O-O', 'Be7', 'Re1', 'b5', 'Bb3'] },

    // Sicilian Defense (1. e4 c5)
    { eco: 'B20', name: 'Defesa Siciliana', side: 'b', moves: ['e4', 'c5'] },
    { eco: 'B21', name: 'Siciliana — Gambito Smith-Morra', side: 'w', moves: ['e4', 'c5', 'd4', 'cxd4', 'c3'] },
    { eco: 'B22', name: 'Siciliana Alapin', side: 'w', moves: ['e4', 'c5', 'c3'] },
    { eco: 'B22', name: 'Siciliana Alapin (2...Nf6)', side: 'w', moves: ['e4', 'c5', 'c3', 'Nf6', 'e5', 'Nd5', 'd4', 'cxd4'] },
    { eco: 'B23', name: 'Siciliana Fechada', side: 'w', moves: ['e4', 'c5', 'Nc3', 'Nc6', 'g3', 'g6', 'Bg2', 'Bg7'] },
    { eco: 'B30', name: 'Siciliana Rossolimo', side: 'w', moves: ['e4', 'c5', 'Nf3', 'Nc6', 'Bb5'] },
    { eco: 'B32', name: 'Siciliana Aberta (2...Nc6)', side: 'b', moves: ['e4', 'c5', 'Nf3', 'Nc6', 'd4', 'cxd4', 'Nxd4'] },
    { eco: 'B33', name: 'Siciliana Sveshnikov', side: 'b', moves: ['e4', 'c5', 'Nf3', 'Nc6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'e5'] },
    { eco: 'B34', name: 'Siciliana Dragão Acelerado', side: 'b', moves: ['e4', 'c5', 'Nf3', 'Nc6', 'd4', 'cxd4', 'Nxd4', 'g6'] },
    { eco: 'B40', name: 'Siciliana Taimanov / Kan (2...e6)', side: 'b', moves: ['e4', 'c5', 'Nf3', 'e6', 'd4', 'cxd4', 'Nxd4', 'Nc6'] },
    { eco: 'B50', name: 'Siciliana Clássica (2...d6)', side: 'b', moves: ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3'] },
    { eco: 'B70', name: 'Siciliana Dragão', side: 'b', moves: ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'g6', 'Be3', 'Bg7'] },
    { eco: 'B90', name: 'Siciliana Najdorf', side: 'b', moves: ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'a6'] },
    { eco: 'B90', name: 'Siciliana Najdorf (Ataque Inglês)', side: 'w', moves: ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'a6', 'Be3', 'e5'] },

    // French, Caro-Kann, Scandinavian, Pirc, Alekhine
    { eco: 'C00', name: 'Defesa Francesa', side: 'b', moves: ['e4', 'e6'] },
    { eco: 'C01', name: 'Francesa — Variante das Trocas', side: 'w', moves: ['e4', 'e6', 'd4', 'd5', 'exd5', 'exd5'] },
    { eco: 'C02', name: 'Francesa — Variante do Avanço', side: 'w', moves: ['e4', 'e6', 'd4', 'd5', 'e5', 'c5', 'c3', 'Nc6', 'Nf3'] },
    { eco: 'C03', name: 'Francesa Tarrasch', side: 'w', moves: ['e4', 'e6', 'd4', 'd5', 'Nd2'] },
    { eco: 'C11', name: 'Francesa Clássica', side: 'b', moves: ['e4', 'e6', 'd4', 'd5', 'Nc3', 'Nf6'] },
    { eco: 'C15', name: 'Francesa Winawer', side: 'b', moves: ['e4', 'e6', 'd4', 'd5', 'Nc3', 'Bb4'] },
    { eco: 'B10', name: 'Defesa Caro-Kann', side: 'b', moves: ['e4', 'c6'] },
    { eco: 'B12', name: 'Caro-Kann — Variante do Avanço', side: 'w', moves: ['e4', 'c6', 'd4', 'd5', 'e5', 'Bf5', 'Nf3', 'e6'] },
    { eco: 'B13', name: 'Caro-Kann — Variante das Trocas', side: 'w', moves: ['e4', 'c6', 'd4', 'd5', 'exd5', 'cxd5', 'Bd3', 'Nc6'] },
    { eco: 'B14', name: 'Caro-Kann — Ataque Panov', side: 'w', moves: ['e4', 'c6', 'd4', 'd5', 'exd5', 'cxd5', 'c4', 'Nf6', 'Nc3'] },
    { eco: 'B18', name: 'Caro-Kann Clássica', side: 'b', moves: ['e4', 'c6', 'd4', 'd5', 'Nc3', 'dxe4', 'Nxe4', 'Bf5', 'Ng3', 'Bg6'] },
    { eco: 'B01', name: 'Defesa Escandinava', side: 'b', moves: ['e4', 'd5'] },
    { eco: 'B01', name: 'Escandinava (3...Qa5)', side: 'b', moves: ['e4', 'd5', 'exd5', 'Qxd5', 'Nc3', 'Qa5', 'd4', 'Nf6'] },
    { eco: 'B01', name: 'Escandinava Moderna (2...Nf6)', side: 'b', moves: ['e4', 'd5', 'exd5', 'Nf6', 'd4', 'Nxd5'] },
    { eco: 'B02', name: 'Defesa Alekhine', side: 'b', moves: ['e4', 'Nf6', 'e5', 'Nd5', 'd4', 'd6'] },
    { eco: 'B06', name: 'Defesa Moderna', side: 'b', moves: ['e4', 'g6', 'd4', 'Bg7'] },
    { eco: 'B07', name: 'Defesa Pirc', side: 'b', moves: ['e4', 'd6', 'd4', 'Nf6', 'Nc3', 'g6'] },

    // Queen's Pawn (1. d4)
    { eco: 'A40', name: 'Abertura do Peão da Dama', side: 'w', moves: ['d4'] },
    { eco: 'D00', name: 'Peão da Dama Simétrico (1.d4 d5)', side: 'b', moves: ['d4', 'd5'] },
    { eco: 'D02', name: 'Sistema London', side: 'w', moves: ['d4', 'd5', 'Bf4', 'Nf6', 'e3', 'c5', 'c3', 'Nc6', 'Nd2'] },
    { eco: 'D02', name: 'Sistema London (vs ...Nf6)', side: 'w', moves: ['d4', 'Nf6', 'Bf4', 'e6', 'e3', 'c5', 'c3'] },
    { eco: 'D00', name: 'Sistema Colle', side: 'w', moves: ['d4', 'd5', 'Nf3', 'Nf6', 'e3', 'e6', 'Bd3', 'c5', 'c3'] },
    { eco: 'D01', name: 'Ataque Trompowsky', side: 'w', moves: ['d4', 'Nf6', 'Bg5'] },
    { eco: 'D06', name: 'Gambito da Dama', side: 'w', moves: ['d4', 'd5', 'c4'] },
    { eco: 'D20', name: 'Gambito da Dama Aceito', side: 'b', moves: ['d4', 'd5', 'c4', 'dxc4', 'Nf3', 'Nf6', 'e3'] },
    { eco: 'D10', name: 'Defesa Eslava', side: 'b', moves: ['d4', 'd5', 'c4', 'c6', 'Nf3', 'Nf6', 'Nc3', 'dxc4'] },
    { eco: 'D43', name: 'Defesa Semi-Eslava', side: 'b', moves: ['d4', 'd5', 'c4', 'c6', 'Nf3', 'Nf6', 'Nc3', 'e6'] },
    { eco: 'D30', name: 'Gambito da Dama Recusado', side: 'b', moves: ['d4', 'd5', 'c4', 'e6', 'Nc3', 'Nf6', 'Bg5', 'Be7'] },
    { eco: 'D35', name: 'Gambito da Dama Recusado — Trocas', side: 'w', moves: ['d4', 'd5', 'c4', 'e6', 'Nc3', 'Nf6', 'cxd5', 'exd5', 'Bg5'] },
    { eco: 'D32', name: 'Defesa Tarrasch', side: 'b', moves: ['d4', 'd5', 'c4', 'e6', 'Nc3', 'c5'] },

    // Indian Defenses (1. d4 Nf6)
    { eco: 'A45', name: 'Defesa Índia', side: 'b', moves: ['d4', 'Nf6'] },
    { eco: 'A50', name: 'Defesa Índia (2.c4)', side: 'b', moves: ['d4', 'Nf6', 'c4'] },
    { eco: 'A57', name: 'Gambito Benko', side: 'b', moves: ['d4', 'Nf6', 'c4', 'c5', 'd5', 'b5'] },
    { eco: 'A60', name: 'Defesa Benoni Moderna', side: 'b', moves: ['d4', 'Nf6', 'c4', 'c5', 'd5', 'e6', 'Nc3', 'exd5', 'cxd5', 'd6'] },
    { eco: 'E00', name: 'Abertura Catalã', side: 'w', moves: ['d4', 'Nf6', 'c4', 'e6', 'g3', 'd5', 'Bg2'] },
    { eco: 'E12', name: 'Defesa Índia da Dama', side: 'b', moves: ['d4', 'Nf6', 'c4', 'e6', 'Nf3', 'b6', 'g3', 'Bb7'] },
    { eco: 'E15', name: 'Defesa Bogo-Índia', side: 'b', moves: ['d4', 'Nf6', 'c4', 'e6', 'Nf3', 'Bb4+'] },
    { eco: 'E20', name: 'Defesa Nimzo-Índia', side: 'b', moves: ['d4', 'Nf6', 'c4', 'e6', 'Nc3', 'Bb4'] },
    { eco: 'E32', name: 'Nimzo-Índia Clássica (4.Qc2)', side: 'w', moves: ['d4', 'Nf6', 'c4', 'e6', 'Nc3', 'Bb4', 'Qc2', 'O-O'] },
    { eco: 'E60', name: 'Defesa Índia do Rei', side: 'b', moves: ['d4', 'Nf6', 'c4', 'g6', 'Nc3', 'Bg7', 'e4', 'd6', 'Nf3', 'O-O'] },
    { eco: 'E70', name: 'Índia do Rei — Variante Clássica', side: 'b', moves: ['d4', 'Nf6', 'c4', 'g6', 'Nc3', 'Bg7', 'e4', 'd6', 'Nf3', 'O-O', 'Be2', 'e5'] },
    { eco: 'D80', name: 'Defesa Grünfeld', side: 'b', moves: ['d4', 'Nf6', 'c4', 'g6', 'Nc3', 'd5', 'cxd5', 'Nxd5', 'e4', 'Nxc3', 'bxc3', 'Bg7'] },

    // Flank Openings
    { eco: 'A10', name: 'Abertura Inglesa', side: 'w', moves: ['c4'] },
    { eco: 'A20', name: 'Inglesa — Siciliana Invertida (1.c4 e5)', side: 'w', moves: ['c4', 'e5', 'Nc3', 'Nf6', 'g3'] },
    { eco: 'A30', name: 'Inglesa Simétrica (1.c4 c5)', side: 'w', moves: ['c4', 'c5', 'Nc3', 'Nc6', 'g3', 'g6', 'Bg2', 'Bg7'] },
    { eco: 'A04', name: 'Abertura Réti', side: 'w', moves: ['Nf3', 'd5', 'c4', 'e6', 'g3', 'Nf6', 'Bg2'] },
    { eco: 'A07', name: 'Ataque Índio do Rei', side: 'w', moves: ['Nf3', 'd5', 'g3', 'Nf6', 'Bg2'] },
    { eco: 'A80', name: 'Defesa Holandesa', side: 'b', moves: ['d4', 'f5', 'g3', 'Nf6', 'Bg2', 'e6'] },
    { eco: 'A02', name: 'Abertura Bird', side: 'w', moves: ['f4', 'd5', 'Nf3', 'Nf6', 'e3'] },
    { eco: 'A00', name: 'Abertura Larsen (1.b3)', side: 'w', moves: ['b3', 'e5', 'Bb2', 'Nc6'] },
    { eco: 'A01', name: 'Ataque Nimzo-Larsen', side: 'w', moves: ['b3', 'd5', 'Bb2', 'Nf6', 'e3'] }
  ];

  // Fallback prefix dictionary
  const ECO_FALLBACK = {
    A00: 'Abertura Irregular',
    A04: 'Abertura Réti',
    A10: 'Abertura Inglesa',
    A40: 'Abertura do Peão da Dama',
    A45: 'Defesa Índia',
    A80: 'Defesa Holandesa',
    B00: 'Defesa do Peão do Rei',
    B01: 'Defesa Escandinava',
    B06: 'Defesa Moderna',
    B07: 'Defesa Pirc',
    B10: 'Defesa Caro-Kann',
    B20: 'Defesa Siciliana',
    C00: 'Defesa Francesa',
    C20: 'Jogo Aberto (1.e4 e5)',
    C40: 'Abertura do Cavalo do Rei',
    C50: 'Abertura Italiana',
    C60: 'Ruy López (Espanhola)',
    D00: 'Peão da Dama (1.d4 d5)',
    D06: 'Gambito da Dama',
    E00: 'Abertura Catalã',
    E20: 'Defesa Nimzo-Índia',
    E60: 'Defesa Índia do Rei'
  };

  function posKey(fen) {
    // Board + turn + castling rights (handles transpositions reliably)
    return fen.split(' ').slice(0, 3).join(' ');
  }

  // Lazy-build FEN transposition book
  let bookMap = null;

  function ensureBookBuilt() {
    if (bookMap) return bookMap;
    bookMap = new Map();
    if (typeof global.Chess !== 'function') return bookMap;

    for (const line of ECO_LINES) {
      const g = new global.Chess();
      let valid = true;
      for (let i = 0; i < line.moves.length; i++) {
        const keyBefore = posKey(g.fen());
        const san = line.moves[i];

        if (!bookMap.has(keyBefore)) {
          bookMap.set(keyBefore, {
            eco: line.eco,
            name: line.name,
            continuations: new Set()
          });
        }
        bookMap.get(keyBefore).continuations.add(san);

        const mv = g.move(san, { sloppy: true });
        if (!mv) {
          valid = false;
          break;
        }
        const keyAfter = posKey(g.fen());
        // Prefer more specific (deeper) opening name for the reached position
        const existing = bookMap.get(keyAfter);
        if (!existing || line.moves.length >= (existing.depth || 0)) {
          bookMap.set(keyAfter, {
            eco: line.eco,
            name: line.name,
            depth: i + 1,
            continuations: existing ? existing.continuations : new Set()
          });
        }
      }
      if (!valid) {
        console.warn('Invalid ECO line:', line.name);
      }
    }
    return bookMap;
  }

  function lookupPosition(fen) {
    const map = ensureBookBuilt();
    return map.get(posKey(fen)) || null;
  }

  function isBookMove(fenBefore, fenAfter, san, ply) {
    if (ply > 16) return false;
    const map = ensureBookBuilt();
    const beforeEntry = map.get(posKey(fenBefore));
    const afterEntry = map.get(posKey(fenAfter));
    if (afterEntry) return true;
    if (beforeEntry && beforeEntry.continuations.has(san)) return true;
    return false;
  }

  function detectOpeningFromMoves(movesHistory, pgnHeaders = {}) {
    const map = ensureBookBuilt();
    let bestMatch = null;
    if (Array.isArray(movesHistory)) {
      const g = new global.Chess();
      for (let i = 0; i < Math.min(movesHistory.length, 16); i++) {
        const mv = g.move(movesHistory[i]);
        if (!mv) break;
        const hit = map.get(posKey(g.fen()));
        if (hit && hit.name) {
          bestMatch = `${hit.name} (${hit.eco})`;
        }
      }
    }

    if (pgnHeaders.ECOUrl) {
      const m = pgnHeaders.ECOUrl.match(/\/openings\/([^/"]+)/i);
      if (m) {
        const clean = m[1].replace(/-/g, ' ').replace(/\b\d+\b.*/, '').trim();
        if (bestMatch) return bestMatch;
        if (clean) return pgnHeaders.ECO ? `${clean} (${pgnHeaders.ECO})` : clean.slice(0, 48);
      }
    }
    if (bestMatch) return bestMatch;
    if (pgnHeaders.Opening) {
      return pgnHeaders.ECO ? `${pgnHeaders.Opening} (${pgnHeaders.ECO})` : pgnHeaders.Opening;
    }
    if (pgnHeaders.ECO) {
      const code = pgnHeaders.ECO;
      if (ECO_FALLBACK[code]) return `${ECO_FALLBACK[code]} (${code})`;
      const pref = code.slice(0, 2) + '0';
      if (ECO_FALLBACK[pref]) return `${ECO_FALLBACK[pref]} (${code})`;
      return `Abertura ${code}`;
    }
    return 'Abertura Clássica';
  }

  // Filter curated repertoire lines (>= 4 moves) for Opening Trainer
  function getRepertoireDrills() {
    return ECO_LINES.filter((l) => l.moves.length >= 4).map((l, idx) => ({
      id: `eco_${idx}_${l.eco}`,
      eco: l.eco,
      name: l.name,
      side: l.side,
      moves: l.moves
    }));
  }

  CC.EcoBook = {
    ECO_LINES,
    lookupPosition,
    isBookMove,
    detectOpeningFromMoves,
    getRepertoireDrills
  };
})(window);
