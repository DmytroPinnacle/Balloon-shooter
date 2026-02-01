// Similar to a C# Abstract Base Class
export class GameObject {
    constructor(x, y, radius, speed) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.speed = speed;
        this.markedForDeletion = false;
    }

    update(deltaTime) {
        // Virtual method to be overridden
    }

    draw(ctx) {
        // Virtual method
    }

    // AABB Collision detection (simplified for circles)
    isClicked(mouseX, mouseY) {
       // If width/height are set, use Rectangle Collision (for Godzilla)
       if (this.width && this.height) {
            // Check if bounds are defined relative to center/bottom
            // For Godzilla, X is center, Y is bottom.
            const halfW = this.width / 2;
            const top = this.y - this.height;
            const bottom = this.y;
            const left = this.x - halfW;
            const right = this.x + halfW;
            
            return (mouseX >= left && mouseX <= right && mouseY >= top && mouseY <= bottom);
       }

        const dist = Math.hypot(mouseX - this.x, mouseY - this.y);
        return dist < this.radius;
    }
}

export class FloatingText extends GameObject {
    constructor(x, y, text, color) {
        super(x, y, 0, 50); // Speed in px/second (moves up)
        this.text = text;
        this.color = color;
        this.life = 1.0; // Seconds
        this.opacity = 1;
    }

    update(deltaTime) {
        this.y -= this.speed * (deltaTime / 1000);
        this.life -= (deltaTime / 1000);
        this.opacity = Math.max(0, this.life);
        if (this.life <= 0) this.markedForDeletion = true;
    }

    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.opacity;
        ctx.fillStyle = this.color;
        ctx.font = 'bold 24px Segoe UI';
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 1;
        ctx.fillText(this.text, this.x, this.y);
        ctx.strokeText(this.text, this.x, this.y);
        ctx.restore();
    }
}

export class Balloon extends GameObject {
    constructor(canvasWidth, canvasHeight, speedMultiplier = 1) {
        const radius = 30;
        const x = Math.random() * (canvasWidth - radius * 2) + radius;
        const y = canvasHeight + radius; // Start below screen
        // Base speed plus random variation
        const speed = (Math.random() * 200 + 100) * speedMultiplier; 
        
        super(x, y, radius, speed);
        
        this.color = `hsl(${Math.random() * 360}, 70%, 50%)`;
        
        // Points calculation based on speed
        // Faster balloons = more points
        // Base is 10, plus bonus for speed
        const speedBonus = Math.floor(speed / 50);
        this.points = 10 + speedBonus;
    }

    update(deltaTime) {
        // normalized speed with deltaTime
        this.y -= this.speed * (deltaTime / 1000);
        
        if (this.y + this.radius < 0) { 
            this.markedForDeletion = true;
        }
    }

    draw(ctx) {
        if (!isFinite(this.x) || !isFinite(this.y)) return; // Safety check for bug

        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.strokeStyle = 'white';
        ctx.stroke();
        
        // Shine effect
        ctx.beginPath();
        ctx.arc(this.x - 10, this.y - 10, 5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fill();
        
        // String
        ctx.beginPath();
        ctx.moveTo(this.x, this.y + this.radius);
        ctx.lineTo(this.x, this.y + this.radius + 30);
        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx.stroke();
    }
}

export class GoldenBalloon extends Balloon {
    constructor(canvasWidth, canvasHeight) {
        super(canvasWidth, canvasHeight, 2.0); 
        this.color = 'gold';
        this.points = 100;
        this.radius = 25;
        this.wobble = Math.random() * Math.PI * 2;
    }
    
    update(deltaTime) {
        super.update(deltaTime);
        this.wobble += deltaTime / 200;
        this.x += Math.sin(this.wobble) * 2; // Add side-to-side motion
    }

    draw(ctx) {
        if (!isFinite(this.x) || !isFinite(this.y)) return;

        // Aureola / Glow
        const gradient = ctx.createRadialGradient(this.x, this.y, this.radius * 0.5, this.x, this.y, this.radius * 1.5);
        gradient.addColorStop(0, 'rgba(255, 215, 0, 0.8)'); // Inner gold
        gradient.addColorStop(1, 'rgba(255, 223, 0, 0.0)'); // Outer fade

        ctx.save();
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius * 2.0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Main Ball
        super.draw(ctx);
        
        // Intense Sparkle Effect
        const time = Date.now();
        if (time % 100 < 50) {
             ctx.fillStyle = 'white';
             const angle = Math.random() * Math.PI * 2;
             const r = this.radius + 5;
             ctx.fillRect(this.x + Math.cos(angle)*r, this.y + Math.sin(angle)*r, 4, 4);
        }
    }
}

export class BulletTrace extends GameObject {
    constructor(startX, startY, targetX, targetY) {
        super(startX, startY, 1, 0);
        this.targetX = targetX;
        this.targetY = targetY;
        this.life = 0.2; // Seconds
        this.maxLife = 0.2;
    }

    update(deltaTime) {
        this.life -= deltaTime / 1000;
        if (this.life <= 0) this.markedForDeletion = true;
    }

    draw(ctx) {
        ctx.save();
        const alpha = this.life / this.maxLife;
        ctx.globalAlpha = alpha * 0.5;
        
        // Draw trace line
        ctx.beginPath();
        ctx.moveTo(this.x, this.y); // Start often at bottom center
        ctx.lineTo(this.targetX, this.targetY);
        
        // Gradient trace
        const grad = ctx.createLinearGradient(this.x, this.y, this.targetX, this.targetY);
        grad.addColorStop(0, 'rgba(255, 255, 0, 0)');
        grad.addColorStop(0.5, 'rgba(255, 100, 0, 0.5)');
        grad.addColorStop(1, 'rgba(255, 255, 255, 0.8)');
        
        ctx.strokeStyle = grad;
        ctx.lineWidth = 3;
        ctx.stroke();
        
        ctx.restore();
    }
}

export class GoldenClock extends GameObject {
    constructor(canvasWidth, canvasHeight) {
        super(-50, Math.random() * (canvasHeight / 2), 25, 300); // Fast horizontal
        this.points = 0; // Handled specially
        this.isBonus = true;
        this.bonusType = 'time';
    }
    
    update(deltaTime) {
        this.x += this.speed * (deltaTime / 1000);
        if (this.x > 2000) this.markedForDeletion = true; // Use wide bound
        
        this.wingAngle = Math.sin(Date.now() / 50) * 0.5;
    }
    
    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        
        // Wings
        ctx.fillStyle = '#FFF';
        ctx.strokeStyle = '#DAA520';
        
        // Left Wing
        ctx.save();
        ctx.rotate(this.wingAngle);
        ctx.beginPath();
        ctx.moveTo(-15, 0);
        ctx.quadraticCurveTo(-30, -20, -10, -10);
        ctx.fill(); ctx.stroke();
        ctx.restore();

        // Right Wing
        ctx.save();
        ctx.scale(-1, 1);
        ctx.rotate(this.wingAngle);
        ctx.beginPath();
        ctx.moveTo(-15, 0);
        ctx.quadraticCurveTo(-30, -20, -10, -10);
        ctx.fill(); ctx.stroke();
        ctx.restore();

        // Clock Body
        ctx.beginPath();
        ctx.arc(0, 0, 15, 0, Math.PI * 2);
        ctx.fillStyle = 'gold';
        ctx.fill();
        ctx.stroke();
        
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.arc(0, 0, 10, 0, Math.PI * 2);
        ctx.fill();
        
        // Hands
        ctx.strokeStyle = 'black';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, -8);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(5, 2);
        ctx.stroke();
        
        ctx.restore();
    }
}

export class Mouse extends GameObject {
    constructor(canvasWidth, canvasHeight) {
        const y = canvasHeight - 20; 
        super(-30, y, 15, 150);
        this.points = -20;
        this.color = 'gray';
        this.canvasWidth = canvasWidth;
        this.legAngle = 0;
    }
    
    update(deltaTime) {
        this.x += this.speed * (deltaTime / 1000);
        this.legAngle += 15 * (deltaTime / 1000);
        if (this.x > this.canvasWidth + 50) this.markedForDeletion = true;
    }
    
    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        
        // Body
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, 20, 10, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Head
        ctx.beginPath();
        ctx.arc(20, 0, 8, 0, Math.PI * 2);
        ctx.fill();
        
        // Ears
        ctx.fillStyle = 'pink';
        ctx.beginPath();
        ctx.arc(15, -8, 5, 0, Math.PI*2);
        ctx.arc(25, -8, 5, 0, Math.PI*2);
        ctx.fill();
        
        // Tail
        ctx.strokeStyle = 'pink';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-20, 0);
        ctx.quadraticCurveTo(-30, -5, -40, 0);
        ctx.stroke();
        
        // Legs (moving)
        ctx.fillStyle = 'gray';
        const legOffset = Math.sin(this.legAngle) * 5;
        ctx.fillRect(-10 + legOffset, 8, 4, 6);
        ctx.fillRect(10 - legOffset, 8, 4, 6);
        
        ctx.restore();
    }
}

export class Hedgehog extends GameObject {
    constructor(canvasWidth, canvasHeight) {
        const y = canvasHeight - 15;
        super(canvasWidth + 30, y, 15, 80); // Slower, comes from right
        this.points = -30;
        this.color = '#8B4513'; // SaddleBrown
        this.walkCycle = 0;
    }
    
    update(deltaTime) {
        this.x -= this.speed * (deltaTime / 1000); // Move left
        this.walkCycle += deltaTime / 100;
        if (this.x < -50) this.markedForDeletion = true;
    }
    
    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.scale(-1, 1); // Face left
        
        // Body (Oval)
        ctx.fillStyle = '#654321';
        ctx.beginPath();
        ctx.ellipse(0, 0, 20, 14, 0, 0, Math.PI * 2);
        ctx.fill();

        // Spikes (Thicker, more numerous)
        ctx.fillStyle = '#4A3728';
        for(let i = 0; i < 9; i++) {
            const angle = (i / 8) * Math.PI - Math.PI; // Fan over top
            const sx = Math.cos(angle) * 15;
            const sy = Math.sin(angle) * 12;
            
            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.lineTo(sx + Math.cos(angle)*15, sy + Math.sin(angle)*15);
            ctx.lineTo(sx + 5, sy);
            ctx.fill();
        }

        // Face (Pointy Snout)
        ctx.fillStyle = '#D2B48C'; // Tan skin
        ctx.beginPath();
        ctx.moveTo(10, -5);
        ctx.quadraticCurveTo(25, 0, 28, 5); // Snout tip
        ctx.quadraticCurveTo(25, 10, 10, 8);
        ctx.fill();
        
        // Nose
        ctx.fillStyle = 'black';
        ctx.beginPath();
        ctx.arc(28, 5, 2.5, 0, Math.PI*2);
        ctx.fill();

        // Eye
        ctx.fillStyle = 'black';
        ctx.beginPath();
        ctx.arc(20, 0, 2, 0, Math.PI*2);
        ctx.fill();

        // Little Legs (Walking)
        ctx.fillStyle = '#654321';
        const offset = Math.sin(this.walkCycle) * 3;
        ctx.fillRect(-5 + offset, 12, 4, 5);
        ctx.fillRect(10 - offset, 12, 4, 5);

        ctx.restore();
    }
}

export class Gopher extends GameObject {
    constructor(canvasWidth, canvasHeight) {
        const x = Math.random() * (canvasWidth - 100) + 50;
        const y = canvasHeight; // Start at bottom edge
        super(x, y, 20, 50);
        this.points = -25;
        this.state = 'rising'; // rising, waiting, hiding
        this.timer = 0;
        this.targetY = canvasHeight - 40;
        this.startY = canvasHeight;
    }
    
    update(deltaTime) {
        if (this.state === 'rising') {
            if (this.y > this.targetY) this.y -= this.speed * (deltaTime / 1000);
            else {
                this.state = 'waiting';
                this.timer = 1.5; // Wait 1.5s
            }
        } else if (this.state === 'waiting') {
            this.timer -= deltaTime / 1000;
            if (this.timer <= 0) this.state = 'hiding';
        } else if (this.state === 'hiding') {
            if (this.y < this.startY) {
                this.y += this.speed * (deltaTime / 1000);
            } else {
                this.markedForDeletion = true;
            }
        }
    }
    
    draw(ctx) {
        ctx.save();
        
        // Hole (draw behind)
        ctx.fillStyle = '#2F4F4F';
        ctx.beginPath();
        ctx.ellipse(this.x, this.startY - 5, 25, 8, 0, 0, Math.PI*2);
        ctx.fill();
        
        ctx.translate(this.x, this.y);
        
        // Body
        ctx.fillStyle = '#CD853F'; // Peru
        ctx.beginPath();
        // Rounded rect top
        ctx.roundRect(-15, -30, 30, 60, [15, 15, 0, 0]); 
        ctx.fill();
        
        // Teeth
        ctx.fillStyle = 'white';
        ctx.fillRect(-5, -5, 4, 6);
        ctx.fillRect(1, -5, 4, 6);
        
        // Eyes
        ctx.fillStyle = 'black';
        ctx.beginPath();
        ctx.arc(-7, -15, 2, 0, Math.PI*2);
        ctx.arc(7, -15, 2, 0, Math.PI*2);
        ctx.fill();

        ctx.restore();
    }
}


export class BirthdayCap extends GameObject {
    constructor(canvasWidth, canvasHeight) {
        super(Math.random() * (canvasWidth - 50) + 25, -50, 25, 100);
        this.isBonus = true;
        this.bonusType = 'party';
        this.sway = 0;
    }

    update(deltaTime) {
        this.y += this.speed * (deltaTime / 1000);
        this.sway += deltaTime / 1000;
        this.x += Math.sin(this.sway * 3) * 1.5; // Sway
        if (this.y > 1000) this.markedForDeletion = true;
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(Math.sin(this.sway * 3) * 0.2);
        
        // Cone
        ctx.fillStyle = '#FF69B4'; // HotPink
        ctx.beginPath();
        ctx.moveTo(-20, 20);
        ctx.lineTo(20, 20);
        ctx.lineTo(0, -30);
        ctx.fill();
        
        // Dots
        ctx.fillStyle = 'yellow';
        ctx.beginPath();
        ctx.arc(0, -5, 3, 0, Math.PI*2);
        ctx.arc(-8, 10, 3, 0, Math.PI*2);
        ctx.arc(8, 10, 3, 0, Math.PI*2);
        ctx.fill();
        
        // Pom pom
        ctx.fillStyle = 'cyan';
        ctx.beginPath();
        ctx.arc(0, -30, 6, 0, Math.PI*2);
        ctx.fill();

        ctx.restore();
    }
}

export class Bomb extends GameObject {
    constructor(canvasWidth, canvasHeight) {
        // Random falling object
        super(Math.random() * (canvasWidth - 50) + 25, -50, 25, 60);
        this.timer = 15.0; // Increased to 15 seconds
        this.isBonus = true; // Treated as bonus for click handling logic mostly
        this.bonusType = 'bomb';
    }

    update(deltaTime) {
        this.y += this.speed * (deltaTime / 1000);
        this.timer -= deltaTime / 1000;
        
        if (this.y > 1000) {
            this.markedForDeletion = true;
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        
        // Bomb Body
        ctx.fillStyle = 'black';
        ctx.beginPath();
        ctx.arc(0, 5, 20, 0, Math.PI*2);
        ctx.fill();
        
        // Shine
        ctx.fillStyle = '#333';
        ctx.beginPath();
        ctx.arc(-8, -2, 5, 0, Math.PI*2);
        ctx.fill();
        
        // Fuse mechanism
        ctx.fillStyle = '#555';
        ctx.fillRect(-5, -20, 10, 10);
        
        // Fuse Rope
        ctx.strokeStyle = '#ADA96E'; // Khaki
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, -20);
        ctx.quadraticCurveTo(5, -30, 10, -25);
        ctx.stroke();
        
        // Spark (flickering)
        if (this.timer > 0) {
            ctx.fillStyle = (Date.now() % 200 < 100) ? 'orange' : 'yellow';
            ctx.beginPath();
            ctx.arc(10, -25, (Date.now() % 100 < 50) ? 4 : 2, 0, Math.PI*2);
            ctx.fill();
        }
        
        // Timer Text
        ctx.fillStyle = 'red';
        ctx.font = 'bold 12px Arial';
        ctx.fillText(Math.ceil(this.timer), -4, 10);

        ctx.restore();
    }
}

export class AmmoDrop extends GameObject {
    constructor(canvasWidth, canvasHeight) {
        super(Math.random() * (canvasWidth - 60) + 30, -50, 25, 80);
        this.points = 0;
        this.isBonus = true;
        this.bonusType = 'ammo';
        this.sway = 0;
    }
    
    update(deltaTime) {
        this.y += this.speed * (deltaTime / 1000);
        this.sway += deltaTime / 1000;
        this.x += Math.sin(this.sway * 2) * 0.5; // Slight sway
        
        if (this.y > 1000) this.markedForDeletion = true;
    }
    
    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        
        // Parachute Strings
        ctx.strokeStyle = 'white';
        ctx.beginPath();
        ctx.moveTo(0, -30);
        ctx.lineTo(-15, -10);
        ctx.moveTo(0, -30);
        ctx.lineTo(15, -10);
        ctx.stroke();
        
        // Parachute Canopy
        ctx.fillStyle = '#EEE';
        ctx.beginPath();
        ctx.arc(0, -35, 20, Math.PI, 0); // Half circle up
        ctx.fill();
        
        // Crate
        // Color/Icon depends on type
        // Wait, standard AmmoDrop is for machine gun usually.
        // User asked for 'magazine' (normal bullets) and 'shotgun' object.
        // I should reuse/parameterize or make new classes.
        // Let's modify this class to be generic or create new ones.
        // Since I can't easily refactor usage in Game.js without edits, 
        // I will keep AmmoDrop as "Machine Gun" and create subtypes or new classes.
        // Actually, let's just make new classes for clarity.
        
        ctx.fillStyle = '#556B2F'; // Olive Drab (Military)
        ctx.fillRect(-15, -10, 30, 25);
        
        // Icon
        ctx.fillStyle = 'gold';
        ctx.font = '20px Arial';
        ctx.fillText('∞', -7, 10);
        
        ctx.restore();
    }
}

export class MagazineDrop extends GameObject {
    constructor(canvasWidth, canvasHeight) {
        super(Math.random() * (canvasWidth - 60) + 30, -50, 15, 90);
        this.isBonus = true;
        this.bonusType = 'bullets';
    }
    
    update(deltaTime) {
        this.y += this.speed * (deltaTime / 1000);
        if (this.y > 1000) this.markedForDeletion = true;
    }
    
    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        
        // Vertically stretched black object (Magazine)
        ctx.fillStyle = '#111'; // Black
        ctx.fillRect(-10, -20, 20, 40);
        
        // Ribs / Texture
        ctx.fillStyle = '#333';
        for(let i=0; i<3; i++) {
             ctx.fillRect(-10, -10 + i*10, 20, 2);
        }
        
        // Bullets visible at top
        ctx.fillStyle = '#DAA520'; // Gold
        ctx.beginPath();
        ctx.arc(-5, -20, 4, 0, Math.PI, true);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(5, -20, 4, 0, Math.PI, true);
        ctx.fill();
        
        // Border
        ctx.strokeStyle = '#555';
        ctx.strokeRect(-10, -20, 20, 40);

        ctx.restore();
    }
}

export class ShotgunDrop extends GameObject {
    constructor(canvasWidth, canvasHeight) {
        super(Math.random() * (canvasWidth - 60) + 30, -50, 20, 90);
        this.isBonus = true;
        this.bonusType = 'shells';
    }
    
    update(deltaTime) {
        this.y += this.speed * (deltaTime / 1000);
        if (this.y > 1000) this.markedForDeletion = true;
    }
    
    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        
        // Draw Shotgun Shape
        ctx.fillStyle = '#444'; // Gunmetal
        ctx.strokeStyle = '#111';
        
        // Stock (Brown Wood)
        ctx.fillStyle = '#8B4513';
        ctx.beginPath();
        ctx.moveTo(-20, 5);
        ctx.lineTo(-30, 10);
        ctx.lineTo(-30, -5);
        ctx.lineTo(-20, 0);
        ctx.fill();
        
        // Barrel (Long Grey)
        ctx.fillStyle = '#555';
        ctx.fillRect(-20, -2, 50, 4); // Top barrel
        ctx.fillStyle = '#444'; 
        ctx.fillRect(-20, 2, 45, 4); // Bottom tube
        
        // Pump Handle (Brown/Black)
        ctx.fillStyle = '#222';
        ctx.fillRect(-10, 3, 15, 5);
        
        // Trigger area
        ctx.fillStyle = '#111';
        ctx.fillRect(-20, 2, 8, 6);
        
        ctx.restore();
    }
}

export class Bird extends GameObject {
    constructor(canvasWidth, canvasHeight, speedMultiplier = 1) {
        // Random size: bigger birds are easier to hit so they should have higher penalty
        const scale = Math.random() * 0.8 + 0.5; // 0.5 to 1.3
        const radius = 25 * scale;
        
        const startLeft = Math.random() > 0.5;
        const x = startLeft ? -radius : canvasWidth + radius;
        const y = Math.random() * (canvasHeight / 2); // Only in top half
        const speed = (Math.random() * 150 + 100) * speedMultiplier;

        super(x, y, radius, speed);
        
        this.scale = scale;
        this.direction = startLeft ? 1 : -1;
        
        // Points Penalty: Bigger bird (easier) = More penalty
        // Small bird (harder) = Less penalty
        // Base penalty is -20. Max size ~ -40.
        this.points = -Math.floor(20 * (scale * 1.5)); 
        
        this.color = '#333';
        this.canvasWidth = canvasWidth;
        this.flapAngle = 0;
    }

    update(deltaTime) {
        this.x += this.speed * this.direction * (deltaTime / 1000);

        // Bounce vertical
        this.y += Math.sin(this.x / 50) * 2;
        
        // Flap wings
        this.flapAngle += 10 * (deltaTime / 1000);

        if ((this.direction === 1 && this.x > this.canvasWidth + this.radius) ||
            (this.direction === -1 && this.x < -this.radius)) {
            this.markedForDeletion = true;
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.scale(this.direction * this.scale, this.scale); // Flip if moving left, and apply random size

        // Bird Body (Ellipse)
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, 20, 12, 0, 0, Math.PI * 2); 
        ctx.fill();
        
        // Head
        ctx.beginPath();
        ctx.arc(12, -8, 10, 0, Math.PI * 2);
        ctx.fill();

        // Eye
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.arc(14, -10, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'black';
        ctx.beginPath();
        ctx.arc(15, -10, 1, 0, Math.PI * 2);
        ctx.fill();

        // Beak
        ctx.fillStyle = 'orange';
        ctx.beginPath();
        ctx.moveTo(18, -6);
        ctx.lineTo(26, -3);
        ctx.lineTo(18, 0);
        ctx.fill();

        // Wing (Animated)
        ctx.fillStyle = '#555';
        ctx.beginPath();
        const wingY = Math.sin(this.flapAngle) * 10;
        ctx.moveTo(-5, -5);
        ctx.lineTo(10, -15 + wingY); // Flap tip
        ctx.lineTo(5, 5);
        ctx.fill();

        ctx.restore();
    }
}

export class Dragon extends GameObject {
    constructor(canvasWidth, canvasHeight) {
        // Dragon appears rarely and moves horizontally with a slight wave
        const radius = 50; 
        const y = Math.random() * (canvasHeight / 3); // Top third only
        // Start from random side
        const startLeft = Math.random() > 0.5;
        const x = startLeft ? -radius * 2 : canvasWidth + radius * 2;
        const speed = 250; // Fast

        super(x, y, radius, speed);
        
        this.direction = startLeft ? 1 : -1;
        this.points = -100; // Huge penalty
        this.color = '#8B0000'; // Dark Red
        this.canvasWidth = canvasWidth;
        this.time = 0;
    }

    update(deltaTime) {
        this.time += deltaTime / 1000;
        this.x += this.speed * this.direction * (deltaTime / 1000);
        
        // Sine wave movement
        this.y += Math.sin(this.time * 5) * 2;

        if ((this.direction === 1 && this.x > this.canvasWidth + this.radius * 2) ||
            (this.direction === -1 && this.x < -this.radius * 2)) {
            this.markedForDeletion = true;
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.scale(this.direction, 1);

        // Dragon Body - Winding Serpent Style
        ctx.fillStyle = this.color;
        
        // Main Body Curves
        ctx.beginPath();
        // Head is at +50, Tail at -50
        
        // Draw segment by segment sinewave
        for (let i = -50; i <= 50; i+= 5) {
             const offset = Math.sin((this.time * 5) + (i / 20)) * 10;
             const r = 15 - Math.abs(i) / 5; // Taper ends
             
             ctx.beginPath();
             ctx.arc(i, offset, Math.max(2, r), 0, Math.PI * 2);
             ctx.fill();
        }

        // Head
        const headOffset = Math.sin((this.time * 5) + (50 / 20)) * 10;
        ctx.translate(55, headOffset);
        
        // Snout
        ctx.beginPath();
        ctx.fillStyle = '#8B0000';
        ctx.ellipse(0, 0, 20, 12, 0, 0, Math.PI * 2); 
        ctx.fill();
        
        // Horns
        ctx.strokeStyle = '#DAA520'; // Goldenrod
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-5, -5);
        ctx.lineTo(-15, -20);
        ctx.stroke();
        
        // Eye
        ctx.fillStyle = '#39FF14'; // Neon Green
        ctx.beginPath();
        ctx.arc(5, -5, 3, 0, Math.PI * 2);
        ctx.fill();
        
        // Fire Breath (Particles could go here, but simple triangle for now)
        ctx.fillStyle = 'rgba(255, 69, 0, 0.6)';
        ctx.beginPath();
        ctx.moveTo(20, 0);
        ctx.lineTo(40 + Math.random() * 10, -10);
        ctx.lineTo(40 + Math.random() * 10, 10);
        ctx.fill();

        ctx.restore();
    }
}

export class Godzilla extends GameObject {
    constructor(canvasWidth, canvasHeight) {
        // Sizes: 1=Small, 2=Medium, 3=Large
        const sizeType = Math.floor(Math.random() * 3) + 1;
        
        // Scale factors: Small ~30% height, Medium ~40%, Large ~50%
        let scaleRef = 0.3;
        let hp = 10;
        let pKill = 25;
        
        if (sizeType === 2) { scaleRef = 0.4; hp = 18; pKill = 50; }
        if (sizeType === 3) { scaleRef = 0.5; hp = 25; pKill = 75; }
        
        const h = canvasHeight * scaleRef;
        const w = h * 0.6; // Aspect ratio
        
        const startLeft = Math.random() > 0.5;
        const x = startLeft ? -w : canvasWidth + w;
        
        // Position at bottom
        const y = canvasHeight;
        const speed = 60 - (sizeType * 5); // Larger = Slower (55, 50, 45)

        super(x, y, w/2, speed); // Radius approximation
        
        this.canvasWidth = canvasWidth;
        this.width = w;
        this.height = h;
        this.hp = hp;
        this.maxHp = hp;
        this.killPoints = pKill;
        this.direction = startLeft ? 1 : -1;
        this.sizeType = sizeType;
        
        // Animation
        this.walkCycle = 0;
        this.roarTime = 0;
        this.wantsToRoar = false; // Flag for Game.js to play sound
    }

    update(deltaTime) {
        this.x += this.speed * this.direction * (deltaTime / 1000);
        this.walkCycle += deltaTime / 200;
        this.roarTime += deltaTime / 1000;
        
        // Random ambient roar every 5-10 seconds
        if (Math.random() < 0.005 && this.roarTime > 2.0) {
            this.wantsToRoar = true;
            this.roarTime = 0;
        }

        if ((this.direction === 1 && this.x > this.canvasWidth + this.width) ||
            (this.direction === -1 && this.x < -this.width)) {
            this.markedForDeletion = true;
        }
    }
    
    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y); // Center Bottom
        ctx.scale(this.direction, 1);
        
        // Colors
        const skinBase = '#2F4F4F'; // Dark Slate Gray (darker, more realistic skin)
        const skinHighlight = '#556B2F'; // Olive Drab
        const spikeColor = '#8B4513'; // Saddle Brown

        // Tail (Thick and sinuous)
        ctx.fillStyle = skinBase;
        ctx.beginPath();
        ctx.moveTo(-this.width*0.3, 0);
        // Curve tail out and back
        ctx.bezierCurveTo(-this.width*0.8, -this.height*0.2, -this.width*1.2, 0, -this.width*0.5, -this.height*0.3);
        ctx.lineTo(-this.width*0.3, -this.height*0.6); // Connect to hip
        ctx.fill();

        // Main Body (Hunched posture)
        ctx.beginPath();
        ctx.moveTo(-this.width*0.4, 0); // Foot back
        ctx.quadraticCurveTo(-this.width*0.5, -this.height*0.5, -this.width*0.2, -this.height*0.95); // Hump back
        ctx.lineTo(this.width*0.2, -this.height*0.6); // Chest top
        ctx.quadraticCurveTo(this.width*0.4, -this.height*0.4, this.width*0.3, 0); // Belly to foot front
        ctx.fill();
        
        // Texture (Scales) - simple noise
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        for(let i=0; i<10; i++) {
             ctx.beginPath();
             ctx.arc((Math.random()-0.5)*this.width*0.5, -Math.random()*this.height*0.8, 2, 0, Math.PI*2);
             ctx.fill();
        }

        // Spikes on back (Detailed jagged)
        ctx.fillStyle = spikeColor;
        for(let i=0; i<6; i++) {
             ctx.beginPath();
             // Follow the curve of the back roughly
             const t = i / 5;
             const sx = -this.width * 0.45 + (t * this.width * 0.3); 
             const sy = -this.height * (0.4 + t * 0.5);
             
             ctx.moveTo(sx, sy);
             ctx.lineTo(sx - 5, sy - 20 - (Math.random()*10)); // Variable spike height
             ctx.lineTo(sx + 10, sy + 5);
             ctx.fill();
        }
        
        // Head (More defined jaw)
        ctx.fillStyle = skinBase;
        ctx.beginPath();
        const headX = -this.width*0.1;
        const headY = -this.height*0.9;
        ctx.moveTo(headX, headY); 
        ctx.lineTo(headX + this.width*0.3, headY + 10); // Upper jaw
        ctx.lineTo(headX + this.width*0.25, headY + 25); // Lower jaw / Chin
        ctx.lineTo(headX - 10, headY + 20); // Neck connection
        ctx.fill();

        // Eye (Small, fierce)
        ctx.fillStyle = '#FFD700'; // Gold eye
        ctx.beginPath();
        ctx.arc(headX + this.width*0.1, headY + 10, 3, 0, Math.PI*2);
        ctx.fill();
        ctx.fillStyle = 'black'; // Pupil
        ctx.fillRect(headX + this.width*0.1, headY + 8, 1, 4);

        // Legs (Muscular)
        ctx.fillStyle = skinHighlight;
        // Back leg
        ctx.beginPath();
        ctx.ellipse(-this.width*0.25, -this.height*0.2, this.width*0.12, this.height*0.25, -0.2, 0, Math.PI*2);
        ctx.fill();
        // Front arm (Small T-Rex style)
        ctx.beginPath();
        ctx.ellipse(this.width*0.15, -this.height*0.55, this.width*0.05, this.width*0.15, 0.5, 0, Math.PI*2);
        ctx.fill();


        ctx.restore();
        
        // Draw Lifebar separately to avoid flip issues (Use absolute coords relative to x,y)
        const barW = this.width;
        const barH = 10;
        const barY = this.y - this.height - 20;
        const barX = this.x - barW/2;
        
        ctx.save();
        ctx.globalAlpha = 0.6; // Translucent Requirement
        
        // BG
        ctx.fillStyle = 'black';
        ctx.fillRect(barX, barY, barW, barH);
        
        // FG
        const pct = Math.max(0, this.hp / this.maxHp);
        ctx.fillStyle = pct > 0.5 ? 'lime' : (pct > 0.25 ? 'orange' : 'red');
        ctx.fillRect(barX + 1, barY + 1, (barW - 2) * pct, barH - 2);
        
        ctx.restore();
    }
}
