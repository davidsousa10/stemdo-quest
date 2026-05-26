// App controller - manages screens, API calls, and game flow
const App = {
  currentPlayer: null,
  game: null,

  async init() {
    await Sprites.load();
    this.bindEvents();
    this.showScreen('register');
  },

  showScreen(name) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(`screen-${name}`).classList.add('active');

    if (name === 'game') this.initGame();
    if (name === 'ranking') this.loadRanking();
  },

  bindEvents() {
    // Registration
    document.getElementById('register-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.register();
    });

    // Game controls
    const canvas = document.getElementById('game-canvas');

    document.addEventListener('keydown', (e) => {
      if (!document.getElementById('screen-game').classList.contains('active')) return;
      if (e.code === 'Space') e.preventDefault();
      if (this.game && !this.game.gameOver) {
        this.game.jump();
        this.hideStartOverlay();
      }
    });

    canvas.addEventListener('mousedown', (e) => {
      e.preventDefault();
      if (this.game && !this.game.gameOver) {
        this.game.jump();
        this.hideStartOverlay();
      }
    });

    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (this.game && !this.game.gameOver) {
        this.game.jump();
        this.hideStartOverlay();
      }
    }, { passive: false });

    // Game over buttons
    document.getElementById('btn-retry').addEventListener('click', () => {
      this.showScreen('game');
    });

    document.getElementById('btn-ranking').addEventListener('click', () => {
      this.showScreen('ranking');
    });

    // Ranking buttons
    document.getElementById('btn-back-play').addEventListener('click', () => {
      if (this.currentPlayer && this.currentPlayer.attempts_left > 0) {
        this.showScreen('game');
      }
    });

    document.getElementById('btn-back-register').addEventListener('click', () => {
      this.currentPlayer = null;
      document.getElementById('player-name').value = '';
      document.getElementById('register-error').textContent = '';
      document.getElementById('register-returning').textContent = '';
      this.showScreen('register');
    });
  },

  hideStartOverlay() {
    document.getElementById('start-overlay').classList.add('hidden');
  },

  async register() {
    const name = document.getElementById('player-name').value.trim();
    const email = document.getElementById('player-email').value.trim();
    const errorEl = document.getElementById('register-error');
    const returningEl = document.getElementById('register-returning');

    errorEl.textContent = '';
    returningEl.textContent = '';

    if (!name) {
      errorEl.textContent = 'NOMBRE VACIO!';
      return;
    }

    if (!email) {
      errorEl.textContent = 'EMAIL VACIO!';
      return;
    }

    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email })
      });

      const data = await res.json();

      if (!res.ok) {
        errorEl.textContent = data.error.toUpperCase();
        return;
      }

      this.currentPlayer = {
        id: data.player_id,
        name: data.name,
        best_score: data.best_score,
        attempts_used: data.attempts_used,
        attempts_left: data.attempts_left
      };

      this.showScreen('game');
    } catch (err) {
      errorEl.textContent = 'ERROR DE CONEXION!';
    }
  },

  initGame() {
    if (this.game) this.game.destroy();

    const canvas = document.getElementById('game-canvas');
    this.game = new Game(canvas);

    const attempt = this.currentPlayer.attempts_used + 1;
    document.getElementById('hud-attempts').textContent = `INTENTO ${attempt}/3`;
    document.getElementById('hud-score').textContent = '0';
    document.getElementById('hud-best').textContent = `BEST: ${this.currentPlayer.best_score}`;

    document.getElementById('start-overlay').classList.remove('hidden');

    let lastScore = -1;
    const scoreCheck = setInterval(() => {
      if (!this.game || !this.game.running) {
        clearInterval(scoreCheck);
        return;
      }
      if (this.game.score !== lastScore) {
        lastScore = this.game.score;
        document.getElementById('hud-score').textContent = `${lastScore}`;
      }
    }, 100);

    this.game.onGameOver = (score) => {
      clearInterval(scoreCheck);
      this.submitScore(score);
    };

    this.game.start();
  },

  async submitScore(score) {
    try {
      const res = await fetch('/api/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player_id: this.currentPlayer.id, score })
      });

      const data = await res.json();
      if (res.ok) {
        this.currentPlayer.best_score = data.best_score;
        this.currentPlayer.attempts_used = data.attempts_used;
        this.currentPlayer.attempts_left = data.attempts_left;
      }
    } catch (err) {
      // Offline fallback
    }

    this.showGameOver(score);
  },

  showGameOver(score) {
    document.getElementById('go-score').textContent = score;
    document.getElementById('go-best').textContent = this.currentPlayer.best_score;

    const attemptsLeft = this.currentPlayer.attempts_left;
    const attemptsEl = document.getElementById('go-attempts');
    const retryBtn = document.getElementById('btn-retry');

    if (attemptsLeft > 0) {
      attemptsEl.textContent = `TE QUEDAN ${attemptsLeft} INTENTO${attemptsLeft > 1 ? 'S' : ''}`;
      retryBtn.disabled = false;
      retryBtn.textContent = 'REINTENTAR';
    } else {
      attemptsEl.textContent = 'SIN INTENTOS';
      retryBtn.disabled = true;
      retryBtn.textContent = 'SIN INTENTOS';
    }

    this.showScreen('gameover');
  },

  async loadRanking() {
    const listEl = document.getElementById('ranking-list');
    listEl.innerHTML = '<p style="color: #6a737d">CARGANDO...</p>';

    const playBtn = document.getElementById('btn-back-play');
    if (!this.currentPlayer || this.currentPlayer.attempts_left <= 0) {
      playBtn.disabled = true;
      playBtn.textContent = 'SIN INTENTOS';
    } else {
      playBtn.disabled = false;
      playBtn.textContent = 'JUGAR';
    }

    try {
      const res = await fetch('/api/ranking');
      const ranking = await res.json();

      if (ranking.length === 0) {
        listEl.innerHTML = '<p style="color: #aaa">SIN PUNTUACIONES</p>';
        return;
      }

      listEl.innerHTML = ranking.map((entry, i) => {
        const isCurrentPlayer = this.currentPlayer && entry.name === this.currentPlayer.name;
        const topClass = i < 3 ? `top-${i + 1}` : '';
        const currentClass = isCurrentPlayer ? 'current-player' : '';
        const medal = i === 0 ? '&#9733;' : i === 1 ? '&#9734;' : i === 2 ? '&#9672;' : '';

        return `
          <div class="ranking-entry ${topClass} ${currentClass}">
            <span class="rank">${medal} #${i + 1}</span>
            <span class="player-name">${this.escapeHtml(entry.name)}</span>
            <span class="player-score">${entry.best_score}</span>
          </div>
        `;
      }).join('');
    } catch (err) {
      listEl.innerHTML = '<p style="color: #ff6b6b">ERROR AL CARGAR</p>';
    }
  },

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
