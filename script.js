const startBtn = document.getElementById('startBtn');
const replayBtn = document.getElementById('replayBtn');
const game = document.getElementById('game');
const scoreEl = document.getElementById('score');
const timerEl = document.getElementById('timer');
const feedback = document.getElementById('feedback');
const highScoreEl = document.getElementById('highScore');

const achievementsBtn = document.getElementById('achievementsBtn');
const achievementsModal = document.getElementById('achievementsModal');
const achievementsList = document.getElementById('achievementsList');

const goalFill = document.getElementById('goalFill');
const goalText = document.getElementById('goalText');
const goalBar = document.querySelector('.goal-bar');

const summaryModal = document.getElementById('summaryModal');
const sumScore = document.getElementById('sumScore');
const sumClean = document.getElementById('sumClean');
const sumPolluted = document.getElementById('sumPolluted');
const sumLost = document.getElementById('sumLost');
const summaryPlayAgain = document.getElementById('summaryPlayAgain');

let score = 0;
let timeLeft = 30;
let running = false;
let paused = false;

let spawnTimer = null;
let spawnDelay = 600;
const minSpawnDelay = 350;

let timerLoop = null;

let cleanClicks = 0;
let pollutedClicks = 0;
let currentStreak = 0;
let bestStreak = 0;
let timeToFirstClean = null;
let gameStartEpoch = 0;
let waterLost = 0;

let lastFocusedButton = null;

const rng = (min, max) => Math.random() * (max - min) + min;

function setFeedback(msg, color) {
  feedback.textContent = msg;
  feedback.style.borderColor = color || '#e2e8f0';
}

function popText(x, y, text, color) {
  const el = document.createElement('div');
  el.className = 'pop';
  el.style.left = x + 'px';
  el.style.top = y + 'px';
  el.style.color = color || '#111';
  el.textContent = text;
  game.appendChild(el);
  setTimeout(() => el.remove(), 650);
}

function flashGoal() {
  if (!goalFill) return;
  const prev = goalFill.style.filter;
  goalFill.style.filter = 'brightness(1.25)';
  setTimeout(() => (goalFill.style.filter = prev || 'none'), 250);
}

function updateGoal() {
  const step = 100;
  const prev = Math.floor(score / step) * step;
  const next = prev + step;
  const remaining = Math.max(0, next - score);
  const pct = Math.min(100, ((score - prev) / (next - prev)) * 100);
  if (goalFill) goalFill.style.width = pct + '%';
  if (goalBar) goalBar.setAttribute('aria-valuenow', String(Math.round(pct)));
  if (goalText) goalText.textContent = `Next milestone: ${next} points (${remaining} to go)`;
  if (score && score % step === 0) flashGoal();
}

const STORAGE = {
  HIGH: 'waterdrop:highscore',
  STATS: 'waterdrop:stats',
  ACH: 'waterdrop:ach',
  MUTE: 'waterdrop:mute'
};

const defaultStats = { totalGames: 0, totalClean: 0, totalPolluted: 0, bestCleanStreak: 0 };

function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
function saveJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

let highScore = Number(localStorage.getItem(STORAGE.HIGH) || 0);
let stats = loadJSON(STORAGE.STATS, defaultStats);
let achieved = loadJSON(STORAGE.ACH, {});

if (highScoreEl) highScoreEl.textContent = String(highScore);

const BADGES = [
  { id: 'score100',  title: 'Clean Water Hero',  desc: 'Score 100+ in a game.',          color: '#16a34a', icon: '★', check: m => m.finalScore >= 100 },
  { id: 'score200',  title: 'Flow Master',       desc: 'Score 200+ in a game.',          color: '#0284c7', icon: '◆', check: m => m.finalScore >= 200 },
  { id: 'streak10',  title: 'Precision Catcher', desc: '10 clean catches in a row.',     color: '#a855f7', icon: '⧗', check: m => m.bestStreak >= 10 },
  { id: 'noPollute', title: 'Crystal Hands',     desc: 'Finish with 0 polluted clicks.', color: '#22c55e', icon: '✓', check: m => m.pollutedClicks === 0 && m.cleanClicks > 0 },
  { id: 'speedstart',title: 'Quick Start',       desc: 'First clean within 3 seconds.',   color: '#f97316', icon: '⚡', check: m => m.timeToFirstClean !== null && m.timeToFirstClean <= 3 },
  { id: 'fiveGames', title: 'Steady Stream',     desc: 'Play 5 total games.',            color: '#64748b', icon: '∞', check: m => m.stats.totalGames >= 5 }
];

function renderAchievements() {
  if (!achievementsList) return;
  achievementsList.innerHTML = '';
  BADGES.forEach(b => {
    const unlocked = Boolean(achieved[b.id]);
    const row = document.createElement('div');
    row.className = 'badge' + (unlocked ? '' : ' locked') + (b.id.startsWith('score') ? ' clean' : '');
    row.innerHTML = `
      <div class="icon" style="background:${b.color}">${b.icon}</div>
      <div class="copy">
        <div class="title">${b.title}${unlocked ? '' : ' (Locked)'}</div>
        <div class="desc">${b.desc}</div>
      </div>`;
    achievementsList.appendChild(row);
  });
}

function toast(text, color) {
  const t = document.createElement('div');
  t.style.position = 'fixed';
  t.style.right = '14px';
  t.style.bottom = '14px';
  t.style.background = '#fff';
  t.style.border = '1px solid #e5e7eb';
  t.style.boxShadow = '0 8px 24px rgba(17,24,39,.08)';
  t.style.borderRadius = '12px';
  t.style.padding = '10px 14px';
  t.style.fontWeight = '700';
  t.style.color = color || '#111';
  t.textContent = text;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 1600);
}

if (achievementsBtn && achievementsModal) {
  achievementsBtn.addEventListener('click', () => {
    lastFocusedButton = document.activeElement;
    renderAchievements();
    achievementsModal.showModal();
    const closeBtn = achievementsModal.querySelector('button[value="close"]');
    closeBtn && closeBtn.focus();
  });
  achievementsModal.addEventListener('close', () => {
    achievementsModal.blur();
    lastFocusedButton && lastFocusedButton.focus();
  });
}

function spawnDrop() {
  const isBad = Math.random() < 0.25;
  const drop = document.createElement('button');
  drop.className = 'drop ' + (isBad ? 'bad' : 'clean');
  drop.setAttribute('aria-label', isBad ? 'Polluted drop' : 'Clean water drop');

  game.appendChild(drop);
  const dropW = drop.offsetWidth || 34;
  const x = rng(10, Math.max(10, game.clientWidth - dropW - 10));
  drop.style.left = x + 'px';
  drop.style.top = '-40px';

  const speed = rng(80, 140);
  const label = document.createElement('span');
  label.className = 'label';
  label.textContent = isBad ? 'X' : '✓';
  drop.appendChild(label);

  let y = -40;
  const loop = setInterval(() => {
    if (!running) { clearInterval(loop); drop.remove(); return; }
    if (paused) return;
    y += speed * 0.016;
    drop.style.top = y + 'px';
    if (y > game.clientHeight) {
      if (isBad) {
        score = Math.max(0, score - 2);
        scoreEl.textContent = score;
        waterLost++;
        setFeedback('Polluted hit ground: -2', '#ef4444');
      } else {
        waterLost++;
        setFeedback('Missed clean water — catch the next one!', '#ef4444');
      }
      updateGoal();
      clearInterval(loop);
      drop.remove();
    }
  }, 16);

  drop.addEventListener('click', (e) => {
    if (!running || paused) return;
    clearInterval(loop);
    drop.remove();
    const rect = game.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    if (isBad) {
      pollutedClicks++;
      currentStreak = 0;
      score = Math.max(0, score - 5);
      popText(px, py, '-5', '#ef4444');
      setFeedback('Polluted drop — keep going!', '#ef4444');
    } else {
      cleanClicks++;
      if (timeToFirstClean === null) {
        timeToFirstClean = (performance.now() - gameStartEpoch) / 1000;
      }
      currentStreak++;
      bestStreak = Math.max(bestStreak, currentStreak);
      score += 10;
      popText(px, py, '+10', '#16a34a');
      setFeedback('Great catch! +10', '#16a34a');
    }
    scoreEl.textContent = score;
    updateGoal();
  });
}

function scheduleSpawn() {
  if (!running) return;
  spawnDrop();
  spawnDelay = Math.max(minSpawnDelay, spawnDelay - 6); 
  spawnTimer = setTimeout(scheduleSpawn, spawnDelay);
}

function startGame() {
  if (running) return;
  running = true;
  paused = false;
  score = 0;
  timeLeft = 30;
  scoreEl.textContent = score;
  timerEl.textContent = timeLeft;
  startBtn.style.display = 'none';
  replayBtn.disabled = true;
  setFeedback('Catch the clean water drops!');
  updateGoal();

  cleanClicks = 0;
  pollutedClicks = 0;
  currentStreak = 0;
  bestStreak = 0;
  timeToFirstClean = null;
  gameStartEpoch = performance.now();
  waterLost = 0;
  spawnDelay = 600;

  scheduleSpawn();

  timerLoop = setInterval(() => {
    if (paused) return;
    timeLeft -= 1;
    timerEl.textContent = timeLeft;
    if (timeLeft <= 0) endGame();
  }, 1000);
}

function endGame() {
  running = false;
  paused = false;
  clearTimeout(spawnTimer);
  clearInterval(timerLoop);

  stats.totalGames += 1;
  stats.totalClean += cleanClicks;
  stats.totalPolluted += pollutedClicks;
  stats.bestCleanStreak = Math.max(stats.bestCleanStreak, bestStreak);
  saveJSON(STORAGE.STATS, stats);

  if (score > highScore) {
    highScore = score;
    localStorage.setItem(STORAGE.HIGH, String(highScore));
    highScoreEl && (highScoreEl.textContent = String(highScore));
    setFeedback(`New High Score! ${highScore}`, '#16a34a');
  } else {
    setFeedback(score >= 100 ? 'Amazing! You are a clean water hero!' : 'Good try! Play again or learn more.');
  }

  const metrics = {
    finalScore: score,
    cleanClicks,
    pollutedClicks,
    bestStreak,
    timeToFirstClean,
    stats
  };

  const newlyUnlocked = [];
  BADGES.forEach(b => {
    if (!achieved[b.id] && b.check(metrics)) {
      achieved[b.id] = true;
      newlyUnlocked.push(b);
    }
  });
  if (newlyUnlocked.length) {
    saveJSON(STORAGE.ACH, achieved);
    newlyUnlocked.slice(0, 2).forEach(b => toast(`🏅 ${b.title} unlocked!`, b.color));
  }

  [...document.querySelectorAll('.drop')].forEach(d => d.remove());
  startBtn.style.display = 'inline-block';
  startBtn.textContent = 'Start';
  replayBtn.disabled = false;

  if (summaryModal && sumScore && sumClean && sumPolluted && sumLost) {
    sumScore.textContent = String(score);
    sumClean.textContent = String(cleanClicks);
    sumPolluted.textContent = String(pollutedClicks);
    sumLost.textContent = String(waterLost);
    summaryModal.showModal();
    const closeBtn = summaryModal.querySelector('button[value="close"]');
    closeBtn && closeBtn.focus();
  }
}

function resetGame() {
  [...document.querySelectorAll('.drop')].forEach(d => d.remove());
  score = 0;
  timeLeft = 30;
  scoreEl.textContent = score;
  timerEl.textContent = timeLeft;
  currentStreak = 0;
  setFeedback('Ready when you are.');
  updateGoal();
}

function togglePause() {
  if (!running) return;
  paused = !paused;
  game.classList.toggle('is-paused', paused);
  setFeedback(paused ? 'Paused — press P to resume' : 'Go!');
}

startBtn.addEventListener('click', startGame);
replayBtn.addEventListener('click', () => { resetGame(); startGame(); });

document.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if (k === 's' && !running) startGame();
  if (k === 'r' && !running) { resetGame(); startGame(); }
  if (k === 'p') togglePause();
});

if (summaryPlayAgain) {
  summaryPlayAgain.addEventListener('click', (e) => {
    e.preventDefault();
    summaryModal.close();
    resetGame();
    startGame();
  });
}

// Init
renderAchievements();
updateGoal();
