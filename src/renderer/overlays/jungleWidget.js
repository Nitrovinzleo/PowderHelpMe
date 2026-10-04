const { ipcRenderer } = require('electron');

const editBadge = document.getElementById('edit-badge');
const dragonTimer = document.getElementById('dragon-timer');
const baronTimer = document.getElementById('baron-timer');
const redTimer = document.getElementById('red-timer');
const blueTimer = document.getElementById('blue-timer');
const grubsTimer = document.getElementById('grubs-timer');

let lastDragonKill = null;
let lastHeraldKill = null;

ipcRenderer.on('edit-mode-changed', (event, isEditMode) => {
  editBadge.style.display = isEditMode ? 'inline-block' : 'none';
});

ipcRenderer.on('live-game-data', (event, { liveData, isEditMode }) => {
  editBadge.style.display = isEditMode ? 'inline-block' : 'none';

  const gameTime = (liveData && liveData.active && liveData.data && liveData.data.gameData)
    ? liveData.data.gameData.gameTime
    : 0;

  // Process live events from game
  const events = liveData?.data?.events?.Events || [];
  events.forEach(e => {
    if (e.EventName === 'DragonKill') lastDragonKill = e.EventTime;
    if (e.EventName === 'HeraldKill') lastHeraldKill = e.EventTime;
  });

  // 1. Dragon Timer (5 min respawn)
  if (gameTime < 300) {
    // Before 5:00
    const remaining = Math.max(0, 300 - Math.floor(gameTime));
    dragonTimer.innerText = formatTime(remaining);
    dragonTimer.className = 'timer-clock countdown';
  } else if (lastDragonKill) {
    const respawnAt = lastDragonKill + 300;
    if (gameTime < respawnAt) {
      dragonTimer.innerText = formatTime(Math.floor(respawnAt - gameTime));
      dragonTimer.className = 'timer-clock countdown';
    } else {
      dragonTimer.innerText = 'DISPO';
      dragonTimer.className = 'timer-clock active';
    }
  } else {
    dragonTimer.innerText = 'DISPO';
    dragonTimer.className = 'timer-clock active';
  }

  // 2. Baron Nashor (Spawns at 20:00 = 1200s)
  if (gameTime < 1200) {
    const remaining = Math.max(0, 1200 - Math.floor(gameTime));
    baronTimer.innerText = formatTime(remaining);
    baronTimer.className = 'timer-clock countdown';
  } else {
    baronTimer.innerText = 'DISPO';
    baronTimer.className = 'timer-clock active';
  }

  // 3. Larves du néant (Spawns at 5:00 = 300s, despawns at 14:00)
  if (gameTime < 300) {
    grubsTimer.innerText = formatTime(300 - Math.floor(gameTime));
    grubsTimer.className = 'timer-clock countdown';
  } else if (gameTime < 840) {
    grubsTimer.innerText = 'DISPO';
    grubsTimer.className = 'timer-clock active';
  } else {
    grubsTimer.innerText = 'EXPIRÉ';
    grubsTimer.className = 'timer-clock';
  }
});

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}
