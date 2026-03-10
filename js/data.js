// ═══════════════════════════════════════════════════════
//  DATA DEFINITIONS — data.js
// ═══════════════════════════════════════════════════════

const CARD_TYPES = {
  sword:    {icon:'⚔️', name:'Schwert',     color:'#cc7722', effect:'physical', dmg:14},
  dagger:   {icon:'🗡️', name:'Dolch',       color:'#ee5533', effect:'physical', dmg:20},
  shield:   {icon:'🛡️', name:'Schild',      color:'#3366cc', effect:'block',    block:16},
  fireball: {icon:'🔥', name:'Feuerball',   color:'#ee6622', effect:'magic',    dmg:22},
  lightning:{icon:'⚡', name:'Blitz',       color:'#ffcc00', effect:'magic',    dmg:18},
  ice:      {icon:'❄️', name:'Eis',         color:'#55aaff', effect:'magic',    dmg:14, slow:2},
  heal:     {icon:'💚', name:'Heilung',     color:'#33aa66', effect:'heal',     heal:20},
  poison:   {icon:'☠️', name:'Gift',        color:'#aa44cc', effect:'dot',      dot:6, turns:3},
  arrow:    {icon:'🏹', name:'Pfeil',       color:'#aa8855', effect:'pierce',   dmg:12},
  power:    {icon:'⭐', name:'Kraft',       color:'#ffaa00', effect:'buff'},
  bomb:     {icon:'💣', name:'Bombe',       color:'#ff4444', effect:'physical', dmg:28},
  mana:     {icon:'🔮', name:'Mana',        color:'#8866ff', effect:'mana',     mp:20},
};

const ENEMIES = [
  {id:'goblin',  icon:'👺', name:'Goblin',           hp:35,  atk:8,  def:1, magRes:0,  xp:15,  goldMin:8,   goldMax:15},
  {id:'skelett', icon:'💀', name:'Skelett',          hp:45,  atk:10, def:3, magRes:0,  xp:20,  goldMin:10,  goldMax:18},
  {id:'ork',     icon:'👹', name:'Ork',              hp:65,  atk:14, def:5, magRes:2,  xp:35,  goldMin:15,  goldMax:25},
  {id:'mage',    icon:'🧙', name:'Finsterzauberer',  hp:50,  atk:6,  def:2, magRes:12, xp:40,  goldMin:20,  goldMax:35, magic:true},
  {id:'troll',   icon:'🧌', name:'Troll',            hp:90,  atk:18, def:8, magRes:3,  xp:55,  goldMin:25,  goldMax:40, regen:5},
  {id:'vampir',  icon:'🧛', name:'Vampir',           hp:70,  atk:16, def:4, magRes:8,  xp:60,  goldMin:30,  goldMax:50, lifesteal:0.3},
];

const BOSSES = [
  {id:'dragon',  icon:'🐉', name:'DRACHENFÜRST',     hp:180, atk:28, def:15, magRes:15, xp:200, goldMin:100, goldMax:150, boss:true},
  {id:'necro',   icon:'🦴', name:'TOTENBESCHWÖRER',  hp:150, atk:20, def:8,  magRes:20, xp:180, goldMin:80,  goldMax:130, boss:true},
];

const ITEMS_DEF = {
  heiltrank: {icon:'🧪', name:'Heiltrank',  desc:'+30 HP',           cost:40,  cat:'potions', use:function(p){healPlayer(30);}, type:'consume'},
  manatrank: {icon:'💧', name:'Manatrank',  desc:'+25 MP',           cost:35,  cat:'potions', use:function(p){restoreMana(25);}, type:'consume'},
  elixier:   {icon:'⚗️', name:'Elixier',   desc:'+20 HP +20 MP',    cost:60,  cat:'potions', use:function(p){healPlayer(20);restoreMana(20);}, type:'consume'},
  kraftring: {icon:'💍', name:'Kraftring', desc:'+5 ATK permanent', cost:80,  cat:'items',   use:function(p){p.atk+=5;log('Kraftring: ATK+5',VAR.def);}, type:'equip'},
  zauberstab:{icon:'🪄', name:'Zauberstab',desc:'+6 MAG permanent', cost:90,  cat:'items',   use:function(p){p.mag+=6;log('Zauberstab: MAG+6',VAR.def);}, type:'equip'},
  panzerung: {icon:'🛡', name:'Panzerung', desc:'+4 DEF permanent', cost:70,  cat:'items',   use:function(p){p.def+=4;log('Panzerung: DEF+4',VAR.def);}, type:'equip'},
  lebensherz:{icon:'❤️', name:'Lebensherz',desc:'+20 maxHP perm',   cost:100, cat:'other',   use:function(p){p.maxHp+=20;p.hp=Math.min(p.hp+20,p.maxHp);log('Lebensherz: maxHP+20',VAR.heal);}, type:'equip'},
};

const SHOP_CARDS = ['sword','dagger','shield','fireball','lightning','ice','heal','poison','arrow','power','bomb','mana'];
const SHOP_CARD_COSTS = {sword:25,dagger:35,shield:30,fireball:40,lightning:35,ice:35,heal:30,poison:30,arrow:20,power:50,bomb:45,mana:25};

const VAR = {phys:'#ff9944',magic:'#cc88ff',heal:'#44dd88',def:'#4488ff',enemy:'#ff4444',combo:'#ffcc00',info:'#6688aa'};

// ── SPRITE DATA ──
const SPRITE_DATA = {
  bat: {
    basePath: '../assets/Enemys/Bat/Bat%20without%20VFX/',
    fw:64, fh:64, scale:3,
    idle:   {file:'Bat-IdleFly.png', frames:9, fps:10},
    hurt:   {file:'Bat-Hurt.png',    frames:5, fps:12},
    attack: {file:'Bat-Attack1.png', frames:8, fps:12},
  },
  mushroom: {
    basePath: '../assets/Enemys/Mushroom/Mushroom%20without%20VFX/',
    fw:80, fh:64, scale:3,
    idle:   {file:'Mushroom-Idle.png',   frames:7, fps:8},
    hurt:   {file:'Mushroom-Hit.png',    frames:5, fps:12},
    attack: {file:'Mushroom-Attack.png', frames:10,fps:12},
  },
  golem: {
    basePath: '../assets/Enemys/Golem_1/Blue/No_Swoosh_VFX/',
    fw:90, fh:64, scale:3,
    idle:   {file:'Golem_1_idle.png',   frames:8, fps:8},
    hurt:   {file:'Golem_1_hurt.png',   frames:4, fps:12},
    attack: {file:'Golem_1_attack.png', frames:11,fps:12},
  },
  enemy3: {
    basePath: '../assets/Enemys/Forrestenemys/Enemy3-No-Movement-In-Animation/',
    fw:64, fh:64, scale:3,
    idle:   {file:'Enemy3No-Move-Idle.png',           frames:8, fps:8},
    hurt:   {file:'Enemy3No-Move-Hit-NoVFX.png',      frames:4, fps:12},
    attack: {file:'Enemy3No-Move-AttackSmashLoop.png',frames:3, fps:8},
  },
};

// enemy id → sprite key
const ENEMY_SPRITE_MAP = {
  goblin:'bat', skelett:'enemy3', ork:'mushroom',
  mage:'enemy3', troll:'golem', vampir:'bat',
  dragon:'golem', necro:'enemy3',
};
