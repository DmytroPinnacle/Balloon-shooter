const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config({ path: path.join(__dirname, '../.env') }); // Load explicitly from root

// Constants
const DB_PASSWORD = process.env.DB_PASSWORD;
const DB_USER = "razor23donetsk_db_user";
const DB_CLUSTER = "balloon-shooter-cluster.ihyklum.mongodb.net";
const DB_URI = process.env.MONGODB_URI || `mongodb+srv://${DB_USER}:${DB_PASSWORD}@${DB_CLUSTER}/?retryWrites=true&w=majority&appName=Balloon-shooter-cluster`;

const DB_NAME = "balloon-shooter";
const COLLECTION_NAME = "leaderboard";

// Setup Express
const app = express();
const server = http.createServer(app);
const io = new Server(server, { 
    cors: { 
        origin: "*", 
        methods: ["GET", "POST"],
        credentials: true
    },
    transports: ['polling', 'websocket'],
    allowEIO3: true
});

// Middleware
app.use(express.static(path.join(__dirname, '../public')));

// Handle Favicon 404
app.get('/favicon.ico', (req, res) => res.status(204).end());

// Game State
const gameState = {
    players: {}, 
    leaderboard: [] 
};

// Database Client
const client = new MongoClient(DB_URI);

let dbCollection = null;

// Initialization
async function initializeServer() {
    try {
        await client.connect();
        const db = client.db(DB_NAME);
        dbCollection = db.collection(COLLECTION_NAME);
        console.log("✅ Connected to MongoDB successfully!");
        await loadLeaderboard();
    } catch (err) {
        console.warn("⚠️ MongoDB Connection Failed (Using local mode):", err.message);
        // Fallback to local file if DB fails
        loadLocalLeaderboard(); 
    }
}

// Fallback Function
function loadLocalLeaderboard() {
    const fs = require('fs');
    const DATA_FILE = require('path').join(__dirname, 'leaderboard.json');
    if (fs.existsSync(DATA_FILE)) {
        try {
            gameState.leaderboard = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        } catch (e) {
            gameState.leaderboard = [];
        }
    }
}

initializeServer();

// Leaderboard Logic
async function loadLeaderboard() {
    if (!dbCollection) return;
    try {
        const scores = await dbCollection.find()
            .sort({ score: -1 })
            .limit(10)
            .project({ _id: 0, name: 1, score: 1 })
            .toArray();
        gameState.leaderboard = scores;
        // Console log removed as requested
    } catch (err) {
        console.error("Error loading leaderboard:", err);
    }
}

async function saveScoreToDB(player) {
    if (!dbCollection) return;
    try {
        // Feature 1: Unique entry per session (Don't overwrite old games by same name)
        
        if (player.dbId) {
            // Update existing entry for THIS session
            await dbCollection.updateOne(
                { _id: player.dbId },
                { 
                    $set: { score: player.score, lastUpdated: new Date() } 
                }
            );
        } else {
            // New entry for this session
            const result = await dbCollection.insertOne({
                name: player.name,
                score: player.score,
                date: new Date()
            });
            player.dbId = result.insertedId;
        }
        
        await loadLeaderboard();
        io.emit('updateLeaderboard', gameState.leaderboard);
        
    } catch (err) {
        console.error("Error saving score:", err);
    }
}

// Socket.io connection handling
io.on('connection', (socket) => {
    // console.log('A user connected:', socket.id);

    // Initial data transfer
    socket.emit('updateLeaderboard', gameState.leaderboard);

    // Handle 'join' event
    socket.on('joinGame', (playerName) => {
        gameState.players[socket.id] = {
            name: playerName,
            score: 0,
            level: 1,
            dbId: null // Track MongoDB ID for this session
        };
        io.emit('playerCountUpdate', Object.keys(gameState.players).length);
    });

    // Handle score updates
    socket.on('updateScore', ({ score, level }) => {
        if (gameState.players[socket.id]) {
            gameState.players[socket.id].score = score;
            gameState.players[socket.id].level = level;
            
            // Feature 2: NO DB update on every shot. 
            // Just update in-memory state.
        }
    });

    // Handle game over or level complete (Update DB HERE)
    socket.on('levelComplete', ({ score, level }) => {
        if (gameState.players[socket.id]) {
            gameState.players[socket.id].score = score;
            handleScoreSubmission(gameState.players[socket.id]);
        }
    });
    
    // Explicit game over event to save final score (Update DB HERE)
    socket.on('gameOver', ({ score }) => {
        if (gameState.players[socket.id]) {
            gameState.players[socket.id].score = score;
            handleScoreSubmission(gameState.players[socket.id]);
        }
    });

    // Disconnect
    socket.on('disconnect', () => {
        delete gameState.players[socket.id];
        io.emit('playerCountUpdate', Object.keys(gameState.players).length);
        // console.log('User disconnected:', socket.id);
    });
});

function handleScoreSubmission(player) {
    saveScoreToDB(player);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
