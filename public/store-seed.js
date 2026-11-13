/* ============================================================================
 * ChessCoach Pro — Clean Seed & Curated Demo Games (Zero Personal Data)
 * ============================================================================ */
window.INITIAL_STORE_SEED = {
  version: 2,
  activeProfileId: null,
  profiles: {}
};

window.DEMO_GAMES = [
  {
    id: 'demo-opera-morphy-1858',
    white: 'Paul Morphy',
    black: 'Duque de Brunswick',
    whiteRating: 2600,
    blackRating: 1900,
    heroColor: 'w',
    heroOutcome: 'Vitória',
    result: '1-0',
    timeClass: 'classical',
    date: '1858 (Clássica)',
    opening: 'Defesa Philidor (C41)',
    pgn: `[Event "Opera Game (Paris)"]
[Site "Paris FRA"]
[Date "1858.11.02"]
[White "Paul Morphy"]
[Black "Duque de Brunswick"]
[Result "1-0"]
[ECO "C41"]

1. e4 e5 2. Nf3 d6 3. d4 Bg4 4. dxe5 Bxf3 5. Qxf3 dxe5 6. Bc4 Nf6 7. Qb3 Qe7 8. Nc3 c6 9. Bg5 b5 10. Nxb5 cxb5 11. Bxb5+ Nbd7 12. O-O-O Rd8 13. Rxd7 Rxd7 14. Rd1 Qe6 15. Bxd7+ Nxd7 16. Qb8+ Nxb8 17. Rd8# 1-0`
  },
  {
    id: 'demo-amateur-tactical-rapid',
    white: 'Jogador Demo',
    black: 'Rival Clube',
    whiteRating: 980,
    blackRating: 1015,
    heroColor: 'w',
    heroOutcome: 'Derrota',
    result: '0-1',
    timeClass: 'rapid',
    date: 'Partida Demo',
    opening: 'Abertura Italiana (C50)',
    pgn: `[Event "Partida Instrutivo-Tática Demo"]
[Site "ChessCoach Demo"]
[Date "2026.01.15"]
[White "Jogador Demo"]
[Black "Rival Clube"]
[WhiteElo "980"]
[BlackElo "1015"]
[TimeControl "600+0"]
[Result "0-1"]
[ECO "C50"]

1. e4 {[%clk 0:09:58]} 1... e5 {[%clk 0:09:56]} 2. Nf3 {[%clk 0:09:52]} 2... Nc6 {[%clk 0:09:50]} 3. Bc4 {[%clk 0:09:47]} 3... Bc5 {[%clk 0:09:45]} 4. c3 {[%clk 0:09:38]} 4... Nf6 {[%clk 0:09:36]} 5. d4 {[%clk 0:09:20]} 5... exd4 {[%clk 0:09:30]} 6. cxd4 {[%clk 0:09:16]} 6... Bb4+ {[%clk 0:09:22]} 7. Bd2 {[%clk 0:08:50]} 7... Bxd2+ {[%clk 0:09:10]} 8. Nbxd2 {[%clk 0:08:45]} 8... d5 {[%clk 0:08:55]} 9. exd5 {[%clk 0:08:30]} 9... Nxd5 {[%clk 0:08:48]} 10. Qb3 {[%clk 0:08:15]} 10... Nce7 {[%clk 0:08:25]} 11. O-O {[%clk 0:07:55]} 11... O-O {[%clk 0:08:12]} 12. Rfe1 {[%clk 0:07:32]} 12... c6 {[%clk 0:07:58]} 13. Ne4 {[%clk 0:07:10]} 13... b5 {[%clk 0:07:35]} 14. Bd3 {[%clk 0:06:58]} 14... Nf4 {[%clk 0:07:12]} 15. Bb1 {[%clk 0:06:55]} 15... Be6 {[%clk 0:06:50]} 16. Qc2 {[%clk 0:06:52]} 16... Bf5 {[%clk 0:06:32]} 17. Nh4 {[%clk 0:06:49]} 17... Bxe4 {[%clk 0:06:15]} 18. Qxe4 {[%clk 0:06:47]} 18... Neg6 {[%clk 0:05:55]} 19. Nxg6 {[%clk 0:06:44]} 19... Nxg6 {[%clk 0:05:45]} 20. Qxc6 {[%clk 0:06:41]} 20... Qxd4 {[%clk 0:05:30]} 21. Qxb5 {[%clk 0:06:38]} 21... Rab8 {[%clk 0:05:10]} 22. Qe2 {[%clk 0:06:35]} 22... Rxb2 {[%clk 0:04:55]} 23. Qf3 {[%clk 0:06:32]} 23... Rxf2 {[%clk 0:04:30]} 24. Qxf2 {[%clk 0:06:30]} 24... Qxa1 {[%clk 0:04:22]} 0-1`
  },
  {
    id: 'demo-capablanca-tartakower-1924',
    white: 'José Raúl Capablanca',
    black: 'Savielly Tartakower',
    whiteRating: 2725,
    blackRating: 2610,
    heroColor: 'w',
    heroOutcome: 'Vitória',
    result: '1-0',
    timeClass: 'classical',
    date: '1924 (Clássica)',
    opening: 'Defesa Holandesa (A80)',
    pgn: `[Event "New York"]
[Site "New York, NY USA"]
[Date "1924.03.23"]
[White "Jose Raul Capablanca"]
[Black "Savielly Tartakower"]
[Result "1-0"]
[ECO "A80"]

1. d4 f5 2. Nf3 e6 3. c4 Nf6 4. Bg5 Be7 5. Nc3 O-O 6. e3 b6 7. Bd3 Bb7 8. O-O Qe8 9. Qe2 Ne4 10. Bxe7 Nxc3 11. bxc3 Qxe7 12. a4 Bxf3 13. Qxf3 Nc6 14. Rfb1 Rae8 15. Qh3 Rf6 16. f4 Na5 17. Qf3 d6 18. Re1 Qd7 19. e4 fxe4 20. Qxe4 g6 21. g3 Kf8 22. Kg2 Rf7 23. h4 d5 24. cxd5 exd5 25. Qxe8+ Qxe8 26. Rxe8+ Kxe8 27. h5 Rf6 28. hxg6 hxg6 29. Rh1 Kf8 30. Rh7 Rc6 31. g4 Nc4 32. g5 Ne3+ 33. Kf3 Nf5 34. Bxf5 gxf5 35. Kg3 Rxc3+ 36. Kh4 Rf3 37. g6 Rxf4+ 38. Kg5 Re4 39. Kf6 Kg8 40. Rg7+ Kh8 41. Rxc7 Re8 42. Kxf5 Re4 43. Kf6 Rf4+ 44. Ke5 Rg4 45. g7+ Kg8 46. Rxa7 Rg1 47. Kxd5 Rc1 48. Kd6 Rc2 49. d5 Rc1 50. Rc7 Ra1 51. Kc6 Rxa4 52. d6 1-0`
  }
];
