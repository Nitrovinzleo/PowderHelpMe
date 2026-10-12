const { app, BrowserWindow, ipcMain, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');

// Enforce Single Instance Lock to prevent multiple Electron instances from running
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  console.log('[Main] Another instance of PowderHelpMe is already running. Exiting redundant instance...');
  app.quit();
  process.exit(0);
}

const Store = require('./store');
const LiveClientApi = require('./liveClientApi');
const LcuConnector = require('./lcuConnector');
const RiotApi = require('./riotApi');
const DiscordPresence = require('./discordPresence');
const UggService = require('./uggService');
const { analyzeBuildRecommendations } = require('./buildEngine');
const { computeBadges } = require('./badgeEngine');

// Disable SSL certificate checking for Riot local HTTPS API & GPU cache lock warnings
app.commandLine.appendSwitch('ignore-certificate-errors', 'true');
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache', 'true');
app.commandLine.appendSwitch('disable-http-cache', 'true');

let envApiKey = '';
try {
  const envPath = path.join(__dirname, '../../.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const match = envContent.match(/RIOT_API_KEY=(.+)/);
    if (match) envApiKey = match[1].trim();
  }
} catch (e) {}

const store = new Store({
  isEditMode: true,
  opacity: 0.9,
  hotkey: 'CommandOrControl+Shift+O',
  userAccount: {
    gameName: "Lesbian princess",
    tagLine: "UwU",
    region: "EUW",
    apiKey: envApiKey || "RGAPI-93ab8980-72e8-45c0-8837-4048a5f7c1d4"
  },
  widgets: {
    combat: { visible: true, x: 50, y: 50, width: 280, height: 180 },
    jungle: { visible: true, x: 50, y: 250, width: 260, height: 260 },
    build: { visible: true, x: 50, y: 530, width: 300, height: 210 },
    lobby: { visible: true, x: 350, y: 50, width: 320, height: 220 }
  },
  demoMode: false,
  discordPresence: { enabled: true }
});

let dashboardWindow = null;
const overlayWindows = {};
const liveApi = new LiveClientApi();
const lcuConnector = new LcuConnector();
const discordPresence = new DiscordPresence();
let pollInterval = null;

function createDashboardWindow() {
  dashboardWindow = new BrowserWindow({
    width: 1250,
    height: 780,
    minWidth: 1050,
    minHeight: 650,
    frame: false,
    transparent: false,
    backgroundColor: '#10141e',
    icon: path.join(__dirname, '../renderer/assets/logo.png'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  dashboardWindow.loadFile(path.join(__dirname, '../renderer/dashboard/index.html'));
  dashboardWindow.on('closed', () => {
    dashboardWindow = null;
  });
}

function createOverlayWindow(id, htmlFile, bounds) {
  const isEditMode = store.get('isEditMode');

  const win = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,
    focusable: isEditMode,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  win.setAlwaysOnTop(true, 'screen-saver');
  win.setIgnoreMouseEvents(!isEditMode, { forward: true });

  win.loadFile(path.join(__dirname, `../renderer/overlays/${htmlFile}`));

  win.on('move', () => {
    if (win) {
      const currentBounds = win.getBounds();
      const widgets = store.get('widgets');
      if (widgets[id]) {
        widgets[id].x = currentBounds.x;
        widgets[id].y = currentBounds.y;
        store.set('widgets', widgets);
      }
    }
  });

  win.on('resize', () => {
    if (win) {
      const currentBounds = win.getBounds();
      const widgets = store.get('widgets');
      if (widgets[id]) {
        widgets[id].width = currentBounds.width;
        widgets[id].height = currentBounds.height;
        store.set('widgets', widgets);
      }
    }
  });

  overlayWindows[id] = win;
}

function createAllOverlayWindows() {
  const widgets = store.get('widgets');
  
  if (widgets.combat && widgets.combat.visible) {
    createOverlayWindow('combat', 'combatWidget.html', widgets.combat);
  }
  if (widgets.jungle && widgets.jungle.visible) {
    createOverlayWindow('jungle', 'jungleWidget.html', widgets.jungle);
  }
  if (widgets.build && widgets.build.visible) {
    createOverlayWindow('build', 'buildWidget.html', widgets.build);
  }
  if (widgets.lobby && widgets.lobby.visible) {
    createOverlayWindow('lobby', 'lobbyWidget.html', widgets.lobby);
  }
}

function setEditMode(enabled) {
  store.set('isEditMode', enabled);
  
  Object.keys(overlayWindows).forEach((id) => {
    const win = overlayWindows[id];
    if (win && !win.isDestroyed()) {
      win.setIgnoreMouseEvents(!enabled, { forward: true });
      win.webContents.send('edit-mode-changed', enabled);
    }
  });

  if (dashboardWindow && !dashboardWindow.isDestroyed()) {
    dashboardWindow.webContents.send('edit-mode-changed', enabled);
  }
}

function startPolling() {
  if (pollInterval) clearInterval(pollInterval);

  pollInterval = setInterval(async () => {
    const liveData = await liveApi.fetchLiveData();
    let buildAdvice = null;
    
    if (liveData && liveData.active && liveData.data) {
      const allPlayers = liveData.data.allPlayers || [];
      const activeName = liveData.data.activePlayer?.summonerName || (allPlayers[0] ? allPlayers[0].summonerName : '');
      buildAdvice = analyzeBuildRecommendations(allPlayers, activeName);
    }

    // Broadcast live data to all overlay windows & dashboard
    const payload = {
      liveData,
      buildAdvice,
      isEditMode: store.get('isEditMode')
    };

    Object.keys(overlayWindows).forEach(id => {
      const win = overlayWindows[id];
      if (win && !win.isDestroyed()) {
        win.webContents.send('live-game-data', payload);
      }
    });

    if (dashboardWindow && !dashboardWindow.isDestroyed()) {
      dashboardWindow.webContents.send('live-game-data', payload);
    }

    // Update Discord Rich Presence Status
    discordPresence.updatePresence(liveData, store.get('userAccount'));
  }, 1000);
}

function stopPolling() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
}

app.on('second-instance', () => {
  if (dashboardWindow) {
    if (dashboardWindow.isMinimized()) dashboardWindow.restore();
    dashboardWindow.focus();
  }
});

app.whenReady().then(async () => {
  createDashboardWindow();
  // Note: Floating in-game overlays paused per user request. App runs as standalone consultable stats dashboard.
  // createAllOverlayWindows();
  startPolling();

  const discordConfig = store.get('discordPresence') || { enabled: true };
  discordPresence.setEnabled(discordConfig.enabled !== false);

  // Register shortcut for toggling edit/click-through mode
  const hotkey = store.get('hotkey') || 'CommandOrControl+Shift+O';
  try {
    globalShortcut.register(hotkey, () => {
      const currentMode = store.get('isEditMode');
      setEditMode(!currentMode);
    });
  } catch (err) {
    console.error('Failed to register global shortcut:', err);
  }
});

app.on('window-all-closed', () => {
  stopPolling();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  stopPolling();
  try { globalShortcut.unregisterAll(); } catch(e){}
  try { discordPresence.disconnect(); } catch(e){}
});

app.on('quit', () => {
  process.exit(0);
});

// IPC Handlers
ipcMain.on('toggle-edit-mode', (event, mode) => {
  const targetMode = mode !== undefined ? mode : !store.get('isEditMode');
  setEditMode(targetMode);
});

ipcMain.on('toggle-demo-mode', (event, enabled) => {
  store.set('demoMode', enabled);
  liveApi.setDemoMode(enabled);
});

ipcMain.on('toggle-widget-visibility', (event, { id, visible }) => {
  const widgets = store.get('widgets');
  if (widgets[id]) {
    widgets[id].visible = visible;
    store.set('widgets', widgets);

    if (visible && !overlayWindows[id]) {
      const htmlMap = {
        combat: 'combatWidget.html',
        jungle: 'jungleWidget.html',
        build: 'buildWidget.html',
        lobby: 'lobbyWidget.html'
      };
      createOverlayWindow(id, htmlMap[id], widgets[id]);
    } else if (!visible && overlayWindows[id]) {
      overlayWindows[id].close();
      delete overlayWindows[id];
    }
  }
});

ipcMain.on('reset-widget-positions', () => {
  const defaults = {
    combat: { visible: true, x: 50, y: 50, width: 280, height: 180 },
    jungle: { visible: true, x: 50, y: 250, width: 260, height: 260 },
    build: { visible: true, x: 50, y: 530, width: 300, height: 210 },
    lobby: { visible: true, x: 350, y: 50, width: 320, height: 220 }
  };
  store.set('widgets', defaults);

  Object.keys(overlayWindows).forEach(id => {
    if (overlayWindows[id] && !overlayWindows[id].isDestroyed()) {
      overlayWindows[id].setBounds(defaults[id]);
    }
  });
});

const initialApiKey = store.get('userAccount')?.apiKey || process.env.RIOT_API_KEY || '';
const riotApi = new RiotApi(initialApiKey);
const uggService = new UggService();

ipcMain.handle('get-user-account', () => {
  const acc = store.get('userAccount') || {};
  return {
    gameName: acc.gameName || 'Lesbian princess',
    tagLine: acc.tagLine || 'UwU',
    region: acc.region || 'EUW',
    apiKey: acc.apiKey || process.env.RIOT_API_KEY || '',
    verified: acc.verified || false
  };
});

ipcMain.handle('get-summoner-profile', async (event, query) => {
  const account = query || store.get('userAccount') || { gameName: "Lesbian princess", tagLine: "UwU", region: "EUW" };
  const isRefresh = query?.forceRefresh || false;
  const apiKey = account.apiKey || store.get('userAccount')?.apiKey || process.env.RIOT_API_KEY || '';
  if (apiKey) riotApi.setApiKey(apiKey);

  if (isRefresh) {
    console.log(`[Main] Triggering u.gg updatePlayerProfile for ${account.gameName}#${account.tagLine}...`);
    try {
      await uggService.requestProfileUpdate(account.gameName, account.tagLine, account.region || 'EUW');
      // Wait 1.5s for u.gg server to process the update before fetching
      await new Promise(r => setTimeout(r, 1500));
    } catch (e) {
      console.warn('[Main] u.gg requestProfileUpdate error:', e.message);
    }
  }

  try {
    const profileData = await riotApi.getSummonerByRiotId(account.gameName, account.tagLine, account.region || 'EUW');
    const badges = computeBadges({
      csPerMin: 8.2,
      dpm: 680,
      kda: 3.8,
      winrate7d: profileData.rankedSolo?.winrate || 51,
      visionScorePerMin: 1.6,
      mainChampPickrate: 55
    });
    return { ...profileData, badges };
  } catch (err) {
    console.log('[Main] Riot API skipped/failed, using PowderHelpMe live profile fallback:', err.message);
    const uggProfile = await uggService.getPlayerProfile(account.gameName, account.tagLine, account.region || 'EUW');
    return {
      ...uggProfile,
      source: 'PowderHelpMe'
    };
  }
});

// U.GG IPC Handlers
ipcMain.handle('ugg:get-build', async (event, { championName, role, opponentName }) => {
  return await uggService.getChampionBuild(championName, role, opponentName);
});

ipcMain.handle('ugg:get-tier-list', async (event, tier) => {
  return await uggService.getChampionTierList(tier || 'emerald_plus');
});

ipcMain.handle('ugg:get-player-profile', async (event, { gameName, tagLine, region }) => {
  return await uggService.getPlayerProfile(gameName, tagLine, region || 'EUW');
});

ipcMain.handle('get-more-matches', async (event, { puuid, continentalHost, start, count }) => {
  return await riotApi.getMoreMatches(puuid, continentalHost, start || 20, count || 10);
});

ipcMain.handle('get-leaderboard', async (event, region) => {
  return await uggService.getLeaderboard(region || 'EUW');
});

ipcMain.handle('save-user-account', async (event, accountData) => {
  store.set('userAccount', accountData);
  const apiKey = accountData.apiKey || process.env.RIOT_API_KEY || '';
  if (apiKey) {
    riotApi.setApiKey(apiKey);
  }
  return true;
});

ipcMain.handle('generate-verification-challenge', (event, { gameName, tagLine }) => {
  return riotApi.generateVerificationChallenge(gameName, tagLine);
});

// Followed Players IPC Handlers
ipcMain.handle('get-followed-players', () => {
  return store.get('followedPlayers') || [];
});

ipcMain.handle('toggle-follow-player', (event, player) => {
  if (!player || !player.gameName || !player.tagLine) {
    return store.get('followedPlayers') || [];
  }
  const current = store.get('followedPlayers') || [];
  const cleanName = String(player.gameName).trim();
  const cleanTag = String(player.tagLine).trim();

  const index = current.findIndex(p =>
    p.gameName && p.gameName.toLowerCase() === cleanName.toLowerCase() &&
    p.tagLine && p.tagLine.toLowerCase() === cleanTag.toLowerCase()
  );

  if (index >= 0) {
    current.splice(index, 1);
  } else {
    current.push({
      gameName: cleanName,
      tagLine: cleanTag,
      region: player.region || 'EUW',
      rank: player.rank || 'Unranked',
      winrate: player.winrate || '0%',
      isLive: player.isLive || false,
      liveChamp: player.liveChamp || '',
      gameTime: player.gameTime || '',
      icon: player.icon || 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/profile-icons/23.jpg'
    });
  }

  store.set('followedPlayers', current);
  return current;
});

ipcMain.handle('verify-account-icon', async (event, { gameName, tagLine, requiredIconId, region }) => {
  const result = await riotApi.verifySummonerIcon(gameName, tagLine, requiredIconId, region || 'EUW');
  if (result.success) {
    store.set('userAccount', {
      gameName,
      tagLine,
      region: region || 'EUW',
      verified: true
    });
  }
  return result;
});

ipcMain.handle('get-settings', () => {
  return store.data;
});

ipcMain.handle('get-discord-settings', () => {
  const settings = store.get('discordPresence') || { enabled: true };
  return {
    enabled: settings.enabled !== false,
    isConnected: discordPresence.isConnected
  };
});

ipcMain.handle('toggle-discord-presence', (event, enabled) => {
  const currentSettings = store.get('discordPresence') || { enabled: true };
  const targetEnabled = enabled !== undefined ? enabled : !currentSettings.enabled;
  store.set('discordPresence', { ...currentSettings, enabled: targetEnabled });
  discordPresence.setEnabled(targetEnabled);
  return { enabled: targetEnabled, isConnected: discordPresence.isConnected };
});

ipcMain.on('close-dashboard', () => {
  stopPolling();
  try { discordPresence.disconnect(); } catch(e){}
  if (dashboardWindow && !dashboardWindow.isDestroyed()) {
    dashboardWindow.close();
  }
  app.quit();
  setTimeout(() => process.exit(0), 100);
});

ipcMain.on('minimize-dashboard', () => {
  if (dashboardWindow && !dashboardWindow.isDestroyed()) {
    dashboardWindow.minimize();
  }
});
