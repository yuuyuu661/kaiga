let paintings = [];
let idx = 0;
let user = '';

async function start() {
  user = document.getElementById('username').value;
  localStorage.setItem('user', user);

  document.getElementById('nameInput').style.display = 'none';
  document.getElementById('viewer').style.display = 'block';

  const r = await fetch('/api/paintings');
  paintings = await r.json();

  if (paintings.length === 0) {
    document.getElementById('viewer').innerHTML =
      "<p>まだ作品が登録されていません。</p>";
    return;
  }

  show();
}

function show() {
  const p = paintings[idx];
  if (!p) return;

  document.getElementById('author').innerText = p.author;
  document.getElementById('painting').src = p.imagePath;
}

async function like() {
  const p = paintings[idx];
  if (!p) return;

  await fetch('/api/like', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ paintingId: p.id, userName: user })
  });
}

function next() {
  if (paintings.length === 0) return;

  idx = (idx + 1) % paintings.length;
  show();
}
