import express from "express";
import multer from "multer";
import { Low } from "lowdb";
import { JSONFile } from "lowdb/node";
import { nanoid } from "nanoid";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";

dotenv.config();

const app = express();
app.use(express.json());
app.use(express.static("public"));

// ========================
//     DB 初期化
// ========================
const paintingsDB = new Low(new JSONFile("data/paintings.json"), []);
const likesDB = new Low(new JSONFile("data/likes.json"), []);
const usersDB = new Low(new JSONFile("data/users.json"), []);

await paintingsDB.read();
await likesDB.read();
await usersDB.read();

paintingsDB.data ||= [];
likesDB.data ||= [];
usersDB.data ||= [];

// ========================
//     画像アップロード
// ========================
const __dirname = path.resolve();
const uploadDir = path.join(__dirname, "public", "uploads");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) =>
    cb(null, Date.now() + path.extname(file.originalname)),
});
const upload = multer({ storage });

// ========================
//     管理ログイン
// ========================
app.post("/api/admin/login", (req, res) => {
  const { password } = req.body;

  if (password === process.env.ADMIN_PASSWORD) {
    return res.json({ ok: true });
  } else {
    return res.status(401).json({ ok: false });
  }
});

// ========================
//     作品一覧取得
// ========================
app.get("/api/paintings", async (req, res) => {
  await paintingsDB.read();
  res.json(paintingsDB.data.sort((a, b) => a.order - b.order));
});

// ========================
//     作品登録
// ========================
app.post("/api/admin/paintings", upload.single("image"), async (req, res) => {
  const { author, order } = req.body;

  await paintingsDB.read();

  const newPainting = {
    id: nanoid(),
    author,
    order: Number(order),
    imagePath: "/uploads/" + req.file.filename,
    likes: 0,
  };

  paintingsDB.data.push(newPainting);
  await paintingsDB.write();

  res.json(newPainting);
});

// ========================
//     作品編集
// ========================
app.put("/api/admin/paintings/:id", upload.single("image"), async (req, res) => {
  await paintingsDB.read();
  const painting = paintingsDB.data.find((p) => p.id === req.params.id);

  if (!painting) return res.status(404).json({ error: "Not found" });

  if (req.body.author) painting.author = req.body.author;
  if (req.body.order) painting.order = Number(req.body.order);
  if (req.file) painting.imagePath = "/uploads/" + req.file.filename;

  await paintingsDB.write();
  res.json(painting);
});

// ========================
//     作品削除
// ========================
app.delete("/api/admin/paintings/:id", async (req, res) => {
  await paintingsDB.read();

  paintingsDB.data = paintingsDB.data.filter((p) => p.id !== req.params.id);
  await paintingsDB.write();

  res.json({ ok: true });
});

// ========================
//     いいね
// ========================
app.post("/api/like", async (req, res) => {
  const { paintingId, userName } = req.body;

  await likesDB.read();
  await paintingsDB.read();

  // 二重いいね防止
  const already = likesDB.data.find(
    (l) => l.paintingId === paintingId && l.userName === userName
  );

  if (already) return res.json({ ok: false });

  // ログ保存
  likesDB.data.push({
    id: nanoid(),
    paintingId,
    userName,
    time: new Date().toISOString(),
  });
  await likesDB.write();

  // 絵画側のカウント加算
  const p = paintingsDB.data.find((p) => p.id === paintingId);
  if (p) {
    p.likes++;
    await paintingsDB.write();
  }

  res.json({ ok: true });
});

// ========================
//     いいねランキング（降順）
// ========================
app.get("/api/admin/likes/ranking", async (req, res) => {
  await paintingsDB.read();
  res.json(paintingsDB.data.sort((a, b) => b.likes - a.likes));
});

// ========================
//     いいねログ（作品別 / ユーザー別 / 時系列）
// ========================
app.get("/api/admin/likes/log", async (req, res) => {
  await likesDB.read();
  await paintingsDB.read();

  const byPainting = {};
  const byUser = {};
  const byTime = [];

  // 検索用絵画辞書
  const paintingMap = {};
  paintingsDB.data.forEach((p) => (paintingMap[p.id] = p));

  likesDB.data.forEach((log) => {
    const p = paintingMap[log.paintingId];
    if (!p) return;

    // 作品ごと
    if (!byPainting[p.author]) byPainting[p.author] = [];
    byPainting[p.author].push({
      user: log.userName,
      time: log.time,
    });

    // ユーザーごと
    if (!byUser[log.userName]) byUser[log.userName] = [];
    byUser[log.userName].push({
      painting: p.author,
      time: log.time,
    });

    // 時間順
    byTime.push({
      user: log.userName,
      painting: p.author,
      time: log.time,
    });
  });

  // 時間順ソート
  byTime.sort((a, b) => new Date(b.time) - new Date(a.time));

  res.json({
    byPainting,
    byUser,
    byTime,
  });
});

// ========================
//     サーバー起動
// ========================
app.listen(process.env.PORT || 3000, () => {
  console.log("🎨 絵画展サーバー起動中…");
});
