import { Game } from './game.js';

// DOM Elements
const canvas = document.getElementById('game-canvas');
const loginScreen = document.getElementById('login-screen');
const gameUI = document.getElementById('game-ui');
const messageScreen = document.getElementById('message-screen');

let currentPlayerName = "";
let currentPlayerSessionId = "";
let game = null;
let latestLeaderboard = [];

// Adjust Canvas Size to Full Screen
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// API / Networking Handlers (Replaces Socket.io)

async function fetchLeaderboard() {
    try {
        const res = await fetch('/api/leaderboard');
        const data = await res.json();
        latestLeaderboard = data;
        updateLeaderboardUI(data);
    } catch (err) {
        console.error("Failed to fetch leaderboard", err);
    }
}

async function submitScore(name, score) {
    if (!currentPlayerSessionId) return; // Should not happen if game started correctly
    try {
        await fetch('/api/score', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, score, sessionId: currentPlayerSessionId })
        });
        // Refresh leaderboard after submission
        fetchLeaderboard();
    } catch (err) {
        console.error("Failed to submit score", err);
    }
}

// Initial Fetch
fetchLeaderboard();
setInterval(fetchLeaderboard, 10000); // Poll every 10 seconds

function updateLeaderboardUI(leaderboard) {
    const hudList = document.getElementById('leaderboard-list');
    if (hudList) {
        hudList.innerHTML = '';
        // Display no more than 10 results
        leaderboard.slice(0, 10).forEach(player => {
            const li = document.createElement('li');
            li.innerHTML = `<span>${player.name}</span> <span>${player.score}</span>`;
            hudList.appendChild(li);
        });
    }
    
    // Hide 'Online' counter or just set to 1 since we are single player connected
    const onlineEl = document.getElementById('online-count');
    if (onlineEl) onlineEl.style.display = 'none';
}

const calculatePercentile = (myScore) => {
    if (latestLeaderboard.length === 0) return 0;
    
    // Percentile logic
    const total = latestLeaderboard.length;
    if (total === 0) return 100;
    
    const below = latestLeaderboard.filter(p => p.score < myScore).length;
    return Math.floor((below / total) * 100);
};

const onUIUpdate = (data) => {
    const scoreElement = document.getElementById('score');
    scoreElement.innerText = `${data.roundScore} / ${data.target}`;
    
    if (data.roundScore >= data.target) {
        scoreElement.style.color = '#2ecc71'; 
    } else {
        scoreElement.style.color = '#ff7675'; 
    }

    document.getElementById('level').innerText = data.level;
    document.getElementById('timer').innerText = data.time;
    
    document.getElementById('bullet-count').innerText = data.bullets;
    document.getElementById('shell-count').innerText = data.shells;

    const timerElement = document.getElementById('timer');
    if (data.time <= 5) timerElement.style.color = 'red';
    else timerElement.style.color = 'white';
    
    if (data.machineGunActive) {
        canvas.classList.add('machine-gun-active');
    } else {
        canvas.classList.remove('machine-gun-active');
    }
};

const onLevelComplete = (score, level) => {
    // Autosave on level complete
    submitScore(currentPlayerName, score);

    const p = calculatePercentile(score);
    showMessage("Level Complete!", `Great Job! Score: ${score}\nYou're better than ${p}% of top players!`, true);
};

const onGameOver = (score) => {
    // Save final score
    submitScore(currentPlayerName, score);
    
    const p = calculatePercentile(score);
    showMessage("Game Over", `Final Score: ${score}\nYou're better than ${p}% of top players!`, false);
};

// Start Game Flow
document.getElementById('start-btn').addEventListener('click', () => {
    const nameInput = document.getElementById('username');
    if (nameInput.value.trim() === "") {
        alert("Please enter a name!");
        return;
    }
    
    currentPlayerName = nameInput.value;
    // Generate new Session ID for this run
    currentPlayerSessionId = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(); 
    
    loginScreen.classList.add('hidden');
    gameUI.classList.remove('hidden');
    
    document.getElementById('leaderboard-container').classList.remove('solid-mode');
    
    startGame(1);
});

function startGame(level) {
    if (!game) {
        // Constructor signature updated: No socket
        game = new Game(canvas, onUIUpdate, onLevelComplete, onGameOver);
    }
    
    // Cycle backgrounds 1-5
    const bgLevel = ((level - 1) % 5) + 1;
    canvas.className = `level-${bgLevel}`;
    game.startLevel(level);
}

// Input Handling
const getMousePos = (e) => {
    const rect = canvas.getBoundingClientRect();
    return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
    };
};

// Touch Support (Tablet/Mobile Fix)
canvas.style.touchAction = 'none'; // Prevent browser defaults (zoom/scroll)

canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (!game) return;
    
    // Two-finger tap = Shotgun (Secondary Fire)
    if (e.touches.length === 2 && game.shells > 0) {
         const rect = canvas.getBoundingClientRect();
         // Average position of two fingers
         const t1 = e.touches[0];
         const t2 = e.touches[1];
         const x = ((t1.clientX + t2.clientX) / 2) - rect.left;
         const y = ((t1.clientY + t2.clientY) / 2) - rect.top;
         
         game.handleRightClick(x, y);
         return;
    }
    
    // Single touch = Shoot / Machine Gun Start
    if (e.touches.length === 1) {
        const rect = canvas.getBoundingClientRect();
        const touch = e.touches[0];
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;
        
        game.setMouseState(true, x, y);
        game.handleClick(x, y);
    }
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (!game) return;
    if (e.touches.length > 0) {
        const rect = canvas.getBoundingClientRect();
        const touch = e.touches[0];
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;
        
        game.setMouseState(true, x, y); // For Machine Gun tracking
    }
}, { passive: false });

canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    if (!game) return;
    if (e.touches.length === 0) {
        game.setMouseState(false, 0, 0);
    }
}, { passive: false });

canvas.addEventListener('mousedown', (e) => {
    if (!game) return;
    const { x, y } = getMousePos(e);

    if (e.button === 0) { // Left Click
        game.setMouseState(true, x, y);
        game.handleClick(x, y);
    } 
});

canvas.addEventListener('mouseup', (e) => {
    if (!game) return;
    if (e.button === 0) { // Left Click Release
        const { x, y } = getMousePos(e);
        game.setMouseState(false, x, y);
    }
});

canvas.addEventListener('mousemove', (e) => {
    if (!game) return;
    const { x, y } = getMousePos(e);
    const isDown = (e.buttons & 1) === 1;
    game.setMouseState(isDown, x, y);
});

canvas.addEventListener('mouseleave', () => {
    if (game) game.setMouseState(false, 0, 0);
});

canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault(); 
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    if (game) {
        game.handleRightClick(x, y);
    }
});

// UI Logic
function showMessage(title, text, isWin) {
    gameUI.classList.add('hidden');
    messageScreen.classList.remove('hidden');
    
    document.getElementById('message-title').innerText = title;
    document.getElementById('message-text').innerText = text;
    
    const nextBtn = document.getElementById('next-level-btn');
    const exitBtn = document.getElementById('exit-btn');
    
    exitBtn.classList.remove('hidden');
    exitBtn.onclick = () => {
        messageScreen.classList.add('hidden');
        loginScreen.classList.remove('hidden');
        
        currentPlayerName = "";
        game = null;
        
        document.getElementById('leaderboard-container').classList.add('solid-mode');
    };

    if (isWin) {
        nextBtn.classList.remove('hidden');
        nextBtn.onclick = () => {
            messageScreen.classList.add('hidden');
            gameUI.classList.remove('hidden');
            startGame(game.level + 1);
        };
    } else {
        nextBtn.classList.add('hidden');
    }
}

document.getElementById('restart-btn').addEventListener('click', () => {
    messageScreen.classList.add('hidden');
    gameUI.classList.remove('hidden');
    
    if (game) {
        game.retryLevel();
    } else {
        game = new Game(canvas, onUIUpdate, onLevelComplete, onGameOver);
        startGame(1);
    }
});

// Reset Leaderboard initial state
document.getElementById('leaderboard-container').classList.add('solid-mode');

