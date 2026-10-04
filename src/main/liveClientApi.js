const https = require('https');

// Disable HTTPS self-signed certificate rejection for Riot local API
const agent = new https.Agent({
  rejectUnauthorized: false
});

class LiveClientApi {
  constructor() {
    this.apiUrl = 'https://127.0.0.1:2999/liveclientdata/allgamedata';
    this.isDemoMode = false;
    this.demoStartTime = Date.now();
    this.demoStats = {
      gameTime: 120, // starts at 2 min
      totalDamage: 3200,
      kills: 2,
      deaths: 1,
      assists: 4,
      cs: 18,
      gold: 2450,
      wardPlaced: 5
    };
  }

  setDemoMode(enabled) {
    this.isDemoMode = enabled;
    if (enabled) {
      this.demoStartTime = Date.now();
      this.demoStats = {
        gameTime: 180,
        totalDamage: 4500,
        kills: 3,
        deaths: 1,
        assists: 5,
        cs: 28,
        gold: 3200,
        wardPlaced: 7
      };
    }
  }

  async fetchLiveData() {
    if (this.isDemoMode) {
      return this.getSimulatedData();
    }

    return new Promise((resolve) => {
      const req = https.get(this.apiUrl, { agent, timeout: 1500 }, (res) => {
        let rawData = '';
        res.on('data', (chunk) => { rawData += chunk; });
        res.on('end', () => {
          try {
            const data = JSON.parse(rawData);
            resolve({ active: true, data });
          } catch (e) {
            resolve({ active: false, error: 'JSON Parse error' });
          }
        });
      });

      req.on('error', (err) => {
        resolve({ active: false, error: err.message });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({ active: false, error: 'Timeout' });
      });
    });
  }

  getSimulatedData() {
    const elapsedSeconds = Math.floor((Date.now() - this.demoStartTime) / 1000) + 180;
    
    // Increment stats over time for realistic live feeling
    this.demoStats.gameTime = elapsedSeconds;
    this.demoStats.totalDamage += Math.floor(Math.random() * 85) + 35; // +dpm ticks
    this.demoStats.cs += (Math.random() > 0.4 ? 1 : 0);
    this.demoStats.gold += Math.floor(Math.random() * 25) + 10;
    
    if (Math.random() < 0.05) this.demoStats.kills += 1;
    if (Math.random() < 0.03) this.demoStats.assists += 1;

    const gameTimeMinutes = elapsedSeconds / 60;
    const dpm = Math.round(this.demoStats.totalDamage / gameTimeMinutes);
    const csPerMin = parseFloat((this.demoStats.cs / gameTimeMinutes).toFixed(1));
    const gpm = Math.round(this.demoStats.gold / gameTimeMinutes);

    return {
      active: true,
      isDemo: true,
      data: {
        gameData: {
          gameTime: elapsedSeconds,
          gameMode: "CLASSIC",
          mapName: "Summoner's Rift"
        },
        activePlayer: {
          summonerName: "PowderPlayer#EUW",
          level: Math.min(18, Math.floor(elapsedSeconds / 90) + 1),
          currentGold: this.demoStats.gold % 1500,
          abilities: {
            Q: { abilityLevel: 3 },
            W: { abilityLevel: 2 },
            E: { abilityLevel: 2 },
            R: { abilityLevel: 1 }
          }
        },
        allPlayers: [
          {
            summonerName: "PowderPlayer#EUW",
            championName: "Aphelios",
            team: "ORDER",
            scores: {
              kills: this.demoStats.kills,
              deaths: this.demoStats.deaths,
              assists: this.demoStats.assists,
              creepScore: this.demoStats.cs,
              wardScore: this.demoStats.wardPlaced,
              damageDealtToChampions: this.demoStats.totalDamage
            },
            items: [
              { itemId: 3031, count: 1, displayName: "Infinity Edge" },
              { itemId: 3006, count: 1, displayName: "Berserker's Greaves" },
              { itemId: 1055, count: 1, displayName: "Doran's Blade" }
            ]
          },
          {
            summonerName: "Opponent1#EUW",
            championName: "Aatrox",
            team: "CHAOS",
            scores: { kills: 2, deaths: 2, assists: 1, creepScore: 110 }
          },
          {
            summonerName: "Opponent2#EUW",
            championName: "Sylas",
            team: "CHAOS",
            scores: { kills: 4, deaths: 1, assists: 3, creepScore: 95 }
          },
          {
            summonerName: "Opponent3#EUW",
            championName: "Soraka",
            team: "CHAOS",
            scores: { kills: 0, deaths: 3, assists: 6, creepScore: 12 }
          },
          {
            summonerName: "Opponent4#EUW",
            championName: "Jinx",
            team: "CHAOS",
            scores: { kills: 1, deaths: 2, assists: 2, creepScore: 125 }
          },
          {
            summonerName: "Opponent5#EUW",
            championName: "Sejuani",
            team: "CHAOS",
            scores: { kills: 1, deaths: 1, assists: 5, creepScore: 78 }
          }
        ],
        events: {
          Events: [
            { EventName: "GameStart", EventTime: 0 },
            { EventName: "DragonKill", EventTime: Math.max(0, elapsedSeconds - 90), DragonType: "Infernal", KillerName: "PowderPlayer#EUW" },
            { EventName: "HeraldKill", EventTime: Math.max(0, elapsedSeconds - 140), KillerName: "Opponent5#EUW" }
          ]
        }
      },
      computed: {
        dpm,
        csPerMin,
        gpm,
        kda: parseFloat(((this.demoStats.kills + this.demoStats.assists) / Math.max(1, this.demoStats.deaths)).toFixed(2)),
        totalDamage: this.demoStats.totalDamage
      }
    };
  }
}

module.exports = LiveClientApi;
