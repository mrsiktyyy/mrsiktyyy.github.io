// config → utils → store (cookies) → services → views → player
const config = {
  songsDir: "songs/", coversDir: "covers/", iconsDir: "icons/",
  cookies: { history: "mc_history", likes: "mc_likes" }, historyMax: 30,
};
const GLYPH = { play:"▶", pause:"⏸", next:"⏭", prev:"⏮", shuffle:"⤮", repeat:"⟲", like:"♡", "like-on":"♥", home:"⌂", explore:"◎", library:"▤", search:"⌕", queue:"☰", menu:"≡", logo:"●" };

const utils = {
  $: (id) => document.getElementById(id),
  fmt(s) { if (!isFinite(s)) return "0:00"; return Math.floor(s / 60) + ":" + String(Math.floor(s % 60)).padStart(2, "0"); },
  hue(s) { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 360; return h; },
  getCookie(n) { const m = document.cookie.split("; ").find((c) => c.startsWith(n + "=")); try { return m ? JSON.parse(decodeURIComponent(m.split("=")[1])) : null; } catch { return null; } },
  setCookie(n, v) { document.cookie = `${n}=${encodeURIComponent(JSON.stringify(v))}; max-age=31536000; path=/; SameSite=Lax`; },
  icon(name) {
    const s = document.createElement("span"); s.className = "ic"; s.textContent = GLYPH[name] || "";
    const i = new Image(); i.alt = ""; i.onload = () => s.replaceChildren(i); i.src = config.iconsDir + name + ".svg"; return s;
  },
  setIc(btn, name) { btn.replaceChildren(utils.icon(name)); },
  paintCover(el, t, file) {
    const h = utils.hue(t.title || t.id);
    el.style.setProperty("--c1", `hsl(${h} 80% 55%)`); el.style.setProperty("--c2", `hsl(${(h + 60) % 360} 70% 18%)`);
    if (file) { const i = new Image(); i.onload = () => el.style.backgroundImage = `url("${i.src}")`; i.src = encodeURI(config.coversDir + file); }
  },
  h(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; },
};
const { $, h } = utils;

const store = {
  history: utils.getCookie(config.cookies.history) || [],
  likes: utils.getCookie(config.cookies.likes) || [],
  pushHistory(id) { this.history = [id, ...this.history.filter((x) => x !== id)].slice(0, config.historyMax); utils.setCookie(config.cookies.history, this.history); },
  toggleLike(id) { this.likes = this.likes.includes(id) ? this.likes.filter((x) => x !== id) : [id, ...this.likes]; utils.setCookie(config.cookies.likes, this.likes); },
};

const S = { tracks: [], playlists: [], queue: [], i: -1, shuffle: false, repeat: false, dur: {} };
const audio = $("audio");
const byId = (id) => S.tracks.find((t) => t.id === id);
const cur = () => S.queue[S.i];

function allPlaylists() {
  return [
    ...S.playlists.map((p) => ({ ...p, tracks: p.ids.map(byId).filter(Boolean) })),
    { id: "liked", title: "Понравившаяся музыка", tracks: store.likes.map(byId).filter(Boolean) },
    { id: "recent", title: "Недавно слушали", tracks: store.history.map(byId).filter(Boolean) },
  ];
}

// ---------- UI-блоки ----------
function card(t, list) {
  const c = h("div", "card"); const cv = h("div", "cover"); utils.paintCover(cv, t, t.cover);
  c.append(cv, h("b", "", t.title), h("span", "", t.artist));
  c.onclick = () => play(list, list.indexOf(t)); return c;
}
function row(t, list) {
  const r = h("div", "row" + (cur() === t ? " cur" : "")); r.tabIndex = 0;
  const cv = h("div", "cover"); utils.paintCover(cv, t, t.cover);
  const i = h("div", "i"); i.append(h("b", "", t.title), h("span", "", t.artist));
  r.append(cv, i, h("span", "d", S.dur[t.id] ? utils.fmt(S.dur[t.id]) : ""));
  r.onclick = () => play(list, list.indexOf(t)); r.onkeydown = (e) => e.key === "Enter" && r.click(); return r;
}
function shelf(title, tracks, asRows) {
  const f = document.createDocumentFragment(); f.append(h("h2", "", title));
  if (!tracks.length) { f.append(h("p", "empty", "Пока пусто. Включите любую песню — она появится здесь.")); return f; }
  const box = h("div", asRows ? "rows" : "shelf");
  tracks.forEach((t) => box.append(asRows ? row(t, tracks) : card(t, tracks))); f.append(box); return f;
}

// ---------- Экраны ----------
const views = {
  home() {
    const v = document.createDocumentFragment(), hist = store.history.map(byId).filter(Boolean);
    const unplayed = S.tracks.filter((t) => !store.history.includes(t.id));
    const rest = S.tracks.filter((t) => store.history.includes(t.id)).sort(() => Math.random() - .5);
    const longAgo = hist.slice(2).reverse();
    v.append(shelf("Послушать ещё раз", hist.slice(0, 10)));
    if (longAgo.length) v.append(shelf("Вы давно не слушали", longAgo));
    v.append(shelf("Рекомендации для вас", [...unplayed, ...rest], true));
    v.append(shelf("Новые релизы", [...S.tracks].sort((a, b) => b.date.localeCompare(a.date))));
    return v;
  },
  explore() { const v = document.createDocumentFragment(); v.append(shelf("Все треки", S.tracks, true)); return v; },
  library() {
    const v = document.createDocumentFragment(); v.append(h("h2", "", "Библиотека")); const box = h("div", "shelf");
    allPlaylists().forEach((p) => {
      const c = h("div", "card"), cv = h("div", "cover"); utils.paintCover(cv, { title: p.title }, `pl-${p.id}.jpg`);
      c.append(cv, h("b", "", p.title), h("span", "", `${p.tracks.length} треков`)); c.onclick = () => (location.hash = "#playlist/" + p.id); box.append(c);
    }); v.append(box); return v;
  },
  playlist(id) {
    const p = allPlaylists().find((x) => x.id === id); const v = document.createDocumentFragment();
    if (!p) { v.append(h("p", "empty", "Плейлист не найден.")); return v; }
    const head = h("div", "ph"), cv = h("div", "cover"); utils.paintCover(cv, { title: p.title }, `pl-${p.id}.jpg`);
    const total = p.tracks.reduce((s, t) => s + (S.dur[t.id] || 0), 0);
    const acts = h("div", "acts"), b1 = h("button", "ib"), b2 = h("button", "ib");
    utils.setIc(b1, "play"); utils.setIc(b2, "shuffle");
    b1.onclick = () => p.tracks.length && play(p.tracks, 0); b2.onclick = () => { if (!p.tracks.length) return; setShuffle(true); play(p.tracks, Math.floor(Math.random() * p.tracks.length)); };
    acts.append(b1, b2);
    head.append(cv, h("h1", "", p.title), h("span", "sub", `Плейлист · ${p.tracks.length} треков${total ? " · " + Math.round(total / 60) + " мин" : ""}`), acts);
    v.append(head);
    if (!p.tracks.length) v.append(h("p", "empty", "Здесь пока нет треков."));
    else { const box = h("div", "rows"); p.tracks.forEach((t) => box.append(row(t, p.tracks))); v.append(box); }
    return v;
  },
  search(q) {
    const v = document.createDocumentFragment(), res = S.tracks.filter((t) => (t.title + " " + t.artist).toLowerCase().includes(q));
    v.append(h("h2", "", `Результаты: «${q}»`));
    if (!res.length) v.append(h("p", "empty", "Ничего не найдено. Проверьте название или попробуйте другое.")); else { const b = h("div", "rows"); res.forEach((t) => b.append(row(t, res))); v.append(b); }
    return v;
  },
};

function route() {
  const [name, arg] = (location.hash.slice(1) || "home").split("/");
  const view = views[name] ? name : "home";
  $("view").replaceChildren(views[view](arg));
  document.querySelectorAll("[data-r]").forEach((a) => a.classList.toggle("on", a.dataset.r === view));
  $("side").classList.remove("open"); window.scrollTo(0, 0);
}
function renderSide() {
  const box = $("sidePl"); box.replaceChildren();
  allPlaylists().forEach((p) => { const a = h("a", "pl"); a.href = "#playlist/" + p.id; a.append(h("span", "", p.title), h("small", "", `${p.tracks.length} треков`)); box.append(a); });
}
function renderQueue() {
  const q = $("qlist"); q.replaceChildren(); S.queue.forEach((t) => q.append(row(t, S.queue)));
}

// ---------- Плеер ----------
function play(list, i) {
  S.queue = list; S.i = i; const t = cur(); if (!t) return;
  audio.src = encodeURI(config.songsDir + t.file);
  audio.play().catch(fail);
  store.pushHistory(t.id);
  $("nowTitle").textContent = t.title; $("nowArtist").textContent = t.artist;
  utils.paintCover($("nowCover"), t, t.cover); document.title = `${t.title} — Music`;
  if ("mediaSession" in navigator) navigator.mediaSession.metadata = new MediaMetadata({ title: t.title, artist: t.artist });
  syncLike(); renderQueue(); renderSide();
  document.querySelectorAll(".row").forEach((r) => r.classList.remove("cur"));
}
const fail = () => ($("nowArtist").textContent = "Файл не найден в папке songs/");
function step(d) {
  if (!S.queue.length) return;
  if (S.shuffle && S.queue.length > 1) { let n; do n = Math.floor(Math.random() * S.queue.length); while (n === S.i); return play(S.queue, n); }
  play(S.queue, (S.i + d + S.queue.length) % S.queue.length);
}
const toggle = () => (S.i < 0 ? play(S.tracks, 0) : audio.paused ? audio.play() : audio.pause());
function setShuffle(on) { S.shuffle = on; $("shuffle").classList.toggle("on", on); }
function syncLike() { const on = cur() && store.likes.includes(cur().id); utils.setIc($("like"), on ? "like-on" : "like"); $("like").classList.toggle("on", !!on); }
const rng = (el) => el.style.setProperty("--p", (el.value / el.max) * 100 + "%");

audio.onplay = () => utils.setIc($("play"), "pause");
audio.onpause = () => utils.setIc($("play"), "play");
audio.onerror = fail;
audio.ontimeupdate = () => {
  if (audio.duration) { $("seek").value = (audio.currentTime / audio.duration) * 1000; rng($("seek")); }
  $("time").textContent = `${utils.fmt(audio.currentTime)} / ${utils.fmt(audio.duration)}`;
};
audio.onended = () => (S.repeat ? (audio.currentTime = 0, audio.play()) : step(1));
$("seek").oninput = (e) => { if (audio.duration) audio.currentTime = (e.target.value / 1000) * audio.duration; rng(e.target); };
$("vol").oninput = (e) => { audio.volume = e.target.value / 100; rng(e.target); };
$("play").onclick = toggle; $("next").onclick = () => step(1);
$("prev").onclick = () => (audio.currentTime > 3 ? (audio.currentTime = 0) : step(-1));
$("shuffle").onclick = () => setShuffle(!S.shuffle);
$("repeat").onclick = (e) => { S.repeat = !S.repeat; e.currentTarget.classList.toggle("on", S.repeat); };
$("like").onclick = () => { if (cur()) { store.toggleLike(cur().id); syncLike(); renderSide(); } };
$("qbtn").onclick = () => ($("queue").hidden = !$("queue").hidden);
$("qclose").onclick = () => ($("queue").hidden = true);
$("menu").onclick = () => $("side").classList.toggle("open");
$("search").oninput = (e) => { const q = e.target.value.trim().toLowerCase(); q ? $("view").replaceChildren(views.search(q)) : route(); };
document.addEventListener("keydown", (e) => { if (e.target.tagName === "INPUT") return; if (e.code === "Space") { e.preventDefault(); toggle(); } });
if ("mediaSession" in navigator) { const m = navigator.mediaSession; m.setActionHandler("play", toggle); m.setActionHandler("pause", toggle); m.setActionHandler("nexttrack", () => step(1)); m.setActionHandler("previoustrack", () => step(-1)); }
window.addEventListener("hashchange", route);

// ---------- Старт ----------
(async function init() {
  document.querySelectorAll("[data-ic]").forEach((el) => el.replaceChildren(utils.icon(el.dataset.ic)));
  audio.volume = 0.8; rng($("vol")); rng($("seek"));
  try {
    const data = await (await fetch("tracks.json")).json();
    S.tracks = data.tracks; S.playlists = data.playlists || [];
  } catch { $("view").textContent = "Не удалось загрузить tracks.json"; return; }
  renderSide(); route();
  S.tracks.forEach((t) => { const a = new Audio(); a.preload = "metadata"; a.src = encodeURI(config.songsDir + t.file); a.onloadedmetadata = () => { S.dur[t.id] = a.duration; }; });
})();
