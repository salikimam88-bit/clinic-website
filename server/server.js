const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const app = express();

// ===== 1. MIDDLEWARE FIRST =====
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ===== 2. DATABASE SETUP =====
const DB_PATH = path.join(__dirname, 'appointments.db');
const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('Error opening database:', err);
    } else {
        console.log('Connected to SQLite database');
        createTables();
    }
});

function createTables() {
    db.run(`
        CREATE TABLE IF NOT EXISTS appointments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            phone TEXT NOT NULL,
            email TEXT,
            date TEXT NOT NULL,
            time TEXT NOT NULL,
            doctor TEXT,
            status TEXT DEFAULT 'pending',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `, (err) => {
        if (err) console.error('Error creating table:', err);
        else console.log('Appointments table ready');
    });

    db.run(`
        CREATE TABLE IF NOT EXISTS admins (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL
        )
    `);
}

// ===== 3. API ROUTES =====
app.get('/api/appointments', (req, res) => {
    db.all('SELECT * FROM appointments ORDER BY date, time', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/appointments', (req, res) => {
    const { name, phone, email, date, time, doctor } = req.body;
    db.run(
        'INSERT INTO appointments (name, phone, email, date, time, doctor) VALUES (?, ?, ?, ?, ?, ?)',
        [name, phone, email, date, time, doctor],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id: this.lastID, message: 'Appointment booked' });
        }
    );
});

app.delete('/api/appointments/:id', (req, res) => {
    db.run('DELETE FROM appointments WHERE id = ?', [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Appointment deleted' });
    });
});

// ===== 4. START SERVER LAST =====
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});