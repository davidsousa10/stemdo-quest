class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.running = false;
    this.started = false;
    this.gameOver = false;
    this.score = 0;
    this.scrollOffset = 0;
    this.particles = [];
    this.onGameOver = null;

    // Game constants
    this.GRAVITY = 0.7;
    this.JUMP_FORCE = -12;
    this.PIPE_WIDTH = 120;
    this.PIPE_GAP = 300;
    this.PIPE_SPEED = 3;
    this.PIPE_INTERVAL = 500;
    this.GROUND_HEIGHT = 80;

    // Player
    this.player = {
      x: 0, y: 0,
      width: 200, height: 170,
      vy: 0, vx: 0,
      angle: 0,
      state: 'alive', // 'alive' | 'crashed' | 'bouncing' | 'split'
      flapTimer: 0 // frames remaining with wings up
    };

    // Death animation state
    this.death = {
      bounceCount: 0,
      maxBounces: 2,
      phase: 'falling', // 'falling' | 'split'
      // Head (frame 3) rolls forward after split
      headX: 0, headY: 0, headVx: 0, headAngle: 0,
      // Body (frame 4) stays still after split
      bodyX: 0, bodyY: 0,
      timer: 0,
      gameOverSent: false
    };

    // Pipes
    this.pipes = [];
    this.pipeTimer = 0;

    this.resize();
    this._boundResize = () => this.resize();
    window.addEventListener('resize', this._boundResize);
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.scale(dpr, dpr);
    this.width = rect.width;
    this.height = rect.height;
    this.groundY = this.height - this.GROUND_HEIGHT;
    this.PIPE_GAP = Math.max(280, Math.min(380, this.height * 0.45));

    // Scale player and pipes to screen size
    const scale = Math.min(this.width / 800, this.height / 600);
    this.player.width = 200 * scale;
    this.player.height = 170 * scale;
    this.PIPE_WIDTH = 120 * scale;

    if (!this.started) {
      this.player.x = this.width * 0.2;
      this.player.y = this.height * 0.4;
    }
  }

  reset() {
    this.running = false;
    this.started = false;
    this.gameOver = false;
    this.score = 0;
    this.scrollOffset = 0;
    this.pipes = [];
    this.particles = [];
    this.pipeTimer = 0;

    this.player.x = this.width * 0.2;
    this.player.y = this.height * 0.4;
    this.player.vy = 0;
    this.player.vx = 0;
    this.player.angle = 0;
    this.player.state = 'alive';
    this.player.flapTimer = 0;

    this.death.bounceCount = 0;
    this.death.phase = 'falling';
    this.death.timer = 0;
    this.death.gameOverSent = false;
    this.death.preSpin = false;
    this.death.preSpinTimer = 0;
    this.death.headAngle = 0;
  }

  start() {
    this.reset();
    // Pre-spawn pipes visible before pressing space
    for (let x = this.width * 0.7; x < this.width + this.PIPE_INTERVAL; x += this.PIPE_INTERVAL) {
      const minTop = 40;
      const maxTop = this.groundY - this.PIPE_GAP - 40;
      const topHeight = minTop + Math.random() * (maxTop - minTop);
      this.pipes.push({ x, topHeight, bottomY: topHeight + this.PIPE_GAP, scored: false });
    }
    this.running = true;
    this.lastTime = performance.now();
    this.loop();
  }

  beginPlay() {
    if (this.started) return;
    this.started = true;
    // Account for pre-spawned pipes: last one is near the right edge,
    // so reset timer to wait a full interval before spawning the next
    const lastPipe = this.pipes[this.pipes.length - 1];
    const distFromRight = lastPipe ? this.width - lastPipe.x : this.PIPE_INTERVAL;
    this.pipeTimer = distFromRight;
    this.jump();
  }

  jump() {
    if (this.gameOver || this.player.state !== 'alive') return;
    if (!this.started) {
      this.beginPlay();
      return;
    }
    this.player.vy = this.JUMP_FORCE;
    this.player.flapTimer = 10; // wings up for ~10 frames
  }

  loop() {
    if (!this.running) return;

    const now = performance.now();
    const dt = Math.min((now - this.lastTime) / 16.67, 2);
    this.lastTime = now;

    this.update(dt);
    this.draw();

    requestAnimationFrame(() => this.loop());
  }

  update(dt) {
    const p = this.player;

    // Idle floating before start
    if (!this.started) {
      p.y += Math.sin(Date.now() / 400) * 0.3;
      this.scrollOffset += 0.5 * dt;
      return;
    }

    // Death animation
    if (p.state === 'dead') {
      this.updateDeath(dt);
      return;
    }

    // Normal gameplay
    if (p.flapTimer > 0) p.flapTimer -= dt;
    p.vy += this.GRAVITY * dt;
    p.y += p.vy * dt;

    const targetAngle = Math.min(Math.max(p.vy * 0.04, -0.5), 0.8);
    p.angle += (targetAngle - p.angle) * 0.1 * dt;

    const speed = (this.PIPE_SPEED + this.score * 0.05) * dt;
    this.scrollOffset += speed;

    // Generate pipes
    this.pipeTimer += speed;
    if (this.pipeTimer >= this.PIPE_INTERVAL) {
      // Only spawn if the last pipe is far enough away
      const lastPipe = this.pipes[this.pipes.length - 1];
      if (!lastPipe || lastPipe.x < this.width - this.PIPE_WIDTH * 2) {
        this.pipeTimer = 0;
        this.spawnPipe();
      }
    }

    // Update pipes
    for (let i = this.pipes.length - 1; i >= 0; i--) {
      const pipe = this.pipes[i];
      pipe.x -= speed;

      if (!pipe.scored && pipe.x + this.PIPE_WIDTH < p.x) {
        pipe.scored = true;
        this.score++;
        for (let j = 0; j < 8; j++) {
          this.particles.push(Sprites.createParticle(p.x + p.width, p.y + p.height / 2));
        }
      }

      if (pipe.x + this.PIPE_WIDTH < -10) {
        this.pipes.splice(i, 1);
      }
    }

    // Particles
    this.updateParticles(dt);

    // Collision
    this.checkCollisions();
  }

  updateDeath(dt) {
    const p = this.player;
    const d = this.death;

    if (d.phase === 'split') {
      const spinDuration = 120;
      d.timer += dt;

      if (d.timer < spinDuration) {
        const progress = d.timer / spinDuration;
        // Ease out — fast start, slow finish
        const eased = 1 - Math.pow(1 - progress, 4);
        // Base rotation 720°
        const baseAngle = eased * (Math.PI * 4);
        // Wobble: head is not round, so it speeds up/slows down per revolution
        // Sine wobble tied to current angle gives natural uneven rolling
        const wobble = Math.sin(baseAngle * 2) * 0.15 * (1 - progress);
        d.headAngle = baseAngle + wobble;
        d.headX = d.bodyX + eased * 80;
      } else {
        d.headAngle = Math.PI * 4;
        d.headX = d.bodyX + 80;
      }

      if (d.timer > spinDuration + 30 && !d.gameOverSent) {
        d.gameOverSent = true;
        this.gameOver = true;
        if (this.onGameOver) {
          this.onGameOver(this.score);
        }
      }
    } else {
      // Falling + bouncing phase
      p.vy += this.GRAVITY * 1.2 * dt;
      p.y += p.vy * dt;
      p.x += p.vx * dt;

      // Hit the ground
      if (p.y + p.height * 0.75 >= this.groundY) {
        p.y = this.groundY - p.height * 0.75;
        d.bounceCount++;

        if (d.bounceCount > d.maxBounces) {
          // Done bouncing -> split into body + head
          // Both start superimposed, head already has pre-spin angle
          d.phase = 'split';
          d.bodyX = p.x;
          d.bodyY = this.groundY - p.height * 0.75;
          d.headX = p.x;
          d.headY = this.groundY - p.height * 0.75;
          d.headVx = 0;
          // Keep pre-spin angle accumulated during last bounce
          d.timer = 0;
          p.vy = 0;
          p.vx = 0;
        } else {
          // Bounce with decreasing force
          const bounceFactor = 0.4 / d.bounceCount;
          p.vy = -Math.abs(p.vy) * bounceFactor;
          p.vx *= 0.75;
          for (let i = 0; i < 4; i++) {
            this.particles.push(Sprites.createParticle(p.x + p.width / 2, this.groundY));
          }
        }
      }
    }

    this.updateParticles(dt);
  }

  updateParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= 0.025 * dt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }
  }

  spawnPipe() {
    const minGap = this.player.height * 1.2;
    const gap = Math.max(minGap, this.PIPE_GAP * Math.pow(0.95, this.score));
    const minTop = 40;
    const maxTop = Math.max(minTop + 10, this.groundY - gap - 40);
    const topHeight = minTop + Math.random() * (maxTop - minTop);

    this.pipes.push({
      x: this.width + 10,
      topHeight,
      bottomY: topHeight + gap,
      scored: false
    });
  }

  checkCollisions() {
    const p = this.player;
    const padPlayer = 15; // shrink player hitbox
    const padPipeX = 30;  // shrink pipe hitbox horizontally
    const padPipeY = 40;  // shrink pipe hitbox vertically (more forgiving gap)

    // Floor/ceiling
    if (p.y + p.height > this.groundY || p.y < 0) {
      this.die();
      return;
    }

    // Pipes - hitbox smaller than visual
    for (const pipe of this.pipes) {
      if (p.x + p.width - padPlayer > pipe.x + padPipeX && p.x + padPlayer < pipe.x + this.PIPE_WIDTH - padPipeX) {
        if (p.y + padPlayer < pipe.topHeight - padPipeY || p.y + p.height - padPlayer > pipe.bottomY + padPipeY) {
          this.die();
          return;
        }
      }
    }
  }

  die() {
    const p = this.player;
    p.state = 'dead';
    p.angle = 0; // no rotation

    // Keep forward momentum, let gravity pull down
    p.vx = this.PIPE_SPEED + this.score * 0.05;
    // Don't reset vy - keep current falling speed for natural fall

    this.death.bounceCount = 0;
    this.death.phase = 'falling';
    this.death.timer = 0;
    this.death.gameOverSent = false;
    this.death.preSpin = false;
    this.death.preSpinTimer = 0;
    this.death.headAngle = 0;

    if (p.y + p.height > this.groundY) {
      p.y = this.groundY - p.height;
    }
    if (p.y < 0) p.y = 0;

    for (let i = 0; i < 10; i++) {
      this.particles.push(Sprites.createParticle(p.x + p.width / 2, p.y + p.height / 2));
    }
  }

  draw() {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    const p = this.player;

    // Background
    Sprites.drawBackground(ctx, w, h, this.scrollOffset);

    // Ground
    Sprites.drawGround(ctx, w, h, this.groundY, this.scrollOffset);

    // Pipes
    for (const pipe of this.pipes) {
      Sprites.drawObstacle(ctx, pipe.x, 0, this.PIPE_WIDTH, pipe.topHeight, true);
      Sprites.drawObstacle(ctx, pipe.x, pipe.bottomY, this.PIPE_WIDTH, this.groundY - pipe.bottomY, false);
    }

    // Particles
    for (const pt of this.particles) {
      Sprites.drawParticle(ctx, pt);
    }

    // Player
    if (p.state === 'dead' && this.death.phase === 'split') {
      const d = this.death;
      Sprites.drawBody(ctx, d.bodyX, d.bodyY, p.width, p.height, 0);
      Sprites.drawHead(ctx, d.headX, d.headY, p.width, p.height, d.headAngle);
    } else {
      const spriteState = (p.state === 'dead') ? 'crashed' : 'alive';
      Sprites.drawPlayer(ctx, p.x, p.y, p.width, p.height, p.angle, spriteState, p.flapTimer > 0);
    }
  }

  destroy() {
    this.running = false;
    window.removeEventListener('resize', this._boundResize);
  }
}
