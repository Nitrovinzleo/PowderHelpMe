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

  if (viewId === 'view-leaderboards') {
    const regSelect = document.getElementById('leaderboard-region-select');
    loadLeaderboards(regSelect ? regSelect.value : 'EUW');
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
    const playerToToggle = {
      gameName: currentProfile.gameName,
      tagLine: currentProfile.tagLine,
      region: searchRegion?.value || 'EUW',
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
    loadProfile({ gameName: currentProfile.gameName, tagLine: currentProfile.tagLine, region: searchRegion?.value || 'EUW' });
  }
});

function getRankEmblemUrl(tier) {
  if (!tier || tier.toUpperCase() === 'UNRANKED') return '../assets/logo.png';
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
  
  let divStr = rank || '';
  if (divStr === 'I') divStr = '1';
  else if (divStr === 'II') divStr = '2';
  else if (divStr === 'III') divStr = '3';
  else if (divStr === 'IV') divStr = '4';

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

  if (profName) profName.innerText = profile.gameName || 'Lesbian princess';
  if (profTag) profTag.innerText = `#${profile.tagLine || 'UwU'}`;
  if (profLevel) profLevel.innerText = profile.level || 707;

  const solo = profile.rankedSolo || {};
  const flex = profile.rankedFlex || {};

  const ladderInfo = calculateLadderPercent(solo.tier || 'Master', solo.rank || '', solo.lp || 1508);
  if (profLadder) profLadder.innerHTML = `Ladder Rank <strong>#${ladderInfo.rankNum}</strong> (${ladderInfo.topPct})`;

  const followersCountText = document.getElementById('followers-count-text');
  if (followersCountText) {
    const fCount = profile.followersCount || (solo.tier === 'Master' ? 142 : 38);
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

  const soloFormatted = formatRankDisplay(solo.tier || 'Master', solo.rank || '', solo.lp || 1508);
  if (soloTierName) soloTierName.innerText = soloFormatted;
  if (soloLp) soloLp.innerText = `${solo.wins || 0}W ${solo.losses || 0}L`;
  if (soloWrText) soloWrText.innerText = `${solo.winrate || 0}% Win Rate`;

  const soloTierImg = document.getElementById('solo-tier-img');
  if (soloTierImg) {
    soloTierImg.src = getRankEmblemUrl(solo.tier || 'master');
    soloTierImg.onerror = () => { soloTierImg.src = '../assets/logo.png'; };
  }

  const flexFormatted = formatRankDisplay(flex.tier || 'Platinum', flex.rank || '3', flex.lp || 60);
  if (flexTierName) flexTierName.innerText = flexFormatted;
  if (flexLp) flexLp.innerText = `${flex.wins || 0}W ${flex.losses || 0}L`;
  if (flexWrText) flexWrText.innerText = `${flex.winrate || 0}% Win Rate`;

  const flexTierImg = document.getElementById('flex-tier-img');
  if (flexTierImg) {
    flexTierImg.src = getRankEmblemUrl(flex.tier || 'platinum');
    flexTierImg.onerror = () => { flexTierImg.src = '../assets/logo.png'; };
  }

  const validChamps = (profile.topChampions || [])
    .filter(c => c.games > 0)
    .sort((a, b) => b.games - a.games);

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
      topChampsList.innerHTML = `<div style="text-align: center; padding: 16px; color: var(--text-muted); font-size: 12px;">No Ranked Solo champions played.</div>`;
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

  const matches = profile.matches || [];
  const summaryWr = document.getElementById('summary-wr');
  const summaryKda = document.getElementById('summary-kda');

  if (matches.length > 0) {
    if (matchCardsContainer) {
      matchCardsContainer.innerHTML = matches.map(m => renderMatchCardHTML(m)).join('');
    }
    const wins = matches.filter(m => m.win).length;
    const wr = Math.round((wins / matches.length) * 100);
    let totalK = 0, totalD = 0, totalA = 0;
    matches.forEach(m => { totalK += m.kills; totalD += m.deaths; totalA += m.assists; });
    const kda = ((totalK + totalA) / Math.max(1, totalD)).toFixed(2);

    if (summaryWr) summaryWr.innerText = `${wr}% WR (Last ${matches.length})`;
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

  const soloqMatches = matches.filter(m => m.queueId === 420 || (m.mode && m.mode.toLowerCase().includes('ranked solo')));
  const displaySoloq = soloqMatches.length > 0 ? soloqMatches : matches.filter(m => m.mode && m.mode.toLowerCase().includes('ranked'));

  if (soloqContainer) {
    if (displaySoloq.length > 0) {
      soloqContainer.innerHTML = displaySoloq.map(m => renderMatchCardHTML(m)).join('');
      const wins = displaySoloq.filter(m => m.win).length;
      const wr = Math.round((wins / displaySoloq.length) * 100);
      let totalK = 0, totalD = 0, totalA = 0;
      displaySoloq.forEach(m => { totalK += m.kills; totalD += m.deaths; totalA += m.assists; });
      const kda = ((totalK + totalA) / Math.max(1, totalD)).toFixed(2);
      if (soloqSummaryWr) soloqSummaryWr.innerText = `${wr}% WR (${displaySoloq.length} games)`;
      if (soloqSummaryKda) soloqSummaryKda.innerText = `${kda} KDA`;
    } else {
      soloqContainer.innerHTML = `<div style="text-align: center; padding: 40px; color: var(--text-muted);">No Ranked Solo / Duo matches found recently.</div>`;
      if (soloqSummaryWr) soloqSummaryWr.innerText = `0% WR`;
      if (soloqSummaryKda) soloqSummaryKda.innerText = `0.00 KDA`;
    }
  }

  const tierList = (profile.personalTierList && profile.personalTierList.length > 0) ? profile.personalTierList : (profile.topChampions || []).slice(0, 3).map((c, idx) => ({
    champ: c.name,
    winrate: c.winrate,
    tier: idx === 0 ? "S+" : idx === 1 ? "S" : "A",
    icon: c.icon
  }));

  if (tierlistContainer) {
    tierlistContainer.innerHTML = tierList.map(t => `
      <div style="background: #161b28; border: 1px solid #283044; border-radius: 8px; padding: 14px; text-align: center;">
        <span class="edit-badge" style="font-size: 10px; background: rgba(229,169,60,0.2); color: var(--powder-gold); border-color: var(--powder-gold);">${t.tier} Tier</span>
        <img src="${t.icon}" style="width: 52px; height: 52px; border-radius: 50%; margin: 10px auto; display: block; border: 2px solid var(--powder-cyan);" onerror="this.src='../assets/logo.png'">
        <div style="font-weight: 800; font-size: 14px; color: var(--text-main);">${t.champ}</div>
        <div style="font-weight: 800; font-size: 12px; color: #2ecc71; margin-top: 2px;">${t.winrate}% WR</div>
      </div>
    `).join('');
  }

  renderLpChart();
  updateFollowBtnState();

  refreshLucideIcons();
}

function renderMatchCardHTML(m) {
  const itemEntries = [...(m.items || [])];
  while (itemEntries.length < 7) {
    itemEntries.push(null);
  }

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

  if (useMatches.length === 0 && !profile.isRealData) {
    return null;
  }

  const chronoMatches = [...useMatches].reverse();
  let startVal = currentVal;
  for (const m of useMatches) {
    const lpDelta = m.win ? 0.25 : -0.22;
    startVal -= lpDelta;
  }

  const points = [];
  let val = Math.max(0, startVal);
  const numMatches = chronoMatches.length;
  const fillCount = Math.max(0, 100 - numMatches);

  for (let i = 0; i < fillCount; i++) {
    const noise = (Math.random() * 0.12 - 0.06);
    val = Math.max(0, val + noise);
    points.push(Number(val.toFixed(2)));
  }

  for (const m of chronoMatches) {
    const lpDelta = m.win ? 0.25 : -0.22;
    val = Math.max(0, val + lpDelta);
    points.push(Number(val.toFixed(2)));
  }

  if (points.length > 0) {
    points[points.length - 1] = Number(currentVal.toFixed(2));
  }

  return { points: points.slice(0, 100), currentVal };
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
  const labels = Array.from({ length: 100 }, (_, i) => i === 0 ? '100 games ago' : i === 99 ? 'Last game' : '');

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
  const leaderboardTableBody = document.getElementById('leaderboard-table-body');
  if (!leaderboardTableBody) return;
  
  leaderboardTableBody.innerHTML = `
    <tr>
      <td colspan="6" style="text-align: center; padding: 30px; color: var(--text-muted);">
        <i data-lucide="loader-2" class="spin" style="width: 20px; height: 20px; margin-bottom: 8px;"></i>
        <div>Loading ${region} Ranked Leaderboard...</div>
      </td>
    </tr>
  `;
  refreshLucideIcons();

  try {
    const entries = await ipcRenderer.invoke('get-leaderboard', region);
    if (!entries || entries.length === 0) {
      leaderboardTableBody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 20px; color: var(--text-muted);">No leaderboard entries found.</td>
        </tr>
      `;
      return;
    }

    leaderboardTableBody.innerHTML = entries.map(e => {
      const badgeClass = e.rank === 1 ? 'top1' : e.rank === 2 ? 'top2' : e.rank === 3 ? 'top3' : 'other';
      return `
        <tr class="leaderboard-row" data-name="${e.summonerName}" data-region="${region}" style="cursor: pointer;">
          <td><span class="rank-badge-num ${badgeClass}">${e.rank}</span></td>
          <td style="font-weight: 800; color: var(--powder-cyan);">${e.summonerName}</td>
          <td><span class="edit-badge" style="font-size: 10px; background: rgba(229,169,60,0.2); color: var(--powder-gold);">${e.tier}</span></td>
          <td style="font-weight: 800;">${e.lp.toLocaleString()} LP</td>
          <td style="color: ${e.winrate >= 50 ? '#2ecc71' : '#e63946'}; font-weight: 800;">${e.winrate}%</td>
          <td style="font-size: 11px; color: var(--text-muted);">${e.wins}W ${e.losses}L</td>
        </tr>
      `;
    }).join('');

    document.querySelectorAll('.leaderboard-row').forEach(row => {
      row.addEventListener('click', () => {
        const name = row.getAttribute('data-name');
        const reg = row.getAttribute('data-region');
        performSearch(name, reg);
      });
    });
  } catch (err) {
    console.error('Failed to load leaderboard:', err);
    leaderboardTableBody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 20px; color: #e63946;">Failed to load leaderboard data.</td>
      </tr>
    `;
  }
}

let matchOffset = 5;

document.addEventListener('DOMContentLoaded', () => {
  refreshLucideIcons();

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

  const lboardRegionSelect = document.getElementById('leaderboard-region-select');
  if (lboardRegionSelect) {
    lboardRegionSelect.addEventListener('change', () => {
      loadLeaderboards(lboardRegionSelect.value);
    });
  }

  const refreshLboardBtn = document.getElementById('refresh-leaderboard-btn');
  if (refreshLboardBtn) {
    refreshLboardBtn.addEventListener('click', () => {
      const reg = lboardRegionSelect ? lboardRegionSelect.value : 'EUW';
      loadLeaderboards(reg);
    });
  }

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
});

// Initial Startup Loads
loadFollowedPlayers();
loadProfile();
