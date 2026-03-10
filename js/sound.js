// ═══════════════════════════════════════════════════════
//  SOUND SYSTEM — sound.js
// ═══════════════════════════════════════════════════════

const SFX = {};

function initSounds(){
  const defs = {
    cardFlip:   'card%20flip.mp3',
    sword:      'sword_attack.mp3',
    dagger:     'dagger_attack.mp3',
    fire:       'fire_attack.mp3',
    ice:        'ice_attack.mp3',
    bow:        'bow_attack.mp3',
    shield:     'shield.mp3',
    heal:       'healing.mp3',
    mana:       'mana.mp3',
    poison:     'poison_attack.mp3',
    getDamage:  'get%20damage.mp3',
    battleA:    'battle%20theme_01.mp3',
    battleB:    'battle%20theme_02.mp3',
    boss:       'boss%20fight%20theme.mp3',
    menu:       'start%20menu_theme.mp3',
    click:      'game%20start%20click.mp3',
    coin:       'selling_buying_coin.mp3',
  };
  const base = '../assets/sounds/';
  Object.entries(defs).forEach(function([k,f]){
    SFX[k] = new Audio(base+f);
    SFX[k].preload='auto';
  });
  ['battleA','battleB','boss','menu'].forEach(function(k){ SFX[k].loop=true; });
}

let currentMusic = null;

function playMusic(key){
  if(currentMusic){ currentMusic.pause(); currentMusic.currentTime=0; }
  currentMusic = SFX[key];
  if(currentMusic){ currentMusic.currentTime=0; currentMusic.volume=0.35; currentMusic.play().catch(function(){}); }
}

function stopMusic(){
  if(currentMusic){ currentMusic.pause(); currentMusic.currentTime=0; currentMusic=null; }
}

function playSound(key){
  const s=SFX[key];
  if(!s) return;
  const clone=s.cloneNode();
  clone.volume=0.7;
  clone.play().catch(function(){});
}
