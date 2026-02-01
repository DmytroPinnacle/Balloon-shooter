const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

// Setup Express (similar to WebApplication.CreateBuilder)
const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Middleware to serve static files (like UseStaticFiles())
app.use(express.static(path.join(__dirname, '../public')));

// Handle Favicon 404
app.get('/favicon.ico', (req, res) => res.status(204).end());

// Data Persistence
const DATA_FILE = path.join(__dirname, 'leaderboard.json');

// In-memory state (In a real app, use a DB like create-file/SQL/Mongo)
const gameState = {
    players: {}, // Map of socketId -> { name, score, level }
    leaderboard: [] // Array of top scores
};

// Load leaderboard on startup
function loadLeaderboard() {
    if (fs.existsSync(DATA_FILE)) {
        try {
            const data = fs.readFileSync(DATA_FILE, 'utf8');
            gameState.leaderboard = JSON.parse(data);
        } catch (err) {
            console.error("Error loading leaderboard:", err);
            gameState.leaderboard = [];
        }
    }
}
loadLeaderboard();

// Save leaderboard
function saveLeaderboard() {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(gameState.leaderboard, null, 2));
    } catch (err) {
        console.error("Error saving leaderboard:", err);
    }
}

const LEVELS = {
    1: { minPoints: 50, duration: 30 },
    2: { minPoints: 100, duration: 25 },
    3: { minPoints: 200, duration: 20 }
};

// Socket.io connection handling (Similar to SignalR Hub OnConnectedAsync)
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Initial data transfer
    socket.emit('updateLeaderboard', gameState.leaderboard);

    // Handle 'join' event
    socket.on('joinGame', (playerName) => {
        gameState.players[socket.id] = {
            name: playerName,
            score: 0,
            level: 1
        };
        // Broadcast to everyone that new player joined
        io.emit('playerCountUpdate', Object.keys(gameState.players).length);
    });

    // Handle score updates
    socket.on('updateScore', ({ score, level }) => {
        if (gameState.players[socket.id]) {
            gameState.players[socket.id].score = score;
            gameState.players[socket.id].level = level;
            
            // real-time leaderboard update optional? 
            // For all-time, usually update on game over, but lets check for high score live
            updateLeaderboard(gameState.players[socket.id]);
        }
    });

    // Handle game over or level complete
    socket.on('levelComplete', ({ score, level }) => {
        if (gameState.players[socket.id]) {
            gameState.players[socket.id].score = score;
            updateLeaderboard(gameState.players[socket.id]);
        }
    });
    
    // Explicit game over event to save final score
    socket.on('gameOver', ({ score }) => {
        if (gameState.players[socket.id]) {
            gameState.players[socket.id].score = score;
            updateLeaderboard(gameState.players[socket.id]);
        }
    });

    // Disconnect (Similar to OnDisconnectedAsync)
    socket.on('disconnect', () => {
        delete gameState.players[socket.id];
        io.emit('playerCountUpdate', Object.keys(gameState.players).length);
        console.log('User disconnected:', socket.id);
    });
});

function updateLeaderboard(player) {
    // Check if player is already on leaderboard
    const existingEntry = gameState.leaderboard.find(p => p.name === player.name);
    let shouldSave = false;

    // Only update if score is higher (All-time best logic)
    if (existingEntry) {
        if (player.score > existingEntry.score) {
            existingEntry.score = player.score;
            shouldSave = true;
        }
    } else {
        gameState.leaderboard.push({ name: player.name, score: player.score });
        shouldSave = true;
    }

    if (shouldSave) {
        // Sort Descending
        gameState.leaderboard.sort((a, b) => b.score - a.score);
        
        // Keep top 10
        if (gameState.leaderboard.length > 10) gameState.leaderboard.pop();

        saveLeaderboard();

        // Broadcast new leaderboard to ALL clients
        io.emit('updateLeaderboard', gameState.leaderboard);
    }
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
