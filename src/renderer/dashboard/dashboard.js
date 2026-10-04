const { ipcRenderer, shell } = require('electron');

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
const recentlyPlayedList = document.getElementById('recently-played-list');
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

// Window Controls
btnMinimize.addEventListener('click', () => ipcRenderer.send('minimize-dashboard'));
btnClose.addEventListener('click', () => ipcRenderer.send('close-dashboard'));

// Subnav Tab Switcher
subnavItems.forEach(item => {
  item.addEventListener('click', () => {
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

// OriBot Verification Modal Logic
accountBtn.addEventListener('click', async () => {
  const account = await ipcRenderer.invoke('get-user-account');
  if (account) {
    accGamename.value = account.gameName || 'Lesbian princess';
    accTagline.value = account.tagLine || 'UwU';
    accRegion.value = account.region || 'EUW';
  }
  oribotStep1.style.display = 'block';
  oribotStep2.style.display = 'none';
  accountModal.style.display = 'flex';
});

closeModalBtn.addEventListener('click', () => {
  accountModal.style.display = 'none';
});

backStep1Btn.addEventListener('click', () => {
  oribotStep1.style.display = 'block';
  oribotStep2.style.display = 'none';
});

// Step 1 -> Generate OriBot Challenge Icon
genChallengeBtn.addEventListener('click', async () => {
  const gameName = accGamename.value.trim() || 'Lesbian princess';
  const tagLine = accTagline.value.trim() || 'UwU';
  const region = accRegion.value || 'EUW';

  currentChallenge = await ipcRenderer.invoke('generate-verification-challenge', { gameName, tagLine });

  if (currentChallenge && currentChallenge.requiredIcon) {
    challengeIconImg.src = currentChallenge.requiredIcon.url;
    challengeIconName.innerText = `Icône : ${currentChallenge.requiredIcon.name} (#${currentChallenge.requiredIcon.id})`;
    verifyStatusMsg.style.display = 'none';
    oribotStep1.style.display = 'none';
    oribotStep2.style.display = 'block';
  }
});

// Step 2 -> Verify Icon in League Client
verifyIconBtn.addEventListener('click', async () => {
  const gameName = accGamename.value.trim() || 'Lesbian princess';
  const tagLine = accTagline.value.trim() || 'UwU';
  const region = accRegion.value || 'EUW';
  const requiredIconId = currentChallenge?.requiredIcon?.id || 23;

  verifyIconBtn.innerHTML = '<i data-lucide="loader-2" class="spin" style="width: 16px; height: 16px;"></i> <span>Verification pending...</span>';
  if (window.lucide) window.lucide.createIcons();

  const result = await ipcRenderer.invoke('verify-account-icon', {
    gameName,
    tagLine,
    requiredIconId,
    region
  });
  verifyIconBtn.innerHTML = '<i data-lucide="key-round" style="width: 16px; height: 16px;"></i> <span>Verify Profile Icon</span>';
  if (window.lucide) window.lucide.createIcons();

  if (result.success) {
    verifyStatusMsg.style.display = 'block';
    verifyStatusMsg.style.color = '#2ecc71';
    verifyStatusMsg.innerHTML = '<div style="display: flex; align-items: center; justify-content: center; gap: 6px;"><i data-lucide="check-circle-2" style="width: 16px; height: 16px;"></i> <span>Account verified successfully! Connecting...</span></div>';
    if (window.lucide) window.lucide.createIcons();

    setTimeout(() => {
      accountModal.style.display = 'none';
      loadProfile({ gameName, tagLine, region });
    }, 1200);
  } else {
    verifyStatusMsg.style.display = 'block';
    verifyStatusMsg.style.color = '#e63946';
    verifyStatusMsg.innerHTML = '<div style="display: flex; align-items: center; justify-content: center; gap: 6px;"><i data-lucide="alert-circle" style="width: 16px; height: 16px;"></i> <span>Icon not detected. Please equip the required profile icon in your LoL client and try again!</span></div>';
    if (window.lucide) window.lucide.createIcons();
  }
});

// Sidebar Navigation View Switcher
const sidebarItems = document.querySelectorAll('.sidebar-item');
const appViews = document.querySelectorAll('.app-view');

sidebarItems.forEach(item => {
  item.addEventListener('click', () => {
    const targetViewId = item.getAttribute('data-view');
    switchView(targetViewId);
  });
});

function switchView(viewId) {
  sidebarItems.forEach(i => {
    if (i.getAttribute('data-view') === viewId) {
      i.classList.add('active');
    } else {
      i.classList.remove('active');
    }
  });

  appViews.forEach(view => {
    if (view.id === viewId) {
      view.classList.add('active');
    } else {
      view.classList.remove('active');
    }
  });

  if (window.lucide) window.lucide.createIcons();
}

// Hero Search Box Handlers
const heroSearchInput = document.getElementById('hero-search-input');
const heroSearchRegion = document.getElementById('hero-search-region');
const heroSearchBtn = document.getElementById('hero-search-btn');

if (heroSearchBtn) {
  heroSearchBtn.addEventListener('click', () => {
    const query = heroSearchInput.value.trim();
    const region = heroSearchRegion.value;
    if (query) performSearch(query, region);
  });
}

if (heroSearchInput) {
  heroSearchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const query = heroSearchInput.value.trim();
      const region = heroSearchRegion.value;
      if (query) performSearch(query, region);
    }
  });
}

// Quick Suggestion Tag Chips
document.querySelectorAll('.tag-chip').forEach(tag => {
  tag.addEventListener('click', () => {
    const query = tag.getAttribute('data-search');
    performSearch(query, 'EUW');
  });
});

// Follow Button & List Elements
const toggleFollowBtn = document.getElementById('toggle-follow-btn');
const followBtnText = document.getElementById('follow-btn-text');
const followsListContainer = document.getElementById('follows-list-container');
const followsCountBadge = document.getElementById('follows-count-badge');

let followedPlayersList = [];

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
    if (window.lucide) window.lucide.createIcons();
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

  // Attach event listeners for view profile & unfollow
  document.querySelectorAll('.view-follow-prof-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const name = btn.getAttribute('data-name');
      const tag = btn.getAttribute('data-tag');
      const region = btn.getAttribute('data-region') || 'EUW';
      performSearch(`${name}#${tag}`, region);
    });
  });

  document.querySelectorAll('.unfollow-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const name = btn.getAttribute('data-name');
      const tag = btn.getAttribute('data-tag');
      followedPlayersList = await ipcRenderer.invoke('toggle-follow-player', { gameName: name, tagLine: tag });
      renderFollowsList();
      updateFollowBtnState();
    });
  });

  if (window.lucide) window.lucide.createIcons();
}

// Toggle Follow on Profile
if (toggleFollowBtn) {
  toggleFollowBtn.addEventListener('click', async () => {
    if (!currentProfile) return;
    const playerToToggle = {
      gameName: currentProfile.gameName,
      tagLine: currentProfile.tagLine,
      region: searchRegion.value || 'EUW',
      rank: `${currentProfile.rankedSolo?.tier || 'Master'} ${currentProfile.rankedSolo?.lp || 1508} LP`,
      winrate: `${currentProfile.rankedSolo?.winrate || 51}%`,
      isLive: true,
      liveChamp: "Singed",
      gameTime: "12:15",
      icon: currentProfile.profileIconUrl || '../assets/logo.png'
    };

    followedPlayersList = await ipcRenderer.invoke('toggle-follow-player', playerToToggle);
    renderFollowsList();
    updateFollowBtnState();
  });
}

function updateFollowBtnState() {
  if (!currentProfile || !toggleFollowBtn) return;
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
searchBtn.addEventListener('click', () => performSearch());
searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') performSearch();
});

function performSearch(customQuery = null, customRegion = null) {
  const query = customQuery || searchInput.value.trim();
  const region = customRegion || searchRegion.value;
  if (!query) return;

  let gameName = query;
  let tagLine = 'EUW';

  if (query.includes('#')) {
    const parts = query.split('#');
    gameName = parts[0];
    tagLine = parts[1];
  }

  // Switch to profile view
  switchView('view-profile');
  loadProfile({ gameName, tagLine, region });
}

updateStatsBtn.addEventListener('click', () => {
  if (currentProfile) {
    loadProfile({ gameName: currentProfile.gameName, tagLine: currentProfile.tagLine, region: searchRegion.value });
  }
});

// Load Profile Data
async function loadProfile(query = null) {
  try {
    updateStatsBtn.innerHTML = '<i data-lucide="loader-2" class="spin" style="width: 14px; height: 14px;"></i> <span>Loading...</span>';
    if (window.lucide) window.lucide.createIcons();

    const profile = await ipcRenderer.invoke('get-summoner-profile', query);
    updateStatsBtn.innerHTML = '<i data-lucide="rotate-cw" style="width: 14px; height: 14px;"></i> <span>Refresh</span>';
    if (window.lucide) window.lucide.createIcons();

    if (profile) {
      currentProfile = profile;
      renderProfileUI(profile);
    }
  } catch (err) {
    console.error('Failed to load summoner profile:', err);
    updateStatsBtn.innerHTML = '<i data-lucide="rotate-cw" style="width: 14px; height: 14px;"></i> <span>Refresh</span>';
    if (window.lucide) window.lucide.createIcons();
  }
}

// Render Complete U.GG Profile UI
function renderProfileUI(profile) {
  // 1. Header Banner
  profName.innerText = profile.gameName || 'Lesbian princess';
  profTag.innerText = `#${profile.tagLine || 'UwU'}`;
  profLevel.innerText = profile.level || 707;
  profLadder.innerHTML = `Ladder Rank <strong>${profile.ladderRank || '1,449'}</strong> (top 0.0398%)`;
  if (profile.profileIconUrl) profAvatar.src = profile.profileIconUrl;

  // 2. Ranked Solo Card
  const solo = profile.rankedSolo || {};
  soloTierName.innerText = `${solo.tier || 'Master'} ${solo.rank || ''}`;
  soloLp.innerText = `${(solo.lp || 1508).toLocaleString()} LP • ${solo.wins || 689}W ${solo.losses || 651}L`;
  soloWrText.innerText = `${solo.winrate || 51}% Win Rate`;

  // 3. Ranked Flex Card
  const flex = profile.rankedFlex || {};
  flexTierName.innerText = `${flex.tier || 'Platinum 3'} ${flex.rank || ''}`;
  flexLp.innerText = `${flex.lp || 60} LP • ${flex.wins || 1}W ${flex.losses || 4}L`;
  flexWrText.innerText = `${flex.winrate || 20}% Win Rate`;

  // 4. Top Champions Table
  const topChamps = profile.topChampions || [
    { name: "Singed", kda: "2.40", kills: "3.8", deaths: "5.4", assists: "9.3", winrate: 57, games: 819, icon: "https://ddragon.leagueoflegends.com/cdn/14.20.1/img/champion/Singed.png" },
    { name: "Rek'Sai", kda: "1.94", kills: "4.1", deaths: "5.1", assists: "5.7", winrate: 45, games: 110, icon: "https://ddragon.leagueoflegends.com/cdn/14.20.1/img/champion/RekSai.png" },
    { name: "Urgot", kda: "1.92", kills: "6.2", deaths: "6.3", assists: "5.8", winrate: 49, games: 74, icon: "https://ddragon.leagueoflegends.com/cdn/14.20.1/img/champion/Urgot.png" },
    { name: "Cho'Gath", kda: "1.99", kills: "5.8", deaths: "5.7", assists: "5.6", winrate: 52, games: 60, icon: "https://ddragon.leagueoflegends.com/cdn/14.20.1/img/champion/Chogath.png" },
    { name: "Ornn", kda: "1.88", kills: "1.8", deaths: "4.7", assists: "7.0", winrate: 38, games: 32, icon: "https://ddragon.leagueoflegends.com/cdn/14.20.1/img/champion/Ornn.png" }
  ];

  topChampsList.innerHTML = topChamps.map(c => `
    <div class="champ-stat-row">
      <div class="champ-info">
        <img src="${c.icon}" class="champ-icon-sm" alt="${c.name}">
        <div>
          <div class="champ-name">${c.name}</div>
          <div class="champ-kda">${c.kda} KDA (${c.kills}/${c.deaths}/${c.assists})</div>
        </div>
      </div>
      <div style="text-align: right;">
        <div style="font-size: 11px; font-weight: 800; color: ${c.winrate >= 50 ? '#2ecc71' : '#e63946'};">${c.winrate}%</div>
        <div style="font-size: 9px; color: var(--text-muted);">${c.games} games</div>
      </div>
    </div>
  `).join('');

  champsDetailTable.innerHTML = topChampsList.innerHTML;

  // 5. Recently Played With
  const recent = profile.recentlyPlayedWith || [
    { name: "hamsalak", games: 2, winrate: 0 },
    { name: "sacrifice", games: 2, winrate: 0 }
  ];
  recentlyPlayedList.innerHTML = recent.map(r => `
    <div class="champ-stat-row">
      <span style="font-size: 11px; font-weight: 700; color: var(--text-main);">${r.name}</span>
      <span style="font-size: 11px; color: var(--text-muted);">${r.games} games (${r.winrate}%)</span>
    </div>
  `).join('');

  // 6. Match History Cards
  const matches = profile.matches || [];
  if (matches.length > 0) {
    matchCardsContainer.innerHTML = matches.map(m => `
      <div class="match-card ${m.win ? 'win' : 'loss'}">
        <div class="match-meta">
          <span class="match-mode">${m.mode}</span>
          <span class="match-time">${m.timeAgo}</span>
          <span class="match-lp ${m.win ? 'win' : 'loss'}">${m.lpChange}</span>
        </div>

        <div class="match-champ-box">
          <img src="${m.championIcon}" class="match-champ-img" alt="${m.championName}">
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
          ${m.items.map(itemUrl => itemUrl ? `<img src="${itemUrl}" class="item-slot">` : `<div class="item-slot"></div>`).join('')}
        </div>
      </div>
    `).join('');
  }

  // 7. Personal Tier List
  const tierList = profile.personalTierList || [
    { champ: "Jinx", winrate: 63, tier: "S+", icon: "https://ddragon.leagueoflegends.com/cdn/14.20.1/img/champion/Jinx.png" },
    { champ: "Caitlyn", winrate: 66, tier: "S+", icon: "https://ddragon.leagueoflegends.com/cdn/14.20.1/img/champion/Caitlyn.png" },
    { champ: "Corki", winrate: 56, tier: "S+", icon: "https://ddragon.leagueoflegends.com/cdn/14.20.1/img/champion/Corki.png" }
  ];

  tierlistContainer.innerHTML = tierList.map(t => `
    <div style="background: #161b28; border: 1px solid #283044; border-radius: 8px; padding: 14px; text-align: center;">
      <span class="edit-badge" style="font-size: 10px; background: rgba(229,169,60,0.2); color: var(--powder-gold); border-color: var(--powder-gold);">${t.tier} Tier</span>
      <img src="${t.icon}" style="width: 52px; height: 52px; border-radius: 50%; margin: 10px auto; display: block; border: 2px solid var(--powder-cyan);">
      <div style="font-weight: 800; font-size: 14px; color: var(--text-main);">${t.champ}</div>
      <div style="font-weight: 800; font-size: 12px; color: #2ecc71; margin-top: 2px;">${t.winrate}% WR</div>
    </div>
  `).join('');

  // 8. LP History Chart
  renderLpChart();

  // 9. Update Follow Button State
  updateFollowBtnState();

  // Render Lucide SVG Icons
  if (window.lucide) window.lucide.createIcons();
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

document.addEventListener('DOMContentLoaded', () => {
  if (window.lucide) window.lucide.createIcons();
});

// Initial Startup Loads
loadFollowedPlayers();
loadProfile();
