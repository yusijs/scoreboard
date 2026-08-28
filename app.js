'use strict';

// ===== Storage =====
const STORAGE_KEYS = {
  activeMatch: 'soccer_active_match',
  history: 'soccer_match_history',
  planned: 'soccer_planned_matches',
};

function loadActiveMatch() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.activeMatch);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveActiveMatch(match) {
  if (match) {
    localStorage.setItem(STORAGE_KEYS.activeMatch, JSON.stringify(match));
  } else {
    localStorage.removeItem(STORAGE_KEYS.activeMatch);
  }
}

function loadHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.history);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHistory(history) {
  localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(history));
}

function loadPlanned() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.planned);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function savePlanned(planned) {
  localStorage.setItem(STORAGE_KEYS.planned, JSON.stringify(planned));
}

// ===== State =====
let state = {
  activeMatch: null,   // { id, homeTeam, awayTeam, homeScore, awayScore, goals, startedAt, elapsed, timerStartedAt, timerRunning, halfTime }
  history: [],
  planned: [],       // upcoming matches: { id, homeTeam, awayTeam, competition, kickoffAt }
  timerInterval: null,
  detailKey: null,   // match currently shown in the detail modal
};

// ===== Timer =====

// Returns total elapsed seconds, including time since the timer was last started.
// elapsed stores accumulated seconds from previous running periods;
// timerStartedAt is the wall-clock ms when the current period began.
function getElapsedSeconds() {
  if (!state.activeMatch) return 0;
  const base = state.activeMatch.elapsed;
  if (state.activeMatch.timerRunning && state.activeMatch.timerStartedAt) {
    return base + Math.floor((Date.now() - state.activeMatch.timerStartedAt) / 1000);
  }
  return base;
}

function startTimer() {
  if (state.timerInterval) return;
  // Interval only drives display refreshes; wall clock is the source of truth.
  state.timerInterval = setInterval(renderTimerDisplay, 1000);
}

function stopTimer() {
  clearInterval(state.timerInterval);
  state.timerInterval = null;
}

function renderTimerDisplay() {
  if (!state.activeMatch) return;
  const mins = Math.floor(getElapsedSeconds() / 60);
  const el = document.getElementById('match-timer-display');
  if (el) el.textContent = `${mins}'`;
}

// ===== Render =====
function renderActiveMatch() {
  const match = state.activeMatch;
  const noMatch = document.getElementById('no-match');
  const activeEl = document.getElementById('active-match');

  if (!match) {
    noMatch.classList.remove('hidden');
    activeEl.classList.add('hidden');
    stopTimer();
    return;
  }

  noMatch.classList.add('hidden');
  activeEl.classList.remove('hidden');

  const competitionEl = document.getElementById('match-competition');
  if (match.competition) {
    competitionEl.textContent = match.competition;
    competitionEl.classList.remove('hidden');
  } else {
    competitionEl.classList.add('hidden');
  }

  document.getElementById('home-team-name').textContent = match.homeTeam;
  document.getElementById('away-team-name').textContent = match.awayTeam;
  document.getElementById('home-score').textContent = match.homeScore;
  document.getElementById('away-score').textContent = match.awayScore;

  // Minus buttons disabled at 0
  document.querySelector('[data-team="home"][data-action="minus"]').disabled = match.homeScore === 0;
  document.querySelector('[data-team="away"][data-action="minus"]').disabled = match.awayScore === 0;

  // Timer display & controls
  renderTimerDisplay();
  const timerToggleBtn = document.getElementById('timer-toggle-btn');
  const halfTimeBtn = document.getElementById('half-time-btn');
  const statusBadge = document.getElementById('match-status-badge');

  if (match.halfTime) {
    timerToggleBtn.textContent = '▶ 2. omgang';
    timerToggleBtn.disabled = false;
    statusBadge.textContent = 'HT';
    statusBadge.className = 'status-badge status-halftime';
    halfTimeBtn.disabled = true;
  } else if (match.timerRunning) {
    timerToggleBtn.textContent = '⏸ Pause';
    statusBadge.textContent = 'LIVE';
    statusBadge.className = 'status-badge status-live';
    halfTimeBtn.disabled = false;
    startTimer();
  } else {
    timerToggleBtn.textContent = match.elapsed === 0 ? '▶ Start' : '▶ Fortsett';
    statusBadge.textContent = match.elapsed === 0 ? 'PRE' : 'PAUSE';
    statusBadge.className = 'status-badge status-live';
    halfTimeBtn.disabled = match.elapsed === 0;
  }

  renderGoalLog();
}

function renderGoalLog() {
  const list = document.getElementById('goal-log-list');
  if (!list || !state.activeMatch) return;
  const goals = state.activeMatch.goals || [];

  if (goals.length === 0) {
    list.innerHTML = '<li class="goal-log-empty">Ingen mål ennå</li>';
    return;
  }

  list.innerHTML = goals.map((g) => {
    const side = g.team === 'home' ? 'home' : 'away';
    const teamName = g.team === 'home' ? state.activeMatch.homeTeam : state.activeMatch.awayTeam;
    const mins = Math.floor(g.elapsed / 60);
    return `<li class="goal-log-item ${side}">
      <span class="goal-icon">⚽</span>
      <span class="goal-team">${escapeHtml(teamName)}</span>
      <span class="goal-time">${mins}'</span>
    </li>`;
  }).join('');

  // Scroll to bottom
  list.scrollTop = list.scrollHeight;
}

function renderHistory() {
  const listEl = document.getElementById('history-list');
  const emptyEl = document.getElementById('history-empty');
  const history = state.history;

  if (history.length === 0) {
    listEl.classList.add('hidden');
    emptyEl.classList.remove('hidden');
    return;
  }

  emptyEl.classList.add('hidden');
  listEl.classList.remove('hidden');

  listEl.innerHTML = history.slice().reverse().map((m) => {
    const date = new Date(m.endedAt).toLocaleDateString(undefined, {
      weekday: 'short', month: 'short', day: 'numeric',
    });
    const time = new Date(m.endedAt).toLocaleTimeString(undefined, {
      hour: '2-digit', minute: '2-digit',
    });
    const duration = Math.floor(m.elapsed / 60);

    let homeResult = '', awayResult = '';
    if (m.homeScore > m.awayScore) {
      homeResult = '<span class="history-winner">Vinner</span>';
      awayResult = '';
    } else if (m.awayScore > m.homeScore) {
      homeResult = '';
      awayResult = '<span class="history-winner">Vinner</span>';
    } else {
      homeResult = '<span class="history-winner">Uavgjort</span>';
      awayResult = '<span class="history-winner">Uavgjort</span>';
    }

    const homeClass = m.homeScore > m.awayScore ? 'winner' : m.homeScore === m.awayScore ? 'draw' : '';
    const awayClass = m.awayScore > m.homeScore ? 'winner' : m.homeScore === m.awayScore ? 'draw' : '';

    const key = escapeHtml(matchKey(m));
    const goalCount = (m.goals || []).length;

    return `<li class="history-item" data-match-key="${key}">
      <div class="history-item-header">
        <span>${escapeHtml(date)} &bull; ${escapeHtml(time)}</span>
        <span class="history-item-header-right">
          <span>${duration}'</span>
          <button class="history-delete-btn" data-action="delete" data-match-key="${key}" aria-label="Slett kamp" title="Slett kamp">✕</button>
        </span>
      </div>
      <button type="button" class="history-item-body" data-action="detail" data-match-key="${key}" aria-label="Vis kampdetaljer">
        <span class="history-team ${homeClass}">
          <span class="history-team-name">${escapeHtml(m.homeTeam)}</span>
          <span class="history-team-label">Hjemme</span>
          ${homeResult}
        </span>
        <span class="history-score">
          <span class="history-score-num">${m.homeScore}</span>
          <span class="history-score-sep">:</span>
          <span class="history-score-num">${m.awayScore}</span>
        </span>
        <span class="history-team ${awayClass}">
          <span class="history-team-name">${escapeHtml(m.awayTeam)}</span>
          <span class="history-team-label">Borte</span>
          ${awayResult}
        </span>
      </button>
      <div class="history-item-footer">
        ${m.competition ? `${escapeHtml(m.competition)} &bull; ` : ''}${goalCount === 1 ? '1 mål' : `${goalCount} mål`} &bull; Trykk for detaljer
      </div>
    </li>`;
  }).join('');
}

// ===== Match Detail =====

// Stable identifier for a stored match. Older entries always have an id,
// but fall back to endedAt so nothing is unaddressable.
function matchKey(m) {
  return String(m.id || m.endedAt);
}

function findMatch(key) {
  return state.history.find((m) => matchKey(m) === key) || null;
}

function openMatchDetail(key) {
  const m = findMatch(key);
  if (!m) return;

  state.detailKey = key;
  document.getElementById('match-detail-content').innerHTML = buildMatchDetailHtml(m);
  openModal('match-detail-modal');
}

function buildMatchDetailHtml(m) {
  const date = new Date(m.endedAt).toLocaleDateString(undefined, {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
  const time = new Date(m.endedAt).toLocaleTimeString(undefined, {
    hour: '2-digit', minute: '2-digit',
  });
  const duration = Math.floor(m.elapsed / 60);

  // Goals are appended chronologically, but sort defensively so the
  // running score below is always computed in match order.
  const goals = (m.goals || []).slice().sort((a, b) => a.elapsed - b.elapsed);

  let running = { home: 0, away: 0 };
  const timeline = goals.map((g) => {
    const side = g.team === 'home' ? 'home' : 'away';
    running[side] += 1;
    const teamName = side === 'home' ? m.homeTeam : m.awayTeam;
    const mins = Math.floor(g.elapsed / 60);
    return `<li class="timeline-item ${side}">
      <span class="timeline-min">${mins}'</span>
      <span class="timeline-icon">⚽</span>
      <span class="timeline-team">${escapeHtml(teamName)}</span>
      <span class="timeline-score">${running.home}–${running.away}</span>
    </li>`;
  }).join('');

  const timelineBlock = goals.length
    ? `<ul class="timeline">${timeline}</ul>`
    : '<p class="detail-empty">Ingen mål i denne kampen</p>';

  const competitionBlock = m.competition
    ? `<div class="detail-competition"><span class="competition-tag">${escapeHtml(m.competition)}</span></div>`
    : '';

  return `
    ${competitionBlock}
    <div class="detail-summary">
      <div class="detail-team">${escapeHtml(m.homeTeam)}</div>
      <div class="detail-score">${m.homeScore}–${m.awayScore}</div>
      <div class="detail-team">${escapeHtml(m.awayTeam)}</div>
    </div>
    <div class="detail-meta">${escapeHtml(date)} &bull; ${escapeHtml(time)} &bull; ${duration} min</div>
    <h3 class="detail-section-title">Målrekkefølge</h3>
    ${timelineBlock}
  `;
}

function deleteMatch(key) {
  const idx = state.history.findIndex((m) => matchKey(m) === key);
  if (idx === -1) return;
  state.history.splice(idx, 1);
  saveHistory(state.history);
  renderHistory();
  showToast('Kamp slettet');
}

// ===== Planned Matches =====

// datetime-local wants "YYYY-MM-DDTHH:mm" in local time.
function toDatetimeLocalValue(ms) {
  const d = new Date(ms);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Default a new plan to the next whole hour.
function defaultKickoff() {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  d.setMinutes(0, 0, 0);
  return d.getTime();
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function formatKickoff(ms) {
  const d = new Date(ms);
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);

  const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  if (isSameDay(d, now)) return `I dag ${time}`;
  if (isSameDay(d, tomorrow)) return `I morgen ${time}`;

  const date = d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  return `${date} ${time}`;
}

function renderPlanned() {
  const listEl = document.getElementById('planned-list');
  const emptyEl = document.getElementById('planned-empty');

  if (state.planned.length === 0) {
    listEl.classList.add('hidden');
    emptyEl.classList.remove('hidden');
    return;
  }

  emptyEl.classList.add('hidden');
  listEl.classList.remove('hidden');

  const sorted = state.planned.slice().sort((a, b) => a.kickoffAt - b.kickoffAt);

  listEl.innerHTML = sorted.map((p) => {
    const id = escapeHtml(String(p.id));
    const overdue = p.kickoffAt < Date.now();
    const competition = p.competition
      ? `<span class="competition-tag">${escapeHtml(p.competition)}</span>`
      : '';

    return `<li class="planned-item">
      <div class="planned-item-header">
        <span class="planned-kickoff ${overdue ? 'overdue' : ''}">
          ${escapeHtml(formatKickoff(p.kickoffAt))}${overdue ? ' &bull; forfalt' : ''}
        </span>
        <button class="planned-delete-btn" data-plan-action="delete" data-plan-id="${id}"
                aria-label="Slett planlagt kamp" title="Slett">✕</button>
      </div>
      <div class="planned-teams">
        <span class="planned-team">${escapeHtml(p.homeTeam)}</span>
        <span class="planned-vs">–</span>
        <span class="planned-team">${escapeHtml(p.awayTeam)}</span>
      </div>
      ${competition ? `<div class="planned-competition">${competition}</div>` : ''}
      <button class="btn btn-primary btn-sm planned-start-btn" data-plan-action="start" data-plan-id="${id}">
        Start kamp
      </button>
    </li>`;
  }).join('');
}

function addPlannedMatch(homeTeam, awayTeam, competition, kickoffAt) {
  state.planned.push({
    id: Date.now().toString(),
    homeTeam: homeTeam.trim(),
    awayTeam: awayTeam.trim(),
    competition: competition.trim(),
    kickoffAt,
  });
  savePlanned(state.planned);
  renderPlanned();
  showToast('Kamp planlagt');
}

function deletePlannedMatch(id) {
  const idx = state.planned.findIndex((p) => String(p.id) === id);
  if (idx === -1) return;
  state.planned.splice(idx, 1);
  savePlanned(state.planned);
  renderPlanned();
  showToast('Planlagt kamp slettet');
}

function startPlannedMatch(id) {
  const p = state.planned.find((x) => String(x.id) === id);
  if (!p) return;

  // Only one match can be live at a time.
  if (state.activeMatch) {
    showToast('Avslutt den aktive kampen først');
    return;
  }

  createMatch(p.homeTeam, p.awayTeam, p.competition);

  // Consume the plan without the "deleted" toast that deletePlannedMatch shows.
  state.planned = state.planned.filter((x) => String(x.id) !== id);
  savePlanned(state.planned);
  renderPlanned();

  switchTab('live');
  showToast('Kampen er i gang');
}

// ===== Actions =====
function createMatch(homeTeam, awayTeam, competition) {
  state.activeMatch = {
    id: Date.now().toString(),
    homeTeam: homeTeam.trim(),
    awayTeam: awayTeam.trim(),
    competition: (competition || '').trim(),
    homeScore: 0,
    awayScore: 0,
    goals: [],
    startedAt: Date.now(),
    elapsed: 0,
    timerStartedAt: null,
    timerRunning: false,
    halfTime: false,
  };
  saveActiveMatch(state.activeMatch);
  renderActiveMatch();
}

function adjustScore(team, delta) {
  if (!state.activeMatch) return;
  const key = team === 'home' ? 'homeScore' : 'awayScore';
  const newScore = state.activeMatch[key] + delta;
  if (newScore < 0) return;
  state.activeMatch[key] = newScore;

  if (delta > 0) {
    state.activeMatch.goals.push({ team, elapsed: getElapsedSeconds() });
    showToast(`Mål! ${team === 'home' ? state.activeMatch.homeTeam : state.activeMatch.awayTeam} scorer ⚽`);
  } else {
    // Remove last goal for that team
    const goals = state.activeMatch.goals;
    for (let i = goals.length - 1; i >= 0; i--) {
      if (goals[i].team === team) {
        goals.splice(i, 1);
        break;
      }
    }
  }

  saveActiveMatch(state.activeMatch);
  renderActiveMatch();
}

function toggleTimer() {
  if (!state.activeMatch) return;

  if (state.activeMatch.halfTime) {
    state.activeMatch.halfTime = false;
    state.activeMatch.timerRunning = true;
    state.activeMatch.timerStartedAt = Date.now();
  } else if (state.activeMatch.timerRunning) {
    // Freeze accumulated elapsed before pausing
    state.activeMatch.elapsed = getElapsedSeconds();
    state.activeMatch.timerStartedAt = null;
    state.activeMatch.timerRunning = false;
  } else {
    state.activeMatch.timerRunning = true;
    state.activeMatch.timerStartedAt = Date.now();
  }

  saveActiveMatch(state.activeMatch);
  renderActiveMatch();
}

function setHalfTime() {
  if (!state.activeMatch) return;
  state.activeMatch.elapsed = getElapsedSeconds();
  state.activeMatch.timerStartedAt = null;
  state.activeMatch.timerRunning = false;
  state.activeMatch.halfTime = true;
  saveActiveMatch(state.activeMatch);
  stopTimer();
  renderActiveMatch();
  showToast('Pause!');
}

function endMatch() {
  if (!state.activeMatch) return;
  const match = {
    ...state.activeMatch,
    elapsed: getElapsedSeconds(),
    endedAt: Date.now(),
  };
  state.history.push(match);
  saveHistory(state.history);
  state.activeMatch = null;
  saveActiveMatch(null);
  stopTimer();
  renderActiveMatch();
  renderHistory();
  showToast('Kamp avsluttet og lagret!');
  // Switch to history tab to show the result
  switchTab('history');
}

function resetScore() {
  if (!state.activeMatch) return;
  state.activeMatch.homeScore = 0;
  state.activeMatch.awayScore = 0;
  state.activeMatch.goals = [];
  state.activeMatch.elapsed = 0;
  state.activeMatch.timerStartedAt = null;
  state.activeMatch.timerRunning = false;
  state.activeMatch.halfTime = false;
  stopTimer();
  saveActiveMatch(state.activeMatch);
  renderActiveMatch();
  showToast('Poengstilling nullstilt');
}

function clearHistory() {
  state.history = [];
  saveHistory(state.history);
  renderHistory();
  showToast('Historikk slettet');
}

function editTeamName(side) {
  if (!state.activeMatch) return;
  const currentName = side === 'home' ? state.activeMatch.homeTeam : state.activeMatch.awayTeam;
  document.getElementById('edit-team-input').value = currentName;
  document.getElementById('edit-team-side').value = side;
  document.getElementById('edit-modal-title').textContent = `Rediger ${side === 'home' ? 'hjemmelag' : 'bortelag'}`;
  openModal('edit-team-modal');
  setTimeout(() => document.getElementById('edit-team-input').focus(), 100);
}

// ===== Tab switching =====
function switchTab(tabName) {
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });
  document.querySelectorAll('.tab-content').forEach((el) => {
    el.classList.toggle('active', el.id === `tab-${tabName}`);
  });
}

// ===== Modal helpers =====
function openModal(id) {
  document.getElementById(id).classList.remove('hidden');
}

function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
}

// ===== Toast =====
let toastTimeout = null;

function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.remove('hidden');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.add('hidden'), 2500);
}

// ===== Helpers =====
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ===== PWA Install =====
let deferredInstallPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  document.getElementById('install-btn').classList.remove('hidden');
});

window.addEventListener('appinstalled', () => {
  document.getElementById('install-btn').classList.add('hidden');
  deferredInstallPrompt = null;
  showToast('App installert!');
});

// ===== Event Listeners =====
function bindEvents() {
  // Tab navigation
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // New match button
  document.getElementById('new-match-btn').addEventListener('click', () => {
    document.getElementById('home-team-input').value = '';
    document.getElementById('away-team-input').value = '';
    document.getElementById('competition-input').value = '';
    openModal('new-match-modal');
    setTimeout(() => document.getElementById('home-team-input').focus(), 100);
  });

  // Plan match buttons (header + empty state)
  const openPlanModal = () => {
    document.getElementById('plan-home-input').value = '';
    document.getElementById('plan-away-input').value = '';
    document.getElementById('plan-competition-input').value = '';
    document.getElementById('plan-kickoff-input').value = toDatetimeLocalValue(defaultKickoff());
    openModal('plan-match-modal');
    setTimeout(() => document.getElementById('plan-home-input').focus(), 100);
  };
  document.getElementById('plan-match-btn').addEventListener('click', openPlanModal);
  document.getElementById('plan-match-empty-btn').addEventListener('click', openPlanModal);

  // Plan match form submit
  document.getElementById('plan-match-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const homeInput = document.getElementById('plan-home-input');
    const awayInput = document.getElementById('plan-away-input');
    const kickoffInput = document.getElementById('plan-kickoff-input');
    const competition = document.getElementById('plan-competition-input').value;

    const home = homeInput.value.trim();
    const away = awayInput.value.trim();
    const kickoffAt = kickoffInput.value ? new Date(kickoffInput.value).getTime() : NaN;

    [homeInput, awayInput, kickoffInput].forEach((i) => i.classList.remove('error'));

    let valid = true;
    if (!home) { homeInput.classList.add('error'); valid = false; }
    if (!away) { awayInput.classList.add('error'); valid = false; }
    if (!kickoffInput.value || Number.isNaN(kickoffAt)) { kickoffInput.classList.add('error'); valid = false; }
    if (!valid) return;

    closeModal('plan-match-modal');
    addPlannedMatch(home, away, competition, kickoffAt);
  });

  document.getElementById('plan-modal-cancel-btn').addEventListener('click', () => closeModal('plan-match-modal'));
  document.getElementById('plan-match-modal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeModal('plan-match-modal');
  });

  // Planned list: start or delete a planned match
  document.getElementById('planned-list').addEventListener('click', (e) => {
    const target = e.target.closest('[data-plan-action]');
    if (!target) return;
    const id = target.dataset.planId;

    if (target.dataset.planAction === 'start') {
      startPlannedMatch(id);
    } else if (target.dataset.planAction === 'delete') {
      const p = state.planned.find((x) => String(x.id) === id);
      if (!p) return;
      if (confirm(`Slette den planlagte kampen ${p.homeTeam} – ${p.awayTeam}?`)) {
        deletePlannedMatch(id);
      }
    }
  });

  // New match form submit
  document.getElementById('new-match-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const homeInput = document.getElementById('home-team-input');
    const awayInput = document.getElementById('away-team-input');
    const home = homeInput.value.trim();
    const away = awayInput.value.trim();

    homeInput.classList.remove('error');
    awayInput.classList.remove('error');

    let valid = true;
    if (!home) { homeInput.classList.add('error'); homeInput.focus(); valid = false; }
    if (!away) { awayInput.classList.add('error'); if (valid) awayInput.focus(); valid = false; }
    if (!valid) return;

    closeModal('new-match-modal');
    createMatch(home, away, document.getElementById('competition-input').value);
  });

  // Modal cancel
  document.getElementById('modal-cancel-btn').addEventListener('click', () => closeModal('new-match-modal'));
  document.getElementById('new-match-modal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeModal('new-match-modal');
  });

  // Edit team form
  document.getElementById('edit-team-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('edit-team-input');
    const name = input.value.trim();
    const side = document.getElementById('edit-team-side').value;
    input.classList.remove('error');
    if (!name) { input.classList.add('error'); return; }
    if (side === 'home') state.activeMatch.homeTeam = name;
    else state.activeMatch.awayTeam = name;
    saveActiveMatch(state.activeMatch);
    closeModal('edit-team-modal');
    renderActiveMatch();
  });

  document.getElementById('edit-modal-cancel-btn').addEventListener('click', () => closeModal('edit-team-modal'));
  document.getElementById('edit-team-modal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeModal('edit-team-modal');
  });

  // Edit team name buttons
  document.querySelectorAll('.edit-team-btn').forEach((btn) => {
    btn.addEventListener('click', () => editTeamName(btn.dataset.team));
  });

  // Score buttons (event delegation)
  document.getElementById('active-match').addEventListener('click', (e) => {
    const btn = e.target.closest('.score-btn');
    if (!btn) return;
    const { team, action } = btn.dataset;
    adjustScore(team, action === 'plus' ? 1 : -1);
  });

  // Timer controls
  document.getElementById('timer-toggle-btn').addEventListener('click', toggleTimer);
  document.getElementById('half-time-btn').addEventListener('click', setHalfTime);

  // End / Reset match
  document.getElementById('end-match-btn').addEventListener('click', () => {
    if (confirm('Avslutt kampen og lagre i historikken?')) endMatch();
  });

  document.getElementById('reset-match-btn').addEventListener('click', () => {
    if (confirm('Nullstille poengstilling og klokke? Dette kan ikke angres.')) resetScore();
  });

  // History list: delete a single match, or open its details
  document.getElementById('history-list').addEventListener('click', (e) => {
    const target = e.target.closest('[data-action]');
    if (!target) return;
    const key = target.dataset.matchKey;

    if (target.dataset.action === 'delete') {
      const m = findMatch(key);
      if (!m) return;
      if (confirm(`Slette kampen ${m.homeTeam} – ${m.awayTeam}? Dette kan ikke angres.`)) {
        deleteMatch(key);
      }
    } else if (target.dataset.action === 'detail') {
      openMatchDetail(key);
    }
  });

  // Match detail modal
  document.getElementById('detail-close-btn').addEventListener('click', () => {
    closeModal('match-detail-modal');
    state.detailKey = null;
  });

  document.getElementById('match-detail-modal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) {
      closeModal('match-detail-modal');
      state.detailKey = null;
    }
  });

  document.getElementById('detail-delete-btn').addEventListener('click', () => {
    const key = state.detailKey;
    const m = findMatch(key);
    if (!m) return;
    if (confirm(`Slette kampen ${m.homeTeam} – ${m.awayTeam}? Dette kan ikke angres.`)) {
      deleteMatch(key);
      closeModal('match-detail-modal');
      state.detailKey = null;
    }
  });

  // Clear history
  document.getElementById('clear-history-btn').addEventListener('click', () => {
    if (state.history.length === 0) return;
    if (confirm('Slette all kamphistorikk?')) clearHistory();
  });

  // Install button
  document.getElementById('install-btn').addEventListener('click', async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    const { outcome } = await deferredInstallPrompt.userChoice;
    if (outcome === 'accepted') {
      document.getElementById('install-btn').classList.add('hidden');
    }
    deferredInstallPrompt = null;
  });
}

// ===== Service Worker Registration =====
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch((err) => {
      console.warn('Service worker registration failed:', err);
    });
  }
}

// ===== Init =====
function init() {
  state.activeMatch = loadActiveMatch();
  state.history = loadHistory();
  state.planned = loadPlanned();

  bindEvents();
  renderActiveMatch();
  renderPlanned();
  renderHistory();
  registerServiceWorker();

  // Resume timer if match was running when page closed.
  // If timerStartedAt is missing (old saved match), anchor it to now so
  // getElapsedSeconds() has a valid reference point.
  if (state.activeMatch && state.activeMatch.timerRunning) {
    if (!state.activeMatch.timerStartedAt) {
      state.activeMatch.timerStartedAt = Date.now();
      saveActiveMatch(state.activeMatch);
    }
    startTimer();
  }
}

document.addEventListener('DOMContentLoaded', init);
