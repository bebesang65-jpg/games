/**
 * IRON FIST LEAGUE — Character Data
 * Data-driven character definitions. Add new fighters here without
 * touching the combat engine.
 */

export const CHARACTER_DATA = {

  marcus: {
    id: 'marcus',
    name: 'MARCUS',
    nickname: '"THE ANVIL" VANCE',
    archetype: 'BRUISER / GRAPPLER',
    origin: 'USA',
    style: 'Bare-Knuckle Boxing & Catch Wrestling',

    // ── Core Stats ──
    maxHealth:        1200,
    speed:            3.2,       // px/frame walk speed
    runSpeed:         5.0,
    jumpForce:        -16,       // negative = upward
    gravity:          0.7,
    weight:           1.4,       // affects knockback received
    defense:          1.2,       // damage multiplier received (>1 means more damage... wait, we invert: lower = tankier)
    damageMultiplier: 1.25,      // outgoing damage multiplier
    grabRange:        90,        // grab hitbox reach in px

    // ── Stat display (0-10 scale) ──
    stats: {
      health:    10,
      damage:    9,
      speed:     3,
      defense:   8,
      mobility:  3,
      difficulty: 5,
    },

    // ── Move Definitions ──
    // Each move: { startup, active, recovery, damage, hitstun, blockstun, knockbackX, knockbackY, armorStart, armorEnd }
    moves: {
      lightAttack: {
        name: 'Jab',
        startup: 4, active: 3, recovery: 8,
        damage: 20, hitstun: 10, blockstun: 6,
        knockbackX: 3, knockbackY: 0,
        hitboxOffsetX: 60, hitboxW: 55, hitboxH: 30,
        armorStart: 0, armorEnd: 0,
        // After the hitbox goes live (startup frames), cancel into these moves
        // 'lightAttack' in cancelInto = Jab → Jab chain
        cancelInto: ['heavyAttack', 'kick'],
        counterHitStun: 14,  // hitstun on counter-hit (overrides base)
      },
      heavyAttack: {
        name: 'Haymaker',
        startup: 12, active: 5, recovery: 20,
        damage: 60, hitstun: 18, blockstun: 12,
        knockbackX: 10, knockbackY: -4,
        hitboxOffsetX: 65, hitboxW: 65, hitboxH: 40,
        // Armor: absorbs incoming hits on frames 4–10 of the move
        armorStart: 4, armorEnd: 10,
        cancelInto: [],
        counterHitStun: 28,  // counter-hit Haymaker = full launch
      },
      kick: {
        name: 'Boot Stomp',
        startup: 8, active: 4, recovery: 14,
        damage: 35, hitstun: 14, blockstun: 9,
        knockbackX: 6, knockbackY: -2,
        hitboxOffsetX: 55, hitboxW: 70, hitboxH: 35,
        armorStart: 0, armorEnd: 0,
        cancelInto: ['heavyAttack'],
        counterHitStun: 20,
      },
      grab: {
        name: 'Seismic Slam',
        startup: 6, active: 4, recovery: 30,
        damage: 120, hitstun: 30, blockstun: 0,
        knockbackX: 0, knockbackY: -12,
        hitboxOffsetX: 70, hitboxW: 80, hitboxH: 90,
        isGrab:      true,
        techable:    true,  // defender can throw-tech this grab
        missRecovery: 40,
      },
      special: {
        name: 'SEISMIC SLAM EX',
        meterCost: 50,

        // ── Frame data ──
        startup:  8,   // wind-up before grab hitbox appears
        active:   6,   // grab window (wide hitbox)
        recovery: 40,  // long recovery — punishable on whiff

        // ── Damage ──
        damage:   180, // base; applied during throw impact phase
        hitstun:  0,   // n/a — knockdown overrides hitstun
        blockstun: 0,

        // ── Throw trajectory ──
        knockbackX: 0,   // EX slams straight down — no horizontal throw
        knockbackY: -20, // high arc before ground impact

        // ── Hitbox ──
        hitboxOffsetX: 75, hitboxW: 100, hitboxH: 110,

        // ── Grab flags ──
        isGrab:   true,
        techable: false,  // EX is unblockable and untechable

        // ── Special phase durations (frames, used by SpecialSystem) ──
        liftFrames:    18,  // how long Marcus holds opponent overhead
        liftHeight:   205,  // px above Marcus's feet the opponent is held
        slamFrames:    10,  // drive-down animation before ground impact
        superFlashMs:  220, // ms to freeze game on activation (super flash)
        invincible:    true, // Marcus has invincibility during lift+slam phases
        invincibleFrames: 24,

        // ── VFX config ──
        screenShake:       true,
        screenShakeWave2:  true,   // double screen-shake (bounce effect)
        groundCrack:       true,
        shockwaveRing:     true,   // expanding ring on ground impact
        dustClouds:        true,
        impactFlashRadius: 90,
        sparksCount:       28,

        // ── Audio ──
        sfxActivate: 'specialActivate',
        sfxImpact:   'seismicImpact',
      },
    },

    // ── AI Behavior Weights ──
    ai: {
      aggressiveness: 0.7,
      blockFrequency:  0.35,
      comboChance:     0.55,
      dashFrequency:   0.2,
      grabFrequency:   0.4,
      retreatThreshold: 0.15,  // retreat when health < 15%
    },
  },

  // ─────────────────────────────────────────────

  vesper: {
    id: 'vesper',
    name: 'VESPER',
    nickname: '"KESTREL" THORNE',
    archetype: 'SPEEDSTER / AGILITY',
    origin: 'UK',
    style: 'High-Speed Ninjutsu & Modern Krav Maga',

    // ── Core Stats ──
    maxHealth:        850,
    speed:            6.5,
    runSpeed:         10.0,
    jumpForce:        -19,
    gravity:          0.55,
    weight:           0.7,
    defense:          0.85,
    damageMultiplier: 0.9,
    grabRange:        60,

    // ── Stat display ──
    stats: {
      health:    6,
      damage:    6,
      speed:     10,
      defense:   5,
      mobility:  10,
      difficulty: 7,
    },

    // ── Move Definitions ──
    moves: {
      lightAttack: {
        name: 'Quick Strike',
        startup: 3, active: 2, recovery: 5,
        damage: 12, hitstun: 7, blockstun: 4,
        knockbackX: 2, knockbackY: 0,
        hitboxOffsetX: 50, hitboxW: 45, hitboxH: 25,
        armorStart: 0, armorEnd: 0,
        // Vesper's rapid light chain: light → light → light → kick → heavy
        cancelInto: ['lightAttack', 'kick', 'heavyAttack'],
        counterHitStun: 10,
      },
      heavyAttack: {
        name: 'Blade Slash',
        startup: 7, active: 4, recovery: 14,
        damage: 40, hitstun: 15, blockstun: 10,
        knockbackX: 7, knockbackY: -3,
        hitboxOffsetX: 55, hitboxW: 58, hitboxH: 35,
        armorStart: 0, armorEnd: 0,
        cancelInto: ['kick'],
        counterHitStun: 22,
      },
      kick: {
        name: 'Spin Kick',
        startup: 6, active: 3, recovery: 10,
        damage: 25, hitstun: 12, blockstun: 7,
        knockbackX: 5, knockbackY: -1,
        hitboxOffsetX: 50, hitboxW: 65, hitboxH: 30,
        armorStart: 0, armorEnd: 0,
        cancelInto: ['lightAttack', 'heavyAttack'],
        counterHitStun: 17,
      },
      grab: {
        name: 'Takedown',
        startup: 5, active: 3, recovery: 25,
        damage: 70, hitstun: 25, blockstun: 0,
        knockbackX: 0, knockbackY: -8,
        hitboxOffsetX: 55, hitboxW: 65, hitboxH: 80,
        isGrab:      true,
        techable:    true,  // faster startup makes it trickier to tech
        missRecovery: 30,
      },
      special: {
        name: 'PHANTOM FLURRY',
        meterCost: 50,

        // ── Frame data ──
        startup:  4,   // very fast — part of the terror
        active:   22,  // long active window for the full dash
        recovery: 24,  // recovery after reappearing behind

        // ── Per-sub-hit damage (6 hits, scaling applies per hit) ──
        damage: 16,
        hits:   6,
        hitstun:  7,   // light per-hit stun (keeps them in hit anim)
        blockstun: 0,

        // ── Final hit properties (sub-hit 6) ──
        finalHitKnockbackX: 11,
        finalHitKnockbackY: -7,
        finalHitDamage:     24, // last hit hits harder
        finalHitShake:       8, // screen shake only on last hit

        // ── All other sub-hits ──
        knockbackX: 1.5, // minimal push per hit — keeps them in place for combo
        knockbackY: 0,

        // ── Hitbox ──
        hitboxOffsetX: 48, hitboxW: 50, hitboxH: 140, // tall — hits high or low

        // ── Dash physics (read by SpecialSystem) ──
        isDash:     true,
        dashSpeed:  14,    // px/frame initial dash velocity toward opponent
        dashPassThrough: true, // Vesper phases through the opponent
        dashOvershoot:   55,   // px past opponent's center Vesper lands

        // ── Invincibility ──
        invincible:       true,   // Vesper can't be hit while dashing
        invincibleFrames: 20,     // frames of invuln (startup + early active)

        // ── Afterimage / VFX config ──
        afterimage:         true,
        afterimageAlpha:    0.65,
        afterimageFade:     0.06,  // alpha decay per frame
        speedLineCount:     8,     // horizontal streaks during dash
        speedLineColor:     '#cc2a2a',
        subHitSparkColor1:  '#8acce8', // cyan blade color
        subHitSparkColor2:  '#ffffff',
        subHitSparkCount:   5,
        finalHitSparkCount: 16,
        finalHitSparkColor: '#cc2a2a',

        // ── No grab ──
        isGrab:      false,
        techable:    false,
        screenShake: false,  // only final hit shakes

        // ── Audio ──
        sfxActivate: 'specialActivate',
        sfxSubHit:   'flurrySlash',
        sfxFinalHit: 'flurryFinish',
      },
    },

    // ── AI Behavior Weights ──
    ai: {
      aggressiveness: 0.85,
      blockFrequency:  0.25,
      comboChance:     0.75,
      dashFrequency:   0.6,
      grabFrequency:   0.2,
      retreatThreshold: 0.25,
    },
  },

  // ─────────────────────────────────────────────
  // 3. ROOK
  rook: {
    id: 'rook',
    name: 'ROOK',
    nickname: '"IRONWALL" STEELE',
    archetype: 'TANK / COUNTER',
    origin: 'RUSSIA',
    style: 'Sambo & Heavy Armor Combat',
    maxHealth: 1400, speed: 2.5, runSpeed: 4.0,
    jumpForce: -13, gravity: 0.8, weight: 1.8,
    defense: 1.4, damageMultiplier: 1.1, grabRange: 85,
    stats: { health: 10, damage: 7, speed: 2, defense: 10, mobility: 2, difficulty: 4 },
    moves: {
      lightAttack: { name: 'Gut Punch', startup: 6, active: 4, recovery: 10, damage: 22, hitstun: 11, blockstun: 7, knockbackX: 3, knockbackY: 0, hitboxOffsetX: 58, hitboxW: 52, hitboxH: 32, armorStart: 0, armorEnd: 0, cancelInto: ['heavyAttack'], counterHitStun: 15 },
      heavyAttack: { name: 'Sledgehammer', startup: 14, active: 6, recovery: 22, damage: 70, hitstun: 20, blockstun: 14, knockbackX: 12, knockbackY: -5, hitboxOffsetX: 68, hitboxW: 70, hitboxH: 45, armorStart: 3, armorEnd: 12, cancelInto: [], counterHitStun: 30 },
      kick: { name: 'Stomp Kick', startup: 10, active: 5, recovery: 16, damage: 40, hitstun: 15, blockstun: 10, knockbackX: 7, knockbackY: -2, hitboxOffsetX: 58, hitboxW: 72, hitboxH: 38, armorStart: 0, armorEnd: 0, cancelInto: ['heavyAttack'], counterHitStun: 22 },
      grab: { name: 'Bear Hug', startup: 7, active: 5, recovery: 32, damage: 140, hitstun: 32, blockstun: 0, knockbackX: 0, knockbackY: -10, hitboxOffsetX: 72, hitboxW: 82, hitboxH: 92, isGrab: true, techable: true, missRecovery: 44 },
      special: { name: 'FORTRESS CRUSH', meterCost: 50, startup: 10, active: 8, recovery: 44, damage: 200, hitstun: 0, blockstun: 0, knockbackX: 0, knockbackY: -18, hitboxOffsetX: 78, hitboxW: 104, hitboxH: 115, isGrab: true, techable: false, liftFrames: 20, liftHeight: 190, slamFrames: 12, superFlashMs: 240, invincible: true, invincibleFrames: 26, screenShake: true, screenShakeWave2: true, groundCrack: true, shockwaveRing: true, dustClouds: true, impactFlashRadius: 95, sparksCount: 32, sfxActivate: 'specialActivate', sfxImpact: 'seismicImpact' },
    },
    ai: { aggressiveness: 0.6, blockFrequency: 0.45, comboChance: 0.45, dashFrequency: 0.1, grabFrequency: 0.5, retreatThreshold: 0.1 },
  },

  // ─────────────────────────────────────────────
  // 4. ZERO
  zero: {
    id: 'zero',
    name: 'ZERO',
    nickname: '"GHOST BLADE" KAI',
    archetype: 'ASSASSIN / RUSHDOWN',
    origin: 'JAPAN',
    style: 'Iaido & Street Brawling',
    maxHealth: 780, speed: 7.0, runSpeed: 11.5,
    jumpForce: -20, gravity: 0.5, weight: 0.65,
    defense: 0.75, damageMultiplier: 1.0, grabRange: 55,
    stats: { health: 5, damage: 8, speed: 10, defense: 4, mobility: 10, difficulty: 8 },
    moves: {
      lightAttack: { name: 'Flicker Slash', startup: 2, active: 2, recovery: 4, damage: 10, hitstun: 6, blockstun: 3, knockbackX: 2, knockbackY: 0, hitboxOffsetX: 48, hitboxW: 42, hitboxH: 22, armorStart: 0, armorEnd: 0, cancelInto: ['lightAttack', 'kick', 'heavyAttack'], counterHitStun: 9 },
      heavyAttack: { name: 'Draw Cut', startup: 8, active: 4, recovery: 16, damage: 45, hitstun: 16, blockstun: 11, knockbackX: 8, knockbackY: -3, hitboxOffsetX: 52, hitboxW: 60, hitboxH: 36, armorStart: 0, armorEnd: 0, cancelInto: ['kick'], counterHitStun: 24 },
      kick: { name: 'Rising Knee', startup: 5, active: 3, recovery: 9, damage: 22, hitstun: 11, blockstun: 6, knockbackX: 4, knockbackY: -1, hitboxOffsetX: 48, hitboxW: 62, hitboxH: 28, armorStart: 0, armorEnd: 0, cancelInto: ['lightAttack', 'heavyAttack'], counterHitStun: 16 },
      grab: { name: 'Neck Snap', startup: 4, active: 3, recovery: 22, damage: 65, hitstun: 22, blockstun: 0, knockbackX: 0, knockbackY: -7, hitboxOffsetX: 52, hitboxW: 62, hitboxH: 78, isGrab: true, techable: true, missRecovery: 28 },
      special: { name: 'SHADOW STEP', meterCost: 50, startup: 3, active: 20, recovery: 22, damage: 14, hits: 5, hitstun: 6, blockstun: 0, finalHitKnockbackX: 10, finalHitKnockbackY: -6, finalHitDamage: 22, finalHitShake: 7, knockbackX: 1.2, knockbackY: 0, hitboxOffsetX: 46, hitboxW: 48, hitboxH: 135, isDash: true, dashSpeed: 16, dashPassThrough: true, dashOvershoot: 50, invincible: true, invincibleFrames: 18, afterimage: true, afterimageAlpha: 0.6, afterimageFade: 0.07, speedLineCount: 7, speedLineColor: '#4488ff', subHitSparkColor1: '#4488ff', subHitSparkColor2: '#ffffff', subHitSparkCount: 4, finalHitSparkCount: 14, finalHitSparkColor: '#88aaff', isGrab: false, techable: false, screenShake: false, sfxActivate: 'specialActivate', sfxSubHit: 'flurrySlash', sfxFinalHit: 'flurryFinish' },
    },
    ai: { aggressiveness: 0.9, blockFrequency: 0.2, comboChance: 0.8, dashFrequency: 0.7, grabFrequency: 0.15, retreatThreshold: 0.2 },
  },

  // ─────────────────────────────────────────────
  // 5. CINDER
  cinder: {
    id: 'cinder',
    name: 'CINDER',
    nickname: '"SCORCHED" BURNS',
    archetype: 'BRAWLER / ZONER',
    origin: 'BRAZIL',
    style: 'Capoeira & Street Fighting',
    maxHealth: 950, speed: 5.0, runSpeed: 8.0,
    jumpForce: -17, gravity: 0.6, weight: 1.0,
    defense: 0.95, damageMultiplier: 1.05, grabRange: 65,
    stats: { health: 7, damage: 7, speed: 7, defense: 6, mobility: 7, difficulty: 5 },
    moves: {
      lightAttack: { name: 'Ember Jab', startup: 4, active: 3, recovery: 7, damage: 15, hitstun: 8, blockstun: 5, knockbackX: 2, knockbackY: 0, hitboxOffsetX: 52, hitboxW: 48, hitboxH: 27, armorStart: 0, armorEnd: 0, cancelInto: ['kick', 'heavyAttack'], counterHitStun: 12 },
      heavyAttack: { name: 'Inferno Hook', startup: 10, active: 5, recovery: 18, damage: 55, hitstun: 17, blockstun: 12, knockbackX: 9, knockbackY: -4, hitboxOffsetX: 60, hitboxW: 63, hitboxH: 40, armorStart: 0, armorEnd: 0, cancelInto: [], counterHitStun: 26 },
      kick: { name: 'Whirlwind Kick', startup: 7, active: 4, recovery: 12, damage: 30, hitstun: 13, blockstun: 8, knockbackX: 5, knockbackY: -1, hitboxOffsetX: 52, hitboxW: 68, hitboxH: 33, armorStart: 0, armorEnd: 0, cancelInto: ['lightAttack', 'heavyAttack'], counterHitStun: 18 },
      grab: { name: 'Flame Toss', startup: 6, active: 4, recovery: 28, damage: 100, hitstun: 28, blockstun: 0, knockbackX: 0, knockbackY: -10, hitboxOffsetX: 65, hitboxW: 76, hitboxH: 86, isGrab: true, techable: true, missRecovery: 36 },
      special: { name: 'BLAZE RUSH', meterCost: 50, startup: 5, active: 20, recovery: 24, damage: 15, hits: 5, hitstun: 7, blockstun: 0, finalHitKnockbackX: 11, finalHitKnockbackY: -7, finalHitDamage: 25, finalHitShake: 8, knockbackX: 1.5, knockbackY: 0, hitboxOffsetX: 48, hitboxW: 50, hitboxH: 140, isDash: true, dashSpeed: 13, dashPassThrough: true, dashOvershoot: 52, invincible: true, invincibleFrames: 19, afterimage: true, afterimageAlpha: 0.6, afterimageFade: 0.065, speedLineCount: 8, speedLineColor: '#ff6600', subHitSparkColor1: '#ff8800', subHitSparkColor2: '#ffdd00', subHitSparkCount: 5, finalHitSparkCount: 15, finalHitSparkColor: '#ff4400', isGrab: false, techable: false, screenShake: false, sfxActivate: 'specialActivate', sfxSubHit: 'flurrySlash', sfxFinalHit: 'flurryFinish' },
    },
    ai: { aggressiveness: 0.75, blockFrequency: 0.3, comboChance: 0.65, dashFrequency: 0.5, grabFrequency: 0.25, retreatThreshold: 0.2 },
  },

  // ─────────────────────────────────────────────
  // 6. NOVA
  nova: {
    id: 'nova',
    name: 'NOVA',
    nickname: '"STORMFIST" REY',
    archetype: 'BALANCED / TECHNICAL',
    origin: 'MEXICO',
    style: 'Lucha Libre & Muay Thai',
    maxHealth: 1000, speed: 4.5, runSpeed: 7.5,
    jumpForce: -18, gravity: 0.62, weight: 1.0,
    defense: 1.0, damageMultiplier: 1.0, grabRange: 70,
    stats: { health: 7, damage: 7, speed: 6, defense: 7, mobility: 6, difficulty: 4 },
    moves: {
      lightAttack: { name: 'Swift Jab', startup: 4, active: 3, recovery: 7, damage: 16, hitstun: 9, blockstun: 5, knockbackX: 2, knockbackY: 0, hitboxOffsetX: 54, hitboxW: 50, hitboxH: 28, armorStart: 0, armorEnd: 0, cancelInto: ['kick', 'heavyAttack'], counterHitStun: 12 },
      heavyAttack: { name: 'Thunder Cross', startup: 11, active: 5, recovery: 19, damage: 58, hitstun: 18, blockstun: 12, knockbackX: 10, knockbackY: -4, hitboxOffsetX: 62, hitboxW: 64, hitboxH: 40, armorStart: 2, armorEnd: 8, cancelInto: [], counterHitStun: 27 },
      kick: { name: 'Cyclone Kick', startup: 7, active: 4, recovery: 13, damage: 32, hitstun: 13, blockstun: 8, knockbackX: 6, knockbackY: -2, hitboxOffsetX: 53, hitboxW: 67, hitboxH: 34, armorStart: 0, armorEnd: 0, cancelInto: ['lightAttack', 'heavyAttack'], counterHitStun: 19 },
      grab: { name: 'Toss Slam', startup: 6, active: 4, recovery: 28, damage: 110, hitstun: 28, blockstun: 0, knockbackX: 0, knockbackY: -11, hitboxOffsetX: 68, hitboxW: 78, hitboxH: 88, isGrab: true, techable: true, missRecovery: 38 },
      special: { name: 'NOVA BURST', meterCost: 50, startup: 9, active: 7, recovery: 42, damage: 190, hitstun: 0, blockstun: 0, knockbackX: 0, knockbackY: -19, hitboxOffsetX: 76, hitboxW: 102, hitboxH: 112, isGrab: true, techable: false, liftFrames: 18, liftHeight: 200, slamFrames: 10, superFlashMs: 230, invincible: true, invincibleFrames: 24, screenShake: true, screenShakeWave2: true, groundCrack: true, shockwaveRing: true, dustClouds: true, impactFlashRadius: 90, sparksCount: 28, sfxActivate: 'specialActivate', sfxImpact: 'seismicImpact' },
    },
    ai: { aggressiveness: 0.7, blockFrequency: 0.35, comboChance: 0.6, dashFrequency: 0.35, grabFrequency: 0.35, retreatThreshold: 0.15 },
  },

  // ─────────────────────────────────────────────
  // 7. REAPER
  reaper: {
    id: 'reaper',
    name: 'REAPER',
    nickname: '"SILENT EDGE" VOSS',
    archetype: 'COUNTER / PUNISHER',
    origin: 'GERMANY',
    style: 'Systema & Knife Fighting',
    maxHealth: 900, speed: 4.8, runSpeed: 7.8,
    jumpForce: -17, gravity: 0.58, weight: 0.9,
    defense: 0.9, damageMultiplier: 1.15, grabRange: 68,
    stats: { health: 6, damage: 9, speed: 6, defense: 6, mobility: 6, difficulty: 7 },
    moves: {
      lightAttack: { name: 'Flick Strike', startup: 3, active: 3, recovery: 6, damage: 14, hitstun: 8, blockstun: 5, knockbackX: 2, knockbackY: 0, hitboxOffsetX: 50, hitboxW: 46, hitboxH: 26, armorStart: 0, armorEnd: 0, cancelInto: ['kick', 'heavyAttack'], counterHitStun: 11 },
      heavyAttack: { name: 'Death Blow', startup: 9, active: 5, recovery: 17, damage: 65, hitstun: 19, blockstun: 13, knockbackX: 11, knockbackY: -4, hitboxOffsetX: 63, hitboxW: 66, hitboxH: 42, armorStart: 0, armorEnd: 0, cancelInto: [], counterHitStun: 29 },
      kick: { name: 'Sweep Kick', startup: 6, active: 3, recovery: 11, damage: 28, hitstun: 12, blockstun: 7, knockbackX: 5, knockbackY: -1, hitboxOffsetX: 50, hitboxW: 66, hitboxH: 31, armorStart: 0, armorEnd: 0, cancelInto: ['lightAttack', 'heavyAttack'], counterHitStun: 17 },
      grab: { name: 'Choke Hold', startup: 5, active: 3, recovery: 26, damage: 85, hitstun: 26, blockstun: 0, knockbackX: 0, knockbackY: -9, hitboxOffsetX: 60, hitboxW: 70, hitboxH: 84, isGrab: true, techable: true, missRecovery: 32 },
      special: { name: 'DEATH DASH', meterCost: 50, startup: 4, active: 21, recovery: 23, damage: 15, hits: 6, hitstun: 7, blockstun: 0, finalHitKnockbackX: 12, finalHitKnockbackY: -7, finalHitDamage: 26, finalHitShake: 8, knockbackX: 1.4, knockbackY: 0, hitboxOffsetX: 48, hitboxW: 50, hitboxH: 140, isDash: true, dashSpeed: 15, dashPassThrough: true, dashOvershoot: 54, invincible: true, invincibleFrames: 20, afterimage: true, afterimageAlpha: 0.62, afterimageFade: 0.06, speedLineCount: 8, speedLineColor: '#aa2200', subHitSparkColor1: '#cc4422', subHitSparkColor2: '#ffffff', subHitSparkCount: 5, finalHitSparkCount: 16, finalHitSparkColor: '#aa2200', isGrab: false, techable: false, screenShake: false, sfxActivate: 'specialActivate', sfxSubHit: 'flurrySlash', sfxFinalHit: 'flurryFinish' },
    },
    ai: { aggressiveness: 0.8, blockFrequency: 0.3, comboChance: 0.7, dashFrequency: 0.5, grabFrequency: 0.2, retreatThreshold: 0.18 },
  },

  // ─────────────────────────────────────────────
  // 8. TITAN
  titan: {
    id: 'titan',
    name: 'TITAN',
    nickname: '"THE MOUNTAIN" CROSS',
    archetype: 'SUPER HEAVY / SLUGGER',
    origin: 'AUSTRALIA',
    style: 'Rugby Brawling & Power Wrestling',
    maxHealth: 1500, speed: 2.2, runSpeed: 3.8,
    jumpForce: -12, gravity: 0.85, weight: 2.0,
    defense: 1.5, damageMultiplier: 1.3, grabRange: 100,
    stats: { health: 10, damage: 10, speed: 1, defense: 10, mobility: 1, difficulty: 3 },
    moves: {
      lightAttack: { name: 'Heavy Jab', startup: 7, active: 5, recovery: 12, damage: 28, hitstun: 13, blockstun: 8, knockbackX: 4, knockbackY: 0, hitboxOffsetX: 62, hitboxW: 58, hitboxH: 35, armorStart: 0, armorEnd: 0, cancelInto: ['heavyAttack'], counterHitStun: 17 },
      heavyAttack: { name: 'Earthquake Smash', startup: 16, active: 7, recovery: 26, damage: 80, hitstun: 22, blockstun: 15, knockbackX: 14, knockbackY: -6, hitboxOffsetX: 70, hitboxW: 75, hitboxH: 48, armorStart: 4, armorEnd: 14, cancelInto: [], counterHitStun: 34 },
      kick: { name: 'Ground Pound', startup: 12, active: 6, recovery: 20, damage: 50, hitstun: 16, blockstun: 11, knockbackX: 8, knockbackY: -3, hitboxOffsetX: 62, hitboxW: 76, hitboxH: 40, armorStart: 0, armorEnd: 0, cancelInto: ['heavyAttack'], counterHitStun: 24 },
      grab: { name: 'Titan Slam', startup: 8, active: 6, recovery: 36, damage: 160, hitstun: 36, blockstun: 0, knockbackX: 0, knockbackY: -14, hitboxOffsetX: 80, hitboxW: 92, hitboxH: 100, isGrab: true, techable: true, missRecovery: 48 },
      special: { name: 'WORLD CRUSHER', meterCost: 50, startup: 12, active: 9, recovery: 50, damage: 240, hitstun: 0, blockstun: 0, knockbackX: 0, knockbackY: -22, hitboxOffsetX: 85, hitboxW: 115, hitboxH: 125, isGrab: true, techable: false, liftFrames: 22, liftHeight: 220, slamFrames: 14, superFlashMs: 260, invincible: true, invincibleFrames: 28, screenShake: true, screenShakeWave2: true, groundCrack: true, shockwaveRing: true, dustClouds: true, impactFlashRadius: 105, sparksCount: 36, sfxActivate: 'specialActivate', sfxImpact: 'seismicImpact' },
    },
    ai: { aggressiveness: 0.55, blockFrequency: 0.5, comboChance: 0.4, dashFrequency: 0.08, grabFrequency: 0.55, retreatThreshold: 0.08 },
  },

  // ─────────────────────────────────────────────
  // 9. SABLE
  sable: {
    id: 'sable',
    name: 'SABLE',
    nickname: '"DARK CURRENT" VANE',
    archetype: 'SPEEDSTER / COMBO',
    origin: 'FRANCE',
    style: 'Savate & Parkour Combat',
    maxHealth: 820, speed: 6.8, runSpeed: 10.5,
    jumpForce: -20, gravity: 0.52, weight: 0.68,
    defense: 0.82, damageMultiplier: 0.92, grabRange: 58,
    stats: { health: 5, damage: 6, speed: 10, defense: 5, mobility: 10, difficulty: 8 },
    moves: {
      lightAttack: { name: 'Snap Kick', startup: 3, active: 2, recovery: 5, damage: 11, hitstun: 7, blockstun: 4, knockbackX: 2, knockbackY: 0, hitboxOffsetX: 48, hitboxW: 44, hitboxH: 24, armorStart: 0, armorEnd: 0, cancelInto: ['lightAttack', 'kick', 'heavyAttack'], counterHitStun: 10 },
      heavyAttack: { name: 'Crescent Slash', startup: 8, active: 4, recovery: 15, damage: 42, hitstun: 16, blockstun: 11, knockbackX: 7, knockbackY: -3, hitboxOffsetX: 54, hitboxW: 59, hitboxH: 36, armorStart: 0, armorEnd: 0, cancelInto: ['kick'], counterHitStun: 23 },
      kick: { name: 'Vault Kick', startup: 6, active: 3, recovery: 10, damage: 26, hitstun: 12, blockstun: 7, knockbackX: 5, knockbackY: -1, hitboxOffsetX: 50, hitboxW: 65, hitboxH: 30, armorStart: 0, armorEnd: 0, cancelInto: ['lightAttack', 'heavyAttack'], counterHitStun: 17 },
      grab: { name: 'Flip Throw', startup: 5, active: 3, recovery: 24, damage: 72, hitstun: 24, blockstun: 0, knockbackX: 0, knockbackY: -8, hitboxOffsetX: 56, hitboxW: 66, hitboxH: 80, isGrab: true, techable: true, missRecovery: 30 },
      special: { name: 'DARK CURRENT', meterCost: 50, startup: 4, active: 22, recovery: 24, damage: 14, hits: 6, hitstun: 7, blockstun: 0, finalHitKnockbackX: 11, finalHitKnockbackY: -7, finalHitDamage: 23, finalHitShake: 8, knockbackX: 1.5, knockbackY: 0, hitboxOffsetX: 48, hitboxW: 50, hitboxH: 140, isDash: true, dashSpeed: 14, dashPassThrough: true, dashOvershoot: 55, invincible: true, invincibleFrames: 20, afterimage: true, afterimageAlpha: 0.65, afterimageFade: 0.06, speedLineCount: 8, speedLineColor: '#6600cc', subHitSparkColor1: '#aa44ff', subHitSparkColor2: '#ffffff', subHitSparkCount: 5, finalHitSparkCount: 16, finalHitSparkColor: '#6600cc', isGrab: false, techable: false, screenShake: false, sfxActivate: 'specialActivate', sfxSubHit: 'flurrySlash', sfxFinalHit: 'flurryFinish' },
    },
    ai: { aggressiveness: 0.88, blockFrequency: 0.22, comboChance: 0.78, dashFrequency: 0.65, grabFrequency: 0.18, retreatThreshold: 0.22 },
  },

  // ─────────────────────────────────────────────
  // 10. KANG
  kang: {
    id: 'kang',
    name: 'KANG',
    nickname: '"IRON FIST" JANG',
    archetype: 'BALANCED / MARTIAL ARTS',
    origin: 'KOREA',
    style: 'Taekwondo & Hapkido',
    maxHealth: 980, speed: 5.2, runSpeed: 8.2,
    jumpForce: -18, gravity: 0.6, weight: 0.95,
    defense: 1.0, damageMultiplier: 1.02, grabRange: 68,
    stats: { health: 7, damage: 7, speed: 7, defense: 7, mobility: 7, difficulty: 5 },
    moves: {
      lightAttack: { name: 'Iron Jab', startup: 4, active: 3, recovery: 7, damage: 17, hitstun: 9, blockstun: 5, knockbackX: 3, knockbackY: 0, hitboxOffsetX: 53, hitboxW: 50, hitboxH: 28, armorStart: 0, armorEnd: 0, cancelInto: ['kick', 'heavyAttack'], counterHitStun: 13 },
      heavyAttack: { name: 'Dragon Fist', startup: 11, active: 5, recovery: 19, damage: 60, hitstun: 18, blockstun: 12, knockbackX: 10, knockbackY: -4, hitboxOffsetX: 63, hitboxW: 65, hitboxH: 40, armorStart: 2, armorEnd: 9, cancelInto: [], counterHitStun: 28 },
      kick: { name: 'Axe Kick', startup: 7, active: 4, recovery: 13, damage: 34, hitstun: 14, blockstun: 9, knockbackX: 6, knockbackY: -2, hitboxOffsetX: 54, hitboxW: 68, hitboxH: 35, armorStart: 0, armorEnd: 0, cancelInto: ['lightAttack', 'heavyAttack'], counterHitStun: 20 },
      grab: { name: 'Hip Toss', startup: 6, active: 4, recovery: 27, damage: 105, hitstun: 27, blockstun: 0, knockbackX: 0, knockbackY: -10, hitboxOffsetX: 67, hitboxW: 77, hitboxH: 87, isGrab: true, techable: true, missRecovery: 36 },
      special: { name: 'IRON STORM', meterCost: 50, startup: 8, active: 7, recovery: 40, damage: 185, hitstun: 0, blockstun: 0, knockbackX: 0, knockbackY: -18, hitboxOffsetX: 75, hitboxW: 100, hitboxH: 110, isGrab: true, techable: false, liftFrames: 18, liftHeight: 200, slamFrames: 10, superFlashMs: 225, invincible: true, invincibleFrames: 24, screenShake: true, screenShakeWave2: true, groundCrack: true, shockwaveRing: true, dustClouds: true, impactFlashRadius: 90, sparksCount: 28, sfxActivate: 'specialActivate', sfxImpact: 'seismicImpact' },
    },
    ai: { aggressiveness: 0.72, blockFrequency: 0.33, comboChance: 0.62, dashFrequency: 0.38, grabFrequency: 0.32, retreatThreshold: 0.15 },
  },
};

/**
 * Stage definitions.
 * bgDraw is called each frame to render the stage background on Canvas.
 */
export const STAGE_DATA = [
  {
    id: 'underground',
    name: 'UNDERGROUND ARENA',
    groundColor: '#1a1208',
    bgColor: '#0a0805',
    accentColor: '#c8860a',
    description: 'Pit fights beneath the city.',
  },
  {
    id: 'factory',
    name: 'FACTORY RUINS',
    groundColor: '#1a1418',
    bgColor: '#0c0a0e',
    accentColor: '#8a4ea8',
    description: 'Abandoned industrial complex.',
  },
  {
    id: 'neon_rooftop',
    name: 'NEON ROOFTOP',
    groundColor: '#101820',
    bgColor: '#050e18',
    accentColor: '#0a8aff',
    description: 'City skyline, 40 floors up.',
  },
  {
    id: 'military_base',
    name: 'MILITARY BASE',
    groundColor: '#141a10',
    bgColor: '#0a0e08',
    accentColor: '#4a8a20',
    description: 'Decommissioned combat facility.',
  },
  {
    id: 'prison',
    name: 'PRISON ARENA',
    groundColor: '#141414',
    bgColor: '#0a0a0a',
    accentColor: '#aa4a00',
    description: 'Iron bars, iron fists.',
  },
  {
    id: 'corporate',
    name: 'CORPORATE TOWER',
    groundColor: '#101418',
    bgColor: '#080a10',
    accentColor: '#4a90c8',
    description: 'Glass and chrome boardroom arena.',
  },
];
