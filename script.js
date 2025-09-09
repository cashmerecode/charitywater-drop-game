// Project 4 | Water Drop - Game Logic
const startBtn = document.getElementById('startBtn');
const replayBtn = document.getElementById('replayBtn');
const game = document.getElementById('game');
const scoreEl = document.getElementById('score');
const timerEl = document.getElementById('timer');
const feedback = document.getElementById('feedback');

let score = 0;
let timeLeft = 30;
let running = false;
let spawnLoop = null;
let timerLoop = null;

function rng(min, max){ return Math.random() * (max - min) + min; }

function setFeedback(msg, color){
  feedback.textContent = msg;
  feedback.style.borderColor = color || '#e2e8f0';
}

function popText(x, y, text, color){
  const el = document.createElement('div');
  el.className = 'pop';
  el.style.left = x + 'px';
  el.style.top  = y + 'px';
  el.style.color = color || '#111';
  el.textContent = text;
  game.appendChild(el);
  setTimeout(()=> el.remove(), 600);
}

function spawnDrop(){
  const isBad = Math.random() < 0.25; // 25% polluted
  const drop = document.createElement('button');
  drop.className = 'drop ' + (isBad ? 'bad' : 'clean');
  drop.setAttribute('aria-label', isBad ? 'Polluted drop' : 'Clean water drop');

  // random X within game bounds
  const x = rng(10, Math.max(10, game.clientWidth - 44));
  drop.style.left = x + 'px';
  drop.style.top  = '-40px';

  const speed = rng(80, 140); // pixels per second
  const label = document.createElement('span');
  label.className = 'label';
  label.textContent = isBad ? 'X' : '✓';
  drop.appendChild(label);

  let y = -40;
  const loop = setInterval(()=>{
    if(!running){ clearInterval(loop); drop.remove(); return; }
    y += speed * 0.016; // ~60fps
    drop.style.top = y + 'px';
    if(y > game.clientHeight){
      // ground collision: small penalty only for polluted drops
      if(isBad){
        score = Math.max(0, score - 2);
        scoreEl.textContent = score;
        setFeedback('Polluted hit ground: -2', '#ef4444');
      }
      clearInterval(loop);
      drop.remove();
    }
  }, 16);

  drop.addEventListener('click', (e)=>{
    if(!running) return;
    clearInterval(loop);
    drop.remove();
    const rect = game.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    if(isBad){
      score = Math.max(0, score - 5);
      popText(px, py, '-5', '#ef4444');
      setFeedback('Oops, polluted! -5', '#ef4444');
    }else{
      score += 10;
      popText(px, py, '+10', '#16a34a');
      setFeedback('Great catch! +10', '#16a34a');
    }
    scoreEl.textContent = score;
  });

  game.appendChild(drop);
}

function startGame(){
  if(running) return;
  running = true;
  score = 0; timeLeft = 30;
  scoreEl.textContent = score;
  timerEl.textContent = timeLeft;
  startBtn.style.display = 'none';
  replayBtn.disabled = true;
  setFeedback('Catch the clean water drops!');

  // spawn drops every 0.5s
  spawnLoop = setInterval(spawnDrop, 500);

  // countdown
  timerLoop = setInterval(()=>{
    timeLeft -= 1;
    timerEl.textContent = timeLeft;
    if(timeLeft <= 0){
      endGame();
    }
  }, 1000);
}

function endGame(){
  running = false;
  clearInterval(spawnLoop);
  clearInterval(timerLoop);
  setFeedback(score >= 100 ? 'Amazing! You are a clean water hero!' : 'Good try! Play again or learn more.');
  startBtn.style.display = 'inline-block';
  startBtn.textContent = 'Start';
  replayBtn.disabled = false;

  // clean up any remaining drops
  [...document.querySelectorAll('.drop')].forEach(d => d.remove());
}

function resetGame(){
  [...document.querySelectorAll('.drop')].forEach(d => d.remove());
  score = 0; timeLeft = 30;
  scoreEl.textContent = score;
  timerEl.textContent = timeLeft;
  setFeedback('Ready when you are.');
}

startBtn.addEventListener('click', startGame);
replayBtn.addEventListener('click', ()=>{ resetGame(); startGame(); });

// Keyboard accessibility: S to start, R to replay (when not running)
document.addEventListener('keydown', (e)=>{
  const k = e.key.toLowerCase();
  if(k === 's' && !running) startGame();
  if(k === 'r' && !running) { resetGame(); startGame(); }
});
