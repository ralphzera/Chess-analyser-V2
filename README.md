# ♟️ ChessCoach Pro v2 — Analisador MultiPV, Academia de Treinos & Desenvolvimento

Software **100% gratuito, offline-ready e multi-usuário** para importar partidas do **Chess.com**, **Lichess.org** ou **arquivos PGN**, analisar cada lance com **Stockfish MultiPV 3**, diagnosticar padrões táticos e gestão de tempo (`[%clk]`) e evoluir com uma **Academia de Treinos completa**.

---

## ✨ Funcionalidades da Versão 2.0

### 🔍 Motor de Análise & Precisão v2
- **Stockfish MultiPV 3 + Hash 16MB**: Avalia e exibe as **3 melhores linhas candidatas** por posição, eliminando oscilações entre profundidades e melhorando a precisão **CAPS2**.
- **Livro Teórico ECO Real com Transposições**: 99 linhas e variantes ECO mapeadas por FEN (`public/js/eco-book.js`), evitando que lances teóricos de abertura sejam punidos como erro.
- **Detecção Precisa de Classificações**:
  - `!!` **Brilhante** (verificação real de sacrifício líquido de material via SEE, sem falsos positivos em trocas iguais)
  - `!` **Grande Lance** (diferença real para o 2º melhor lance via MultiPV ou virada tática)
  - `★` **Melhor**, `👍` **Excelente**, `✓` **Bom**, `📖` **Teórico (Livro)**
  - `?!` **Imprecisão**, `?` **Erro**, `🎯` **Vitória Perdida** e `??` **Capivara**
- **Tabuleiro Interativo + Sandbox ("E se eu jogasse...?")**: Arraste ou clique nas peças em qualquer momento da partida para explorar variações com **Stockfish ao vivo**.
- **Análise de Relógio (`[%clk]`) & Temas Táticos**: Identifica **Peça Pendurada**, **Garfo**, **Captura Perdida**, **Mate Perdido/Permitido**, **Segurança do Rei**, **Apuro de Tempo** e **Erros Apressados (<3.5s)**.

### 🎯 Academia de Treino & Desenvolvimento
- **Treino dos Meus Erros (Repetição Espaçada SM-2 / SRS)**: Transforma automaticamente seus erros em exercícios multi-lance ordenados por revisão diária e filtráveis por tema tático.
- **Treinador de Repertório de Aberturas**: Pratique suas aberturas favoritas lance a lance contra o computador.
- **Finais & Táticas Guiadas**: Exercícios essenciais (Mate de Dama/Torre, Oposição, Ponte de Lucena, Defesa de Philidor, Sacrifício Grego) contra o Stockfish no nível máximo.
- **Sparring vs Coach**: Jogue contra o bot calibrado (450 a 2500 Elo) com o **Alerta de Capivara** ligado ou assuma qualquer posição direto de uma partida analisada.

### 📊 Central de Desenvolvimento & Divulgação
- **Radar de 6 Habilidades** (Abertura, Tática, Posicional, Finais, Tempo, Defesa) + **Elo de Performance Estimado** + **Plano Semanal Personalizado**.
- **Suporte Multi-Perfil Local**: Cada amigo pode criar/alternar seu próprio perfil ou importar backup JSON.
- **Card PNG & PGN Comentado**: Gere um card visual da partida para mandar no WhatsApp/Discord ou exporte PGN completo anotado.

---

## 🌐 Como Divulgar Online para Amigos (Link Gratuito)

O projeto já está configurado com redirecionamento na raiz (`index.html`), `.nojekyll`, `netlify.toml` e `vercel.json`:

1. **GitHub Pages** (100% gratuito):
   - No seu repositório do GitHub, acesse **Settings → Pages → Source: `Deploy from a branch` → Branch: `main` / `/ (root)`**.
   - Em ~1 minuto seu link público estará no ar para compartilhar com qualquer amigo!
2. **Netlify ou Vercel**:
   - Basta conectar o repositório — a pasta `public` já está configurada automaticamente.

---

## 💻 Como Usar Localmente no Windows (Zero Instalação)

- **Modo Aplicativo Desktop**: Dê **2 cliques** em `ChessCoach-App.vbs` (ou `iniciar.bat`). Funciona até sem internet!
- **Com Servidor Node.js (Opcional)**:
  ```bash
  node server.js
  ```
  Acesse `http://localhost:3000`.
