const express = require('express');
const path = require('path');
const { MongoClient } = require('mongodb');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Constants
const DB_PASSWORD = process.env.DB_PASSWORD;
const DB_USER = "razor23donetsk_db_user";
const DB_CLUSTER = "balloon-shooter-cluster.ihyklum.mongodb.net";
const DB_URI = process.env.MONGODB_URI || `mongodb+srv://${DB_USER}:${DB_PASSWORD}@${DB_CLUSTER}/?retryWrites=true&w=majority&appName=Balloon-shooter-cluster`;

const DB_NAME = "balloon-shooter";
const COLLECTION_NAME = "leaderboard";

// Setup Express
const app = express();

// Middleware
app.use(express.static(path.join(__dirname, '../public')));
app.use(express.json());

// Handle Favicon
app.get('/favicon.ico', (req, res) => res.status(204).end());

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
    } catch (err) {
        console.warn("⚠️ MongoDB Connection Failed:", err.message);
    }
}

initializeServer();

// API Endpoints

// GET Leaderboard
app.get('/api/leaderboard', async (req, res) => {
    // If DB not connected, return empty array
    if (!dbCollection) {
        return res.json([]); 
    }

    try {
        const scores = await dbCollection.find()
            .sort({ score: -1 })
            .limit(10)
            .project({ _id: 0, name: 1, score: 1 })
            .toArray();
        res.json(scores);
    } catch (err) {
        console.error("Leaderboard Fetch Error:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// POST Score
app.post('/api/score', async (req, res) => {
    const { name, score, sessionId } = req.body;

    if (!name || score === undefined) {
        return res.status(400).json({ error: "Missing name or score" });
    }

    if (!dbCollection) {
        console.log(`[Mock Save] Player: ${name}, Score: ${score}, Session: ${sessionId}`);
        return res.status(200).json({ status: "saved (mock)" });
    }

    try {
        if (sessionId) {
            // Upsert based on sessionId to prevent duplicate entries for same game
            await dbCollection.updateOne(
                { sessionId: sessionId },
                { 
                    $set: { 
                        name: String(name).substring(0, 20), 
                        score: Number(score),
                        date: new Date()
                    }
                },
                { upsert: true }
            );
        } else {
            await dbCollection.insertOne({
                name: String(name).substring(0, 20),
                score: Number(score),
                date: new Date()
            });
        }
        res.status(200).json({ status: "success" });
    } catch (err) {
        console.error("Score Save Error:", err);
        res.status(500).json({ error: "Database Error" });
    }
});

// Catch-all route to serve the game
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
