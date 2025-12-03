import express from "express";
import cors from "cors";
import pg from "pg";
import dotenv from "dotenv";

dotenv.config();
const { Pool } = pg;

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false  // important pour Neon
  }
});

// TEST
app.get("/ping", (req, res) => {
  res.send("pong");
});

// GET messages
app.get("/messages", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM messages ORDER BY id ASC");
    res.json(result.rows);
  } catch (e) {
    console.error(e);
    res.status(500).send("Erreur serveur");
  }
});

// POST messages
app.post("/messages", async (req, res) => {
  const { conv_id, text, timestamp, sender } = req.body;

  if (!conv_id || !text || !timestamp) {
    return res.status(400).send("Missing required fields");
  }

  try {
    await pool.query(
      `INSERT INTO messages (conv_id, text, timestamp, sender)
       VALUES ($1, $2, $3, $4)`,
      [conv_id, text, timestamp, sender || null]
    );

    res.send("OK");
  } catch (e) {
  console.error("DATABASE ERROR:", e.message);
  res.status(500).send("Erreur serveur");
}

});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Volpina API running on port ${PORT}`));
