const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON bodies
app.use(express.json());

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Initialize SQLite database
const db = new sqlite3.Database('./database.db', (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        // Create tables if they don't exist
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
        db.run(`CREATE TABLE IF NOT EXISTS videos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            youtube_id TEXT UNIQUE NOT NULL,
            title TEXT NOT NULL,
            description TEXT,
            likes INTEGER DEFAULT 0
        )`);
        // Table to track which user liked which video
        db.run(`CREATE TABLE IF NOT EXISTS user_video_likes (
            user_id INTEGER,
            youtube_id TEXT,
            PRIMARY KEY (user_id, youtube_id),
            FOREIGN KEY (user_id) REFERENCES users(id)
        )`);

        // --- Initial Seed Data (Optional) ---
        const initialVideos = [
            { youtube_id: 'dQw4w9WgXcQ', title: 'Never Gonna Give You Up', description: 'A classic hit.' },
            { youtube_id: 'someOtherVideoId', title: 'My Short Film 1', description: 'Our first amazing short.' },
            { youtube_id: 'anotherShortFilmId', title: 'City Lights', description: 'A cinematic journey.' }
        ];

        initialVideos.forEach(video => {
            db.run(`INSERT OR IGNORE INTO videos (youtube_id, title, description) VALUES (?, ?, ?)`,
                [video.youtube_id, video.title, video.description],
                function(err) {
                    if (err) {
                        console.error(`Error inserting video ${video.title}:`, err.message);
                    } else if (this.changes > 0) {
                        console.log(`Video "${video.title}" inserted.`);
                    }
                }
            );
        });
        // --- End Seed Data ---
    }
});

// API Endpoint to Save User Details
app.post('/api/users', (req, res) => {
    const { name, email } = req.body;

    if (!name || !email) {
        return res.status(400).json({ message: 'Name and email are required.' });
    }

    db.run(`INSERT INTO users (name, email) VALUES (?, ?)`, [name, email], function(err) {
        if (err) {
            if (err.message.includes('UNIQUE constraint failed')) {
                return res.status(409).json({ message: 'Email already registered.' });
            }
            console.error('Error inserting user:', err.message);
            return res.status(500).json({ message: 'Error saving user details.' });
        }
        res.status(201).json({ message: 'User details saved successfully!', userId: this.lastID });
    });
});

// API Endpoint to Get All Videos
app.get('/api/videos', (req, res) => {
    db.all(`SELECT youtube_id, title, description, likes FROM videos ORDER BY id DESC`, [], (err, rows) => {
        if (err) {
            console.error('Error fetching videos:', err.message);
            return res.status(500).json({ message: 'Error fetching videos.' });
        }
        res.json(rows);
    });
});


// API Endpoint to Like a Video
app.post('/api/videos/:youtubeId/like', (req, res) => {
    const { youtubeId } = req.params;
    const { userId } = req.body; // Assuming userId is passed from frontend (e.g., from session/local storage)

    if (!userId) {
        return res.status(401).json({ message: 'User not identified. Please register first.' });
    }

    db.get(`SELECT * FROM user_video_likes WHERE user_id = ? AND youtube_id = ?`, [userId, youtubeId], (err, row) => {
        if (err) {
            console.error('Error checking like status:', err.message);
            return res.status(500).json({ message: 'Server error checking like status.' });
        }

        if (row) {
            // User has already liked this video
            return res.status(409).json({ message: 'You have already liked this video.' });
        } else {
            // Record the like by the user
            db.run(`INSERT INTO user_video_likes (user_id, youtube_id) VALUES (?, ?)`, [userId, youtubeId], function(insertErr) {
                if (insertErr) {
                    console.error('Error recording user like:', insertErr.message);
                    return res.status(500).json({ message: 'Error recording user like.' });
                }

                // Increment the like count for the video
                db.run(`UPDATE videos SET likes = likes + 1 WHERE youtube_id = ?`, [youtubeId], function(updateErr) {
                    if (updateErr) {
                        console.error('Error incrementing video likes:', updateErr.message);
                        return res.status(500).json({ message: 'Error updating video likes.' });
                    }
                    if (this.changes === 0) {
                        // This means no video was found with that youtube_id
                        return res.status(404).json({ message: 'Video not found.' });
                    }
                    res.json({ message: 'Video liked successfully!' });
                });
            });
        }
    });
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
