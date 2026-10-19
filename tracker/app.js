'use strict';

/* ================= 기본값 ================= */
const DEFAULT_STEPS = [
  ['s1', '단어암기', 0.9], ['s2', '내용 T/F (한글)', 1], ['s3', '내용 T/F (영어)', 1],
  ['s4', '빈칸채우기', 0.9], ['s5', '빈칸 유의어 채우기', 0.8], ['s6', '순서익히기', 1],
  ['s7', '서술형 단어채우기', 0.9], ['s8', '서술형 문장쓰기', 0.8], ['s9', '서술형 요약하기', 0.8],
].map(([id, name, th]) => ({ id, name, th }));
const DEFAULT_TYPES = ['주제/요지', '제목', '함축의미', '어법', '어휘', '빈칸추론', '순서배열', '문장삽입',
  '무관한 문장', '요약문', '서술형-영작', '서술형-어법수정', '서술형-요약', '기타'];

const SQL = `create table if not exists public.tracker_docs (
  id text primary key,
  kind text not null,
  class_id text,
  data jsonb not null default '{}'::jsonb,
  deleted boolean not null default false,
  updated_at timestamptz not null default now()
);
create index if not exists tracker_docs_updated_idx on public.tracker_docs (updated_at);

create or replace function public.tracker_touch() returns trigger
language plpgsql as $$ begin new.updated_at := now(); return new; end $$;
drop trigger if exists tracker_touch on public.tracker_docs;
create trigger tracker_touch before insert or update on public.tracker_docs
  for each row execute function public.tracker_touch();

-- 링크를 가진 누구나(로그인 없이) 읽고 쓸 수 있게 허용
alter table public.tracker_docs enable row level security;
drop policy if exists "link users full access" on public.tracker_docs;
create policy "link users full access" on public.tracker_docs
  for all to anon, authenticated using (true) with check (true);
grant select, insert, update, delete on public.tracker_docs to anon, authenticated;`;

/* ================= 유틸 ================= */
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const todayStr = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
const pct = v => (v == null || isNaN(v)) ? '–' : Math.round(v * 100) + '%';
const md = s => (s || '').slice(5).replace('-', '/');
const EPS = 1e-9;
const lsGet = (k, f) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : f; } catch { return f; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };
const lsDel = k => { try { localStorage.removeItem(k); } catch { /* ignore */ } };
const LS_ROWS = 'jt.rows.v1', LS_REMOTE = 'jt.remote.v1', LS_UI = 'jt.ui.v1', LS_CACHE = 'jt.cache.v1', LS_PENDING = 'jt.pending.v1';

let toastTimer;
function toast(msg, kind) {
  const t = $('#toast'); t.textContent = msg; t.className = 'toast' + (kind === 'bad' ? ' bad' : ''); t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, kind === 'bad' ? 5000 : 2400);
}
const okUrl = u => /^https:\/\/[^\s]+$/.test(u) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/.test(u);
const b64e = s => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64d = s => decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))));

/* ================= 저장소: 로컬 / 공유 서버(Supabase) ================= */
function remoteConfig() {
  const saved = lsGet(LS_REMOTE, null);
  if (saved && saved.off) return null;
  if (saved && saved.u && saved.k) return saved;
  const c = window.TRACKER_CONFIG || {};
  if (c.supabaseUrl && c.anonKey) return { u: c.supabaseUrl, k: c.anonKey, fromFile: true };
  return null;
}
const tsMax = (a, b) => (!a ? b : !b ? a : (Date.parse(a) >= Date.parse(b) ? a : b));
const strip = r => ({ id: r.id, kind: r.kind, class_id: r.class_id ?? null, data: r.data, deleted: !!r.deleted });

const Store = {
  rows: new Map(), remote: null, status: 'local', error: '', lastSync: null, cursor: null,
  pending: new Map(), ver: 0, subs: [], flushing: null, ready: false,

  on(fn) { this.subs.push(fn); },
  emit() { this.ver++; this.subs.forEach(f => f()); },

  async init() {
    this.remote = remoteConfig();
    if (!this.remote) {
      this.loadLocal(); this.ready = true;
      window.addEventListener('storage', e => { if (e.key === LS_ROWS) { this.loadLocal(); this.emit(); } });
      this.emit();
      return;
    }
    const cache = lsGet(LS_CACHE, null);
    if (cache && cache.u === this.remote.u) { this.rows = new Map(cache.rows.map(r => [r.id, r])); this.cursor = cache.cursor; this.ready = true; }
    for (const r of lsGet(LS_PENDING, [])) { this.pending.set(r.id, r); this.applyLocal(r); }
    this.status = 'syncing'; this.emit();
    if (this.cursor) await this.poll(true); else await this.fullSync();
    this.ready = true; this.emit();
    setInterval(() => this.poll(), 8000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) this.poll(); });
    window.addEventListener('online', () => this.poll());
  },

  loadLocal() { this.rows = new Map(lsGet(LS_ROWS, []).map(r => [r.id, r])); this.status = 'local'; },
  saveLocal() { if (!lsSet(LS_ROWS, [...this.rows.values()])) toast('브라우저 저장 공간에 쓸 수 없습니다. 설정 → 백업으로 내보내 두세요.', 'bad'); },
  saveCache() {
    lsSet(LS_CACHE, { u: this.remote.u, cursor: this.cursor, rows: [...this.rows.values()] });
    lsSet(LS_PENDING, [...this.pending.values()]);
  },
  applyLocal(r) { if (r.deleted) this.rows.delete(r.id); else this.rows.set(r.id, r); },

  api(path, opts = {}) {
    const headers = { apikey: this.remote.k, 'Content-Type': 'application/json', ...(opts.headers || {}) };
    if (this.remote.k.startsWith('eyJ')) headers.Authorization = 'Bearer ' + this.remote.k;
    return fetch(this.remote.u.replace(/\/+$/, '') + '/rest/v1/' + path, { ...opts, headers }).then(async res => {
      if (!res.ok) { const t = await res.text().catch(() => ''); throw new Error(res.status + ' ' + t.slice(0, 160)); }
      const txt = await res.text(); return txt ? JSON.parse(txt) : null;
    });
  },

  async fullSync() {
    try {
      const all = [];
      for (let off = 0; ; off += 1000) {
        const page = await this.api(`tracker_docs?select=*&deleted=eq.false&order=updated_at.asc,id.asc&limit=1000&offset=${off}`);
        all.push(...page); if (page.length < 1000) break;
      }
      this.rows = new Map(all.map(r => [r.id, r]));
      for (const r of this.pending.values()) this.applyLocal(r);
      this.cursor = all.reduce((m, r) => tsMax(m, r.updated_at), null) || new Date(0).toISOString();
      this.status = 'online'; this.lastSync = new Date(); this.saveCache();
      await this.flush();
    } catch (e) { this.status = 'error'; this.error = e.message; }
    this.emit();
  },

  async poll(force) {
    if (!this.remote || (document.hidden && !force)) return;
    await this.flush();
    try {
      let changed = false, more = true, guard = 0;
      while (more && guard++ < 50) {
        const since = new Date(Date.parse(this.cursor || 0) - 5000).toISOString();
        const rows = await this.api(`tracker_docs?select=*&updated_at=gt.${encodeURIComponent(since)}&order=updated_at.asc,id.asc&limit=1000`);
        for (const r of rows) {
          if (this.pending.has(r.id)) continue;
          const cur = this.rows.get(r.id);
          if (r.deleted) { if (cur) { this.rows.delete(r.id); changed = true; } }
          else if (!cur || cur.updated_at !== r.updated_at) { this.rows.set(r.id, r); changed = true; }
          this.cursor = tsMax(this.cursor, r.updated_at);
        }
        more = rows.length === 1000;
      }
      const wasErr = this.status !== 'online';
      this.status = 'online'; this.lastSync = new Date();
      if (changed) this.saveCache();
      if (changed || wasErr) this.emit(); else renderSync();
    } catch (e) { this.status = 'error'; this.error = e.message; renderSync(); }
  },

  /** 행 저장(삭제는 deleted:true). 화면에는 즉시 반영하고 서버에는 이어서 전송. */
  async put(rows) {
    if (!rows.length) return;
    for (const r of rows) this.applyLocal(r);
    if (!this.remote) { this.saveLocal(); this.emit(); return; }
    for (const r of rows) this.pending.set(r.id, r);
    this.saveCache(); this.emit();
    await this.flush();
  },

  async flush() {
    if (!this.remote || !this.pending.size) return;
    if (this.flushing) return this.flushing;
    this.flushing = (async () => {
      const batch = [...this.pending.values()];
      try {
        for (let i = 0; i < batch.length; i += 500) {
          const part = batch.slice(i, i + 500);
          const res = await this.api('tracker_docs?on_conflict=id', {
            method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
            body: JSON.stringify(part.map(strip)),
          });
          for (const r of res || []) {
            if (this.pending.get(r.id) && part.includes(this.pending.get(r.id))) this.pending.delete(r.id);
            if (!r.deleted && this.rows.has(r.id)) this.rows.set(r.id, r);
          }
        }
        if (this.status === 'error') { this.status = 'online'; renderSync(); }
      } catch (e) {
        this.status = 'error'; this.error = e.message; renderSync();
        toast('서버에 저장하지 못했습니다. 연결되면 자동으로 다시 보냅니다.', 'bad');
      } finally { this.saveCache(); this.flushing = null; }
    })();
    return this.flushing;
  },
};

/* ================= 데이터 접근 ================= */
const classes = () => [...Store.rows.values()].filter(r => r.kind === 'class')
  .sort((a, b) => (a.data.created || 0) - (b.data.created || 0));
function curClassRow() {
  const cs = classes();
  return cs.find(c => c.id === UI.classId) || cs[0] || null;
}
function classObj(row) {
  const d = row.data;
  return {
    id: row.id, name: d.name || '이름 없는 반', exam: d.exam || '', date: d.date || '', target: +d.target || 0,
    steps: (d.steps && d.steps.length ? d.steps : DEFAULT_STEPS), passages: d.passages || [], students: d.students || [],
    types: d.types && d.types.length ? d.types : DEFAULT_TYPES, created: d.created || 0,
  };
}

let ixCache = { ver: -1, id: null, ix: null };
function getIndex(c) {
  if (ixCache.ver === Store.ver && ixCache.id === c.id) return ixCache.ix;
  const best = new Map(), vars = new Map(), vtype = new Map(), logs = [];
  for (const r of Store.rows.values()) {
    if (r.kind !== 'log' || r.class_id !== c.id) continue;
    const l = { id: r.id, ...r.data }; logs.push(l);
    if (l.t === 'step') {
      const k = l.sid + '|' + l.pid + '|' + l.step;
      let e = best.get(k); if (!e) { e = { best: null, list: [] }; best.set(k, e); }
      e.list.push(l);
      const v = l.n > 0 ? l.ok / l.n : null;
      if (v != null && (e.best == null || v > e.best)) e.best = v;
    } else {
      const k = l.sid + '|' + l.pid;
      const e = vars.get(k) || { n: 0, ok: 0, list: [] }; e.n += +l.n || 0; e.ok += +l.ok || 0; e.list.push(l); vars.set(k, e);
      const k2 = l.sid + '|' + l.type;
      const e2 = vtype.get(k2) || { n: 0, ok: 0 }; e2.n += +l.n || 0; e2.ok += +l.ok || 0; vtype.set(k2, e2);
    }
  }
  const byTime = (a, b) => (a.d || '').localeCompare(b.d || '') || (a.at || 0) - (b.at || 0);
  logs.sort((a, b) => byTime(b, a));
  for (const e of best.values()) e.list.sort(byTime);
  for (const e of vars.values()) e.list.sort(byTime);
  const ix = { best, vars, vtype, logs };
  ixCache = { ver: Store.ver, id: c.id, ix };
  return ix;
}
const stepEntry = (ix, sid, pid, stepId) => ix.best.get(sid + '|' + pid + '|' + stepId);
const isPass = (e, s) => !!e && e.best != null && e.best >= s.th - EPS;

function cellStats(c, ix, sid, pid) {
  let passed = 0, next = null, touched = false, flag = false;
  for (const s of c.steps) {
    const e = stepEntry(ix, sid, pid, s.id);
    if (e) touched = true;
    if (isPass(e, s)) passed++;
    else { if (!next) next = s; if (e) flag = true; }
  }
  const v = ix.vars.get(sid + '|' + pid) || { n: 0, ok: 0, list: [] };
  if (v.n) touched = true;
  const varDone = c.target ? v.n >= c.target : true;
  const ready = passed === c.steps.length && varDone;
  return { passed, next, touched, flag, v, varDone, ready, p: passed / c.steps.length };
}

function ddayText(date) {
  if (!date) return { v: '–', s: '시험일 미정' };
  const diff = Math.round((Date.parse(date) - Date.parse(todayStr())) / 864e5);
  return { v: diff > 0 ? 'D-' + diff : diff === 0 ? 'D-day' : '종료', s: date };
}

/* ================= UI 상태 ================= */
const TABS = [['overview', '한눈에'], ['entry', '기록 입력'], ['student', '학생별'], ['passage', '지문별'], ['variant', '변형분석'], ['settings', '설정']];
const UI = Object.assign({ classId: null, tab: 'overview', student: null, passage: null }, lsGet(LS_UI, {}));
UI.entry = { mode: 'step', date: todayStr(), pid: null, step: 's1', type: null, src: '', n: '', onlyNeed: false, vals: {} };
UI.drawer = null; UI.sdraft = null;
const saveUI = () => lsSet(LS_UI, { classId: UI.classId, tab: UI.tab, student: UI.student, passage: UI.passage });

/* 입력 중에는 다시 그리지 않고, 포커스가 빠지면 그린다 */
let renderPending = false;
function isTyping() {
  const a = document.activeElement;
  return a && (a.matches('input:not([type=checkbox]):not([type=file]), textarea, select')) && (a.closest('#main') || a.closest('#drawer'));
}
function scheduleRender() { if (isTyping()) { renderPending = true; return; } render(); }
document.addEventListener('focusout', () => setTimeout(() => { if (renderPending && !isTyping()) { renderPending = false; render(); } }, 0));

/* ================= 렌더 ================= */
function renderSync() {
  const el = $('#sync'); if (!el) return;
  let cls = Store.status, txt;
  if (!Store.remote) txt = '이 기기에 저장';
  else if (Store.status === 'online') txt = '공유 · ' + (Store.lastSync ? Store.lastSync.toTimeString().slice(0, 5) : '') + ' 동기화' + (Store.pending.size ? ` · 대기 ${Store.pending.size}` : '');
  else if (Store.status === 'syncing') txt = '동기화 중';
  else txt = '연결 오류 · 재시도 중' + (Store.pending.size ? ` (${Store.pending.size}건 대기)` : '');
  el.className = 'sync ' + cls; el.textContent = txt; el.title = Store.status === 'error' ? Store.error : '';
}

function render() {
  renderSync();
  const row = curClassRow();
  if (row) UI.classId = row.id;
  const cs = classes();
  $('#classes').innerHTML = cs.map(r => `<button class="cchip" data-act="class" data-id="${esc(r.id)}" aria-pressed="${r.id === UI.classId}">${esc(r.data.name || '이름 없는 반')}</button>`).join('')
    + `<button class="cchip add" data-act="new-class">+ 새 반</button>`;
  $('#classes').hidden = !cs.length;
  $('#tabs').innerHTML = row ? TABS.map(([k, l]) => `<button class="tab" role="tab" data-act="tab" data-tab="${k}" aria-selected="${UI.tab === k}">${l}</button>`).join('') : '';
  const main = $('#main');
  if (!row && !Store.ready) { main.innerHTML = '<p class="muted">데이터를 불러오는 중…</p>'; renderDrawer(); return; }
  if (!row && Store.status === 'error') { main.innerHTML = `<div class="callout"><h2>공유 서버에 연결하지 못했습니다</h2><p>${esc(Store.error)}</p><p>인터넷 연결을 확인하세요. 8초마다 자동으로 다시 시도합니다.</p></div>`; renderDrawer(); return; }
  if (!row) { main.innerHTML = viewWelcome(); renderDrawer(); return; }
  const c = classObj(row), ix = getIndex(c);
  const needSetup = !c.students.length || !c.passages.length;
  let html;
  if (UI.tab === 'settings') html = viewSettings(c);
  else if (needSetup) html = `<div class="callout"><h2>${esc(c.name)} 준비하기</h2><p>학생 명단과 지문 목록을 먼저 등록하세요. 9단계 이름과 통과기준, 변형문제 목표도 설정에서 바꿀 수 있습니다.</p><button class="btn primary" data-act="tab" data-tab="settings">설정으로 이동</button></div>`;
  else html = ({ overview: viewOverview, entry: viewEntry, student: viewStudent, passage: viewPassage, variant: viewVariant }[UI.tab] || viewOverview)(c, ix);
  main.innerHTML = html;
  renderDrawer();
}

function viewWelcome() {
  return `<section class="welcome">
    <h1>지문 하나씩, 9단계를 끝까지</h1>
    <p class="muted" style="margin:0">반을 만들고 학생과 지문을 등록하면, 단계별 점수와 변형문제 풀이를 기록하는 대로 진도·취약 단계·재시험 대상이 자동으로 정리됩니다.</p>
    <div class="flow">${DEFAULT_STEPS.map((s, i) => `<span>${i + 1}. ${esc(s.name)}</span>`).join('')}<span>+ 변형문제</span></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn primary" data-act="new-class">새 반 만들기</button>
      <button class="btn" data-act="sample">예시 반 불러오기</button>
      <button class="btn" data-act="tab-settings-global">공유 서버 연결 · 백업 불러오기</button>
    </div>
    ${UI.showGlobal ? `<div class="panel">${viewStorage()}</div>` : ''}
  </section>`;
}

function kpis(c, ix) {
  let sumP = 0, ready = 0, cells = 0, vn = 0, vok = 0;
  for (const st of c.students) for (const p of c.passages) {
    const cs = cellStats(c, ix, st.id, p.id); cells++; sumP += cs.p; if (cs.ready) ready++; vn += cs.v.n; vok += cs.v.ok;
  }
  const dd = ddayText(c.date);
  return `<div class="kpis">
    <div class="kpi dday"><span class="lab">${esc(c.exam || '시험')}</span><span class="val">${dd.v}</span><span class="sub">${esc(dd.s)}</span></div>
    <div class="kpi"><span class="lab">평균 진행률</span><span class="val">${pct(cells ? sumP / cells : 0)}</span><span class="sub">9단계 통과 기준</span></div>
    <div class="kpi"><span class="lab">시험준비완료</span><span class="val">${ready}<span class="small muted">/${cells}</span></span><span class="sub">학생×지문 (9단계+변형 목표)</span></div>
    <div class="kpi"><span class="lab">변형문제 정답률</span><span class="val">${pct(vn ? vok / vn : null)}</span><span class="sub"><span class="num">${vn}</span>문항 풀이</span></div>
  </div>`;
}

function viewOverview(c, ix) {
  const nS = c.steps.length;
  const head = c.passages.map(p => `<th title="${esc(p.title)}"><button class="namebtn" data-act="goto-passage" data-pid="${esc(p.id)}">${esc(p.code)}</button></th>`).join('');
  const colSum = c.passages.map(() => 0);
  const body = c.students.map(st => {
    let rs = 0;
    const tds = c.passages.map((p, j) => {
      const cs = cellStats(c, ix, st.id, p.id); rs += cs.p; colSum[j] += cs.p;
      const cls = cs.ready ? 'ready' : !cs.touched ? 'none' : cs.flag ? 'flag' : '';
      const v = c.target ? Math.min(1, cs.v.n / c.target) : 1;
      const tip = `${st.name} · ${p.code}\n통과 ${cs.passed}/${nS}` + (cs.next ? `\n다음: ${cs.next.name}` : '') + `\n변형 ${cs.v.n}/${c.target}문항`;
      return `<td><button class="hc ${cls}" style="--p:${cs.p.toFixed(3)};--v:${v.toFixed(3)}" data-act="open" data-sid="${esc(st.id)}" data-pid="${esc(p.id)}" title="${esc(tip)}"><span>${cs.ready ? '✓' : cs.passed}<small>/${nS}</small></span><i class="vbar"></i></button></td>`;
    }).join('');
    return `<tr><th class="stick"><button class="namebtn" data-act="goto-student" data-sid="${esc(st.id)}">${esc(st.name)}</button></th>${tds}<td class="num small">${pct(rs / c.passages.length)}</td></tr>`;
  }).join('');
  const foot = `<tr><th class="stick">지문 평균</th>${colSum.map(s => `<td class="num">${pct(s / c.students.length)}</td>`).join('')}<td></td></tr>`;

  // 단계별 통과율
  const total = c.students.length * c.passages.length;
  const rates = c.steps.map(s => {
    let n = 0; for (const st of c.students) for (const p of c.passages) if (isPass(stepEntry(ix, st.id, p.id, s.id), s)) n++;
    return { s, n, r: total ? n / total : 0 };
  });
  const minR = Math.min(...rates.map(x => x.r));
  const bars = rates.map(x => `<span class="lab" title="${esc(x.s.name)}">${esc(x.s.name)}</span><div class="track ${x.r === minR && x.r < 1 ? 'low' : ''}"><div class="fill" style="width:${(x.r * 100).toFixed(1)}%"></div></div><span class="v">${pct(x.r)} (${x.n}/${total})</span>`).join('');

  // 재시험 대기
  const retest = [];
  for (const st of c.students) for (const p of c.passages) for (const s of c.steps) {
    const e = stepEntry(ix, st.id, p.id, s.id);
    if (e && !isPass(e, s)) { const last = e.list[e.list.length - 1]; retest.push({ st, p, s, e, d: last.d || '' }); }
  }
  retest.sort((a, b) => b.d.localeCompare(a.d));
  const rt = retest.slice(0, 14).map(x => `<button class="li linkbtn" data-act="open" data-sid="${esc(x.st.id)}" data-pid="${esc(x.p.id)}"><span class="date">${md(x.d)}</span><span class="grow"><b>${esc(x.st.name)}</b> · ${esc(x.p.code)} · ${esc(x.s.name)}</span><span class="pill fail">${pct(x.e.best)}</span></button>`).join('');

  return `${kpis(c, ix)}
  <section class="sec">
    <div class="sec-head"><h2>학생 × 지문 진도</h2><span class="hint">칸을 누르면 9단계 상세와 기록 추가 · 숫자 = 통과한 단계 수</span></div>
    <div class="tbl"><table><thead><tr><th class="stick">학생</th>${head}<th>평균</th></tr></thead><tbody>${body}</tbody><tfoot>${foot}</tfoot></table></div>
    <div class="legend"><span><i class="sw" style="background:var(--surface)"></i>미시작</span><span><i class="sw" style="background:color-mix(in oklab,var(--pass) 28%,var(--surface))"></i>진행 중 (진할수록 많이 통과)</span><span><i class="sw" style="background:var(--pass)"></i>시험준비완료</span><span><i class="sw" style="background:var(--fail);border-radius:50%;width:8px;height:8px"></i>미통과 단계 있음</span><span><i class="sw" style="background:var(--accent);height:4px"></i>변형문제 목표 대비</span></div>
  </section>
  <div class="grid2">
    <section class="sec"><div class="sec-head"><h2>단계별 반 통과율</h2><span class="hint">가장 낮은 단계 = 병목</span></div><div class="panel"><div class="bars">${bars}</div></div></section>
    <section class="sec"><div class="sec-head"><h2>재시험 대기</h2><span class="hint">응시했지만 기준 미달 · ${retest.length}건</span></div><div class="panel">${rt ? `<div class="list">${rt}</div>` : '<p class="muted small" style="margin:0">재시험이 필요한 기록이 없습니다.</p>'}</div></section>
  </div>`;
}

function viewEntry(c, ix) {
  const E = UI.entry;
  if (!c.passages.find(p => p.id === E.pid)) E.pid = c.passages[0].id;
  if (!c.steps.find(s => s.id === E.step)) E.step = c.steps[0].id;
  if (!E.type || !c.types.includes(E.type)) E.type = c.types[0];
  const step = c.steps.find(s => s.id === E.step);
  const isStep = E.mode === 'step';
  let students = c.students;
  if (isStep && E.onlyNeed) students = students.filter(st => !isPass(stepEntry(ix, st.id, E.pid, step.id), step));
  const filled = Object.entries(E.vals).filter(([sid, v]) => v.ok !== '' && v.ok != null && students.some(s => s.id === sid)).length;

  const rows = students.map(st => {
    const v = E.vals[st.id] || {};
    let cur;
    if (isStep) {
      const e = stepEntry(ix, st.id, E.pid, step.id);
      cur = e ? `<span class="pill ${isPass(e, step) ? 'pass' : 'fail'}">${pct(e.best)}</span> <span class="small muted">${e.list.length}회</span>` : '<span class="pill none">미응시</span>';
    } else {
      const vv = ix.vars.get(st.id + '|' + E.pid);
      cur = vv && vv.n ? `<span class="num small">${vv.n}/${c.target}</span> <span class="small muted">${pct(vv.ok / vv.n)}</span>` : '<span class="pill none">0문항</span>';
    }
    return `<tr><th class="stick">${esc(st.name)}</th><td>${cur}</td>
      <td><input type="number" inputmode="numeric" min="0" id="ok-${esc(st.id)}" data-entry="ok" data-sid="${esc(st.id)}" value="${esc(v.ok ?? '')}" aria-label="${esc(st.name)} 맞은수"></td>
      <td><input type="number" inputmode="numeric" min="1" id="n-${esc(st.id)}" data-entry="n" data-sid="${esc(st.id)}" value="${esc(v.n ?? '')}" placeholder="${esc(E.n || '')}" aria-label="${esc(st.name)} 총문항"></td>
      <td><input type="text" class="memo" id="m-${esc(st.id)}" data-entry="m" data-sid="${esc(st.id)}" value="${esc(v.m ?? '')}" placeholder="오답 번호 / 메모"></td></tr>`;
  }).join('');

  return `<section class="sec">
    <div class="sec-head"><h2>일괄 입력</h2><span class="hint">한 지문·한 단계를 반 전체가 본 뒤 점수를 한 번에 기록합니다</span></div>
    <div class="panel" style="display:flex;flex-direction:column;gap:12px">
      <div class="seg" role="group" aria-label="기록 종류"><button data-act="entry-mode" data-mode="step" aria-pressed="${isStep}">9단계 시험</button><button data-act="entry-mode" data-mode="var" aria-pressed="${!isStep}">변형문제</button></div>
      <div class="formrow">
        <div class="field"><label for="e-date">날짜</label><input type="date" id="e-date" data-ef="date" value="${esc(E.date)}"></div>
        <div class="field"><label for="e-pid">지문</label><select id="e-pid" data-ef="pid">${c.passages.map(p => `<option value="${esc(p.id)}" ${p.id === E.pid ? 'selected' : ''}>${esc(p.code)}${p.title ? ' · ' + esc(p.title) : ''}</option>`).join('')}</select></div>
        ${isStep
    ? `<div class="field"><label for="e-step">단계</label><select id="e-step" data-ef="step">${c.steps.map((s, i) => `<option value="${esc(s.id)}" ${s.id === E.step ? 'selected' : ''}>${i + 1}. ${esc(s.name)} (기준 ${pct(s.th)})</option>`).join('')}</select></div>`
    : `<div class="field"><label for="e-type">변형 유형</label><select id="e-type" data-ef="type">${c.types.map(t => `<option ${t === E.type ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></div>
           <div class="field"><label for="e-src">출처 (교재/자료명)</label><input type="text" id="e-src" data-ef="src" value="${esc(E.src)}" placeholder="예: 자체제작 변형 A"></div>`}
        <div class="field"><label for="e-n">총문항 (만점)</label><input type="number" min="1" id="e-n" data-ef="n" value="${esc(E.n)}" placeholder="예: 20"></div>
      </div>
      ${isStep ? `<label class="check"><input type="checkbox" id="e-only" data-act="entry-only" ${E.onlyNeed ? 'checked' : ''}> 이 단계를 아직 통과하지 못한 학생만 보기</label>` : ''}
    </div>
  </section>
  <section class="sec">
    <div class="tbl"><table class="entry"><thead><tr><th class="stick">학생</th><th>${isStep ? '현재 최고' : '누적 / 목표'}</th><th>맞은수<br>(득점)</th><th>총문항<br>(만점)</th><th>메모</th></tr></thead>
    <tbody>${rows || `<tr><td colspan="5" class="muted" style="padding:18px">모든 학생이 이 단계를 통과했습니다.</td></tr>`}</tbody></table></div>
    <p class="small muted" style="margin:0">맞은수만 넣으면 됩니다. 총문항이 위 값과 다른 학생만 따로 입력하세요. Enter를 누르면 다음 학생으로 이동합니다.</p>
    <div class="savebar"><button class="btn" data-act="entry-clear">비우기</button><button class="btn primary" data-act="entry-save" ${filled ? '' : 'disabled'}>${filled}명 기록 저장</button></div>
  </section>`;
}

function stepGrid(c, ix, rowsDef, fixed) {
  // rowsDef: [{sid,pid,label,act,attr}] ; fixed: 'student' | 'passage'
  const head = c.steps.map((s, i) => `<th class="step-h">${i + 1}. ${esc(s.name)}<span class="th">${pct(s.th)}</span></th>`).join('');
  const body = rowsDef.map(r => {
    const cs = cellStats(c, ix, r.sid, r.pid);
    const tds = c.steps.map(s => {
      const e = stepEntry(ix, r.sid, r.pid, s.id);
      const cls = !e ? '' : isPass(e, s) ? 'pass' : 'fail';
      const nx = cs.next && cs.next.id === s.id ? ' next' : '';
      return `<td><button class="sc ${cls}${nx}" data-act="open" data-sid="${esc(r.sid)}" data-pid="${esc(r.pid)}" title="${esc(s.name)}${e ? ` · ${e.list.length}회 응시` : ' · 미응시'}">${e ? pct(e.best) + (e.list.length > 1 ? `<span class="cnt">×${e.list.length}</span>` : '') : '·'}</button></td>`;
    }).join('');
    const nextTxt = cs.next ? `<span class="pill mark">${esc(cs.next.name)}</span>` : cs.varDone ? '<span class="pill pass">완료</span>' : '<span class="pill warn">변형 남음</span>';
    return `<tr><th class="stick">${r.label}</th>${tds}<td style="padding:4px 8px">${nextTxt}</td><td class="num small" style="padding:4px 8px">${cs.v.n}/${c.target}<br><span class="muted">${cs.v.n ? pct(cs.v.ok / cs.v.n) : ''}</span></td></tr>`;
  }).join('');
  return `<div class="tbl"><table><thead><tr><th class="stick">${fixed === 'student' ? '지문' : '학생'}</th>${head}<th>다음 단계</th><th>변형</th></tr></thead><tbody>${body}</tbody></table></div>
  <div class="legend"><span><i class="sw" style="background:var(--pass-soft)"></i>통과 (최고점)</span><span><i class="sw" style="background:var(--fail-soft)"></i>기준 미달</span><span><i class="sw" style="box-shadow:inset 0 -3px 0 var(--marker)"></i>다음에 할 단계</span><span>×n = 응시 횟수</span></div>`;
}

function chipsSel(list, sel, act, key, labelFn) {
  return `<div class="chips">${list.map(x => `<button class="chip" data-act="${act}" data-${key}="${esc(x.id)}" aria-pressed="${x.id === sel}">${esc(labelFn(x))}</button>`).join('')}</div>`;
}

function viewStudent(c, ix) {
  if (!c.students.find(s => s.id === UI.student)) UI.student = c.students[0].id;
  const st = c.students.find(s => s.id === UI.student);
  let sumP = 0, ready = 0, vn = 0, vok = 0; const todo = [];
  const stepPass = c.steps.map(() => 0);
  for (const p of c.passages) {
    const cs = cellStats(c, ix, st.id, p.id); sumP += cs.p; if (cs.ready) ready++; vn += cs.v.n; vok += cs.v.ok;
    c.steps.forEach((s, i) => { if (isPass(stepEntry(ix, st.id, p.id, s.id), s)) stepPass[i]++; });
    if (!cs.ready) todo.push({ p, cs });
  }
  const minI = stepPass.indexOf(Math.min(...stepPass));
  const weak = stepPass[minI] === c.passages.length ? '없음' : c.steps[minI].name;
  const rowsDef = c.passages.map(p => ({ sid: st.id, pid: p.id, label: `<span title="${esc(p.title)}">${esc(p.code)}</span>` }));
  const types = [...new Set([...c.types, ...[...ix.vtype.keys()].filter(k => k.startsWith(st.id + '|')).map(k => k.slice(st.id.length + 1))])];
  const tchips = types.map(t => { const e = ix.vtype.get(st.id + '|' + t); if (!e || !e.n) return ''; const r = e.ok / e.n; return `<span class="pill ${r >= .8 ? 'pass' : r >= .6 ? 'warn' : 'fail'}">${esc(t)} ${pct(r)} <span style="font-weight:400">(${e.n})</span></span>`; }).join('');
  const recent = ix.logs.filter(l => l.sid === st.id).slice(0, 20);
  return `${chipsSel(c.students, st.id, 'pick-student', 'sid', s => s.name)}
  <div class="kpis">
    <div class="kpi"><span class="lab">${esc(st.name)} 진행률</span><span class="val">${pct(sumP / c.passages.length)}</span><span class="sub">전체 지문 평균</span></div>
    <div class="kpi"><span class="lab">시험준비완료 지문</span><span class="val">${ready}<span class="small muted">/${c.passages.length}</span></span><span class="sub">9단계 + 변형 목표</span></div>
    <div class="kpi"><span class="lab">변형문제</span><span class="val">${pct(vn ? vok / vn : null)}</span><span class="sub"><span class="num">${vn}</span>문항 풀이</span></div>
    <div class="kpi"><span class="lab">취약 단계</span><span class="val" style="font-family:var(--font);font-size:17px;padding-block:5px">${esc(weak)}</span><span class="sub">통과한 지문이 가장 적은 단계</span></div>
  </div>
  <section class="sec"><div class="sec-head"><h2>지문 × 단계</h2><span class="hint">칸을 누르면 상세 보기와 기록 추가</span></div>${stepGrid(c, ix, rowsDef, 'student')}</section>
  <div class="grid2">
    <section class="sec"><div class="sec-head"><h2>다음 할 일</h2><span class="hint">지문마다 다음 단계</span></div><div class="panel">${todo.length ? `<div class="list">${todo.map(x => `<button class="li linkbtn" data-act="open" data-sid="${esc(st.id)}" data-pid="${esc(x.p.id)}"><span class="grow"><b>${esc(x.p.code)}</b> ${esc(x.p.title)}</span>${x.cs.next ? `<span class="pill mark">${esc(x.cs.next.name)}</span>` : `<span class="pill warn">변형 ${x.cs.v.n}/${c.target}</span>`}</button>`).join('')}</div>` : '<p class="muted small" style="margin:0">모든 지문 시험준비완료!</p>'}</div>
      <div class="sec-head" style="margin-top:6px"><h2>변형 유형별 정답률</h2></div><div class="chips">${tchips || '<span class="muted small">변형문제 기록이 없습니다.</span>'}</div></section>
    <section class="sec"><div class="sec-head"><h2>최근 기록</h2></div><div class="panel">${recent.length ? `<div class="list">${recent.map(l => logLine(c, l, true)).join('')}</div>` : '<p class="muted small" style="margin:0">기록이 없습니다.</p>'}</div></section>
  </div>`;
}

function logLine(c, l, showPassage) {
  const p = c.passages.find(x => x.id === l.pid);
  let what, ok = null;
  if (l.t === 'step') { const s = c.steps.find(x => x.id === l.step); what = s ? s.name : '(삭제된 단계)'; if (s && l.n) ok = l.ok / l.n >= s.th - EPS; }
  else what = '변형 · ' + (l.type || '') + (l.src ? ` (${l.src})` : '');
  const r = l.n ? l.ok / l.n : null;
  return `<div class="li"><span class="date">${md(l.d)}</span><span class="grow" title="${esc(l.m || '')}">${showPassage ? `<b>${esc(p ? p.code : '?')}</b> · ` : ''}${esc(what)}${l.m ? ` <span class="muted small">— ${esc(l.m)}</span>` : ''}</span><span class="num small">${l.ok}/${l.n}</span><span class="pill ${ok === null ? 'none' : ok ? 'pass' : 'fail'}">${pct(r)}</span><button class="xdel" data-act="del-log" data-mini="1" data-id="${esc(l.id)}" aria-label="기록 삭제">삭제</button></div>`;
}

function viewPassage(c, ix) {
  if (!c.passages.find(p => p.id === UI.passage)) UI.passage = c.passages[0].id;
  const p = c.passages.find(x => x.id === UI.passage);
  const rowsDef = c.students.map(st => ({ sid: st.id, pid: p.id, label: esc(st.name) }));
  let ready = 0, sumP = 0, vn = 0, vok = 0;
  for (const st of c.students) { const cs = cellStats(c, ix, st.id, p.id); if (cs.ready) ready++; sumP += cs.p; vn += cs.v.n; vok += cs.v.ok; }
  return `${chipsSel(c.passages, p.id, 'pick-passage', 'pid', x => x.code)}
  <div class="kpis">
    <div class="kpi"><span class="lab">${esc(p.code)}</span><span class="val" style="font-family:var(--font);font-size:16px;padding-block:6px">${esc(p.title || '–')}</span><span class="sub">지문</span></div>
    <div class="kpi"><span class="lab">평균 진행률</span><span class="val">${pct(sumP / c.students.length)}</span><span class="sub">반 전체</span></div>
    <div class="kpi"><span class="lab">시험준비완료</span><span class="val">${ready}<span class="small muted">/${c.students.length}</span></span><span class="sub">학생 수</span></div>
    <div class="kpi"><span class="lab">변형문제 정답률</span><span class="val">${pct(vn ? vok / vn : null)}</span><span class="sub"><span class="num">${vn}</span>문항</span></div>
  </div>
  <section class="sec"><div class="sec-head"><h2>학생 × 단계</h2><span class="hint">반 전체가 막히는 단계를 확인하세요</span></div>${stepGrid(c, ix, rowsDef, 'passage')}</section>`;
}

function viewVariant(c, ix) {
  const types = [...new Set([...c.types, ...[...ix.vtype.keys()].map(k => k.split('|')[1])])];
  const cellHtml = (ok, n) => {
    if (!n) return '<td class="muted small">·</td>';
    const r = ok / n;
    return `<td class="num small" style="padding:8px 6px;background:color-mix(in oklab, ${r >= .8 ? 'var(--pass)' : r >= .6 ? 'var(--warn)' : 'var(--fail)'} 18%, var(--surface))" title="${ok}/${n}문항">${pct(r)}</td>`;
  };
  const tot = {}; let gn = 0, gok = 0;
  const body = c.students.map(st => {
    let sn = 0, sok = 0;
    const tds = types.map(t => { const e = ix.vtype.get(st.id + '|' + t) || { n: 0, ok: 0 }; sn += e.n; sok += e.ok; tot[t] = tot[t] || { n: 0, ok: 0 }; tot[t].n += e.n; tot[t].ok += e.ok; return cellHtml(e.ok, e.n); }).join('');
    gn += sn; gok += sok;
    return `<tr><th class="stick">${esc(st.name)}</th>${tds}${cellHtml(sok, sn)}<td class="num small">${sn}</td></tr>`;
  }).join('');
  const foot = `<tr><th class="stick">반 전체</th>${types.map(t => cellHtml(tot[t].ok, tot[t].n)).join('')}${cellHtml(gok, gn)}<td class="num small">${gn}</td></tr>`;
  return `<section class="sec"><div class="sec-head"><h2>변형문제 유형별 정답률</h2><span class="hint">초록 80% 이상 · 노랑 60~79% · 빨강 60% 미만 · 칸에 마우스를 올리면 문항 수</span></div>
  <div class="tbl"><table><thead><tr><th class="stick">학생</th>${types.map(t => `<th style="min-width:66px">${esc(t)}</th>`).join('')}<th>전체</th><th>문항</th></tr></thead><tbody>${body}</tbody><tfoot>${foot}</tfoot></table></div></section>`;
}

/* ---------- 설정 ---------- */
function settingsDraft(c) {
  if (UI.sdraft && UI.sdraft.id === c.id) return UI.sdraft;
  UI.sdraft = {
    id: c.id, name: c.name, exam: c.exam, date: c.date, target: String(c.target),
    steps: c.steps.map(s => ({ ...s, th: String(Math.round(s.th * 100)) })),
    students: c.students.map(s => s.name).join('\n'),
    passages: c.passages.map(p => p.code + (p.title ? ' | ' + p.title : '')).join('\n'),
    types: c.types.join('\n'), dirty: false,
  };
  return UI.sdraft;
}

function viewSettings(c) {
  const d = settingsDraft(c);
  return `<section class="sec"><div class="sec-head"><h2>반 정보</h2></div><div class="panel"><div class="formrow">
    <div class="field"><label for="s-name">반 이름</label><input type="text" id="s-name" data-sd="name" value="${esc(d.name)}"></div>
    <div class="field"><label for="s-exam">시험명</label><input type="text" id="s-exam" data-sd="exam" value="${esc(d.exam)}" placeholder="예: 2학기 기말고사"></div>
    <div class="field"><label for="s-date">시험일</label><input type="date" id="s-date" data-sd="date" value="${esc(d.date)}"></div>
    <div class="field"><label for="s-target">지문당 변형문제 목표 (문항)</label><input type="number" min="0" id="s-target" data-sd="target" value="${esc(d.target)}"></div>
  </div></div></section>
  <div class="grid2">
    <section class="sec"><div class="sec-head"><h2>학생 명단</h2><span class="hint">한 줄에 한 명 · 이름을 그대로 두면 기록이 유지됩니다</span></div>
      <textarea id="s-students" data-sd="students" rows="10" placeholder="김민준&#10;이서연&#10;박지호">${esc(d.students)}</textarea></section>
    <section class="sec"><div class="sec-head"><h2>지문 목록</h2><span class="hint">한 줄에 하나 · <span class="num">코드 | 출처/제목</span></span></div>
      <textarea id="s-passages" data-sd="passages" rows="10" placeholder="1과-본문1 | 교과서 1과 본문 1&#10;모고-20번 | 9월 모의고사 20번">${esc(d.passages)}</textarea></section>
  </div>
  <div class="grid2">
    <section class="sec"><div class="sec-head"><h2>9단계와 통과기준</h2><span class="hint">기준(%) 이상이면 통과</span></div>
      <div class="panel" style="display:grid;grid-template-columns:24px minmax(0,1fr) 84px;gap:8px;align-items:center">
      ${d.steps.map((s, i) => `<span class="num muted small">${i + 1}</span><input type="text" id="s-step-${i}" data-sd="step-name" data-i="${i}" value="${esc(s.name)}" aria-label="${i + 1}단계 이름"><input type="number" min="0" max="100" id="s-th-${i}" data-sd="step-th" data-i="${i}" value="${esc(s.th)}" aria-label="${i + 1}단계 통과기준 %">`).join('')}
      </div></section>
    <section class="sec"><div class="sec-head"><h2>변형문제 유형</h2><span class="hint">한 줄에 하나</span></div>
      <textarea id="s-types" data-sd="types" rows="12">${esc(d.types)}</textarea></section>
  </div>
  <div class="savebar"><span class="small muted">${d.dirty ? '저장하지 않은 변경이 있습니다' : ''}</span><button class="btn primary" data-act="save-settings" ${d.dirty ? '' : 'disabled'}>반 설정 저장</button></div>
  <section class="sec"><div class="sec-head"><h2>데이터</h2></div><div class="panel" style="display:flex;flex-wrap:wrap;gap:8px;align-items:center">
    <button class="btn" data-act="export-csv">이 반 기록 CSV 내보내기</button>
    <button class="btn danger" data-act="del-class" data-confirm="1">이 반 삭제</button>
    <span class="small muted">반을 삭제하면 그 반의 모든 기록도 함께 지워집니다.</span>
  </div></section>
  <section class="sec"><div class="sec-head"><h2>저장 · 공유 · 앱 설치</h2><span class="hint">모든 반에 적용</span></div><div class="panel">${viewStorage()}</div></section>`;
}

function shareLink() {
  if (!Store.remote) return '';
  return location.origin + location.pathname + '#join=' + b64e(JSON.stringify({ u: Store.remote.u, k: Store.remote.k }));
}

function viewStorage() {
  const localCount = lsGet(LS_ROWS, []).length;
  const install = deferredInstall ? `<button class="btn primary" data-act="install">앱 설치</button>` : '';
  const appHelp = `<div style="display:flex;flex-direction:column;gap:6px"><h3>앱으로 설치</h3>
    <p class="small muted" style="margin:0">휴대폰: 브라우저 공유(⋯) 메뉴 → <b>홈 화면에 추가</b>. PC 크롬/엣지: 주소창 오른쪽 <b>설치</b> 아이콘. 설치하면 앱처럼 전체 화면으로 열리고, 인터넷이 끊겨도 마지막 화면을 볼 수 있습니다.</p>${install}</div>`;
  const backup = `<div style="display:flex;flex-direction:column;gap:6px"><h3>백업</h3><div style="display:flex;gap:8px;flex-wrap:wrap">
    <button class="btn" data-act="export-json">전체 백업 파일 저장 (.json)</button><button class="btn" data-act="import-json">백업 파일 불러오기</button></div>
    <p class="small muted" style="margin:0">불러오기는 기존 데이터에 합쳐집니다(같은 항목은 덮어씀).</p></div>`;
  if (Store.remote) {
    return `<div style="display:flex;flex-direction:column;gap:18px">
      <div style="display:flex;flex-direction:column;gap:6px"><h3>공유 서버에 연결됨</h3>
        <p class="small muted" style="margin:0">${esc(Store.remote.u.replace(/^https?:\/\//, ''))}${Store.remote.fromFile ? ' (config.js 기본 설정)' : ''} · 이 주소를 연 모든 사람이 같은 데이터를 보고 고칩니다.</p></div>
      <div style="display:flex;flex-direction:column;gap:6px"><h3>공유 링크</h3>
        <div style="display:flex;gap:8px"><input type="text" id="share-link" readonly value="${esc(shareLink())}"><button class="btn" data-act="copy-share">복사</button></div>
        <p class="small muted" style="margin:0">이 링크를 받은 사람은 <b>로그인 없이</b> 모든 기능(기록 추가·수정·삭제, 반 관리)을 쓸 수 있습니다. 링크가 곧 열쇠이므로 함께 관리할 선생님에게만 보내세요.</p></div>
      ${localCount ? `<div style="display:flex;flex-direction:column;gap:6px"><h3>이 기기의 로컬 데이터</h3><p class="small muted" style="margin:0">서버 연결 전 이 기기에 저장한 항목 <b class="num">${localCount}</b>건이 있습니다.</p><div><button class="btn" data-act="upload-local">공유 서버로 올리기</button></div></div>` : ''}
      ${appHelp}${backup}
      <div><button class="btn danger" data-act="disconnect" data-confirm="1">이 기기에서 공유 서버 연결 해제</button></div>
    </div>`;
  }
  return `<div style="display:flex;flex-direction:column;gap:18px">
    <div style="display:flex;flex-direction:column;gap:6px"><h3>지금은 이 기기에만 저장 중</h3>
      <p class="small muted" style="margin:0">로그인 없이 여러 사람이 링크로 같은 데이터를 쓰려면 무료 공유 서버(Supabase)를 한 번만 연결하세요. 연결 후 나오는 <b>공유 링크</b>를 보내면, 받은 사람은 가입·로그인 없이 바로 모든 기능을 씁니다.</p></div>
    <div class="formrow">
      <div class="field"><label for="rm-url">Project URL</label><input type="url" id="rm-url" placeholder="https://xxxx.supabase.co"></div>
      <div class="field"><label for="rm-key">anon public 키 (또는 Publishable 키)</label><input type="password" id="rm-key" placeholder="eyJ… 또는 sb_publishable_…"></div>
      <div><button class="btn primary" data-act="connect">연결</button></div>
    </div>
    <details><summary class="small" style="cursor:pointer;font-weight:600">처음 한 번 설정하는 법 (약 5분)</summary>
      <ol class="steps small" style="margin-top:10px">
        <li>supabase.com 에서 무료 가입 → <b>New project</b> 만들기 (교사 한 명만 하면 됩니다)</li>
        <li>왼쪽 메뉴 <b>SQL Editor</b> → 아래 SQL을 붙여넣고 <b>Run</b></li>
        <li><b>Project Settings → API</b>(또는 API Keys)에서 Project URL과 anon public 키를 복사해 위 칸에 넣고 <b>연결</b></li>
        <li>설정 화면에 나오는 공유 링크를 함께 쓸 사람에게 보내기</li>
      </ol>
      <div style="display:flex;justify-content:flex-end;margin:8px 0 6px"><button class="btn sm" data-act="copy-sql">SQL 복사</button></div>
      <div class="code" id="sql-box">${esc(SQL)}</div>
    </details>
    ${appHelp}${backup}
  </div>`;
}

/* ---------- 상세 시트 (학생 × 지문) ---------- */
function renderDrawer() {
  const box = $('#drawer');
  const row = curClassRow();
  if (!UI.drawer || !row) { box.hidden = true; box.innerHTML = ''; document.body.style.overflow = ''; return; }
  const c = classObj(row), ix = getIndex(c);
  const st = c.students.find(s => s.id === UI.drawer.sid), p = c.passages.find(x => x.id === UI.drawer.pid);
  if (!st || !p) { UI.drawer = null; box.hidden = true; return; }
  const cs = cellStats(c, ix, st.id, p.id);
  const D = UI.drawer;
  const steps = c.steps.map((s, i) => {
    const e = stepEntry(ix, st.id, p.id, s.id);
    const pill = !e ? '<span class="pill none">미응시</span>' : isPass(e, s) ? `<span class="pill pass">통과 ${pct(e.best)}</span>` : `<span class="pill fail">미달 ${pct(e.best)}</span>`;
    const atts = e ? e.list.map(l => `<span class="att ${l.n && l.ok / l.n >= s.th - EPS ? 'pass' : 'fail'}" title="${esc(l.m || '')}">${md(l.d)} ${l.ok}/${l.n}<button data-act="del-log" data-id="${esc(l.id)}" data-mini="1" aria-label="삭제">×</button></span>`).join('') : '';
    return `<div class="srow ${cs.next && cs.next.id === s.id ? 'is-next' : ''}">
      <div class="h"><span class="idx">${i + 1}</span><span class="nm">${esc(s.name)}</span><span class="th">기준 ${pct(s.th)}</span>${pill}</div>
      ${atts ? `<div class="atts">${atts}</div>` : ''}
      <div class="addline"><input type="number" min="0" id="d-ok-${esc(s.id)}" placeholder="맞은수" aria-label="${esc(s.name)} 맞은수"><span class="muted">/</span><input type="number" min="1" id="d-n-${esc(s.id)}" placeholder="총문항" value="${esc(e ? e.list[e.list.length - 1].n : '')}" aria-label="${esc(s.name)} 총문항"><input type="text" class="memo" id="d-m-${esc(s.id)}" placeholder="메모"><button class="btn sm" data-act="d-add-step" data-step="${esc(s.id)}">기록</button></div>
    </div>`;
  }).join('');
  const vlist = cs.v.list.map(l => logLine(c, l, false)).join('');
  box.innerHTML = `<div class="drawer" role="dialog" aria-modal="true" aria-label="${esc(st.name)} ${esc(p.code)} 상세">
    <div class="scrim" data-act="close"></div>
    <div class="sheet">
      <div class="sheet-head"><div><div class="t">${esc(st.name)} · ${esc(p.code)}</div><div class="s">${esc(p.title)} · 통과 ${cs.passed}/${c.steps.length} · 변형 ${cs.v.n}/${c.target}문항 ${cs.ready ? '· 시험준비완료' : ''}</div></div><button class="xbtn" data-act="close" aria-label="닫기">×</button></div>
      <div class="sheet-body">
        <div class="field" style="max-width:200px"><label for="d-date">기록 날짜</label><input type="date" id="d-date" value="${esc(D.date || todayStr())}"></div>
        ${steps}
        <div class="sec"><div class="sec-head"><h2>변형문제</h2><span class="hint">${cs.v.n ? `정답률 ${pct(cs.v.ok / cs.v.n)}` : ''}</span></div>
          ${vlist ? `<div class="panel" style="padding:4px 12px"><div class="list">${vlist}</div></div>` : ''}
          <div class="srow"><div class="formrow">
            <div class="field"><label for="d-vtype">유형</label><select id="d-vtype">${c.types.map(t => `<option>${esc(t)}</option>`).join('')}</select></div>
            <div class="field"><label for="d-vsrc">출처</label><input type="text" id="d-vsrc" placeholder="교재/자료명"></div>
          </div>
          <div class="addline"><input type="number" min="0" id="d-vok" placeholder="맞은수"><span class="muted">/</span><input type="number" min="1" id="d-vn" placeholder="문항수"><input type="text" class="memo" id="d-vm" placeholder="오답 번호 / 메모"><button class="btn sm" data-act="d-add-var">기록</button></div></div>
        </div>
      </div>
    </div></div>`;
  box.hidden = false; document.body.style.overflow = 'hidden';
}

/* ================= 동작 ================= */
function newClassRow(name) {
  return { id: 'c' + uid(), kind: 'class', class_id: null, deleted: false, data: { name, exam: '', date: '', target: 20, steps: DEFAULT_STEPS, passages: [], students: [], types: DEFAULT_TYPES, created: Date.now() } };
}
const logRow = (classId, data) => ({ id: 'l' + uid(), kind: 'log', class_id: classId, deleted: false, data: { ...data, at: Date.now() } });

function parseScore(ok, n) {
  const o = Number(ok), m = Number(n);
  if (ok === '' || ok == null || !isFinite(o) || !isFinite(m) || m <= 0 || o < 0 || o > m) return null;
  return { ok: o, n: m };
}

async function loadSample() {
  const cls = newClassRow('예시) 2-3반');
  const S = ['김민준', '이서연', '박지호'].map(name => ({ id: 's' + uid(), name }));
  const P = [['1과-본문1', '교과서 1과 본문 1'], ['1과-본문2', '교과서 1과 본문 2'], ['2과-본문1', '교과서 2과 본문 1'], ['모고-20번', '9월 모의고사 20번']].map(([code, title]) => ({ id: 'p' + uid(), code, title }));
  Object.assign(cls.data, { exam: '2학기 기말고사', date: new Date(Date.now() + 50 * 864e5).toISOString().slice(0, 10), students: S, passages: P });
  const sizes = [30, 10, 10, 20, 15, 6, 15, 10, 10];
  const plan = [[0, 0, 9, 14], [0, 1, 6, 12], [0, 2, 2, 0], [1, 0, 9, 24], [1, 1, 9, 16], [1, 2, 5, 8], [1, 3, 3, 0], [2, 0, 4, 0], [2, 1, 1, 0]];
  const rows = [cls]; let day = 0; const base = Date.now() - 20 * 864e5;
  const dstr = k => new Date(base + k * 864e5).toISOString().slice(0, 10);
  let seed = 7; const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  for (const [si, pi, upto, vn] of plan) {
    day = Math.floor(rnd() * 3);
    for (let k = 0; k < upto; k++) {
      const s = DEFAULT_STEPS[k], n = sizes[k];
      if (rnd() < .3 && si !== 1) rows.push(logRow(cls.id, { t: 'step', d: dstr(day++), sid: S[si].id, pid: P[pi].id, step: s.id, ok: Math.max(0, Math.floor(n * s.th) - 2), n, m: '오답 복습 필요' }));
      rows.push(logRow(cls.id, { t: 'step', d: dstr(day), sid: S[si].id, pid: P[pi].id, step: s.id, ok: s.th === 1 ? n : Math.max(Math.ceil(n * s.th), n - (rnd() < .5 ? 1 : 0)), n, m: '' }));
      day += rnd() < .5 ? 1 : 0;
    }
    if (si === 2 && upto < 9) rows.push(logRow(cls.id, { t: 'step', d: dstr(day), sid: S[si].id, pid: P[pi].id, step: DEFAULT_STEPS[upto].id, ok: Math.floor(sizes[upto] * .6), n: sizes[upto], m: '어휘 재암기' }));
    let left = vn, ti = Math.floor(rnd() * 6);
    while (left > 0) { const n = Math.min(left, 4 + Math.floor(rnd() * 3)); rows.push(logRow(cls.id, { t: 'var', d: dstr(8 + Math.floor(rnd() * 10)), sid: S[si].id, pid: P[pi].id, type: DEFAULT_TYPES[ti++ % 10], src: '자체제작 변형 A', ok: n - Math.floor(rnd() * 3), n, m: '' })); left -= n; }
  }
  await Store.put(rows);
  UI.classId = cls.id; UI.tab = 'overview'; saveUI(); render();
  toast('예시 반을 불러왔습니다. 설정에서 언제든 삭제할 수 있어요.');
}

function saveSettings() {
  const row = curClassRow(); if (!row) return;
  const c = classObj(row), d = UI.sdraft;
  const lines = t => t.split('\n').map(x => x.trim()).filter(Boolean);
  const byName = new Map(c.students.map(s => [s.name, s]));
  const students = [...new Set(lines(d.students))].map(name => byName.get(name) || { id: 's' + uid(), name });
  const byCode = new Map(c.passages.map(p => [p.code, p]));
  const seen = new Set(); const passages = [];
  for (const ln of lines(d.passages)) {
    const [code, ...rest] = ln.split('|'); const cd = code.trim(); if (!cd || seen.has(cd)) continue; seen.add(cd);
    const old = byCode.get(cd); passages.push({ id: old ? old.id : 'p' + uid(), code: cd, title: rest.join('|').trim() });
  }
  const steps = d.steps.map(s => ({ id: s.id, name: s.name.trim() || '단계', th: Math.min(100, Math.max(0, Number(s.th) || 0)) / 100 }));
  const types = [...new Set(lines(d.types))];
  const removedS = c.students.filter(s => !students.find(x => x.id === s.id)).length;
  const removedP = c.passages.filter(p => !passages.find(x => x.id === p.id)).length;
  const data = { ...row.data, name: d.name.trim() || '이름 없는 반', exam: d.exam.trim(), date: d.date, target: Math.max(0, parseInt(d.target, 10) || 0), students, passages, steps, types: types.length ? types : DEFAULT_TYPES };
  UI.sdraft = null;
  Store.put([{ ...row, data }]);
  toast('반 설정을 저장했습니다' + (removedS || removedP ? ` (명단에서 뺀 학생 ${removedS}명·지문 ${removedP}개의 기록은 보관됨, 같은 이름으로 다시 넣으면 복원)` : ''));
}

async function deleteClass() {
  const row = curClassRow(); if (!row) return;
  const rows = [{ ...row, deleted: true }];
  for (const r of Store.rows.values()) if (r.kind === 'log' && r.class_id === row.id) rows.push({ ...r, deleted: true });
  UI.classId = null; UI.sdraft = null; UI.tab = 'overview';
  await Store.put(rows); saveUI(); render();
  toast('반을 삭제했습니다');
}

function download(filename, text, type) {
  const blob = new Blob([text], { type });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

function exportCSV() {
  const row = curClassRow(); if (!row) return;
  const c = classObj(row), ix = getIndex(c);
  const q = v => { const s = String(v ?? ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const lines = [['날짜', '학생', '지문', '지문 제목', '구분', '단계/유형', '출처', '맞은수', '총문항', '정답률', '결과', '메모'].join(',')];
  for (const l of [...ix.logs].reverse()) {
    const st = c.students.find(s => s.id === l.sid), p = c.passages.find(x => x.id === l.pid);
    const s = l.t === 'step' ? c.steps.find(x => x.id === l.step) : null;
    const r = l.n ? l.ok / l.n : '';
    const res = s ? (r >= s.th - EPS ? '통과' : '재학습') : '';
    lines.push([l.d, st ? st.name : '(명단 제외)', p ? p.code : '(목록 제외)', p ? p.title : '', l.t === 'step' ? '9단계' : '변형', s ? s.name : (l.type || ''), l.src || '', l.ok, l.n, r === '' ? '' : Math.round(r * 1000) / 10 + '%', res, l.m || ''].map(q).join(','));
  }
  download(`${c.name}_기록_${todayStr()}.csv`, '﻿' + lines.join('\n'), 'text/csv;charset=utf-8');
}

function exportJSON() {
  download(`지문트래커_백업_${todayStr()}.json`, JSON.stringify({ app: 'jimun-tracker', v: 1, exported: new Date().toISOString(), rows: [...Store.rows.values()].map(strip) }), 'application/json');
}

async function importJSON(file) {
  try {
    const obj = JSON.parse(await file.text());
    const rows = (Array.isArray(obj) ? obj : obj.rows || []).filter(r => r && r.id && (r.kind === 'class' || r.kind === 'log') && r.data).map(r => ({ ...strip(r), deleted: false }));
    if (!rows.length) throw new Error('empty');
    await Store.put(rows); toast(`${rows.length}건을 불러왔습니다`);
  } catch { toast('백업 파일을 읽지 못했습니다. 이 앱에서 내보낸 .json 파일인지 확인하세요.', 'bad'); }
}

async function connect(u, k) {
  u = (u || '').trim(); k = (k || '').trim();
  if (!okUrl(u) || !k) { toast('Project URL(https://…)과 키를 모두 입력하세요.', 'bad'); return false; }
  const probe = Object.create(Store); probe.remote = { u, k };
  try { await probe.api('tracker_docs?select=id&limit=1'); }
  catch (e) {
    const msg = String(e.message);
    toast(/404|42P01|PGRST205|does not exist/.test(msg) ? '연결은 됐지만 표가 없습니다. 설정 방법 2단계의 SQL을 먼저 실행하세요.' : /401|403/.test(msg) ? '키가 맞지 않거나 권한이 없습니다. anon public 키인지, SQL을 실행했는지 확인하세요.' : '연결하지 못했습니다: ' + msg, 'bad');
    return false;
  }
  lsSet(LS_REMOTE, { u, k }); lsDel(LS_CACHE); lsDel(LS_PENDING);
  location.reload();
  return true;
}

async function copyText(text, okMsg) {
  try { await navigator.clipboard.writeText(text); toast(okMsg); }
  catch { toast('복사하지 못했습니다. 칸을 길게 눌러 직접 복사하세요.', 'bad'); }
}

/* 두 번 눌러야 실행되는 버튼 */
function armed(btn) {
  if (btn.dataset.armed) return true;
  btn.dataset.armed = '1'; const old = btn.textContent;
  btn.textContent = btn.dataset.mini ? '삭제?' : '한 번 더 누르면 실행';
  setTimeout(() => { if (btn.isConnected) { delete btn.dataset.armed; btn.textContent = old; } }, 3000);
  return false;
}

document.addEventListener('click', async e => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  const act = b.dataset.act;
  const row = curClassRow(); const c = row ? classObj(row) : null;
  switch (act) {
    case 'class': UI.classId = b.dataset.id; UI.sdraft = null; UI.entry.vals = {}; saveUI(); render(); break;
    case 'new-class': {
      const r = newClassRow('새 반 ' + (classes().length + 1));
      await Store.put([r]); UI.classId = r.id; UI.tab = 'settings'; UI.sdraft = null; saveUI(); render();
      setTimeout(() => { const i = $('#s-name'); if (i) { i.focus(); i.select(); } }, 0);
      break;
    }
    case 'sample': loadSample(); break;
    case 'tab-settings-global': UI.showGlobal = !UI.showGlobal; render(); break;
    case 'tab': UI.tab = b.dataset.tab; saveUI(); render(); window.scrollTo(0, 0); break;
    case 'goto-student': UI.student = b.dataset.sid; UI.tab = 'student'; saveUI(); render(); window.scrollTo(0, 0); break;
    case 'goto-passage': UI.passage = b.dataset.pid; UI.tab = 'passage'; saveUI(); render(); window.scrollTo(0, 0); break;
    case 'pick-student': UI.student = b.dataset.sid; saveUI(); render(); break;
    case 'pick-passage': UI.passage = b.dataset.pid; saveUI(); render(); break;
    case 'open': UI.drawer = { sid: b.dataset.sid, pid: b.dataset.pid, date: todayStr() }; renderDrawer(); break;
    case 'close': UI.drawer = null; renderDrawer(); if (renderPending) { renderPending = false; render(); } break;
    case 'entry-mode': UI.entry.mode = b.dataset.mode; UI.entry.vals = {}; render(); break;
    case 'entry-only': UI.entry.onlyNeed = b.checked; render(); break;
    case 'entry-clear': UI.entry.vals = {}; render(); break;
    case 'entry-save': {
      const E = UI.entry, rows = []; let bad = 0;
      for (const st of c.students) {
        const v = E.vals[st.id]; if (!v || v.ok === '' || v.ok == null) continue;
        const sc = parseScore(v.ok, v.n || E.n);
        if (!sc) { bad++; const el = $('#ok-' + CSS.escape(st.id)); if (el) el.classList.add('bad'); continue; }
        rows.push(logRow(c.id, E.mode === 'step'
          ? { t: 'step', d: E.date || todayStr(), sid: st.id, pid: E.pid, step: E.step, ok: sc.ok, n: sc.n, m: v.m || '' }
          : { t: 'var', d: E.date || todayStr(), sid: st.id, pid: E.pid, type: E.type, src: E.src || '', ok: sc.ok, n: sc.n, m: v.m || '' }));
      }
      if (bad) { toast(`${bad}명의 점수를 확인하세요. 총문항이 비었거나 맞은수가 총문항보다 큽니다.`, 'bad'); return; }
      E.vals = {}; await Store.put(rows); toast(`${rows.length}명 기록을 저장했습니다`);
      break;
    }
    case 'd-add-step': {
      const s = b.dataset.step, ok = $('#d-ok-' + CSS.escape(s)).value, n = $('#d-n-' + CSS.escape(s)).value, m = $('#d-m-' + CSS.escape(s)).value;
      const sc = parseScore(ok, n); if (!sc) { toast('맞은수와 총문항을 확인하세요.', 'bad'); return; }
      const date = $('#d-date').value || todayStr(); UI.drawer.date = date;
      await Store.put([logRow(c.id, { t: 'step', d: date, sid: UI.drawer.sid, pid: UI.drawer.pid, step: s, ok: sc.ok, n: sc.n, m: m.trim() })]);
      break;
    }
    case 'd-add-var': {
      const sc = parseScore($('#d-vok').value, $('#d-vn').value); if (!sc) { toast('맞은수와 문항수를 확인하세요.', 'bad'); return; }
      const date = $('#d-date').value || todayStr(); UI.drawer.date = date;
      await Store.put([logRow(c.id, { t: 'var', d: date, sid: UI.drawer.sid, pid: UI.drawer.pid, type: $('#d-vtype').value, src: $('#d-vsrc').value.trim(), ok: sc.ok, n: sc.n, m: $('#d-vm').value.trim() })]);
      break;
    }
    case 'del-log': {
      if (!armed(b)) return;
      const r = Store.rows.get(b.dataset.id); if (r) await Store.put([{ ...r, deleted: true }]);
      toast('기록을 삭제했습니다'); break;
    }
    case 'save-settings': saveSettings(); break;
    case 'del-class': if (!armed(b)) return; deleteClass(); break;
    case 'export-csv': exportCSV(); break;
    case 'export-json': exportJSON(); break;
    case 'import-json': $('#importFile').click(); break;
    case 'connect': connect($('#rm-url').value, $('#rm-key').value); break;
    case 'disconnect': if (!armed(b)) return; lsSet(LS_REMOTE, { off: true }); lsDel(LS_CACHE); lsDel(LS_PENDING); location.reload(); break;
    case 'copy-share': copyText(shareLink(), '공유 링크를 복사했습니다'); break;
    case 'copy-sql': copyText(SQL, 'SQL을 복사했습니다'); break;
    case 'upload-local': {
      const rows = lsGet(LS_ROWS, []).map(r => ({ ...strip(r), deleted: false }));
      await Store.put(rows); lsDel(LS_ROWS); toast(`${rows.length}건을 공유 서버로 올렸습니다`); render(); break;
    }
    case 'install': if (deferredInstall) { deferredInstall.prompt(); deferredInstall = null; render(); } break;
  }
});

document.addEventListener('input', e => {
  const t = e.target;
  if (t.dataset.entry) {
    const v = UI.entry.vals[t.dataset.sid] = UI.entry.vals[t.dataset.sid] || {};
    v[t.dataset.entry] = t.value; t.classList.remove('bad');
    const btn = $('[data-act="entry-save"]');
    if (btn) { const n = Object.values(UI.entry.vals).filter(x => x.ok !== '' && x.ok != null).length; btn.disabled = !n; btn.textContent = `${n}명 기록 저장`; }
  } else if (t.dataset.sd) {
    const d = UI.sdraft; if (!d) return;
    if (t.dataset.sd === 'step-name') d.steps[+t.dataset.i].name = t.value;
    else if (t.dataset.sd === 'step-th') d.steps[+t.dataset.i].th = t.value;
    else d[t.dataset.sd] = t.value;
    if (!d.dirty) { d.dirty = true; const btn = $('[data-act="save-settings"]'); if (btn) { btn.disabled = false; btn.previousElementSibling.textContent = '저장하지 않은 변경이 있습니다'; } }
  }
});

document.addEventListener('change', e => {
  const t = e.target;
  if (t.dataset.ef) {
    const E = UI.entry; E[t.dataset.ef] = t.value;
    if (t.dataset.ef === 'pid' || t.dataset.ef === 'step' || t.dataset.ef === 'type') { E.vals = {}; t.blur(); render(); }
  }
  if (t.id === 'importFile' && t.files[0]) { importJSON(t.files[0]); t.value = ''; }
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && UI.drawer) { UI.drawer = null; renderDrawer(); return; }
  const t = e.target;
  if (e.key === 'Enter' && t.dataset && t.dataset.entry === 'ok') {
    e.preventDefault();
    const all = [...document.querySelectorAll('input[data-entry="ok"]')]; const i = all.indexOf(t);
    if (all[i + 1]) { all[i + 1].focus(); all[i + 1].select(); } else t.blur();
  }
});

/* ================= 앱 설치(PWA) ================= */
let deferredInstall = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredInstall = e; if (UI.tab === 'settings' || !curClassRow()) scheduleRender(); });
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});

/* ================= 시작 ================= */
(function joinFromLink() {
  const m = location.hash.match(/^#join=([\w-]+)/);
  if (!m) return;
  try {
    const o = JSON.parse(b64d(m[1]));
    if (okUrl(o.u) && o.k) {
      const prev = lsGet(LS_REMOTE, null);
      if (!prev || prev.u !== o.u || prev.k !== o.k) { lsSet(LS_REMOTE, { u: o.u, k: o.k }); lsDel(LS_CACHE); lsDel(LS_PENDING); }
      UI.joined = true;
    }
  } catch { /* 잘못된 링크는 무시 */ }
  history.replaceState(null, '', location.pathname + location.search);
})();

Store.on(scheduleRender);
render();
Store.init().then(() => { if (UI.joined) toast('공유 반에 연결되었습니다. 로그인 없이 바로 쓰면 됩니다.'); });
