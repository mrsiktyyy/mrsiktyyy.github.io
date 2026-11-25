// Архитектура (аналог backend-структуры, но статично для GitHub Pages):
// config → services (данные) → utils → UI/контроллер плеера.
const config = { tracksUrl: "tracks.json", storageKey: "music-state" };

const utils = {
  fmt(s) { if (!isFinite(s)) return "0:00"; const m = Math.floor(s / 60); return m + ":" + String(Math.floor(s % 60)).padStart(2, "0"); },
  src(file) { return encodeURI(file); }, // кириллица в именах файлов
  hue(str) { let h = 0; for (const c of str) h = (h * 31 + c.charCodeAt(0)) % 360; return h; },
  paintCover(el, t) { const h = utils.hue(t.title); el.style.setProperty("--c1", `hsl(${h} 80% 55%)`); el.style.setProperty("--c2", `hsl(${(h + 60) % 360} 70% 20%)`); },
  $: (id) => document.getElementById(id),
};

const trackService = {
  async load() {
    const r = await fetch(config.tracksUrl);
    if (!r.ok) throw new Error("Не удалось загрузить tracks.json");
    return (await r.json()).tracks;
  },
};

const $ = utils.$, audio = $("audio");
const S = { tracks: [], view: [], cur: -1, shuffle: false, repeat: false, order: [] };

function renderList() {
  const list = $("list"); list.innerHTML = "";
  S.view.forEach((t, i) => {
    const li = document.createElement("li");
    li.className = "item" + (S.tracks[S.cur] === t ? " active" : "");
    li.tabIndex = 0;
    li.innerHTML = `<span class="idx">${i + 1}</span><div class="cover"></div>
      <div class="info"><div class="t"></div><div class="a"></div></div><span class="d">${t.dur ? utils.fmt(t.dur) : ""}</span>`;
    li.querySelector(".t").textContent = t.title;
    li.querySelector(".a").textContent = t.artist;
    utils.paintCover(li.querySelector(".cover"), t);
    li.onclick = () => playTrack(S.tracks.indexOf(t));
    li.onkeydown = (e) => { if (e.key === "Enter") li.click(); };
    list.appendChild(li);
  });
  $("empty").hidden = S.view.length > 0;
  $("count").textContent = `${S.tracks.length} песен`;
}

function playTrack(i) {
  if (i < 0 || i >= S.tracks.length) return;
  S.cur = i; const t = S.tracks[i];
  audio.src = utils.src(t.file);
  audio.play().catch(showError);
  $("nowTitle").textContent = t.title; $("nowArtist").textContent = t.artist;
  utils.paintCover($("nowCover"), t); utils.paintCover($("heroCover"), t);
  document.title = `${t.title} — Music`;
  if ("mediaSession" in navigator) navigator.mediaSession.metadata = new MediaMetadata({ title: t.title, artist: t.artist });
  renderList();
}

function showError() { $("nowArtist").textContent = "Файл не найден или не воспроизводится"; }

function step(dir) {
  if (!S.tracks.length) return;
  if (S.shuffle && dir > 0) {
    let n; do { n = Math.floor(Math.random() * S.tracks.length); } while (n === S.cur && S.tracks.length > 1);
    return playTrack(n);
  }
  playTrack((S.cur + dir + S.tracks.length) % S.tracks.length);
}

function togglePlay() { if (S.cur < 0) return playTrack(0); audio.paused ? audio.play() : audio.pause(); }

function setRange(el) { el.style.setProperty("--p", (el.value / el.max) * 100 + "%"); }

audio.addEventListener("play", () => $("play").textContent = "⏸");
audio.addEventListener("pause", () => $("play").textContent = "▶");
audio.addEventListener("error", showError);
audio.addEventListener("loadedmetadata", () => { const t = S.tracks[S.cur]; if (t) { t.dur = audio.duration; renderList(); } });
audio.addEventListener("timeupdate", () => {
  if (audio.duration) { $("seek").value = (audio.currentTime / audio.duration) * 1000; setRange($("seek")); }
  $("time").textContent = `${utils.fmt(audio.currentTime)} / ${utils.fmt(audio.duration)}`;
});
audio.addEventListener("ended", () => { if (S.repeat) { audio.currentTime = 0; audio.play(); } else step(1); });

$("seek").oninput = (e) => { if (audio.duration) audio.currentTime = (e.target.value / 1000) * audio.duration; setRange(e.target); };
$("vol").oninput = (e) => { audio.volume = e.target.value / 100; setRange(e.target); };
$("play").onclick = togglePlay;
$("next").onclick = () => step(1);
$("prev").onclick = () => audio.currentTime > 3 ? (audio.currentTime = 0) : step(-1);
$("shuffle").onclick = (e) => { S.shuffle = !S.shuffle; e.currentTarget.setAttribute("aria-pressed", S.shuffle); };
$("repeat").onclick = (e) => { S.repeat = !S.repeat; e.currentTarget.setAttribute("aria-pressed", S.repeat); };
$("playAll").onclick = () => playTrack(0);
$("shuffleAll").onclick = () => { S.shuffle = true; $("shuffle").setAttribute("aria-pressed", true); playTrack(Math.floor(Math.random() * S.tracks.length)); };
$("search").oninput = (e) => {
  const q = e.target.value.trim().toLowerCase();
  S.view = S.tracks.filter((t) => (t.title + " " + t.artist).toLowerCase().includes(q));
  renderList();
};
document.addEventListener("keydown", (e) => {
  if (e.target.tagName === "INPUT" && e.target.type === "search") return;
  if (e.code === "Space") { e.preventDefault(); togglePlay(); }
  if (e.code === "ArrowRight" && e.shiftKey) step(1);
  if (e.code === "ArrowLeft" && e.shiftKey) step(-1);
});
if ("mediaSession" in navigator) {
  navigator.mediaSession.setActionHandler("play", togglePlay);
  navigator.mediaSession.setActionHandler("pause", togglePlay);
  navigator.mediaSession.setActionHandler("nexttrack", () => step(1));
  navigator.mediaSession.setActionHandler("previoustrack", () => step(-1));
}

(async function init() {
  audio.volume = 0.8; setRange($("vol")); setRange($("seek"));
  try { S.tracks = await trackService.load(); S.view = [...S.tracks]; renderList(); if (S.tracks[0]) utils.paintCover($("heroCover"), S.tracks[0]); }
  catch (e) { $("count").textContent = e.message; }
})();
