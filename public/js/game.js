import { Balloon, Bird, FloatingText, Dragon, GoldenBalloon, GoldenClock, Mouse, Hedgehog, Gopher, AmmoDrop, BulletTrace, Godzilla, BirthdayCap, Bomb, MagazineDrop, ShotgunDrop, Hydra, Pterodactyl } from './entities.js';

export class Game {
    constructor(canvas, onUIUpdate, onLevelComplete, onGameOver) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        
        // Delegates / Actions (Callbacks in JS)
        this.onUIUpdate = onUIUpdate;
        this.onLevelComplete = onLevelComplete;
        this.onGameOver = onGameOver;
        
        // Machine Gun State
        this.isMouseDown = false;
        this.machineGunActive = false;
        this.machineGunTimer = 0;
        this.shootInterval = 0;

        this.width = canvas.width;
        this.height = canvas.height;

        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        this.isMusicPlaying = false;
        
        this.reset();
        
        // Resize observer could go here
    }

    reset() {
        this.entities = [];
        this.particles = []; // For floating text
        this.score = 0;
        this.scoreAtLevelStart = 0; // Checkpoint for "Try Again"
        this.level = 1;
        this.bullets = 50; 
        this.shells = 5; 
        this.timeLeft = 0;
        this.lastTime = 0;
        this.isRunning = false;
        this.entitySpawnTimer = 0;
        
        // Game State Flags
        this.isPartyMode = false;
        this.partyModeTimer = 0;
        
        // Rare Item Trackers
        this.goldenBalloonSpawnedThisLevel = false;
        this.itemsSpawnedThisLevel = {
            clock: 0,
            ammo: 0,
            godzilla: 0,
            party: 0
        };
        
        this.machineGunActive = false;
        this.machineGunTimer = 0;
        this.shootInterval = 0;

        // Level Config - Difficulty ease-up
        this.levelConfig = {
            1: { minPoints: 35, duration: 30, spawnRate: 1100, speedMult: 1 },
            2: { minPoints: 90, duration: 30, spawnRate: 950, speedMult: 1.2 },
            3: { minPoints: 175, duration: 30, spawnRate: 850, speedMult: 1.5 },
            4: { minPoints: 290, duration: 25, spawnRate: 750, speedMult: 1.8 },
            5: { minPoints: 460, duration: 25, spawnRate: 650, speedMult: 2.2 }
        };

        this.stopMusic();
    }

    getLevelConfig(level) {
        if (level <= 5) return this.levelConfig[level];
        
        // Dynamic scaling beyond level 5
        const base = this.levelConfig[5];
        const extra = level - 5;
        
        return {
            minPoints: Math.floor(base.minPoints * Math.pow(1.2, extra)), // Grows exponentially 20%
            duration: base.duration,
            spawnRate: Math.max(300, base.spawnRate - (extra * 50)), // Caps at 300ms
            speedMult: base.speedMult + (extra * 0.2) // Linearly faster
        };
    }

    startLevel(level) {
        if (level > this.level) {
             this.scoreAtLevelStart = this.score;
        } else {
            this.score = this.scoreAtLevelStart;
        }

        this.level = level;
        // Refill ammo at start of level (or we could carry over, but refill is safer for balance)
        this.bullets = 50; 
        this.shells = 5; 
        
        this.itemsSpawnedThisLevel = { clock: 0, ammo: 0, godzilla: 0, party: 0, hydra: 0, pterodactyl: 0 };
        this.goldenBalloonSpawnedThisLevel = false;
        this.machineGunActive = false;
        this.isPartyMode = false;

        const config = this.getLevelConfig(level);
        this.timeLeft = config.duration;
        this.entities = [];
        this.particles = [];
        this.isRunning = true;
        this.lastTime = performance.now();
        
        if (!this.isMusicPlaying) this.startMusic();

        this.loop(this.lastTime);
    }
    
    retryLevel() {
        this.startLevel(this.level);
    }

    // Main Game Loop
    loop(timestamp) {
        if (!this.isRunning) return;

        const deltaTime = timestamp - this.lastTime;
        this.lastTime = timestamp;

        this.update(deltaTime);
        this.draw();

        requestAnimationFrame((ts) => this.loop(ts));
    }

    update(deltaTime) {
        // Timer Logic
        this.timeLeft -= deltaTime / 1000;
        if (this.timeLeft <= 0) {
            this.handleLevelEnd();
            return;
        }

        // Party Mode Logic
        if (this.isPartyMode) {
            this.partyModeTimer -= deltaTime / 1000;
            if (this.partyModeTimer <= 0) {
                this.isPartyMode = false;
                this.stopMusic(); 
                this.startMusic(); // Restart normal ambient music
            }
        }
        
        // Machine Gun Logic
        if (this.machineGunActive) {
            this.machineGunTimer -= deltaTime / 1000;
            if (this.machineGunTimer <= 0) {
                this.machineGunActive = false;
                this.particles.push(new FloatingText(this.width/2, this.height/2, "MG EMPTY", "white"));
            } else {
                 this.shootInterval += deltaTime;
                 if (this.shootInterval > 80) { 
                     this.fireMachineGun();
                     this.shootInterval = 0;
                 }
            }
        }

        // Spawning Logic
        this.entitySpawnTimer += deltaTime;
        const currentConfig = this.getLevelConfig(this.level);
        
        // Party Mode spawns much faster (Full Screen of Balloons)
        // 40ms interval = ~25 balloons per second
        const spawnRate = this.isPartyMode ? 40 : currentConfig.spawnRate;

        if (this.entitySpawnTimer > spawnRate) {
            this.spawnEntity(currentConfig.speedMult);
            this.entitySpawnTimer = 0;
        }

        // Entity Updates
        this.entities.forEach(e => {
            e.update(deltaTime);
            
            // Godzilla Ambient & Stomp Logic
            if (e instanceof Godzilla) {
                if (e.wantsToRoar) {
                    this.playGodzillaRoar(true);
                    e.wantsToRoar = false;
                }
                
                // Stomp/Trample Logic
                this.entities.forEach(other => {
                    if (!other.markedForDeletion && (other instanceof Mouse || other instanceof Hedgehog || other instanceof Gopher)) {
                        const dx = Math.abs(e.x - other.x);
                        const dy = Math.abs(e.y - other.y);
                        if (dx < 50 && dy < 60) {
                            other.markedForDeletion = true;
                            // Penalize Score
                            const penalty = Math.floor(Math.random() * 3) + 1; // 1-3
                            this.score = Math.max(0, this.score - penalty);
                            this.particles.push(new FloatingText(other.x, other.y, `-${penalty}`, "red"));
                            this.playSqueak();
                        }
                    }
                });
            }

            // Hydra Logic
            if (e instanceof Hydra) {
                // Eats ground animals
                this.entities.forEach(other => {
                    if (!other.markedForDeletion && (other instanceof Mouse || other instanceof Hedgehog || other instanceof Gopher)) {
                        const dx = Math.abs(e.x - other.x);
                        const dy = Math.abs(e.y - other.y);
                        if (dx < 60 && dy < 60) {
                            other.markedForDeletion = true;
                            const penalty = Math.floor(Math.random() * 3) + 1;
                            this.score = Math.max(0, this.score - penalty);
                            this.particles.push(new FloatingText(other.x, other.y, `-${penalty}`, "red"));
                            this.playSqueak();
                        }
                    }
                });
            }

            // Pterodactyl Logic
            if (e instanceof Pterodactyl) {
                // Eats Birds
                this.entities.forEach(other => {
                    if (!other.markedForDeletion && other instanceof Bird) {
                        const dist = Math.hypot(e.x - other.x, e.y - other.y);
                        if (dist < 60) {
                            other.markedForDeletion = true;
                            const penalty = 5; 
                            this.score = Math.max(0, this.score - penalty);
                            this.particles.push(new FloatingText(other.x, other.y, `-${penalty}`, "red"));
                            this.playSqueak(); // reuse squeak or add screech
                        }
                    }
                });
            }
            
            // Bomb Timer Logic
            if (e instanceof Bomb) {
                e.timer -= deltaTime / 1000;
                if (e.timer <= 0) {
                    this.explodeBomb(e);
                }
            }
        });
        
        this.entities = this.entities.filter(e => !e.markedForDeletion);

        // Particle Updates
        this.particles.forEach(p => p.update(deltaTime));
        this.particles = this.particles.filter(p => !p.markedForDeletion);

        // Update UI
        this.onUIUpdate({
            score: this.score,
            roundScore: this.score - this.scoreAtLevelStart,
            bullets: this.machineGunActive ? "∞" : this.bullets,
            shells: this.shells,
            level: this.level,
            time: Math.ceil(this.timeLeft),
            target: currentConfig.minPoints,
            machineGunActive: this.machineGunActive
        });
    }

    draw() {
        this.ctx.clearRect(0, 0, this.width, this.height);
        this.entities.forEach(e => e.draw(this.ctx));
        this.particles.forEach(p => p.draw(this.ctx));
        
        if (this.machineGunActive && this.isMouseDown) {
             // Optional: Muzzle flash could be drawn here
        }
    }

    spawnEntity(speedMult) {
        // Party Mode Override: Intense balloon spawn
        if (this.isPartyMode) {
            this.entities.push(new Balloon(this.width, this.height, speedMult * 1.5));
            return;
        }

        const rand = Math.random();
        
        // Rare Items Logic...
        
        // Birthday Cap (Level >= 4, once per round)
        if (this.level >= 4 && this.itemsSpawnedThisLevel.party < 1 && Math.random() < 0.02) {
            this.entities.push(new BirthdayCap(this.width, this.height));
            this.itemsSpawnedThisLevel.party++;
            return;
        }
        
        // The Bomb (Level >= 5) - Rare (maybe 1-2%)
        if (this.level >= 5 && Math.random() < 0.015) {
            this.entities.push(new Bomb(this.width, this.height));
            return;
        }

        // Golden Balloon (Once per level, Level >= 3)
        if (this.level >= 3 && !this.goldenBalloonSpawnedThisLevel && Math.random() < 0.03) {
             this.entities.push(new GoldenBalloon(this.width, this.height));
             this.goldenBalloonSpawnedThisLevel = true;
             return;
        }
        
        // Godzilla (Max 2 per level, Max 1 on screen)
        const godzillaOnScreen = this.entities.some(e => e instanceof Godzilla);
        // Requirement: More frequent (increased to 0.025)
        if (!godzillaOnScreen && this.level >= 4 && this.itemsSpawnedThisLevel.godzilla < 2 && Math.random() < 0.025) {
             this.entities.push(new Godzilla(this.width, this.height));
             this.itemsSpawnedThisLevel.godzilla++;
             this.playGodzillaRoar(false); 
             return;
        }

        // Hydra (Level >= 6) ~ Independent
        const hydraOnScreen = this.entities.some(e => e instanceof Hydra);
        if (!hydraOnScreen && this.level >= 6 && this.itemsSpawnedThisLevel.hydra < 2 && Math.random() < 0.025) {
             this.entities.push(new Hydra(this.width, this.height));
             this.itemsSpawnedThisLevel.hydra++;
             this.playGodzillaRoar(false); // Reuse roar for now
             return;
        }

        // Pterodactyl (Level >= 7) Max 2
        // Can coexist, so no exclusion check against others
        if (this.level >= 7 && this.itemsSpawnedThisLevel.pterodactyl < 2 && Math.random() < 0.025) {
             this.entities.push(new Pterodactyl(this.width, this.height));
             this.itemsSpawnedThisLevel.pterodactyl++;
             return;
        }

        // Golden Clock (Max 1 per level, Level >= 2)
        if (this.level >= 2 && this.itemsSpawnedThisLevel.clock < 2 && Math.random() < 0.015) {
             this.entities.push(new GoldenClock(this.width, this.height));
             this.itemsSpawnedThisLevel.clock++;
             return;
        }
        
        // Machine Gun Ammo (Infinite for 5 secs)
        if (this.itemsSpawnedThisLevel.ammo < 4 && Math.random() < 0.015) {
             this.entities.push(new AmmoDrop(this.width, this.height));
             this.itemsSpawnedThisLevel.ammo++;
             return;
        }
        
        // Magazine Drop (+10 Bullets)
        if (Math.random() < 0.03) {
            this.entities.push(new MagazineDrop(this.width, this.height));
            return;
        }

        // Shotgun Drop (+5 Shells)
        if (Math.random() < 0.02) {
            this.entities.push(new ShotgunDrop(this.width, this.height));
            return;
        }

        // 5% chance for Dragon
        if (rand < 0.05) {
             this.entities.push(new Dragon(this.width, this.height));
        } 
        // Ground Animal
        else if (this.level >= 3 && Math.random() < 0.35 && rand < 0.25) {
             const r2 = Math.random();
             if (r2 < 0.33) this.entities.push(new Mouse(this.width, this.height));
             else if (r2 < 0.66) this.entities.push(new Hedgehog(this.width, this.height));
             else this.entities.push(new Gopher(this.width, this.height));
        }
        else if (rand > 0.75) {
            this.entities.push(new Bird(this.width, this.height, speedMult));
        } else {
            this.entities.push(new Balloon(this.width, this.height, speedMult));
        }
    }
    
    setMouseState(isDown, x, y) {
        this.isMouseDown = isDown;
        this.mouseX = x;
        this.mouseY = y;
    }

    handleClick(x, y) {
        if (!this.isRunning) return;
        
        // Update stored mouse pos
        this.mouseX = x;
        this.mouseY = y;

        // If Machine Gun is active, clicking handles single shots too, 
        // but update loop handles rapid fire.
        // We only process 'Click' if NOT machine gun to avoid double fire
        if (this.machineGunActive) return;

        if (this.bullets <= 0) {
            return;
        }

        this.bullets--;

        // Play shot sound
        this.playShotSound();

        // Target Logic
        this.checkHit(x, y);
    }
    
    fireMachineGun() {
        if (!this.mouseX) return;
        
        this.playMachineGunSound();
        
        // Add random spread
        const spreadX = this.mouseX + (Math.random() * 40 - 20);
        const spreadY = this.mouseY + (Math.random() * 40 - 20);
        
        // Visual Trace (Requirement 8)
        // From bottom center or random bottom position to target
        // Let's say it comes from bottom center of screen for simplicity
        const startX = this.width / 2 + (Math.random() * 100 - 50);
        const startY = this.height;
        this.particles.push(new BulletTrace(startX, startY, spreadX, spreadY));

        this.checkHit(spreadX, spreadY);
    }
    
    checkHit(x, y) {
        // Iterate backwards to click top-most items first
        for (let i = this.entities.length - 1; i >= 0; i--) {
            const entity = this.entities[i];
            
            // Bomb Handling: Specific Check
            // "when the bomb falls it gets triggered even if I hit some other object"
            // This suggests that a hit might be registering on the bomb unintentionally.
            // If the bomb is distinct, checking `isClicked` should be safe IF `isClicked` is correct.
            // But if users feel it triggers wrongly, maybe the hit box is too big or overlapping?
            // AND we must ensure that if we click a bomb, we DON'T continue to check other entities 
            // underneath (although standard loop breaks).
            // BUT if we click a balloon, and bomb is nearby, bomb should NOT explode.
            
            // Standard check
            if (entity.isClicked(x, y)) {
                
                // Godzilla Boss Logic
                if (entity instanceof Godzilla) {
                    entity.hp--; 
                    const hitPoints = Math.floor(Math.random() * 5) + 1;
                    this.score += hitPoints;
                    this.particles.push(new FloatingText(x, y, `+${hitPoints}`, 'lime'));
                    
                    if (entity.hp <= 0) {
                        entity.markedForDeletion = true;
                        this.score += entity.killPoints;
                        this.particles.push(new FloatingText(x, y - 50, `KILLED! +${entity.killPoints}`, 'lime'));
                    }
                    return; 
                }

                if (entity instanceof Hydra) {
                    entity.hp--;
                    const hitPoints = Math.floor(Math.random() * 5) + 1;
                    this.score += hitPoints;
                    this.particles.push(new FloatingText(x, y, `+${hitPoints}`, 'lime'));
                    if (entity.hp <= 0) {
                        entity.markedForDeletion = true;
                        this.score += entity.killPoints;
                        this.particles.push(new FloatingText(x, y - 50, `KILLED! +${entity.killPoints}`, 'lime'));
                    }
                    return;
                }

                if (entity instanceof Pterodactyl) {
                    entity.hp--;
                    const hitPoints = Math.floor(Math.random() * 5) + 1;
                    this.score += hitPoints;
                    this.particles.push(new FloatingText(x, y, `+${hitPoints}`, 'lime'));
                    if (entity.hp <= 0) {
                        entity.markedForDeletion = true;
                        this.score += entity.killPoints;
                        this.particles.push(new FloatingText(x, y - 50, `KILLED! +${entity.killPoints}`, 'lime'));
                    }
                    return;
                }
                
                // Bomb Hit 
                if (entity instanceof Bomb) {
                    this.explodeBomb(entity);
                    return;
                }

                // Handle Bonuses
                if (entity.isBonus) {
                     if (entity.bonusType === 'time') {
                         this.timeLeft += 10;
                         this.particles.push(new FloatingText(x, y, "+10s", "cyan"));
                     } else if (entity.bonusType === 'ammo') {
                         // Machine Gun
                         this.machineGunActive = true;
                         this.machineGunTimer = 5.0;
                         this.shootInterval = 100; 
                         this.particles.push(new FloatingText(x, y, "MACHINE GUN!", "gold"));
                     } else if (entity.bonusType === 'bullets') {
                         this.bullets += 10;
                         this.particles.push(new FloatingText(x, y, "+10 BULLETS", "gold"));
                     } else if (entity.bonusType === 'shells') {
                         this.shells += 5;
                         this.particles.push(new FloatingText(x, y, "+5 SHELLS", "#A52A2A"));
                     } else if (entity.bonusType === 'party') {
                         this.startPartyMode();
                         this.particles.push(new FloatingText(x, y, "PARTY MODE!", "magenta"));
                     }
                     entity.markedForDeletion = true;
                     return;
                }
                
                // Normal Hit
                this.score += entity.points;
                entity.markedForDeletion = true; 
                
                if (entity instanceof GoldenBalloon) {
                    this.playCelebrationSound();
                }

                const color = entity.points >= 0 ? 'lime' : 'red';
                const sign = entity.points >= 0 ? '+' : '';
                this.particles.push(new FloatingText(entity.x, entity.y, `${sign}${entity.points}`, color));

                return; // Only pop one per click
            }
        }
    }

    handleRightClick(x, y) {
        if (!this.isRunning || this.shells <= 0) return;

        this.shells--;
        this.playShotSound(true); // Shotgun sound

        // Shotgun Logic: Area of Effect
        const blastRadius = 120; // Increased radius
        let somethingHit = false;

        this.particles.push(new FloatingText(x, y, "BOOM!", "orange"));

        // Iterate backwards
        for (let i = this.entities.length - 1; i >= 0; i--) {
            const entity = this.entities[i];
            
            // Bomb Immunity: Shotgun shouldn't auto-detonate bomb unless directly hit? 
            // The requirement says "independent". If I shot NEAR a bomb, it shouldn't explode?
            // "when the bomb falls it gets triggered even if I hit some other object"
            // This might happen if I use shotgun and blast radius clips the bomb.
            // Let's make bomb immune to indirect shotgun fire (only direct click triggers?)
            // Or maybe just ensure we don't accidentally select it if we aimed at something else.
            
            if (entity instanceof Bomb) {
                // Only explode if really close (direct hit intention)
                const distToBomb = Math.hypot(x - entity.x, y - entity.y);
                if (distToBomb < 40) { // Smaller direct hit zone for bomb via shotgun
                    this.explodeBomb(entity);
                    somethingHit = true;
                }
                continue; // Don't process standard radius check for bomb
            }

            if (entity.isBonus) continue;

            const dist = Math.hypot(x - entity.x, y - entity.y);
            
            // Godzilla / Hydra / Pterodactyl Logic (Shared Boss Damage)
            if (entity instanceof Godzilla || entity instanceof Hydra || entity instanceof Pterodactyl) {
                // Calculate distance to Bounding Box
                // Default: Bottom-Center Anchor (Godzilla, Hydra)
                let rx = entity.x - entity.width / 2;
                let ry = entity.y - entity.height;
                let rw = entity.width;
                let rh = entity.height;

                // Pterodactyl is Center Anchor
                if (entity instanceof Pterodactyl) {
                    ry = entity.y - entity.height / 2;
                }

                // Closest point on rectangle to click
                const closeX = Math.max(rx, Math.min(x, rx + rw));
                const closeY = Math.max(ry, Math.min(y, ry + rh));
                
                const distBox = Math.hypot(x - closeX, y - closeY);

                if (distBox < blastRadius) {
                    entity.hp -= 5;
                    this.particles.push(new FloatingText(entity.x, entity.y - 50, "-5 HP", "red"));
                    somethingHit = true;
                    
                    if (entity.hp <= 0) {
                        entity.markedForDeletion = true;
                        this.score += entity.killPoints;
                        this.particles.push(new FloatingText(entity.x, entity.y - 100, `KILLED! +${entity.killPoints}`, 'lime'));
                    }
                }
                continue;
            }
            
            if (dist < entity.radius + blastRadius) {
                this.score += entity.points;
                entity.markedForDeletion = true;
                
                const color = entity.points >= 0 ? 'lime' : 'red';
                const sign = entity.points >= 0 ? '+' : '';
                this.particles.push(new FloatingText(entity.x, entity.y, `${sign}${entity.points}`, color));
                somethingHit = true;
            }
        }
    }

    handleLevelEnd() {
        this.isRunning = false;
        const config = this.getLevelConfig(this.level);
        
        // Calculate points gained THIS level only
        const pointsGained = this.score - this.scoreAtLevelStart;

        if (pointsGained >= config.minPoints) {
            this.onLevelComplete(this.score, this.level);
        } else {
            this.onGameOver(this.score);
        }
    }

    playMachineGunSound() {
        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }
        
        const osc = this.audioCtx.createOscillator();
        const gainNode = this.audioCtx.createGain();

        osc.connect(gainNode);
        gainNode.connect(this.audioCtx.destination);

        // Fast Pulse
        osc.type = 'square';
        osc.frequency.setValueAtTime(150, this.audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(50, this.audioCtx.currentTime + 0.05);

        gainNode.gain.setValueAtTime(0.3, this.audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.05);

        osc.start();
        osc.stop(this.audioCtx.currentTime + 0.05);
    }

    playCelebrationSound() {
        if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
        
        const now = this.audioCtx.currentTime;
        
        // Major Arpeggio Fanfare
        const notes = [523.25, 659.25, 783.99, 1046.50]; // C E G C
        
        notes.forEach((freq, i) => {
            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();
            
            osc.connect(gain);
            gain.connect(this.audioCtx.destination);
            
            osc.frequency.value = freq;
            osc.type = 'triangle';
            
            const start = now + (i * 0.1);
            const duration = 0.3;
            
            gain.gain.setValueAtTime(0, start);
            gain.gain.linearRampToValueAtTime(0.3, start + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
            
            osc.start(start);
            osc.stop(start + duration);
        });
    }
    
    playGodzillaRoar(isAmbient = false) {
        if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
        
        const now = this.audioCtx.currentTime;
        const volume = isAmbient ? 0.4 : 0.8;
        const duration = isAmbient ? 1.0 : 2.5;

        // Complex Roar Synthesis: Detuned Sawtooths + Noise + Filter Modulation
        
        // 1. Noise Layer (Texture)
        const bufferSize = this.audioCtx.sampleRate * duration;
        const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        const noise = this.audioCtx.createBufferSource();
        noise.buffer = buffer;
        const noiseFilter = this.audioCtx.createBiquadFilter();
        noiseFilter.type = 'lowpass';
        noiseFilter.frequency.value = 800;
        const noiseGain = this.audioCtx.createGain();
        noiseGain.gain.setValueAtTime(0.5 * volume, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, now + duration);
        
        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(this.audioCtx.destination);
        noise.start(now);
        
        // 2. Growl Layer (Sawtooth with rough modulation)
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        const mainFilter = this.audioCtx.createBiquadFilter();
        
        osc.type = 'sawtooth';
        // Pitch drop: Start mid-low, drop very low
        const startFreq = isAmbient ? 120 : 200;
        osc.frequency.setValueAtTime(startFreq, now);
        osc.frequency.exponentialRampToValueAtTime(30, now + duration);
        
        // Modulation for "Gargle/Roar" texture
        const modOsc = this.audioCtx.createOscillator();
        modOsc.type = 'sine';
        modOsc.frequency.setValueAtTime(30, now); // Fast rumble
        const modGain = this.audioCtx.createGain();
        modGain.gain.value = 50;
        modOsc.connect(modGain);
        modGain.connect(osc.frequency);
        modOsc.start(now);
        modOsc.stop(now + duration);

        // Filter sweep
        mainFilter.type = 'lowpass';
        mainFilter.Q.value = 5;
        mainFilter.frequency.setValueAtTime(400, now);
        mainFilter.frequency.linearRampToValueAtTime(1200, now + duration * 0.3); // Open mouth
        mainFilter.frequency.linearRampToValueAtTime(100, now + duration); // Close mouth
        
        osc.connect(mainFilter);
        mainFilter.connect(gain);
        gain.connect(this.audioCtx.destination);
        
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(volume, now + 0.1);
        gain.gain.exponentialRampToValueAtTime(0.01, now + duration);
        
        osc.start(now);
        osc.stop(now + duration);
    }

    // Audio Synthesis using Web Audio API (No external files needed)
    playShotSound(isShotgun = false) {
        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }

        const osc = this.audioCtx.createOscillator();
        const gainNode = this.audioCtx.createGain();

        // Standard Gunshot (Sawtooth ramp)
        if (!isShotgun) {
            osc.connect(gainNode);
            gainNode.connect(this.audioCtx.destination);

            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(120, this.audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.15);

            gainNode.gain.setValueAtTime(0.3, this.audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.15);

            osc.start();
            osc.stop(this.audioCtx.currentTime + 0.15);
        } 
        // Realistic Shotgun Synthesis
        else {
            // Layer 1: The "Thump" (Low Frequency Sine Drop)
            // Adds punch/impact
            const kickOsc = this.audioCtx.createOscillator();
            const kickGain = this.audioCtx.createGain();
            kickOsc.connect(kickGain);
            kickGain.connect(this.audioCtx.destination);
            
            kickOsc.frequency.setValueAtTime(150, this.audioCtx.currentTime);
            kickOsc.frequency.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.5);
            
            kickGain.gain.setValueAtTime(0.8, this.audioCtx.currentTime);
            kickGain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.5);
            
            kickOsc.start();
            kickOsc.stop(this.audioCtx.currentTime + 0.5);

            // Layer 2: The "Crack/Blast" (Noise)
            // Simulates the explosion and shell pellets
            const bufferSize = this.audioCtx.sampleRate * 0.5; // 0.5 sec buffer
            const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
            const data = buffer.getChannelData(0);
            
            for (let i = 0; i < bufferSize; i++) {
                data[i] = Math.random() * 2 - 1;
            }

            const noise = this.audioCtx.createBufferSource();
            noise.buffer = buffer;
            const noiseGain = this.audioCtx.createGain();
            
            // Filter noise to remove harsh high frequencies (make it sound "heavy")
            const noiseFilter = this.audioCtx.createBiquadFilter();
            noiseFilter.type = 'lowpass';
            noiseFilter.frequency.value = 1000;

            noise.connect(noiseFilter);
            noiseFilter.connect(noiseGain);
            noiseGain.connect(this.audioCtx.destination);

            noiseGain.gain.setValueAtTime(0.8, this.audioCtx.currentTime);
            noiseGain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.4);

            noise.start();
        }
    }
    
    // Simple Ambient Loop using Oscillator
    startMusic() {
        if (this.isMusicPlaying) return;
        this.isMusicPlaying = true;
        
        const playNote = () => {
             if (!this.isRunning) {
                 this.isMusicPlaying = false;
                 return;
             }
             
             // Create a soft sine wave "pluck"
             const osc = this.audioCtx.createOscillator();
             const gain = this.audioCtx.createGain();
             
             osc.connect(gain);
             gain.connect(this.audioCtx.destination);
             
             // Random pentatonic note approximately
             // Added more notes for dynamic feel + Rhythm change
             const freqs = [330, 392, 440, 494, 523, 587, 659, 784];
             const freq = freqs[Math.floor(Math.random() * freqs.length)];
             
             osc.frequency.value = freq;
             osc.type = 'triangle'; // Changed to triangle for warmer sound
             
             const duration = (Math.random() > 0.7) ? 0.2 : 0.6; // Variable duration
             
             gain.gain.setValueAtTime(0.05, this.audioCtx.currentTime);
             gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + duration);
             
             osc.start();
             osc.stop(this.audioCtx.currentTime + duration);
             
             // Variable tempo
             const nextNote = (Math.random() * 200) + 200; 
             setTimeout(playNote, nextNote); 
        };
        
        playNote();
    }

    stopMusic() {
        this.isMusicPlaying = false;
        // The loop in startMusic will check this flag and stop itself
        if (this.audioCtx.state !== 'suspended') {
             // this.audioCtx.suspend(); // Optional: pause everything
        }
    }

    startPartyMode() {
        if (this.isPartyMode) return;
        this.isPartyMode = true;
        this.partyModeTimer = 5.0; // 5 seconds
        
        // Stop current music loops to play specific tune
        this.stopMusic(); 
        this.playPartyTune();
    }

    explodeBomb(bomb) {
        if (bomb.markedForDeletion) return;
        bomb.markedForDeletion = true; // Remove the bomb itself
        
        this.playExplosion();
        this.particles.push(new FloatingText(bomb.x, bomb.y, "KA-BOOM!", "red"));
        
        // Kill everything in radius
        // 3x Shotgun radius (120 * 3 = 360)
        const blastRadius = 360; 
        // 5x Shotgun Power (5 * 5 = 25)
        const damage = 25;
        
        let killCount = 0;
        let pointsGained = 0;
        
        this.entities.forEach(e => {
            if (e === bomb) return;
            if (e.markedForDeletion) return;
            
            // Exclude "Non-Living" objects (Items/Bonuses)
            if (e.isBonus) return;
            
            const dist = Math.hypot(e.x - bomb.x, e.y - bomb.y);
            if (dist < blastRadius) {
                // Bosses: Godzilla, Hydra, Pterodactyl
                if (e instanceof Godzilla || e instanceof Hydra || e instanceof Pterodactyl) {
                    e.hp -= damage;
                    this.particles.push(new FloatingText(e.x, e.y - 100, `-${damage} HP`, "red"));
                    if (e.hp <= 0) {
                         e.markedForDeletion = true;
                         pointsGained += e.killPoints;
                         killCount++;
                         this.particles.push(new FloatingText(e.x, e.y - 50, "KILLED!", "lime"));
                    }
                } else {
                    // Everything else dies (Living things: Animals, Birds, Balloons)
                    e.markedForDeletion = true;
                    // Fix NaN: Ensure points defined
                    const pts = e.points !== undefined ? e.points : 0;
                    pointsGained += pts;
                    killCount++;
                }
            }
        });
        
        if (killCount > 0) {
             this.score += pointsGained;
             
             const color = pointsGained >= 0 ? "lime" : "red";
             const sign = pointsGained >= 0 ? "+" : "";
             this.particles.push(new FloatingText(bomb.x, bomb.y - 40, `${sign}${pointsGained}`, color));
        }
    }
    
    playSqueak() {
        if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        
        // High pitch short squeak
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1500, this.audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(800, this.audioCtx.currentTime + 0.1);
        
        gain.gain.setValueAtTime(0.2, this.audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.1);
        
        osc.start();
        osc.stop(this.audioCtx.currentTime + 0.1);
    }
    
    playExplosion() {
        if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
        
        // White noise burst
        const bufferSize = this.audioCtx.sampleRate * 1.0; 
        const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
        
        const noise = this.audioCtx.createBufferSource();
        noise.buffer = buffer;
        const gain = this.audioCtx.createGain();
        
        // Lowpass for muffled heavy explosion
        const filter = this.audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 1000;
        filter.frequency.exponentialRampToValueAtTime(100, this.audioCtx.currentTime + 1.0);
        
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.audioCtx.destination);
        
        gain.gain.setValueAtTime(1.0, this.audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 1.0);
        
        noise.start();
    }
    
    playPartyTune() {
         if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
         
         const melody = [523, 523, 587, 523, 659, 698]; // Happy Birthday snippets
         let time = this.audioCtx.currentTime;
         
         melody.forEach((freq, index) => {
             const osc = this.audioCtx.createOscillator();
             const gain = this.audioCtx.createGain();
             osc.connect(gain);
             gain.connect(this.audioCtx.destination);
             
             osc.type = 'square'; // 8-bit style
             osc.frequency.value = freq;
             
             gain.gain.setValueAtTime(0.1, time);
             gain.gain.linearRampToValueAtTime(0, time + 0.15);
             
             osc.start(time);
             osc.stop(time + 0.2);
             
             time += 0.2;
         });
    }
}
