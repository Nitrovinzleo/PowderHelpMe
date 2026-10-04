const fs = require('fs');
const path = require('path');
const https = require('https');
const { exec } = require('child_process');

const agent = new https.Agent({
  rejectUnauthorized: false
});

class LcuConnector {
  constructor() {
    this.credentials = null;
    this.isMocking = true;
  }

  async findLockfile() {
    // Standard LoL install paths on Windows
    const possiblePaths = [
      'C:\\Riot Games\\League of Legends\\lockfile',
      'D:\\Riot Games\\League of Legends\\lockfile',
      'E:\\Riot Games\\League of Legends\\lockfile'
    ];

    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        try {
          const content = fs.readFileSync(p, 'utf8');
          const parts = content.split(':');
          if (parts.length >= 5) {
            this.credentials = {
              name: parts[0],
              pid: parts[1],
              port: parts[2],
              password: parts[3],
              protocol: parts[4]
            };
            this.isMocking = false;
            return this.credentials;
          }
        } catch (e) {
          console.error("Lockfile read error:", e);
        }
      }
    }

    // Fallback: search via Windows process command line if file in custom folder
    return new Promise((resolve) => {
      exec('wmic process where "name=\'LeagueClientUx.exe\'" get commandline', (err, stdout) => {
        if (!err && stdout) {
          const portMatch = stdout.match(/--app-port=([0-9]+)/);
          const passMatch = stdout.match(/--remoting-auth-token=([A-Za-z0-9_-]+)/);
          if (portMatch && passMatch) {
            this.credentials = {
              port: portMatch[1],
              password: passMatch[1],
              protocol: 'https'
            };
            this.isMocking = false;
            return resolve(this.credentials);
          }
        }
        this.isMocking = true;
        resolve(null);
      });
    });
  }

  getMockSummonerData() {
    return {
      summonerName: "Aphelios#GRAV",
      level: 428,
      profileIconId: 5410,
      tier: "DIAMOND",
      rank: "II",
      leaguePoints: 68,
      wins: 142,
      losses: 104,
      winrate: 57.7,
      winrate7Days: 68.4,
      games7Days: 19,
      mainChampion: "Aphelios",
      mainChampWinrate: 64.2,
      mainChampGames: 81,
      lpHistory7Days: [
        { date: '28/09', lp: 12 },
        { date: '29/09', lp: 34 },
        { date: '30/09', lp: 18 },
        { date: '01/10', lp: 45 },
        { date: '02/10', lp: 58 },
        { date: '03/10', lp: 42 },
        { date: '04/10', lp: 68 }
      ],
      opponentsLobby: [
        { name: "SlayerX#EUW", champ: "Aatrox", tier: "DIAMOND II", winrate7d: 52, winrateChamp: 58, kda: "2.85", badge: "Aggressive Laner" },
        { name: "ShadowMage#EUW", champ: "Sylas", tier: "DIAMOND III", winrate7d: 61, winrateChamp: 65, kda: "3.42", badge: "CS Demon" },
        { name: "LunarHealer#EUW", champ: "Soraka", tier: "DIAMOND II", winrate7d: 48, winrateChamp: 51, kda: "4.10", badge: "Vision God" },
        { name: "SniperCarry#EUW", champ: "Jinx", tier: "DIAMOND I", winrate7d: 70, winrateChamp: 72, kda: "3.90", badge: "Dangerous Carry" },
        { name: "FrostBeast#EUW", champ: "Sejuani", tier: "DIAMOND III", winrate7d: 55, winrateChamp: 54, kda: "2.95", badge: "Objective Slayer" }
      ]
    };
  }
}

module.exports = LcuConnector;
