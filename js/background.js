// ═══════════════════════════════════════════════════════
//  PIXEL ART DUNGEON BACKGROUND — background.js
// ═══════════════════════════════════════════════════════
(function(){
  const canvas = document.getElementById('bg-canvas');
  if(!canvas) return;
  const ctx = canvas.getContext('2d');

  // Palette
  const STONE_DARK  = '#1a1510';
  const STONE_MID   = '#2a2018';
  const STONE_LIGHT = '#3a2e22';
  const STONE_CRACK = '#120e08';
  const FLOOR_DARK  = '#0e0c08';
  const FLOOR_MID   = '#181410';
  const MORTAR      = '#0a0806';
  const TORCH_WALL  = '#3a2a18';

  function resize(){
    canvas.width  = canvas.offsetWidth  || window.innerWidth;
    canvas.height = canvas.offsetHeight || window.innerHeight;
    draw();
  }

  function draw(){
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    // Background fill
    ctx.fillStyle = '#090705';
    ctx.fillRect(0, 0, W, H);

    // Stone floor (bottom 35%)
    const floorY = H * 0.65;
    drawFloor(W, H, floorY);

    // Back wall (top 65%)
    drawWall(W, H, floorY);

    // Wall arch
    drawArch(W, H, floorY);

    // Torches
    drawTorch(W * 0.18, H * 0.32);
    drawTorch(W * 0.82, H * 0.32);

    // Vignette overlay
    drawVignette(W, H);
  }

  function drawWall(W, H, floorY){
    // Stone brick pattern on back wall
    const brickW = Math.max(28, Math.floor(W / 22));
    const brickH = Math.max(12, Math.floor(H / 32));
    const mortar = 2;

    for(let row = 0; row * brickH < floorY + brickH; row++){
      const offset = (row % 2 === 0) ? 0 : brickW / 2;
      for(let col = -1; col * brickW < W + brickW; col++){
        const x = Math.floor(col * brickW + offset);
        const y = Math.floor(row * brickH);
        const w = brickW - mortar;
        const h = brickH - mortar;
        // Vary brick color slightly
        const vary = (Math.sin(row * 7 + col * 13) * 0.5 + 0.5);
        const shade = vary > 0.7 ? STONE_LIGHT : vary > 0.4 ? STONE_MID : STONE_DARK;
        ctx.fillStyle = shade;
        ctx.fillRect(x + mortar, y + mortar, w, h);
        // Mortar gap
        ctx.fillStyle = MORTAR;
        ctx.fillRect(x, y, w + mortar, mortar);
        ctx.fillRect(x, y, mortar, h + mortar);
        // Occasional crack
        if(vary < 0.08){
          ctx.strokeStyle = STONE_CRACK;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x + w * 0.3, y + mortar + 2);
          ctx.lineTo(x + w * 0.5, y + h * 0.6);
          ctx.lineTo(x + w * 0.6, y + h);
          ctx.stroke();
        }
      }
    }
  }

  function drawFloor(W, H, floorY){
    const tileW = Math.max(24, Math.floor(W / 18));
    const tileH = Math.max(10, Math.floor(H / 28));
    for(let row = 0; row * tileH < H - floorY + tileH; row++){
      for(let col = 0; col * tileW < W + tileW; col++){
        const x = Math.floor(col * tileW);
        const y = Math.floor(floorY + row * tileH);
        const vary = (Math.sin(row * 5 + col * 11) * 0.5 + 0.5);
        ctx.fillStyle = vary > 0.6 ? FLOOR_MID : FLOOR_DARK;
        ctx.fillRect(x + 1, y + 1, tileW - 2, tileH - 2);
        ctx.fillStyle = MORTAR;
        ctx.fillRect(x, y, tileW, 1);
        ctx.fillRect(x, y, 1, tileH);
      }
    }
    // Floor shadow at wall base
    const grad = ctx.createLinearGradient(0, floorY - 20, 0, floorY + 20);
    grad.addColorStop(0, 'rgba(0,0,0,0.6)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, floorY - 20, W, 40);
  }

  function drawArch(W, H, floorY){
    // Stone archway frame
    const archW = W * 0.55;
    const archX = (W - archW) / 2;
    const archTop = H * 0.05;
    const archBot = floorY;
    const cornerR = archW * 0.4;

    ctx.strokeStyle = '#4a3828';
    ctx.lineWidth = Math.max(6, W * 0.012);
    ctx.beginPath();
    ctx.moveTo(archX, archBot);
    ctx.lineTo(archX, archTop + cornerR);
    ctx.arcTo(archX, archTop, archX + cornerR, archTop, cornerR);
    ctx.lineTo(archX + archW - cornerR, archTop);
    ctx.arcTo(archX + archW, archTop, archX + archW, archTop + cornerR, cornerR);
    ctx.lineTo(archX + archW, archBot);
    ctx.stroke();

    // Inner arch shadow
    ctx.strokeStyle = '#1a1008';
    ctx.lineWidth = Math.max(3, W * 0.005);
    ctx.stroke();
  }

  let torchPhase = 0;

  function drawTorch(cx, cy){
    const flickerScale = 0.85 + Math.sin(torchPhase * 3.7 + cx) * 0.15;

    // Wall bracket
    ctx.fillStyle = TORCH_WALL;
    ctx.fillRect(cx - 4, cy - 2, 8, 18);

    // Torch handle
    ctx.fillStyle = '#5a3a18';
    ctx.fillRect(cx - 2, cy + 4, 4, 12);

    // Flame (layered, flickering)
    const fh = 18 * flickerScale;
    const fw = 10 * flickerScale;

    // Outer glow
    const glowR = ctx.createRadialGradient(cx, cy, 0, cx, cy, fw * 2.5);
    glowR.addColorStop(0, 'rgba(255,180,60,0.18)');
    glowR.addColorStop(1, 'rgba(255,100,0,0)');
    ctx.fillStyle = glowR;
    ctx.beginPath();
    ctx.ellipse(cx, cy, fw * 2.5, fh * 1.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Flame body
    const flameGrad = ctx.createRadialGradient(cx, cy + 2, 1, cx, cy, fw);
    flameGrad.addColorStop(0, '#ffe080');
    flameGrad.addColorStop(0.4, '#ff8820');
    flameGrad.addColorStop(1, 'rgba(200,30,0,0)');
    ctx.fillStyle = flameGrad;
    ctx.beginPath();
    ctx.ellipse(cx, cy, fw * 0.6, fh * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawVignette(W, H){
    const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.2, W / 2, H / 2, H * 0.9);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.72)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
  }

  // Animation loop for torch flicker
  function animate(){
    torchPhase += 0.05;
    draw();
    requestAnimationFrame(animate);
  }

  window.addEventListener('resize', resize);

  // Init after DOM ready
  setTimeout(function(){ resize(); animate(); }, 100);
})();
