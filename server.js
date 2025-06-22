const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");

const app = express();
const dbPath = path.join(__dirname, "medcare.db");

let db = null;

app.use(cors({
  origin: 'http://localhost:8080/', // frontend origin
  credentials: true
}));
app.use(bodyParser.json());
app.use(session({
  secret: 'secret_key',
  resave: false,
  saveUninitialized: false
}));

// Initialize DB and start server
const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });

    // Create tables after db is open
    await db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT
      );
    `);
    await db.exec(`
      CREATE TABLE IF NOT EXISTS medications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId INTEGER,
        name TEXT,
        dosage TEXT,
        frequency TEXT,
        taken INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(userId) REFERENCES users(id)
      );
    `);

    app.listen(8080, () => {
      console.log("✅ Server running at http://localhost:8080/");
    });

  } catch (e) {
    console.error(`❌ DB Error: ${e.message}`);
    process.exit(1);
  }
};

initializeDBAndServer();

// Routes

app.post('/signup', async (req, res) => {
  const {username, password} = req.body
  const hashedPassword = await bcrypt.hash(request.body.password, 10);
  const selectUserQuery = `SELECT * FROM users WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    const createUserQuery = `
      INSERT INTO 
        users (username,password) 
      VALUES 
        (
          '${username}', 
          '${hashedPassword}', 
        )`;
    const dbResponse = await db.run(createUserQuery);
    const newUserId = dbResponse.lastID;
    res.send(`Created new user with ${newUserId}`);
  } else {
    res.status = 400;
    res.send("User already exists");
  }
});

// app.get('/', async (request, response) => {
//   const username = "Sivaram750@gmail";
//   const password = "sivaram"
  
//   const hashedPassword = await bcrypt.hash(password, 10);
//   const selectUserQuery = `SELECT * FROM users WHERE username = '${username}'`;
//   const dbUser = await db.get(selectUserQuery);
//   if (dbUser === undefined) {
//     const createUserQuery = `
//       INSERT INTO 
//         users (username,password) 
//       VALUES 
//         (
//           '${username}', 
//           '${hashedPassword}' 
//         )`;
//     const dbResponse = await db.run(createUserQuery);
//     const newUserId = dbResponse.lastID;
//     console.log(newUserId)
//     response.send(`Created new user with ${newUserId}`);
//   } else {
//     response.status = 400;
//     response.send("User already exists");
//   }
// });

app.post('/login', async (req, res) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM users WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid User");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
    } else {
      res.status(400);
      res.send("Invalid Password");
    }
  }
});

// Middleware
const auth = (req, res, next) => {
 let jwtToken;
  const authHeader = req.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        res.status(401);
        res.send("Invalid JWT Token");
      } else {
        req.username = payload.username;
        next();
      }
    });
  }
};

// Medication Routes
app.post('/medications', auth, async (req, res) => {
  const { name, dosage, frequency } = req.body;
  try {
    const result = await db.run(
      `INSERT INTO medications (userId, name, dosage, frequency) VALUES (?, ?, ?, ?)`,
      [req.session.userId, name, dosage, frequency]
    );
    res.json({ id: result.lastID });
  } catch {
    res.status(500).json({ error: 'Failed to add medication' });
  }
});

app.get('/medications', auth, async (req, res) => {
  try {
    const rows = await db.all(`SELECT * FROM medications WHERE userId = ?`, [req.session.userId]);
    const total = rows.length;
    const taken = rows.filter(m => m.taken).length;
    const adherence = total > 0 ? Math.round((taken / total) * 100) : 0;
    res.json({ medications: rows, adherence });
  } catch {
    res.status(500).json({ error: 'Failed to fetch medications' });
  }
});

app.post('/medications/:id/take', auth, async (req, res) => {
  try {
    const result = await db.run(
      `UPDATE medications SET taken = 1 WHERE id = ? AND userId = ?`,
      [req.params.id, req.session.userId]
    );
    if (result.changes === 0) return res.status(400).json({ error: 'Failed to update' });
    res.json({ message: 'Marked as taken' });
  } catch {
    res.status(400).json({ error: 'Failed to update' });
  }
});
