
let paintings=[],idx=0,user=''; let admin=false;

window.onload=async()=>{
  const saved=localStorage.getItem('user');
  if(saved){
    user=saved;
    nameInput.style.display='none';
    loadPaintings();
  }
};

async function setName(){
  user=username.value;
  localStorage.setItem('user',user);
  nameInput.style.display='none';
  loadPaintings();
}

async function loadPaintings(){
  const r=await fetch('/api/paintings');
  paintings=await r.json();
  if(paintings.length===0){
    author.innerText="まだ作品がありません";
    painting.src="";
    return;
  }
  show();
}

function show(){
  const p=paintings[idx];
  if(!p)return;
  author.innerText=p.author;
  painting.src=p.imagePath;
}

async function like(){
  const p=paintings[idx];
  await fetch('/api/like',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({paintingId:p.id,userName:user})});
}

function next(){
  idx=(idx+1)%paintings.length;
  show();
}

async function adminLogin(){
  const r=await fetch('/api/admin/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:adminPass.value})});
  if(r.ok){
    admin=true;
    document.querySelectorAll('.locked').forEach(b=>{
      b.classList.remove('locked');
      b.textContent=b.textContent.replace(" 🔒","");
    });
  }else alert('NG');
}

document.querySelectorAll('.tab-btn').forEach(btn=>{
  btn.addEventListener('click',()=>{
    document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c=>c.classList.remove('show'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('show');
  });
});

async function uploadPainting(){
  const fd=new FormData();
  fd.append('author',authorReg.value);
  fd.append('order',orderReg.value);
  fd.append('image',imageReg.files[0]);
  await fetch('/api/admin/paintings',{method:'POST',body:fd});
  alert("登録しました");
}

async function loadList(){
  const r=await fetch('/api/paintings');
  const data=await r.json();
  list.innerHTML=data.map(x=>`<div><b>${x.order}. ${x.author}</b><br><img src="${x.imagePath}" width="120"></div>`).join('<hr>');
}

async function loadRank(){
  const r=await fetch('/api/admin/likes/ranking');
  const data=await r.json();
  rank.innerHTML=data.map(x=>`${x.order}. ${x.author} - ${x.likes} いいね`).join('<br>');
}
