const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();

// CORS Configuration - Allow all origins for development
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.static(__dirname));

// Database Connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Run Schema & Migration Scripts on Startup
(async () => {
    try {
        const client = await pool.connect();
        console.log('✅ Connected to PostgreSQL DB');

        const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
        await client.query(schema);
        console.log('✅ Schema & migrations applied successfully');
        
        client.release();
    } catch (err) {
        console.error('❌ DB Initialization Error:', err.message);
    }
})();

// ============================================
// ROOT & HEALTH CHECK ROUTES
// ============================================
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/api', (req, res) => {
    res.json({ message: 'API is operational' });
});

// ============================================
// AUTH & USERS ENDPOINTS
// ============================================
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const { rows } = await pool.query(
            'SELECT id, username, role, name FROM users WHERE LOWER(username) = LOWER($1) AND password = $2',
            [username.trim(), password.trim()]
        );
        if (rows.length === 0) {
            return res.status(401).json({ message: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
        }
        res.json({ user: rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/users', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT id, username, role, name FROM users ORDER BY id ASC');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/users', async (req, res) => {
    const { username, password, role, name } = req.body;
    try {
        const { rows } = await pool.query(
            'INSERT INTO users (username, password, role, name) VALUES ($1, $2, $3, $4) RETURNING id, username, role, name',
            [username.trim(), password.trim(), role || 'staff', name.trim()]
        );
        res.status(201).json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/users/:id', async (req, res) => {
    const { id } = req.params;
    const { username, password, role, name } = req.body;
    try {
        let query, values;
        if (password && password.trim() !== '') {
            query = 'UPDATE users SET username = $1, password = $2, role = $3, name = $4 WHERE id = $5 RETURNING id, username, role, name';
            values = [username.trim(), password.trim(), role, name.trim(), id];
        } else {
            query = 'UPDATE users SET username = $1, role = $2, name = $3 WHERE id = $4 RETURNING id, username, role, name';
            values = [username.trim(), role, name.trim(), id];
        }
        const { rows } = await pool.query(query, values);
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/users/change-password/:username', async (req, res) => {
    const { username } = req.params;
    const { password } = req.body;
    try {
        await pool.query('UPDATE users SET password = $1 WHERE LOWER(username) = LOWER($2)', [password.trim(), username]);
        res.json({ message: 'Password updated successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// GAMES MANAGEMENT ENDPOINTS
// ============================================
app.get('/api/games', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM games ORDER BY id ASC');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/games', async (req, res) => {
    const { name, duration, price } = req.body;
    try {
        const { rows } = await pool.query(
            'INSERT INTO games (name, duration, price) VALUES ($1, $2, $3) RETURNING *',
            [name.trim(), parseInt(duration), parseFloat(price)]
        );
        res.status(201).json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/games/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM games WHERE id = $1', [req.params.id]);
        res.json({ message: 'Game deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// BOOKINGS & REPORTS ENDPOINTS
// ============================================
app.post('/api/bookings', async (req, res) => {
    const {
        shift_id, child_name, father_name, phone,
        game_name, duration, player_count, unit_price,
        subtotal, discount, total_price, start_time, end_time, created_by
    } = req.body;

    const query = `
        INSERT INTO bookings (
            shift_id, child_name, father_name, phone,
            game_name, duration, player_count, unit_price,
            subtotal, discount, total_price, start_time, end_time, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING *;
    `;

    try {
        const values = [
            shift_id || 'SHIFT-1',
            child_name,
            father_name,
            phone || 'لا يوجد',
            game_name,
            parseInt(duration) || 30,
            parseInt(player_count) || 1,
            parseFloat(unit_price) || 0,
            parseFloat(subtotal) || 0,
            parseFloat(discount) || 0,
            parseFloat(total_price) || 0,
            start_time,
            end_time,
            created_by || 'admin'
        ];
        const { rows } = await pool.query(query, values);
        res.status(201).json(rows[0]);
    } catch (err) {
        console.error("❌ Booking Database Error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/bookings', async (req, res) => {
    const { startDate, endDate, status } = req.query;
    try {
        let query = 'SELECT * FROM bookings WHERE status = $1';
        let values = [status || 'active'];

        if (startDate && endDate) {
            query += ' AND iso_date >= $2 AND iso_date <= $3';
            values.push(startDate, endDate);
        }

        query += ' ORDER BY id DESC';
        const { rows } = await pool.query(query, values);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/bookings/:id', async (req, res) => {
    const { id } = req.params;
    const {
        child_name, father_name, phone, game_name, duration,
        player_count, unit_price, subtotal, discount, total_price, modified_by
    } = req.body;

    try {
        const { rows } = await pool.query(
            `UPDATE bookings SET 
                child_name = $1, father_name = $2, phone = $3, game_name = $4,
                duration = $5, player_count = $6, unit_price = $7, subtotal = $8,
                discount = $9, total_price = $10, status = 'modified', modified_by = $11
            WHERE id = $12 RETURNING *`,
            [
                child_name, father_name, phone, game_name,
                parseInt(duration) || 30, parseInt(player_count) || 1,
                parseFloat(unit_price) || 0, parseFloat(subtotal) || 0,
                parseFloat(discount) || 0, parseFloat(total_price) || 0,
                modified_by || 'admin', id
            ]
        );
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/bookings/:id', async (req, res) => {
    const { id } = req.params;
    const { deleted_by } = req.body;
    try {
        await pool.query("UPDATE bookings SET status = 'deleted', deleted_by = $1 WHERE id = $2", [deleted_by || 'admin', id]);
        res.json({ message: 'Booking soft deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// SHIFT CLOSURE ENDPOINTS
// ============================================
app.get('/api/shifts/active/:username', async (req, res) => {
    const { username } = req.params;
    try {
        const { rows } = await pool.query(
            "SELECT * FROM bookings WHERE created_by = $1 AND shift_closed = FALSE AND status != 'deleted' ORDER BY id ASC",
            [username]
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/shifts/close', async (req, res) => {
    const { username } = req.body;
    try {
        await pool.query(
            "UPDATE bookings SET shift_closed = TRUE WHERE created_by = $1 AND shift_closed = FALSE",
            [username]
        );
        res.json({ message: 'Shift closed successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// START SERVER
// ============================================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});

module.exports = app;