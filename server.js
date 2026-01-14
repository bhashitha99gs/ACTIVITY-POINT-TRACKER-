// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('frontend')); // serve frontend files

// MySQL connection pool (cloud database)
const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT
});

// ----------------- ROUTES -----------------

// Verify club password
app.post('/verify-club-password', async (req, res) => {
  try {
    const { club, password } = req.body;
    if (!club || !password)
      return res.status(400).json({ success: false, message: 'Missing club or password' });

    const [rows] = await db.query(
      'SELECT * FROM clubs WHERE name = ? AND password = ?',
      [club, password]
    );

    if (rows.length > 0) res.json({ success: true });
    else res.status(401).json({ success: false, message: 'Incorrect password' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Add activity and update student points
app.post('/add-activity', async (req, res) => {
  try {
    const { club, activity, date, points, emails } = req.body;
    if (!club || !activity || !date || !points || !emails || !emails.length) {
      return res.status(400).json({ success: false, message: 'All fields required' });
    }

    for (const email of emails) {
      const [students] = await db.query('SELECT id, total_points FROM students WHERE email = ?', [email]);
      if (students.length === 0) continue;

      const student_id = students[0].id;
      const newTotal = students[0].total_points + points;

      await db.query(
        'INSERT INTO activities (student_id, club, activity_name, date, points) VALUES (?, ?, ?, ?, ?)',
        [student_id, club, activity, date, points]
      );

      await db.query('UPDATE students SET total_points = ? WHERE id = ?', [newTotal, student_id]);
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Verify student email
app.post('/verify-student', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: "Email is required" });

    const [rows] = await db.execute("SELECT * FROM students WHERE email = ?", [email]);
    
    if (rows.length > 0) res.json({ success: true, student: rows[0] });
    else res.status(404).json({ success: false, message: "Student not found" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Get all activities of a student
app.get('/activities/:studentId', async (req, res) => {
  try {
    const { studentId } = req.params;
    const [rows] = await db.query('SELECT * FROM activities WHERE student_id = ?', [studentId]);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Serve frontend index
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "frontend", "index.html"));
});

// ----------------- START SERVER -----------------
const PORT = process.env.SERVER_PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
