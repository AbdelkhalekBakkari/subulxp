/* Subul XP CRM — SPA sans build. Toute donnée dynamique passe par esc() avant insertion HTML. */
(() => {
'use strict';

/* ---------- Utilitaires ---------- */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const attr = esc;
const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const fmtDateTime = (iso) => iso ? new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
const fmtTime = (iso) => iso ? new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—';
const fmtRel = (iso) => {
  if (!iso) return '—';
  const d = (Date.now() - new Date(iso)) / 1000;
  if (d < 60) return 'à l\'instant'; if (d < 3600) return `il y a ${Math.floor(d / 60)} min`;
  if (d < 86400) return `il y a ${Math.floor(d / 3600)} h`; if (d < 86400 * 30) return `il y a ${Math.floor(d / 86400)} j`;
  return fmtDate(iso);
};
const dayLabel = (iso) => {
  const d = new Date(iso); const t = new Date(); t.setHours(0, 0, 0, 0);
  const diff = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - t) / 86400000);
  if (diff === 0) return 'Aujourd\'hui'; if (diff === 1) return 'Demain'; if (diff === -1) return 'Hier';
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
};
const fmtSize = (n) => n < 1024 ? `${n} o` : n < 1048576 ? `${(n / 1024).toFixed(0)} Ko` : `${(n / 1048576).toFixed(1)} Mo`;
const initials = (name) => String(name || '?').split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
const waLink = (n) => n ? `https://wa.me/${String(n).replace(/\D/g, '')}` : null;
const toLocalInput = (iso) => { if (!iso) return ''; const d = new Date(iso); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

/* ---------- Thème ---------- */
function applyTheme() {
  let pref = null;
  try { pref = localStorage.getItem('sxp-theme'); } catch { /* stockage indisponible */ }
  const dark = pref ? pref === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
}
function toggleTheme() {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  try { localStorage.setItem('sxp-theme', next); } catch { /* ignore */ }
  applyTheme(); render();
}
applyTheme();

/* ---------- Icônes (inline SVG) ---------- */
const svg = (d, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${d}</svg>`;
const I = {
  home: svg('<path d="M3 11l9-8 9 8v9a2 2 0 0 1-2 2h-4v-7H9v7H5a2 2 0 0 1-2-2z"/>'),
  users: svg('<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>'),
  book: svg('<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>'),
  cal: svg('<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>'),
  shield: svg('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>'),
  list: svg('<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>'),
  cog: svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>'),
  out: svg('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>'),
  wa: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.6.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 11.9 11.9 0 0 0 4.6 4c1.7.7 2.3.8 3.2.7a2.7 2.7 0 0 0 1.8-1.3 2.2 2.2 0 0 0 .2-1.3c-.1-.1-.3-.2-.5-.3z"/></svg>',
  mail: svg('<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 6l-10 7L2 6"/>'),
  phone: svg('<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>'),
  note: svg('<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4z"/>'),
  meet: svg('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>'),
  flag: svg('<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>', 'stroke-width="2.5"'),
  dl: svg('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>'),
  up: svg('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>'),
  edit: svg('<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>'),
  menu: svg('<path d="M3 6h18M3 12h18M3 18h18"/>'),
  back: svg('<path d="M19 12H5M12 19l-7-7 7-7"/>'),
  check: svg('<path d="M20 6L9 17l-5-5"/>', 'stroke-width="2.5"'),
  checkCircle: svg('<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/>'),
  alert: svg('<circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>'),
  info: svg('<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>'),
  search: svg('<circle cx="11" cy="11" r="8"/><path d="M21 21l-4.3-4.3"/>'),
  sun: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
  moon: svg('<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>'),
  table: svg('<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/>'),
  kanban: svg('<rect x="3" y="3" width="5" height="18" rx="1"/><rect x="10" y="3" width="5" height="12" rx="1"/><rect x="17" y="3" width="5" height="8" rx="1"/>'),
  inbox: svg('<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5.1L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.8 4H7.2a2 2 0 0 0-1.7 1.1z"/>'),
  trend: svg('<path d="M23 6l-9.5 9.5-5-5L1 18"/><path d="M17 6h6v6"/>'),
  clock: svg('<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>'),
  target: svg('<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>'),
  spark: svg('<path d="M12 2l1.8 5.5L19 9l-4.5 3.3L16 18l-4-3-4 3 1.5-5.7L5 9l5.2-1.5z"/>'),
  file: svg('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>'),
  upload: svg('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>'),
  trash: svg('<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14z"/>'),
  key: svg('<path d="M21 2l-2 2m-7.6 7.6a5.5 5.5 0 1 1-7.8 7.8 5.5 5.5 0 0 1 7.8-7.8zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>'),
};
const ACT_ICON = { note: I.note, call: I.phone, whatsapp: I.wa, email: I.mail, meeting: I.meet, stage_change: I.flag, system: I.list };
const ACT_LABEL = { note: 'Note', call: 'Appel', whatsapp: 'WhatsApp', email: 'Email', meeting: 'Réunion', stage_change: 'Changement d\'étape', system: 'Système' };
const SUBJECT_LABEL = { draft: 'Brouillon', open: 'Ouvert', in_progress: 'En cours', completed: 'Terminé', archived: 'Archivé' };
const SESSION_LABEL = { planned: 'Planifiée', done: 'Réalisée', cancelled: 'Annulée' };
const ATT_LABEL = { present: 'Présent', late: 'En retard', absent: 'Absent', excused: 'Excusé' };
const MODE_LABEL = { onsite: 'Sur site', online: 'En ligne' };
const SOURCE_LABEL = { landing: 'Formulaire landing', whatsapp: 'WhatsApp', referral: 'Recommandation', school: 'École', linkedin: 'LinkedIn', import: 'Import CSV', other: 'Autre' };
const STAGE_COLOR = { lead: 'var(--blue)', contacted: 'var(--amber)', lab_scheduled: 'var(--purple)', active: 'var(--green)', completed: 'var(--indigo)', dropped: 'var(--red)' };
const STAGE_SEQ = { lead: 'var(--seq-2)', contacted: 'var(--seq-3)', lab_scheduled: 'var(--seq-4)', active: 'var(--seq-5)', completed: 'var(--seq-6)', dropped: 'var(--line-strong)' };

/* ---------- Feedback ---------- */
function toast(msg, kind = '') {
  const el = document.createElement('div');
  el.className = 'toast' + (kind ? ' toast-' + (kind === 'err' ? 'error' : kind) : '');
  el.innerHTML = `${kind === 'ok' ? I.checkCircle : kind === 'err' ? I.alert : I.info}<span></span>`;
  el.lastChild.textContent = msg;
  $('#toasts').appendChild(el);
  setTimeout(() => el.remove(), 3800);
}
/** État de chargement d'un bouton : désactivé + spinner, annoncé aux lecteurs d'écran. */
function setLoading(btn, on) {
  if (!btn) return;
  btn.disabled = on; btn.classList.toggle('is-loading', on); btn.setAttribute('aria-busy', on ? 'true' : 'false');
}

/* ---------- API ---------- */
class ApiError extends Error { constructor(status, body) { super(body?.error || 'Erreur'); this.status = status; this.details = body?.details; } }
async function api(method, path, body) {
  const res = await fetch('/api' + path, {
    method, headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
    body: body === undefined ? undefined : JSON.stringify(body), credentials: 'same-origin',
  });
  if (res.status === 401 && !path.startsWith('/auth/login')) { state.user = null; render(); throw new ApiError(401, { error: 'Session expirée' }); }
  const ct = res.headers.get('content-type') || '';
  const data = ct.includes('json') ? await res.json() : await res.text();
  if (!res.ok) throw new ApiError(res.status, typeof data === 'object' ? data : { error: data });
  return data;
}
const GET = (p) => api('GET', p), POST = (p, b) => api('POST', p, b ?? {}), PATCH = (p, b) => api('PATCH', p, b), PUT = (p, b) => api('PUT', p, b), DEL = (p) => api('DELETE', p);

/* ---------- État ---------- */
const state = { user: null, meta: null, directory: [], route: { name: 'dashboard', params: {} }, detailTab: {} };
const isManager = () => state.user && (state.user.role === 'admin' || state.user.role === 'project_manager');
const isAdmin = () => state.user && state.user.role === 'admin';
const supervisors = () => state.directory.filter((u) => u.role === 'supervisor' || u.role === 'admin');
const managers = () => state.directory.filter((u) => u.role === 'project_manager' || u.role === 'admin');

/* ---------- Composants ---------- */
const badge = (text, cls = '', plain = false) => `<span class="badge badge-${attr(cls)}${plain ? ' badge-plain' : ''}">${esc(text)}</span>`;
const stageBadge = (s) => badge(state.meta?.stage_labels[s] || s, s);
const avatar = (name, cls = '') => `<span class="avatar ${attr(cls)}" aria-hidden="true">${esc(initials(name))}</span>`;
const rateBar = (rate) => rate == null ? '<span class="muted">—</span>' : `<span class="rate ${rate < 60 ? 'rate-low' : rate < 80 ? 'rate-mid' : ''}"><span class="rate-track"><span class="rate-fill" style="width:${rate}%"></span></span>${rate}%</span>`;
function ring(rate, cls = '') {
  const r = 28, c = 2 * Math.PI * r; const v = rate == null ? 0 : Math.max(0, Math.min(100, rate));
  const tone = rate == null ? '' : rate < 60 ? 'ring-low' : rate < 80 ? 'ring-mid' : '';
  return `<span class="ring ${attr(cls)} ${tone}" role="img" aria-label="Taux de présence ${rate == null ? 'inconnu' : rate + ' %'}"><svg viewBox="0 0 64 64"><circle class="ring-track" cx="32" cy="32" r="${r}"/><circle class="ring-value" cx="32" cy="32" r="${r}" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - v / 100)}"/></svg><span class="ring-label">${rate == null ? 'n/a' : rate + '%'}</span></span>`;
}
function sparkline(values, label) {
  const w = 96, h = 34, max = Math.max(1, ...values); const n = values.length;
  const pts = values.map((v, i) => [n === 1 ? w : (i / (n - 1)) * w, h - 3 - (v / max) * (h - 6)]);
  const line = pts.map((p) => p.map((x) => x.toFixed(1)).join(',')).join(' ');
  const last = pts[pts.length - 1];
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" role="img" aria-label="${attr(label)}"><title>${esc(label)}</title><polygon class="spark-area" points="0,${h} ${line} ${w},${h}"/><polyline class="spark-line" points="${line}"/><circle class="spark-dot" cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="3"/></svg>`;
}
function donut(entries) {
  const total = entries.reduce((a, e) => a + e.value, 0);
  const r = 56, c = 2 * Math.PI * r; let offset = 0;
  const arcs = entries.map((e, i) => {
    if (!e.value) return '';
    const len = (e.value / total) * c; const gap = entries.filter((x) => x.value).length > 1 ? 2 : 0;
    const el = `<circle r="${r}" cx="75" cy="75" fill="none" stroke="var(--series-${i + 1})" stroke-width="18" stroke-dasharray="${Math.max(0, len - gap)} ${c - Math.max(0, len - gap)}" stroke-dashoffset="${-offset}"><title>${esc(e.label)} : ${e.value} (${Math.round((e.value / total) * 100)} %)</title></circle>`;
    offset += len; return el;
  }).join('');
  return `<div class="donut-wrap"><svg class="donut" viewBox="0 0 150 150" role="img" aria-label="Répartition par domaine">${total ? `<g transform="rotate(-90 75 75)">${arcs}</g>` : `<circle r="${r}" cx="75" cy="75" fill="none" stroke="var(--viz-track)" stroke-width="18"/>`}
      <text x="75" y="72" text-anchor="middle" class="donut-center">${total}</text><text x="75" y="88" text-anchor="middle" class="donut-center-label">étudiants</text></svg>
    <div class="list">${entries.map((e, i) => `<div class="legend-item"><span class="legend-swatch" style="background:var(--series-${i + 1})"></span><span>${esc(e.label)}</span><b>${e.value}</b></div>`).join('')}</div></div>`;
}
function funnel(byStage) {
  const m = state.meta; const total = Object.values(byStage).reduce((a, b) => a + b, 0) || 1;
  const stages = m.stages.filter((s) => s !== 'dropped'); const dropped = byStage.dropped || 0;
  return `<div class="funnel"><div class="funnel-bar" role="img" aria-label="Pipeline par étape">${stages.map((s) => byStage[s] ? `<span class="funnel-seg" style="flex:${byStage[s]};background:${STAGE_SEQ[s]}" title="${attr(m.stage_labels[s])} : ${byStage[s]}"></span>` : '').join('')}</div>
    <div class="funnel-legend">${[...stages, 'dropped'].map((s) => `<div class="legend-item"><span class="legend-swatch" style="background:${STAGE_SEQ[s]}"></span><span>${esc(m.stage_labels[s])}</span><b>${byStage[s] || 0} <small class="muted">· ${Math.round(((byStage[s] || 0) / total) * 100)} %</small></b></div>`).join('')}</div>
    ${dropped ? '' : ''}</div>`;
}
const contactIcons = (s) => `${s.whatsapp ? `<a class="icon-link icon-link-whatsapp" href="${attr(waLink(s.whatsapp))}" target="_blank" rel="noopener" title="WhatsApp ${attr(s.whatsapp)}" aria-label="WhatsApp">${I.wa}</a>` : ''}
  ${s.email ? `<a class="icon-link" href="mailto:${attr(s.email)}" title="${attr(s.email)}" aria-label="Email">${I.mail}</a>` : ''}`;
const options = (list, selected, labelFn = (x) => x, valueFn = (x) => x, placeholder = '— Aucun —') =>
  `<option value="">${esc(placeholder)}</option>` + list.map((x) => `<option value="${attr(valueFn(x))}" ${String(valueFn(x)) === String(selected ?? '') ? 'selected' : ''}>${esc(labelFn(x))}</option>`).join('');
const userOptions = (list, selected) => options(list, selected, (u) => u.name, (u) => u.id);
const REQUIRED_DOCS = ['cahier_des_charges', 'demande_de_stage', 'convention_de_stage'];
const docDots = (types = []) => `<span class="doc-dots" title="${attr(REQUIRED_DOCS.map((t) => `${state.meta.document_labels[t]} : ${types.includes(t) ? 'déposé' : 'manquant'}`).join(' · '))}">${REQUIRED_DOCS.map((t) => `<i class="${types.includes(t) ? 'is-on' : ''}"></i>`).join('')}</span>`;
function documentsPanel(studentId, docs) {
  const m = state.meta; const byType = (t) => docs.filter((d) => d.type === t);
  const slot = (t) => { const d = byType(t)[0]; return `<div class="doc-slot ${d ? 'is-done' : ''}">
      <div class="doc-slot-icon">${d ? I.checkCircle : I.file}</div>
      <div class="doc-slot-body"><b>${esc(m.document_labels[t])}</b>${d ? `<span class="small muted">${esc(d.label)} · ${fmtSize(d.size)} · ${esc(fmtDate(d.created_at))}${d.uploaded_by_name ? ' · ' + esc(d.uploaded_by_name) : ''}</span>` : `<span class="small muted">Aucun fichier déposé</span>`}</div>
      <div class="actions">${d ? `<a class="btn btn-sm" href="/api/students/${studentId}/documents/${d.id}/download">${I.dl} Télécharger</a><button type="button" class="btn btn-sm btn-ghost btn-danger" data-doc-del="${d.id}" aria-label="Supprimer">${I.trash}</button>` : ''}<button type="button" class="btn btn-sm ${d ? '' : 'btn-primary'}" data-doc-upload="${t}">${I.upload} ${d ? 'Remplacer' : 'Déposer'}</button></div></div>`; };
  const others = byType('autre');
  return `<div class="grid grid-main-side">
    <div class="card"><div class="card-header"><h2>${I.file} Pièces du dossier</h2><span class="small muted">${REQUIRED_DOCS.filter((t) => byType(t).length).length}/3 déposées</span></div><div class="card-body doc-slots">${REQUIRED_DOCS.map(slot).join('')}</div></div>
    <div class="card"><div class="card-header"><h2>${I.upload} Autres documents</h2><button type="button" class="btn btn-sm" data-doc-upload="autre">${I.plus} Ajouter</button></div><div class="card-body">
      ${others.length ? `<div class="list">${others.map((d) => `<div class="list-item"><span class="doc-slot-icon">${I.file}</span><span class="list-item-what"><b>${esc(d.label)}</b><span>${fmtSize(d.size)} · ${esc(fmtDate(d.created_at))}${d.uploaded_by_name ? ' · ' + esc(d.uploaded_by_name) : ''}</span></span><a class="icon-link" href="/api/students/${studentId}/documents/${d.id}/download" title="Télécharger" aria-label="Télécharger">${I.dl}</a><button type="button" class="btn btn-sm btn-ghost btn-danger" data-doc-del="${d.id}" aria-label="Supprimer">${I.trash}</button></div>`).join('')}</div>` : emptyState(I.inbox, 'Aucun autre document', 'CV, attestation, lettre de motivation… PDF, Word ou image, 15 Mo max.')}
    </div></div></div>
    <input type="file" id="doc-file" class="hidden" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg">`;
}
async function uploadDocument(studentId, type, file) {
  const res = await fetch(`/api/students/${studentId}/documents?type=${encodeURIComponent(type)}&name=${encodeURIComponent(file.name)}`, {
    method: 'POST', headers: { 'Content-Type': file.type || 'application/octet-stream', 'X-Requested-With': 'XMLHttpRequest' }, body: file, credentials: 'same-origin',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data);
  return data;
}
const emptyState = (icon, title, text, cta = '') => `<div class="empty">${icon}<b>${esc(title)}</b><p>${esc(text)}</p>${cta}</div>`;
const skeleton = () => `<div class="skeleton sk-title"></div><div class="grid grid-4 mb-5">${'<div class="skeleton sk-card"></div>'.repeat(4)}</div><div class="card"><div class="card-body">${'<div class="skeleton sk-line"></div>'.repeat(6)}</div></div>`;

function field(name, label, inputHtml, hint) {
  return `<div class="field" data-field="${attr(name)}"><label for="f-${attr(name)}">${esc(label)}</label>${inputHtml}${hint ? `<span class="small muted">${esc(hint)}</span>` : ''}<span class="field-error" hidden></span></div>`;
}
const input = (name, value = '', type = 'text', extra = '') => `<input type="${type}" id="f-${attr(name)}" name="${attr(name)}" value="${attr(value)}" ${extra}>`;
const select = (name, opts, extra = '') => `<select id="f-${attr(name)}" name="${attr(name)}" ${extra}>${opts}</select>`;
const textarea = (name, value = '', extra = '') => `<textarea id="f-${attr(name)}" name="${attr(name)}" ${extra}>${esc(value)}</textarea>`;
const chips = (name, list, selected = []) => `<div class="chips">${list.map((d) => `<label><input type="checkbox" name="${attr(name)}" value="${attr(d)}" ${selected.includes(d) ? 'checked' : ''}><span>${esc(d)}</span></label>`).join('')}</div>`;

function formData(form) {
  const out = {};
  for (const el of form.elements) {
    if (!el.name || el.disabled) continue;
    if (el.type === 'checkbox') { (out[el.name] ||= []); if (el.checked) out[el.name].push(el.value); }
    else if (el.type === 'radio') { if (el.checked) out[el.name] = el.value; }
    else out[el.name] = el.value;
  }
  return out;
}
function showErrors(form, err) {
  $$('.field-error', form).forEach((e) => { e.hidden = true; e.textContent = ''; });
  $$('[aria-invalid]', form).forEach((e) => e.removeAttribute('aria-invalid'));
  const box = $('.form-error', form); if (box) box.remove();
  if (err.details && typeof err.details === 'object') {
    for (const [k, msg] of Object.entries(err.details)) {
      const f = form.querySelector(`[data-field="${CSS.escape(k)}"]`);
      if (f) { const e = $('.field-error', f); e.textContent = msg; e.hidden = false; const inp = $('input,select,textarea', f); if (inp) inp.setAttribute('aria-invalid', 'true'); }
    }
  }
  ($('.card-body', form) || form).insertAdjacentHTML('afterbegin', `<div class="form-error" role="alert">${esc(err.message)}</div>`);
}

function modal({ title, body, submitLabel = 'Enregistrer', onSubmit, wide = false, danger = false }) {
  const d = document.createElement('dialog');
  if (wide) d.classList.add('dialog-wide');
  const titleId = 'dlg-' + Math.random().toString(36).slice(2, 8);
  d.setAttribute('aria-labelledby', titleId);
  d.innerHTML = `<form method="dialog" novalidate>
    <div class="card-header"><h2 id="${titleId}">${esc(title)}</h2><button type="button" class="dialog-close" aria-label="Fermer">×</button></div>
    <div class="card-body">${body}</div>
    <div class="card-footer"><button type="button" class="btn cancel">Annuler</button>${onSubmit ? `<button type="submit" class="btn ${danger ? 'btn-danger' : 'btn-primary'}">${esc(submitLabel)}</button>` : ''}</div>
  </form>`;
  document.body.appendChild(d);
  const close = () => { d.close(); d.remove(); };
  $('.dialog-close', d).onclick = close; $('.cancel', d).onclick = close;
  d.addEventListener('cancel', (e) => { e.preventDefault(); close(); });
  const form = $('form', d);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!onSubmit) return close();
    const btn = $('button[type=submit]', form); setLoading(btn, true);
    try { await onSubmit(formData(form), form); close(); }
    catch (err) { showErrors(form, err); setLoading(btn, false); }
  });
  d.showModal();
  const first = $('input:not([type=hidden]),select,textarea', d); if (first) first.focus();
  return d;
}
function confirmModal(title, text, { label = 'Confirmer', danger = true } = {}) {
  return new Promise((resolve) => {
    const d = modal({ title, body: `<p>${esc(text)}</p>`, submitLabel: label, danger, onSubmit: async () => resolve(true) });
    d.addEventListener('close', () => resolve(false));
  });
}

/* ---------- Routeur ---------- */
const ROUTES = [
  ['dashboard', /^\/?$/], ['students', /^\/students$/], ['student', /^\/students\/(\d+)$/],
  ['subjects', /^\/subjects$/], ['subject', /^\/subjects\/(\d+)$/], ['sessions', /^\/sessions$/], ['session', /^\/sessions\/(\d+)$/],
  ['users', /^\/users$/], ['audit', /^\/audit$/], ['settings', /^\/settings$/], ['profile', /^\/profile$/],
];
function parseRoute() {
  const hash = location.hash.replace(/^#/, '') || '/';
  const [path, qs] = hash.split('?');
  const query = Object.fromEntries(new URLSearchParams(qs || ''));
  for (const [name, re] of ROUTES) { const m = path.match(re); if (m) return { name, params: { id: m[1] ? Number(m[1]) : undefined }, query }; }
  return { name: 'dashboard', params: {}, query };
}
const go = (path) => { location.hash = '#' + path; };
const qsOf = (obj) => new URLSearchParams(Object.entries(obj).filter(([, v]) => v)).toString();

/* ---------- Rendu principal ---------- */
const app = $('#app');
async function render() {
  state.route = parseRoute();
  if (!state.user) return renderLogin();
  if (!state.meta) { const [meta, dir] = await Promise.all([GET('/meta'), GET('/users/directory')]); state.meta = meta; state.directory = dir.users; }
  const view = VIEWS[state.route.name] || VIEWS.dashboard;
  if (view.roles && !view.roles.includes(state.user.role)) return go('/');
  app.innerHTML = layout(skeleton());
  mountShell();
  try { $('.main', app).innerHTML = await view.render(state.route); view.mount?.(state.route); }
  catch (e) { if (e.status !== 401) $('.main', app).innerHTML = `<div class="card">${emptyState(I.alert, 'Erreur', e.message)}</div>`; }
}
function layout(content) {
  const u = state.user; const r = state.route.name; const dark = document.documentElement.dataset.theme === 'dark';
  const link = (name, path, icon, label, active = [name]) => `<a href="#${path}" class="${active.includes(r) ? 'active' : ''}" ${active.includes(r) ? 'aria-current="page"' : ''}>${icon}${esc(label)}</a>`;
  return `<div class="shell">
    <aside class="sidebar" id="sidebar">
      <a class="brand" href="#/"><span class="brand-tile"><img src="/assets/subul-mark.webp" alt="Subul"></span><span class="brand-name">Subul XP<small>CRM résidence</small></span></a>
      <nav class="nav" aria-label="Navigation principale">
        ${link('dashboard', '/', I.home, 'Tableau de bord')}
        ${link('students', '/students', I.users, 'Étudiants', ['students', 'student'])}
        ${link('subjects', '/subjects', I.book, 'Sujets', ['subjects', 'subject'])}
        ${link('sessions', '/sessions', I.cal, 'Séances & présences', ['sessions', 'session'])}
        ${isAdmin() ? `<div class="nav-section">Administration</div>${link('users', '/users', I.shield, 'Utilisateurs')}${link('audit', '/audit', I.list, 'Journal d\'audit')}${link('settings', '/settings', I.cog, 'Paramètres')}` : ''}
      </nav>
      <div class="sidebar-footer">
        <a class="profile-card" href="#/profile" title="Mon profil">${avatar(u.name)}<span class="profile-card-who"><b>${esc(u.name)}</b><span>${esc(state.meta.role_labels[u.role])}</span></span></a>
        <div class="sidebar-actions">
          <button type="button" class="sidebar-btn" data-theme-toggle aria-pressed="${dark}" title="${dark ? 'Passer en clair' : 'Passer en sombre'}">${dark ? I.sun : I.moon} ${dark ? 'Clair' : 'Sombre'}</button>
          <button type="button" class="sidebar-btn" data-logout>${I.out} Déconnexion</button>
        </div>
        <div class="sidebar-signature">un outil <img src="/assets/smartovate-logo.webp" alt="Smartovate"></div>
      </div>
    </aside>
    <main class="main" id="main">${content}</main>
  </div>`;
}
function topbar(title, actionsHtml = '', { crumbs = '', subtitle = '', search = true } = {}) {
  return `<div class="topbar"><div class="topbar-heading"><button class="btn btn-ghost btn-icon burger" type="button" aria-label="Menu" aria-expanded="false" aria-controls="sidebar">${I.menu}</button><div>${crumbs ? `<div class="crumbs">${crumbs}</div>` : ''}<h1>${title}</h1>${subtitle ? `<div class="page-subtitle">${subtitle}</div>` : ''}</div></div>
    <div class="actions">${search ? `<div class="global-search" id="global-search">${I.search.replace('<svg', '<svg class="gs-icon"')}<input type="search" placeholder="Rechercher un étudiant, un sujet…" aria-label="Recherche globale" autocomplete="off"><kbd>Ctrl K</kbd></div>` : ''}${actionsHtml}</div></div>`;
}
function mountShell() {
  $('[data-theme-toggle]')?.addEventListener('click', toggleTheme);
}
document.addEventListener('click', async (e) => {
  if (e.target.closest('[data-logout]')) { e.preventDefault(); await POST('/auth/logout'); state.user = null; state.meta = null; go('/'); render(); }
  if (e.target.closest('.burger')) { const open = $('#sidebar').classList.toggle('open'); $('.burger').setAttribute('aria-expanded', String(open)); }
  if (e.target.closest('#sidebar a') && !e.target.closest('[data-logout]')) $('#sidebar')?.classList.remove('open');
  if (!e.target.closest('#global-search')) $('.gs-results')?.remove();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { $('#sidebar')?.classList.remove('open'); $('.gs-results')?.remove(); }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { const inp = $('#global-search input'); if (inp) { e.preventDefault(); inp.focus(); inp.select(); } }
});
/* Recherche globale (délégation : le topbar est re-rendu à chaque vue) */
const globalSearch = debounce(async (q, box) => {
  if (!q.trim()) { $('.gs-results', box)?.remove(); return; }
  const [st, sub] = await Promise.all([GET('/students?size=6&q=' + encodeURIComponent(q)), GET('/subjects?q=' + encodeURIComponent(q))]);
  let html = '';
  if (st.students.length) html += `<div class="gs-group">Étudiants</div>` + st.students.map((s) => `<a class="gs-item" href="#/students/${s.id}">${avatar(s.first_name + ' ' + s.last_name, 'avatar-sm')}<span><b>${esc(s.first_name + ' ' + s.last_name)}</b><span>${esc(state.meta.stage_labels[s.stage])} · ${esc(s.level || '—')} · ${s.domains.map(esc).join(', ') || '—'}</span></span></a>`).join('');
  if (sub.subjects.length) html += `<div class="gs-group">Sujets</div>` + sub.subjects.slice(0, 5).map((x) => `<a class="gs-item" href="#/subjects/${x.id}">${I.book}<span><b>${esc(x.title)}</b><span>${esc(x.domain)} · ${esc(x.supervisor_name || '—')}</span></span></a>`).join('');
  if (!html) html = `<div class="gs-empty">Aucun résultat pour « ${esc(q)} »</div>`;
  $('.gs-results', box)?.remove();
  box.insertAdjacentHTML('beforeend', `<div class="gs-results" role="listbox">${html}</div>`);
}, 220);
document.addEventListener('input', (e) => { const box = e.target.closest('#global-search'); if (box) globalSearch(e.target.value, box); });
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.closest('#global-search')) { const first = $('.gs-results .gs-item'); if (first) { e.preventDefault(); go(first.getAttribute('href').slice(1)); $('.gs-results')?.remove(); } }
});

/* ---------- Connexion ---------- */
function renderLogin() {
  app.innerHTML = `<div class="login">
    <section class="login-hero" aria-label="Présentation">
      <div><span class="login-logo"><img src="/assets/subul-logo.webp" alt="Subul — Shaping the Digital Future Together"></span></div>
      <div>
        <p class="login-tagline">Le CRM de la résidence technique.</p>
        <p class="login-lead">Suivez vos étudiants, vos sujets et vos séances au même endroit, avec les encadrants industriels et les project managers.</p>
        <ul class="login-features">
          <li>${I.checkCircle} Pipeline de recrutement, du lead à la résidence</li>
          <li>${I.checkCircle} Présences et taux d'assiduité par étudiant</li>
          <li>${I.checkCircle} Contact direct WhatsApp et email</li>
        </ul>
      </div>
      <div class="login-signature">un outil <img src="/assets/smartovate-logo.webp" alt="Smartovate"></div>
    </section>
    <section class="login-panel"><div class="login-form">
      <div class="login-mobile-brand"><img src="/assets/subul-mark.webp" alt="Subul"><b>CRM résidence</b></div>
      <h1>Connexion</h1><p class="muted mb-6">Accès réservé aux encadrants, project managers et administrateurs.</p>
      <form id="login" novalidate>
        ${field('email', 'Email', input('email', '', 'email', 'autocomplete="username" required'))}
        ${field('password', 'Mot de passe', input('password', '', 'password', 'autocomplete="current-password" required'))}
        <button class="btn btn-primary" type="submit">Se connecter</button>
      </form>
    </div></section></div>`;
  $('#login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target; const btn = $('button', form); setLoading(btn, true);
    try { const r = await POST('/auth/login', formData(form)); state.user = r.user; render(); }
    catch (err) { showErrors(form, err); setLoading(btn, false); }
  });
}

/* ---------- Tableau de bord ---------- */
const VIEWS = {};
VIEWS.dashboard = {
  async render() {
    const d = await GET('/dashboard');
    const k = d.kpis; const m = state.meta; const u = state.user;
    const weekly = (d.weekly_new || []).map((w) => w.count); const thisWeek = weekly[weekly.length - 1] || 0, lastWeek = weekly[weekly.length - 2] || 0;
    const delta = thisWeek - lastWeek;
    const deltaHtml = `<span class="kpi-delta ${delta < 0 ? 'is-down' : delta === 0 ? 'is-flat' : ''}">${delta > 0 ? '+' : ''}${delta} vs sem. passée</span>`;
    const hour = new Date().getHours(); const hello = hour < 18 ? 'Bonjour' : 'Bonsoir';
    const bars = (obj, max) => `<div class="bars">${Object.entries(obj).map(([key, n]) => `<div class="bar"><span>${esc(key)}</span><span class="bar-track"><span class="bar-fill" style="width:${Math.round((n / max) * 100)}%"></span></span><b>${n}</b></div>`).join('')}</div>`;
    return topbar(`${hello}, ${esc(u.name.split(' ')[0])}`, `${isManager() ? `<button class="btn btn-primary" id="new-student">${I.plus} Nouvel étudiant</button>` : `<a class="btn" href="#/sessions">${I.cal} Mes séances</a>`}`, { subtitle: `Vue d'ensemble de la résidence · ${esc(new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }))}` }) + `
    <div class="grid grid-4 mb-5">
      <div class="card kpi kpi-accent"><div class="kpi-label">${I.users} Étudiants suivis</div><div class="kpi-value">${k.students_total}</div><div class="kpi-detail">${k.students_active} en résidence active</div></div>
      <div class="card kpi kpi-with-spark"><div class="kpi-label">${I.trend} Nouveaux cette semaine</div><div class="kpi-value">${thisWeek} ${deltaHtml}</div><div class="kpi-detail">${k.new_leads_month} ce mois · ${k.unassigned} sans encadrant</div><div class="kpi-spark" style="color:var(--purple)">${sparkline(weekly.length ? weekly : [0], 'Nouveaux étudiants par semaine, 8 dernières semaines')}</div></div>
      <div class="card kpi"><div class="kpi-label">${I.target} Présence (30 j)</div><div class="kpi-value">${k.attendance_rate_30d == null ? '—' : k.attendance_rate_30d + '%'}</div><div class="kpi-detail">${k.absences_30d} absence(s) enregistrée(s)</div></div>
      <div class="card kpi"><div class="kpi-label">${I.cal} Séances cette semaine</div><div class="kpi-value">${d.sessions_this_week ?? 0}</div><div class="kpi-detail">${k.subjects_open} sujet(s) ouvert(s) · ${k.upcoming_sessions} à venir</div></div>
    </div>
    <div class="grid grid-main-side">
      <div class="grid">
        <div class="grid grid-2">
          <div class="card"><div class="card-header"><h2>${I.flag} Pipeline</h2><a href="#/students?view=kanban" class="small">Vue Kanban</a></div><div class="card-body">${funnel(d.by_stage)}</div></div>
          <div class="card"><div class="card-header"><h2>${I.book} Domaines</h2></div><div class="card-body">${donut(m.domains.map((dom) => ({ label: dom, value: d.by_domain[dom] || 0 })))}</div></div>
        </div>
        <div class="card"><div class="card-header"><h2>${I.clock} Activité récente</h2><a href="#/students" class="small">Tous les étudiants</a></div><div class="card-body">
          ${d.recent.length ? `<div class="timeline">${d.recent.map((a) => `<div class="timeline-entry timeline-${attr(a.type)}"><span class="timeline-dot">${ACT_ICON[a.type] || I.note}</span><div><div class="timeline-meta"><a href="#/students/${a.student_id}"><b>${esc(a.first_name + ' ' + a.last_name)}</b></a> · ${esc(ACT_LABEL[a.type] || a.type)} · ${esc(a.user_name || 'Système')} · ${esc(fmtRel(a.created_at))}</div><p>${esc(a.content)}</p></div></div>`).join('')}</div>` : emptyState(I.inbox, 'Aucune activité', 'Les notes, appels et changements d\'étape apparaîtront ici.')}
        </div></div>
      </div>
      <div class="grid">
        <div class="card"><div class="card-header"><h2>${I.cal} Prochaines séances</h2><a href="#/sessions" class="small">Toutes</a></div><div class="card-body">
          ${d.upcoming.length ? `<div class="list">${d.upcoming.map((s) => { const dt = new Date(s.scheduled_at); return `<a class="list-item" href="#/sessions/${s.id}"><span class="date-chip"><b>${dt.getDate()}</b><span>${esc(dt.toLocaleDateString('fr-FR', { month: 'short' }))}</span></span><span class="list-item-what"><b>${esc(s.title)}</b><span>${esc(fmtTime(s.scheduled_at))} · ${esc(s.supervisor_name || '—')} · ${esc(MODE_LABEL[s.mode])}</span></span></a>`; }).join('')}</div>` : emptyState(I.cal, 'Aucune séance planifiée', 'Planifiez un lab depuis la page Séances.')}
        </div></div>
        <div class="card"><div class="card-header"><h2>${I.alert} Étudiants à risque</h2><span class="small muted">≥ 40 % d'absences</span></div><div class="card-body">
          ${d.at_risk.length ? `<div class="list">${d.at_risk.map((s) => `<a class="list-item" href="#/students/${s.id}">${ring(Math.round(((s.total - s.absent) / s.total) * 100))}<span class="list-item-what"><b>${esc(s.first_name + ' ' + s.last_name)}</b><span>${s.absent} absence(s) sur ${s.total} séance(s)</span></span></a>`).join('')}</div>` : emptyState(I.checkCircle, 'Aucun étudiant à risque', 'Tous les étudiants en résidence sont assidus.')}
        </div></div>
        <div class="card"><div class="card-header"><h2>${I.spark} Niveaux</h2></div><div class="card-body">${bars(d.by_level, Math.max(1, ...Object.values(d.by_level)))}</div></div>
      </div>
    </div>`;
  },
  mount() { $('#new-student')?.addEventListener('click', () => studentModal()); },
};

/* ---------- Étudiants ---------- */
function studentForm(s = {}) {
  const m = state.meta;
  return `<div class="form-grid">
    ${field('first_name', 'Prénom', input('first_name', s.first_name, 'text', 'required autocomplete="off"'))}
    ${field('last_name', 'Nom', input('last_name', s.last_name, 'text', 'required autocomplete="off"'))}
    ${field('email', 'Email', input('email', s.email, 'email', 'autocomplete="off"'))}
    ${field('whatsapp', 'WhatsApp', input('whatsapp', s.whatsapp, 'tel', 'placeholder="+216 ** *** ***"'))}
    ${field('status', 'Statut', select('status', options(m.student_statuses, s.status, undefined, undefined, '— Non renseigné —')))}
    ${field('level', 'Niveau', select('level', options(m.levels, s.level, undefined, undefined, '— Non renseigné —')))}
    ${field('school', 'École / établissement', input('school', s.school))}
    ${field('city', 'Ville', input('city', s.city))}
    ${field('stage', 'Étape du pipeline', select('stage', options(m.stages, s.stage || 'lead', (x) => m.stage_labels[x], undefined, '')))}
    ${isManager() ? field('source', 'Source', select('source', options(m.sources, s.source || 'other', (x) => SOURCE_LABEL[x] || x, undefined, ''))) : ''}
    ${isManager() ? field('supervisor_id', 'Encadrant industriel', select('supervisor_id', userOptions(supervisors(), s.supervisor_id))) : ''}
    ${isManager() ? field('manager_id', 'Project manager', select('manager_id', userOptions(managers(), s.manager_id))) : ''}
    <div class="span-full">${field('domains', 'Domaines', chips('domains', m.domains, s.domains || []))}</div>
    <div class="span-full">${field('notes', 'Notes internes', textarea('notes', s.notes))}</div>
  </div>`;
}
function cleanStudentPayload(data) {
  const out = { ...data };
  for (const k of ['supervisor_id', 'manager_id']) if (k in out) out[k] = out[k] ? Number(out[k]) : null;
  if (!isManager()) { delete out.source; delete out.supervisor_id; delete out.manager_id; }
  return out;
}
function studentModal(existing) {
  modal({
    title: existing ? 'Modifier la fiche' : 'Nouvel étudiant', body: studentForm(existing || {}), wide: true,
    async onSubmit(data) {
      const payload = cleanStudentPayload(data);
      if (existing) { await PATCH(`/students/${existing.id}`, payload); toast('Fiche mise à jour', 'ok'); }
      else { const r = await POST('/students', payload); toast('Étudiant créé', 'ok'); go(`/students/${r.student.id}`); return; }
      render();
    },
  });
}
function importModal() {
  modal({
    title: 'Importer des étudiants (CSV)',
    body: `<p class="small muted">Colonnes reconnues : <b>Prénom, Nom, Email, WhatsApp, Statut, Niveau, École, Ville, Domaines, Notes</b> (séparateur , ou ;). Les domaines multiples sont séparés par « | ». Les emails déjà présents sont ignorés.</p>
      ${field('file', 'Fichier CSV', '<input type="file" id="f-file" name="file" accept=".csv,text/csv">')}
      ${field('csv', 'ou coller le contenu', textarea('csv', '', 'placeholder="Prénom;Nom;Email;WhatsApp;Niveau;Domaines"'))}`,
    submitLabel: 'Importer',
    async onSubmit(data, form) {
      let csv = data.csv; const f = $('#f-file', form).files[0];
      if (f) csv = await f.text();
      const r = await POST('/students/import', { csv });
      toast(`${r.created} créé(s), ${r.skipped} ignoré(s), ${r.errors.length} erreur(s)`, r.errors.length ? '' : 'ok');
      if (r.errors.length) console.warn('Import errors', r.errors);
      render();
    },
  });
}
const studentFilters = (query) => {
  const m = state.meta; const q = query;
  const active = ['q', 'stage', 'domain', 'level', 'supervisor_id', 'manager_id', 'source', 'archived'].filter((k) => q[k]).length;
  return `<form class="filters" id="filters">
      <input type="search" name="q" value="${attr(q.q || '')}" placeholder="Nom, email, WhatsApp, école…" aria-label="Recherche">
      <select name="stage" aria-label="Étape">${options(m.stages, q.stage, (x) => m.stage_labels[x], undefined, 'Toutes les étapes')}</select>
      <select name="domain" aria-label="Domaine">${options(m.domains, q.domain, undefined, undefined, 'Tous les domaines')}</select>
      <select name="level" aria-label="Niveau">${options(m.levels, q.level, undefined, undefined, 'Tous les niveaux')}</select>
      ${isManager() ? `<select name="supervisor_id" aria-label="Encadrant"><option value="">Tous les encadrants</option><option value="none" ${q.supervisor_id === 'none' ? 'selected' : ''}>Sans encadrant</option>${supervisors().map((u) => `<option value="${u.id}" ${String(u.id) === q.supervisor_id ? 'selected' : ''}>${esc(u.name)}</option>`).join('')}</select>
      <select name="manager_id" aria-label="Project manager">${userOptions(managers(), q.manager_id).replace('— Aucun —', 'Tous les PM')}</select>
      <select name="source" aria-label="Source">${options(m.sources, q.source, (x) => SOURCE_LABEL[x], undefined, 'Toutes les sources')}</select>` : ''}
      <label class="small muted flex-row-tight"><input type="checkbox" name="archived" value="1" ${q.archived === '1' ? 'checked' : ''}> Archivés</label>
      <button class="btn btn-sm" type="submit">Filtrer${active ? `<span class="filter-count">${active}</span>` : ''}</button><a class="btn btn-sm btn-ghost" href="#/students${q.view ? '?view=' + attr(q.view) : ''}">Réinitialiser</a>
    </form>`;
};
VIEWS.students = {
  async render({ query }) {
    const view = query.view === 'kanban' ? 'kanban' : 'table';
    const q = { ...query }; delete q.view;
    const m = state.meta;
    const head = (total) => topbar('Étudiants', `<div class="btn-group" role="group" aria-label="Affichage"><button type="button" class="${view === 'table' ? 'active' : ''}" data-view="table">${I.table} Liste</button><button type="button" class="${view === 'kanban' ? 'active' : ''}" data-view="kanban">${I.kanban} Kanban</button></div>${isManager() ? `<a class="btn" href="/api/students/export.csv?${attr(qsOf(q))}" download title="Exporter la sélection en CSV">${I.dl}</a><button class="btn" id="import">${I.up} Importer</button><button class="btn btn-primary" id="new-student">${I.plus} Nouvel étudiant</button>` : ''}`,
      { subtitle: `${total} étudiant(s)${q.archived === '1' ? ' archivé(s)' : ''}` });
    if (view === 'kanban') {
      const r = await GET('/students?' + qsOf({ ...q, size: 200 }));
      const cols = m.stages.map((st) => ({ st, items: r.students.filter((s) => s.stage === st) }));
      return head(r.total) + studentFilters(query) + `<div class="kanban" id="kanban">${cols.map(({ st, items }) => `<section class="kanban-col" data-stage="${st}" aria-label="${attr(m.stage_labels[st])}">
          <div class="kanban-head"><span><span class="kanban-dot" style="background:${STAGE_COLOR[st]}"></span>${esc(m.stage_labels[st])}</span><span class="count">${items.length}</span></div>
          <div class="kanban-list">${items.map((s) => `<article class="kanban-card" draggable="true" data-id="${s.id}" tabindex="0">
            <div class="kanban-card-top">${avatar(s.first_name + ' ' + s.last_name, 'avatar-sm')}<div><b>${esc(s.first_name + ' ' + s.last_name)}</b><span>${esc(s.school || s.status || '')}</span></div></div>
            <div class="kanban-card-meta">${s.level ? badge(s.level, 'level') : ''}${s.domains.slice(0, 2).map((d) => badge(d, 'domain')).join('')}</div>
            <div class="kanban-card-foot"><span>${esc(s.supervisor_name || 'Sans encadrant')}</span>${s.attendance_rate != null ? `<span>${s.attendance_rate} %</span>` : ''}</div></article>`).join('')}</div></section>`).join('')}</div>
        ${r.total > 200 ? `<p class="small muted mt-2">Le Kanban affiche les 200 premiers étudiants ; affinez les filtres pour voir les autres.</p>` : ''}`;
    }
    const r = await GET('/students?' + qsOf(q));
    const sortBtn = (key, label) => `<button type="button" data-sort="${key}">${esc(label)}${q.sort === key ? (q.dir === 'asc' ? ' ↑' : ' ↓') : ''}</button>`;
    const sortTh = (key, label) => `<th aria-sort="${q.sort === key ? (q.dir === 'asc' ? 'ascending' : 'descending') : 'none'}">${sortBtn(key, label)}</th>`;
    return head(r.total) + studentFilters(query) + `
    <div class="card"><div class="table-wrap"><table>
      <thead><tr>${sortTh('name', 'Étudiant')}<th>Contact</th>${sortTh('level', 'Niveau')}<th>Domaines</th>${sortTh('stage', 'Étape')}<th>Docs</th><th>Encadrant</th><th>PM</th><th>Présence</th>${sortTh('last_activity', 'Dernière activité')}</tr></thead>
      <tbody>${r.students.length ? r.students.map((s) => `<tr class="row" data-href="#/students/${s.id}" tabindex="0">
        <td><div class="cell-person">${avatar(s.first_name + ' ' + s.last_name, 'avatar-sm')}<div><span class="cell-title">${esc(s.first_name + ' ' + s.last_name)}</span><span class="cell-sub">${esc(s.school || s.status || '')}${s.city ? ' · ' + esc(s.city) : ''}</span></div></div></td>
        <td class="u-nowrap">${contactIcons(s)}</td>
        <td>${s.level ? badge(s.level, 'level') : '<span class="muted">—</span>'}</td>
        <td>${s.domains.map((d) => badge(d, 'domain')).join(' ') || '<span class="muted">—</span>'}</td>
        <td>${stageBadge(s.stage)}</td>
        <td>${docDots(s.document_types)}</td>
        <td>${esc(s.supervisor_name || '—')}</td><td>${esc(s.manager_name || '—')}</td>
        <td>${rateBar(s.attendance_rate)}</td>
        <td class="small muted">${esc(fmtRel(s.last_activity_at || s.created_at))}</td></tr>`).join('') : `<tr><td colspan="10">${emptyState(I.users, 'Aucun étudiant', 'Aucune fiche ne correspond à ces filtres.', isManager() ? '<button class="btn btn-primary btn-sm" id="new-student-empty">Créer un étudiant</button>' : '')}</td></tr>`}</tbody>
    </table></div>
    <div class="pager"><span>${r.total} étudiant(s) · page ${r.page} / ${Math.max(1, Math.ceil(r.total / r.size))}</span><span class="actions">
      <button class="btn btn-sm" data-page="${r.page - 1}" ${r.page <= 1 ? 'disabled' : ''}>Précédent</button><button class="btn btn-sm" data-page="${r.page + 1}" ${r.page * r.size >= r.total ? 'disabled' : ''}>Suivant</button></span></div></div>`;
  },
  mount({ query }) {
    const nav = (patch) => go('/students?' + qsOf({ ...query, ...patch }));
    $('#filters').addEventListener('submit', (e) => { e.preventDefault(); const d = formData(e.target); d.archived = d.archived?.[0] || ''; nav({ ...d, page: '' }); });
    $$('[data-view]').forEach((b) => b.onclick = () => nav({ view: b.dataset.view === 'table' ? '' : b.dataset.view, page: '' }));
    $$('[data-page]').forEach((b) => b.onclick = () => nav({ page: b.dataset.page }));
    $$('[data-sort]').forEach((b) => b.onclick = () => nav({ sort: b.dataset.sort, dir: query.sort === b.dataset.sort && query.dir !== 'asc' ? 'asc' : 'desc' }));
    $$('tr.row').forEach((tr) => { tr.onclick = (e) => { if (e.target.closest('a,button')) return; go(tr.dataset.href.slice(1)); }; tr.onkeydown = (e) => { if (e.key === 'Enter') go(tr.dataset.href.slice(1)); }; });
    $('#new-student')?.addEventListener('click', () => studentModal());
    $('#new-student-empty')?.addEventListener('click', () => studentModal());
    $('#import')?.addEventListener('click', importModal);
    // Kanban : glisser-déposer d'une carte vers une autre étape
    const board = $('#kanban');
    if (board) {
      let dragged = null;
      board.addEventListener('dragstart', (e) => { const c = e.target.closest('.kanban-card'); if (!c) return; dragged = c; c.classList.add('is-dragging'); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', c.dataset.id); });
      board.addEventListener('dragend', () => { dragged?.classList.remove('is-dragging'); $$('.kanban-col.is-over', board).forEach((c) => c.classList.remove('is-over')); });
      board.addEventListener('dragover', (e) => { const col = e.target.closest('.kanban-col'); if (!col) return; e.preventDefault(); e.dataTransfer.dropEffect = 'move'; col.classList.add('is-over'); });
      board.addEventListener('dragleave', (e) => { const col = e.target.closest('.kanban-col'); if (col && !col.contains(e.relatedTarget)) col.classList.remove('is-over'); });
      board.addEventListener('drop', async (e) => {
        const col = e.target.closest('.kanban-col'); if (!col || !dragged) return; e.preventDefault();
        const id = Number(dragged.dataset.id); const stage = col.dataset.stage;
        if (dragged.closest('.kanban-col').dataset.stage === stage) return;
        try { await PATCH(`/students/${id}`, { stage }); toast(`Étape : ${state.meta.stage_labels[stage]}`, 'ok'); render(); }
        catch (err) { toast(err.message, 'err'); }
      });
      board.addEventListener('click', (e) => { const c = e.target.closest('.kanban-card'); if (c && !e.target.closest('a')) go(`/students/${c.dataset.id}`); });
      board.addEventListener('keydown', (e) => { const c = e.target.closest('.kanban-card'); if (c && e.key === 'Enter') go(`/students/${c.dataset.id}`); });
    }
  },
};

VIEWS.student = {
  async render({ params }) {
    const [d, docsRes] = await Promise.all([GET(`/students/${params.id}`), GET(`/students/${params.id}/documents`)]);
    const s = d.student; const m = state.meta; const docs = docsRes.documents;
    const full = s.first_name + ' ' + s.last_name;
    const tab = state.detailTab[s.id] || 'overview';
    const tabBtn = (key, label, count) => `<button type="button" class="${tab === key ? 'active' : ''}" data-tab="${key}" role="tab" aria-selected="${tab === key}">${label}${count != null ? `<span class="count">${count}</span>` : ''}</button>`;
    return topbar(esc(full), `${s.whatsapp ? `<a class="btn btn-whatsapp" href="${attr(waLink(s.whatsapp))}" target="_blank" rel="noopener">${I.wa} WhatsApp</a>` : ''}${s.email ? `<a class="btn" href="mailto:${attr(s.email)}">${I.mail} Email</a>` : ''}
      <button class="btn" id="edit">${I.edit} Modifier</button>
      ${isManager() ? (s.archived_at ? `<button class="btn" id="restore">Restaurer</button>` : `<button class="btn btn-danger" id="archive">Archiver</button>`) : ''}
      ${isAdmin() ? `<button class="btn btn-danger" id="delete">Supprimer</button>` : ''}`, { crumbs: `<a href="#/students">${I.back} Étudiants</a>`, search: false }) + `
    <div class="cover"><div class="cover-band"></div><div class="cover-body">
      <div class="cover-identity">${avatar(full, 'avatar-lg')}<div><div class="badges">${stageBadge(s.stage)}${s.level ? badge(s.level, 'level') : ''}${s.domains.map((x) => badge(x, 'domain')).join('')}${s.archived_at ? badge('Archivé', 'dropped') : ''}</div>
        <div class="small muted mt-1">${esc(s.school || s.status || '')}${s.city ? ' · ' + esc(s.city) : ''} · Créé le ${esc(fmtDate(s.created_at))} · Source : ${esc(SOURCE_LABEL[s.source] || s.source || '—')}</div></div></div>
      <div class="cover-stats">${ring(s.attendance_rate, 'ring-lg')}<div class="stat"><b>${s.att_present}/${s.att_total}</b><span>Présences</span></div><div class="stat"><b>${d.subjects.length}</b><span>Sujets</span></div><div class="stat"><b>${REQUIRED_DOCS.filter((t) => docs.some((x) => x.type === t)).length}/3</b><span>Documents</span></div>
        <div class="cover-stage"><label for="stage-quick">Étape</label><select id="stage-quick" aria-label="Changer l'étape">${options(m.stages, s.stage, (x) => m.stage_labels[x], undefined, '')}</select></div></div>
    </div></div>
    <div class="tabs" role="tablist">${tabBtn('overview', 'Aperçu')}${tabBtn('documents', 'Documents', `${REQUIRED_DOCS.filter((t) => docs.some((x) => x.type === t)).length}/3`)}${tabBtn('attendance', 'Présences', d.attendance.length)}${tabBtn('activity', 'Suivi', d.activities.length)}</div>
    <section class="tab-panel" data-panel="documents" ${tab !== 'documents' ? 'hidden' : ''}>${documentsPanel(s.id, docs)}</section>
    <section class="tab-panel" data-panel="overview" ${tab !== 'overview' ? 'hidden' : ''}><div class="grid grid-main-side">
      <div class="card"><div class="card-header"><h2>${I.info} Informations</h2></div><div class="card-body"><dl class="detail-list">
        <dt>Email</dt><dd>${s.email ? `<a href="mailto:${attr(s.email)}">${esc(s.email)}</a>` : '—'}</dd>
        <dt>WhatsApp</dt><dd>${s.whatsapp ? `<a href="${attr(waLink(s.whatsapp))}" target="_blank" rel="noopener">${esc(s.whatsapp)}</a>` : '—'}</dd>
        <dt>Statut</dt><dd>${esc(s.status || '—')}</dd><dt>Niveau</dt><dd>${esc(s.level || '—')}</dd>
        <dt>École</dt><dd>${esc(s.school || '—')}</dd><dt>Ville</dt><dd>${esc(s.city || '—')}</dd>
        <dt>Encadrant</dt><dd>${esc(s.supervisor_name || '—')}</dd><dt>Project manager</dt><dd>${esc(s.manager_name || '—')}</dd>
        <dt>Notes internes</dt><dd class="u-prewrap">${esc(s.notes || '—')}</dd></dl></div></div>
      <div class="card"><div class="card-header"><h2>${I.book} Sujets</h2><button class="btn btn-sm" id="enroll">${I.plus} Affecter</button></div><div class="card-body">
        ${d.subjects.length ? `<div class="list">${d.subjects.map((x) => `<div class="list-item"><a class="list-item-what" href="#/subjects/${x.id}"><b>${esc(x.title)}</b><span>${esc(x.domain)} · ${esc(x.supervisor_name || '—')} · ${esc(SUBJECT_LABEL[x.status])}</span></a><button class="btn btn-sm btn-ghost btn-danger" data-unenroll="${x.id}" title="Retirer" aria-label="Retirer du sujet">×</button></div>`).join('')}</div>` : emptyState(I.book, 'Aucun sujet', 'Affectez cet étudiant à un sujet de résidence.')}</div></div>
    </div></section>
    <section class="tab-panel" data-panel="attendance" ${tab !== 'attendance' ? 'hidden' : ''}><div class="card">
      <div class="table-wrap">${d.attendance.length ? `<table><thead><tr><th>Séance</th><th>Date</th><th>Statut</th><th>Note</th><th>Pointé par</th></tr></thead><tbody>${d.attendance.map((a) => `<tr><td><a href="#/sessions/${a.lab_session_id}">${esc(a.title)}</a></td><td>${esc(fmtDateTime(a.scheduled_at))}</td><td>${badge(ATT_LABEL[a.status], a.status)}</td><td>${esc(a.note || '')}</td><td class="small muted">${esc(a.marked_by_name || '—')}</td></tr>`).join('')}</tbody></table>` : emptyState(I.cal, 'Aucune présence', 'Les présences apparaîtront après le premier pointage en séance.')}</div></div></section>
    <section class="tab-panel" data-panel="activity" ${tab !== 'activity' ? 'hidden' : ''}><div class="grid grid-main-side">
      <div class="card"><div class="card-header"><h2>${I.clock} Historique</h2></div><div class="card-body">
        <div class="timeline">${d.activities.map((a) => `<div class="timeline-entry timeline-${attr(a.type)}"><span class="timeline-dot">${ACT_ICON[a.type] || I.note}</span><div><div class="timeline-meta">${esc(ACT_LABEL[a.type] || a.type)} · ${esc(a.user_name || 'Système')} · ${esc(fmtDateTime(a.created_at))}${['note', 'call', 'whatsapp', 'email', 'meeting'].includes(a.type) && (a.user_id === state.user.id || isAdmin()) ? ` · <button class="btn btn-ghost btn-sm u-inline-btn" data-del-act="${a.id}">supprimer</button>` : ''}</div><p>${esc(a.content)}</p></div></div>`).join('') || emptyState(I.inbox, 'Aucune interaction', 'Consignez ici vos appels, échanges WhatsApp et réunions.')}</div></div></div>
      <div class="card"><div class="card-header"><h2>${I.note} Nouvelle interaction</h2></div><div class="card-body">
        <form id="act"><div class="field"><label for="act-type">Type</label><select id="act-type" name="type">${m.activity_types.map((t) => `<option value="${t}">${esc(ACT_LABEL[t])}</option>`).join('')}</select></div>
          <div class="field"><label for="act-content">Contenu</label><textarea id="act-content" name="content" placeholder="Compte-rendu d'appel, d'échange WhatsApp, note interne…" required></textarea></div>
          <button class="btn btn-primary" type="submit">Ajouter</button></form></div></div>
    </div></section>`;
  },
  mount({ params }) {
    const id = params.id;
    $$('.tabs [data-tab]').forEach((b) => b.onclick = () => { state.detailTab[id] = b.dataset.tab; $$('.tabs [data-tab]').forEach((x) => { x.classList.toggle('active', x === b); x.setAttribute('aria-selected', x === b); }); $$('.tab-panel').forEach((p) => p.hidden = p.dataset.panel !== b.dataset.tab); });
    $('#edit').onclick = async () => { const d = await GET(`/students/${id}`); studentModal(d.student); };
    $('#stage-quick').onchange = async (e) => { try { await PATCH(`/students/${id}`, { stage: e.target.value }); toast('Étape mise à jour', 'ok'); render(); } catch (err) { toast(err.message, 'err'); } };
    $('#archive')?.addEventListener('click', async () => { if (await confirmModal('Archiver', 'Archiver cette fiche ? Elle restera consultable dans les archives.')) { await POST(`/students/${id}/archive`); toast('Fiche archivée'); render(); } });
    $('#restore')?.addEventListener('click', async () => { await POST(`/students/${id}/archive`, { restore: true }); toast('Fiche restaurée', 'ok'); render(); });
    $('#delete')?.addEventListener('click', async () => { if (await confirmModal('Supprimer définitivement', 'Cette action supprime la fiche, ses présences et son historique. Irréversible.', { label: 'Supprimer' })) { await DEL(`/students/${id}`); toast('Fiche supprimée'); go('/students'); } });
    $('#act').addEventListener('submit', async (e) => { e.preventDefault(); const f = e.target; const btn = $('button[type=submit]', f); setLoading(btn, true); try { await POST(`/students/${id}/activities`, formData(f)); state.detailTab[id] = 'activity'; toast('Interaction ajoutée', 'ok'); render(); } catch (err) { setLoading(btn, false); toast(err.message, 'err'); } });
    $$('[data-del-act]').forEach((b) => b.onclick = async () => { await DEL(`/students/${id}/activities/${b.dataset.delAct}`); state.detailTab[id] = 'activity'; render(); });
    $$('[data-unenroll]').forEach((b) => b.onclick = async () => { if (await confirmModal('Retirer du sujet', 'Retirer l\'étudiant de ce sujet ?')) { await DEL(`/subjects/${b.dataset.unenroll}/students/${id}`); render(); } });
    const fileInput = $('#doc-file'); let pendingType = null;
    $$('[data-doc-upload]').forEach((b) => b.onclick = () => { pendingType = b.dataset.docUpload; fileInput.value = ''; fileInput.click(); });
    fileInput?.addEventListener('change', async () => {
      const f = fileInput.files[0]; if (!f || !pendingType) return;
      if (f.size > 15 * 1024 * 1024) return toast('Fichier trop volumineux (15 Mo max)', 'err');
      const btn = $(`[data-doc-upload="${pendingType}"]`); setLoading(btn, true);
      try { await uploadDocument(id, pendingType, f); state.detailTab[id] = 'documents'; toast(`${f.name} déposé`, 'ok'); render(); }
      catch (err) { setLoading(btn, false); toast(err.details?.file || err.message, 'err'); }
    });
    $$('[data-doc-del]').forEach((b) => b.onclick = async () => { if (await confirmModal('Supprimer le document', 'Le fichier sera définitivement supprimé du stockage.', { label: 'Supprimer' })) { try { await DEL(`/students/${id}/documents/${b.dataset.docDel}`); state.detailTab[id] = 'documents'; toast('Document supprimé'); render(); } catch (err) { toast(err.message, 'err'); } } });
    $('#enroll').onclick = async () => {
      const [r, r2] = await Promise.all([GET('/subjects?status=open'), GET('/subjects?status=in_progress')]);
      const subs = [...r.subjects, ...r2.subjects];
      modal({ title: 'Affecter à un sujet', body: field('subject_id', 'Sujet', select('subject_id', options(subs, '', (x) => `${x.title} — ${x.domain} (${x.students_count}/${x.capacity || '∞'})`, (x) => x.id, 'Choisir un sujet'))), submitLabel: 'Affecter',
        async onSubmit(data) { if (!data.subject_id) throw new ApiError(400, { error: 'Choisissez un sujet', details: { subject_id: 'Obligatoire' } }); await POST(`/subjects/${data.subject_id}/students`, { student_id: id }); toast('Étudiant affecté', 'ok'); render(); } });
    };
  },
};

/* ---------- Sujets ---------- */
function subjectForm(s = {}) {
  const m = state.meta;
  return `<div class="form-grid">
    <div class="span-full">${field('title', 'Titre du sujet', input('title', s.title, 'text', 'required'))}</div>
    ${field('domain', 'Domaine', select('domain', options(m.domains, s.domain, undefined, undefined, 'Choisir un domaine')))}
    ${field('status', 'Statut', select('status', options(m.subject_statuses, s.status || 'open', (x) => SUBJECT_LABEL[x], undefined, '')))}
    ${isManager() ? field('supervisor_id', 'Encadrant industriel', select('supervisor_id', userOptions(supervisors(), s.supervisor_id ?? (state.user.role === 'supervisor' ? state.user.id : '')))) : ''}
    ${isManager() ? field('manager_id', 'Project manager', select('manager_id', userOptions(managers(), s.manager_id ?? (state.user.role === 'project_manager' ? state.user.id : '')))) : ''}
    ${field('capacity', 'Capacité (0 = illimitée)', input('capacity', s.capacity ?? 1, 'number', 'min="0" max="500"'))}
    ${field('start_date', 'Début', input('start_date', s.start_date, 'date'))}${field('end_date', 'Fin', input('end_date', s.end_date, 'date'))}
    <div class="span-full">${field('description', 'Description', textarea('description', s.description))}</div></div>`;
}
function subjectModal(existing) {
  modal({ title: existing ? 'Modifier le sujet' : 'Nouveau sujet', body: subjectForm(existing || {}), wide: true,
    async onSubmit(data) {
      for (const k of ['supervisor_id', 'manager_id']) if (k in data) data[k] = data[k] ? Number(data[k]) : null;
      if (!isManager()) { delete data.supervisor_id; delete data.manager_id; }
      if (existing) { await PATCH(`/subjects/${existing.id}`, data); toast('Sujet mis à jour', 'ok'); render(); }
      else { const r = await POST('/subjects', data); toast('Sujet créé', 'ok'); go(`/subjects/${r.subject.id}`); }
    } });
}
VIEWS.subjects = {
  async render({ query }) {
    const r = await GET('/subjects?' + qsOf(query)); const m = state.meta;
    return topbar('Sujets de résidence', `<button class="btn btn-primary" id="new">${I.plus} Nouveau sujet</button>`, { subtitle: `${r.subjects.length} sujet(s)` }) + `
    <form class="filters" id="filters"><input type="search" name="q" value="${attr(query.q || '')}" placeholder="Rechercher un sujet…" aria-label="Recherche">
      <select name="domain" aria-label="Domaine">${options(m.domains, query.domain, undefined, undefined, 'Tous les domaines')}</select>
      <select name="status" aria-label="Statut">${options(m.subject_statuses, query.status, (x) => SUBJECT_LABEL[x], undefined, 'Tous les statuts')}</select>
      ${isManager() ? `<select name="supervisor_id" aria-label="Encadrant">${userOptions(supervisors(), query.supervisor_id).replace('— Aucun —', 'Tous les encadrants')}</select>` : ''}
      <button class="btn btn-sm" type="submit">Filtrer</button></form>
    ${r.subjects.length ? `<div class="grid grid-cards">${r.subjects.map((s) => { const pct = s.capacity ? Math.min(100, Math.round((s.students_count / s.capacity) * 100)) : 0; return `<a class="card card-hover subject-card" href="#/subjects/${s.id}">
        <div class="flex-row flex-wrap">${badge(s.domain, 'domain')}${badge(SUBJECT_LABEL[s.status], s.status)}</div>
        <h3>${esc(s.title)}</h3>
        <div class="small muted">${esc(s.supervisor_name || 'Sans encadrant')} · PM ${esc(s.manager_name || '—')}</div>
        <div class="capacity"><span>${s.students_count} / ${s.capacity || '∞'} inscrit(s)</span><span class="capacity-track"><span class="capacity-fill" style="width:${pct}%"></span></span><span>${s.sessions_count} séance(s)</span></div>
        <div class="small muted">${esc(fmtDate(s.start_date))} → ${esc(fmtDate(s.end_date))}</div></a>`; }).join('')}</div>`
      : `<div class="card">${emptyState(I.book, 'Aucun sujet', 'Créez le premier sujet de résidence pour y inscrire des étudiants.', '<button class="btn btn-primary btn-sm" id="new-empty">Nouveau sujet</button>')}</div>`}`;
  },
  mount() {
    $('#new').onclick = () => subjectModal(); $('#new-empty')?.addEventListener('click', () => subjectModal());
    $('#filters').addEventListener('submit', (e) => { e.preventDefault(); go('/subjects?' + qsOf(formData(e.target))); });
  },
};
VIEWS.subject = {
  async render({ params }) {
    const d = await GET(`/subjects/${params.id}`); const s = d.subject;
    const pct = s.capacity ? Math.min(100, Math.round((d.students.length / s.capacity) * 100)) : 0;
    return topbar(esc(s.title), `<button class="btn" id="edit">${I.edit} Modifier</button><button class="btn btn-primary" id="new-session">${I.plus} Planifier une séance</button>${isManager() ? `<button class="btn btn-danger" id="delete">Supprimer</button>` : ''}`, { crumbs: `<a href="#/subjects">${I.back} Sujets</a>`, search: false }) + `
    <div class="cover"><div class="cover-band"></div><div class="cover-body">
      <div><div class="badges">${badge(s.domain, 'domain')}${badge(SUBJECT_LABEL[s.status], s.status)}</div><div class="small muted mt-1">Encadrant : <b>${esc(s.supervisor_name || '—')}</b> · PM : <b>${esc(s.manager_name || '—')}</b> · ${esc(fmtDate(s.start_date))} → ${esc(fmtDate(s.end_date))}</div></div>
      <div class="cover-stats"><div class="stat"><b>${d.students.length}/${s.capacity || '∞'}</b><span>Inscrits</span></div><div class="stat"><b>${d.sessions.length}</b><span>Séances</span></div><div class="capacity" style="min-width:160px"><span class="capacity-track"><span class="capacity-fill" style="width:${pct}%"></span></span><span>${pct} %</span></div></div>
    </div></div>
    <div class="grid grid-main-side"><div class="grid">
      <div class="card"><div class="card-header"><h2>${I.users} Étudiants inscrits</h2><button class="btn btn-sm" id="enroll">${I.plus} Inscrire</button></div><div class="table-wrap">
        ${d.students.length ? `<table><thead><tr><th>Étudiant</th><th>Contact</th><th>Niveau</th><th>Étape</th><th>Inscrit le</th><th></th></tr></thead><tbody>${d.students.map((x) => `<tr><td><div class="cell-person">${avatar(x.first_name + ' ' + x.last_name, 'avatar-sm')}<a href="#/students/${x.id}"><b>${esc(x.first_name + ' ' + x.last_name)}</b></a></div></td><td class="u-nowrap">${contactIcons(x)}</td><td>${x.level ? badge(x.level, 'level') : '—'}</td><td>${stageBadge(x.stage)}</td><td class="small muted">${esc(fmtDate(x.assigned_at))}</td><td><button class="btn btn-sm btn-ghost btn-danger" data-unenroll="${x.id}" title="Retirer" aria-label="Retirer">×</button></td></tr>`).join('')}</tbody></table>` : emptyState(I.users, 'Aucun étudiant inscrit', 'Inscrivez des étudiants pour constituer la feuille de présence des séances.')}</div></div>
      <div class="card"><div class="card-header"><h2>${I.cal} Séances</h2></div><div class="table-wrap">${d.sessions.length ? `<table><thead><tr><th>Séance</th><th>Date</th><th>Statut</th><th>Présents</th></tr></thead><tbody>${d.sessions.map((x) => `<tr class="row" data-href="#/sessions/${x.id}" tabindex="0"><td><span class="cell-title">${esc(x.title)}</span></td><td>${esc(fmtDateTime(x.scheduled_at))}</td><td>${badge(SESSION_LABEL[x.status], x.status)}</td><td>${x.marked_count ? `${x.present_count}/${x.marked_count}` : '—'}</td></tr>`).join('')}</tbody></table>` : emptyState(I.cal, 'Aucune séance', 'Planifiez la première séance de ce sujet.')}</div></div>
    </div>
    <div class="card"><div class="card-header"><h2>${I.info} Description</h2></div><div class="card-body u-prewrap">${esc(s.description || '—')}</div></div></div>`;
  },
  mount({ params }) {
    const id = params.id;
    $('#edit').onclick = async () => { const d = await GET(`/subjects/${id}`); subjectModal(d.subject); };
    $('#new-session').onclick = async () => { const d = await GET(`/subjects/${id}`); sessionModal(null, { subject_id: id, domain: d.subject.domain, supervisor_id: d.subject.supervisor_id, title: `Lab — ${d.subject.title}` }); };
    $('#delete')?.addEventListener('click', async () => { if (await confirmModal('Supprimer le sujet', 'Les inscriptions seront supprimées. Les séances resteront sans sujet.', { label: 'Supprimer' })) { await DEL(`/subjects/${id}`); go('/subjects'); } });
    $$('[data-unenroll]').forEach((b) => b.onclick = async () => { await DEL(`/subjects/${id}/students/${b.dataset.unenroll}`); render(); });
    $$('tr.row').forEach((tr) => { tr.onclick = (e) => { if (e.target.closest('a,button')) return; go(tr.dataset.href.slice(1)); }; tr.onkeydown = (e) => { if (e.key === 'Enter') go(tr.dataset.href.slice(1)); }; });
    $('#enroll').onclick = () => studentPicker(async (sid) => { await POST(`/subjects/${id}/students`, { student_id: sid }); toast('Étudiant inscrit', 'ok'); render(); });
  },
};
function studentPicker(onPick, title = 'Inscrire un étudiant') {
  const d = modal({ title, body: `<input type="search" id="pick-q" placeholder="Rechercher un étudiant…" aria-label="Recherche" autocomplete="off"><div id="pick-list" class="list scroll-list"></div>` });
  const list = $('#pick-list', d); const q = $('#pick-q', d);
  const load = async () => {
    const r = await GET('/students?size=30&q=' + encodeURIComponent(q.value));
    list.innerHTML = r.students.map((s) => `<button type="button" class="list-item" data-id="${s.id}">${avatar(s.first_name + ' ' + s.last_name, 'avatar-sm')}<span class="list-item-what"><b>${esc(s.first_name + ' ' + s.last_name)}</b><span>${esc(s.level || '—')} · ${s.domains.map(esc).join(', ') || '—'} · ${esc(state.meta.stage_labels[s.stage])}</span></span></button>`).join('') || `<div class="gs-empty">Aucun résultat.</div>`;
    $$('[data-id]', list).forEach((b) => b.onclick = async () => { try { await onPick(Number(b.dataset.id)); d.close(); d.remove(); } catch (e) { toast(e.message, 'err'); } });
  };
  q.oninput = debounce(load, 250); load();
}

/* ---------- Séances & présences ---------- */
async function sessionModal(existing, defaults = {}) {
  const m = state.meta; const s = existing || defaults;
  const subs = (await GET('/subjects')).subjects.filter((x) => x.status !== 'archived');
  modal({ title: existing ? 'Modifier la séance' : 'Planifier une séance', wide: true, body: `<div class="form-grid">
    <div class="span-full">${field('title', 'Titre', input('title', s.title, 'text', 'required'))}</div>
    ${field('subject_id', 'Sujet', select('subject_id', options(subs, s.subject_id, (x) => x.title, (x) => x.id, '— Sans sujet —')))}
    ${field('domain', 'Domaine', select('domain', options(m.domains, s.domain, undefined, undefined, '— Hérité du sujet —')))}
    ${field('scheduled_at', 'Date et heure', input('scheduled_at', toLocalInput(s.scheduled_at), 'datetime-local', 'required'))}
    ${field('duration_min', 'Durée (min)', input('duration_min', s.duration_min ?? 120, 'number', 'min="15" max="1440"'))}
    ${field('mode', 'Mode', select('mode', options(m.session_modes, s.mode || 'onsite', (x) => MODE_LABEL[x], undefined, '')))}
    ${field('location', 'Lieu / lien', input('location', s.location))}
    ${isManager() ? field('supervisor_id', 'Encadrant', select('supervisor_id', userOptions(supervisors(), s.supervisor_id))) : ''}
    ${field('status', 'Statut', select('status', options(m.session_statuses, s.status || 'planned', (x) => SESSION_LABEL[x], undefined, '')))}
    <div class="span-full">${field('notes', 'Notes', textarea('notes', s.notes))}</div></div>`,
    async onSubmit(data) {
      data.scheduled_at = data.scheduled_at ? new Date(data.scheduled_at).toISOString() : '';
      for (const k of ['subject_id', 'supervisor_id', 'duration_min']) if (k in data) data[k] = data[k] ? Number(data[k]) : null;
      if (!isManager()) delete data.supervisor_id;
      if (existing) { await PATCH(`/sessions/${existing.id}`, data); toast('Séance mise à jour', 'ok'); render(); }
      else { const r = await POST('/sessions', data); toast('Séance planifiée', 'ok'); go(`/sessions/${r.session.id}`); }
    } });
}
VIEWS.sessions = {
  async render({ query }) {
    const tab = query.tab || 'upcoming';
    const now = new Date().toISOString();
    const r = await GET('/sessions?' + qsOf(tab === 'upcoming' ? { from: now, dir: 'asc' } : tab === 'past' ? { to: now } : {}));
    const groups = [];
    for (const s of r.sessions) { const key = new Date(s.scheduled_at).toDateString(); let g = groups[groups.length - 1]; if (!g || g.key !== key) { g = { key, label: dayLabel(s.scheduled_at), items: [] }; groups.push(g); } g.items.push(s); }
    return topbar('Séances & présences', `<button class="btn btn-primary" id="new">${I.plus} Planifier une séance</button>`, { subtitle: `${r.sessions.length} séance(s)` }) + `
    <div class="tabs" role="tablist">${[['upcoming', 'À venir'], ['past', 'Passées'], ['all', 'Toutes']].map(([k, l]) => `<button type="button" class="${tab === k ? 'active' : ''}" data-tab="${k}" role="tab" aria-selected="${tab === k}">${l}</button>`).join('')}</div>
    <div class="card"><div class="table-wrap">${r.sessions.length ? `<table><thead><tr><th>Heure</th><th>Séance</th><th>Sujet</th><th>Encadrant</th><th>Mode</th><th>Statut</th><th>Présence</th></tr></thead>
    <tbody>${groups.map((g) => `<tr><td colspan="7" class="day-sep ${g.label === 'Aujourd\'hui' ? 'is-today' : ''}">${esc(g.label)}</td></tr>` + g.items.map((s) => `<tr class="row" data-href="#/sessions/${s.id}" tabindex="0"><td class="u-nowrap"><b>${esc(fmtTime(s.scheduled_at))}</b><span class="cell-sub">${s.duration_min} min</span></td><td><span class="cell-title">${esc(s.title)}</span>${s.location ? `<span class="cell-sub">${esc(s.location)}</span>` : ''}</td><td>${esc(s.subject_title || '—')}</td><td>${esc(s.supervisor_name || '—')}</td><td>${esc(MODE_LABEL[s.mode])}</td><td>${badge(SESSION_LABEL[s.status], s.status)}</td><td>${s.marked_count ? `${badge(s.present_count + ' présents', 'present')} ${s.absent_count ? badge(s.absent_count + ' absents', 'absent') : ''}` : '<span class="muted">Non pointée</span>'}</td></tr>`).join('')).join('')}</tbody></table>` : emptyState(I.cal, 'Aucune séance', tab === 'upcoming' ? 'Aucune séance à venir. Planifiez le prochain lab.' : 'Aucune séance dans cette période.', '<button class="btn btn-primary btn-sm" id="new-empty">Planifier une séance</button>')}</div></div>`;
  },
  mount() {
    $('#new').onclick = () => sessionModal(); $('#new-empty')?.addEventListener('click', () => sessionModal());
    $$('[data-tab]').forEach((b) => b.onclick = () => go('/sessions?tab=' + b.dataset.tab));
    $$('tr.row').forEach((tr) => { tr.onclick = (e) => { if (e.target.closest('a,button')) return; go(tr.dataset.href.slice(1)); }; tr.onkeydown = (e) => { if (e.key === 'Enter') go(tr.dataset.href.slice(1)); }; });
  },
};
VIEWS.session = {
  async render({ params }) {
    const d = await GET(`/sessions/${params.id}`); const s = d.session; const m = state.meta;
    const counts = { present: 0, late: 0, absent: 0, excused: 0, pending: 0 };
    d.attendance.forEach((a) => { if (a.status) counts[a.status]++; else counts.pending++; });
    return topbar(esc(s.title), `<button class="btn" id="edit">${I.edit} Modifier</button>${isManager() ? `<button class="btn btn-danger" id="delete">Supprimer</button>` : ''}`, { crumbs: `<a href="#/sessions">${I.back} Séances</a>`, search: false, subtitle: `${esc(fmtDateTime(s.scheduled_at))} · ${s.duration_min} min · ${esc(MODE_LABEL[s.mode])}${s.location ? ' · ' + esc(s.location) : ''} · Encadrant : ${esc(s.supervisor_name || '—')}${s.subject_title ? ` · Sujet : <a href="#/subjects/${s.subject_id}">${esc(s.subject_title)}</a>` : ''}` }) + `
    <div class="badges mb-5">${badge(SESSION_LABEL[s.status], s.status)}${s.domain ? badge(s.domain, 'domain') : ''}</div>
    ${s.notes ? `<div class="card mb-5"><div class="card-body u-prewrap">${esc(s.notes)}</div></div>` : ''}
    <form class="card sheet" id="sheet"><div class="card-header"><h2>${I.checkCircle} Feuille de présence</h2><div class="actions"><button type="button" class="btn btn-sm" id="all-present">${I.check} Tous présents</button><button type="button" class="btn btn-sm" id="add-student">${I.plus} Ajouter un étudiant</button><button class="btn btn-primary btn-sm" type="submit">Enregistrer</button></div></div>
      <div class="sheet-summary" id="sheet-summary" aria-live="polite">${sheetSummary(counts)}</div>
      <div class="table-wrap">${d.attendance.length ? `<table><thead><tr><th>Étudiant</th><th>Contact</th><th>Niveau</th><th>Présence</th><th>Note</th><th>Pointé</th></tr></thead><tbody>
        ${d.attendance.map((a) => `<tr><td><div class="cell-person">${avatar(a.first_name + ' ' + a.last_name, 'avatar-sm')}<a href="#/students/${a.student_id}"><b>${esc(a.first_name + ' ' + a.last_name)}</b></a></div></td><td class="u-nowrap">${contactIcons(a)}</td><td>${a.level ? badge(a.level, 'level') : '—'}</td>
          <td><span class="segmented">${m.attendance_statuses.map((st) => `<label class="segmented-${st}"><input type="radio" name="st-${a.student_id}" value="${st}" ${a.status === st ? 'checked' : ''}>${esc(ATT_LABEL[st])}</label>`).join('')}</span></td>
          <td><input type="text" name="note-${a.student_id}" value="${attr(a.note || '')}" placeholder="Note" maxlength="500" aria-label="Note"></td><td class="small muted">${a.marked_at ? esc(fmtRel(a.marked_at)) : '—'}</td></tr>`).join('')}</tbody></table>` : emptyState(I.users, 'Aucun étudiant dans la liste', 'Inscrivez des étudiants au sujet ou ajoutez-les ici.')}</div></form>`;
  },
  mount({ params }) {
    const id = params.id;
    const recount = () => { const c = { present: 0, late: 0, absent: 0, excused: 0, pending: 0 }; const names = new Set($$('#sheet input[type=radio]').map((r) => r.name)); names.forEach((n) => { const ch = $(`#sheet input[name="${n}"]:checked`); if (ch) c[ch.value]++; else c.pending++; }); $('#sheet-summary').innerHTML = sheetSummary(c); };
    $('#sheet').addEventListener('change', (e) => { if (e.target.type === 'radio') recount(); });
    $('#edit').onclick = async () => { const d = await GET(`/sessions/${id}`); sessionModal(d.session); };
    $('#delete')?.addEventListener('click', async () => { if (await confirmModal('Supprimer la séance', 'Les présences associées seront supprimées.', { label: 'Supprimer' })) { await DEL(`/sessions/${id}`); go('/sessions'); } });
    $('#all-present').onclick = () => { $$('#sheet input[type=radio][value=present]').forEach((r) => { if (!$$(`input[name="${r.name}"]:checked`).length) r.checked = true; }); recount(); };
    $('#add-student').onclick = () => studentPicker(async (sid) => { await PUT(`/sessions/${id}/attendance`, { entries: [{ student_id: sid, status: 'present' }] }); render(); }, 'Ajouter à la feuille de présence');
    $('#sheet').addEventListener('submit', async (e) => {
      e.preventDefault();
      const entries = [];
      $$('#sheet input[type=radio]:checked').forEach((r) => { const sid = Number(r.name.slice(3)); entries.push({ student_id: sid, status: r.value, note: $(`#sheet input[name="note-${sid}"]`).value }); });
      if (!entries.length) return toast('Sélectionnez au moins un statut', 'err');
      const btn = $('#sheet button[type=submit]'); setLoading(btn, true);
      try { await PUT(`/sessions/${id}/attendance`, { entries }); toast(`${entries.length} présence(s) enregistrée(s)`, 'ok'); render(); } catch (err) { setLoading(btn, false); toast(err.message, 'err'); }
    });
  },
};
const sheetSummary = (c) => `${badge(`${c.present} présent(s)`, 'present')}${badge(`${c.late} en retard`, 'late')}${badge(`${c.absent} absent(s)`, 'absent')}${badge(`${c.excused} excusé(s)`, 'excused')}${c.pending ? badge(`${c.pending} à pointer`, 'pending') : ''}`;

/* ---------- Utilisateurs (admin) ---------- */
function userForm(u = {}) {
  const m = state.meta;
  return `<div class="form-grid">${field('name', 'Nom complet', input('name', u.name, 'text', 'required'))}${field('email', 'Email', input('email', u.email, 'email', 'required autocomplete="off"'))}
    ${field('role', 'Rôle', select('role', options(m.roles, u.role || 'supervisor', (x) => m.role_labels[x], undefined, '')))}${field('company', 'Entreprise', input('company', u.company))}
    ${field('whatsapp', 'WhatsApp', input('whatsapp', u.whatsapp, 'tel'))}${field('password', u.id ? 'Nouveau mot de passe (optionnel)' : 'Mot de passe (vide = généré)', input('password', '', 'password', 'autocomplete="new-password"'), '10 caractères minimum, lettres et chiffres')}
    ${u.id ? `<div class="span-full"><label class="small flex-row"><input type="checkbox" name="active" value="1" ${u.active ? 'checked' : ''}> Compte actif</label></div>` : ''}</div>`;
}
VIEWS.users = { roles: ['admin'],
  async render() {
    const r = await GET('/users'); const m = state.meta;
    return topbar('Utilisateurs', `<button class="btn btn-primary" id="new">${I.plus} Nouvel utilisateur</button>`, { subtitle: `${r.users.filter((u) => u.active).length} compte(s) actif(s)` }) + `
    <div class="card"><div class="table-wrap"><table><thead><tr><th>Utilisateur</th><th>Rôle</th><th>Entreprise</th><th>WhatsApp</th><th>Étudiants</th><th>Sujets</th><th>Dernière connexion</th><th>Statut</th><th></th></tr></thead><tbody>
      ${r.users.map((u) => `<tr><td><div class="cell-person">${avatar(u.name, 'avatar-sm')}<div><span class="cell-title">${esc(u.name)}</span><span class="cell-sub">${esc(u.email)}</span></div></div></td><td>${badge(m.role_labels[u.role], 'role-' + u.role)}</td><td>${esc(u.company || '—')}</td><td>${u.whatsapp ? `<a href="${attr(waLink(u.whatsapp))}" target="_blank" rel="noopener">${esc(u.whatsapp)}</a>` : '—'}</td><td>${u.role === 'supervisor' ? u.students_supervised + ' encadrés' : u.role === 'project_manager' ? u.students_managed + ' gérés' : '—'}</td><td>${u.subjects_count}</td><td class="small muted">${esc(u.last_login_at ? fmtRel(u.last_login_at) : 'Jamais')}</td><td>${u.active ? badge('Actif', 'active') : badge('Désactivé', 'dropped')}</td><td><button class="btn btn-sm" data-edit="${u.id}">${I.edit} Modifier</button></td></tr>`).join('')}</tbody></table></div></div>`;
  },
  mount() {
    const open = (u) => modal({ title: u ? 'Modifier l\'utilisateur' : 'Nouvel utilisateur', body: userForm(u || {}), wide: true,
      async onSubmit(data) {
        if (!data.password) delete data.password;
        if (u) { data.active = (data.active || []).includes('1'); await PATCH(`/users/${u.id}`, data); toast('Utilisateur mis à jour', 'ok'); render(); }
        else { const r = await POST('/users', data); render(); if (r.generated_password) modal({ title: 'Mot de passe généré', body: `<p>Transmettez ce mot de passe à <b>${esc(r.user.name)}</b> (${esc(r.user.email)}). Il ne sera plus affiché.</p><code class="key">${esc(r.generated_password)}</code>`, submitLabel: 'OK', onSubmit: async () => {} }); else toast('Utilisateur créé', 'ok'); }
      } });
    $('#new').onclick = () => open(null);
    $$('[data-edit]').forEach((b) => b.onclick = async () => { const r = await GET('/users'); open(r.users.find((u) => u.id === Number(b.dataset.edit))); });
  },
};

/* ---------- Journal d'audit (admin) ---------- */
VIEWS.audit = { roles: ['admin'],
  async render({ query }) {
    const page = Number(query.page) || 1;
    const r = await GET(`/audit?page=${page}${query.action ? '&action=' + encodeURIComponent(query.action) : ''}`);
    return topbar('Journal d\'audit', '', { subtitle: `${r.total} entrée(s)` }) + `<form class="filters" id="filters"><input type="search" name="action" value="${attr(query.action || '')}" placeholder="Filtrer par action (ex. login, student.)" aria-label="Action"><button class="btn btn-sm" type="submit">Filtrer</button></form>
    <div class="card"><div class="table-wrap"><table><thead><tr><th>Date</th><th>Utilisateur</th><th>Action</th><th>Entité</th><th>Détails</th><th>IP</th></tr></thead><tbody>
      ${r.entries.map((e) => `<tr><td class="small u-nowrap">${esc(fmtDateTime(e.created_at))}</td><td>${esc(e.user_name || '—')}</td><td class="mono">${esc(e.action)}</td><td class="small">${esc(e.entity || '')} ${e.entity_id ? '#' + e.entity_id : ''}</td><td class="mono small u-truncate" title="${attr(e.details || '')}">${esc(e.details || '')}</td><td class="mono small">${esc(e.ip || '')}</td></tr>`).join('') || `<tr><td colspan="6">${emptyState(I.list, 'Aucune entrée', 'Le journal se remplit avec les connexions et les modifications.')}</td></tr>`}</tbody></table></div>
    <div class="pager"><span>${r.total} entrée(s)</span><span class="actions"><button class="btn btn-sm" data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''}>Précédent</button><button class="btn btn-sm" data-page="${page + 1}" ${page * r.size >= r.total ? 'disabled' : ''}>Suivant</button></span></div></div>`;
  },
  mount({ query }) {
    $('#filters').addEventListener('submit', (e) => { e.preventDefault(); go('/audit?action=' + encodeURIComponent(formData(e.target).action)); });
    $$('[data-page]').forEach((b) => b.onclick = () => go(`/audit?page=${b.dataset.page}${query.action ? '&action=' + encodeURIComponent(query.action) : ''}`));
  },
};

/* ---------- Paramètres (admin) ---------- */
VIEWS.settings = { roles: ['admin'],
  async render() {
    const s = await GET('/settings');
    const endpoint = `${location.origin}/api/public/leads?key=${s.intake_key}`;
    return topbar('Paramètres', '', { search: false }) + `<div class="grid grid-2">
      <div class="card"><div class="card-header"><h2>${I.key} Intégration du formulaire landing</h2><button class="btn btn-sm btn-danger" id="rotate">Régénérer la clé</button></div><div class="card-body">
        <p class="small">Le formulaire <a href="${attr(s.landing_url)}" target="_blank" rel="noopener">${esc(s.landing_url)}</a> envoie une copie JSON de chaque demande. Dans son <code>index.html</code>, renseignez la constante <code>ENDPOINT</code> avec :</p>
        <code class="key" id="endpoint">${esc(endpoint)}</code>
        <p class="small muted">Origines autorisées (CORS) : ${s.intake_allowed_origins.map(esc).join(', ')} — modifiable via <code>INTAKE_ALLOWED_ORIGINS</code>. Chaque demande crée un lead à l'étape « Nouveau lead » avec la source « Formulaire landing ». Limite : 30 demandes / heure / IP.</p>
        <pre class="snip">const ENDPOINT = "${esc(endpoint)}";</pre></div></div>
      <div class="card"><div class="card-header"><h2>${I.shield} Rôles et permissions</h2></div><div class="card-body"><dl class="detail-list">
        <dt>Admin global</dt><dd>Tout : utilisateurs, paramètres, journal d'audit, suppression définitive.</dd>
        <dt>Project manager</dt><dd>Crée et gère les étudiants, sujets et séances ; affecte les encadrants ; import/export CSV.</dd>
        <dt>Encadrant industriel</dt><dd>Voit uniquement ses étudiants (affectés ou inscrits à ses sujets), gère ses sujets et séances, pointe les présences, met à jour niveau/étape/notes.</dd></dl></div></div></div>`;
  },
  mount() {
    $('#rotate').onclick = async () => { if (await confirmModal('Régénérer la clé', 'L\'ancienne clé cessera de fonctionner : il faudra mettre à jour ENDPOINT sur la landing.', { label: 'Régénérer' })) { await POST('/settings/intake-key/rotate'); toast('Clé régénérée', 'ok'); render(); } };
  },
};

/* ---------- Profil ---------- */
VIEWS.profile = {
  async render() {
    const u = state.user; const dark = document.documentElement.dataset.theme === 'dark';
    return topbar('Mon profil', '', { search: false }) + `<div class="grid grid-2"><div class="card"><div class="card-header"><h2>${I.users} Compte</h2></div><div class="card-body">
        <div class="flex-row mb-5">${avatar(u.name, 'avatar-lg')}<div><b>${esc(u.name)}</b><div class="small muted">${esc(u.email)}</div></div></div>
        <dl class="detail-list"><dt>Rôle</dt><dd>${badge(state.meta.role_labels[u.role], 'role-' + u.role)}</dd><dt>WhatsApp</dt><dd>${esc(u.whatsapp || '—')}</dd><dt>Entreprise</dt><dd>${esc(u.company || '—')}</dd><dt>Thème</dt><dd><button type="button" class="btn btn-sm" data-theme-toggle>${dark ? I.sun + ' Passer en clair' : I.moon + ' Passer en sombre'}</button></dd></dl>
        <p class="mt-5 mb-0"><button type="button" class="btn btn-danger" data-logout>${I.out} Se déconnecter</button></p></div></div>
      <div class="card"><div class="card-header"><h2>${I.key} Changer le mot de passe</h2></div><div class="card-body"><form id="pw" novalidate>${field('current_password', 'Mot de passe actuel', input('current_password', '', 'password', 'autocomplete="current-password" required'))}${field('new_password', 'Nouveau mot de passe', input('new_password', '', 'password', 'autocomplete="new-password" required'), '10 caractères minimum, lettres et chiffres')}<button class="btn btn-primary" type="submit">Mettre à jour</button></form></div></div></div>`;
  },
  mount() {
    $('#pw').addEventListener('submit', async (e) => { e.preventDefault(); const btn = $('button[type=submit]', e.target); setLoading(btn, true); try { await POST('/auth/password', formData(e.target)); toast('Mot de passe mis à jour', 'ok'); e.target.reset(); } catch (err) { showErrors(e.target, err); } setLoading(btn, false); });
    $$('.main [data-theme-toggle]').forEach((b) => b.addEventListener('click', toggleTheme));
  },
};

/* ---------- Démarrage ---------- */
window.addEventListener('hashchange', render);
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { applyTheme(); if (state.user) render(); });
(async () => {
  try { const r = await GET('/auth/me'); state.user = r.user; } catch { state.user = null; }
  render();
})();
})();
