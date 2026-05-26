// Sprite loader and drawing for the duck character
const Sprites = {
  images: {},
  loaded: false,

  load() {
    return new Promise((resolve) => {
      const files = {
        wingsUp: 'assets/pixil-frame-0.png',
        wingsDown: 'assets/pixil-frame-1.png',
        crashed: 'assets/pixil-frame-2.png',
        body: 'assets/pixil-frame-3.png',
        head: 'assets/pixil-frame-4.png',
        background: 'assets/background.png'
      };

      let count = 0;
      const total = Object.keys(files).length;

      for (const [key, src] of Object.entries(files)) {
        const img = new Image();
        img.onload = () => {
          count++;
          if (count === total) {
            this.loaded = true;
            resolve();
          }
        };
        img.src = src;
        this.images[key] = img;
      }
    });
  },

  // Draw the duck player - wings up only when flapping
  drawPlayer(ctx, x, y, width, height, angle, state, flapping) {
    ctx.save();
    ctx.translate(x + width / 2, y + height / 2);
    ctx.rotate(angle);
    ctx.imageSmoothingEnabled = false;

    let img;
    if (state === 'crashed') {
      img = this.images.crashed;
    } else {
      img = flapping ? this.images.wingsUp : this.images.wingsDown;
    }

    if (img) {
      ctx.drawImage(img, -width / 2, -height / 2, width, height);
    }

    ctx.restore();
  },

  // Draw the body (stays still after bouncing)
  drawBody(ctx, x, y, width, height, angle) {
    ctx.save();
    ctx.translate(x + width / 2, y + height / 2);
    ctx.rotate(angle);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.images.body, -width / 2, -height / 2, width, height);
    ctx.restore();
  },

  // Draw the head (rolls forward after crash)
  // Rotates around the visual center of the head content (bottom-right of sprite)
  drawHead(ctx, x, y, width, height, angle) {
    ctx.save();
    // Head content center within the 30x30 sprite is ~(22, 23) → (0.73, 0.77)
    const pivotX = x + width * 0.73;
    const pivotY = y + height * 0.77;
    ctx.translate(pivotX, pivotY);
    ctx.rotate(angle);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.images.head, -width * 0.73, -height * 0.77, width, height);
    ctx.restore();
  },

  // Draw Mario Bros style green pixel art pipe
  drawObstacle(ctx, x, y, width, height, isTop) {
    ctx.save();

    const px = 4; // pixel size for blocky look
    const lipH = 28; // lip/cap height
    const lipOverhang = 12; // how much wider the lip is on each side

    // Colors - Mario green palette
    const darkGreen = '#1a5c1a';
    const mainGreen = '#2d8b2d';
    const lightGreen = '#4ec44e';
    const highlight = '#6ede6e';
    const shadow = '#0e3f0e';

    // --- Pipe body ---
    const bodyX = x;
    const bodyW = width;
    let bodyY, bodyH;

    if (isTop) {
      bodyY = y;
      bodyH = height - lipH;
    } else {
      bodyY = y + lipH;
      bodyH = height - lipH;
    }

    // Main body fill
    ctx.fillStyle = mainGreen;
    ctx.fillRect(bodyX, bodyY, bodyW, bodyH);

    // Left highlight stripe
    ctx.fillStyle = lightGreen;
    ctx.fillRect(bodyX + px, bodyY, px * 3, bodyH);

    // Center highlight
    ctx.fillStyle = highlight;
    ctx.fillRect(bodyX + px * 4, bodyY, px * 2, bodyH);

    // Right dark stripe
    ctx.fillStyle = darkGreen;
    ctx.fillRect(bodyX + bodyW - px * 4, bodyY, px * 3, bodyH);

    // Far right shadow
    ctx.fillStyle = shadow;
    ctx.fillRect(bodyX + bodyW - px, bodyY, px, bodyH);

    // Far left shadow
    ctx.fillStyle = shadow;
    ctx.fillRect(bodyX, bodyY, px, bodyH);

    // --- Lip/cap ---
    const lipX = x - lipOverhang;
    const lipW = width + lipOverhang * 2;
    let lipY;

    if (isTop) {
      lipY = y + height - lipH;
    } else {
      lipY = y;
    }

    // Lip main fill
    ctx.fillStyle = mainGreen;
    ctx.fillRect(lipX, lipY, lipW, lipH);

    // Lip left highlight
    ctx.fillStyle = lightGreen;
    ctx.fillRect(lipX + px, lipY + px, px * 3, lipH - px * 2);

    // Lip center highlight
    ctx.fillStyle = highlight;
    ctx.fillRect(lipX + px * 4, lipY + px, px * 2, lipH - px * 2);

    // Lip right dark
    ctx.fillStyle = darkGreen;
    ctx.fillRect(lipX + lipW - px * 5, lipY + px, px * 4, lipH - px * 2);

    // Lip shadow right edge
    ctx.fillStyle = shadow;
    ctx.fillRect(lipX + lipW - px, lipY, px, lipH);

    // Lip shadow left edge
    ctx.fillStyle = shadow;
    ctx.fillRect(lipX, lipY, px, lipH);

    // Lip top border
    ctx.fillStyle = shadow;
    ctx.fillRect(lipX, lipY, lipW, px);

    // Lip bottom border
    ctx.fillStyle = shadow;
    ctx.fillRect(lipX, lipY + lipH - px, lipW, px);

    // Horizontal lines on body for pixel detail
    ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
    for (let ly = bodyY; ly < bodyY + bodyH; ly += px * 4) {
      ctx.fillRect(bodyX, ly, bodyW, px);
    }

    ctx.restore();
  },

  // Draw background - pixel art sky
  drawBackground(ctx, width, height, scrollOffset) {
    const bg = this.images.background;
    if (!bg) return;

    ctx.imageSmoothingEnabled = false;

    // Tile the background horizontally with parallax scroll
    const bgW = bg.width * (height / bg.height); // scale to fill height
    const offset = -(scrollOffset * 0.3) % bgW;

    for (let x = offset; x < width; x += bgW) {
      ctx.drawImage(bg, x, 0, bgW, height);
    }
  },

  // Draw ground
  drawGround(ctx, width, height, groundY, scrollOffset) {
    // Grass-green ground to match Mario theme
    ctx.fillStyle = '#3a8a3a';
    ctx.fillRect(0, groundY, width, 4);

    // Brown earth below
    ctx.fillStyle = '#8B5E3C';
    ctx.fillRect(0, groundY + 4, width, height - groundY - 4);

    // Darker brown bottom layer
    ctx.fillStyle = '#6B3F1F';
    ctx.fillRect(0, groundY + 20, width, height - groundY - 20);

    // Pixel dirt pattern
    ctx.fillStyle = '#9B6E4C';
    const px = 8;
    for (let x = -scrollOffset % (px * 4); x < width; x += px * 4) {
      ctx.fillRect(x, groundY + 8, px * 2, px);
      ctx.fillRect(x + px * 2, groundY + 16, px, px);
    }
  },

  // Particle helpers
  createParticle(x, y) {
    return {
      x, y,
      vx: (Math.random() - 0.5) * 6,
      vy: (Math.random() - 0.5) * 6,
      life: 1,
      color: Math.random() > 0.5 ? '#4ec44e' : '#ffd700',
      size: Math.random() * 5 + 2
    };
  },

  drawParticle(ctx, p) {
    ctx.fillStyle = p.color;
    ctx.globalAlpha = p.life;
    ctx.fillRect(p.x, p.y, p.size, p.size);
    ctx.globalAlpha = 1;
  }
};
