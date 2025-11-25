
let paintings=[], idx=0, user='';

async function start(){
  user = document.getElementById('username').value;
  localStorage.setItem('user',user);
  document.getElementById('nameInput').style.display='none';
  document.getElementById('viewer').style.display='block';
  const r = await fetch('/api/paintings'); paintings = await r.json();
  show();
}

function show(){
  const p = paintings[idx];
  document.getElementById('author').innerText = p.author;
  document.getElementById('painting').src = p.imagePath;
}

async function like(){
  const p = paintings[idx];
  await fetch('/api/like',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({paintingId:p.id,userName:user})});
}

function next(){
  idx = (idx+1)%paintings.length;
  show();
}
