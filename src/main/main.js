const { app, BrowserWindow, ipcMain, globalShortcut } = require('electron');
const path = require('path');
const Store = require('./store');
const LiveClientApi = require('./liveClientApi');
const LcuConnector = require('./lcuConnector');
const RiotApi = require('./riotApi');
const { analyzeBuildRecommendations } = require('./buildEngine');
const { computeBadges } = require('./badgeEngine');

// Disable SSL certificate checking for Riot local HTTPS API
app.commandLine.appendSwitch('ignore-certificate-errors', 'true');

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
  demoMode: false
});

let dashboardWindow = null;
const overlayWindows = {};
const liveApi = new LiveClientApi();
const lcuConnector = new LcuConnector();
let pollInterval = null;

function createDashboardWindow() {
  dashboardWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    minWidth: 900,
    minHeight: 600,
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
  }, 1000);
}

app.whenReady().then(async () => {
  createDashboardWindow();
  // Note: Floating in-game overlays paused per user request. App runs as standalone consultable stats dashboard.
  // createAllOverlayWindows();
  startPolling();

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
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
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

const riotApi = new RiotApi(store.get('userAccount')?.apiKey || '');

ipcMain.handle('get-summoner-profile', async (event, query) => {
  const account = query || store.get('userAccount') || { gameName: "Lesbian princess", tagLine: "UwU", region: "EUW" };
  const apiKey = store.get('userAccount')?.apiKey || '';
  if (apiKey) riotApi.setApiKey(apiKey);

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
});

ipcMain.handle('save-user-account', async (event, accountData) => {
  store.set('userAccount', accountData);
  if (accountData.apiKey) {
    riotApi.setApiKey(accountData.apiKey);
  }
  return true;
});

ipcMain.handle('generate-verification-challenge', (event, { gameName, tagLine }) => {
  return riotApi.generateVerificationChallenge(gameName, tagLine);
});

ipcMain.handle('get-followed-players', () => {
  return store.get('followedPlayers') || [
    {
      gameName: "Lesbian princess",
      tagLine: "UwU",
      region: "EUW",
      rank: "Master 1508 LP",
      winrate: "51%",
      isLive: true,
      liveChamp: "Jinx",
      gameTime: "18:42",
      icon: "https://ddragon.leagueoflegends.com/cdn/14.20.1/img/champion/Jinx.png"
    },
    {
      gameName: "Faker",
      tagLine: "KR1",
      region: "KR",
      rank: "Challenger 1840 LP",
      winrate: "64%",
      isLive: false,
      lastSeen: "Il y a 2h",
      icon: "https://ddragon.leagueoflegends.com/cdn/14.20.1/img/champion/Ahri.png"
    }
  ];
});

ipcMain.handle('toggle-follow-player', (event, player) => {
  let list = store.get('followedPlayers') || [
    {
      gameName: "Lesbian princess",
      tagLine: "UwU",
      region: "EUW",
      rank: "Master 1508 LP",
      winrate: "51%",
      isLive: true,
      liveChamp: "Jinx",
      gameTime: "18:42",
      icon: "https://ddragon.leagueoflegends.com/cdn/14.20.1/img/champion/Jinx.png"
    },
    {
      gameName: "Faker",
      tagLine: "KR1",
      region: "KR",
      rank: "Challenger 1840 LP",
      winrate: "64%",
      isLive: false,
      lastSeen: "Il y a 2h",
      icon: "https://ddragon.leagueoflegends.com/cdn/14.20.1/img/champion/Ahri.png"
    }
  ];
  
  const index = list.findIndex(p => p.gameName.toLowerCase() === player.gameName.toLowerCase() && p.tagLine.toLowerCase() === player.tagLine.toLowerCase());
  
  if (index > -1) {
    list.splice(index, 1);
  } else {
    list.push(player);
  }
  
  store.set('followedPlayers', list);
  return list;
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

ipcMain.on('close-dashboard', () => {
  if (dashboardWindow) dashboardWindow.close();
});

ipcMain.on('minimize-dashboard', () => {
  if (dashboardWindow) dashboardWindow.minimize();
});
