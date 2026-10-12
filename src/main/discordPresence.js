const DiscordRPC = require('discord-rpc');

class DiscordPresence {
  constructor(customClientId) {
    // Discord Application Client ID (from env, custom param, or default)
    this.clientId = customClientId || process.env.DISCORD_CLIENT_ID || '1556617107263848532';
    this.client = null;
    this.isConnected = false;
    this.isEnabled = true;
    this.appStartTime = Date.now();
    this.lastActivityState = null;
    this.reconnectTimer = null;
    this.isConnecting = false;
  }

  setClientId(clientId) {
    if (clientId && clientId !== this.clientId) {
      this.clientId = clientId;
      if (this.isConnected) {
        this.disconnect();
        this.connect();
      }
    }
  }

  setEnabled(enabled) {
    this.isEnabled = enabled;
    if (!enabled) {
      this.clearPresence();
      this.disconnect();
    } else if (!this.isConnected) {
      this.connect();
    }
  }

  connect() {
    if (!this.isEnabled || this.isConnected || this.isConnecting) return;

    this.isConnecting = true;

    try {
      DiscordRPC.register(this.clientId);
    } catch (e) {
      console.warn('DiscordRPC register warning:', e);
    }

    this.client = new DiscordRPC.Client({ transport: 'ipc' });

    this.client.on('ready', () => {
      console.log('Discord RPC connected successfully!');
      this.isConnected = true;
      this.isConnecting = false;
      if (this.reconnectTimer) {
        clearInterval(this.reconnectTimer);
        this.reconnectTimer = null;
      }
      if (this.lastActivityState) {
        this.updatePresence(this.lastActivityState.liveData, this.lastActivityState.userAccount);
      }
    });

    this.client.on('disconnected', () => {
      console.log('Discord RPC disconnected.');
      this.isConnected = false;
      this.isConnecting = false;
      this.scheduleReconnect();
    });

    this.client.login({ clientId: this.clientId }).catch((err) => {
      // Discord application or client might not be active
      this.isConnected = false;
      this.isConnecting = false;
      this.scheduleReconnect();
    });
  }

  scheduleReconnect() {
    if (this.reconnectTimer || !this.isEnabled) return;
    this.reconnectTimer = setInterval(() => {
      if (this.isEnabled && !this.isConnected && !this.isConnecting) {
        this.connect();
      }
    }, 20000);
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearInterval(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.client) {
      try {
        this.client.destroy();
      } catch (e) { }
      this.client = null;
    }
    this.isConnected = false;
    this.isConnecting = false;
  }

  async clearPresence() {
    if (this.client && this.isConnected) {
      try {
        await this.client.clearActivity();
      } catch (e) { }
    }
  }

  updatePresence(liveData, userAccount) {
    this.lastActivityState = { liveData, userAccount };

    if (!this.isEnabled) return;
    if (!this.isConnected || !this.client) {
      this.connect();
      return;
    }

    try {
      if (liveData && liveData.active && liveData.data) {
        const gameData = liveData.data.gameData || {};
        const activePlayer = liveData.data.activePlayer || {};
        const allPlayers = liveData.data.allPlayers || [];

        const activeSummonerName = activePlayer.summonerName || (allPlayers[0] ? allPlayers[0].summonerName : '');
        const playerObj = allPlayers.find(p => p.summonerName && p.summonerName.toLowerCase() === activeSummonerName.toLowerCase()) || allPlayers[0];

        const champName = playerObj ? playerObj.championName : 'League of Legends';
        const scores = playerObj ? (playerObj.scores || {}) : {};
        const kills = scores.kills || 0;
        const deaths = scores.deaths || 0;
        const assists = scores.assists || 0;

        const gameTime = gameData.gameTime || 0;
        const startTimestamp = Math.floor(Date.now() - (gameTime * 1000));

        const activity = {
          details: `BetaTester testing`,
          state: `Powder is using her best tools to make you win`,
          startTimestamp: startTimestamp,
          largeImageKey: 'powder_discord',
          largeImageText: 'PowderHelpMe',
          instance: false
        };

        this.client.setActivity(activity).catch(() => { });
      } else {
        const activity = {
          details: `BetaTester testing`,
          state: `Powder is using her best tools to make you win`,
          startTimestamp: this.appStartTime,
          largeImageKey: 'powder_discord',
          largeImageText: 'PowderHelpMe',
          instance: false

        };

        this.client.setActivity(activity).catch(() => { });
      }
    } catch (err) {
      console.error('Error updating Discord presence:', err);
    }
  }
}

module.exports = DiscordPresence;
