
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

const paintingsDB = new Low(new JSONFile('data/paintings.json'), []);
const likesDB = new Low(new JSONFile('data/likes.json'), []);
const usersDB = new Low(new JSONFile('data/users.json'), []);

await paintingsDB.read(); await likesDB.read(); await usersDB.read();
paintingsDB.data ||= []; likesDB.data ||= []; usersDB.data ||= [];

// multer
const storage = multer.diskStorage({
  destination:(req,file,cb)=> cb(null,'public/uploads'),
  filename:(req,file,cb)=> cb(null,Date.now()+path.extname(file.originalname))
});
const upload = multer({storage});

// admin login
app.post('/api/admin/login',(req,res)=>{
  const {password}=req.body;
  if(password===process.env.ADMIN_PASSWORD) return res.json({ok:true});
  res.status(401).json({ok:false});
});

// add painting
app.post('/api/admin/paintings', upload.single('image'), async (req,res)=>{
  await paintingsDB.read();
  const { author, order } = req.body;
  const imagePath = '/uploads/' + req.file.filename;
  const item = { id:nanoid(), author, order:Number(order), imagePath, likes:0 };
  paintingsDB.data.push(item);
  await paintingsDB.write();
  res.json(item);
});

// edit painting
app.put('/api/admin/paintings/:id', upload.single('image'), async (req,res)=>{
  await paintingsDB.read();
  const id = req.params.id;
  const idx = paintingsDB.data.findIndex(x=>x.id===id);
  if(idx<0) return res.status(404).end();
  if(req.body.author) paintingsDB.data[idx].author=req.body.author;
  if(req.body.order) paintingsDB.data[idx].order=Number(req.body.order);
  if(req.file){
    paintingsDB.data[idx].imagePath='/uploads/'+req.file.filename;
  }
  await paintingsDB.write();
  res.json(paintingsDB.data[idx]);
});

// delete painting
app.delete('/api/admin/paintings/:id', async (req,res)=>{
  await paintingsDB.read();
  paintingsDB.data = paintingsDB.data.filter(x=>x.id!==req.params.id);
  await paintingsDB.write();
  res.json({ok:true});
});

// get paintings
app.get('/api/paintings', async (req,res)=>{
  await paintingsDB.read();
  res.json(paintingsDB.data.sort((a,b)=>a.order-b.order));
});

// like
app.post('/api/like', async (req,res)=>{
  const { paintingId, userName } = req.body;
  await likesDB.read(); await paintingsDB.read();
  if(likesDB.data.find(x=>x.paintingId===paintingId && x.userName===userName)){
    return res.json({ok:false, reason:"already"});
  }
  likesDB.data.push({paintingId,userName,time:new Date().toISOString()});
  await likesDB.write();
  const p = paintingsDB.data.find(x=>x.id===paintingId);
  if(p){ p.likes++; await paintingsDB.write(); }
  res.json({ok:true});
});

// ranking
app.get('/api/admin/likes/ranking', async (req,res)=>{
  await paintingsDB.read();
  const ranking = paintingsDB.data.sort((a,b)=>b.likes-a.likes);
  res.json(ranking);
});

app.listen(process.env.PORT || 3000, ()=> console.log("running"));
