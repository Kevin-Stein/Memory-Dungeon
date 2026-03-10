// ═══════════════════════════════════════════════════════
//  SPRITE ANIMATION — sprites.js
// ═══════════════════════════════════════════════════════

let spriteAnimFrame = null;

function setSpriteAnim(spriteKey, animKey){
  const sd = SPRITE_DATA[spriteKey];
  if(!sd) return;
  const anim = sd[animKey];
  if(!anim) return;
  const el = document.getElementById('enemy-sprite');
  if(!el) return;

  const displayW = sd.fw * sd.scale;
  const displayH = sd.fh * sd.scale;
  const totalW   = anim.frames * sd.fw * sd.scale;
  const url = sd.basePath + anim.file;
  const dur = (anim.frames / anim.fps).toFixed(3);
  const animName = 'spr_' + spriteKey + '_' + animKey;

  // Inject keyframes
  let styleEl = document.getElementById('sprite-keyframes');
  if(!styleEl){
    styleEl = document.createElement('style');
    styleEl.id = 'sprite-keyframes';
    document.head.appendChild(styleEl);
  }
  // Only add if not already there
  if(!styleEl.textContent.includes(animName)){
    styleEl.textContent += '@keyframes ' + animName + '{from{background-position:0 0}to{background-position:-' + totalW + 'px 0}}';
  }

  el.style.cssText = [
    'width:' + displayW + 'px',
    'height:' + displayH + 'px',
    'background-image:url(\'' + url + '\')',
    'background-size:' + totalW + 'px ' + displayH + 'px',
    'background-repeat:no-repeat',
    'background-position:0 0',
    'image-rendering:pixelated',
    'display:block',
    'filter:drop-shadow(0 0 8px rgba(255,50,0,0.4))',
    'animation:' + animName + ' ' + dur + 's steps(' + anim.frames + ') infinite',
  ].join(';');
}

function playHurtAnim(spriteKey){
  setSpriteAnim(spriteKey, 'hurt');
  setTimeout(function(){ setSpriteAnim(spriteKey, 'idle'); }, 600);
}

function playAttackAnim(spriteKey){
  setSpriteAnim(spriteKey, 'attack');
  const sd = SPRITE_DATA[spriteKey];
  const atk = sd ? sd.attack : null;
  const dur = atk ? Math.round((atk.frames / atk.fps) * 1000) : 800;
  setTimeout(function(){ setSpriteAnim(spriteKey, 'idle'); }, dur);
}
