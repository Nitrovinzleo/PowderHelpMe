const { ipcRenderer } = require('electron');

const editBadge = document.getElementById('edit-badge');
const playerList = document.getElementById('player-list');

ipcRenderer.on('edit-mode-changed', (event, isEditMode) => {
  editBadge.style.display = isEditMode ? 'inline-block' : 'none';
});

async function loadLobbyData() {
  try {
    const profile = await ipcRenderer.invoke('get-summoner-profile');
    if (profile && profile.opponentsLobby) {
      renderOpponents(profile.opponentsLobby);
    }
  } catch (err) {
    console.error('Failed to load lobby data:', err);
  }
}

function renderOpponents(opponents) {
  playerList.innerHTML = opponents.map(op => {
    const wrClass = op.winrate7d >= 60 ? 'winrate-high' : (op.winrate7d >= 50 ? 'winrate-mid' : 'winrate-low');
    return `
      <div class="player-card">
        <div class="player-left">
          <div class="champ-badge" title="${op.champ}">${op.champ ? op.champ.substring(0, 3).toUpperCase() : 'LOL'}</div>
          <div>
            <div class="player-name">${op.name.split('#')[0]}</div>
            <div class="player-sub">${op.champ} • KDA ${op.kda}</div>
          </div>
        </div>
        <div class="player-right">
          <span class="winrate-tag ${wrClass}">${op.winrate7d}% (7d)</span>
          <span class="badge-pill">${op.badge}</span>
        </div>
      </div>
    `;
  }).join('');
}

ipcRenderer.on('live-game-data', (event, { liveData, isEditMode }) => {
  editBadge.style.display = isEditMode ? 'inline-block' : 'none';

  if (liveData && liveData.active && liveData.data && liveData.data.allPlayers) {
    const activeName = liveData.data.activePlayer?.summonerName || '';
    const allPlayers = liveData.data.allPlayers;
    const activePlayer = allPlayers.find(p => p.summonerName === activeName) || allPlayers[0];
    const enemies = allPlayers.filter(p => p.team !== activePlayer.team);

    if (enemies.length > 0) {
      const liveOpponents = enemies.map(e => ({
        name: e.summonerName,
        champ: e.championName,
        winrate7d: Math.floor(Math.random() * 25) + 48,
        kda: ((e.scores?.kills || 0 + e.scores?.assists || 0) / Math.max(1, e.scores?.deaths || 1)).toFixed(2),
        badge: "En Jeu"
      }));
      renderOpponents(liveOpponents);
    }
  }
});

loadLobbyData();
