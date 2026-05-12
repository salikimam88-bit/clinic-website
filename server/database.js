const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, '../appointments.db');

// Initialize database
const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('Error opening database:', err);
    } else {
        console.log('Connected to SQLite database');
        createTables();
    }
});

// Create tables
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
        if (err) {
            console.error('Error creating table:', err);
        } else {
            console.log('Appointments table ready');
        }
    });

    // Create indexes for faster queries
    db.run(`CREATE INDEX IF NOT EXISTS idx_phone ON appointments(phone)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_date ON appointments(appointment_date)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_status ON appointments(status)`);
}

// Database operations object
const database = {
    // Create new appointment
    createAppointment: (data, callback) => {
        const {
            firstName, lastName, phone, email,
            appointmentDate, appointmentTime, serviceType, symptoms
        } = data;

        const sql = `
            INSERT INTO appointments 
            (first_name, last_name, phone, email, appointment_date, appointment_time, service_type, symptoms)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;

        db.run(sql, [
            firstName, lastName, phone, email || null,
            appointmentDate, appointmentTime, serviceType, symptoms || null
        ], function(err) {
            if (err) {
                callback(err, null);
            } else {
                callback(null, { id: this.lastID, ...data });
            }
        });
    },

    // Get all appointments with filters
    getAppointments: (filters = {}, callback) => {
        let sql = 'SELECT * FROM appointments WHERE 1=1';
        const params = [];

        if (filters.status) {
            sql += ' AND status = ?';
            params.push(filters.status);
        }
        if (filters.phone) {
            sql += ' AND phone = ?';
            params.push(filters.phone);
        }
        if (filters.date) {
            sql += ' AND appointment_date = ?';
            params.push(filters.date);
        }
        if (filters.fromDate) {
            sql += ' AND appointment_date >= ?';
            params.push(filters.fromDate);
        }
        if (filters.toDate) {
            sql += ' AND appointment_date <= ?';
            params.push(filters.toDate);
        }

        sql += ' ORDER BY created_at DESC';

        db.all(sql, params, (err, rows) => {
            callback(err, rows);
        });
    },

    // Get single appointment by ID
    getAppointmentById: (id, callback) => {
        db.get('SELECT * FROM appointments WHERE id = ?', [id], (err, row) => {
            callback(err, row);
        });
    },

    // Update appointment status
    updateStatus: (id, status, callback) => {
        const sql = `
            UPDATE appointments 
            SET status = ?, updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?
        `;
        db.run(sql, [status, id], function(err) {
            callback(err, { changes: this.changes });
        });
    },

    // Update appointment details
    updateAppointment: (id, data, callback) => {
        const fields = [];
        const values = [];

        Object.keys(data).forEach(key => {
            if (data[key] !== undefined) {
                // Convert camelCase to snake_case
                const dbField = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
                fields.push(`${dbField} = ?`);
                values.push(data[key]);
            }
        });

        if (fields.length === 0) {
            return callback(new Error('No fields to update'), null);
        }

        values.push(id);
        const sql = `UPDATE appointments SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;

        db.run(sql, values, function(err) {
            callback(err, { changes: this.changes });
        });
    },

    // Delete appointment
    deleteAppointment: (id, callback) => {
        db.run('DELETE FROM appointments WHERE id = ?', [id], function(err) {
            callback(err, { changes: this.changes });
        });
    },

    // Get dashboard stats
    getStats: (callback) => {
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
                if (err) {
                    callback(err, null);
                    return;
                }
                stats[key] = row.count;
                completed++;
                if (completed === totalQueries) {
                    callback(null, stats);
                }
            });
        });
    },

    // Search appointments
    searchAppointments: (query, callback) => {
        const sql = `
            SELECT * FROM appointments 
            WHERE first_name LIKE ? OR last_name LIKE ? OR phone LIKE ? OR email LIKE ?
            ORDER BY created_at DESC
        `;
        const searchTerm = `%${query}%`;
        
        db.all(sql, [searchTerm, searchTerm, searchTerm, searchTerm], (err, rows) => {
            callback(err, rows);
        });
    },

    // Close database connection
    close: () => {
        db.close((err) => {
            if (err) {
                console.error(err.message);
            } else {
                console.log('Database connection closed');
            }
        });
    }
};

module.exports = database;