import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import multer from 'multer';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

app.use(cors());
app.use(morgan('tiny'));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// ---- Env ----
const PORT = process.env.PORT || 3000;
const DATABASE_URL = process.env.DATABASE_URL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'change_me_secret';

if (!DATABASE_URL) {
  console.warn('[warn] DATABASE_URL is not set. Set it on Railway (e.g., Postgres connection URL).');
}

// SSL true for hosted Postgres (Railway). If local fails, you may set PGSSLMODE=disable.
const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function migrate() {
  // artworks: 画像のみ（タイトル・作者なし）
  await pool.query(`
    CREATE TABLE IF NOT EXISTS artworks (
      id SERIAL PRIMARY KEY,
      image BYTEA NOT NULL,
      sort_order INTEGER,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  // 以前のバージョンからの移行用：title/author があれば削除
  await pool.query(`ALTER TABLE artworks DROP COLUMN IF EXISTS title;`);
  await pool.query(`ALTER TABLE artworks DROP COLUMN IF EXISTS author;`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS likes (
      id SERIAL PRIMARY KEY,
      username TEXT NOT NULL,
      artwork_id INTEGER NOT NULL REFERENCES artworks(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (username, artwork_id)
    );
  `);
  // Ensure sort_order column exists (for older deployments)
  await pool.query(`ALTER TABLE artworks ADD COLUMN IF NOT EXISTS sort_order INTEGER;`);
  // Backfill sort_order for NULL rows based on created_at,id
  await pool.query(`
    WITH ranked AS (
      SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC, id ASC) AS rn
      FROM artworks
    )
    UPDATE artworks AS a
    SET sort_order = r.rn
    FROM ranked AS r
    WHERE a.id = r.id AND a.sort_order IS NULL;
  `);
  console.log('[migrate] done');
}

// ---- Auth (admin) ----
function authMiddleware(req, res, next) {
  const hdr = req.headers.authorization || '';
  const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const payload = jwt.verify(token, ADMIN_JWT_SECRET);
    if (payload.role !== 'admin') throw new Error('invalid');
    next();
  } catch (e) { return res.status(401).json({ error: 'Unauthorized' }); }
}

app.post('/api/admin/login', async (req, res) => {
  const { password } = req.body || {};
  if (!password) return res.status(400).json({ error: 'password required' });
  if (password !== ADMIN_PASSWORD) return res.status(401).json({ error: 'invalid password' });
  const token = jwt.sign({ role: 'admin' }, ADMIN_JWT_SECRET, { expiresIn: '12h' });
  res.json({ token });
});

// ---- Artworks CRUD ----
app.post('/api/artworks', authMiddleware, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'image required' });
    // choose next sort_order = max+1
    const nextOrderRes = await pool.query(`SELECT COALESCE(MAX(sort_order),0)+1 AS next FROM artworks`);
    const nextOrder = nextOrderRes.rows[0].next || 1;
    const { rows } = await pool.query(
      `INSERT INTO artworks (image, sort_order) VALUES ($1,$2) RETURNING id, created_at, sort_order`,
      [req.file.buffer, nextOrder]
    );
    res.json({ ...rows[0], like_count: 0 });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server error' });
  }
});

app.put('/api/artworks/:id', authMiddleware, upload.single('image'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'invalid id' });
    if (!req.file) return res.status(400).json({ error: 'image required' });

    await pool.query(`UPDATE artworks SET image=$1 WHERE id=$2`, [req.file.buffer, id]);

    const { rows } = await pool.query(`
      SELECT a.id, a.created_at,
             COALESCE(l.cnt, 0)::int AS like_count
      FROM artworks a
      LEFT JOIN (SELECT artwork_id, COUNT(*)::int AS cnt FROM likes GROUP BY artwork_id) l
        ON l.artwork_id = a.id
      WHERE a.id=$1
    `, [id]);
    if (!rows.length) return res.status(404).json({ error: 'not found' });
    res.json(rows[0]);
  } catch (e) { console.error(e); res.status(500).json({ error: 'server error' }); }
});

app.delete('/api/artworks/:id', authMiddleware, async (req, res) => {
  try {
    const id = Number(req.params.id);
    await pool.query(`DELETE FROM artworks WHERE id=$1`, [id]);
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'server error' }); }
});

app.put('/api/artworks/order', authMiddleware, async (req, res) => {
  try {
    const { ids } = req.body || {};
    if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ error: 'ids required' });
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (let i = 0; i < ids.length; i++) {
        const id = Number(ids[i]);
        if (!Number.isFinite(id)) continue;
        await client.query('UPDATE artworks SET sort_order=$1 WHERE id=$2', [i + 1, id]);
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK'); throw e;
    } finally {
      client.release();
    }
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'server error' }); }
});

// ---- Reads ----
app.get('/api/artworks', async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT a.id, a.created_at,
             COALESCE(l.cnt, 0)::int AS like_count
      FROM artworks a
      LEFT JOIN (SELECT artwork_id, COUNT(*)::int AS cnt FROM likes GROUP BY artwork_id) l
        ON l.artwork_id = a.id
      ORDER BY a.sort_order ASC NULLS LAST, a.created_at ASC, a.id ASC
    `);
    res.json(rows);
  } catch (e) { console.error(e); res.status(500).json({ error: 'server error' }); }
});

app.get('/api/artworks/:id/image', async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT image FROM artworks WHERE id=$1`, [req.params.id]);
    if (!rows.length) return res.status(404).end();
    res.setHeader('Content-Type', 'image/jpeg');
    res.send(rows[0].image);
  } catch (e) { console.error(e); res.status(500).json({ error: 'server error' }); }
});

// ---- Likes ----
app.post('/api/likes', async (req, res) => {
  try {
    const { username, artworkId } = req.body || {};
    if (!username || !artworkId) return res.status(400).json({ error: 'username/artworkId required' });
    await pool.query(`INSERT INTO likes (username, artwork_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [username, artworkId]);
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'server error' }); }
});

app.get('/api/likes', authMiddleware, async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT l.id, l.username, l.artwork_id, l.created_at
      FROM likes l
      ORDER BY l.created_at DESC
    `);
    res.json(rows);
  } catch (e) { console.error(e); res.status(500).json({ error: 'server error' }); }
});

app.get('/api/ranking', authMiddleware, async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT a.id, COALESCE(c.c,0)::int AS like_count
      FROM artworks a
      LEFT JOIN (SELECT artwork_id, COUNT(*)::int AS c FROM likes GROUP BY artwork_id) c
        ON c.artwork_id = a.id
      ORDER BY like_count DESC, a.sort_order ASC NULLS LAST, a.created_at ASC
    `);
    res.json(rows);
  } catch (e) { console.error(e); res.status(500).json({ error: 'server error' }); }
});

// ---- Serve ----
app.listen(PORT, async () => {
  try { await migrate(); } catch (e) { console.error('[migrate] failed', e); }
  console.log(`Server listening on :${PORT}`);
});
