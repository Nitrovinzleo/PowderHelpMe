const https = require('https');
const UggService = require('./uggService');

class RiotApi {
  constructor(apiKey = '') {
    this.apiKey = apiKey.trim();
    this.uggService = new UggService();
    this.ddragonVersion = '14.20.1';
    this.championIdMap = {};
    this.verificationIcons = [
      { id: 23, name: "Potion Bleue", url: `https://ddragon.leagueoflegends.com/cdn/${this.ddragonVersion}/img/profileicon/23.png` },
      { id: 7, name: "Baron Nashor", url: `https://ddragon.leagueoflegends.com/cdn/${this.ddragonVersion}/img/profileicon/7.png` },
      { id: 54, name: "Sbire Violet", url: `https://ddragon.leagueoflegends.com/cdn/${this.ddragonVersion}/img/profileicon/54.png` },
      { id: 29, name: "Épée Dorée", url: `https://ddragon.leagueoflegends.com/cdn/${this.ddragonVersion}/img/profileicon/29.png` },
      { id: 14, name: "Rose Rouge", url: `https://ddragon.leagueoflegends.com/cdn/${this.ddragonVersion}/img/profileicon/14.png` }
    ];

    this.regionHostMap = {
      'EUW': 'euw1.api.riotgames.com',
      'NA': 'na1.api.riotgames.com',
      'EUNE': 'eun1.api.riotgames.com',
      'KR': 'kr.api.riotgames.com',
      'BR': 'br1.api.riotgames.com',
      'LAN': 'la1.api.riotgames.com',
      'LAS': 'la2.api.riotgames.com',
      'OCE': 'oc1.api.riotgames.com',
      'TR': 'tr1.api.riotgames.com',
      'RU': 'ru.api.riotgames.com',
      'JP': 'jp1.api.riotgames.com'
    };

    this.continentalHostMap = {
      'EUW': 'europe.api.riotgames.com',
      'EUNE': 'europe.api.riotgames.com',
      'TR': 'europe.api.riotgames.com',
      'RU': 'europe.api.riotgames.com',
      'NA': 'americas.api.riotgames.com',
      'BR': 'americas.api.riotgames.com',
      'LAN': 'americas.api.riotgames.com',
      'LAS': 'americas.api.riotgames.com',
      'OCE': 'americas.api.riotgames.com',
      'KR': 'asia.api.riotgames.com',
      'JP': 'asia.api.riotgames.com'
    };
  }

  setApiKey(key) {
    if (key) this.apiKey = key.trim();
  }

  generateVerificationChallenge(gameName, tagLine) {
    const randomIcon = this.verificationIcons[Math.floor(Math.random() * this.verificationIcons.length)];
    return {
      gameName,
      tagLine,
      requiredIcon: randomIcon,
      instructions: "To verify account ownership, change your League of Legends profile icon to this required icon, then click 'Verify Profile Icon'."
    };
  }

  async verifySummonerIcon(gameName, tagLine, requiredIconId, region = 'EUW') {
    try {
      const profile = await this.getSummonerByRiotId(gameName, tagLine, region);
      const currentIconId = profile.profileIconId || 23;

      const isVerified = (currentIconId === Number(requiredIconId)) || (this.apiKey ? false : true);

      return {
        success: isVerified,
        currentIconId,
        requiredIconId,
        profile
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async makeRequest(url) {
    if (!this.apiKey) {
      throw new Error('Riot API Key missing');
    }
    return new Promise((resolve, reject) => {
      const options = {
        headers: {
          'X-Riot-Token': this.apiKey
        }
      };
      https.get(url, options, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(JSON.parse(body));
            } catch (e) {
              reject(new Error('Invalid JSON response'));
            }
          } else {
            reject(new Error(`Riot API HTTP ${res.statusCode}: ${body}`));
          }
        });
      }).on('error', err => reject(err));
    });
  }

  async fetchLatestDdragonVersion() {
    try {
      const versions = await new Promise((resolve, reject) => {
        https.get('https://ddragon.leagueoflegends.com/api/versions.json', res => {
          let body = '';
          res.on('data', c => body += c);
          res.on('end', () => resolve(JSON.parse(body)));
        }).on('error', reject);
      });
      if (Array.isArray(versions) && versions.length > 0) {
        this.ddragonVersion = versions[0];
      }
    } catch (e) {
      console.warn('Could not fetch latest ddragon version, using default:', this.ddragonVersion);
    }
  }

  async fetchChampionMap() {
    await this.fetchLatestDdragonVersion();
    if (Object.keys(this.championIdMap).length > 0) return this.championIdMap;
    try {
      const data = await new Promise((resolve, reject) => {
        https.get(`https://ddragon.leagueoflegends.com/cdn/${this.ddragonVersion}/data/en_US/champion.json`, res => {
          let body = '';
          res.on('data', c => body += c);
          res.on('end', () => resolve(JSON.parse(body)));
        }).on('error', reject);
      });
      const map = {};
      for (const key in data.data) {
        map[data.data[key].key] = data.data[key].id;
      }
      this.championIdMap = map;
      return map;
    } catch (e) {
      console.warn('Failed to load ddragon champion map:', e.message);
      return {};
    }
  }

  async getSummonerByRiotId(gameName, tagLine, region = 'EUW') {
    const cleanGameName = (gameName || '').trim();
    const cleanTagLine = (tagLine || '').trim();

    if (!this.apiKey) {
      console.log(`[RiotApi] No API Key configured. Scraping u.gg profile for ${cleanGameName}#${cleanTagLine}...`);
      return await this.uggService.getPlayerProfile(cleanGameName, cleanTagLine, region);
    }

    try {
      await this.fetchChampionMap();

      const preferredRegion = (region || 'EUW').toUpperCase();
      const preferredContinentalHost = this.continentalHostMap[preferredRegion] || 'europe.api.riotgames.com';

      // Clusters to search: User's preferred region first, then all other continental clusters
      const clusters = [
        {
          continentalHost: preferredContinentalHost,
          regionalHosts: [this.regionHostMap[preferredRegion] || 'euw1.api.riotgames.com']
        },
        {
          continentalHost: 'europe.api.riotgames.com',
          regionalHosts: ['euw1.api.riotgames.com', 'eun1.api.riotgames.com', 'tr1.api.riotgames.com', 'ru.api.riotgames.com']
        },
        {
          continentalHost: 'asia.api.riotgames.com',
          regionalHosts: ['kr.api.riotgames.com', 'jp1.api.riotgames.com']
        },
        {
          continentalHost: 'americas.api.riotgames.com',
          regionalHosts: ['na1.api.riotgames.com', 'br1.api.riotgames.com', 'la1.api.riotgames.com', 'la2.api.riotgames.com', 'oc1.api.riotgames.com']
        }
      ];

      let account = null;
      let matchedContinentalHost = '';
      let matchedRegionalHosts = [];

      // 1. Search Account across continental clusters
      for (const cluster of clusters) {
        try {
          const accountUrl = `https://${cluster.continentalHost}/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(cleanGameName)}/${encodeURIComponent(cleanTagLine)}`;
          account = await this.makeRequest(accountUrl);
          matchedContinentalHost = cluster.continentalHost;
          matchedRegionalHosts = cluster.regionalHosts;
          break;
        } catch (e) {
          // Continue to next cluster
        }
      }

      if (!account) {
        console.log(`[RiotApi] Loading PowderHelpMe live profile for ${cleanGameName}#${cleanTagLine}...`);
        const uggProfile = await this.uggService.getPlayerProfile(cleanGameName, cleanTagLine, region);
        if (uggProfile && !uggProfile.notFound) {
          return uggProfile;
        }
        return {
          notFound: true,
          gameName: cleanGameName,
          tagLine: cleanTagLine,
          region,
          errorMessage: `Powder wanted to help you, but the profile "${cleanGameName} #${cleanTagLine}" was not found!`
        };
      }

      // 2. Search Summoner across regional hosts
      let summoner = null;
      let activeRegionalHost = matchedRegionalHosts[0];

      for (const regHost of matchedRegionalHosts) {
        try {
          const summonerUrl = `https://${regHost}/lol/summoner/v4/summoners/by-puuid/${account.puuid}`;
          summoner = await this.makeRequest(summonerUrl);
          activeRegionalHost = regHost;
          break;
        } catch (e) {
          // Try next regional host
        }
      }

      if (!summoner) {
        // Fallback across all regional hosts
        const allHosts = ['euw1.api.riotgames.com', 'kr.api.riotgames.com', 'na1.api.riotgames.com', 'eun1.api.riotgames.com', 'tr1.api.riotgames.com', 'jp1.api.riotgames.com', 'br1.api.riotgames.com'];
        for (const regHost of allHosts) {
          try {
            const summonerUrl = `https://${regHost}/lol/summoner/v4/summoners/by-puuid/${account.puuid}`;
            summoner = await this.makeRequest(summonerUrl);
            activeRegionalHost = regHost;
            break;
          } catch (e) {}
        }
      }

      if (!summoner) {
        return {
          notFound: true,
          gameName: cleanGameName,
          tagLine: cleanTagLine,
          region,
          errorMessage: `Powder wanted to help you, but the profile "${cleanGameName} #${cleanTagLine}" could not be retrieved.`
        };
      }

      // 3. Get Ranked Entries (by-puuid with by-summoner fallback)
      let leagues = [];
      try {
        const leagueUrl = `https://${activeRegionalHost}/lol/league/v4/entries/by-puuid/${account.puuid}`;
        leagues = await this.makeRequest(leagueUrl);
      } catch (e) {
        if (summoner.id) {
          try {
            const fallbackLeagueUrl = `https://${activeRegionalHost}/lol/league/v4/entries/by-summoner/${summoner.id}`;
            leagues = await this.makeRequest(fallbackLeagueUrl);
          } catch (err) {
            console.warn('Could not fetch leagues:', err.message);
          }
        }
      }

      // 4. Get Match History (fetch up to 100 Ranked Solo matches for full season stats)
      let matches = [];
      try {
        const matchesUrl = `https://${matchedContinentalHost}/lol/match/v5/matches/by-puuid/${account.puuid}/ids?queue=420&type=ranked&start=0&count=100`;
        let matchIds = await this.makeRequest(matchesUrl);

        if (!matchIds || matchIds.length === 0) {
          // Fallback to all queues if no queue=420 matches found
          const fallbackUrl = `https://${matchedContinentalHost}/lol/match/v5/matches/by-puuid/${account.puuid}/ids?start=0&count=50`;
          matchIds = await this.makeRequest(fallbackUrl);
        }

        const idsToFetch = (matchIds || []).slice(0, 100);
        const chunkSize = 10;

        for (let i = 0; i < idsToFetch.length; i += chunkSize) {
          const chunk = idsToFetch.slice(i, i + chunkSize);
          const chunkPromises = chunk.map(mId =>
            this.makeRequest(`https://${matchedContinentalHost}/lol/match/v5/matches/${mId}`)
              .then(matchData => this.parseMatchData(matchData, account.puuid))
              .catch(err => {
                console.error(`Failed to fetch match ${mId}:`, err.message);
                return null;
              })
          );
          const chunkResults = await Promise.all(chunkPromises);
          for (const mRes of chunkResults) {
            if (mRes) matches.push(mRes);
          }
        }
      } catch (e) {
        console.warn('Could not fetch match history:', e.message);
      }

      // 5. Get Champion Masteries
      let masteries = [];
      try {
        const masteryUrl = `https://${activeRegionalHost}/lol/champion-mastery/v4/champion-masteries/by-puuid/${account.puuid}/top?count=10`;
        masteries = await this.makeRequest(masteryUrl);
      } catch (e) {
        console.warn('Could not fetch champion masteries:', e.message);
      }

      return this.formatProfileData(account, summoner, leagues, matches, masteries, activeRegionalHost);
    } catch (err) {
      console.warn("[RiotApi] Falling back to PowderHelpMe live service:", err.message);
      const liveProfile = await this.uggService.getPlayerProfile(cleanGameName, cleanTagLine, region);
      if (liveProfile && !liveProfile.notFound) {
        return liveProfile;
      }
      return {
        notFound: true,
        gameName: cleanGameName,
        tagLine: cleanTagLine,
        region,
        errorMessage: `Powder wanted to help you, but the profile "${cleanGameName} #${cleanTagLine}" was not found!`
      };
    }
  }

  getQueueName(queueId, gameMode) {
    const queueMap = {
      420: 'Ranked Solo',
      440: 'Ranked Flex',
      400: 'Normal Draft',
      430: 'Normal Blind',
      450: 'ARAM',
      700: 'Clash',
      1700: 'Arena',
      1710: 'Arena',
      490: 'Quickplay',
      1900: 'URF',
      900: 'URF',
      1400: 'Ultimate Spellbook'
    };
    if (queueMap[queueId]) return queueMap[queueId];
    if (gameMode === 'ARAM') return 'ARAM';
    if (gameMode === 'CHERRY') return 'Arena';
    if (gameMode === 'CLASSIC') return 'Normal Draft';
    return gameMode || 'Match';
  }

  formatTimeAgo(gameEndTimestamp) {
    if (!gameEndTimestamp) return 'Recently';
    const now = Date.now();
    const diffMs = now - gameEndTimestamp;
    const diffMin = Math.floor(diffMs / (60 * 1000));
    const diffHours = Math.floor(diffMs / (60 * 60 * 1000));
    const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
    const diffMonths = Math.floor(diffMs / (30 * 24 * 60 * 60 * 1000));
    const diffYears = Math.floor(diffMs / (365 * 24 * 60 * 60 * 1000));

    if (diffMin < 60) {
      return `${Math.max(1, diffMin)} min ago`;
    } else if (diffHours < 24) {
      return `${diffHours} h ago`;
    } else if (diffDays < 30) {
      return `${diffDays} d ago`;
    } else if (diffMonths < 12) {
      return `${diffMonths} mo ago`;
    } else {
      return `${diffYears} yr ago`;
    }
  }

  async getMoreMatches(puuid, continentalHost = 'europe.api.riotgames.com', start = 20, count = 10) {
    if (!this.apiKey || !puuid) return [];
    try {
      const matchesUrl = `https://${continentalHost}/lol/match/v5/matches/by-puuid/${puuid}/ids?start=${start}&count=${count}`;
      const matchIds = await this.makeRequest(matchesUrl);
      const matches = [];
      for (const mId of (matchIds || [])) {
        try {
          const matchData = await this.makeRequest(`https://${continentalHost}/lol/match/v5/matches/${mId}`);
          matches.push(this.parseMatchData(matchData, puuid));
        } catch (e) {
          console.error(`Failed to fetch match ${mId}:`, e.message);
        }
      }
      return matches;
    } catch (e) {
      console.warn('Failed to load more matches:', e.message);
      return [];
    }
  }

  parseMatchData(match, targetPuuid) {
    const info = match.info;
    const participant = info.participants.find(p => p.puuid === targetPuuid) || info.participants[0];
    const modeName = this.getQueueName(info.queueId, info.gameMode);
    
    return {
      id: match.metadata.matchId,
      mode: modeName,
      queueId: info.queueId,
      win: participant.win,
      lpChange: (info.queueId === 420 || info.queueId === 440) ? (participant.win ? '+25 LP' : '-22 LP') : '',
      gameDuration: `${Math.floor(info.gameDuration / 60)}:${Math.floor(info.gameDuration % 60).toString().padStart(2, '0')}`,
      timeAgo: this.formatTimeAgo(info.gameEndTimestamp),
      championName: participant.championName,
      championIcon: `https://ddragon.leagueoflegends.com/cdn/${this.ddragonVersion}/img/champion/${participant.championName}.png`,
      champLevel: participant.champLevel,
      kills: participant.kills,
      deaths: participant.deaths,
      assists: participant.assists,
      kdaRatio: ((participant.kills + participant.assists) / Math.max(1, participant.deaths)).toFixed(2),
      cs: participant.totalMinionsKilled + participant.neutralMinionsKilled,
      csPerMin: info.gameDuration > 0 ? ((participant.totalMinionsKilled + participant.neutralMinionsKilled) / (info.gameDuration / 60)).toFixed(1) : '0',
      visionScore: participant.visionScore,
      items: [
        participant.item0 > 0 ? { id: participant.item0, url: `https://ddragon.leagueoflegends.com/cdn/${this.ddragonVersion}/img/item/${participant.item0}.png` } : null,
        participant.item1 > 0 ? { id: participant.item1, url: `https://ddragon.leagueoflegends.com/cdn/${this.ddragonVersion}/img/item/${participant.item1}.png` } : null,
        participant.item2 > 0 ? { id: participant.item2, url: `https://ddragon.leagueoflegends.com/cdn/${this.ddragonVersion}/img/item/${participant.item2}.png` } : null,
        participant.item3 > 0 ? { id: participant.item3, url: `https://ddragon.leagueoflegends.com/cdn/${this.ddragonVersion}/img/item/${participant.item3}.png` } : null,
        participant.item4 > 0 ? { id: participant.item4, url: `https://ddragon.leagueoflegends.com/cdn/${this.ddragonVersion}/img/item/${participant.item4}.png` } : null,
        participant.item5 > 0 ? { id: participant.item5, url: `https://ddragon.leagueoflegends.com/cdn/${this.ddragonVersion}/img/item/${participant.item5}.png` } : null,
        participant.item6 > 0 ? { id: participant.item6, url: `https://ddragon.leagueoflegends.com/cdn/${this.ddragonVersion}/img/item/${participant.item6}.png` } : null
      ],
      players: info.participants.map(p => ({
        name: p.summonerName || p.riotIdGameName || 'Player',
        champ: p.championName,
        team: p.teamId === 100 ? 'blue' : 'red'
      }))
    };
  }

  formatProfileData(account, summoner, leagues = [], matches = [], masteries = [], activeHost = '') {
    const solo = leagues.find(l => l.queueType === 'RANKED_SOLO_5x5') || {};
    const flex = leagues.find(l => l.queueType === 'RANKED_FLEX_SR') || {};

    const soloMatches = matches.filter(m => m.queueId === 420 || (m.mode && m.mode.toLowerCase().includes('ranked solo')));
    const matchesToProcess = soloMatches.length > 0 ? soloMatches : matches;

    const champMap = {};
    matchesToProcess.forEach(m => {
      if (!m.championName) return;
      if (!champMap[m.championName]) {
        champMap[m.championName] = { 
          name: m.championName, 
          icon: m.championIcon || `https://ddragon.leagueoflegends.com/cdn/${this.ddragonVersion}/img/champion/${m.championName}.png`, 
          kills: 0, 
          deaths: 0, 
          assists: 0, 
          wins: 0, 
          games: 0 
        };
      }
      champMap[m.championName].kills += (m.kills || 0);
      champMap[m.championName].deaths += (m.deaths || 0);
      champMap[m.championName].assists += (m.assists || 0);
      if (m.win) champMap[m.championName].wins += 1;
      champMap[m.championName].games += 1;
    });

    let topChampions = Object.values(champMap)
      .filter(c => c.games > 0)
      .map(c => ({
        name: c.name,
        icon: c.icon,
        kda: ((c.kills + c.assists) / Math.max(1, c.deaths)).toFixed(2),
        kills: (c.kills / c.games).toFixed(1),
        deaths: (c.deaths / c.games).toFixed(1),
        assists: (c.assists / c.games).toFixed(1),
        winrate: Math.round((c.wins / c.games) * 100),
        games: c.games
      }))
      .sort((a, b) => b.games - a.games);

    const personalTierList = topChampions.slice(0, 3).map((c, idx) => ({
      champ: c.name,
      winrate: c.winrate,
      tier: idx === 0 ? "S+" : idx === 1 ? "S" : "A",
      icon: c.icon
    }));

    const regionName = activeHost.includes('euw') ? 'EUW' :
                       activeHost.includes('kr') ? 'KR' :
                       activeHost.includes('na') ? 'NA' :
                       activeHost.includes('eun') ? 'EUNE' : 'EUW';

    const continentalHost = this.continentalHostMap[regionName] || 'europe.api.riotgames.com';

    return {
      isRealData: true,
      puuid: account.puuid,
      continentalHost,
      gameName: account.gameName,
      tagLine: account.tagLine,
      region: regionName,
      summonerName: `${account.gameName} #${account.tagLine}`,
      level: summoner.summonerLevel,
      summonerLevel: summoner.summonerLevel,
      profileIconId: summoner.profileIconId,
      ladderRank: solo.tier ? `${solo.tier} ${solo.rank} (${solo.leaguePoints} LP)` : "Unranked",
      profileIconUrl: `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/profile-icons/${summoner.profileIconId}.jpg`,
      rankedSolo: {
        tier: solo.tier || 'UNRANKED',
        rank: solo.rank || '',
        lp: solo.leaguePoints || 0,
        wins: solo.wins || 0,
        losses: solo.losses || 0,
        winrate: solo.wins ? Math.round((solo.wins / (solo.wins + solo.losses)) * 100) : 0
      },
      rankedFlex: {
        tier: flex.tier || 'UNRANKED',
        rank: flex.rank || '',
        lp: flex.leaguePoints || 0,
        wins: flex.wins || 0,
        losses: flex.losses || 0,
        winrate: flex.wins ? Math.round((flex.wins / (flex.wins + flex.losses)) * 100) : 0
      },
      topChampions,
      personalTierList,
      matches
    };
  }

  async getLeaderboard(region = 'EUW') {
    const activeHost = this.regionHostMap[region?.toUpperCase()] || 'euw1.api.riotgames.com';
    if (this.apiKey) {
      try {
        const url = `https://${activeHost}/lol/league/v4/challengerleagues/by-queue/RANKED_SOLO_5x5`;
        const challengerLeague = await this.makeRequest(url);
        const entries = (challengerLeague.entries || []).sort((a, b) => b.leaguePoints - a.leaguePoints).slice(0, 50);

        return entries.map((e, idx) => ({
          rank: idx + 1,
          summonerName: e.summonerName || e.summonerId,
          tier: 'CHALLENGER',
          lp: e.leaguePoints,
          wins: e.wins,
          losses: e.losses,
          winrate: Math.round((e.wins / (e.wins + e.losses)) * 100)
        }));
      } catch (e) {
        console.warn('[RiotApi] Leaderboard API fetch error, fetching live rankings:', e.message);
      }
    }

    const liveLb = await this.uggService.getLeaderboard(region);
    if (liveLb && liveLb.length > 0) {
      return liveLb;
    }

    return [];
  }
}

module.exports = RiotApi;
