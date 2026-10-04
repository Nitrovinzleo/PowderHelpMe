const { ipcRenderer } = require('electron');

const offlineView = document.getElementById('offline-view');
const liveView = document.getElementById('live-view');
const editBadge = document.getElementById('edit-badge');

const dpmVal = document.getElementById('dpm-val');
const dpmBar = document.getElementById('dpm-bar');
const csVal = document.getElementById('cs-val');
const kdaVal = document.getElementById('kda-val');
const gpmVal = document.getElementById('gpm-val');
const kpVal = document.getElementById('kp-val');

ipcRenderer.on('edit-mode-changed', (event, isEditMode) => {
  editBadge.style.display = isEditMode ? 'inline-block' : 'none';
});

ipcRenderer.on('live-game-data', (event, { liveData, isEditMode }) => {
  editBadge.style.display = isEditMode ? 'inline-block' : 'none';

  if (!liveData || !liveData.active || !liveData.data) {
    offlineView.style.display = 'block';
    liveView.style.display = 'none';
    return;
  }

  offlineView.style.display = 'none';
  liveView.style.display = 'grid';

  const data = liveData.data;
  const gameTimeSec = data.gameData ? data.gameData.gameTime : 0;
  const gameTimeMin = gameTimeSec > 0 ? gameTimeSec / 60 : 0.01;

  const activeName = data.activePlayer ? data.activePlayer.summonerName : '';
  const allPlayers = data.allPlayers || [];
  const player = allPlayers.find(p => p.summonerName === activeName) || allPlayers[0];

  if (player && player.scores) {
    const totalDmg = player.scores.damageDealtToChampions || 0;
    const dpm = liveData.computed ? liveData.computed.dpm : Math.round(totalDmg / gameTimeMin);
    const cs = player.scores.creepScore || 0;
    const csPerMin = liveData.computed ? liveData.computed.csPerMin : (cs / gameTimeMin).toFixed(1);
    const kills = player.scores.kills || 0;
    const deaths = player.scores.deaths || 0;
    const assists = player.scores.assists || 0;
    const gpm = liveData.computed ? liveData.computed.gpm : Math.round(((player.scores.goldEarned || (cs * 20)) / gameTimeMin));

    // Calculate team kills for KP
    const team = player.team;
    const teamKills = allPlayers.filter(p => p.team === team).reduce((acc, p) => acc + (p.scores?.kills || 0), 0);
    const kp = teamKills > 0 ? Math.round(((kills + assists) / teamKills) * 100) : 0;

    dpmVal.innerText = dpm;
    csVal.innerText = csPerMin;
    kdaVal.innerText = `${kills}/${deaths}/${assists}`;
    gpmVal.innerText = gpm;
    kpVal.innerText = `${kp}%`;

    // DPM bar target fill (target 700 DPM)
    const targetDpm = 700;
    const dpmPercent = Math.min(100, Math.round((dpm / targetDpm) * 100));
    dpmBar.style.width = `${dpmPercent}%`;
  }
});
