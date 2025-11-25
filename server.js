
import express from 'express';
import multer from 'multer';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import { nanoid } from 'nanoid';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config();
const app = express();
app.use(express.json());
app.use(express.static('public'));

const __dirname = path.resolve();
const uploadDir = path.join(__dirname, "public", "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir,{recursive:true});

const storage = multer.diskStorage({
  destination:(req,file,cb)=>cb(null,uploadDir),
  filename:(req,file,cb)=>cb(null,Date.now()+path.extname(file.originalname))
});
const upload = multer({storage});

const paintingsDB = new Low(new JSONFile('data/paintings.json'), []);
const likesDB = new Low(new JSONFile('data/likes.json'), []);
await paintingsDB.read(); await likesDB.read();
paintingsDB.data ||= []; likesDB.data ||= [];

// admin login
app.post('/api/admin/login',(req,res)=>{
  if(req.body.password===process.env.ADMIN_PASSWORD) return res.json({ok:true});
  res.status(401).json({ok:false});
});

// add painting
app.post('/api/admin/paintings', upload.single('image'), async (req,res)=>{
  await paintingsDB.read();
  const {author,order}=req.body;
  const p={id:nanoid(),author,order:Number(order),imagePath:'/uploads/'+req.file.filename,likes:0};
  paintingsDB.data.push(p);
  await paintingsDB.write();
  res.json(p);
});

// get paintings
app.get('/api/paintings',async(req,res)=>{
  await paintingsDB.read();
  res.json(paintingsDB.data.sort((a,b)=>a.order-b.order));
});

// like
app.post('/api/like',async(req,res)=>{
  const {paintingId,userName}=req.body;
  await likesDB.read(); await paintingsDB.read();
  if(likesDB.data.find(x=>x.paintingId===paintingId && x.userName===userName))
    return res.json({ok:false});
  likesDB.data.push({paintingId,userName,time:new Date().toISOString()});
  await likesDB.write();
  const p=paintingsDB.data.find(x=>x.id===paintingId);
  if(p){p.likes++; await paintingsDB.write();}
  res.json({ok:true});
});

// ranking
app.get('/api/admin/likes/ranking',async(req,res)=>{
  await paintingsDB.read();
  res.json(paintingsDB.data.sort((a,b)=>b.likes-a.likes));
});

app.listen(process.env.PORT||3000,()=>console.log("running"));
