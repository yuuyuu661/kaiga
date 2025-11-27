//----------------------------------------------------
// みんなの絵画展（画像のみ登録版） 完全対応 script.js
//----------------------------------------------------

let ADMIN_TOKEN = sessionStorage.getItem("adminToken") || "";

/* ---------------- Tabs ---------------- */
const tabsEl = document.getElementById("tabs");
const panels = {
  exhibit: document.getElementById("panel-exhibit"),
  likes: document.getElementById("panel-likes"),
  register: document.getElementById("panel-register"),
};

tabsEl.addEventListener("click", (e) => {
  const btn = e.target.closest(".tab");
  if (!btn) return;
  if (btn.dataset.protected === "true" && !ADMIN_TOKEN) {
    adminModal.showModal();
    return;
  }
  showTab(btn.dataset.tab);
});

function showTab(name) {
  [...tabsEl.querySelectorAll(".tab")].forEach((t) =>
    t.classList.toggle("active", t.dataset.tab === name)
  );
  Object.entries(panels).forEach(([k, el]) =>
    el.classList.toggle("hidden", k !== name)
  );

  if (name === "exhibit") startExhibit();
  if (name === "likes") loadLikesAndRanking();
  if (name === "register") refreshArtList();
}

/* ---------------- Visitor Name ---------------- */
const nameModal = document.getElementById("nameModal");
const nameInput = document.getElementById("nameInput");
const visitorNameDisp = document.getElementById("visitorNameDisp");

function getVisitorName() {
  return localStorage.getItem("visitorName") || "";
}
function setVisitorName(n) {
  localStorage.setItem("visitorName", n);
  visitorNameDisp.textContent = n || "未設定";
}

document.getElementById("saveNameBtn").onclick = () => {
  const n = nameInput.value.trim();
  if (!n) return alert("お名前を入力してください");
  if (!getVisitorName()) {
    setVisitorName(n);
    nameModal.close();
  } else {
    alert("名前は変更できません");
  }
};

(function initName() {
  const n = getVisitorName();
  setVisitorName(n);
  if (!n) nameModal.showModal();
})();

/* ---------------- Admin Login ---------------- */
const adminModal = document.getElementById("adminModal");
document.getElementById("adminLoginBtn").onclick = () => {
  adminPassInput.value = "";
  adminLoginMsg.textContent = "";
  adminModal.showModal();
};

document.getElementById("adminLoginDoBtn").onclick = async () => {
  const pw = adminPassInput.value;
  try {
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: pw }),
    });
    if (!res.ok) throw 0;
    const data = await res.json();
    ADMIN_TOKEN = data.token;
    sessionStorage.setItem("adminToken", ADMIN_TOKEN);
    adminModal.close();
  } catch {
    adminLoginMsg.textContent = "ログイン失敗";
  }
};

/* ---------------- Exhibit ---------------- */
const exhibitBox = document.getElementById("exhibitBox");
const likeBtn = document.getElementById("likeBtn");
const nextBtn = document.getElementById("nextBtn");
const thanks = document.getElementById("thanks");
const exhibitArea = document.getElementById("exhibitArea");

let exhibitOrder = [];
let exhibitIndex = 0;

async function fetchArtworks() {
  const res = await fetch("/api/artworks");
  return await res.json();
}

async function startExhibit() {
  exhibitOrder = await fetchArtworks();
  exhibitIndex = 0;
  renderCurrentArtwork();
}

function renderCurrentArtwork() {
  const art = exhibitOrder[exhibitIndex];

  if (!art) {
    exhibitArea.classList.add("hidden");
    thanks.classList.remove("hidden");
    return;
  }

  exhibitArea.classList.remove("hidden");
  thanks.classList.add("hidden");

  exhibitBox.innerHTML = `<img src="/api/artworks/${art.id}/image">`;
  likeBtn.disabled = false;
}

likeBtn.onclick = async () => {
  const art = exhibitOrder[exhibitIndex];
  const user = getVisitorName();
  if (!art || !user) return;

  await fetch("/api/likes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: user, artworkId: art.id }),
  });

  likeBtn.disabled = true;
};

nextBtn.onclick = () => {
  exhibitIndex++;
  renderCurrentArtwork();
};

/* ---------------- Likes / Ranking ---------------- */
const likesTable = document.getElementById("likesTable");
const rankingOl = document.getElementById("ranking");
const rankingEmpty = document.getElementById("rankingEmpty");

async function loadLikesAndRanking() {
  if (!ADMIN_TOKEN) return;

  const likes = await (await fetch("/api/likes", {
    headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
  })).json();

  likesTable.innerHTML =
    likes
      .map((x) => {
        const d = new Date(x.created_at);
        return `<tr><td>${d.toLocaleString()}</td><td>${escapeHtml(
          x.username
        )}</td><td>作品 #${x.artwork_id}</td></tr>`;
      })
      .join("") || `<tr><td colspan="3">履歴なし</td></tr>`;

  const rank = await (await fetch("/api/ranking", {
    headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
  })).json();

  rankingOl.innerHTML = "";
  for (const a of rank) {
    rankingOl.innerHTML += `<li>作品 #${a.id} <span class="pill">いいね ${a.like_count}</span></li>`;
  }
}

/* ---------------- Register ---------------- */
const fileInput = document.getElementById("fileInput");
const previewBox = document.getElementById("previewBox");
const addBtn = document.getElementById("addBtn");
const artList = document.getElementById("artList");

fileInput.onchange = () => {
  previewBox.innerHTML = "";
  const f = fileInput.files[0];
  if (!f) {
    previewBox.innerHTML = "<span class='muted'>プレビュー</span>";
    return;
  }
  const url = URL.createObjectURL(f);
  previewBox.innerHTML = `<img src="${url}">`;
};

addBtn.onclick = async () => {
  if (!ADMIN_TOKEN) return adminModal.showModal();
  const f = fileInput.files[0];
  if (!f) return alert("画像ファイルを選択してください");

  const fd = new FormData();
  fd.append("image", f);

  const res = await fetch("/api/artworks", {
    method: "POST",
    headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
    body: fd,
  });

  if (!res.ok) return alert("登録失敗");

  fileInput.value = "";
  previewBox.innerHTML = "<span class='muted'>登録しました</span>";
  refreshArtList();
};

async function refreshArtList() {
  const arts = await fetchArtworks();
  artList.innerHTML = "";

  for (const a of arts) {
    const div = document.createElement("div");
    div.className = "card";
    div.dataset.artId = a.id;

    div.innerHTML = `
      <div class="dragrow">
        <div class="imgbox"><img src="/api/artworks/${a.id}/image"></div>

        <div style="display:flex; justify-content:space-between; margin-top:8px;">
          <strong>作品 #${a.id}</strong>
          <div style="display:flex; gap:8px;">
            <span class="drag-handle">⋮⋮</span>
            <span class="pill">いいね ${a.like_count}</span>
            <button data-edit>編集</button>
            <button data-del>削除</button>
          </div>
        </div>
      </div>`;

    div.querySelector("[data-edit]").onclick = () => onEdit(a);
    div.querySelector("[data-del]").onclick = () => onDelete(a);

    artList.appendChild(div);
  }

  enableDnD();
}

/* ---------------- Edit ---------------- */
const editModal = document.getElementById("editModal");
const editFile = document.getElementById("editFile");
const editPreview = document.getElementById("editPreview");
const editSaveBtn = document.getElementById("editSaveBtn");

let editingId = null;

function onEdit(a) {
  editingId = a.id;
  editPreview.innerHTML = `<img src="/api/artworks/${a.id}/image">`;
  editModal.showModal();
}

editFile.onchange = () => {
  editPreview.innerHTML = "";
  const f = editFile.files[0];
  if (!f) {
    editPreview.innerHTML = "<span class='muted'>現在の画像</span>";
    return;
  }
  const url = URL.createObjectURL(f);
  editPreview.innerHTML = `<img src="${url}">`;
};

editSaveBtn.onclick = async () => {
  const f = editFile.files[0];
  if (!f) return alert("差し替え画像を選択してください");

  const fd = new FormData();
  fd.append("image", f);

  await fetch(`/api/artworks/${editingId}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
    body: fd,
  });

  editModal.close();
  refreshArtList();
};

/* ---------------- Delete ---------------- */
async function onDelete(a) {
  if (!confirm(`作品 #${a.id} を削除しますか？`)) return;

  await fetch(`/api/artworks/${a.id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
  });

  refreshArtList();
}

/* ---------------- Drag & Drop ---------------- */
function enableDnD() {
  [...artList.children].forEach((card) => {
    card.draggable = true;

    card.addEventListener("dragstart", () => {
      card.classList.add("dragging");
    });

    card.addEventListener("dragend", async () => {
      card.classList.remove("dragging");

      const ids = [...artList.children].map((c) => Number(c.dataset.artId));
      await fetch("/api/artworks/order", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ADMIN_TOKEN}`,
        },
        body: JSON.stringify({ ids }),
      });
    });

    card.addEventListener("dragover", (e) => {
      e.preventDefault();
      const dragging = artList.querySelector(".dragging");
      const rect = card.getBoundingClientRect();
      const before = e.clientY < rect.top + rect.height / 2;
      if (before) artList.insertBefore(dragging, card);
      else artList.insertBefore(dragging, card.nextSibling);
    });
  });
}

/* ---------------- Utility ---------------- */
function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}

/* ---------------- Init ---------------- */
showTab("exhibit");
