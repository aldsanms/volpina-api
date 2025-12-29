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
  const { conv_id, text, timestamp, sender, isSave, param } = req.body;

  if (!conv_id || !text || !timestamp) {
    return res.status(400).send("Missing required fields");
  }

  try {
    // Ajout du message
    await pool.query(
      `INSERT INTO messages (conv_id, text, timestamp, sender, isSave, param)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        conv_id,
        text,
        timestamp,
        sender || null,
        isSave ?? false,       
        param ?? {}            
      ]
    );

    // Nettoyage : garder les 20 derniers messages NON sauvegardés
    await pool.query(
      `
      DELETE FROM messages
      WHERE id NOT IN (
        SELECT id FROM messages
        WHERE conv_id = $1
          AND isSave = FALSE
        ORDER BY timestamp DESC
        LIMIT 20
      )
      AND conv_id = $1
      AND isSave = FALSE
      `,
      [conv_id]
    );

    res.send("OK");

  } catch (e) {
    console.error("DATABASE ERROR:", e.message);
    res.status(500).send("Erreur serveur");
  }
});

// Save messages
app.post("/messages/:id/save", async (req, res) => {
  const { id } = req.params;

  try {
    await pool.query(
      "UPDATE messages SET issave = true WHERE id = $1",
      [id]
    );
    res.sendStatus(200);
  } catch (e) {
    console.error(e);
    res.sendStatus(500);
  }
});

// Unsave messages
app.post("/messages/:id/unsave", async (req, res) => {
  const { id } = req.params;

  try {
    await pool.query(
      "UPDATE messages SET issave = false WHERE id = $1",
      [id]
    );
    res.sendStatus(200);
  } catch (e) {
    console.error(e);
    res.sendStatus(500);
  }
});

// Delete messages
app.delete("/messages/:id", async (req, res) => {
  const { id } = req.params;

  try {
    await pool.query(
      "DELETE FROM messages WHERE id = $1",
      [id]
    );
    res.sendStatus(200);
  } catch (e) {
    console.error(e);
    res.sendStatus(500);
  }
});

app.delete("/conversations/:id", async (req, res) => {
  const { id } = req.params;

  try {
    await pool.query("DELETE FROM messages WHERE conv_id = $1", [id]);

    res.sendStatus(200);
  } catch (e) {
    console.error(e);
    res.sendStatus(500);
  }
});

app.get("/conversation-last-time/:convId", async (req, res) => {
  const { convId } = req.params;

  try {
    const result = await pool.query(
      `
      SELECT MAX(timestamp) AS last_time
      FROM messages
      WHERE conv_id = $1
      `,
      [convId]
    );

    res.json({
      conv_id: convId,
      last_time: result.rows[0].last_time
    });
  } catch (e) {
    console.error(e);
    res.sendStatus(500);
  }
});




const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Volpina API running on port ${PORT}`));
