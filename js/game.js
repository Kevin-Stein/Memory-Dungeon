// ═══════════════════════════════════════════════════════
//  GAME LOGIC — game.js
//  All game state, combat, dungeon, rendering, overlays.
// ═══════════════════════════════════════════════════════

// ─── GAME STATE ───────────────────────────────────────
let player, enemy, dungeon, combat, gamePhase;

function initPlayer(){
  return {
    name:'Held', icon:'🧙',
    hp:100, maxHp:100,
    mp:50,  maxMp:100,
    atk:10, def:5, mag:8,
    level:1, xp:0,
    gold:0,
    block:0,
    statusEffects:[],
    deck: ['sword','sword','sword','sword','shield','shield','heal','heal','fireball','fireball','lightning','arrow','arrow','dagger','mana','mana'],
    inventory: {heiltrank:2, manatrank:1},
  };
}

function initDungeon(floor){
  const numRooms = 4 + Math.min(floor, 3);
  const rooms = [];
  for(let i = 0; i < numRooms; i++){
    let type;
    if(i === 0) type = 'combat';
    else if(i === numRooms - 1) type = 'boss';
    else {
      const r = Math.random();
      if(r < 0.5) type = 'combat';
      else if(r < 0.7) type = 'treasure';
      else type = 'shop';
    }
    rooms.push({type, state:'unknown', index:i});
  }
  rooms[0].state = 'current';
  return {floor, rooms, currentRoom:0};
}

function initCombat(){
  return {
    board:[],
    flipped:[],
    matched:[],
    misses:0,
    combo:0,
    buffActive:false,
    locked:false,
    playerBlock:0,
    enemySlowed:0,
  };
}

// ─── LOGGING ──────────────────────────────────────────
const LOG_MAX = 4;
let logLines = [];

function log(msg, color){
  color = color || '#d4b870';
  logLines.push({msg, color});
  if(logLines.length > LOG_MAX) logLines.shift();
  renderLog();
}

function renderLog(){
  const vl = document.getElementById('viewport-log');
  if(vl) vl.innerHTML = logLines.map(function(l){
    return '<div class="vlog-line" style="color:' + l.color + '">' + l.msg + '</div>';
  }).join('');
}

// ─── GAME START / FLOOR ───────────────────────────────
function startGame(){
  player   = initPlayer();
  dungeon  = initDungeon(1);
  combat   = initCombat();
  gamePhase = 'dungeon';
  logLines = [];
  hideAllOverlays();
  initSounds();
  playMusic('menu');
  log('Welcome to the dungeon!', VAR.info);
  log('Floor 1 begins...', VAR.info);
  renderAll();
  showDungeonView();
}

function nextFloor(){
  if(dungeon.floor >= 5){
    showVictory();
    return;
  }
  dungeon = initDungeon(dungeon.floor + 1);
  gamePhase = 'dungeon';
  hideAllOverlays();
  log('Entering floor ' + dungeon.floor + '!', VAR.info);
  renderAll();
  showDungeonView();
}

// ─── DUNGEON VIEW ─────────────────────────────────────
function showDungeonView(){
  document.getElementById('dungeon-view').classList.add('active');
  document.getElementById('memory-board-wrap').style.display = 'none';
  document.getElementById('enemy-display').style.display = 'none';
  document.getElementById('enemy-sprite-container').style.display = 'none';
  document.getElementById('battle-bg').style.backgroundImage = '';
  renderDungeonView();
}

function hideDungeonView(){
  document.getElementById('dungeon-view').classList.remove('active');
  document.getElementById('memory-board-wrap').style.display = '';
  document.getElementById('enemy-display').style.display = '';
  document.getElementById('enemy-sprite-container').style.display = '';
}

function renderDungeonView(){
  document.getElementById('floor-label').textContent = 'FLOOR ' + dungeon.floor;
  const path = document.getElementById('room-path');
  path.innerHTML = '';
  // Find last cleared room for lock logic
  const lastCleared = dungeon.rooms.reduce(function(a,r,i){ return r.state==='cleared'?i:a; }, -1);
  dungeon.rooms.forEach(function(room, i){
    if(i > 0){
      const conn = document.createElement('div');
      conn.className = 'room-connector';
      path.appendChild(conn);
    }
    const node = document.createElement('div');
    node.className = 'room-node';
    if(room.state === 'cleared') node.classList.add('cleared');
    else if(i === lastCleared + 1 || (lastCleared === -1 && i === 0)) node.classList.add('current');
    else if(i > lastCleared + 1) node.classList.add('locked');

    const typeIcons = {combat:'⚔️', treasure:'💰', shop:'🛒', boss:'💀'};
    const typeNames = {combat:'COMBAT', treasure:'CHEST', shop:'SHOP', boss:'BOSS'};
    node.innerHTML = '<span class="room-type-icon">' + typeIcons[room.type] + '</span><span style="font-size:5px">' + typeNames[room.type] + '</span>';

    if(room.state !== 'cleared' && i <= dungeon.currentRoom + 1 && !(i > dungeon.currentRoom + 1)){
      node.onclick = (function(idx){ return function(){ enterRoom(idx); }; })(i);
    }
    path.appendChild(node);
  });

  // Show "next floor" button if all rooms are cleared and floor < 5
  const allCleared = dungeon.rooms.every(function(r){ return r.state === 'cleared'; });
  const btn = document.getElementById('next-floor-btn');
  if(btn){
    if(allCleared && dungeon.floor < 5){
      btn.style.display = '';
    } else {
      btn.style.display = 'none';
    }
  }
}

function enterRoom(idx){
  const room = dungeon.rooms[idx];
  if(!room || room.state === 'cleared') return;
  // Allow entering any room up to one beyond the last cleared room
  const lastCleared = dungeon.rooms.reduce(function(a,r,i){ return r.state==='cleared'?i:a; }, -1);
  if(idx > lastCleared + 1) return;

  dungeon.currentRoom = idx;
  dungeon.rooms[idx].state = 'current';
  hideDungeonView();

  if(room.type === 'combat' || room.type === 'boss'){
    startCombat(room);
  } else if(room.type === 'treasure'){
    startTreasure(room);
  } else if(room.type === 'shop'){
    startShop(room);
  }
  renderMinimap();
}

// ─── COMBAT ───────────────────────────────────────────
function getEnemyForRoom(room){
  const floor = dungeon.floor;
  let base;
  if(room.type === 'boss'){
    base = BOSSES[Math.floor(Math.random() * BOSSES.length)];
  } else {
    base = ENEMIES[Math.floor(Math.random() * ENEMIES.length)];
  }
  const scale = Math.pow(1.25, floor - 1);
  return {
    id:       base.id,
    icon:     base.icon,
    name:     base.name,
    hp:       Math.round(base.hp * scale),
    maxHp:    Math.round(base.hp * scale),
    atk:      Math.round(base.atk * scale),
    def:      Math.round((base.def || 0) * scale),
    magRes:   base.magRes || 0,
    xp:       base.xp,
    goldMin:  base.goldMin,
    goldMax:  base.goldMax,
    magic:    base.magic || false,
    regen:    base.regen || 0,
    lifesteal:base.lifesteal || 0,
    boss:     base.boss || false,
    statusEffects:[],
  };
}

function startCombat(room){
  gamePhase = 'combat';
  enemy = getEnemyForRoom(room);
  combat = initCombat();
  generateBoard();
  updateEnemyDisplay();
  log(enemy.icon + ' ' + enemy.name + ' appears!', VAR.enemy);
  log('Floor ' + dungeon.floor + ' · ' + (room.type === 'boss' ? 'BOSS!' : 'Combat'), VAR.info);
  // Random dungeon background image
  var bgImages = ['cellar_door.jpg','cellar_fire.jpg','cellar_torch.jpg','dark_entry.jpg'];
  var bg = bgImages[Math.floor(Math.random() * bgImages.length)];
  document.getElementById('battle-bg').style.backgroundImage = 'url(assets/backgrounds/' + bg + ')';
  // Set enemy sprite
  const sprKey = ENEMY_SPRITE_MAP[enemy.id] || 'enemy3';
  enemy._spriteKey = sprKey;
  document.getElementById('enemy-sprite-container').style.display = '';
  setSpriteAnim(sprKey, 'idle');
  // Play music
  playMusic(enemy.boss ? 'boss' : (Math.random() < 0.5 ? 'battleA' : 'battleB'));
  renderActionButtons(true);
  renderAll();
}

function generateBoard(){
  const deck = player.deck.slice();
  // Shuffle
  for(let i = deck.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = deck[i]; deck[i] = deck[j]; deck[j] = tmp;
  }
  const hand = deck.slice(0, 16);
  const pairs = hand.concat(hand);
  for(let i = pairs.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = pairs[i]; pairs[i] = pairs[j]; pairs[j] = tmp;
  }
  combat.board   = pairs;
  combat.flipped = [];
  combat.matched = [];
  renderBoard();
}

function renderBoard(){
  const boardEl = document.getElementById('memory-board');
  boardEl.innerHTML = '';
  combat.board.forEach(function(type, idx){
    const card = document.createElement('div');
    card.className = 'card';
    card.dataset.idx = idx;
    const ct = CARD_TYPES[type];
    const isFlipped = combat.flipped.indexOf(idx) !== -1;
    const isMatched = combat.matched.indexOf(idx) !== -1;
    if(isFlipped || isMatched) card.classList.add(isMatched ? 'matched' : 'flipped');
    card.innerHTML = '<div class="card-back"></div><div class="card-front" style="background:linear-gradient(160deg,' + ct.color + '55,' + ct.color + '11)">' + ct.icon + '<span style="font-size:4px;color:' + ct.color + ';text-shadow:0 0 4px #000;margin-top:2px">' + ct.name + '</span></div>';
    if(!isMatched){
      card.onclick = (function(i){ return function(){ flipCard(i); }; })(idx);
    }
    boardEl.appendChild(card);
  });
}

function flipCard(idx){
  playSound('cardFlip');
  if(combat.locked) return;
  if(combat.flipped.indexOf(idx) !== -1) return;
  if(combat.matched.indexOf(idx) !== -1) return;
  if(combat.flipped.length >= 2) return;

  combat.flipped.push(idx);
  renderBoard();

  if(combat.flipped.length === 2){
    const a = combat.flipped[0], b = combat.flipped[1];
    const typeA = combat.board[a], typeB = combat.board[b];
    if(typeA === typeB){
      // Match!
      combat.matched.push(a, b);
      combat.combo++;
      combat.flipped = [];
      applyCardEffect(typeA);
      renderBoard();
      checkBoardComplete();
    } else {
      // Mismatch
      combat.locked = true;
      combat.combo = 0;
      combat.misses++;
      log('No match! (' + combat.misses + '/3 misses)', VAR.info);
      updateMissesDisplay();
      setTimeout(function(){
        combat.flipped = [];
        combat.locked = false;
        if(combat.misses >= 3){
          enemyCounterAttack();
        }
        renderBoard();
      }, 700);
    }
    renderCombo();
  }
}

function applyCardEffect(type){
  const CARD_SOUNDS = {
    sword:'sword', dagger:'dagger', shield:'shield', fireball:'fire',
    lightning:'fire', ice:'ice', heal:'heal', poison:'poison', arrow:'bow', mana:'mana'
  };
  if(CARD_SOUNDS[type]) playSound(CARD_SOUNDS[type]);
  const ct = CARD_TYPES[type];
  let mult = 1;
  if(combat.buffActive){ mult = 1.5; combat.buffActive = false; }
  if(combat.combo >= 5) mult = Math.max(mult, 2);
  else if(combat.combo >= 3) mult = Math.max(mult, 1.5);

  switch(ct.effect){
    case 'physical':{
      const raw = Math.round((ct.dmg + player.atk) * mult);
      const def = enemy.def || 0;
      const dmg = Math.max(1, raw - def);
      dealDamageToEnemy(dmg, 'physical');
      log('⚔ ' + ct.name + ': ' + dmg + ' dmg (Armor -' + def + ')', VAR.phys);
      break;
    }
    case 'magic':{
      const raw = Math.round((ct.dmg + player.mag) * mult);
      const res = enemy.magRes || 0;
      const dmg = Math.max(1, raw - res);
      dealDamageToEnemy(dmg, 'magic');
      log('✨ ' + ct.name + ': ' + dmg + ' magic dmg', VAR.magic);
      if(ct.slow && ct.slow > 0){
        combat.enemySlowed = ct.slow;
        log('❄ Enemy slowed (' + ct.slow + ' rounds)', VAR.def);
      }
      break;
    }
    case 'block':{
      const b = Math.round((ct.block + player.def) * mult);
      combat.playerBlock = (combat.playerBlock || 0) + b;
      log('🛡 ' + ct.name + ': +' + b + ' Block (total: ' + combat.playerBlock + ')', VAR.def);
      renderStats();
      break;
    }
    case 'heal':{
      const h = Math.round(ct.heal * mult);
      healPlayer(h);
      log('💚 Heal: +' + h + ' HP', VAR.heal);
      break;
    }
    case 'dot':{
      enemy.statusEffects = enemy.statusEffects || [];
      enemy.statusEffects.push({type:'poison', value:ct.dot, turns:ct.turns});
      log('☠ Poison! ' + ct.dot + ' per round × ' + ct.turns, VAR.magic);
      break;
    }
    case 'pierce':{
      const raw = Math.round((ct.dmg + player.atk) * mult);
      dealDamageToEnemy(raw, 'physical');
      log('🏹 Pierce: ' + raw + ' dmg (ignores armor)', VAR.phys);
      break;
    }
    case 'buff':{
      combat.buffActive = true;
      log('⭐ Next effect ×1.5!', VAR.combo);
      break;
    }
    case 'mana':{
      restoreMana(ct.mp);
      log('🔮 Mana: +' + ct.mp + ' MP', VAR.magic);
      break;
    }
  }
  if(combat.combo >= 2) log('✦ COMBO ×' + combat.combo + '!', VAR.combo);
  checkCombatEnd();
  renderAll();
}

function dealDamageToEnemy(dmg, type){
  enemy.hp = Math.max(0, enemy.hp - dmg);
  playHurtAnim(enemy._spriteKey || 'enemy3');
  updateEnemyDisplay();
  floatNumber('-' + dmg, type === 'magic' ? '#cc88ff' : '#ff9944', true);
  const sprite = document.getElementById('enemy-sprite-container');
  sprite.classList.remove('shake');
  void sprite.offsetWidth;
  sprite.classList.add('shake');
  setTimeout(function(){ sprite.classList.remove('shake'); }, 400);
}

function enemyCounterAttack(){
  if(gamePhase !== 'combat') return;
  combat.misses = 0;
  updateMissesDisplay();
  const atk = Math.round(enemy.atk * 0.5);
  const block = combat.playerBlock || 0;
  const dmg = Math.max(0, atk - player.def - block);
  if(block > 0){
    combat.playerBlock = Math.max(0, block - (atk - player.def));
    if(combat.playerBlock < 0) combat.playerBlock = 0;
    log('🛡 Block absorbs ' + Math.min(block, atk) + ' damage!', VAR.def);
  }
  if(dmg > 0){
    player.hp = Math.max(0, player.hp - dmg);
    playSound('getDamage');
    log(enemy.icon + ' counter: ' + dmg + ' damage!', VAR.enemy);
    floatNumber('-' + dmg, '#ff4444', false);
    const rp = document.getElementById('right-panel');
    rp.classList.remove('shake');
    void rp.offsetWidth;
    rp.classList.add('shake');
    setTimeout(function(){ rp.classList.remove('shake'); }, 400);
  } else {
    log(enemy.icon + ' counter: BLOCKED!', VAR.def);
  }
  renderStats();
  checkCombatEnd();
}

function checkBoardComplete(){
  if(combat.matched.length >= combat.board.length){
    log('All pairs found! Round ends...', VAR.info);
    setTimeout(function(){ endTurn(); }, 500);
  }
}

function endTurn(){
  if(gamePhase !== 'combat') return;
  // Apply enemy status effects (poison, etc.)
  if(enemy.statusEffects && enemy.statusEffects.length > 0){
    enemy.statusEffects = enemy.statusEffects.filter(function(s){
      if(s.type === 'poison'){
        enemy.hp = Math.max(0, enemy.hp - s.value);
        log('☠ Poison: ' + s.value + ' on ' + enemy.icon, VAR.magic);
        s.turns--;
        return s.turns > 0;
      }
      return false;
    });
    updateEnemyDisplay();
    if(enemy.hp <= 0){ checkCombatEnd(); return; }
  }
  // Troll regen
  if(enemy.regen){
    enemy.hp = Math.min(enemy.maxHp, enemy.hp + enemy.regen);
    log('🪨 Golem regenerates ' + enemy.regen + ' HP', VAR.info);
    updateEnemyDisplay();
  }
  // Enemy attack
  let dmg = enemy.atk;
  if(combat.enemySlowed > 0){
    combat.enemySlowed--;
    dmg = Math.round(dmg * 0.5);
    log('❄ Enemy slowed: half attack', VAR.def);
  }
  const block = combat.playerBlock || 0;
  const finalDmg = Math.max(0, dmg - player.def - block);
  if(block > 0){
    combat.playerBlock = Math.max(0, block - (dmg - player.def));
    if(combat.playerBlock < 0) combat.playerBlock = 0;
    log('🛡 Block absorbs damage!', VAR.def);
  }
  if(finalDmg > 0){
    if(enemy.lifesteal){
      const healed = Math.round(finalDmg * enemy.lifesteal);
      enemy.hp = Math.min(enemy.maxHp, enemy.hp + healed);
      log('🧛 Lifesteal: +' + healed + ' HP for ' + enemy.icon, VAR.enemy);
      updateEnemyDisplay();
    }
    player.hp = Math.max(0, player.hp - finalDmg);
    playSound('getDamage');
    playAttackAnim(enemy._spriteKey || 'enemy3');
    log(enemy.icon + ' attacks: ' + finalDmg + ' damage!', VAR.enemy);
    floatNumber('-' + finalDmg, '#ff4444', false);
  } else {
    log(enemy.icon + ' attacks: BLOCKED!', VAR.def);
  }

  // Apply player status effects
  applyPlayerStatusEffects();

  combat.playerBlock = 0;
  combat.misses = 0;
  updateMissesDisplay();
  renderStats();
  checkCombatEnd();
  if(gamePhase === 'combat'){
    combat.combo = 0;
    renderCombo();
    generateBoard();
    updateEnemyIntent();
    log('─── New Round ───', VAR.info);
  }
}

function waitTurn(){
  if(gamePhase !== 'combat') return;
  log('Wait... enemy attacks!', VAR.info);
  endTurn();
}

function flee(){
  if(gamePhase !== 'combat') return;
  const chance = 0.4;
  if(Math.random() < chance){
    log('Escaped successfully!', VAR.info);
    const goldLost = Math.floor(player.gold * 0.1);
    player.gold -= goldLost;
    if(goldLost > 0) log(goldLost + ' Gold lost!', VAR.enemy);
    dungeon.rooms[dungeon.currentRoom].state = 'cleared';
    gamePhase = 'dungeon';
    hideAllOverlays();
    renderAll();
    showDungeonView();
  } else {
    log('Escape failed!', VAR.enemy);
    endTurn();
  }
}

function applyPlayerStatusEffects(){
  player.statusEffects = player.statusEffects.filter(function(s){
    if(s.type === 'poison'){
      player.hp = Math.max(0, player.hp - s.value);
      log('☠ Poisoned: -' + s.value + ' HP', VAR.enemy);
      s.turns--;
      return s.turns > 0;
    }
    return false;
  });
  renderStatusEffects();
}

function checkCombatEnd(){
  if(enemy.hp <= 0){
    gamePhase = 'loot';
    const xpGain = enemy.xp;
    const goldGain = enemy.goldMin + Math.floor(Math.random() * (enemy.goldMax - enemy.goldMin + 1));
    player.gold += goldGain;
    player.xp   += xpGain;
    log(enemy.icon + ' defeated! +' + xpGain + ' XP +' + goldGain + ' Gold', VAR.combo);
    checkLevelUp();
    dungeon.rooms[dungeon.currentRoom].state = 'cleared';
    renderMinimap();
    renderStats();
    showLootOverlay(xpGain, goldGain);
    return;
  }
  if(player.hp <= 0){
    showGameOver();
    return;
  }
}

// ─── LEVEL UP ─────────────────────────────────────────
function checkLevelUp(){
  const threshold = player.level * 50;
  if(player.xp >= threshold){
    player.xp -= threshold;
    player.level++;
    player.maxHp += 10;
    player.hp = Math.min(player.hp + 10, player.maxHp);
    player.atk += 2;
    player.mag += 2;
    log('✨ LEVEL UP! Now level ' + player.level + '!', VAR.combo);
  }
}

// ─── LOOT ─────────────────────────────────────────────
function showLootOverlay(xp, gold){
  document.getElementById('loot-xp-line').textContent = '+' + xp + ' XP';
  document.getElementById('loot-gold-line').textContent = '+' + gold + ' Gold';
  const opts = getLootOptions();
  const container = document.getElementById('loot-options');
  container.innerHTML = '';
  opts.forEach(function(type){
    const ct = CARD_TYPES[type];
    const btn = document.createElement('button');
    btn.className = 'loot-card-btn';
    btn.style.borderColor = ct.color;
    btn.innerHTML = '<span class="loot-icon">' + ct.icon + '</span><span class="loot-name">' + ct.name + '</span><span class="loot-desc">' + getCardDesc(type) + '</span>';
    btn.onclick = (function(t){ return function(){ takeLoot(t); }; })(type);
    container.appendChild(btn);
  });
  document.getElementById('loot-overlay').classList.add('active');
}

function getLootOptions(){
  const all = Object.keys(CARD_TYPES);
  const shuffled = all.slice().sort(function(){ return Math.random() - 0.5; });
  return shuffled.slice(0, Math.random() < 0.3 ? 3 : 2);
}

function getCardDesc(type){
  const ct = CARD_TYPES[type];
  if(ct.effect === 'physical') return ct.dmg + ' Phys. Dmg';
  if(ct.effect === 'magic')    return ct.dmg + ' Magic Dmg';
  if(ct.effect === 'block')    return ct.block + ' Block';
  if(ct.effect === 'heal')     return ct.heal + ' HP Heal';
  if(ct.effect === 'dot')      return ct.dot + '/Rnd Poison x' + ct.turns;
  if(ct.effect === 'pierce')   return ct.dmg + ' Pierce';
  if(ct.effect === 'buff')     return 'Next ×1.5';
  if(ct.effect === 'mana')     return '+' + ct.mp + ' Mana';
  return '';
}

function takeLoot(type){
  player.deck.push(type);
  log(CARD_TYPES[type].icon + ' ' + CARD_TYPES[type].name + ' added to deck!', VAR.combo);
  document.getElementById('loot-overlay').classList.remove('active');
  afterCombat();
}

function skipLoot(){
  document.getElementById('loot-overlay').classList.remove('active');
  afterCombat();
}

// FIX: afterCombat does NOT auto-advance floor. Shows dungeon view.
// The "Nächste Etage" button is shown in renderDungeonView() when all rooms cleared.
function afterCombat(){
  gamePhase = 'dungeon';
  const allCleared = dungeon.rooms.every(function(r){ return r.state === 'cleared'; });
  if(allCleared && dungeon.floor >= 5){
    showVictory();
    return;
  }
  if(allCleared){
    log('Floor ' + dungeon.floor + ' cleared!', VAR.combo);
  }
  renderAll();
  showDungeonView();
}

// ─── SHOP ─────────────────────────────────────────────
function startShop(room){
  dungeon.rooms[dungeon.currentRoom].state = 'cleared';
  renderMinimap();
  gamePhase = 'shop';
  document.getElementById('battle-bg').style.backgroundImage = 'url(assets/backgrounds/shop_background.jpg)';
  openShop();
}

function openShop(){
  document.getElementById('shop-gold-display').textContent = player.gold;
  const grid = document.getElementById('shop-grid');
  grid.innerHTML = '';
  // Items
  Object.entries(ITEMS_DEF).forEach(function([key, item]){
    addShopRow(grid, item.icon, item.name, item.desc, item.cost, function(){
      if(player.gold < item.cost){ log('Not enough gold!', VAR.enemy); return; }
      player.gold -= item.cost;
      playSound('coin');
      if(item.type === 'consume'){
        player.inventory[key] = (player.inventory[key] || 0) + 1;
        log(item.icon + ' ' + item.name + ' purchased!', VAR.info);
      } else {
        item.use(player);
      }
      document.getElementById('shop-gold-display').textContent = player.gold;
      renderAll();
    });
  });
  // Cards
  SHOP_CARDS.forEach(function(type){
    const ct   = CARD_TYPES[type];
    const cost = SHOP_CARD_COSTS[type];
    addShopRow(grid, ct.icon, ct.name, getCardDesc(type), cost, function(){
      if(player.gold < cost){ log('Not enough gold!', VAR.enemy); return; }
      player.gold -= cost;
      playSound('coin');
      player.deck.push(type);
      log(ct.icon + ' ' + ct.name + ' added to deck!', VAR.info);
      document.getElementById('shop-gold-display').textContent = player.gold;
      renderAll();
    });
  });
  // Remove card option
  addShopRow(grid, '🗑', 'Remove Card', 'Remove a card (min. 8)', 15, function(){
    if(player.gold < 15){ log('Not enough gold!', VAR.enemy); return; }
    if(player.deck.length <= 8){ log('Deck needs min. 8 cards!', VAR.enemy); return; }
    openDeckRemove();
  });
  document.getElementById('shop-overlay').classList.add('active');
}

function addShopRow(grid, icon, name, desc, cost, cb){
  const div = document.createElement('div');
  div.className = 'shop-item';
  div.innerHTML = '<span class="shop-icon">' + icon + '</span><div class="shop-info"><div class="shop-name">' + name + '</div><div class="shop-desc">' + desc + '</div></div><span class="shop-cost">' + cost + '💰</span>';
  div.onclick = cb;
  grid.appendChild(div);
}

function closeShop(){
  document.getElementById('shop-overlay').classList.remove('active');
  gamePhase = 'dungeon';
  showDungeonView();
  renderAll();
}

// ─── TREASURE ─────────────────────────────────────────
function startTreasure(room){
  dungeon.rooms[dungeon.currentRoom].state = 'cleared';
  renderMinimap();
  var bgImages = ['cellar_door.jpg','cellar_fire.jpg','cellar_torch.jpg','dark_entry.jpg'];
  var bg = bgImages[Math.floor(Math.random() * bgImages.length)];
  document.getElementById('battle-bg').style.backgroundImage = 'url(assets/backgrounds/' + bg + ')';
  gamePhase = 'treasure';
  const roll = Math.random();
  let desc, applyFn;
  if(roll < 0.4){
    const gold = 20 + Math.floor(Math.random() * 30);
    desc = '💰 ' + gold + ' Gold!';
    applyFn = function(){ player.gold += gold; log('Treasure: +' + gold + ' Gold', VAR.combo); };
  } else if(roll < 0.7){
    const hp = 15 + Math.floor(Math.random() * 20);
    desc = '💚 Health Potion (+' + hp + ' HP)';
    applyFn = function(){ healPlayer(hp); log('Treasure: +' + hp + ' HP', VAR.heal); };
  } else {
    desc = '🧪 Mana Potion!';
    applyFn = function(){
      player.inventory.manatrank = (player.inventory.manatrank || 0) + 1;
      log('Treasure: Mana Potion found!', VAR.magic);
    };
  }
  document.getElementById('treasure-desc').textContent = desc;
  document.getElementById('treasure-overlay').classList.add('active');
  document.getElementById('treasure-overlay')._apply = applyFn;
}

function closeTreasure(){
  playSound('coin');
  const overlay = document.getElementById('treasure-overlay');
  if(overlay._apply){ overlay._apply(); overlay._apply = null; }
  overlay.classList.remove('active');
  gamePhase = 'dungeon';
  showDungeonView();
  renderAll();
}

// ─── DECK VIEWER ──────────────────────────────────────
function openDeck(){
  const grid = document.getElementById('deck-grid');
  grid.innerHTML = '';
  const counts = {};
  player.deck.forEach(function(t){ counts[t] = (counts[t] || 0) + 1; });
  Object.entries(counts).forEach(function([type, cnt]){
    const ct  = CARD_TYPES[type];
    const div = document.createElement('div');
    div.className = 'deck-card-entry';
    div.style.borderColor = ct.color + '88';
    div.innerHTML = '<span class="dc-icon">' + ct.icon + '</span><span>' + ct.name + '</span><span style="margin-left:4px;color:var(--combo)">×' + cnt + '</span>';
    grid.appendChild(div);
  });
  document.getElementById('deck-count-display').textContent = player.deck.length + ' cards in deck';
  document.getElementById('deck-remove-section').innerHTML = '';
  document.getElementById('deck-overlay').classList.add('active');
}

function openDeckRemove(){
  if(player.deck.length <= 8){ log('Need at least 8 cards!', VAR.enemy); return; }
  const container = document.getElementById('deck-remove-section');
  container.innerHTML = '<div style="font-size:5px;color:var(--dim);width:100%;text-align:center">Choose a card to remove (15💰):</div>';
  const counts = {};
  player.deck.forEach(function(t){ counts[t] = (counts[t] || 0) + 1; });
  Object.entries(counts).forEach(function([type, cnt]){
    const ct  = CARD_TYPES[type];
    const btn = document.createElement('button');
    btn.className = 'g-btn';
    btn.style.fontSize = '6px';
    btn.style.padding  = '3px 5px';
    btn.textContent = ct.icon + ' ' + ct.name + ' ×' + cnt;
    btn.onclick = function(){
      if(player.gold < 15){ log('Not enough gold!', VAR.enemy); return; }
      if(player.deck.length <= 8){ log('Need at least 8 cards!', VAR.enemy); return; }
      player.gold -= 15;
      const idx = player.deck.indexOf(type);
      player.deck.splice(idx, 1);
      log(ct.icon + ' ' + ct.name + ' removed from deck (-15💰)', VAR.info);
      closeDeck();
      renderAll();
    };
    container.appendChild(btn);
  });
  document.getElementById('deck-overlay').classList.add('active');
}

function closeDeck(){
  document.getElementById('deck-overlay').classList.remove('active');
}

// ─── PLAYER HELPERS ───────────────────────────────────
function healPlayer(amount){
  player.hp = Math.min(player.maxHp, player.hp + amount);
  floatNumber('+' + amount, '#44dd88', false);
  renderStats();
}

function restoreMana(amount){
  player.mp = Math.min(player.maxMp, player.mp + amount);
  floatNumber('+' + amount + 'MP', '#8866ff', false);
  renderStats();
}

function useItem(key){
  const item  = ITEMS_DEF[key];
  if(!item) return;
  const count = player.inventory[key] || 0;
  if(count <= 0){ log('No potions left!', VAR.enemy); return; }
  if(item.type !== 'consume') return;
  player.inventory[key]--;
  item.use(player);
  log(item.icon + ' ' + item.name + ' used!', VAR.heal);
  renderAll();
}

// ─── NAVIGATION ───────────────────────────────────────
function navCenter(){
  if(gamePhase === 'dungeon'){
    const room = dungeon.rooms[dungeon.currentRoom];
    if(room && room.state !== 'cleared') enterRoom(dungeon.currentRoom);
  }
}
function navRight(){
  if(gamePhase === 'dungeon'){
    const next = dungeon.currentRoom + 1;
    if(next < dungeon.rooms.length && dungeon.rooms[dungeon.currentRoom].state === 'cleared'){
      dungeon.currentRoom = next;
      dungeon.rooms[next].state = 'current';
      renderDungeonView();
      renderMinimap();
    }
  }
}
function navLeft(){
  if(gamePhase === 'dungeon'){
    const prev = dungeon.currentRoom - 1;
    if(prev >= 0){
      dungeon.currentRoom = prev;
      renderDungeonView();
      renderMinimap();
    }
  }
}
function navUp(){ navRight(); }
function navDown(){ navLeft(); }

// ─── OVERLAYS ─────────────────────────────────────────
function hideAllOverlays(){
  ['title-overlay','loot-overlay','shop-overlay','deck-overlay',
   'treasure-overlay','gameover-overlay','victory-overlay','dungeon-view']
  .forEach(function(id){
    const el = document.getElementById(id);
    if(el) el.classList.remove('active');
  });
}

function showGameOver(){
  gamePhase = 'gameover';
  document.getElementById('gameover-msg').textContent =
    (enemy ? enemy.icon + ' ' + enemy.name : '') + ' defeated you!\nFloor ' + dungeon.floor + ', Level ' + player.level;
  document.getElementById('gameover-overlay').classList.add('active');
}

function showVictory(){
  gamePhase = 'victory';
  document.getElementById('victory-msg').textContent =
    'You conquered all 5 floors!\nLevel ' + player.level + ' · ' + player.gold + ' Gold';
  document.getElementById('victory-overlay').classList.add('active');
}

// ─── FLOATING DAMAGE ──────────────────────────────────
function floatNumber(text, color, onEnemy){
  const el = document.createElement('div');
  el.className = 'float-dmg';
  el.style.color = color;
  el.textContent = text;
  const target = onEnemy
    ? document.getElementById('enemy-sprite-container')
    : document.getElementById('right-panel');
  const rect = target.getBoundingClientRect();
  el.style.left = (rect.left + rect.width / 2 - 20) + 'px';
  el.style.top  = (rect.top  + rect.height / 2 - 30) + 'px';
  document.body.appendChild(el);
  setTimeout(function(){ el.remove(); }, 1200);
}

// ─── RENDER FUNCTIONS ─────────────────────────────────
function renderAll(){
  renderStats();
  renderInventory();
  renderMinimap();
  renderQuickItems();
  renderActionButtons(gamePhase === 'combat');
  updateMissesDisplay();
  document.getElementById('floor-display').textContent = 'Floor ' + (dungeon ? dungeon.floor : 1);
}

function renderStats(){
  if(!player) return;
  document.getElementById('hero-name').textContent  = player.name.toUpperCase();
  document.getElementById('hero-level').textContent = 'LV ' + player.level + ' · XP ' + player.xp + '/' + (player.level * 50);
  document.getElementById('hp-label').textContent   = player.hp + '/' + player.maxHp;
  document.getElementById('mp-label').textContent   = player.mp + '/' + player.maxMp;
  document.getElementById('hp-bar').style.width     = Math.round(player.hp / player.maxHp * 100) + '%';
  document.getElementById('mp-bar').style.width     = Math.round(player.mp / player.maxMp * 100) + '%';
  document.getElementById('stat-atk').textContent   = player.atk;
  document.getElementById('stat-def').textContent   = player.def;
  document.getElementById('stat-mag').textContent   = player.mag;
  document.getElementById('stat-blk').textContent   = combat ? (combat.playerBlock || 0) : 0;
  document.getElementById('stat-combo').textContent = combat ? (combat.combo || 0) : 0;
  document.getElementById('stat-xp').textContent    = player.xp;
  document.getElementById('gold-display').textContent = player.gold;
  document.getElementById('mana-display').textContent = player.mp;
  renderStatusEffects();
}

function renderCombo(){
  if(!combat) return;
  document.getElementById('stat-combo').textContent = combat.combo || 0;
}

function renderStatusEffects(){
  if(!player) return;
  const el = document.getElementById('status-effects');
  const effects = (player.statusEffects || []).slice();
  if(combat && combat.buffActive) effects.push({type:'buff', icon:'⭐', turns:1});
  if(combat && combat.enemySlowed > 0) effects.push({type:'slow', icon:'❄️', turns:combat.enemySlowed});
  el.innerHTML = effects.map(function(s){
    return '<div class="status-badge">' + (s.icon || s.type) + ' <span style="color:var(--combo)">' + s.turns + '</span></div>';
  }).join('');
}

function updateEnemyDisplay(){
  if(!enemy) return;
  document.getElementById('enemy-name').textContent = enemy.icon + ' ' + enemy.name;
  const pct = Math.max(0, Math.round(enemy.hp / enemy.maxHp * 100));
  document.getElementById('enemy-hp-bar').style.width  = pct + '%';
  document.getElementById('enemy-hp-text').textContent = enemy.hp + '/' + enemy.maxHp;
  updateEnemyIntent();
}

function updateEnemyIntent(){
  if(!enemy) return;
  const atk = (combat && combat.enemySlowed > 0) ? Math.round(enemy.atk * 0.5) : enemy.atk;
  const intentText = enemy.magic
    ? '→ ✨ Spell (' + atk + ')'
    : '→ ⚔️ Attack (' + atk + ')';
  document.getElementById('enemy-intent').textContent = intentText;
}

function updateMissesDisplay(){
  if(!combat) return;
  document.getElementById('misses-display').textContent = 'Misses: ' + combat.misses + '/3';
}

function renderInventory(){
  if(!player) return;
  const potionKeys = ['heiltrank','manatrank','elixier'];
  const itemKeys   = ['kraftring','zauberstab','panzerung'];
  const otherKeys  = ['lebensherz'];
  renderInvSection('inv-potions', potionKeys);
  renderInvSection('inv-items',   itemKeys);
  renderInvSection('inv-other',   otherKeys);
}

function renderInvSection(containerId, keys){
  const el = document.getElementById(containerId);
  el.innerHTML = '';
  keys.forEach(function(key){
    const item  = ITEMS_DEF[key];
    const count = player.inventory[key] || 0;
    const slot  = document.createElement('div');
    slot.className = 'inv-slot' + (count <= 0 ? ' empty' : '');
    slot.title = item.name + ': ' + item.desc;
    slot.innerHTML = item.icon + '<span class="slot-count">' + (count > 0 ? count : '') + '</span>';
    if(count > 0 && item.type === 'consume'){
      slot.onclick = (function(k){ return function(){ useItem(k); }; })(key);
    }
    el.appendChild(slot);
  });
}

function renderMinimap(){
  if(!dungeon) return;
  const el = document.getElementById('minimap');
  el.innerHTML = '';
  const row = document.createElement('div');
  row.className = 'mm-row';
  dungeon.rooms.forEach(function(room, i){
    const cell = document.createElement('div');
    cell.className = 'mm-cell';
    const typeClass = {combat:'', treasure:'mm-treasure', shop:'mm-shop', boss:'mm-boss'}[room.type] || '';
    if(i === dungeon.currentRoom) cell.classList.add('mm-current');
    else if(room.state === 'cleared') cell.classList.add('mm-cleared');
    else if(room.state === 'unknown') cell.classList.add('mm-unknown');
    if(typeClass && room.state !== 'unknown') cell.classList.add(typeClass);
    cell.title = room.type;
    row.appendChild(cell);
  });
  el.appendChild(row);
}

function renderQuickItems(){
  if(!player) return;
  const el = document.getElementById('item-quickuse');
  el.innerHTML = '';
  const consumables = ['heiltrank','manatrank','elixier'];
  consumables.forEach(function(key){
    const count = player.inventory[key] || 0;
    if(count <= 0) return;
    const item = ITEMS_DEF[key];
    const btn  = document.createElement('div');
    btn.className = 'quick-item';
    btn.title = item.name + ': ' + item.desc;
    btn.innerHTML = item.icon + '<span class="qi-count">' + count + '</span>';
    btn.onclick = (function(k){ return function(){ useItem(k); }; })(key);
    el.appendChild(btn);
  });
}

function renderActionButtons(inCombat){
  document.getElementById('btn-endturn').disabled = !inCombat;
  document.getElementById('btn-flee').disabled    = !inCombat;
  document.getElementById('btn-wait').disabled    = !inCombat;
}

// ─── INIT ─────────────────────────────────────────────
window.onload = function(){
  player    = initPlayer();
  dungeon   = initDungeon(1);
  combat    = initCombat();
  gamePhase = 'title';
  document.getElementById('memory-board-wrap').style.display      = 'none';
  document.getElementById('enemy-display').style.display          = 'none';
  document.getElementById('enemy-sprite-container').style.display = 'none';
  renderAll();
};
