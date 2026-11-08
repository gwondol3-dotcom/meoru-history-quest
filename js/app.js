// =========================================================
//  머루반 역사 탐험대 — 진행 엔진
// =========================================================
const SAVE_KEY = "meoru_history_v1";
const SHEET_KEY = "meoru_sheet_url";
const RESULTS_KEY = "meoru_results";

const $ = (s, el = document) => el.querySelector(s);
const app = $("#app");
const nav = $("#nav");

const GRADED_TYPES = ["quiz", "multi", "order", "sort", "input"];
const GRADED = STEPS.filter(s => GRADED_TYPES.includes(s.type));
const BOSS = STEPS.filter(s => s.boss);
const starMax = st => st.type === "quiz" && st.ox ? 2 : (GRADED_TYPES.includes(st.type) || st.type === "write") ? 3 : 0;
const MAX_STARS = STEPS.reduce((s, st) => s + starMax(st), 0);
const MASCOT = IMG + "meoru.png";

let S = null;          // 현재 학생 상태
let soundOn = true;

// ---------------- 저장 ----------------
function newState(student) {
  return {
    sid: "M" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    student, step: 0, rec: {}, cards: [], combo: 0, maxCombo: 0, bonus: 0,
    startedAt: Date.now(), finishedAt: null, sent: null,
  };
}
function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) {} }
function load() { try { return JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { return null; } }
function sheetUrl() { try { return localStorage.getItem(SHEET_KEY) || ""; } catch (e) { return ""; } }

// 선생님이 보낸 링크(#sheet=주소)를 받아 기억해 둔다
(function readLink() {
  const m = (location.hash + "&" + location.search).match(/sheet=([^&]+)/);
  if (m) {
    try { localStorage.setItem(SHEET_KEY, decodeURIComponent(m[1])); } catch (e) {}
    history.replaceState(null, "", location.pathname);
  }
})();

// ---------------- 점수 ----------------
function totalStars() { return Object.values(S.rec).reduce((s, r) => s + (r.stars || 0), 0) + (S.bonus || 0); }
function rankName() {
  const pct = Math.min(100, totalStars() / MAX_STARS * 100);
  let n = RANKS[0].name;
  RANKS.forEach(r => { if (pct >= r.min) n = r.name; });
  return n;
}
function rec(id) { return S.rec[id] || (S.rec[id] = { tries: 0, stars: 0, done: false }); }
function finish(step, stars, extra = {}) {
  const r = rec(step.id);
  if (r.done) return;
  r.done = true;
  r.stars = Math.max(0, Math.min(starMax(step), stars));
  if (r.firstOk === undefined) r.firstOk = r.tries <= 1 && !(r.miss > 0);
  Object.assign(r, extra);
  if (r.stars > 0) floatText("+" + r.stars + "★");
  // 연속 정답 콤보
  if (GRADED_TYPES.includes(step.type)) {
    if (r.firstOk) {
      S.combo++; S.maxCombo = Math.max(S.maxCombo, S.combo);
      if (S.combo % 3 === 0) { S.bonus++; setTimeout(() => { toast(`🔥 ${S.combo}연속 정답! 콤보 보너스 +1★`); sfx.combo(); }, 500); }
    } else S.combo = 0;
  }
  if (step.boss) hitBoss();
  save(); drawTop(); enableNext(true);
}

// ---------------- 소리 ----------------
let actx = null;
function beep(notes) {
  if (!soundOn) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    let t = actx.currentTime;
    notes.forEach(([f, d, type]) => {
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = type || "triangle"; o.frequency.value = f;
      g.gain.setValueAtTime(.18, t); g.gain.exponentialRampToValueAtTime(.001, t + d);
      o.connect(g).connect(actx.destination); o.start(t); o.stop(t + d); t += d * .8;
    });
  } catch (e) {}
}
const sfx = {
  ok: () => beep([[660, .12], [880, .2]]),
  bad: () => beep([[200, .25, "sawtooth"]]),
  win: () => beep([[523, .12], [659, .12], [784, .12], [1047, .35]]),
  combo: () => beep([[784, .08], [988, .08], [1175, .08], [1568, .25]]),
  hit: () => beep([[150, .1, "square"], [90, .25, "sawtooth"]]),
  tap: () => beep([[520, .05]]),
};

// ---------------- 공통 화면 요소 ----------------
function img(src, cls = "", alt = "") {
  return `<img class="${cls}" src="${src}" alt="${alt}" onerror="this.style.display='none'">`;
}
function shuffle(a, seed) {
  const r = a.slice(); let s = seed || 7;
  for (let i = r.length - 1; i > 0; i--) { s = (s * 9301 + 49297) % 233280; const j = Math.floor(s / 233280 * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; }
  return r;
}
function seedOf(str) { let h = 0; for (const c of str) h = (h * 31 + c.charCodeAt(0)) % 100000; return h + 1; }
function toast(msg) {
  const t = document.createElement("div"); t.className = "toast"; t.innerHTML = msg;
  document.body.appendChild(t); setTimeout(() => t.remove(), 2400);
}
function floatText(txt, x, y) {
  const f = document.createElement("div"); f.className = "float-coin"; f.textContent = txt;
  f.style.left = (x || window.innerWidth / 2 - 30) + "px"; f.style.top = (y || 140) + "px";
  document.body.appendChild(f); setTimeout(() => f.remove(), 1000);
}
function confetti() {
  const colors = ["#7b4fc0", "#5aa549", "#f0b429", "#e0504a", "#fff"];
  for (let i = 0; i < 60; i++) {
    const c = document.createElement("div"); c.className = "confetti";
    c.style.left = Math.random() * 100 + "vw"; c.style.background = colors[i % colors.length];
    c.style.animationDuration = 1.8 + Math.random() * 1.8 + "s"; c.style.animationDelay = Math.random() * .4 + "s";
    document.body.appendChild(c); setTimeout(() => c.remove(), 4200);
  }
}
function modal(html) {
  const b = document.createElement("div"); b.className = "modal-back";
  b.innerHTML = `<div class="card modal">${html}<div class="btn-row"><button class="btn" data-close>닫기</button></div></div>`;
  b.addEventListener("click", e => { if (e.target === b || e.target.hasAttribute("data-close")) b.remove(); });
  document.body.appendChild(b);
}
function eraOf(i) { for (let k = i; k >= 0; k--) if (STEPS[k].type === "chapter") return STEPS[k].era; return 0; }

function drawTop() {
  const top = $("#top");
  if (!S) { top.classList.add("hidden"); return; }
  top.classList.remove("hidden");
  const st = S.student;
  $("#who").textContent = `${SCHOOL.cls} ${st.no ? st.no + "번 " : ""}${st.name}`;
  $("#stars").textContent = "★ " + totalStars();
  $("#rank").textContent = rankName();
  const c = $("#combo"); c.textContent = "🔥 " + S.combo; c.classList.toggle("off", S.combo < 2);
  const now = eraOf(S.step);
  $("#road").innerHTML = ERAS.map((e, i) =>
    `${i ? `<span class="arrow">▶</span>` : ""}<span class="stop ${S.cards.includes(i) ? "done" : i === now ? "now" : ""}">${S.cards.includes(i) ? "✔" : e.icon} ${e.name}</span>`).join("");
}

function showDex() {
  modal(`<span class="tag gold">모은 카드 ${S.cards.length} / ${ERAS.length}</span><h2>📒 나의 유물 도감</h2>
    <div class="dex">${ERAS.map((e, i) => `<div class="dex-card ${S.cards.includes(i) ? "" : "off"}">${img(e.img, "", e.card)}<div class="nm">${S.cards.includes(i) ? e.card : "? ? ?"}</div><div class="muted" style="font-size:.7em">${e.name}</div></div>`).join("")}</div>`);
}

// ---------------- 아래 버튼 ----------------
function setNav({ next = "다음 ▶", enabled = true, onNext } = {}) {
  nav.innerHTML = `
    <button class="btn ghost" id="backBtn" ${S.step > 0 ? "" : "style='visibility:hidden'"}>◀ 이전</button>
    <button class="btn gold" id="nextBtn">${next}</button>`;
  $("#backBtn").onclick = () => go(S.step - 1);
  const h = onNext || (() => go(S.step + 1));
  $("#nextBtn").onclick = () => { sfx.tap(); h(); };
  enableNext(enabled);
}
function enableNext(on) { const b = $("#nextBtn"); if (b) b.disabled = !on; }
function hideNav() { nav.innerHTML = ""; }

function go(i) {
  i = Math.max(0, Math.min(STEPS.length - 1, i));
  S.step = i; save();
  window.scrollTo({ top: 0, behavior: "smooth" });
  render();
}

// ---------------- 단계 그리기 ----------------
function render() {
  drawTop();
  const st = STEPS[S.step];
  const r = st.id ? S.rec[st.id] : null;
  if (r && r.done && st.type !== "write") return renderDone(st, r);
  (RENDER[st.type] || RENDER.lesson)(st);
}

function qHead(st, tagText) {
  const no = GRADED.indexOf(st) + 1;
  return `${st.boss ? bossBar() : ""}<div class="q-head"><span class="tag ${st.boss ? "red" : ""}">${tagText}</span>
    <span class="muted" style="font-size:.8em">${no ? `문제 ${no} / ${GRADED.length}` : ""} · 최대 ${"★".repeat(starMax(st))}</span></div>`;
}
function bossBar() {
  const left = BOSS.filter(s => !(S.rec[s.id] && S.rec[s.id].done)).length;
  return `<div class="boss-bar" id="bossBar">${img(ERAS[5].img, "", "시간 도깨비")}
    <div class="hp"><b>시간 도깨비</b> <span class="muted" style="color:#d9c9f5">체력 ${left} / ${BOSS.length}</span>
    <div class="bar"><div style="width:${left / BOSS.length * 100}%"></div></div></div></div>`;
}
function hitBoss() {
  const b = $("#bossBar"); if (!b) return;
  sfx.hit();
  const left = BOSS.filter(s => !(S.rec[s.id] && S.rec[s.id].done)).length;
  b.classList.remove("hit"); void b.offsetWidth; b.classList.add("hit");
  $(".bar > div", b).style.width = (left / BOSS.length * 100) + "%";
  $(".hp .muted", b).textContent = `체력 ${left} / ${BOSS.length}`;
  if (!left) setTimeout(() => toast("💥 시간 도깨비를 물리쳤어요!"), 300);
}

function renderDone(st, r) {
  app.innerHTML = `<div class="card">
    ${st.boss ? bossBar() : ""}
    <span class="tag green">이미 해결했어요 ✔</span>
    <div class="q-title">${st.q}</div>
    ${r.value ? `<p>내 답: <b>${r.value}</b></p>` : ""}
    ${st.explain ? `<div class="explain">${st.explain}</div>` : ""}
    <p class="muted">받은 별: ${"★".repeat(r.stars) || "없음"}</p>
  </div>`;
  setNav();
}

const RENDER = {
  chapter(st) {
    const e = ERAS[st.era], boss = st.era === 5;
    app.innerHTML = `<div class="card cover ${boss ? "boss" : ""}">
      <div class="num">${st.num}</div>
      <h1>${e.icon} ${st.title}</h1>
      <div class="muted">${st.sub}</div>
      ${img(e.img, "", st.title)}
      <div class="goal">${st.goal}</div>
    </div>`;
    setNav({ next: boss ? "⚔️ 도전하기 ▶" : "탐험 시작 ▶" });
    sync();
  },

  lesson(st) {
    app.innerHTML = `<div class="card">
      <span class="tag green">📖 핵심 노트 · ${st.ppt}</span>
      <div class="lesson">
        <div><h2>${st.title}</h2>
          <ul class="notes">${st.notes.map((n, i) => `<li><span class="n">${i + 1}</span><span>${n}</span></li>`).join("")}</ul>
          <div class="guide-line">${img(MASCOT, "", "머루")}<span>머루: 굵은 글씨만 기억하면 문제는 문제없어!</span></div>
        </div>
        ${st.img ? `<div class="pic">${img(st.img, "", st.title)}</div>` : ""}
      </div></div>`;
    setNav({ next: "문제 풀기 ▶" });
  },

  quiz(st) {
    const r = rec(st.id);
    const order = st.ox ? st.choices.map((c, i) => i) : shuffle(st.choices.map((c, i) => i), seedOf(st.id + S.sid));
    app.innerHTML = `<div class="card">
      ${qHead(st, st.ox ? "⭕❌ OX 퀴즈" : "🔍 탐험 문제")}
      <div class="q-title">${st.q}</div>
      ${st.img ? img(st.img, "q-img") : ""}
      <div class="choices ${st.ox ? "ox" : ""}">
        ${order.map((i, k) => `<button class="choice" data-i="${i}"><span class="no">${k + 1}</span><span>${st.choices[i]}</span></button>`).join("")}
      </div>
      <div id="fb"></div></div>`;
    setNav({ enabled: false });
    app.querySelectorAll(".choice").forEach(b => b.onclick = () => {
      if (r.done) return;
      const i = +b.dataset.i; r.tries++;
      if (i === st.answer) {
        b.classList.add("right"); sfx.ok();
        app.querySelectorAll(".choice").forEach(x => x !== b && x.classList.add("dim"));
        $("#fb").innerHTML = `<div class="explain">⭕ ${st.explain}</div>`;
        const stars = st.ox ? (r.tries === 1 ? 2 : 0) : Math.max(0, 4 - r.tries);
        finish(st, stars, { value: st.choices[i].replace(/^\S+\s/, st.ox ? "" : "$&") });
      } else {
        b.classList.add("wrong"); b.disabled = true; sfx.bad();
        $("#fb").innerHTML = `<div class="explain bad">앗, 다시 생각해 볼까요? 🤔 핵심 노트를 떠올려 봐요!</div>`;
        save();
      }
    });
  },

  multi(st) {
    const r = rec(st.id);
    const sel = new Set();
    app.innerHTML = `<div class="card">
      ${qHead(st, "✅ 모두 고르기")}
      <div class="q-title">${st.q}</div>
      ${st.img ? img(st.img, "q-img") : ""}
      <div class="choices">${st.choices.map((c, i) => `<button class="choice" data-i="${i}"><span class="no">${i + 1}</span><span>${c}</span></button>`).join("")}</div>
      <div class="btn-row"><button class="btn leaf" id="chk">확인하기</button></div>
      <div id="fb"></div></div>`;
    setNav({ enabled: false });
    const btns = [...app.querySelectorAll(".choice")];
    btns.forEach(b => b.onclick = () => {
      if (r.done) return;
      const i = +b.dataset.i; sfx.tap(); b.classList.remove("wrong");
      sel.has(i) ? (sel.delete(i), b.classList.remove("selected")) : (sel.add(i), b.classList.add("selected"));
    });
    $("#chk").onclick = () => {
      if (r.done) return;
      if (!sel.size) { toast("답을 하나 이상 골라 주세요 👆"); return; }
      r.tries++;
      const okCount = [...sel].filter(i => st.answers.includes(i)).length;
      const perfect = okCount === st.answers.length && sel.size === st.answers.length;
      if (perfect) {
        btns.forEach((b, i) => { b.classList.remove("selected"); b.classList.add(st.answers.includes(i) ? "right" : "dim"); });
        $("#chk").disabled = true; sfx.win();
        $("#fb").innerHTML = `<div class="explain">⭕ ${st.explain}</div>`;
        finish(st, Math.max(1, 4 - r.tries), { value: st.answers.map(i => st.choices[i].replace(/^\S+\s/, "")).join(", ") });
      } else {
        sfx.bad(); save();
        btns.forEach((b, i) => { if (sel.has(i) && !st.answers.includes(i)) { b.classList.add("wrong"); b.classList.remove("selected"); sel.delete(i); } });
        $("#fb").innerHTML = `<div class="explain bad">${okCount}개는 맞았어요! 틀린 카드는 빼 두었어요. 정답은 모두 ${st.answers.length}개예요.</div>`;
      }
    };
  },

  order(st) {
    const r = rec(st.id);
    const items = shuffle(st.items.map((t, i) => ({ t, i })), seedOf(st.id + S.sid));
    let next = 0;
    app.innerHTML = `<div class="card">
      ${qHead(st, "🔢 순서 맞추기")}
      <div class="q-title">${st.q}</div>
      <div class="order-slots">${st.items.map((_, i) => `<div class="order-slot" id="slot${i}"><span class="no">${i + 1}</span><span class="muted">?</span></div>`).join("")}</div>
      <div class="choices">${items.map(o => `<button class="choice" data-i="${o.i}">${o.t}</button>`).join("")}</div>
      <div id="fb"></div></div>`;
    setNav({ enabled: false });
    app.querySelectorAll(".choice").forEach(b => b.onclick = () => {
      if (r.done) return;
      const i = +b.dataset.i;
      if (i === next) {
        sfx.ok(); b.style.visibility = "hidden";
        const slot = $("#slot" + next); slot.classList.add("filled"); slot.lastElementChild.outerHTML = `<span>${st.items[i]}</span>`;
        next++;
        if (next === st.items.length) {
          $("#fb").innerHTML = `<div class="explain">⭕ ${st.explain}</div>`;
          r.tries = (r.miss || 0) + 1;
          finish(st, 3 - Math.min(2, r.miss || 0), { value: (r.miss || 0) ? `실수 ${r.miss}번` : "한 번에 성공" });
        }
      } else {
        sfx.bad(); b.classList.add("wrong"); setTimeout(() => b.classList.remove("wrong"), 450);
        r.miss = (r.miss || 0) + 1; save();
      }
    });
  },

  sort(st) {
    const r = rec(st.id);
    let k = 0; const got = st.bins.map(() => []);
    const draw = () => {
      const it = st.items[k];
      app.innerHTML = `<div class="card">
        ${qHead(st, `📦 분류 게임 ${Math.min(k + 1, st.items.length)} / ${st.items.length}`)}
        <div class="q-title">${st.q}</div>
        ${it ? `<div class="sort-item"><div class="emoji">${it.emoji}</div><div class="label">${it.label}</div></div>` : `<div class="explain">⭕ ${st.explain}</div>`}
        <div class="bins">${st.bins.map((b, i) => `<button class="bin" data-i="${i}" ${it ? "" : "disabled"}>${b.title}<small>${b.sub}</small><div class="got">${got[i].map(g => `<span>${g}</span>`).join("")}</div></button>`).join("")}</div>
      </div>`;
      app.querySelectorAll(".bin").forEach(b => b.onclick = () => {
        if (!it) return;
        if (+b.dataset.i === it.bin) { sfx.ok(); got[it.bin].push(it.label); k++; draw(); }
        else { sfx.bad(); r.miss = (r.miss || 0) + 1; save(); b.classList.add("wrong"); setTimeout(() => b.classList.remove("wrong"), 450); }
      });
      if (!it) { r.tries = (r.miss || 0) + 1; finish(st, 3 - Math.min(2, r.miss || 0), { value: (r.miss || 0) ? `실수 ${r.miss}번` : "한 번에 성공" }); }
    };
    setNav({ enabled: false }); draw();
  },

  input(st) {
    const r = rec(st.id);
    app.innerHTML = `<div class="card">
      ${qHead(st, st.boss ? "⚔️ 보스 문제 · 초성 퀴즈" : "✏️ 초성 퀴즈")}
      <div class="q-title">${st.q}</div>
      <div style="display:flex;gap:12px;flex-wrap:wrap">
        <input class="field" id="ans" style="flex:1;min-width:220px" placeholder="정답을 쓰세요" autocomplete="off">
        <button class="btn leaf" id="chk">확인</button>
      </div><div id="fb"></div></div>`;
    setNav({ enabled: false });
    const check = () => {
      if (r.done) return;
      const v = $("#ans").value.replace(/\s/g, "");
      if (!v) return;
      r.tries++;
      if (st.answer.includes(v)) {
        sfx.ok(); $("#fb").innerHTML = `<div class="explain">⭕ ${st.explain}</div>`;
        $("#ans").disabled = true; $("#chk").disabled = true;
        finish(st, Math.max(1, 4 - r.tries), { value: v });
      } else {
        sfx.bad(); save();
        $("#fb").innerHTML = `<div class="explain bad">다시 해 볼까요? 💡 힌트: ${st.hint}</div>`;
        $("#ans").select();
      }
    };
    $("#chk").onclick = check;
    $("#ans").onkeydown = e => { if (e.key === "Enter") check(); };
  },

  write(st) {
    const r = rec(st.id);
    app.innerHTML = `<div class="card">
      <span class="tag gold">📰 기자 미션 · ${st.ppt}</span>
      <div class="q-title">${st.q}</div>
      <textarea class="field" id="txt" placeholder="${st.placeholder}" ${r.done ? "disabled" : ""}>${r.done ? r.value : r.draft || ""}</textarea>
      <p class="muted" id="len"></p>
      <div class="btn-row"><button class="btn" id="sub" disabled>✍️ 기사 제출하기</button></div>
      <div id="fb">${r.done ? `<div class="explain">멋진 기사예요! 선생님께 전달했어요. ✉️</div>` : ""}</div></div>`;
    setNav({ enabled: !!r.done });
    if (r.done) return;
    const t = $("#txt");
    const upd = () => { const n = t.value.trim().length; $("#len").textContent = `${n}자 (10자 이상 써 주세요)`; $("#sub").disabled = n < 10; r.draft = t.value; save(); };
    t.oninput = upd; upd();
    $("#sub").onclick = () => {
      sfx.win(); t.disabled = true; $("#sub").disabled = true;
      $("#fb").innerHTML = `<div class="explain">멋진 기사예요! 선생님께 전달할게요. ✉️</div>`;
      finish(st, 3, { value: t.value.trim() });
      sync();
    };
  },

  stamp(st) {
    if (!S.cards.includes(st.era)) { S.cards.push(st.era); S.cards.sort(); }
    save(); drawTop();
    const e = ERAS[st.era];
    app.innerHTML = `<div class="card" style="text-align:center">
      <span class="tag gold">🎉 ${e.name} 클리어!</span>
      <div class="stamp-big"><div class="dex-card">${img(e.img, "", e.card)}<div class="nm">${e.card}</div></div></div>
      <p style="font-size:1.2em">${st.text}</p>
      <div class="btn-row"><button class="btn ghost" id="dexBtn">📒 도감 펼쳐 보기 (${S.cards.length} / ${ERAS.length})</button></div>
    </div>`;
    $("#dexBtn").onclick = showDex;
    sfx.win(); confetti(); setNav(); sync();
  },

  result() { renderResult(); },
};

// ---------------- 결과 ----------------
function accuracy() {
  const done = GRADED.filter(s => S.rec[s.id] && S.rec[s.id].done);
  if (!done.length) return 0;
  return Math.round(done.filter(s => S.rec[s.id].firstOk).length / done.length * 100);
}
function badges() {
  const g = S.rec;
  return [
    { icon: "🔥", name: "불꽃 콤보", on: S.maxCombo >= 5, how: "5문제 연속 한 번에 정답" },
    { icon: "🎯", name: "백발백중", on: accuracy() >= 80, how: "한 번에 맞힌 문제 80% 이상" },
    { icon: "📒", name: "도감 완성", on: S.cards.length === ERAS.length, how: "유물 카드 6장 모두 모으기" },
    { icon: "⚡", name: "도깨비 사냥꾼", on: BOSS.every(s => g[s.id] && g[s.id].firstOk), how: "보스 문제 모두 한 번에" },
    { icon: "📰", name: "꼬마 기자", on: !!(g.w19 && g.w19.done), how: "역사 신문 기사 쓰기" },
  ];
}

function renderResult() {
  if (!S.finishedAt) { S.finishedAt = Date.now(); save(); }
  const mins = Math.max(1, Math.round((S.finishedAt - S.startedAt) / 60000));
  app.innerHTML = `<div class="card" style="text-align:center">
    <span class="tag gold">🏆 탐험 완료</span>
    <div class="certificate">
      <div class="muted">${SCHOOL.name} ${SCHOOL.grade} ${SCHOOL.cls}</div>
      <h1 style="margin:6px 0">${S.student.name} 탐험가</h1>
      <p style="font-size:1.1em;margin:0">사회 1단원 「유적과 유물로 살펴본 옛 사람들의 생활」<br>선사 시대부터 고려까지 시간 여행을 모두 마쳤습니다!</p>
      <p style="font-size:1.3em;margin:10px 0 0">칭호: <b style="color:var(--main)">${rankName()}</b></p>
    </div>
    <div class="result-grid">
      <div class="stat"><div class="big">★ ${totalStars()}</div>모은 별 (기본 최대 ${MAX_STARS})</div>
      <div class="stat"><div class="big">${accuracy()}%</div>한 번에 맞힌 문제</div>
      <div class="stat"><div class="big">🔥 ${S.maxCombo}</div>최고 연속 정답</div>
      <div class="stat"><div class="big">${mins}분</div>걸린 시간</div>
    </div>
    <h3>나의 배지</h3>
    <div class="badges">${badges().map(b => `<div class="badge ${b.on ? "" : "off"}">${b.icon} ${b.name}<br><small class="muted">${b.how}</small></div>`).join("")}</div>
    <div class="send-state" id="sendState"></div>
    <div class="btn-row">
      <button class="btn ghost" id="dexBtn">📒 유물 도감</button>
      <button class="btn" id="resend">✉️ 선생님께 다시 보내기</button>
    </div>
    <div class="btn-row"><button class="btn ghost" id="restart" style="min-height:56px;font-size:.9em">다음 친구가 새로 시작하기</button></div>
  </div>`;
  confetti(); sfx.win();
  $("#dexBtn").onclick = showDex;
  $("#resend").onclick = () => sync(true);
  $("#restart").onclick = () => {
    if (!confirm("이 기기의 진행 기록을 지우고 처음 화면으로 갈까요?\n(선생님께 보낸 결과는 그대로 남아요)")) return;
    try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
    S = null; renderStart();
  };
  setNav({ next: "🏠 처음 화면", onNext: () => { save(); S = null; renderStart(); } });
  sync(true);
}

// ---------------- 선생님께 보내기 ----------------
function buildRow() {
  const g = S.rec, st = S.student;
  const cur = STEPS[S.step];
  const row = {
    "기기ID": S.sid,
    "학교": SCHOOL.name, "학년": SCHOOL.grade, "반": SCHOOL.cls,
    "번호": st.no || "", "이름": st.name,
    "진행": S.finishedAt ? "완료" : `${ERAS[eraOf(S.step)].name} 탐험 중`,
    "별": totalStars(), "최대별": MAX_STARS, "칭호": rankName(),
    "도감카드": S.cards.length + " / " + ERAS.length,
    "최고콤보": S.maxCombo,
    "첫시도정답률(%)": accuracy(),
    "역사신문 기사": g.w19 && g.w19.done ? g.w19.value : "",
  };
  GRADED.forEach(s => {
    const r = g[s.id];
    row[s.label] = !r || !r.done ? "" : r.firstOk ? "O" : `X(${r.tries}번)`;
  });
  row["시작시각"] = new Date(S.startedAt).toLocaleString("ko-KR");
  row["걸린시간(분)"] = Math.round(((S.finishedAt || Date.now()) - S.startedAt) / 60000);
  return row;
}

function sync(showState) {
  if (!S) return;
  const row = buildRow();
  // 같은 기기에도 결과를 모아 둔다 (선생님 화면에서 엑셀로 받을 수 있음)
  try {
    const all = JSON.parse(localStorage.getItem(RESULTS_KEY) || "{}");
    all[S.sid] = row; localStorage.setItem(RESULTS_KEY, JSON.stringify(all));
  } catch (e) {}
  const url = sheetUrl();
  const box = $("#sendState");
  if (!url) {
    if (showState && box) box.innerHTML = "💾 결과가 이 기기에 저장되었어요. (선생님 시트가 연결되지 않았어요 — 선생님께 화면을 보여 주세요)";
    return;
  }
  if (showState && box) box.textContent = "✉️ 선생님께 보내는 중…";
  fetch(url, { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(row) })
    .then(() => { S.sent = Date.now(); save(); if (showState && box) box.innerHTML = "✅ 선생님께 결과를 보냈어요!"; })
    .catch(() => { if (showState && box) box.innerHTML = "⚠️ 인터넷 연결을 확인하고 ‘다시 보내기’를 눌러 주세요. (결과는 이 기기에 저장되어 있어요)"; });
}

// ---------------- 시작 화면 ----------------
function renderStart() {
  drawTop(); hideNav();
  const saved = load();
  const linked = !!sheetUrl();
  app.innerHTML = `<div class="card start">
    <div class="school-badge">🏫 ${SCHOOL.name} ${SCHOOL.grade} <span class="cls">🍇 ${SCHOOL.cls}</span></div>
    <h1>머루반 역사 탐험대</h1>
    <div class="muted">사회 5-2 · 1단원 「유적과 유물로 살펴본 옛 사람들의 생활」</div>
    <div class="hero">
      ${img(MASCOT, "mascot", "머루")}
      <div class="speech-start">안녕, 머루반 친구들! 나는 탐험대장 <b style="color:var(--main)">머루</b>야.<br>
        시간 도깨비가 역사를 뒤죽박죽 섞어 놓았어! 6개의 땅을 지나며 <b style="color:var(--main)">유물 카드</b>를 모으고, 도깨비를 물리치자!</div>
    </div>
    <div class="era-preview">${ERAS.map(e => `<span>${e.icon} ${e.name}</span>`).join("")}</div>
    <p class="muted" style="font-size:.85em">문제 ${GRADED.length}개 · 약 15분 · 연속으로 맞히면 🔥 콤보 보너스!</p>
    ${saved && saved.student ? `
      <div class="explain info" style="max-width:640px;margin:16px auto 0">
        <b>${saved.student.name}</b> 탐험가의 기록이 있어요. (★ ${Object.values(saved.rec).reduce((s, r) => s + (r.stars || 0), 0) + (saved.bonus || 0)})
        <div class="btn-row" style="margin-top:12px"><button class="btn" id="cont">▶ 이어서 하기</button><button class="btn ghost" id="fresh">새 친구로 시작</button></div>
      </div>` : ""}
    <div id="formArea" class="${saved && saved.student ? "hidden" : ""}">
      <div class="form-grid">
        <div><label>번호</label><input class="field" id="no" inputmode="numeric" placeholder="예) 12"></div>
        <div><label>이름</label><input class="field" id="name" placeholder="이름을 쓰세요"></div>
      </div>
      <div class="btn-row"><button class="btn red" id="go">🚀 탐험 출발!</button></div>
    </div>
    <p class="muted" style="margin-top:22px;font-size:.8em">${linked ? "✅ 선생님 결과 시트와 연결되어 있어요" : "💾 결과는 이 기기에 저장돼요"}
      · <a href="teacher.html" style="color:inherit">선생님 화면</a></p>
  </div>`;
  if ($("#cont")) $("#cont").onclick = () => { S = saved; render(); };
  if ($("#fresh")) $("#fresh").onclick = () => { $("#formArea").classList.remove("hidden"); $("#fresh").closest(".explain").remove(); };
  $("#go").onclick = () => {
    const name = $("#name").value.trim();
    if (!name) { toast("이름을 써 주세요 ✏️"); $("#name").focus(); return; }
    S = newState({ no: $("#no").value.trim(), name });
    save(); sfx.win(); render();
  };
}

// ---------------- 위쪽 버튼 ----------------
$("#dexTop").onclick = () => S && showDex();
$("#soundBtn").onclick = e => { soundOn = !soundOn; e.currentTarget.textContent = soundOn ? "🔊" : "🔇"; };
$("#homeBtn").onclick = () => { if (confirm("처음 화면으로 갈까요? (진행 기록은 저장되어 있어요)")) { save(); S = null; renderStart(); } };

renderStart();
