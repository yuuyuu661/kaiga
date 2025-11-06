const API_BASE = '';
let ADMIN_TOKEN = sessionStorage.getItem('adminToken') || '';

// ----- Tabs -----
const tabsEl = document.getElementById('tabs');
const tabs = [...tabsEl.querySelectorAll('.tab')];
const panels = {
  exhibit: document.getElementById('panel-exhibit'),
  likes: document.getElementById('panel-likes'),
  register: document.getElementById('panel-register'),
};
function showTab(name) {
  tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === name));
  Object.entries(panels).forEach(([k, el]) => el.classList.toggle('hidden', k !== name));
  if (name === 'exhibit') startExhibit();
  if (name === 'likes') loadLikesAndRanking();
  if (name === 'register') refreshArtList();
}
tabsEl.addEventListener('click', (e) => {
  const btn = e.target.closest('.tab');
  if (!btn) return;
  const isProtected = btn.dataset.protected === 'true';
  if (isProtected && !ADMIN_TOKEN) {
    adminModal.showModal();
    return;
  }
  showTab(btn.dataset.tab);
});

// ----- Visitor Name (one-time) -----
const nameModal = document.getElementById('nameModal');
const nameInput = document.getElementById('nameInput');
const saveNameBtn = document.getElementById('saveNameBtn');
const visitorNameDisp = document.getElementById('visitorNameDisp');

function getVisitorName() { return localStorage.getItem('visitorName') || ''; }
function setVisitorName(n) { localStorage.setItem('visitorName', n); visitorNameDisp.textContent = n || '未設定'; }

saveNameBtn.addEventListener('click', () => {
  const n = nameInput.value.trim();
  if (!n) return alert('お名前を入力してください');
  if (n.length > 24) return alert('24文字以内で入力してください');
  // lock (no change allowed)
  if (!getVisitorName()) {
    setVisitorName(n);
    nameModal.close();
  } else {
    alert('名前は変更できません');
  }
});

// Initial show name modal if missing
(function initName() {
  const n = getVisitorName();
  setVisitorName(n);
  if (!n) nameModal.showModal();
})();

// ----- Admin Login -----
const adminLoginBtn = document.getElementById('adminLoginBtn');
const adminModal = document.getElementById('adminModal');
const adminPassInput = document.getElementById('adminPassInput');
const adminLoginDoBtn = document.getElementById('adminLoginDoBtn');
const adminLoginMsg = document.getElementById('adminLoginMsg');

adminLoginBtn.addEventListener('click', () => {
  adminLoginMsg.textContent = '';
  adminPassInput.value = '';
  adminModal.showModal();
});

adminLoginDoBtn.addEventListener('click', async () => {
  const password = adminPassInput.value;
  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ password })
    });
    if (!res.ok) throw new Error('login failed');
    const data = await res.json();
    ADMIN_TOKEN = data.token;
    sessionStorage.setItem('adminToken', ADMIN_TOKEN);
    adminLoginMsg.textContent = 'ログイン成功';
    adminModal.close();
  } catch (e) {
    adminLoginMsg.textContent = 'ログイン失敗。パスワードを確認してください。';
  }
});

// ----- Exhibit Flow -----
const exhibitBox = document.getElementById('exhibitBox');
const exhibitMeta = document.getElementById('exhibitMeta');
const likeBtn = document.getElementById('likeBtn');
const nextBtn = document.getElementById('nextBtn');
const thanks = document.getElementById('thanks');
const exhibitArea = document.getElementById('exhibitArea');

let exhibitOrder = [];
let exhibitIndex = 0;

async function fetchArtworks() {
  const res = await fetch('/api/artworks');
  return await res.json();
}

async function startExhibit() {
  const arts = await fetchArtworks();
  exhibitOrder = arts;
  exhibitIndex = 0;
  renderCurrentArtwork();
}

function renderCurrentArtwork() {
  const art = exhibitOrder[exhibitIndex];
  const user = getVisitorName();
  if (!user) { nameModal.showModal(); return; }
  if (!art) {
    exhibitArea.classList.add('hidden');
    thanks.classList.remove('hidden');
    return;
  }
  exhibitArea.classList.remove('hidden');
  thanks.classList.add('hidden');
  exhibitBox.innerHTML = '';
  const img = new Image();
  img.src = `/api/artworks/${art.id}/image`;
  exhibitBox.appendChild(img);
  exhibitMeta.textContent = `${art.title} — ${art.author}`;
  likeBtn.disabled = false; // server enforces unique like; UI allows clicking each time per artwork
}

likeBtn.addEventListener('click', async () => {
  const art = exhibitOrder[exhibitIndex];
  const user = getVisitorName();
  if (!art || !user) return;
  try {
    await fetch('/api/likes', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ username: user, artworkId: art.id })
    });
    likeBtn.disabled = true;
  } catch (e) { /* ignore */ }
});

nextBtn.addEventListener('click', () => {
  exhibitIndex++;
  if (exhibitIndex >= exhibitOrder.length) {
    exhibitArea.classList.add('hidden');
    thanks.classList.remove('hidden');
  } else {
    renderCurrentArtwork();
  }
});

// ----- Likes + Ranking (admin) -----
const likesTable = document.getElementById('likesTable');
const rankingOl = document.getElementById('ranking');
const rankingEmpty = document.getElementById('rankingEmpty');

async function loadLikesAndRanking() {
  if (!ADMIN_TOKEN) return;
  // likes
  const likesRes = await fetch('/api/likes', {
    headers: { 'Authorization': `Bearer ${ADMIN_TOKEN}` }
  });
  const likes = await likesRes.json();
  likesTable.innerHTML = likes.map(x => {
    const d = new Date(x.created_at);
    const z = (n)=> String(n).padStart(2,'0');
    const t = `${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())} ${z(d.getHours())}:${z(d.getMinutes())}`;
    return `<tr><td>${t}</td><td>${escapeHtml(x.username)}</td><td>${escapeHtml(x.artwork_title)}</td></tr>`;
  }).join('') || `<tr><td colspan="3" class="muted">履歴がありません</td></tr>`;

  // ranking
  const rankRes = await fetch('/api/ranking', { headers: { 'Authorization': `Bearer ${ADMIN_TOKEN}` } });
  const rank = await rankRes.json();
  rankingOl.innerHTML = '';
  if (!rank.length) { rankingEmpty.textContent = '作品がありません。'; return; }
  if (rank.every(a => (a.like_count||0) === 0)) rankingEmpty.textContent = 'まだ「いいね」がありません。'; else rankingEmpty.textContent = '';
  for (const a of rank) {
    const li = document.createElement('li');
    li.innerHTML = `<strong>${escapeHtml(a.title)}</strong> <span class="muted">— ${escapeHtml(a.author)}</span> <span class="pill">いいね ${a.like_count||0}</span>`;
    rankingOl.appendChild(li);
  }
}

// ----- Register (admin) -----
const fileInput = document.getElementById('fileInput');
const titleInput = document.getElementById('titleInput');
const authorInput = document.getElementById('authorInput');
const addBtn = document.getElementById('addBtn');
const previewBox = document.getElementById('previewBox');
const artList = document.getElementById('artList');

fileInput?.addEventListener('change', () => {
  previewBox.innerHTML = '';
  const f = fileInput.files?.[0];
  if (!f) { previewBox.innerHTML = '<span class="muted">プレビュー</span>'; return; }
  const url = URL.createObjectURL(f);
  const img = new Image(); img.src = url; img.onload = () => URL.revokeObjectURL(url);
  previewBox.appendChild(img);
});

addBtn?.addEventListener('click', async () => {
  if (!ADMIN_TOKEN) return adminModal.showModal();
  const f = fileInput.files?.[0];
  const title = titleInput.value.trim();
  const author = authorInput.value.trim();
  if (!f) return alert('画像ファイルを選択してください');
  if (!title) return alert('題名を入力してください');
  if (!author) return alert('作者名を入力してください');
  const fd = new FormData();
  fd.append('image', f);
  fd.append('title', title);
  fd.append('author', author);
  const res = await fetch('/api/artworks', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${ADMIN_TOKEN}` },
    body: fd
  });
  if (!res.ok) return alert('登録に失敗しました（権限またはサーバーエラー）');
  fileInput.value = ''; titleInput.value=''; authorInput.value='';
  previewBox.innerHTML = '<span class="muted">登録しました。続けて追加できます。</span>';
  refreshArtList();
});

async function refreshArtList() {
  const arts = await fetchArtworks();
  if (!arts.length){ artList.innerHTML = '<div class="muted">まだ作品がありません</div>'; return; }
  artList.innerHTML = '';
  for (const a of arts) {
    const div = document.createElement('div');
    div.className = 'card';
    div.dataset.artId = String(a.id);
    div.innerHTML = `
      <div class="dragrow">
        <div class="imgbox" style="min-height:160px"><img src="/api/artworks/${a.id}/image" alt="${escapeHtml(a.title)}" /></div>
        <div><strong>${escapeHtml(a.title)}</strong><br><span class="muted">${escapeHtml(a.author)}</span></div>
        <div><span class="pill">いいね ${a.like_count||0}</span></div>
      </div>`;
    artList.appendChild(div);
  }
  enableDnD();
}

// Utility
function escapeHtml(s){ return (s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

// init
showTab('exhibit');

// ===== Admin edit/delete =====
const editModal = document.getElementById('editModal');
const editTitle = document.getElementById('editTitle');
const editAuthor = document.getElementById('editAuthor');
const editFile = document.getElementById('editFile');
const editPreview = document.getElementById('editPreview');
const editSaveBtn = document.getElementById('editSaveBtn');
const editMsg = document.getElementById('editMsg');
let editingId = null;

editFile?.addEventListener('change', () => {
  editPreview.innerHTML = '';
  const f = editFile.files?.[0];
  if (!f) { editPreview.innerHTML = '<span class="muted">現在の画像</span>'; return; }
  const url = URL.createObjectURL(f);
  const img = new Image(); img.src = url; img.onload = () => URL.revokeObjectURL(url);
  editPreview.appendChild(img);
});

editSaveBtn?.addEventListener('click', async () => {
  if (!ADMIN_TOKEN || !editingId) return;
  const title = editTitle.value.trim();
  const author = editAuthor.value.trim();
  if (!title) return alert('題名を入力してください');
  if (!author) return alert('作者名を入力してください');
  const fd = new FormData();
  fd.append('title', title);
  fd.append('author', author);
  const f = editFile.files?.[0];
  if (f) fd.append('image', f);
  const res = await fetch(`/api/artworks/${editingId}`, {
    method: 'PUT',
    headers: { 'Authorization': `Bearer ${ADMIN_TOKEN}` },
    body: fd
  });
  if (!res.ok) { editMsg.textContent = '保存に失敗しました'; return; }
  editMsg.textContent = '保存しました';
  editModal.close();
  refreshArtList();
});

async function onClickEdit(a) {
  editingId = a.id;
  editTitle.value = a.title;
  editAuthor.value = a.author;
  editFile.value = '';
  editPreview.innerHTML = `<img src="/api/artworks/${a.id}/image" style="max-width:100%; max-height:240px; object-fit:contain;" />`;
  editMsg.textContent = '';
  editModal.showModal();
}

async function onClickDelete(a) {
  if (!confirm(`「${a.title}」を削除しますか？（いいね履歴も同時に削除されます）`)) return;
  const res = await fetch(`/api/artworks/${a.id}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${ADMIN_TOKEN}` }
  });
  if (!res.ok) return alert('削除に失敗しました');
  refreshArtList();
}

// Override refreshArtList to include action buttons
const _refreshArtList_orig = refreshArtList;
refreshArtList = async function() {
  const arts = await fetchArtworks();
  if (!arts.length){ artList.innerHTML = '<div class="muted">まだ作品がありません</div>'; return; }
  artList.innerHTML = '';
  for (const a of arts) {
    const div = document.createElement('div');
    div.className = 'card';
    div.dataset.artId = String(a.id);
    div.innerHTML = `
      <div class="dragrow">
        <div class="imgbox" style="min-height:160px"><img src="/api/artworks/${a.id}/image" alt="${escapeHtml(a.title)}" /></div>
        <div><strong>${escapeHtml(a.title)}</strong><br><span class="muted">${escapeHtml(a.author)}</span></div>
        <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
          <span class="drag-handle">ドラッグで並び替え</span>
          <span class="pill">いいね ${a.like_count||0}</span>
          <button class="secondary" data-act="edit">編集</button>
          <button data-act="delete">削除</button>
        </div>
      </div>`;
    const [editBtn, delBtn] = [div.querySelector('button[data-act="edit"]'), div.querySelector('button[data-act="delete"]')];
    editBtn.addEventListener('click', () => onClickEdit(a));
    delBtn.addEventListener('click', () => onClickDelete(a));
    artList.appendChild(div);
  }
  enableDnD();
}


// ===== Drag & Drop ordering (admin) =====
let dragEl = null;

function enableDnD() {
  if (!ADMIN_TOKEN) return; // admin only
  [...artList.children].forEach(card => {
    card.setAttribute('draggable', 'true');
    card.addEventListener('dragstart', (e) => {
      dragEl = card;
      card.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    card.addEventListener('dragend', async () => {
      card.classList.remove('dragging');
      dragEl = null;
      await saveOrderToServer();
    });
    card.addEventListener('dragover', (e) => {
      e.preventDefault();
      const target = card;
      if (!dragEl || dragEl === target) return;
      target.classList.add('drop-target');
      const rect = target.getBoundingClientRect();
      const before = (e.clientY - rect.top) < rect.height / 2;
      if (before) target.parentNode.insertBefore(dragEl, target);
      else target.parentNode.insertBefore(dragEl, target.nextSibling);
    });
    card.addEventListener('dragleave', () => card.classList.remove('drop-target'));
    card.addEventListener('drop', (e) => {
      e.preventDefault();
      card.classList.remove('drop-target');
    });
  });
}

async function saveOrderToServer() {
  const ids = [...artList.children].map(c => Number(c.dataset.artId)).filter(Boolean);
  if (!ids.length) return;
  await fetch('/api/artworks/order', {
    method: 'PUT',
    headers: {
      'Content-Type':'application/json',
      'Authorization': `Bearer ${ADMIN_TOKEN}`
    },
    body: JSON.stringify({ ids })
  });
}

