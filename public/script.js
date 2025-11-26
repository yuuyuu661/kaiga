// ===============================
//  初期設定
// ===============================
let paintings = [];
let idx = 0;
let userName = localStorage.getItem("kaiga_user") || "";
let isAdmin = false;

// ===============================
//  初回ニックネーム入力モーダル
// ===============================
window.addEventListener("load", () => {
  if (!userName) {
    const name = prompt("ニックネームを入力してください");
    if (!name) {
      alert("ニックネームは必須です！");
      location.reload();
      return;
    }
    userName = name;
    localStorage.setItem("kaiga_user", userName);
  }

  loadPaintings();
});

// ===============================
//  管理ログイン
// ===============================
async function adminLogin() {
  const pass = document.getElementById("adminPass").value;
  const res = await fetch("/api/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: pass })
  });

  if (!res.ok) return alert("パスワードが違います");

  isAdmin = true;
  document.querySelectorAll(".locked").forEach(btn => {
    btn.classList.remove("locked");
  });

  alert("管理者ログイン成功！");
}

// ===============================
//  タブ切り替え
// ===============================
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");

    document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("show"));
    document.getElementById(btn.dataset.tab).classList.add("show");

    if (btn.dataset.tab === "rank") loadRanking();
    if (btn.dataset.tab === "list") loadList();
    if (btn.dataset.tab === "log") loadLikeLog();
  });
});

// ===============================
//  作品データ読み込み
// ===============================
async function loadPaintings() {
  const res = await fetch("/api/paintings");
  paintings = await res.json();

  if (paintings.length === 0) {
    document.getElementById("author").innerText = "まだ作品がありません";
    return;
  }

  idx = 0;
  showPainting();
}

// ===============================
//  絵画表示
// ===============================
function showPainting() {
  const p = paintings[idx];
  if (!p) return;

  document.getElementById("painting").src = p.imagePath;
  document.getElementById("author").innerText = p.author;

  const likeBtn = document.getElementById("likeBtn");
  likeBtn.disabled = false;
  likeBtn.innerText = "❤️ いいね";
  likeBtn.style.background = "#fff";
}

// ===============================
//  いいね
// ===============================
async function like() {
  const p = paintings[idx];

  const res = await fetch("/api/like", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      paintingId: p.id,
      userName: userName
    })
  });

  const json = await res.json();

  if (!json.ok) {
    alert("この作品はすでにいいね済みです！");
    return;
  }

  const likeBtn = document.getElementById("likeBtn");
  likeBtn.style.background = "lightgreen";
  likeBtn.disabled = true;
  likeBtn.innerText = "ありがとう！";
}

// ===============================
//  次へ
// ===============================
function next() {
  idx++;

  if (idx >= paintings.length) {
    document.getElementById("painting").src = "thanks.png";
    document.getElementById("author").innerText = "ご来場ありがとうございます！";
    document.getElementById("likeBtn").style.display = "none";
    return;
  }

  document.getElementById("likeBtn").style.display = "inline-block";
  showPainting();
}

// ===============================
//  作品一覧（編集/削除）
// ===============================
async function loadList() {
  const res = await fetch("/api/paintings");
  const data = await res.json();

  const box = document.getElementById("list");
  box.innerHTML = data
    .map(
      p => `
      <div class="list-item">
        <img src="${p.imagePath}" class="list-img">
        <div>
          <div><b>${p.order}. ${p.author}</b></div>
          <button onclick="editPainting('${p.id}')">編集</button>
          <button onclick="deletePainting('${p.id}')">削除</button>
        </div>
      </div>
      <hr>
    `
    )
    .join("");
}

async function editPainting(id) {
  const author = prompt("作者名を入力");
  const order = prompt("掲示順");

  const fd = new FormData();
  fd.append("author", author);
  fd.append("order", order);

  await fetch("/api/admin/paintings/" + id, {
    method: "PUT",
    body: fd
  });

  loadList();
}

async function deletePainting(id) {
  if (!confirm("削除しますか？")) return;

  await fetch("/api/admin/paintings/" + id, { method: "DELETE" });
  loadList();
}

// ===============================
//  いいねランキング（上位10位）
// ===============================
async function loadRanking() {
  const res = await fetch("/api/admin/likes/ranking");
  let data = await res.json();
  data = data.slice(0, 10);

  document.getElementById("rank").innerHTML = data
    .map(p => `<div>${p.order}. ${p.author}（${p.likes} いいね）</div>`)
    .join("");
}

// ===============================
//  いいねログ（作品・ユーザー・時間）
// ===============================
async function loadLikeLog() {
  const res = await fetch("/api/admin/likes/log");
  const log = await res.json();

  document.getElementById("log").innerHTML = `
    <h3>作品ごと</h3>
    ${log.byPainting}

    <h3>ユーザーごと</h3>
    ${log.byUser}

    <h3>時間順</h3>
    ${log.byTime}
  `;
}
