import { Game } from './game.js';

// DOM Elements
const canvas = document.getElementById('game-canvas');
const loginScreen = document.getElementById('login-screen');
const gameUI = document.getElementById('game-ui');
const messageScreen = document.getElementById('message-screen');

// Initialize Socket.io
const socket = io();

let currentPlayerName = "";
let game = null;

// Adjust Canvas Size to Full Screen
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Global state to store latest leaderboard for calculations
let latestLeaderboard = [];

const calculatePercentile = (myScore) => {
    if (latestLeaderboard.length === 0) return 0;
    
    // Sort just in case current local state is out of sync (though server sends sorted)
    // Server seems to send sorted desc? Let's assume so or sort it here.
    // Actually, we don't know other players' current live scores, only the "Top Players" list.
    // If the list is all-time, we compare against that.
    
    // Count how many scores I beat
    const lowerScores = latestLeaderboard.filter(p => p.score < myScore).length;
    // But list might be truncated? If server sends full list, great. 
    // Assuming server sends top X only? 
    // Let's assume the leaderboard array sent to client is the "Top Players". 
    // If I'm not in the top list, I can't really know exact percentile, 
    // but we can fake it or estimate.
    // Let's use the provided list.
    
    const total = latestLeaderboard.length;
    if (total === 0) return 100;
    
    // Percentile = (Number of people below me / Total) * 100
    // If I am top 1, I am better than everyone else in the list (excluding myself)
    const below = latestLeaderboard.filter(p => p.score < myScore).length;
    const p = Math.floor((below / total) * 100);
    
    // If the list is only top 10, and I have 50 points and top has 1000, 
    // this logic is flawed because it ignores the hundreds of low scoring players not in the list.
    // But given the constraints, let's just compare to the visible leaderboard.
    return p;
};

const onUIUpdate = (data) => {
    // Score Format: "Round Points / Round Target"
    // Color Logic: Red if < Target, Green if >= Target
    const scoreElement = document.getElementById('score');
    scoreElement.innerText = `${data.roundScore} / ${data.target}`;
    
    if (data.roundScore >= data.target) {
        scoreElement.style.color = '#2ecc71'; // Light Green
    } else {
        scoreElement.style.color = '#ff7675'; // Light Red
    }

    document.getElementById('level').innerText = data.level;
    document.getElementById('timer').innerText = data.time;
    
    // Bottom Right Ammo Display
    document.getElementById('bullet-count').innerText = data.bullets;
    document.getElementById('shell-count').innerText = data.shells;

    // Visual feedback for low time
    const timerElement = document.getElementById('timer');
    if (data.time <= 5) timerElement.style.color = 'red';
    else timerElement.style.color = 'white';
    
    // Machine Gun Cursor
    if (data.machineGunActive) {
        canvas.classList.add('machine-gun-active');
    } else {
        canvas.classList.remove('machine-gun-active');
    }
};

const onLevelComplete = (score, level) => {
    const p = calculatePercentile(score);
    showMessage("Level Complete!", `Great Job! Score: ${score}\nYou're better than ${p}% of top players!`, true);
    socket.emit('levelComplete', { score, level });
};

const onGameOver = (score) => {
    // Save final score
    socket.emit('gameOver', { score });
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
    socket.emit('joinGame', currentPlayerName);
    
    loginScreen.classList.add('hidden');
    gameUI.classList.remove('hidden');
    
    // Switch Leaderboard to Game Mode (translucent, top-right)
    document.getElementById('leaderboard-container').classList.remove('solid-mode');
    
    startGame(1);
});

function startGame(level) {
    if (!game) {
        game = new Game(canvas, socket, onUIUpdate, onLevelComplete, onGameOver);
    }
    
    // Set Background Class
    canvas.className = `level-${level}`;
    
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

canvas.addEventListener('mousedown', (e) => {
    if (!game) return;
    const { x, y } = getMousePos(e);

    if (e.button === 0) { // Left Click
        game.setMouseState(true, x, y);
        game.handleClick(x, y);
    } 
    // Right click is handled via 'contextmenu' to prevent popup
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
    // Check if left button is being held down
    const isDown = (e.buttons & 1) === 1;
    game.setMouseState(isDown, x, y);
});

canvas.addEventListener('mouseleave', () => {
    if (game) game.setMouseState(false, 0, 0);
});

canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault(); // Prevent standard menu
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
    
    // Always show exit button
    exitBtn.classList.remove('hidden');
    exitBtn.onclick = () => {
        messageScreen.classList.add('hidden');
        loginScreen.classList.remove('hidden');
        
        // Disconnect or Reset state if needed
        currentPlayerName = "";
        game = null;
        
        // Optional: reload page to force fresh state
        // location.reload(); 
        
        // Reset Leaderboard to Initial Mode
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
    
    // Retry Logic from User Request #4
    if (game) {
        game.retryLevel();
    } else {
        // Fallback if game is null (shouldn't happen here normally)
        game = new Game(canvas, socket, onUIUpdate, onLevelComplete, onGameOver);
        startGame(1);
    }
});

// Socket Events (Multiplayer Updates)
socket.on('updateLeaderboard', (leaderboard) => {
    latestLeaderboard = leaderboard; // Store for percentile calc
    
    // Top Right HUD Leaderboard (Always present now)
    const hudList = document.getElementById('leaderboard-list');
    if (hudList) {
        hudList.innerHTML = '';
        // Display no more than 10 results/players (Requirement 1)
        leaderboard.slice(0, 10).forEach(player => {
            const li = document.createElement('li');
            li.innerHTML = `<span>${player.name}</span> <span>${player.score}</span>`;
            hudList.appendChild(li);
        });
    }

    // Initialize state if first load (check if we are on login screen)
    if (!loginScreen.classList.contains('hidden')) {
        document.getElementById('leaderboard-container').classList.add('solid-mode');
    }
});

socket.on('playerCountUpdate', (count) => {
    document.getElementById('online-count').innerText = `Online: ${count}`;
});
