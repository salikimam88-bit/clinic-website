const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));

// Database setup
const DB_PATH = path.join(__dirname, '../appointments.db');
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
            first_name TEXT NOT NULL,
            last_name TEXT NOT NULL,
            phone TEXT NOT NULL,
            email TEXT,
            appointment_date TEXT NOT NULL,
            appointment_time TEXT NOT NULL,
            service_type TEXT NOT NULL,
            symptoms TEXT,
            status TEXT DEFAULT 'pending',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `, (err) => {
        if (err) console.error('Error creating table:', err);
        else console.log('Appointments table ready');
    });
}

// Create appointment
app.post('/api/appointments', (req, res) => {
    const { firstName, lastName, phone, email, appointmentDate, appointmentTime, serviceType, symptoms } = req.body;
    
    const sql = `INSERT INTO appointments (first_name, last_name, phone, email, appointment_date, appointment_time, service_type, symptoms)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
    
    db.run(sql, [firstName, lastName, phone, email || null, appointmentDate, appointmentTime, serviceType, symptoms || null], 
        function(err) {
            if (err) return res.status(500).json({ success: false, error: err.message });
            res.json({ success: true, data: { id: this.lastID } });
        }
    );
});

// Get appointments
app.get('/api/appointments', (req, res) => {
    let sql = 'SELECT * FROM appointments WHERE 1=1';
    const params = [];
    
    if (req.query.date) {
        sql += ' AND appointment_date = ?';
        params.push(req.query.date);
    }
    if (req.query.status) {
        sql += ' AND status = ?';
        params.push(req.query.status);
    }
    
    sql += ' ORDER BY created_at DESC';
    
    db.all(sql, params, (err, rows) => {
        if (err) return res.status(500).json({ success: false, error: err.message });
        res.json({ success: true, count: rows.length, data: rows });
    });
});

// Get stats
app.get('/api/stats', (req, res) => {
    const queries = {
        total: 'SELECT COUNT(*) as count FROM appointments',
        today: `SELECT COUNT(*) as count FROM appointments WHERE appointment_date = date('now')`,
        pending: `SELECT COUNT(*) as count FROM appointments WHERE status = 'pending'`,
        confirmed: `SELECT COUNT(*) as count FROM appointments WHERE status = 'confirmed'`,
        completed: `SELECT COUNT(*) as count FROM appointments WHERE status = 'completed'`,
        thisMonth: `SELECT COUNT(*) as count FROM appointments WHERE strftime('%Y-%m', appointment_date) = strftime('%Y-%m', 'now')`
    };

    const stats = {};
    let completed = 0;
    const totalQueries = Object.keys(queries).length;

    Object.keys(queries).forEach(key => {
        db.get(queries[key], (err, row) => {
            if (err) return res.status(500).json({ success: false, error: err.message });
            stats[key] = row.count;
            completed++;
            if (completed === totalQueries) {
                res.json({ success: true, data: stats });
            }
        });
    });
});

// ============================================
// THIS IS THE MISSING PART - ADD THESE ROUTES
// ============================================

// Update appointment status
app.patch('/api/appointments/:id/status', (req, res) => {
    const id = parseInt(req.params.id);
    const { status } = req.body;
    
    const validStatuses = ['pending', 'confirmed', 'completed', 'cancelled', 'no-show'];
    
    if (!status || !validStatuses.includes(status)) {
        return res.status(400).json({ 
            success: false, 
            error: 'Invalid status. Must be: ' + validStatuses.join(', ') 
        });
    }

    const sql = `UPDATE appointments SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
    
    db.run(sql, [status, id], function(err) {
        if (err) {
            console.error('Update error:', err);
            return res.status(500).json({ success: false, error: err.message });
        }
        
        if (this.changes === 0) {
            return res.status(404).json({ success: false, error: 'Appointment not found' });
        }
        
        res.json({ success: true, message: `Status updated to ${status}` });
    });
});

// Delete appointment
app.delete('/api/appointments/:id', (req, res) => {
    const id = parseInt(req.params.id);
    
    db.run('DELETE FROM appointments WHERE id = ?', [id], function(err) {
        if (err) {
            console.error('Delete error:', err);
            return res.status(500).json({ success: false, error: err.message });
        }
        
        if (this.changes === 0) {
            return res.status(404).json({ success: false, error: 'Appointment not found' });
        }
        
        res.json({ success: true, message: 'Appointment deleted successfully' });
    });
});

// Search appointments
app.get('/api/search', (req, res) => {
    const { query } = req.query;
    
    if (!query) {
        return res.status(400).json({ success: false, error: 'Search query required' });
    }

    const sql = `
        SELECT * FROM appointments 
        WHERE first_name LIKE ? OR last_name LIKE ? OR phone LIKE ? OR email LIKE ?
        ORDER BY created_at DESC
    `;
    const searchTerm = `%${query}%`;
    
    db.all(sql, [searchTerm, searchTerm, searchTerm, searchTerm], (err, rows) => {
        if (err) return res.status(500).json({ success: false, error: err.message });
        res.json({ success: true, count: rows.length, data: rows });
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Admin panel: http://localhost:${PORT}/admin.html`);
});