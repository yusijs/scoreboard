'use strict';

// ===== Storage =====
const STORAGE_KEYS = {
  activeMatch: 'soccer_active_match',
  history: 'soccer_match_history',
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

// ===== State =====
let state = {
  activeMatch: null,   // { id, homeTeam, awayTeam, homeScore, awayScore, goals, startedAt, elapsed, timerStartedAt, timerRunning, halfTime }
  history: [],
  timerInterval: null,
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

    return `<li class="history-item">
      <div class="history-item-header">
        <span>${escapeHtml(date)} &bull; ${escapeHtml(time)}</span>
        <span>${duration}'</span>
      </div>
      <div class="history-item-body">
        <div class="history-team ${homeClass}">
          <div class="history-team-name">${escapeHtml(m.homeTeam)}</div>
          <div class="history-team-label">Hjemme</div>
          ${homeResult}
        </div>
        <div class="history-score">
          <span class="history-score-num">${m.homeScore}</span>
          <span class="history-score-sep">:</span>
          <span class="history-score-num">${m.awayScore}</span>
        </div>
        <div class="history-team ${awayClass}">
          <div class="history-team-name">${escapeHtml(m.awayTeam)}</div>
          <div class="history-team-label">Borte</div>
          ${awayResult}
        </div>
      </div>
    </li>`;
  }).join('');
}

// ===== Actions =====
function createMatch(homeTeam, awayTeam) {
  state.activeMatch = {
    id: Date.now().toString(),
    homeTeam: homeTeam.trim(),
    awayTeam: awayTeam.trim(),
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
    openModal('new-match-modal');
    setTimeout(() => document.getElementById('home-team-input').focus(), 100);
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
    createMatch(home, away);
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

  bindEvents();
  renderActiveMatch();
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
