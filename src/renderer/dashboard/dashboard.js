const { ipcRenderer, shell } = require('electron');
const lucide = require('lucide');
const Chart = require('chart.js/auto');

window.lucide = lucide;
window.Chart = Chart;

function refreshLucideIcons() {
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    try {
      window.lucide.createIcons({ icons: window.lucide });
    } catch (e) {
      console.warn('Lucide createIcons warning:', e);
    }
  }
}

// UI Elements
const btnMinimize = document.getElementById('btn-minimize');
const btnClose = document.getElementById('btn-close');
const accountBtn = document.getElementById('account-btn');
const updateStatsBtn = document.getElementById('update-stats-btn');

const searchInput = document.getElementById('search-input');
const searchRegion = document.getElementById('search-region');
const searchBtn = document.getElementById('search-btn');

const subnavItems = document.querySelectorAll('.subnav-item');
const tabPanes = document.querySelectorAll('.tab-pane');

// Profile Elements
const profAvatar = document.getElementById('prof-avatar');
const profLevel = document.getElementById('prof-level');
const profName = document.getElementById('prof-name');
const profTag = document.getElementById('prof-tag');
const profLadder = document.getElementById('prof-ladder');

// Rank Elements
const soloTierName = document.getElementById('solo-tier-name');
const soloLp = document.getElementById('solo-lp');
const soloWrText = document.getElementById('solo-wr-text');

const flexTierName = document.getElementById('flex-tier-name');
const flexLp = document.getElementById('flex-lp');
const flexWrText = document.getElementById('flex-wr-text');

// Tables & Lists
const topChampsList = document.getElementById('top-champs-list');
const matchCardsContainer = document.getElementById('match-cards-container');
const champsDetailTable = document.getElementById('champs-detail-table');
const tierlistContainer = document.getElementById('tierlist-container');

// OriBot Modal Elements
const accountModal = document.getElementById('account-modal');
const closeModalBtn = document.getElementById('close-modal-btn');
const accGamename = document.getElementById('acc-gamename');
const accTagline = document.getElementById('acc-tagline');
const accRegion = document.getElementById('acc-region');

const oribotStep1 = document.getElementById('oribot-step-1');
const oribotStep2 = document.getElementById('oribot-step-2');
const genChallengeBtn = document.getElementById('gen-challenge-btn');
const verifyIconBtn = document.getElementById('verify-icon-btn');
const backStep1Btn = document.getElementById('back-step1-btn');
const challengeIconImg = document.getElementById('challenge-icon-img');
const challengeIconName = document.getElementById('challenge-icon-name');
const verifyStatusMsg = document.getElementById('verify-status-msg');

let currentChallenge = null;
let lpChart = null;
let currentProfile = null;
let followedPlayersList = [];

// Window Controls
btnMinimize?.addEventListener('click', () => ipcRenderer.send('minimize-dashboard'));
btnClose?.addEventListener('click', () => ipcRenderer.send('close-dashboard'));

// Subnav Tab Switcher
subnavItems.forEach(item => {
  item?.addEventListener('click', () => {
    const targetTab = item.getAttribute('data-tab');
    subnavItems.forEach(n => n.classList.remove('active'));
    tabPanes.forEach(p => p.classList.remove('active'));

    item.classList.add('active');
    const targetPane = document.getElementById(targetTab);
    if (targetPane) targetPane.classList.add('active');

    if (targetTab === 'tab-lp' && lpChart) {
      lpChart.resize();
    }
  });
});

// Discord RPC Settings & UI Handlers
const discordRpcToggle = document.getElementById('discord-rpc-toggle');
const discordToggleContainer = document.getElementById('discord-toggle-container');
const discordToggleSlider = document.getElementById('discord-toggle-slider');
const discordToggleKnob = document.getElementById('discord-toggle-knob');
const discordStatusText = document.getElementById('discord-status-text');
const rpcPreviewBox = document.getElementById('discord-rpc-preview-box');
const rpcPreviewDetails = document.getElementById('rpc-preview-details');
const rpcPreviewState = document.getElementById('rpc-preview-state');
const discordConnBadge = document.getElementById('discord-conn-badge');
const discordDot = document.getElementById('discord-dot');
const discordBadgeLabel = document.getElementById('discord-badge-label');

async function updateDiscordRpcUI() {
  try {
    const settings = await ipcRenderer.invoke('get-discord-settings');
    const enabled = settings.enabled;
    const isConnected = settings.isConnected;

    if (discordRpcToggle) discordRpcToggle.checked = enabled;

    if (discordToggleSlider) {
      discordToggleSlider.style.background = enabled ? 'var(--powder-cyan)' : '#232a3b';
    }
    if (discordToggleKnob) {
      discordToggleKnob.style.left = enabled ? '20px' : '2px';
    }
    if (discordStatusText) {
      discordStatusText.innerText = enabled ? 'Activé' : 'Désactivé';
      discordStatusText.style.color = enabled ? 'var(--powder-cyan)' : 'var(--text-muted)';
    }

    if (rpcPreviewBox) {
      rpcPreviewBox.style.opacity = enabled ? '1' : '0.4';
    }

    if (discordConnBadge) {
      if (!enabled) {
        discordConnBadge.style.borderColor = '#5a687d';
        discordConnBadge.style.background = 'rgba(90, 104, 125, 0.15)';
        discordConnBadge.style.color = '#8d9bb0';
        if (discordDot) discordDot.style.background = '#5a687d';
        if (discordBadgeLabel) discordBadgeLabel.innerText = 'Inactif';
      } else if (isConnected) {
        discordConnBadge.style.borderColor = '#2ecc71';
        discordConnBadge.style.background = 'rgba(46, 204, 113, 0.15)';
        discordConnBadge.style.color = '#2ecc71';
        if (discordDot) discordDot.style.background = '#2ecc71';
        if (discordBadgeLabel) discordBadgeLabel.innerText = 'Discord';
      } else {
        discordConnBadge.style.borderColor = '#e5a93c';
        discordConnBadge.style.background = 'rgba(229, 169, 60, 0.15)';
        discordConnBadge.style.color = '#e5a93c';
        if (discordDot) discordDot.style.background = '#e5a93c';
        if (discordBadgeLabel) discordBadgeLabel.innerText = 'Recherche...';
      }
    }
  } catch (err) {
    console.error('Failed to get discord settings:', err);
  }
}

discordToggleContainer?.addEventListener('click', async (e) => {
  e.preventDefault();
  await ipcRenderer.invoke('toggle-discord-presence');
  updateDiscordRpcUI();
});

let latestLiveDataPayload = null;
let isLiveDemoActive = false;

ipcRenderer.on('live-game-data', (event, payload) => {
  latestLiveDataPayload = payload;
  const liveData = payload?.liveData || payload;

  if (liveData && liveData.active && liveData.data) {
    const allPlayers = liveData.data.allPlayers || [];
    const activePlayer = liveData.data.activePlayer || {};
    const activeName = activePlayer.summonerName || (allPlayers[0] ? allPlayers[0].summonerName : '');
    const p = allPlayers.find(item => item.summonerName && item.summonerName.toLowerCase() === activeName.toLowerCase()) || allPlayers[0];

    const champ = p ? p.championName : 'League of Legends';
    const scores = p ? p.scores || {} : {};
    const kda = `${scores.kills || 0}/${scores.deaths || 0}/${scores.assists || 0}`;
    const dpm = liveData.computed?.dpm || 0;
    const cs = scores.creepScore || 0;

    if (rpcPreviewDetails) rpcPreviewDetails.innerText = `BetaTester testing`;
    if (rpcPreviewState) rpcPreviewState.innerText = `Powder is using her best tools to make you win`;
  } else {
    if (rpcPreviewDetails) rpcPreviewDetails.innerText = `BetaTester testing`;
    if (rpcPreviewState) rpcPreviewState.innerText = `Powder is using her best tools to make you win`;
  }
  updateDiscordRpcUI();
  renderLiveGameUI(payload);
});

// Render Live Game Telemetry inside Profile Subcategory Tab
function renderLiveGameUI(payload = latestLiveDataPayload) {
  const liveGameTabBody = document.getElementById('livegame-tab-body');
  const statusBadge = document.getElementById('livegame-status-badge');
  const statusText = document.getElementById('livegame-status-text');
  const subtitle = document.getElementById('livegame-mode-subtitle');
  if (!liveGameTabBody) return;

  const liveData = payload?.liveData || payload;
  const buildAdvice = payload?.buildAdvice;

  if (!liveData || !liveData.active || !liveData.data) {
    if (statusBadge) statusBadge.className = 'live-status-pill offline';
    if (statusText) statusText.innerText = 'OFFLINE';
    if (subtitle) subtitle.innerText = 'No active live game detected for this player.';

    liveGameTabBody.innerHTML = `
      <div style="text-align: center; padding: 40px 20px;">
        <div style="width: 64px; height: 64px; border-radius: 50%; background: rgba(0, 168, 232, 0.1); border: 2px solid rgba(0, 168, 232, 0.3); display: flex; align-items: center; justify-content: center; margin: 0 auto 16px auto; color: var(--powder-cyan);">
          <i data-lucide="video-off" style="width: 28px; height: 28px;"></i>
        </div>
        <h3 style="font-size: 16px; font-weight: 800; color: #fff; margin: 0 0 8px 0;">No Active Live Game</h3>
        <p style="font-size: 12px; color: var(--text-muted); max-width: 420px; margin: 0 auto 20px auto; line-height: 1.6;">
          This summoner is currently not in an active League of Legends match. Start a game or click <strong>Simulate Live Game</strong> to test real-time DPM and item recommendations!
        </p>
        <button id="start-demo-action-btn" class="pill-button" style="background: var(--powder-cyan); color: #000; font-weight: 800; padding: 10px 22px; font-size: 13px; border-radius: 20px; display: inline-flex; align-items: center; gap: 8px; border: none; cursor: pointer;">
          <i data-lucide="play" style="width: 14px; height: 14px; stroke: #000 !important;"></i>
          <span>Launch Live Simulator Demo</span>
        </button>
      </div>
    `;

    document.getElementById('start-demo-action-btn')?.addEventListener('click', () => {
      isLiveDemoActive = true;
      ipcRenderer.send('toggle-demo-mode', true);
      const demoBtnText = document.getElementById('demo-btn-text');
      if (demoBtnText) demoBtnText.innerText = 'Stop Live Simulation';
    });

    refreshLucideIcons();
    return;
  }

  // Active Live Game Telemetry State
  const gameData = liveData.data.gameData || {};
  const activePlayer = liveData.data.activePlayer || {};
  const allPlayers = liveData.data.allPlayers || [];
  const computed = liveData.computed || {};

  const gameTime = gameData.gameTime || 0;
  const mins = Math.floor(gameTime / 60);
  const secs = Math.floor(gameTime % 60).toString().padStart(2, '0');
  const timeStr = `${mins}:${secs}`;

  if (statusBadge) statusBadge.className = 'live-status-pill active';
  if (statusText) statusText.innerText = `LIVE IN GAME • ${timeStr}`;
  if (subtitle) subtitle.innerText = `${gameData.mapName || "Summoner's Rift"} • ${gameData.gameMode || 'CLASSIC'}`;

  const searchedName = currentProfile ? currentProfile.gameName : (activePlayer.summonerName || '');
  const activeP = allPlayers.find(p => p.summonerName && p.summonerName.toLowerCase().includes(searchedName.toLowerCase())) || allPlayers[0] || {};
  const scores = activeP.scores || {};
  const kdaStr = `${scores.kills || 0} / ${scores.deaths || 0} / ${scores.assists || 0}`;

  const blueTeam = allPlayers.filter(p => p.team === 'ORDER' || p.team === 100);
  const redTeam = allPlayers.filter(p => p.team === 'CHAOS' || p.team === 200 || p.team !== 'ORDER');

  const adviceList = buildAdvice?.recommendedItems || ['Infinity Edge', 'Phantom Dancer', 'Lord Dominik\'s Regards'];

  liveGameTabBody.innerHTML = `
    <!-- Top Live Stats Summary Bar -->
    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px;">
      <div style="background: #141926; border: 1px solid #232a3b; border-radius: 10px; padding: 12px 16px;">
        <div style="font-size: 10px; font-weight: 800; color: var(--text-muted); text-transform: uppercase; margin-bottom: 4px;">Live DPM (Damage/Min)</div>
        <div style="font-size: 20px; font-weight: 900; color: var(--powder-cyan); font-family: monospace;">${computed.dpm || 0} <span style="font-size: 11px; font-weight: 600; color: var(--text-muted);">DPM</span></div>
      </div>

      <div style="background: #141926; border: 1px solid #232a3b; border-radius: 10px; padding: 12px 16px;">
        <div style="font-size: 10px; font-weight: 800; color: var(--text-muted); text-transform: uppercase; margin-bottom: 4px;">Current KDA</div>
        <div style="font-size: 18px; font-weight: 900; color: #fff;">${kdaStr}</div>
      </div>

      <div style="background: #141926; border: 1px solid #232a3b; border-radius: 10px; padding: 12px 16px;">
        <div style="font-size: 10px; font-weight: 800; color: var(--text-muted); text-transform: uppercase; margin-bottom: 4px;">CS / Min</div>
        <div style="font-size: 18px; font-weight: 900; color: var(--powder-gold);">${scores.creepScore || 0} <span style="font-size: 11px; font-weight: 600; color: var(--text-muted);">(${computed.csPerMin || 0}/m)</span></div>
      </div>

      <div style="background: #141926; border: 1px solid #232a3b; border-radius: 10px; padding: 12px 16px;">
        <div style="font-size: 10px; font-weight: 800; color: var(--text-muted); text-transform: uppercase; margin-bottom: 4px;">Total Gold (GPM)</div>
        <div style="font-size: 18px; font-weight: 900; color: #2ecc71;">${computed.gpm || 0} <span style="font-size: 11px; font-weight: 600; color: var(--text-muted);">g/min</span></div>
      </div>
    </div>

    <!-- Powder Tactical Live Recommendation -->
    <div style="background: linear-gradient(135deg, rgba(0, 168, 232, 0.1) 0%, rgba(20, 25, 38, 0.95) 100%); border: 1px solid rgba(0, 168, 232, 0.3); border-radius: 10px; padding: 14px 18px; margin-bottom: 20px;">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <i data-lucide="sparkles" style="width: 16px; height: 16px; color: var(--powder-cyan);"></i>
          <span style="font-size: 12px; font-weight: 800; color: var(--powder-cyan); text-transform: uppercase; letter-spacing: 0.5px;">Powder Live Build Advice</span>
        </div>
        <span style="font-size: 10px; color: var(--text-muted); font-weight: 700;">REAL-TIME RECOMMENDED</span>
      </div>
      <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
        ${adviceList.map(item => `
          <div style="background: #141926; border: 1px solid var(--powder-cyan); border-radius: 6px; padding: 6px 12px; font-size: 12px; font-weight: 700; color: #fff; display: flex; align-items: center; gap: 6px;">
            <i data-lucide="shield-check" style="width: 12px; height: 12px; color: var(--powder-cyan);"></i>
            <span>${item}</span>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- Matchup Scoreboards (ORDER vs CHAOS) -->
    <div style="display: flex; flex-direction: column; gap: 16px;">
      <!-- ORDER (Blue Team) -->
      <div>
        <div style="font-size: 11px; font-weight: 800; color: #3498db; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
          <span style="width: 8px; height: 8px; border-radius: 50%; background: #3498db;"></span>
          <span>Blue Team (ORDER)</span>
        </div>
        <div style="background: #141926; border: 1px solid #232a3b; border-radius: 8px; overflow: hidden;">
          <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
            <thead>
              <tr style="border-bottom: 1px solid #232a3b; color: var(--text-muted); font-size: 10px; text-transform: uppercase;">
                <th style="padding: 8px 12px; text-align: left;">Summoner</th>
                <th style="padding: 8px 12px; text-align: center;">Champion</th>
                <th style="padding: 8px 12px; text-align: center;">K / D / A</th>
                <th style="padding: 8px 12px; text-align: center;">CS</th>
                <th style="padding: 8px 12px; text-align: right;">Items</th>
              </tr>
            </thead>
            <tbody>
              ${(blueTeam.length ? blueTeam : [activeP]).map(p => {
                const isMe = p.summonerName && activeP.summonerName && p.summonerName.toLowerCase() === activeP.summonerName.toLowerCase();
                const pScores = p.scores || {};
                return `
                  <tr style="border-bottom: 1px solid #1c2333; ${isMe ? 'background: rgba(0, 168, 232, 0.15);' : ''}">
                    <td style="padding: 8px 12px; font-weight: ${isMe ? '800' : '600'}; color: ${isMe ? 'var(--powder-cyan)' : '#fff'};">
                      ${p.summonerName || 'Summoner'} ${isMe ? '⭐' : ''}
                    </td>
                    <td style="padding: 8px 12px; text-align: center; font-weight: 700; color: var(--powder-gold);">
                      ${p.championName || 'Aphelios'}
                    </td>
                    <td style="padding: 8px 12px; text-align: center; font-weight: 700; color: #fff;">
                      ${pScores.kills || 0}/${pScores.deaths || 0}/${pScores.assists || 0}
                    </td>
                    <td style="padding: 8px 12px; text-align: center; color: var(--text-muted);">
                      ${pScores.creepScore || 0}
                    </td>
                    <td style="padding: 8px 12px; text-align: right;">
                      <span style="font-size: 10px; color: var(--text-muted);">
                        ${(p.items || []).map(i => i.displayName).join(', ') || 'Doran\'s Blade'}
                      </span>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- CHAOS (Red Team) -->
      <div>
        <div style="font-size: 11px; font-weight: 800; color: #e74c3c; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
          <span style="width: 8px; height: 8px; border-radius: 50%; background: #e74c3c;"></span>
          <span>Red Team (CHAOS)</span>
        </div>
        <div style="background: #141926; border: 1px solid #232a3b; border-radius: 8px; overflow: hidden;">
          <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
            <thead>
              <tr style="border-bottom: 1px solid #232a3b; color: var(--text-muted); font-size: 10px; text-transform: uppercase;">
                <th style="padding: 8px 12px; text-align: left;">Summoner</th>
                <th style="padding: 8px 12px; text-align: center;">Champion</th>
                <th style="padding: 8px 12px; text-align: center;">K / D / A</th>
                <th style="padding: 8px 12px; text-align: center;">CS</th>
              </tr>
            </thead>
            <tbody>
              ${(redTeam.length ? redTeam : []).map(p => {
                const pScores = p.scores || {};
                return `
                  <tr style="border-bottom: 1px solid #1c2333;">
                    <td style="padding: 8px 12px; font-weight: 600; color: #fff;">
                      ${p.summonerName || 'Opponent'}
                    </td>
                    <td style="padding: 8px 12px; text-align: center; font-weight: 700; color: #e74c3c;">
                      ${p.championName || 'Aatrox'}
                    </td>
                    <td style="padding: 8px 12px; text-align: center; font-weight: 700; color: #fff;">
                      ${pScores.kills || 0}/${pScores.deaths || 0}/${pScores.assists || 0}
                    </td>
                    <td style="padding: 8px 12px; text-align: center; color: var(--text-muted);">
                      ${pScores.creepScore || 0}
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  refreshLucideIcons();
}

// Setup Demo Mode Toggle Listener
document.addEventListener('DOMContentLoaded', () => {
  const toggleLiveDemoBtn = document.getElementById('toggle-live-demo-btn');
  toggleLiveDemoBtn?.addEventListener('click', () => {
    isLiveDemoActive = !isLiveDemoActive;
    ipcRenderer.send('toggle-demo-mode', isLiveDemoActive);
    const demoBtnText = document.getElementById('demo-btn-text');
    if (demoBtnText) {
      demoBtnText.innerText = isLiveDemoActive ? 'Stop Live Simulation' : 'Simulate Live Game';
    }
    if (toggleLiveDemoBtn) {
      toggleLiveDemoBtn.style.background = isLiveDemoActive ? 'rgba(230, 57, 70, 0.2)' : 'rgba(0, 168, 232, 0.15)';
      toggleLiveDemoBtn.style.borderColor = isLiveDemoActive ? '#e63946' : 'var(--powder-cyan)';
      toggleLiveDemoBtn.style.color = isLiveDemoActive ? '#e63946' : 'var(--powder-cyan)';
    }
  });
});

// OriBot Verification Modal & Account Management Logic
accountBtn?.addEventListener('click', async () => {
  const account = await ipcRenderer.invoke('get-user-account');
  if (account) {
    if (accGamename) accGamename.value = account.gameName || 'Lesbian princess';
    if (accTagline) accTagline.value = account.tagLine || 'UwU';
    if (accRegion) accRegion.value = account.region || 'EUW';
    const apikeyInput = document.getElementById('acc-apikey');
    if (apikeyInput) {
      apikeyInput.value = account.apiKey || '';
    }
  }
  updateDiscordRpcUI();
  if (oribotStep1) oribotStep1.style.display = 'block';
  if (oribotStep2) oribotStep2.style.display = 'none';
  if (accountModal) accountModal.style.display = 'flex';
});

closeModalBtn?.addEventListener('click', () => {
  if (accountModal) accountModal.style.display = 'none';
});

backStep1Btn?.addEventListener('click', () => {
  if (oribotStep1) oribotStep1.style.display = 'block';
  if (oribotStep2) oribotStep2.style.display = 'none';
});

// Step 1 -> Save Account & Generate OriBot Challenge Icon
genChallengeBtn?.addEventListener('click', async () => {
  const gameName = accGamename?.value.trim() || 'Lesbian princess';
  const tagLine = accTagline?.value.trim() || 'UwU';
  const region = accRegion?.value || 'EUW';
  const apiKey = document.getElementById('acc-apikey')?.value.trim() || '';

  await ipcRenderer.invoke('save-user-account', { gameName, tagLine, region, apiKey });
  currentChallenge = await ipcRenderer.invoke('generate-verification-challenge', { gameName, tagLine });

  if (currentChallenge && currentChallenge.requiredIcon) {
    if (challengeIconImg) challengeIconImg.src = currentChallenge.requiredIcon.url;
    if (challengeIconName) challengeIconName.innerText = `Icon: ${currentChallenge.requiredIcon.name} (#${currentChallenge.requiredIcon.id})`;
    if (verifyStatusMsg) verifyStatusMsg.style.display = 'none';
    if (oribotStep1) oribotStep1.style.display = 'none';
    if (oribotStep2) oribotStep2.style.display = 'block';
  }
});

// Step 2 -> Verify Icon in League Client
verifyIconBtn?.addEventListener('click', async () => {
  const gameName = accGamename?.value.trim() || 'Lesbian princess';
  const tagLine = accTagline?.value.trim() || 'UwU';
  const region = accRegion?.value || 'EUW';
  const apiKey = document.getElementById('acc-apikey')?.value.trim() || '';
  const requiredIconId = currentChallenge?.requiredIcon?.id || 23;

  if (verifyIconBtn) {
    verifyIconBtn.innerHTML = '<i data-lucide="loader-2" class="spin" style="width: 16px; height: 16px;"></i> <span>Verification pending...</span>';
    refreshLucideIcons();
  }

  const result = await ipcRenderer.invoke('verify-account-icon', {
    gameName,
    tagLine,
    requiredIconId,
    region,
    apiKey
  });

  if (verifyIconBtn) {
    verifyIconBtn.innerHTML = '<i data-lucide="key-round" style="width: 16px; height: 16px;"></i> <span>Verify Profile Icon</span>';
    refreshLucideIcons();
  }

  if (result.success) {
    if (verifyStatusMsg) {
      verifyStatusMsg.style.display = 'block';
      verifyStatusMsg.style.color = '#2ecc71';
      verifyStatusMsg.innerHTML = '<div style="display: flex; align-items: center; justify-content: center; gap: 6px;"><i data-lucide="check-circle-2" style="width: 16px; height: 16px;"></i> <span>Account verified successfully! Connecting...</span></div>';
      refreshLucideIcons();
    }

    setTimeout(() => {
      if (accountModal) accountModal.style.display = 'none';
      loadProfile({ gameName, tagLine, region });
    }, 1200);
  } else {
    if (verifyStatusMsg) {
      verifyStatusMsg.style.display = 'block';
      verifyStatusMsg.style.color = '#e63946';
      verifyStatusMsg.innerHTML = '<div style="display: flex; align-items: center; justify-content: center; gap: 6px;"><i data-lucide="alert-circle" style="width: 16px; height: 16px;"></i> <span>Icon not detected. Please equip the required profile icon in your LoL client and try again!</span></div>';
      refreshLucideIcons();
    }
  }
});

// Sidebar Navigation View Switcher
const sidebarItems = document.querySelectorAll('.sidebar-item');
const appViews = document.querySelectorAll('.app-view');

sidebarItems.forEach(item => {
  item?.addEventListener('click', () => {
    const targetViewId = item.getAttribute('data-view');
    switchView(targetViewId);
  });
});

function switchView(viewId) {
  const currentSidebarItems = document.querySelectorAll('.sidebar-item');
  const currentAppViews = document.querySelectorAll('.app-view');

  currentSidebarItems.forEach(i => {
    if (i.getAttribute('data-view') === viewId) {
      i.classList.add('active');
    } else {
      i.classList.remove('active');
    }
  });

  currentAppViews.forEach(view => {
    if (view.id === viewId) {
      view.classList.add('active');
      view.style.display = 'flex';
    } else {
      view.classList.remove('active');
      view.style.display = 'none';
    }
  });

  if (viewId === 'view-leaderboards') {
    const regSelect = document.getElementById('leaderboard-region-select-main') || document.getElementById('leaderboard-region-select');
    loadLeaderboards(regSelect ? regSelect.value : 'EUW');
  } else if (viewId === 'view-follows') {
    loadFollowedPlayers();
  } else if (viewId === 'view-ugg') {
    if (!window.uggBuildLoaded) {
      loadUggBuild('Jinx');
      loadUggTierList();
      window.uggBuildLoaded = true;
    }
  }

  refreshLucideIcons();
}

// Hero Search Box Handlers
const heroSearchInput = document.getElementById('hero-search-input');
const heroSearchRegion = document.getElementById('hero-search-region');
const heroSearchBtn = document.getElementById('hero-search-btn');

if (heroSearchBtn) {
  heroSearchBtn.addEventListener('click', () => {
    const query = heroSearchInput?.value.trim();
    const region = heroSearchRegion?.value || 'EUW';
    if (query) performSearch(query, region);
  });
}

if (heroSearchInput) {
  heroSearchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const query = heroSearchInput?.value.trim();
      const region = heroSearchRegion?.value || 'EUW';
      if (query) performSearch(query, region);
    }
  });
}

// Search Input Clear Cross (x) Buttons
function setupSearchClear(inputId, clearBtnId) {
  const inputEl = document.getElementById(inputId);
  const clearBtn = document.getElementById(clearBtnId);

  if (!inputEl || !clearBtn) return;

  const toggleClear = () => {
    if (inputEl.value.length > 0) {
      clearBtn.style.display = 'flex';
    } else {
      clearBtn.style.display = 'none';
    }
  };

  inputEl.addEventListener('input', toggleClear);
  inputEl.addEventListener('focus', toggleClear);

  clearBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    inputEl.value = '';
    clearBtn.style.display = 'none';
    inputEl.focus();
  });
}

setupSearchClear('search-input', 'search-clear-btn');
setupSearchClear('hero-search-input', 'hero-search-clear-btn');

// Quick Suggestion Tag Chips
document.querySelectorAll('.tag-chip').forEach(tag => {
  tag?.addEventListener('click', () => {
    const query = tag.getAttribute('data-search');
    performSearch(query, 'EUW');
  });
});

// Follow Button & List Elements
const toggleFollowBtn = document.getElementById('toggle-follow-btn');
const followBtnText = document.getElementById('follow-btn-text');
const followsListContainer = document.getElementById('follows-list-container');
const followsCountBadge = document.getElementById('follows-count-badge');

// Load Followed Players
async function loadFollowedPlayers() {
  try {
    followedPlayersList = await ipcRenderer.invoke('get-followed-players');
    renderFollowsList();
    updateFollowBtnState();
  } catch (err) {
    console.error('Failed to load followed players:', err);
  }
}

function renderFollowsList() {
  if (!followsListContainer) return;

  if (followsCountBadge) {
    followsCountBadge.innerText = `${followedPlayersList.length} Followed Player(s)`;
  }

  if (followedPlayersList.length === 0) {
    followsListContainer.innerHTML = `
      <div style="grid-column: span 2; text-align: center; padding: 40px; color: var(--text-muted);">
        <i data-lucide="user-x" style="width: 48px; height: 48px; margin-bottom: 12px; color: var(--text-muted);"></i>
        <h3>No followed summoners yet.</h3>
        <p style="font-size: 12px;">Search for a player and click "Follow" to track their live status here.</p>
      </div>
    `;
    refreshLucideIcons();
    return;
  }

  followsListContainer.innerHTML = followedPlayersList.map(p => `
    <div class="follow-card">
      <div class="follow-user-info">
        <img src="${p.icon || '../assets/logo.png'}" class="follow-avatar" alt="${p.gameName}">
        <div>
          <div class="follow-name">${p.gameName} <span class="tag-badge">#${p.tagLine}</span></div>
          <div class="follow-sub">${p.rank} • ${p.winrate} WR</div>
          <div class="follow-status-badge ${p.isLive ? 'live' : 'offline'}">
            <span style="width: 6px; height: 6px; border-radius: 50%; background: ${p.isLive ? '#2ecc71' : '#8d9bb0'};"></span>
            <span>${p.isLive ? `IN GAME - ${p.liveChamp} (${p.gameTime})` : `Offline - ${p.lastSeen || 'Idle'}`}</span>
          </div>
        </div>
      </div>
      <div style="display: flex; flex-direction: column; gap: 8px;">
        <button class="pill-button view-follow-prof-btn" data-name="${p.gameName}" data-tag="${p.tagLine}" data-region="${p.region}">
          <i data-lucide="eye" style="width: 12px; height: 12px;"></i>
          <span>Profile</span>
        </button>
        <button class="titlebar-btn unfollow-btn" data-name="${p.gameName}" data-tag="${p.tagLine}" style="width: 100%; border-color: #e63946; color: #e63946;" title="Unfollow">
          <i data-lucide="user-minus" style="width: 12px; height: 12px;"></i>
        </button>
      </div>
    </div>
  `).join('');

  document.querySelectorAll('.view-follow-prof-btn').forEach(btn => {
    btn?.addEventListener('click', () => {
      const name = btn.getAttribute('data-name');
      const tag = btn.getAttribute('data-tag');
      const region = btn.getAttribute('data-region') || 'EUW';
      performSearch(`${name}#${tag}`, region);
    });
  });

  document.querySelectorAll('.unfollow-btn').forEach(btn => {
    btn?.addEventListener('click', async () => {
      const name = btn.getAttribute('data-name');
      const tag = btn.getAttribute('data-tag');
      followedPlayersList = await ipcRenderer.invoke('toggle-follow-player', { gameName: name, tagLine: tag });
      renderFollowsList();
      updateFollowBtnState();
    });
  });

  refreshLucideIcons();
}

// Toggle Follow on Profile
if (toggleFollowBtn) {
  toggleFollowBtn.addEventListener('click', async () => {
    if (!currentProfile) return;
    const solo = currentProfile.rankedSolo || {};
    const isUnranked = !solo.tier || solo.tier.toUpperCase() === 'UNRANKED';
    const rankStr = isUnranked
      ? 'Unranked'
      : `${solo.tier} ${solo.rank || ''} (${solo.lp || 0} LP)`.trim().replace(/\s+/g, ' ');

    const playerToToggle = {
      gameName: currentProfile.gameName,
      tagLine: currentProfile.tagLine,
      region: searchRegion?.value || currentProfile.region || 'EUW',
      rank: rankStr,
      winrate: `${solo.winrate || 0}%`,
      isLive: false,
      liveChamp: '',
      gameTime: '',
      icon: currentProfile.profileIconUrl || 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/profile-icons/23.jpg'
    };

    followedPlayersList = await ipcRenderer.invoke('toggle-follow-player', playerToToggle);
    renderFollowsList();
    updateFollowBtnState();
  });
}

function updateFollowBtnState() {
  if (!currentProfile || !toggleFollowBtn || !followBtnText) return;
  const isFollowed = followedPlayersList.some(p => p.gameName.toLowerCase() === currentProfile.gameName.toLowerCase() && p.tagLine.toLowerCase() === currentProfile.tagLine.toLowerCase());

  if (isFollowed) {
    toggleFollowBtn.style.background = 'var(--powder-cyan)';
    toggleFollowBtn.style.color = '#000';
    followBtnText.innerText = 'Following ✅';
  } else {
    toggleFollowBtn.style.background = 'rgba(0, 168, 232, 0.15)';
    toggleFollowBtn.style.color = 'var(--powder-cyan)';
    followBtnText.innerText = 'Follow';
  }
}

// Search Summoner Bar
searchBtn?.addEventListener('click', () => performSearch());
searchInput?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') performSearch();
});

function performSearch(customQuery = null, customRegion = null) {
  const query = customQuery || searchInput?.value.trim();
  const region = customRegion || searchRegion?.value || 'EUW';
  if (!query) return;

  let gameName = query.trim();
  let tagLine = region || 'EUW';

  if (query.includes('#')) {
    const parts = query.split('#');
    gameName = parts[0].trim();
    tagLine = parts[1].trim();
  }

  switchView('view-profile');
  loadProfile({ gameName, tagLine, region });
}

updateStatsBtn?.addEventListener('click', () => {
  if (currentProfile) {
    loadProfile({
      gameName: currentProfile.gameName,
      tagLine: currentProfile.tagLine,
      region: searchRegion?.value || currentProfile.region || 'EUW',
      forceRefresh: true
    });
  }
});

function getRankEmblemUrl(tier) {
  if (!tier || tier.toUpperCase() === 'UNRANKED') {
    return 'https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-shared-components/global/default/unranked.png';
  }
  const t = tier.toLowerCase();
  return `https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-shared-components/global/default/${t}.png`;
}

function formatRankDisplay(tier, rank, lp) {
  if (!tier || tier.toUpperCase() === 'UNRANKED') return 'Unranked';
  const tUpper = tier.toUpperCase();
  const formattedTier = tier.charAt(0).toUpperCase() + tier.slice(1).toLowerCase();
  const numLp = Number(lp || 0).toLocaleString();

  if (tUpper === 'MASTER' || tUpper === 'GRANDMASTER' || tUpper === 'CHALLENGER') {
    return `${formattedTier} ${numLp} LP`;
  }
  
  let divStr = String(rank || '').trim().toUpperCase();
  if (divStr === '1' || divStr === 'I') divStr = 'I';
  else if (divStr === '2' || divStr === 'II') divStr = 'II';
  else if (divStr === '3' || divStr === 'III') divStr = 'III';
  else if (divStr === '4' || divStr === 'IV') divStr = 'IV';

  return `${formattedTier} ${divStr} ${numLp} LP`.trim().replace(/\s+/g, ' ');
}

function calculateLadderPercent(tier, rank, lp) {
  if (!tier || tier.toUpperCase() === 'UNRANKED') return { rankNum: 'N/A', topPct: 'top 100%' };
  const tUpper = tier.toUpperCase();
  const lpNum = Number(lp || 0);

  if (tUpper === 'CHALLENGER') return { rankNum: '42', topPct: 'top 0.009%' };
  if (tUpper === 'GRANDMASTER') return { rankNum: '420', topPct: 'top 0.02%' };
  if (tUpper === 'MASTER') {
    const approxRank = Math.max(1, Math.round(3500 - (lpNum * 1.8)));
    const pct = Math.max(0.01, (approxRank / 3500000) * 100).toFixed(4);
    return { rankNum: approxRank.toLocaleString(), topPct: `top ${pct}%` };
  }

  const tierMap = {
    'DIAMOND': { baseRank: 15000, basePct: 0.5 },
    'EMERALD': { baseRank: 60000, basePct: 3.5 },
    'PLATINUM': { baseRank: 250000, basePct: 12.0 },
    'GOLD': { baseRank: 800000, basePct: 32.0 },
    'SILVER': { baseRank: 1800000, basePct: 60.0 },
    'BRONZE': { baseRank: 2800000, basePct: 82.0 },
    'IRON': { baseRank: 3400000, basePct: 95.0 }
  };

  const info = tierMap[tUpper] || { baseRank: 500000, basePct: 20.0 };
  let rankDivMultiplier = 1;
  if (rank === 'I' || rank === '1') rankDivMultiplier = 0.25;
  else if (rank === 'II' || rank === '2') rankDivMultiplier = 0.50;
  else if (rank === 'III' || rank === '3') rankDivMultiplier = 0.75;
  else if (rank === 'IV' || rank === '4') rankDivMultiplier = 1.0;

  const estimatedRank = Math.round(info.baseRank * rankDivMultiplier);
  const estimatedPct = (info.basePct * rankDivMultiplier).toFixed(2);
  return { rankNum: estimatedRank.toLocaleString(), topPct: `top ${estimatedPct}%` };
}

// Load Profile Data
async function loadProfile(query = null) {
  try {
    if (updateStatsBtn) {
      updateStatsBtn.innerHTML = '<i data-lucide="loader-2" class="spin" style="width: 14px; height: 14px;"></i> <span>Loading...</span>';
      refreshLucideIcons();
    }

    const profile = await ipcRenderer.invoke('get-summoner-profile', query);
    
    if (updateStatsBtn) {
      updateStatsBtn.innerHTML = '<i data-lucide="rotate-cw" style="width: 14px; height: 14px;"></i> <span>Refresh</span>';
      refreshLucideIcons();
    }

    if (profile) {
      currentProfile = profile;
      renderProfileUI(profile);
    }
  } catch (err) {
    console.error('Failed to load summoner profile:', err);
    if (updateStatsBtn) {
      updateStatsBtn.innerHTML = '<i data-lucide="rotate-cw" style="width: 14px; height: 14px;"></i> <span>Refresh</span>';
      refreshLucideIcons();
    }
  }
}

function computeChampStatsFromMatches(matchesList, fallbackChamps = []) {
  if (fallbackChamps && fallbackChamps.length > 0) {
    return fallbackChamps
      .map(c => ({
        ...c,
        name: c.name || 'Champion',
        icon: c.icon || `https://ddragon.leagueoflegends.com/cdn/14.20.1/img/champion/${c.name}.png`,
        games: c.games || c.totalMatches || 1,
        totalMatches: c.games || c.totalMatches || 1,
        kda: c.kda || (c.deaths > 0 ? ((Number(c.kills || 0) + Number(c.assists || 0)) / Number(c.deaths)).toFixed(2) : '3.00'),
        winrate: typeof c.winrate === 'number' ? c.winrate : (parseInt(c.winrate, 10) || 0)
      }))
      .filter(c => c.games > 0)
      .sort((a, b) => b.games - a.games);
  }

  if (matchesList && matchesList.length > 0) {
    const map = {};
    matchesList.forEach(m => {
      const name = m.championName;
      if (!name) return;
      if (!map[name]) {
        map[name] = {
          name,
          icon: m.championIcon || `https://ddragon.leagueoflegends.com/cdn/14.20.1/img/champion/${name}.png`,
          games: 0,
          wins: 0,
          kills: 0,
          deaths: 0,
          assists: 0,
          cs: 0
        };
      }
      const c = map[name];
      c.games += 1;
      if (m.win) c.wins += 1;
      c.kills += Number(m.kills || 0);
      c.deaths += Number(m.deaths || 0);
      c.assists += Number(m.assists || 0);
      c.cs += Number(m.cs || 0);
    });

    const computed = Object.values(map).map(c => {
      const wr = Math.round((c.wins / c.games) * 100);
      const avgK = (c.kills / c.games).toFixed(1);
      const avgD = (c.deaths / c.games).toFixed(1);
      const avgA = (c.assists / c.games).toFixed(1);
      const kda = c.deaths > 0 ? ((c.kills + c.assists) / c.deaths).toFixed(2) : ((c.kills + c.assists) > 0 ? '3.50' : '2.00');
      const avgCs = Math.round(c.cs / c.games);
      return {
        ...c,
        totalMatches: c.games,
        winrate: wr,
        kills: avgK,
        deaths: avgD,
        assists: avgA,
        kda,
        cs: avgCs
      };
    }).sort((a, b) => b.games - a.games);

    if (computed.length > 0) return computed;
  }

  return [];
}

// Render Complete Profile UI
function renderProfileUI(profile) {
  const notFoundCard = document.getElementById('profile-not-found-card');
  const headerBanner = document.getElementById('profile-header-banner');
  const profileSubnav = document.querySelector('.profile-subnav');
  const gridLayout = document.querySelector('.ugg-grid-layout');

  if (profile && profile.notFound) {
    if (notFoundCard) {
      notFoundCard.style.display = 'flex';
      const queryText = document.getElementById('not-found-query-text');
      if (queryText) queryText.innerText = `${profile.gameName || ''} #${profile.tagLine || ''}`;
      const subTitle = document.getElementById('not-found-subtitle');
      if (subTitle) {
        subTitle.innerText = profile.errorMessage || `Powder wanted to help you, but the profile "${profile.gameName} #${profile.tagLine}" was not found!`;
      }
    }
    if (headerBanner) headerBanner.style.display = 'none';
    if (profileSubnav) profileSubnav.style.display = 'none';
    if (gridLayout) gridLayout.style.display = 'none';
    refreshLucideIcons();
    return;
  }

  if (notFoundCard) notFoundCard.style.display = 'none';
  if (headerBanner) headerBanner.style.display = 'flex';
  if (profileSubnav) profileSubnav.style.display = 'flex';
  if (gridLayout) gridLayout.style.display = 'grid';

  if (profName) profName.innerText = profile.gameName || 'Summoner';
  if (profTag) profTag.innerText = `#${profile.tagLine || ''}`;
  const levelVal = profile.level || profile.summonerLevel || 1;
  if (profLevel) profLevel.innerText = levelVal;

  const solo = profile.rankedSolo || {};
  const flex = profile.rankedFlex || {};

  const isSoloUnranked = !solo.tier || solo.tier.toUpperCase() === 'UNRANKED';
  const ladderInfo = isSoloUnranked
    ? { rankNum: 'N/A', topPct: 'top 100%' }
    : calculateLadderPercent(solo.tier, solo.rank || '', solo.lp || 0);

  if (profLadder) profLadder.innerHTML = `Ladder Rank <strong>#${ladderInfo.rankNum}</strong> (${ladderInfo.topPct})`;

  const followersCountText = document.getElementById('followers-count-text');
  if (followersCountText) {
    const fCount = profile.followersCount || (isSoloUnranked ? 0 : 38);
    followersCountText.innerText = `${fCount} Followers`;
  }

  if (profAvatar) {
    const iconId = profile.profileIconId || 5410;
    const targetUrl = profile.profileIconUrl || `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/profile-icons/${iconId}.jpg`;
    profAvatar.src = targetUrl;
    profAvatar.onerror = () => {
      if (!profAvatar.src.includes('communitydragon')) {
        profAvatar.src = `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/profile-icons/${iconId}.jpg`;
      } else {
        profAvatar.src = `https://ddragon.leagueoflegends.com/cdn/14.20.1/img/profileicon/23.png`;
      }
    };
  }

  const soloFormatted = isSoloUnranked ? 'Unranked' : formatRankDisplay(solo.tier, solo.rank || '', solo.lp || 0);
  if (soloTierName) soloTierName.innerText = soloFormatted;
  if (soloLp) soloLp.innerText = isSoloUnranked ? `${solo.wins || 0}W ${solo.losses || 0}L` : `${solo.wins || 0}W ${solo.losses || 0}L`;
  if (soloWrText) soloWrText.innerText = `${solo.winrate || 0}% Win Rate`;

  const soloTierImg = document.getElementById('solo-tier-img');
  if (soloTierImg) {
    soloTierImg.src = getRankEmblemUrl(solo.tier || 'Unranked');
    soloTierImg.onerror = () => { soloTierImg.src = 'https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-shared-components/global/default/unranked.png'; };
  }

  const isFlexUnranked = !flex.tier || flex.tier.toUpperCase() === 'UNRANKED';
  const flexFormatted = isFlexUnranked ? 'Unranked' : formatRankDisplay(flex.tier, flex.rank || '', flex.lp || 0);
  if (flexTierName) flexTierName.innerText = flexFormatted;
  if (flexLp) flexLp.innerText = isFlexUnranked ? `${flex.wins || 0}W ${flex.losses || 0}L` : `${flex.wins || 0}W ${flex.losses || 0}L`;
  if (flexWrText) flexWrText.innerText = `${flex.winrate || 0}% Win Rate`;

  const flexTierImg = document.getElementById('flex-tier-img');
  if (flexTierImg) {
    flexTierImg.src = getRankEmblemUrl(flex.tier || 'Unranked');
    flexTierImg.onerror = () => { flexTierImg.src = 'https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-shared-components/global/default/unranked.png'; };
  }

  const matches = profile.matches || [];
  
  // Filter matches for Overview & Champion Stats: All Ranked + Normal Draft + Swiftplay / Quickplay
  const overviewMatches = matches.filter(m => {
    const modeStr = String(m.mode || '').toLowerCase();
    const qId = m.queueId;
    return modeStr.includes('ranked') ||
           modeStr.includes('draft') ||
           modeStr.includes('swift') ||
           modeStr.includes('quick') ||
           [420, 440, 400, 490, 480].includes(qId);
  });
  const useOverviewMatches = overviewMatches.length > 0 ? overviewMatches : matches;

  const validChamps = computeChampStatsFromMatches(useOverviewMatches, profile.topChampions || []);

  // Filter strictly Solo Q Ranked matches for SOLO Q tab
  const soloqMatches = matches.filter(m => m.queueId === 420 || (m.mode && m.mode.toLowerCase().includes('ranked solo')));
  const displaySoloq = soloqMatches.length > 0 ? soloqMatches : matches.filter(m => m.mode && m.mode.toLowerCase().includes('ranked'));
  const soloqChamps = computeChampStatsFromMatches(displaySoloq, []);

  const top5Champs = validChamps.slice(0, 5);

  if (topChampsList) {
    if (top5Champs.length > 0) {
      topChampsList.innerHTML = top5Champs.map(c => `
        <div class="champ-stat-row">
          <div class="champ-info">
            <img src="${c.icon}" class="champ-icon-sm" alt="${c.name}" onerror="this.src='../assets/logo.png'">
            <div>
              <div class="champ-name">${c.name}</div>
              <div class="champ-kda">${c.kda} KDA (${c.kills}/${c.deaths}/${c.assists})</div>
            </div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 11px; font-weight: 800; color: ${c.winrate >= 50 ? '#2ecc71' : '#e63946'};">${c.winrate}%</div>
            <div style="font-size: 9px; color: var(--text-muted);">${c.games} game${c.games > 1 ? 's' : ''}</div>
          </div>
        </div>
      `).join('');
    } else {
      topChampsList.innerHTML = `<div style="text-align: center; padding: 16px; color: var(--text-muted); font-size: 12px;">No champions played recently.</div>`;
    }
  }

  if (champsDetailTable) {
    if (validChamps.length > 0) {
      champsDetailTable.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 8px;">
          ${validChamps.map(c => `
            <div class="champ-stat-row" style="padding: 12px 16px; background: #141926; border-radius: 8px; border: 1px solid #232a3b;">
              <div class="champ-info">
                <img src="${c.icon}" class="champ-icon-sm" style="width: 36px; height: 36px;" alt="${c.name}" onerror="this.src='../assets/logo.png'">
                <div>
                  <div class="champ-name" style="font-size: 13px;">${c.name}</div>
                  <div class="champ-kda" style="font-size: 11px;">${c.kda} KDA (${c.kills} / ${c.deaths} / ${c.assists})</div>
                </div>
              </div>
              <div style="text-align: right;">
                <div style="font-size: 14px; font-weight: 800; color: ${c.winrate >= 50 ? '#2ecc71' : '#e63946'};">${c.winrate}% WR</div>
                <div style="font-size: 11px; color: var(--powder-cyan); font-weight: 700;">${c.games} game${c.games > 1 ? 's' : ''} played</div>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    } else {
      champsDetailTable.innerHTML = `<div style="text-align: center; padding: 24px; color: var(--text-muted);">No detailed champion statistics available.</div>`;
    }
  }

  renderRank100Chart(profile);

  const summaryWr = document.getElementById('summary-wr');
  const summaryKda = document.getElementById('summary-kda');

  if (matches.length > 0) {
    if (matchCardsContainer) {
      matchCardsContainer.innerHTML = matches.map(m => renderMatchCardHTML(m)).join('');
    }
    const wins = matches.filter(m => m.win).length;
    const wr = Math.round((wins / matches.length) * 100);
    let totalK = 0, totalD = 0, totalA = 0;
    matches.forEach(m => { totalK += (m.kills || 0); totalD += (m.deaths || 0); totalA += (m.assists || 0); });
    const kda = ((totalK + totalA) / Math.max(1, totalD)).toFixed(2);

    if (summaryWr) summaryWr.innerText = `${wr}% WR (Last ${matches.length} games)`;
    if (summaryKda) summaryKda.innerText = `${kda} KDA`;
  } else {
    if (matchCardsContainer) matchCardsContainer.innerHTML = `<div style="text-align: center; padding: 40px; color: var(--text-muted);">No match history found.</div>`;
    if (summaryWr) summaryWr.innerText = `0% WR`;
    if (summaryKda) summaryKda.innerText = `0.00 KDA`;
  }

  // Populate SOLO Q RANKED Tab
  const soloqContainer = document.getElementById('soloq-match-cards-container');
  const soloqSummaryWr = document.getElementById('soloq-summary-wr');
  const soloqSummaryKda = document.getElementById('soloq-summary-kda');
  const soloqChampsList = document.getElementById('soloq-champs-list');

  if (soloqChampsList) {
    if (soloqChamps.length > 0) {
      soloqChampsList.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 8px;">
          ${soloqChamps.map(c => `
            <div class="champ-stat-row" style="padding: 10px 14px; background: #141926; border-radius: 8px; border: 1px solid #232a3b;">
              <div class="champ-info">
                <img src="${c.icon}" class="champ-icon-sm" style="width: 34px; height: 34px; border-radius: 50%; border: 1px solid var(--powder-gold);" alt="${c.name}" onerror="this.src='../assets/logo.png'">
                <div>
                  <div class="champ-name" style="font-size: 13px; color: #fff;">${c.name}</div>
                  <div class="champ-kda" style="font-size: 11px;">${c.kda} KDA (${c.kills} / ${c.deaths} / ${c.assists})</div>
                </div>
              </div>
              <div style="text-align: right;">
                <div style="font-size: 13px; font-weight: 800; color: ${c.winrate >= 50 ? '#2ecc71' : '#e63946'};">${c.winrate}% WR</div>
                <div style="font-size: 10px; color: var(--powder-gold); font-weight: 700;">${c.games} Solo Q game${c.games > 1 ? 's' : ''}</div>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    } else {
      soloqChampsList.innerHTML = `<div style="text-align: center; padding: 16px; color: var(--text-muted); font-size: 12px;">No Ranked Solo / Duo champion stats available.</div>`;
    }
  }

  if (soloqContainer) {
    if (displaySoloq.length > 0) {
      soloqContainer.innerHTML = displaySoloq.map(m => renderMatchCardHTML(m)).join('');
      const wins = displaySoloq.filter(m => m.win).length;
      const wr = Math.round((wins / displaySoloq.length) * 100);
      let totalK = 0, totalD = 0, totalA = 0;
      displaySoloq.forEach(m => { totalK += (m.kills || 0); totalD += (m.deaths || 0); totalA += (m.assists || 0); });
      const kda = ((totalK + totalA) / Math.max(1, totalD)).toFixed(2);
      if (soloqSummaryWr) soloqSummaryWr.innerText = `${wr}% WR (${displaySoloq.length} games)`;
      if (soloqSummaryKda) soloqSummaryKda.innerText = `${kda} KDA`;
    } else {
      soloqContainer.innerHTML = `<div style="text-align: center; padding: 40px; color: var(--text-muted);">No Ranked Solo / Duo matches found recently.</div>`;
      if (soloqSummaryWr) soloqSummaryWr.innerText = `0% WR`;
      if (soloqSummaryKda) soloqSummaryKda.innerText = `0.00 KDA`;
    }
  }

  if (tierlistContainer) {
    if (validChamps.length > 0) {
      tierlistContainer.innerHTML = validChamps.map((c, idx) => {
        const tierLabel = idx === 0 ? 'S+' : idx === 1 ? 'S' : idx === 2 ? 'A+' : idx < 5 ? 'A' : 'B+';
        const tierColor = idx === 0 ? '#ff4757' : idx === 1 ? 'var(--powder-gold)' : idx === 2 ? 'var(--powder-cyan)' : '#70a1ff';
        const tierBg = idx === 0 ? 'rgba(255, 71, 87, 0.2)' : idx === 1 ? 'rgba(229, 169, 60, 0.2)' : idx === 2 ? 'rgba(0, 168, 232, 0.2)' : 'rgba(112, 161, 255, 0.2)';

        const kills = c.kills !== undefined ? c.kills : '0.0';
        const deaths = c.deaths !== undefined ? c.deaths : '0.0';
        const assists = c.assists !== undefined ? c.assists : '0.0';
        const csVal = c.cs ? `${c.cs} CS avg` : '';
        const dmgVal = c.damage ? `${Number(c.damage).toLocaleString()} Dmg` : '';

        return `
          <div style="background: #141926; border: 1px solid #232a3b; border-radius: 10px; padding: 16px; position: relative; transition: transform 0.2s, border-color 0.2s;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
              <span style="font-size: 10px; font-weight: 800; padding: 3px 8px; border-radius: 12px; background: ${tierBg}; color: ${tierColor}; border: 1px solid ${tierColor};">
                ${tierLabel} Tier
              </span>
              <span style="font-size: 11px; font-weight: 700; color: var(--text-muted);">
                Rank #${idx + 1}
              </span>
            </div>

            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
              <img src="${c.icon}" style="width: 54px; height: 54px; border-radius: 50%; border: 2px solid ${tierColor}; object-fit: cover;" alt="${c.name}" onerror="this.src='../assets/logo.png'">
              <div>
                <div style="font-weight: 800; font-size: 15px; color: #fff;">${c.name}</div>
                <div style="font-size: 12px; font-weight: 700; color: ${c.winrate >= 50 ? '#2ecc71' : '#e63946'}; margin-top: 2px;">
                  ${c.winrate}% WR <span style="font-size: 10px; color: var(--text-muted); font-weight: 400;">(${c.games} game${c.games > 1 ? 's' : ''})</span>
                </div>
              </div>
            </div>

            <div style="background: #0f131d; border-radius: 6px; padding: 10px; font-size: 11px; display: flex; flex-direction: column; gap: 6px;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="color: var(--text-muted);">KDA Ratio</span>
                <strong style="color: var(--powder-cyan); font-weight: 800;">${c.kda} KDA</strong>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center; font-size: 10px;">
                <span style="color: var(--text-muted);">Avg K / D / A</span>
                <span style="color: #fff; font-weight: 700;">${kills} / ${deaths} / ${assists}</span>
              </div>
              ${(csVal || dmgVal) ? `
                <div style="display: flex; justify-content: space-between; align-items: center; font-size: 10px; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 4px; margin-top: 2px;">
                  <span style="color: var(--text-muted);">${csVal}</span>
                  <span style="color: var(--powder-gold); font-weight: 700;">${dmgVal}</span>
                </div>
              ` : ''}
            </div>
          </div>
        `;
      }).join('');
    } else {
      tierlistContainer.innerHTML = `<div style="grid-column: span 3; text-align: center; padding: 40px; color: var(--text-muted);">Aucune statistique de champion trouvée.</div>`;
    }
  }

  renderLpChart();
  updateFollowBtnState();
  renderLiveGameUI();

  refreshLucideIcons();
}

function renderMatchCardHTML(m) {
  const itemEntries = [...(m.items || [])];
  while (itemEntries.length < 7) {
    itemEntries.push(null);
  }

  // Swap item #4 (index 3) with item #7 (index 6)
  const tempItem = itemEntries[3];
  itemEntries[3] = itemEntries[6];
  itemEntries[6] = tempItem;

  const itemsHTML = itemEntries.map(item => {
    if (!item) return `<div class="item-slot empty-slot"></div>`;

    let itemId = null;
    let primaryUrl = '';

    if (typeof item === 'object' && item !== null) {
      itemId = item.id;
      primaryUrl = item.url;
    } else if (typeof item === 'string') {
      primaryUrl = item;
      const match = item.match(/\/(\d+)\.png/);
      if (match) itemId = match[1];
    }

    if (!itemId || itemId === 0 || itemId === '0') {
      return `<div class="item-slot empty-slot"></div>`;
    }

    const fallbackCdragonUrl = `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/items/${itemId}.png`;
    const finalPrimaryUrl = primaryUrl || fallbackCdragonUrl;

    return `<img src="${finalPrimaryUrl}" class="item-slot" alt="item ${itemId}"
              onerror="if (this.src !== '${fallbackCdragonUrl}') { this.src='${fallbackCdragonUrl}'; } else { this.outerHTML='<div class=\\'item-slot empty-slot\\'></div>'; }">`;
  }).join('');

  const lpBadgeHTML = m.lpChange ? `<span class="match-lp ${m.win ? 'win' : 'loss'}">${m.lpChange}</span>` : '';

  return `
    <div class="match-card ${m.win ? 'win' : 'loss'}">
      <div class="match-meta">
        <span class="match-mode">${m.mode}</span>
        <span class="match-time">${m.timeAgo}</span>
        ${lpBadgeHTML}
      </div>

      <div class="match-champ-box">
        <img src="${m.championIcon}" class="match-champ-img" alt="${m.championName}" onerror="this.src='../assets/logo.png'">
        <div>
          <div style="font-weight: 800; font-size: 13px; color: var(--text-main);">${m.championName}</div>
          <div style="font-size: 10px; color: var(--text-muted);">Niveau ${m.champLevel || 18}</div>
        </div>
      </div>

      <div class="match-kda-box">
        <span class="kda-score">${m.kills} / ${m.deaths} / ${m.assists}</span>
        <span class="kda-ratio">${m.kdaRatio} KDA • ${m.cs} CS (${m.csPerMin}/m)</span>
      </div>

      <div class="items-grid">
        ${itemsHTML}
      </div>
    </div>
  `;
}

let rank100ChartInstance = null;

function valToRankLabel(val) {
  if (val >= 18) {
    const masterLp = Math.max(0, Math.round((val - 18) * 100));
    return `Master ${masterLp.toLocaleString()} LP`;
  }

  const tiers = [
    { name: 'Silver', base: 0 },
    { name: 'Gold', base: 2 },
    { name: 'Platinum', base: 6 },
    { name: 'Emerald', base: 10 },
    { name: 'Diamond', base: 14 }
  ];

  let currentTier = 'Silver';
  let relativeVal = val;

  for (let i = tiers.length - 1; i >= 0; i--) {
    if (val >= tiers[i].base) {
      currentTier = tiers[i].name;
      relativeVal = val - tiers[i].base;
      break;
    }
  }

  const divNum = 4 - Math.floor(relativeVal);
  const clampedDiv = Math.max(1, Math.min(4, divNum));
  const lp = Math.round((relativeVal % 1) * 100);

  return `${currentTier} ${clampedDiv} (${lp} LP)`;
}

function calculateRealRankPoints(profile) {
  const solo = profile?.rankedSolo;
  if (!solo || !solo.tier || solo.tier.toUpperCase() === 'UNRANKED') {
    return null;
  }

  const tierBase = {
    'IRON': 0, 'BRONZE': 0, 'SILVER': 0, 'GOLD': 2, 'PLATINUM': 6,
    'EMERALD': 10, 'DIAMOND': 14, 'MASTER': 18,
    'GRANDMASTER': 18, 'CHALLENGER': 18
  };

  const tierUpper = solo.tier.toUpperCase();
  let baseIndex = 0;
  for (const t in tierBase) {
    if (tierUpper.includes(t)) {
      baseIndex = tierBase[t];
      break;
    }
  }

  const rankStr = (solo.rank || '').toUpperCase();
  let rankOffset = 0;
  if (rankStr === 'III' || rankStr === '3') rankOffset = 1;
  else if (rankStr === 'II' || rankStr === '2') rankOffset = 2;
  else if (rankStr === 'I' || rankStr === '1') rankOffset = 3;

  const lp = solo.lp || 0;
  let currentVal = baseIndex + rankOffset;
  if (tierUpper.includes('MASTER') || tierUpper.includes('GRANDMASTER') || tierUpper.includes('CHALLENGER')) {
    currentVal = 18 + (lp / 100);
  } else {
    currentVal = baseIndex + rankOffset + (lp / 100);
  }

  const matches = (profile.matches || []).filter(m => m.mode && m.mode.toLowerCase().includes('ranked'));
  const useMatches = matches.length > 0 ? matches : (profile.matches || []);

  const chronoMatches = [...useMatches].reverse();
  if (chronoMatches.length === 0) {
    return null;
  }

  let startVal = currentVal;
  for (const m of useMatches) {
    const lpDelta = m.win ? 0.25 : -0.22;
    startVal -= lpDelta;
  }

  const points = [Number(Math.max(0, startVal).toFixed(2))];
  let val = Math.max(0, startVal);

  for (const m of chronoMatches) {
    const lpDelta = m.win ? 0.25 : -0.22;
    val = Math.max(0, val + lpDelta);
    points.push(Number(val.toFixed(2)));
  }

  if (points.length > 0) {
    points[points.length - 1] = Number(currentVal.toFixed(2));
  }

  return { points, currentVal, count: chronoMatches.length };
}

function renderRank100Chart(profile) {
  const cardContainer = document.getElementById('rank-progression-card');
  const canvas = document.getElementById('rank100Chart');
  
  const realData = calculateRealRankPoints(profile);
  
  if (!realData || !canvas || typeof Chart === 'undefined') {
    if (cardContainer) cardContainer.style.display = 'none';
    return;
  }

  if (cardContainer) cardContainer.style.display = 'block';

  const ctx = canvas.getContext('2d');
  if (rank100ChartInstance) rank100ChartInstance.destroy();

  const dataPoints = realData.points;
  const count = realData.count;
  const labels = Array.from({ length: dataPoints.length }, (_, i) => i === 0 ? `${count} games ago` : i === dataPoints.length - 1 ? 'Last game' : '');

  const minVal = Math.min(...dataPoints);
  const maxVal = Math.max(...dataPoints);
  const yMin = Math.max(0, Math.floor(minVal - 1));
  const yMax = Math.ceil(maxVal + 1);

  rank100ChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        data: dataPoints,
        borderWidth: 2,
        tension: 0.25,
        pointRadius: 0,
        pointHoverRadius: 5,
        fill: true,
        backgroundColor: (context) => {
          const chart = context.chart;
          const { ctx, chartArea } = chart;
          if (!chartArea) return null;
          const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          gradient.addColorStop(0, 'rgba(0, 168, 232, 0.25)');
          gradient.addColorStop(0.5, 'rgba(168, 85, 247, 0.15)');
          gradient.addColorStop(1, 'rgba(148, 163, 184, 0.02)');
          return gradient;
        },
        segment: {
          borderColor: ctxSegment => {
            const y = ctxSegment.p1.parsed.y;
            if (y >= 18) return '#f43f5e';
            if (y >= 14) return '#a855f7';
            if (y >= 10) return '#2ecc71';
            if (y >= 6) return '#00a8e8';
            if (y >= 2) return '#e5a93c';
            return '#94a3b8';
          }
        }
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context) => {
              const val = context.parsed.y;
              return `Rank: ${valToRankLabel(val)}`;
            }
          }
        }
      },
      scales: {
        x: { display: false },
        y: {
          min: yMin,
          max: yMax,
          grid: {
            color: 'rgba(255, 255, 255, 0.08)',
            borderDash: [3, 3]
          },
          ticks: {
            font: { size: 9, weight: '700' },
            callback: function(value) {
              return valToRankLabel(value);
            },
            color: function(ctxTick) {
              const val = ctxTick.tick.value;
              if (val >= 18) return '#f43f5e';
              if (val >= 14) return '#a855f7';
              if (val >= 10) return '#2ecc71';
              if (val >= 6) return '#00a8e8';
              if (val >= 2) return '#e5a93c';
              return '#94a3b8';
            }
          }
        }
      }
    }
  });
}

function renderLpChart() {
  const chartCanvas = document.getElementById('lpChart');
  if (!chartCanvas || typeof Chart === 'undefined') return;

  const ctx = chartCanvas.getContext('2d');
  const labels = ['28/09', '29/09', '30/09', '01/10', '02/10', '03/10', '04/10'];
  const dataLp = [1420, 1445, 1430, 1480, 1495, 1475, 1508];

  if (lpChart) lpChart.destroy();

  lpChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'LP enregistrés',
        data: dataLp,
        borderColor: '#00a8e8',
        borderWidth: 3,
        backgroundColor: 'rgba(0, 168, 232, 0.15)',
        fill: true,
        tension: 0.3,
        pointBackgroundColor: '#e63946',
        pointRadius: 5
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#8d9bb0' } },
        y: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#8d9bb0' } }
      }
    }
  });
}

async function loadLeaderboards(region = 'EUW') {
  const targets = Array.from(document.querySelectorAll('#leaderboard-table-body, #leaderboard-table-body-main'));
  if (targets.length === 0) return;

  const loadingHTML = `
    <tr>
      <td colspan="6" style="text-align: center; padding: 40px; color: var(--powder-cyan);">
        <i data-lucide="loader-2" class="spin" style="width: 24px; height: 24px; margin-bottom: 8px;"></i>
        <div style="font-weight: 800; font-size: 13px;">Chargement du classement Challenger ${region} en direct...</div>
      </td>
    </tr>
  `;

  targets.forEach(t => t.innerHTML = loadingHTML);
  refreshLucideIcons();

  try {
    const entries = await ipcRenderer.invoke('get-leaderboard', region);
    if (!entries || entries.length === 0) {
      const emptyHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 24px; color: var(--text-muted);">No leaderboard entries found for ${region}.</td>
        </tr>
      `;
      targets.forEach(t => t.innerHTML = emptyHTML);
      return;
    }

    const rowsHTML = entries.map(e => {
      const isTop1 = e.rank === 1;
      const isTop2 = e.rank === 2;
      const isTop3 = e.rank === 3;
      const badgeBg = isTop1 ? 'rgba(255, 71, 87, 0.25)' : isTop2 ? 'rgba(229, 169, 60, 0.25)' : isTop3 ? 'rgba(0, 168, 232, 0.25)' : 'rgba(255, 255, 255, 0.05)';
      const badgeColor = isTop1 ? '#ff4757' : isTop2 ? 'var(--powder-gold)' : isTop3 ? 'var(--powder-cyan)' : '#8d9bb0';
      const crownIcon = isTop1 ? '👑 ' : isTop2 ? '🥈 ' : isTop3 ? '🥉 ' : '';

      const iconUrl = e.profileIconUrl || '../assets/logo.png';

      return `
        <tr class="leaderboard-row" data-name="${e.summonerName}" data-region="${region}" style="border-bottom: 1px solid rgba(255,255,255,0.04); cursor: pointer; transition: background 0.2s;">
          <td style="padding: 10px 16px;">
            <span style="font-size: 11px; font-weight: 900; padding: 4px 10px; border-radius: 12px; background: ${badgeBg}; color: ${badgeColor}; border: 1px solid ${badgeColor}; display: inline-block;">
              ${crownIcon}#${e.rank}
            </span>
          </td>
          <td style="padding: 10px 16px;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <img src="${iconUrl}" style="width: 30px; height: 30px; border-radius: 50%; border: 1px solid ${badgeColor}; object-fit: cover;" onerror="this.src='../assets/logo.png'">
              <span style="font-weight: 800; color: #fff; font-size: 13px;">${e.summonerName}</span>
            </div>
          </td>
          <td style="padding: 10px 16px;">
            <span style="font-size: 10px; font-weight: 800; background: rgba(229,169,60,0.2); color: var(--powder-gold); border: 1px solid var(--powder-gold); padding: 3px 8px; border-radius: 6px;">
              ${e.tier}
            </span>
          </td>
          <td style="padding: 10px 16px; font-weight: 800; color: var(--powder-cyan);">${Number(e.lp).toLocaleString()} LP</td>
          <td style="padding: 10px 16px; color: ${e.winrate >= 50 ? '#2ecc71' : '#e63946'}; font-weight: 800;">${e.winrate}% WR</td>
          <td style="padding: 10px 16px; text-align: right; font-size: 11px; color: var(--text-muted); font-weight: 700;">${e.wins}W ${e.losses}L</td>
        </tr>
      `;
    }).join('');

    targets.forEach(t => t.innerHTML = rowsHTML);

    document.querySelectorAll('.leaderboard-row').forEach(row => {
      row.addEventListener('click', () => {
        const name = row.getAttribute('data-name');
        const reg = row.getAttribute('data-region');
        performSearch(name, reg);
      });
    });

    refreshLucideIcons();
  } catch (err) {
    console.error('Failed to load leaderboard:', err);
    const errorHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 20px; color: #e63946;">Failed to load leaderboard data.</td>
      </tr>
    `;
    targets.forEach(t => t.innerHTML = errorHTML);
  }
}

let matchOffset = 5;

document.addEventListener('DOMContentLoaded', () => {
  refreshLucideIcons();
  loadFollowedPlayers();

  const rankProgressionCard = document.getElementById('rank-progression-card');
  const rankAccordionToggle = document.getElementById('rank-accordion-toggle');
  const rankAccordionBody = document.getElementById('rank-accordion-body');
  const rankAccordionIcon = document.getElementById('rank-accordion-icon');

  if (rankAccordionToggle && rankAccordionBody) {
    rankAccordionToggle.addEventListener('click', () => {
      const isOpen = rankAccordionBody.classList.toggle('open');
      if (rankProgressionCard) rankProgressionCard.classList.toggle('open', isOpen);
      if (rankAccordionToggle) rankAccordionToggle.classList.toggle('open', isOpen);
      const icon = document.getElementById('rank-accordion-icon') || rankAccordionIcon;
      if (icon) icon.classList.toggle('open', isOpen);

      if (isOpen && typeof rank100ChartInstance !== 'undefined' && rank100ChartInstance) {
        setTimeout(() => {
          try { rank100ChartInstance.resize(); } catch(e){}
        }, 150);
      }
    });
  }

  const notFoundHomeBtn = document.getElementById('not-found-back-home-btn');
  if (notFoundHomeBtn) {
    notFoundHomeBtn.addEventListener('click', () => switchView('view-home'));
  }

  ['leaderboard-region-select', 'leaderboard-region-select-main'].forEach(id => {
    const sel = document.getElementById(id);
    sel?.addEventListener('change', () => {
      const otherId = id === 'leaderboard-region-select' ? 'leaderboard-region-select-main' : 'leaderboard-region-select';
      const other = document.getElementById(otherId);
      if (other) other.value = sel.value;
      loadLeaderboards(sel.value);
    });
  });

  ['refresh-leaderboard-btn', 'refresh-leaderboard-btn-main'].forEach(id => {
    const btn = document.getElementById(id);
    btn?.addEventListener('click', () => {
      const regSelect = document.getElementById('leaderboard-region-select') || document.getElementById('leaderboard-region-select-main');
      const reg = regSelect ? regSelect.value : 'EUW';
      loadLeaderboards(reg);
    });
  });

  const loadMoreBtn = document.getElementById('load-more-matches-btn');
  if (loadMoreBtn) {
    loadMoreBtn.addEventListener('click', async () => {
      if (!currentProfile || !currentProfile.puuid) return;
      loadMoreBtn.innerHTML = '<i data-lucide="loader-2" class="spin" style="width: 14px; height: 14px;"></i> <span>Loading older matches...</span>';
      refreshLucideIcons();

      try {
        const moreMatches = await ipcRenderer.invoke('get-more-matches', {
          puuid: currentProfile.puuid,
          continentalHost: currentProfile.continentalHost || 'europe.api.riotgames.com',
          start: matchOffset,
          count: 5
        });

        loadMoreBtn.innerHTML = '<i data-lucide="chevron-down" style="width: 14px; height: 14px;"></i> <span>Show Older Matches</span>';
        refreshLucideIcons();

        if (moreMatches && moreMatches.length > 0) {
          matchOffset += moreMatches.length;
          if (!currentProfile.matches) currentProfile.matches = [];
          currentProfile.matches.push(...moreMatches);

          const container = document.getElementById('match-cards-container');
          if (container) {
            const newHTML = moreMatches.map(m => renderMatchCardHTML(m)).join('');
            container.insertAdjacentHTML('beforeend', newHTML);
          }
        } else {
          loadMoreBtn.style.display = 'none';
        }
      } catch (e) {
        console.error('Failed to fetch more matches:', e);
        loadMoreBtn.innerHTML = '<i data-lucide="chevron-down" style="width: 14px; height: 14px;"></i> <span>Show Older Matches</span>';
        refreshLucideIcons();
      }
    });
  }

  // Profile Subnav Tab Navigation Switcher (Overview, SOLO Q RANKED, Champion Stats, PLUS Tier List)
  const profileTabItems = document.querySelectorAll('.profile-subnav [data-tab]');
  const profileTabPanes = document.querySelectorAll('.right-col .tab-pane');

  profileTabItems.forEach(tab => {
    tab?.addEventListener('click', () => {
      const targetId = tab.getAttribute('data-tab');
      profileTabItems.forEach(t => t.classList.remove('active'));
      profileTabPanes.forEach(p => {
        p.classList.remove('active');
        p.style.display = 'none';
      });

      tab.classList.add('active');
      const targetPane = document.getElementById(targetId);
      if (targetPane) {
        targetPane.classList.add('active');
        targetPane.style.display = 'block';
      }
    });
  });

  // Powder Meta Tab Navigation Switcher
  const uggTabItems = document.querySelectorAll('[data-ugg-tab]');
  const uggTabPanes = document.querySelectorAll('.ugg-tab-pane');

  uggTabItems.forEach(tab => {
    tab?.addEventListener('click', () => {
      const targetId = tab.getAttribute('data-ugg-tab');
      uggTabItems.forEach(t => t.classList.remove('active'));
      uggTabPanes.forEach(p => {
        p.classList.remove('active');
        p.style.display = 'none';
      });

      tab.classList.add('active');
      const targetPane = document.getElementById(targetId);
      if (targetPane) {
        targetPane.classList.add('active');
        targetPane.style.display = 'block';
      }
    });
  });

  // Powder Champion Search & Matchup Handlers
  const uggChampBtn = document.getElementById('ugg-champ-search-btn');
  const uggChampInput = document.getElementById('ugg-champ-input');
  const uggRoleSelect = document.getElementById('ugg-role-select');
  const uggOppInput = document.getElementById('ugg-opp-input');

  const triggerBuildSearch = () => {
    const champ = uggChampInput?.value.trim();
    const role = uggRoleSelect?.value || 'auto';
    const opp = uggOppInput?.value.trim() || '';
    if (champ) loadUggBuild(champ, role, opp);
  };

  if (uggChampBtn) uggChampBtn.addEventListener('click', triggerBuildSearch);
  if (uggChampInput) {
    uggChampInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') triggerBuildSearch();
    });
  }
  if (uggOppInput) {
    uggOppInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') triggerBuildSearch();
    });
  }
  if (uggRoleSelect) {
    uggRoleSelect.addEventListener('change', triggerBuildSearch);
  }

  // Role Filters
  const roleButtons = document.querySelectorAll('#ugg-role-filters .tag-chip');
  roleButtons.forEach(btn => {
    btn?.addEventListener('click', () => {
      roleButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const role = btn.getAttribute('data-role');
      filterUggTierList(role);
    });
  });

  // Refresh Tier List
  const refreshTierBtn = document.getElementById('ugg-refresh-tierlist-btn');
  if (refreshTierBtn) {
    refreshTierBtn.addEventListener('click', () => loadUggTierList());
  }

  // Player Search Button
  const uggPlayerBtn = document.getElementById('ugg-player-search-btn');
  const uggPlayerInput = document.getElementById('ugg-player-input');
  const uggPlayerRegion = document.getElementById('ugg-player-region');

  if (uggPlayerBtn) {
    uggPlayerBtn.addEventListener('click', () => {
      const val = uggPlayerInput?.value.trim();
      const reg = uggPlayerRegion?.value || 'EUW';
      if (val) loadUggPlayerProfile(val, reg);
    });
  }
  if (uggPlayerInput) {
    uggPlayerInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const val = uggPlayerInput?.value.trim();
        const reg = uggPlayerRegion?.value || 'EUW';
        if (val) loadUggPlayerProfile(val, reg);
      }
    });
  }
});

let cachedTierList = [];

async function loadUggBuild(championName, role = 'auto', opponentName = '') {
  const container = document.getElementById('ugg-build-container');
  if (!container) return;

  const matchTitle = opponentName ? `${championName} vs ${opponentName}` : championName;

  container.innerHTML = `
    <div style="text-align: center; padding: 40px; color: var(--powder-cyan); background: #0b0f1a; border: 1px solid #1f2a3e; border-radius: 4px;">
      <i data-lucide="loader-2" class="spin" style="width: 32px; height: 32px; margin-bottom: 10px;"></i>
      <div style="font-weight: 800; font-size: 14px; font-family: monospace;">Analyse des métriques & du matchup pour ${matchTitle}...</div>
    </div>
  `;
  refreshLucideIcons();

  try {
    const build = await ipcRenderer.invoke('ugg:get-build', { championName, role, opponentName });
    if (!build) {
      container.innerHTML = `<div style="padding: 20px; color: #ff4757; font-weight: 800; background: #0b0f1a; border: 1px solid #ff4757; border-radius: 4px;">Impossible de trouver les données de build pour "${championName}".</div>`;
      return;
    }

    const { champion, role: displayRole, matchup, patch, runes, startingItems, coreItems, situationalItems, spells, skillPath, skillMaxOrder } = build;

    let matchupHTML = '';
    if (matchup && matchup.opponent) {
      matchupHTML = `
        <div style="margin-bottom: 16px; background: #0b0f1a; border: 1px solid #1f2a3e; border-left: 4px solid ${matchup.color}; border-radius: 4px; padding: 16px;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; padding-bottom: 10px; border-bottom: 1px solid #1c2538;">
            <div style="display: flex; align-items: center; gap: 8px; font-weight: 800; color: #fff; font-size: 13px; font-family: monospace; letter-spacing: 0.5px;">
              <i data-lucide="swords" style="width: 16px; height: 16px; color: #ff4757;"></i>
              <span>MATCHUP DIRECT : ${champion.name.toUpperCase()} (${displayRole}) VS ${matchup.opponent.name.toUpperCase()}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
              ${matchup.goldDiff ? `<span style="font-size: 11px; background: rgba(229, 169, 60, 0.12); color: var(--powder-gold); padding: 3px 8px; border-radius: 2px; font-weight: 800; border: 1px solid var(--powder-gold); font-family: monospace;">${matchup.goldDiff}</span>` : ''}
              <span style="font-size: 11px; background: rgba(0, 168, 232, 0.12); color: var(--powder-cyan); padding: 3px 8px; border-radius: 2px; font-weight: 800; border: 1px solid var(--powder-cyan); font-family: monospace;">
                ${matchup.winRate}% WIN RATE VS ${matchup.opponent.name.toUpperCase()}
              </span>
              <span style="font-size: 11px; background: ${matchup.color}22; color: ${matchup.color}; padding: 3px 8px; border-radius: 2px; font-weight: 800; border: 1px solid ${matchup.color}; font-family: monospace;">
                ${matchup.label}
              </span>
            </div>
          </div>

          <div style="display: flex; align-items: center; gap: 20px; margin-bottom: 16px;">
            <div style="display: flex; align-items: center; gap: 12px; background: #121826; padding: 10px 14px; border-radius: 4px; border: 1px solid #233047; flex: 1;">
              <img src="${champion.icon}" style="width: 44px; height: 44px; border-radius: 4px; border: 2px solid var(--powder-cyan);" alt="${champion.name}">
              <div>
                <div style="font-weight: 800; color: #fff; font-size: 14px;">${champion.name}</div>
                <div style="font-size: 11px; color: var(--powder-cyan); font-weight: 700; font-family: monospace;">VOTRE CHAMPION (${displayRole})</div>
              </div>
            </div>

            <div style="font-size: 18px; font-weight: 900; color: #ff4757; font-family: monospace; letter-spacing: 1px;">VS</div>

            <div style="display: flex; align-items: center; gap: 12px; background: #121826; padding: 10px 14px; border-radius: 4px; border: 1px solid #ff475755; flex: 1;">
              <img src="${matchup.opponent.icon}" style="width: 44px; height: 44px; border-radius: 4px; border: 2px solid #ff4757;" alt="${matchup.opponent.name}">
              <div>
                <div style="font-weight: 800; color: #fff; font-size: 14px;">${matchup.opponent.name}</div>
                <div style="font-size: 11px; color: #ff4757; font-weight: 700; font-family: monospace;">ADVERSAIRE DIRECT</div>
              </div>
            </div>
          </div>

          <div style="background: #0d1220; padding: 12px 16px; border-radius: 4px; border: 1px solid #1c263b;">
            <div style="font-size: 11px; font-weight: 800; color: var(--powder-gold); margin-bottom: 8px; display: flex; align-items: center; gap: 6px; font-family: monospace; letter-spacing: 0.5px;">
              <i data-lucide="target" style="width: 14px; height: 14px;"></i>
              <span>CONSEILS STRATÉGIQUES MATCHUP VS ${matchup.opponent.name.toUpperCase()}</span>
            </div>
            <div style="display: flex; flex-direction: column; gap: 6px;">
              ${matchup.tips.map(tip => `
                <div style="display: flex; align-items: flex-start; gap: 8px; font-size: 12px; color: #d0d7de; line-height: 1.4;">
                  <span style="color: #ff4757; font-weight: 800; font-family: monospace;">▸</span>
                  <span>${tip}</span>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      `;
    }

    // Summoner Spells HTML
    const spellsHTML = spells && spells.length ? `
      <div style="display: flex; gap: 6px; align-items: center;">
        ${spells.map(s => `
          <img src="${s.icon}" style="width: 28px; height: 28px; border-radius: 4px; border: 1px solid #233047;" title="${s.name}">
        `).join('')}
      </div>
    ` : '';

    // Starter Items HTML
    const starterHTML = startingItems && startingItems.length ? `
      <div style="background: #0b0f1a; border: 1px solid #1f2a3e; padding: 12px; border-radius: 4px;">
        <div style="color: var(--text-muted); font-size: 11px; font-weight: 800; font-family: monospace; letter-spacing: 0.5px; margin-bottom: 8px; text-transform: uppercase;">
          OBJETS DE DÉPART (STARTER)
        </div>
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          ${startingItems.map(item => `
            <div style="display: flex; align-items: center; gap: 6px; background: #121826; padding: 4px 8px; border-radius: 4px; border: 1px solid #233047;">
              <img src="${item.icon}" style="width: 24px; height: 24px; border-radius: 2px;" title="${item.description}">
              <span style="font-size: 11px; font-weight: 700; color: #ccc;">${item.name}</span>
            </div>
          `).join('')}
        </div>
      </div>
    ` : '';

    container.innerHTML = `
      <!-- Main Build Banner -->
      <div style="margin-bottom: 16px; background: #0b0f1a; border: 1px solid #1f2a3e; border-left: 4px solid #ff4757; border-radius: 4px; padding: 16px;">
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <div style="display: flex; align-items: center; gap: 14px;">
            <img src="${champion.icon}" style="width: 52px; height: 52px; border-radius: 4px; border: 2px solid #ff4757;" alt="${champion.name}">
            <div>
              <div style="font-size: 18px; font-weight: 800; color: #fff; font-family: monospace; letter-spacing: 0.5px;">
                BUILD TACTIQUE : ${champion.name.toUpperCase()} (${displayRole})
              </div>
              <div style="font-size: 11px; color: var(--text-muted); font-family: monospace; margin-top: 2px;">
                RANKED SOLO/DUO • PATCH ${patch}
              </div>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 16px;">
            ${spellsHTML}
            <div style="text-align: right;">
              <span style="font-size: 10px; background: rgba(255,71,87,0.15); color: #ff4757; padding: 3px 8px; border-radius: 2px; font-weight: 800; border: 1px solid #ff4757; font-family: monospace;">
                LIVE ENGINE VERIFIED
              </span>
              <div style="font-size: 11px; color: var(--powder-cyan); font-weight: 800; margin-top: 4px; font-family: monospace;">
                ORDRE DES SORTS : <span style="color: #fff;">${skillMaxOrder}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      ${matchupHTML}

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
        <!-- Left Column: Runes -->
        <div style="background: #0b0f1a; border: 1px solid #1f2a3e; padding: 16px; border-radius: 4px;">
          <div style="color: var(--powder-gold); font-size: 12px; font-weight: 800; font-family: monospace; letter-spacing: 0.5px; display: flex; align-items: center; gap: 8px; margin-bottom: 14px; text-transform: uppercase;">
            <i data-lucide="sparkles" style="width: 14px; height: 14px;"></i>
            <span>RUNES (CONFIGURATION OPTIMALE META)</span>
          </div>

          <div style="display: flex; gap: 14px;">
            <!-- Primary Tree -->
            <div style="flex: 1; background: #0e1422; padding: 12px; border-radius: 4px; border: 1px solid #1c263b;">
              <div style="font-size: 11px; font-weight: 800; color: var(--powder-cyan); margin-bottom: 10px; display: flex; align-items: center; gap: 6px; font-family: monospace;">
                ${runes.primaryTree.icon ? `<img src="${runes.primaryTree.icon}" style="width: 18px; height: 18px;">` : ''}
                <span>${(runes.primaryTree.name || 'PRIMARY').toUpperCase()}</span>
              </div>
              <div style="display: flex; flex-direction: column; gap: 8px;">
                ${runes.runes.slice(0, 4).map(r => `
                  <div style="display: flex; align-items: center; gap: 8px; font-size: 11px; color: #fff; font-weight: 700;">
                    ${r.icon ? `<img src="${r.icon}" style="width: 22px; height: 22px; border-radius: 4px;">` : '<span style="width: 8px; height: 8px; border-radius: 2px; background: var(--powder-cyan);"></span>'}
                    <span>${r.name}</span>
                  </div>
                `).join('')}
              </div>
            </div>

            <!-- Secondary Tree -->
            <div style="flex: 1; background: #0e1422; padding: 12px; border-radius: 4px; border: 1px solid #1c263b;">
              <div style="font-size: 11px; font-weight: 800; color: var(--powder-gold); margin-bottom: 10px; display: flex; align-items: center; gap: 6px; font-family: monospace;">
                ${runes.secondaryTree.icon ? `<img src="${runes.secondaryTree.icon}" style="width: 18px; height: 18px;">` : ''}
                <span>${(runes.secondaryTree.name || 'SECONDARY').toUpperCase()}</span>
              </div>
              <div style="display: flex; flex-direction: column; gap: 8px;">
                ${runes.runes.slice(4, 6).map(r => `
                  <div style="display: flex; align-items: center; gap: 8px; font-size: 11px; color: #fff; font-weight: 700;">
                    ${r.icon ? `<img src="${r.icon}" style="width: 22px; height: 22px; border-radius: 4px;">` : '<span style="width: 8px; height: 8px; border-radius: 2px; background: var(--powder-gold);"></span>'}
                    <span>${r.name}</span>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>
        </div>

        <!-- Right Column: Equipment & Build Path -->
        <div style="display: flex; flex-direction: column; gap: 14px;">
          ${starterHTML}

          <!-- Core Build -->
          <div style="background: #0b0f1a; border: 1px solid #1f2a3e; border-left: 3px solid var(--powder-cyan); padding: 14px; border-radius: 4px;">
            <div style="color: var(--powder-cyan); font-size: 11px; font-weight: 800; font-family: monospace; letter-spacing: 0.5px; margin-bottom: 10px; text-transform: uppercase;">
              OBJETS ESSENTIELS (CORE BUILD)
            </div>
            <div style="display: flex; gap: 10px; flex-wrap: wrap;">
              ${coreItems.map(item => `
                <div style="display: flex; align-items: center; gap: 8px; background: #121826; padding: 6px 10px; border-radius: 4px; border: 1px solid #00a8e844;">
                  <img src="${item.icon}" style="width: 30px; height: 30px; border-radius: 4px;" title="${item.description}">
                  <span style="font-size: 11px; font-weight: 700; color: #fff;">${item.name}</span>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- Situational & Counter Build -->
          <div style="background: #0b0f1a; border: 1px solid #1f2a3e; border-left: 3px solid var(--powder-gold); padding: 14px; border-radius: 4px;">
            <div style="color: var(--powder-gold); font-size: 11px; font-weight: 800; font-family: monospace; letter-spacing: 0.5px; margin-bottom: 10px; text-transform: uppercase;">
              OBJETS SITUATIONNELS & CONTRES
            </div>
            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
              ${situationalItems.map(item => `
                <div style="display: flex; align-items: center; gap: 6px; background: #121826; padding: 5px 8px; border-radius: 4px; border: 1px solid #1c263b;">
                  <img src="${item.icon}" style="width: 26px; height: 26px; border-radius: 4px;" title="${item.description}">
                  <span style="font-size: 10px; font-weight: 700; color: #ccc;">${item.name}</span>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      </div>
    `;

    refreshLucideIcons();
  } catch (err) {
    console.error('Failed to render build:', err);
    container.innerHTML = `<div style="padding: 20px; color: #ff4757; font-weight: 800; background: #0b0f1a; border: 1px solid #ff4757; border-radius: 4px;">Erreur lors du chargement des données de build.</div>`;
  }
}

async function loadUggTierList() {
  const container = document.getElementById('ugg-tierlist-container');
  if (!container) return;

  container.innerHTML = `
    <div style="text-align: center; padding: 40px; color: #ff4757;">
      <i data-lucide="loader-2" class="spin" style="width: 32px; height: 32px; margin-bottom: 10px;"></i>
      <div style="font-weight: 800; font-size: 14px;">Chargement de la Tier List Meta des Champions...</div>
    </div>
  `;
  refreshLucideIcons();

  try {
    cachedTierList = await ipcRenderer.invoke('ugg:get-tier-list', 'emerald_plus');
    filterUggTierList('ALL');
  } catch (err) {
    console.error('Failed to load tier list:', err);
    container.innerHTML = `<div style="padding: 20px; color: #e63946;">Impossible de charger la Tier List.</div>`;
  }
}

function filterUggTierList(role) {
  const container = document.getElementById('ugg-tierlist-container');
  if (!container) return;

  const list = role === 'ALL' ? cachedTierList : cachedTierList.filter(item => item.role.toUpperCase() === role.toUpperCase());

  if (list.length === 0) {
    container.innerHTML = `<div style="padding: 30px; text-align: center; color: var(--text-muted);">Aucune donnée de Tier List pour le rôle "${role}".</div>`;
    return;
  }

  container.innerHTML = `
    <div class="dashboard-card" style="background: #0d111a; padding: 0; overflow: hidden;">
      <table class="leaderboard-table" style="width: 100%;">
        <thead>
          <tr style="background: #141926; text-align: left; font-size: 11px; text-transform: uppercase; color: var(--text-muted);">
            <th style="padding: 12px 16px;">Rang</th>
            <th style="padding: 12px 16px;">Champion</th>
            <th style="padding: 12px 16px;">Rôle</th>
            <th style="padding: 12px 16px;">Tier</th>
            <th style="padding: 12px 16px;">Win Rate</th>
            <th style="padding: 12px 16px;">Matchs</th>
          </tr>
        </thead>
        <tbody>
          ${list.slice(0, 50).map((c, index) => {
            const tierColor = c.tier === 'S+' ? '#ff4757' : c.tier === 'S' ? 'var(--powder-cyan)' : c.tier === 'A' ? '#2ecc71' : c.tier === 'B' ? 'var(--powder-gold)' : '#8d9bb0';
            return `
              <tr class="leaderboard-rowugg" data-champ="${c.name}" style="cursor: pointer; border-bottom: 1px solid rgba(255,255,255,0.04);">
                <td style="padding: 10px 16px; font-weight: 800; color: var(--text-muted);">${index + 1}</td>
                <td style="padding: 10px 16px;">
                  <div style="display: flex; align-items: center; gap: 10px;">
                    <img src="${c.icon}" style="width: 32px; height: 32px; border-radius: 8px;" alt="${c.name}">
                    <span style="font-weight: 800; color: #fff;">${c.name}</span>
                  </div>
                </td>
                <td style="padding: 10px 16px;"><span class="edit-badge" style="font-size: 10px; background: rgba(0,168,232,0.15); color: var(--powder-cyan);">${c.role}</span></td>
                <td style="padding: 10px 16px;"><span style="font-weight: 900; font-size: 13px; color: ${tierColor};">${c.tier}</span></td>
                <td style="padding: 10px 16px; font-weight: 800; color: ${parseFloat(c.winRate) >= 50 ? '#2ecc71' : '#e63946'};">${c.winRate}</td>
                <td style="padding: 10px 16px; font-size: 11px; color: var(--text-muted);">${c.matchesTotal.toLocaleString()}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;

  document.querySelectorAll('.leaderboard-rowugg').forEach(row => {
    row.addEventListener('click', () => {
      const champ = row.getAttribute('data-champ');
      const buildTabBtn = document.querySelector('[data-ugg-tab="ugg-tab-builds"]');
      if (buildTabBtn) buildTabBtn.click();
      const input = document.getElementById('ugg-champ-input');
      if (input) input.value = champ;
      loadUggBuild(champ);
    });
  });

  refreshLucideIcons();
}

async function loadUggPlayerProfile(queryStr, region = 'EUW') {
  const container = document.getElementById('ugg-player-container');
  if (!container) return;

  container.innerHTML = `
    <div style="text-align: center; padding: 40px; color: #ff4757;">
      <i data-lucide="loader-2" class="spin" style="width: 32px; height: 32px; margin-bottom: 10px;"></i>
      <div style="font-weight: 800; font-size: 14px;">Recherche du profil en direct pour ${queryStr}...</div>
    </div>
  `;
  refreshLucideIcons();

  let gameName = queryStr.trim();
  let tagLine = region || 'EUW';

  if (queryStr.includes('#')) {
    const parts = queryStr.split('#');
    gameName = parts[0].trim();
    tagLine = parts[1].trim();
  }

  try {
    const profile = await ipcRenderer.invoke('ugg:get-player-profile', { gameName, tagLine, region });
    if (!profile) {
      container.innerHTML = `<div style="padding: 20px; color: #e63946; font-weight: 800;">Impossible de trouver le profil pour ${queryStr}.</div>`;
      return;
    }

    const allBadgesAndTags = [...(profile.badges || []), ...(profile.tags || [])];

    container.innerHTML = `
      <div class="dashboard-card" style="background: #0f1422; border-color: rgba(255,71,87,0.4); margin-bottom: 16px;">
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <div style="display: flex; align-items: center; gap: 16px;">
            <img src="${profile.profileIconUrl}" style="width: 60px; height: 60px; border-radius: 14px; border: 2px solid #ff4757;" alt="Profile Icon">
            <div>
              <div style="font-size: 22px; font-weight: 900; color: #fff;">
                <span>${profile.gameName}</span>
                <span style="font-size: 14px; color: var(--powder-cyan);">#${profile.tagLine}</span>
              </div>
              <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">Level ${profile.summonerLevel} • Region ${profile.region} • PowderHelpMe Live Data</div>
              ${allBadgesAndTags.length > 0 ? `
                <div style="display: flex; gap: 6px; flex-wrap: wrap; margin-top: 8px;">
                  ${allBadgesAndTags.map(b => `
                    <span style="background: ${b.bg || 'rgba(255,255,255,0.08)'}; color: ${b.color || '#fff'}; padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: 800; border: 1px solid ${b.color || 'rgba(255,255,255,0.15)'};">
                      ${b.text}
                    </span>
                  `).join('')}
                </div>
              ` : ''}
            </div>
          </div>

          <div style="text-align: right;">
            <div style="font-size: 18px; font-weight: 900; color: var(--powder-gold);">${profile.rankedSolo?.tier} ${profile.rankedSolo?.rank}</div>
            <div style="font-size: 12px; color: #2ecc71; font-weight: 800;">${profile.rankedSolo?.lp} LP (${profile.rankedSolo?.winrate} Win Rate)</div>
          </div>
        </div>
      </div>

      <div class="dashboard-card" style="background: #111625;">
        <div class="card-title" style="color: #ff4757; font-size: 14px; font-weight: 800;">Top Played Champions</div>
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-top: 12px;">
          ${profile.topChampions.map(c => `
            <div style="background: #0b0e17; padding: 12px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.06); text-align: center;">
              <img src="${c.icon}" style="width: 44px; height: 44px; border-radius: 10px; margin-bottom: 6px;" alt="${c.name}">
              <div style="font-weight: 800; font-size: 13px; color: #fff;">${c.name}</div>
              <div style="font-size: 11px; color: var(--powder-cyan); font-weight: 700; margin-top: 2px;">${c.totalMatches} Games • ${c.winrate} WR</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    refreshLucideIcons();
  } catch (err) {
    console.error('Failed to load profile:', err);
    container.innerHTML = `<div style="padding: 20px; color: #e63946;">Failed to load profile.</div>`;
  }
}


// Initial Startup Loads
loadFollowedPlayers();
loadProfile();
updateDiscordRpcUI();
