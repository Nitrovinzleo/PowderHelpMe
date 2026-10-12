const https = require('https');
const { exec } = require('child_process');
const fs = require('fs');

class UggService {
  constructor() {
    this.ddragonVersion = '14.20.1';
    this.patches = ['14_20', '16_19'];
    this.champNameIdMap = {};
    this.champIdNameMap = {};
    this.championListCache = null;
    this.runesCache = null;
    this.itemsCache = null;
    this.spellsCache = null;
    this.initPromise = this.init();
  }

  async init() {
    try {
      // 1. Fetch patches
      const patchData = await this.fetchJson('https://static.bigbrain.gg/assets/lol/riot_patch_update/prod/ugg/patches.json');
      if (Array.isArray(patchData) && patchData.length > 0) {
        this.patches = patchData;
      }

      // 2. Fetch SEO champion names & IDs mapping
      const champNames = await this.fetchJson('https://static.bigbrain.gg/assets/lol/riot_patch_update/prod/seo-champion-names.json');
      if (champNames && typeof champNames === 'object') {
        this.champNameIdMap = champNames;
        Object.entries(champNames).forEach(([name, id]) => {
          this.champIdNameMap[id] = name;
        });
      }

      // 3. Fetch Data Dragon version & static datasets for item/rune metadata
      const ddragonVersions = await this.fetchJson('https://ddragon.leagueoflegends.com/api/versions.json');
      if (Array.isArray(ddragonVersions) && ddragonVersions[0]) {
        this.ddragonVersion = ddragonVersions[0];
      }

      // Fetch static Data Dragon champion list for proper titles & display names
      const ddragonChamps = await this.fetchJson(`https://ddragon.leagueoflegends.com/cdn/${this.ddragonVersion}/data/en_US/champion.json`);
      if (ddragonChamps && ddragonChamps.data) {
        this.championListCache = ddragonChamps.data;
        Object.values(ddragonChamps.data).forEach(c => {
          if (c.key) {
            this.champIdNameMap[c.key] = c.id;
            this.champNameIdMap[c.id.toLowerCase()] = parseInt(c.key, 10);
            this.champNameIdMap[c.name.toLowerCase().replace(/[^a-z0-9]/g, '')] = parseInt(c.key, 10);
          }
        });
      }

      // Fetch runes data dragon
      this.runesCache = await this.fetchJson(`https://ddragon.leagueoflegends.com/cdn/${this.ddragonVersion}/data/en_US/runesReforged.json`);
      
      // Fetch items data dragon
      const itemsData = await this.fetchJson(`https://ddragon.leagueoflegends.com/cdn/${this.ddragonVersion}/data/en_US/item.json`);
      if (itemsData && itemsData.data) {
        this.itemsCache = itemsData.data;
      }
      
      // Fetch summoner spells
      const spellsData = await this.fetchJson(`https://ddragon.leagueoflegends.com/cdn/${this.ddragonVersion}/data/en_US/summoner.json`);
      if (spellsData && spellsData.data) {
        this.spellsCache = spellsData.data;
      }

    } catch (e) {
      console.error('[UggService] Init error:', e.message);
    }
  }

  fetchJson(url) {
    return new Promise((resolve, reject) => {
      const options = {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          'Accept': 'application/json'
        }
      };
      https.get(url, options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(JSON.parse(data));
            } catch (err) {
              reject(err);
            }
          } else {
            reject(new Error(`HTTP ${res.statusCode}`));
          }
        });
      }).on('error', reject);
    });
  }

  execCurl(url) {
    return new Promise((resolve, reject) => {
      const cmd = `curl.exe -s -L -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36" "${url}"`;
      exec(cmd, { maxBuffer: 15 * 1024 * 1024 }, (error, stdout) => {
        if (error) reject(error);
        else resolve(stdout);
      });
    });
  }

  extractWindowObj(html, varName) {
    const token = `window.${varName} = `;
    const start = html.indexOf(token);
    if (start === -1) return null;
    const jsonStart = start + token.length;
    let depth = 0;
    let inString = false;
    let escape = false;
    let end = -1;

    for (let i = jsonStart; i < html.length; i++) {
      const char = html[i];
      if (escape) {
        escape = false;
        continue;
      }
      if (char === '\\') {
        escape = true;
        continue;
      }
      if (char === '"') {
        inString = !inString;
        continue;
      }
      if (!inString) {
        if (char === '{' || char === '[') depth++;
        else if (char === '}' || char === ']') {
          depth--;
          if (depth === 0) {
            end = i + 1;
            break;
          }
        }
      }
    }
    if (end !== -1) {
      const jsonStr = html.substring(jsonStart, end);
      try {
        return JSON.parse(jsonStr);
      } catch (e) {
        console.error(`[UggService] Parse window.${varName} error:`, e.message);
      }
    }
    return null;
  }

  getChampionId(championName) {
    if (!championName) return 222; // Default Jinx
    if (typeof championName === 'number') return championName;
    const clean = championName.toLowerCase().replace(/[^a-z0-9]/g, '');
    return this.champNameIdMap[clean] || this.champNameIdMap[championName.toLowerCase()] || 222;
  }

  getChampionNameById(id) {
    const champKey = this.champIdNameMap[id];
    if (champKey) return champKey;
    if (this.championListCache) {
      const found = Object.values(this.championListCache).find(c => c.key == id);
      if (found) return found.id;
    }
    return `Champion_${id}`;
  }

  getChampionIconUrl(champIdOrName) {
    let name = champIdOrName;
    if (typeof champIdOrName === 'number' || !isNaN(champIdOrName)) {
      name = this.getChampionNameById(champIdOrName);
    }
    return `https://ddragon.leagueoflegends.com/cdn/${this.ddragonVersion}/img/champion/${name}.png`;
  }

  getItemDetails(itemId) {
    if (this.itemsCache && this.itemsCache[itemId]) {
      const item = this.itemsCache[itemId];
      return {
        id: itemId,
        name: item.name,
        icon: `https://ddragon.leagueoflegends.com/cdn/${this.ddragonVersion}/img/item/${itemId}.png`,
        description: item.plaintext || item.description || ''
      };
    }
    return {
      id: itemId,
      name: `Item #${itemId}`,
      icon: `https://ddragon.leagueoflegends.com/cdn/${this.ddragonVersion}/img/item/${itemId}.png`,
      description: ''
    };
  }

  getRuneDetails(runeId) {
    let runeName = `Rune #${runeId}`;
    if (this.runesCache) {
      for (const tree of this.runesCache) {
        if (tree.id === runeId) {
          return { id: runeId, name: tree.name, icon: `https://ddragon.canisback.com/img/${tree.icon}` };
        }
        for (const slot of tree.slots) {
          for (const rune of slot.runes) {
            if (rune.id === runeId) {
              return { id: runeId, name: rune.name, icon: `https://ddragon.canisback.com/img/${rune.icon}` };
            }
          }
        }
      }
    }
    return { id: runeId, name: runeName, icon: '' };
  }

  /**
   * Fetch Champion Build, Runes, Items, Skill Order from u.gg
   * Fetch Champion Build, Runes, Items, Skill Order, Role & Matchup
   */
  async getChampionBuild(championName, role = 'auto', opponentName = '') {
    await this.initPromise;
    const champId = this.getChampionId(championName);
    const champCleanName = this.getChampionNameById(champId);

    const roleMap = {
      'jungle': '1',
      'support': '2',
      'supp': '2',
      'mid': '3',
      'top': '4',
      'adc': '5',
      'bot': '5',
      'auto': '7'
    };

    const targetRoleId = roleMap[String(role).toLowerCase()] || '7';
    const candidatePatches = ['14_20', '16_19', '16_18', '14_19'];

    for (const patch of candidatePatches) {
      try {
        const url = `https://stats2.u.gg/lol/1.5/overview/${patch}/ranked_solo_5x5/${champId}/1.5.0.json`;
        const overview = await this.fetchJson(url);

        const tierKey = overview['12'] ? '12' : (overview['1'] ? '1' : Object.keys(overview)[0]);
        const rolesData = overview[tierKey] || {};

        let selectedRoleData = rolesData[targetRoleId] || rolesData['7'] || rolesData[Object.keys(rolesData)[0]];
        if (!selectedRoleData) continue;

        const rawBuild = (selectedRoleData['1'] && selectedRoleData['1'][0]) ? selectedRoleData['1'][0] : (selectedRoleData[Object.keys(selectedRoleData)[0]][0]);

        if (!rawBuild) continue;

        const runesData = rawBuild[0] || [];
        const spellsData = rawBuild[1] || [];
        const startingItemsData = rawBuild[2] || [];
        const coreItemsData = rawBuild[3] || [];
        const skillOrderData = rawBuild[4] || [];
        const situationalData = rawBuild[5] || [];
        const statShardsData = rawBuild[8] || [];

        const primaryTreeId = runesData[2];
        const secondaryTreeId = runesData[3];
        const selectedRuneIds = runesData[4] || [];
        const formattedRunes = {
          primaryTree: this.getRuneDetails(primaryTreeId),
          secondaryTree: this.getRuneDetails(secondaryTreeId),
          runes: selectedRuneIds.map(id => this.getRuneDetails(id)),
          shards: (statShardsData[2] || []).map(id => ({ id, icon: `https://ddragon.leagueoflegends.com/cdn/img/perk-images/StatMods/StatMods${id}.png` }))
        };

        const startingItems = (startingItemsData[2] || []).map(id => this.getItemDetails(id));
        const coreItems = (coreItemsData[2] || []).map(id => this.getItemDetails(id));
        
        const situationalItems = [];
        if (Array.isArray(situationalData)) {
          situationalData.forEach(group => {
            if (Array.isArray(group)) {
              group.forEach(itemInfo => {
                if (Array.isArray(itemInfo) && itemInfo[0]) {
                  situationalItems.push(this.getItemDetails(itemInfo[0]));
                }
              });
            }
          });
        }

        const spellIds = spellsData[2] || [];
        const spells = spellIds.map(id => {
          let spellKey = 'SummonerFlash';
          if (id === 14) spellKey = 'SummonerDot';
          else if (id === 12) spellKey = 'SummonerTeleport';
          else if (id === 11) spellKey = 'SummonerSmite';
          else if (id === 21) spellKey = 'SummonerBarrier';
          else if (id === 7) spellKey = 'SummonerHeal';
          else if (id === 3) spellKey = 'SummonerExhaust';
          else if (id === 6) spellKey = 'SummonerHaste';
          else if (id === 1) spellKey = 'SummonerBoost';
          return {
            id,
            name: spellKey,
            icon: `https://ddragon.leagueoflegends.com/cdn/${this.ddragonVersion}/img/spell/${spellKey}.png`
          };
        });

        const skillPath = skillOrderData[2] || [];
        const skillMaxOrder = skillOrderData[3] || 'QWE';

        // Counter item injection based on opponent archetype
        if (opponentName && Array.isArray(situationalItems)) {
          const oppLower = opponentName.toLowerCase();
          const apEnemies = ['syndra', 'lux', 'ahri', 'veigar', 'fizz', 'leblanc', 'ekko', 'vladimir', 'cassiopeia', 'xerath', 'hwei', 'brand', 'evelynn', 'katarina'];
          const healEnemies = ['darius', 'garen', 'aatrox', 'mundo', 'warwick', 'sylas', 'swain', 'illaoi', 'yuumi', 'soraka', 'briar'];
          const adAssassins = ['zed', 'talon', 'qiyana', 'khazix', 'rengar', 'naafiri', 'pyke', 'shaco', 'pantheon'];

          if (apEnemies.some(a => oppLower.includes(a))) {
            const maw = this.getItemDetails(3156);
            if (maw && !situationalItems.some(i => i.id === 3156)) situationalItems.unshift(maw);
          } else if (healEnemies.some(a => oppLower.includes(a))) {
            const mortal = this.getItemDetails(3033);
            if (mortal && !situationalItems.some(i => i.id === 3033)) situationalItems.unshift(mortal);
          } else if (adAssassins.some(a => oppLower.includes(a))) {
            const ga = this.getItemDetails(3026);
            if (ga && !situationalItems.some(i => i.id === 3026)) situationalItems.unshift(ga);
          }
        }

        // Matchup calculation using real u.gg matchup database
        let matchup = null;
        if (opponentName && opponentName.trim() !== '') {
          const oppChampId = this.getChampionId(opponentName);
          if (oppChampId) {
            const oppCleanName = this.getChampionNameById(oppChampId);
            const oppIcon = this.getChampionIconUrl(oppCleanName);

            const realMatchupData = await this.fetchRealMatchupData(champId, targetRoleId, oppChampId);
            
            if (realMatchupData) {
              const winRateVal = realMatchupData.winRate;
              const totalMatchesCount = realMatchupData.totalGames;
              const goldDiff = realMatchupData.avgGoldDiff15;

              const winRateNum = parseFloat(winRateVal);
              const isFav = winRateNum >= 51.5;
              const isHard = winRateNum <= 48.5;

              const goldDiffText = goldDiff > 0 ? `+${goldDiff} Or @ 15m` : `${goldDiff} Or @ 15m`;

              matchup = {
                opponent: {
                  id: oppChampId,
                  name: oppCleanName,
                  icon: oppIcon
                },
                winRate: winRateVal,
                totalGames: totalMatchesCount,
                goldDiff: goldDiffText,
                label: isFav ? 'Matchup Avantageux (Favori)' : isHard ? 'Matchup Difficile (Counter)' : 'Matchup Équilibré (50/50)',
                color: isFav ? '#2ecc71' : isHard ? '#e63946' : 'var(--powder-gold)',
                tips: this.generateTacticalTips(champCleanName, oppCleanName, role, winRateVal, goldDiffText)
              };
            } else {
              matchup = {
                opponent: {
                  id: oppChampId,
                  name: oppCleanName,
                  icon: oppIcon
                },
                winRate: 'N/A',
                totalGames: 0,
                goldDiff: 'N/A',
                label: 'Données Insuffisantes',
                color: 'var(--text-muted)',
                tips: [
                  `Aucune confrontation enregistrée pour ce rôle sur le patch actuel.`,
                  `Consultez la fiche générale du champion et adaptez vos items de départ.`
                ]
              };
            }
          }
        }

        const roleDisplayNames = {
          '1': 'JUNGLE',
          '2': 'SUPPORT',
          '3': 'MID',
          '4': 'TOP',
          '5': 'ADC',
          '7': 'MAIN ROLE'
        };

        return {
          champion: {
            id: champId,
            name: champCleanName,
            icon: this.getChampionIconUrl(champCleanName)
          },
          role: roleDisplayNames[targetRoleId] || 'MAIN ROLE',
          matchup,
          patch: patch.replace('_', '.'),
          runes: formattedRunes,
          startingItems,
          coreItems,
          situationalItems: situationalItems.slice(0, 6),
          spells,
          skillPath,
          skillMaxOrder
        };
      } catch (err) {
        // Try next candidate patch
      }
    }

    console.error(`[UggService] Failed to get build for ${championName}`);
    return null;
  }

  /**
   * Fetch real matchup statistics from u.gg database for a specific champion vs opponent
   */
  async fetchRealMatchupData(champId, targetRoleId = '5', oppChampId = null) {
    if (!oppChampId) return null;
    const candidatePatches = ['14_20', '16_19', '16_18', '14_19'];

    for (const patch of candidatePatches) {
      try {
        const url = `https://stats2.u.gg/lol/1.5/matchups/${patch}/ranked_solo_5x5/${champId}/1.5.0.json`;
        const data = await this.fetchJson(url);
        if (!data) continue;

        const tierKey = data['12'] ? '12' : (data['1'] ? '1' : Object.keys(data)[0]);
        const rolesData = data[tierKey] || {};
        const roleMatchupsObj = rolesData[targetRoleId] || rolesData['5'] || rolesData[Object.keys(rolesData)[0]];
        if (!roleMatchupsObj) continue;

        const matchupsListWrapper = roleMatchupsObj['3'] || roleMatchupsObj['1'] || roleMatchupsObj[Object.keys(roleMatchupsObj)[0]];
        const matchupsList = Array.isArray(matchupsListWrapper) ? (Array.isArray(matchupsListWrapper[0]) ? matchupsListWrapper[0] : matchupsListWrapper) : [];

        const matchEntry = matchupsList.find(e => Array.isArray(e) && e[0] === oppChampId);
        if (matchEntry) {
          const oppWins = matchEntry[1] || 0;
          const totalGames = matchEntry[2] || 0;
          if (totalGames === 0) continue;

          const champWins = totalGames > oppWins ? (totalGames - oppWins) : oppWins;
          const winRate = ((champWins / totalGames) * 100).toFixed(1);
          const rawGoldDiff = matchEntry[3] || 0;
          const avgGoldDiff15 = Math.round(rawGoldDiff / totalGames);
          const rawXpDiff = matchEntry[4] || 0;
          const avgXpDiff15 = Math.round(rawXpDiff / totalGames);

          return {
            patch: patch.replace('_', '.'),
            champWins,
            oppWins,
            totalGames,
            winRate,
            avgGoldDiff15,
            avgXpDiff15
          };
        }
      } catch (err) {
        // try next patch
      }
    }
    return null;
  }

  generateTacticalTips(champName, oppName, role, winRate, goldDiffText) {
    const oppLower = (oppName || '').toLowerCase();
    const champLower = (champName || '').toLowerCase();
    const tips = [];

    const assassins = ['zed', 'fizz', 'akali', 'katarina', 'kat', 'talon', 'leblanc', 'syndra', 'qiyana', 'khazix', 'rengar', 'evelynn', 'nocturne', 'kayn', 'shaco', 'pyke', 'pantheon'];
    const pokeRange = ['caitlyn', 'lux', 'xerath', 'jayce', 'varus', 'ziggs', 'velkoz', 'zoe', 'kaisa', 'ezreal', 'hwei', 'brand'];
    const tanksHealers = ['darius', 'garen', 'malphite', 'aatrox', 'drmundo', 'mundo', 'warwick', 'sylas', 'swain', 'illaoi', 'volibear', 'yuumi', 'soraka', 'taric', 'zac', 'ksante', 'ornn', 'shen'];
    const hardCC = ['blitzcrank', 'blitz', 'nautilus', 'leona', 'thresh', 'mordekaiser', 'morgana', 'amumu', 'sejuani', 'malzahar', 'veigar'];

    const isVsAssassin = assassins.some(a => oppLower.includes(a));
    const isVsPoke = pokeRange.some(a => oppLower.includes(a));
    const isVsTankHeal = tanksHealers.some(a => oppLower.includes(a));
    const isVsCC = hardCC.some(a => oppLower.includes(a));

    if (isVsAssassin) {
      tips.push(`Gestion des bursts (${oppName}) : Conservez vos sorts de contrôle ou de mobilité uniquement pour interrompre son all-in. Prévoyez des résistances défensives (Hexdrinker/GA).`);
    } else if (isVsPoke) {
      tips.push(`Gestion de la portée vs ${oppName} : Évitez les trades au niveau 1-2. Conservez vos potions et laissez pousser la vague pour engager avec votre jungler.`);
    } else if (isVsTankHeal) {
      tips.push(`Anti-Sustain vs ${oppName} : Achetez un objet de réduction de soin (Marque du bourreau / Orbe d'oubli) dès le 1er retour en base pour couper sa régénération.`);
    } else if (isVsCC) {
      tips.push(`Discipline de placement vs ${oppName} : Gardez constamment la vague de sbires entre vous et lui. Conservez votre Saut Éclair pour esquiver l'engagement initial.`);
    } else {
      tips.push(`Fenêtres d'échange vs ${oppName} : Profitez de vos Power Spikes aux niveaux 2, 3 et 6 pour forcer des trades avantageux.`);
    }

    if (goldDiffText) {
      tips.push(`Écart d'Or moyen à 15 min en lane : ${goldDiffText}. Ajustez la prise de risque sur la première tour.`);
    }

    if (oppLower.includes('caitlyn')) {
      tips.push(`Spécifique Caitlyn : Attention à son tir Headshot et ses pièges placés dans les buissons. Ne poussez pas sous sa tour sans vision.`);
    } else if (oppLower.includes('zed')) {
      tips.push(`Spécifique Zed : Quand son Z (Ombre) est en recharge (~20s), il perd toute sa mobilité et devient très vulnérable aux ganks.`);
    } else if (oppLower.includes('yasuo') || oppLower.includes('yone')) {
      tips.push(`Spécifique ${oppName} : Faites sauter son bouclier passif avec une attaque basique avant de lancer votre combo complet.`);
    } else if (oppLower.includes('darius')) {
      tips.push(`Spécifique Darius : Évitez impérativement les échanges prolongés (5 charges de sa saignée = fatal). Raccourcissez au maximum les trades.`);
    } else if (oppLower.includes('malphite')) {
      tips.push(`Spécifique Malphite : Conservez toujours un sort de saut/flash pour répondre à son ultime Force Inarrêtable au niveau 6.`);
    } else if (oppLower.includes('blitz')) {
      tips.push(`Spécifique Blitzcrank : S'il manque son Grappin (A), vous disposez de 20 secondes de domination totale en lane.`);
    } else {
      tips.push(`Synergie d'Objets : Adaptez votre 3ème objet selon la menace principale dominante dans l'équipe adverse.`);
    }

    return tips;
  }

  /**
   * Fetch Champion Tier List (Win rate, Pick rate, Ban rate, Rank Tier)
   */
  async getChampionTierList(tier = 'emerald_plus') {
    await this.initPromise;
    const candidatePatches = ['14_20', '16_19', '16_18', '14_19'];

    for (const patch of candidatePatches) {
      try {
        const url = `https://stats2.u.gg/lol/1.5/champion_ranking/world/${patch}/ranked_solo_5x5/${tier}/1.5.0.json`;
        const data = await this.fetchJson(url);

        if (!data || !data[0]) continue;

        const rolesMap = data[0]; // { adc, jungle, mid, supp, top }
        const tierList = [];

        Object.entries(rolesMap).forEach(([roleKey, champsArray]) => {
          const roleDisplayName = roleKey === 'adc' ? 'ADC' : (roleKey.charAt(0).toUpperCase() + roleKey.slice(1));

          if (Array.isArray(champsArray)) {
            champsArray.forEach(item => {
              if (Array.isArray(item) && item.length >= 4) {
                const champIdStr = item[0];
                const champId = parseInt(champIdStr, 10);
                const champName = this.getChampionNameById(champId);
                const matchesWon = item[2] || 0;
                const matchesTotal = item[3] || 1;

                const winRateVal = ((matchesWon / matchesTotal) * 100);
                const winRateStr = `${winRateVal.toFixed(1)}%`;

                let tierRank = 'A';
                if (winRateVal >= 53.0) tierRank = 'S+';
                else if (winRateVal >= 51.5) tierRank = 'S';
                else if (winRateVal >= 49.5) tierRank = 'A';
                else if (winRateVal >= 48.0) tierRank = 'B';
                else tierRank = 'C';

                tierList.push({
                  championId: champId,
                  name: champName,
                  icon: this.getChampionIconUrl(champName),
                  role: roleDisplayName,
                  tier: tierRank,
                  winRate: winRateStr,
                  matchesTotal,
                  winRateNumeric: winRateVal
                });
              }
            });
          }
        });

        if (tierList.length > 0) {
          tierList.sort((a, b) => b.winRateNumeric - a.winRateNumeric);
          return tierList;
        }
      } catch (err) {
        // Try next patch
      }
    }

    return [];
  }

  /**
   * Fetch Player Profile & Recent Match History from u.gg
   */
  /**
   * Fetch Player Profile & Recent Match History from u.gg
   */
  async getPlayerProfile(gameName, tagLine, region = 'EUW') {
    await this.initPromise;
    const regionCodeMap = {
      'EUW': 'euw1',
      'NA': 'na1',
      'EUNE': 'eun1',
      'KR': 'kr',
      'BR': 'br1',
      'LAN': 'la1',
      'LAS': 'la2',
      'OCE': 'oc1',
      'TR': 'tr1',
      'RU': 'ru',
      'JP': 'jp1'
    };

    const regCode = regionCodeMap[region.toUpperCase()] || 'euw1';
    const profileUrl = `https://u.gg/lol/profile/${regCode}/${encodeURIComponent(gameName)}-${encodeURIComponent(tagLine)}/overview`;

    try {
      const html = await this.execCurl(profileUrl);
      const apolloState = this.extractWindowObj(html, '__APOLLO_STATE__');

      if (!apolloState) {
        throw new Error('Could not parse u.gg Apollo state from profile page');
      }

      const rootQuery = apolloState['ROOT_QUERY'] || {};
      let summonerData = null;
      let rankedSolo = null;
      let rankedFlex = null;
      const topChampions = [];

      // 1. Extract player info & ranks from ROOT_QUERY
      Object.keys(rootQuery).forEach(key => {
        if (key.startsWith('profileInitSimple')) {
          const initData = rootQuery[key];
          if (initData && initData.playerInfo) {
            summonerData = initData.playerInfo;
          }
        } else if (key.startsWith('fetchProfileRanks')) {
          const ranksObj = rootQuery[key];
          const rankScores = ranksObj?.rankScores || [];
          rankScores.forEach(r => {
            if (r.queueType === 'ranked_solo_5x5') {
              rankedSolo = r;
            } else if (r.queueType === 'ranked_flex_sr') {
              rankedFlex = r;
            }
          });
        } else if (key.startsWith('fetchPlayerStatistics')) {
          const statsArray = rootQuery[key] || [];
          if (Array.isArray(statsArray)) {
            statsArray.forEach(statGroup => {
              const performances = statGroup?.basicChampionPerformances || (Array.isArray(statGroup) ? statGroup : []);
              performances.forEach(item => {
                if (item && item.championId) {
                  const champId = item.championId;
                  const champName = this.getChampionNameById(champId);
                  const wins = item.wins || 0;
                  const matches = item.totalMatches || (wins + (item.losses || 0)) || 1;
                  const kills = item.kills || 0;
                  const deaths = item.deaths || 0;
                  const assists = item.assists || 0;
                  const wrVal = matches ? Math.round((wins / matches) * 100) : 0;
                  const kdaVal = deaths > 0 ? ((kills + assists) / deaths).toFixed(2) : ((kills + assists) > 0 ? '3.50' : '2.50');

                  topChampions.push({
                    championId: champId,
                    name: champName,
                    icon: this.getChampionIconUrl(champName),
                    games: matches,
                    totalMatches: matches,
                    wins: wins,
                    kills: (kills / matches).toFixed(1),
                    deaths: (deaths / matches).toFixed(1),
                    assists: (assists / matches).toFixed(1),
                    kda: kdaVal,
                    cs: Math.round((item.cs || 0) / matches),
                    damage: Math.round((item.damage || 0) / matches),
                    winrate: wrVal
                  });
                }
              });
            });
          }
        }
      });

      // Direct fallback to scan top-level apolloState if rootQuery keys weren't found
      if (!summonerData || (!rankedSolo && !rankedFlex)) {
        Object.entries(apolloState).forEach(([key, val]) => {
          if (!val || typeof val !== 'object') return;
          const typename = val.__typename || '';
          if (typename === 'PlayerInfo' || typename === 'Summoner' || key.includes('Summoner:')) {
            if (!summonerData) summonerData = val;
          } else if (typename === 'RankScore' || typename === 'RankedTier') {
            if (val.queueType === 'ranked_solo_5x5' || val.queueType === 420) {
              if (!rankedSolo) rankedSolo = val;
            } else if (val.queueType === 'ranked_flex_sr' || val.queueType === 440) {
              if (!rankedFlex) rankedFlex = val;
            }
          }
        });
      }

      const iconId = summonerData?.iconId || summonerData?.profileIconId || 23;
      const formatTier = (rawTier) => {
        if (!rawTier || rawTier.toUpperCase() === 'UNRANKED') return 'Unranked';
        return rawTier.charAt(0).toUpperCase() + rawTier.slice(1).toLowerCase();
      };

      const formatDivision = (rawRank) => {
        if (!rawRank) return '';
        const clean = String(rawRank).trim().toUpperCase();
        if (clean === '1' || clean === 'I') return 'I';
        if (clean === '2' || clean === 'II') return 'II';
        if (clean === '3' || clean === 'III') return 'III';
        if (clean === '4' || clean === 'IV') return 'IV';
        return clean;
      };

      const soloWins = rankedSolo?.wins || 0;
      const soloLosses = rankedSolo?.losses || 0;
      const soloTotal = soloWins + soloLosses;
      const soloWr = soloTotal > 0 ? `${Math.round((soloWins / soloTotal) * 100)}%` : '0%';

      const flexWins = rankedFlex?.wins || 0;
      const flexLosses = rankedFlex?.losses || 0;
      const flexTotal = flexWins + flexLosses;
      const flexWr = flexTotal > 0 ? `${Math.round((flexWins / flexTotal) * 100)}%` : '0%';

      const displayGameName = summonerData?.riotUserName || gameName;
      const displayTagLine = summonerData?.riotTagLine || tagLine;

      const initialSortedChamps = topChampions.sort((a, b) => b.totalMatches - a.totalMatches).slice(0, 8);

      const badges = [];
      const tags = [];

      const soloTierUpper = (rankedSolo?.tier || '').toUpperCase();
      const soloWrNum = soloTotal > 0 ? Math.round((soloWins / soloTotal) * 100) : 0;

      if (['CHALLENGER', 'GRANDMASTER', 'MASTER'].includes(soloTierUpper)) {
        badges.push({ text: `👑 ${formatTier(rankedSolo?.tier)}`, color: '#ff4757', bg: 'rgba(255, 71, 87, 0.2)' });
      } else if (['DIAMOND', 'EMERALD'].includes(soloTierUpper)) {
        badges.push({ text: `💎 ${formatTier(rankedSolo?.tier)}`, color: '#70a1ff', bg: 'rgba(112, 161, 255, 0.2)' });
      } else if (rankedSolo?.tier) {
        badges.push({ text: `⚔️ ${formatTier(rankedSolo?.tier)} ${formatDivision(rankedSolo?.rank)}`, color: '#eccc68', bg: 'rgba(236, 204, 104, 0.2)' });
      }

      if (soloWrNum >= 60) {
        tags.push({ text: `🔥 High Win Rate (${soloWrNum}%)`, color: '#ff6b81', bg: 'rgba(255, 107, 129, 0.2)' });
      } else if (soloWrNum >= 53) {
        tags.push({ text: `📈 Consistent Climber (${soloWrNum}%)`, color: '#2ed573', bg: 'rgba(46, 213, 115, 0.2)' });
      }

      if (initialSortedChamps.length > 0 && initialSortedChamps[0].totalMatches >= 10) {
        const topC = initialSortedChamps[0];
        badges.push({ text: `🎯 OTP ${topC.name} (${topC.totalMatches}g)`, color: '#1e90ff', bg: 'rgba(30, 144, 255, 0.2)' });
      }

      const playerLvl = summonerData?.summonerLevel || 1;
      if (playerLvl >= 300) {
        tags.push({ text: `⭐ Veteran (Lvl ${playerLvl})`, color: '#ffa502', bg: 'rgba(255, 165, 2, 0.2)' });
      }

      const recentMatches = await this.getRecentMatches(displayGameName, displayTagLine, region);

      const combinedChamps = await this.fetchPlayerChampionStats(displayGameName, displayTagLine, region);
      const finalSortedChamps = combinedChamps.length > 0 ? combinedChamps : topChampions.sort((a, b) => b.totalMatches - a.totalMatches);

      return {
        gameName: displayGameName,
        tagLine: displayTagLine,
        region: region,
        profileIconUrl: `https://ddragon.leagueoflegends.com/cdn/${this.ddragonVersion}/img/profileicon/${iconId}.png`,
        profileIconId: iconId,
        level: playerLvl,
        summonerLevel: playerLvl,
        rankedSolo: {
          tier: rankedSolo?.tier ? formatTier(rankedSolo.tier) : 'Unranked',
          rank: formatDivision(rankedSolo?.rank),
          lp: rankedSolo?.lp !== undefined ? rankedSolo.lp : 0,
          wins: soloWins,
          losses: soloLosses,
          winrate: soloWr
        },
        rankedFlex: {
          tier: rankedFlex?.tier ? formatTier(rankedFlex.tier) : 'Unranked',
          rank: formatDivision(rankedFlex?.rank),
          lp: rankedFlex?.lp !== undefined ? rankedFlex.lp : 0,
          wins: flexWins,
          losses: flexLosses,
          winrate: flexWr
        },
        topChampions: finalSortedChamps,
        badges,
        tags,
        recentMatches: recentMatches,
        matches: recentMatches,
        source: 'PowderHelpMe'
      };

    } catch (err) {
      console.error(`[UggService] Failed to fetch profile for ${gameName}#${tagLine}:`, err.message);
      return {
        notFound: true,
        gameName,
        tagLine,
        region,
        errorMessage: `Powder wanted to help you, but the profile "${gameName} #${tagLine}" could not be found!`
      };
    }
  }

  async requestProfileUpdate(gameName, tagLine, region = 'EUW') {
    const regionCodeMap = {
      'EUW': 'euw1', 'NA': 'na1', 'EUNE': 'eun1', 'KR': 'kr',
      'BR': 'br1', 'LAN': 'la1', 'LAS': 'la2', 'OCE': 'oc1',
      'TR': 'tr1', 'RU': 'ru', 'JP': 'jp1'
    };
    const regCode = regionCodeMap[region.toUpperCase()] || 'euw1';
    const query = `
      query updatePlayerProfile($regionId: String!, $riotUserName: String!, $riotTagLine: String!) {
        updatePlayerProfile(regionId: $regionId, riotUserName: $riotUserName, riotTagLine: $riotTagLine) {
          success
          errorReason
        }
      }
    `;

    const payload = JSON.stringify({
      operationName: 'updatePlayerProfile',
      variables: {
        regionId: regCode,
        riotUserName: gameName,
        riotTagLine: tagLine
      },
      query
    });

    return new Promise(resolve => {
      const req = https.request({
        hostname: 'u.gg',
        path: '/api',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          'Content-Length': Buffer.byteLength(payload)
        }
      }, res => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            console.log(`[UggService] u.gg updatePlayerProfile triggered for ${gameName}#${tagLine}:`, json);
            resolve(json?.data?.updatePlayerProfile?.success || false);
          } catch (e) {
            resolve(false);
          }
        });
      });
      req.on('error', () => resolve(false));
      req.write(payload);
      req.end();
    });
  }

  async getLeaderboard(region = 'EUW', page = 1) {
    const regionCodeMap = {
      'EUW': 'euw1', 'NA': 'na1', 'EUNE': 'eun1', 'KR': 'kr',
      'BR': 'br1', 'LAN': 'la1', 'LAS': 'la2', 'OCE': 'oc1',
      'TR': 'tr1', 'RU': 'ru', 'JP': 'jp1'
    };
    const regCode = regionCodeMap[region.toUpperCase()] || 'euw1';

    const query = `
      query leaderboardPage($page: Int!, $queueType: Int!, $regionId: String!) {
        leaderboardPage(page: $page, queueType: $queueType, regionId: $regionId) {
          totalPlayerCount
          players {
            overallRanking
            riotUserName
            riotTagLine
            tier
            rank
            lp
            wins
            losses
            iconId
            summonerLevel
          }
        }
      }
    `;

    const payload = JSON.stringify({
      operationName: 'leaderboardPage',
      variables: { page: Number(page) || 1, queueType: 420, regionId: regCode },
      query
    });

    return new Promise(resolve => {
      const req = https.request({
        hostname: 'u.gg',
        path: '/api',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          'Content-Length': Buffer.byteLength(payload)
        }
      }, res => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            const rawPlayers = json?.data?.leaderboardPage?.players || [];
            const formatted = rawPlayers.map(p => {
              const wins = Number(p.wins || 0);
              const losses = Number(p.losses || 0);
              const total = wins + losses;
              const wr = total > 0 ? Math.round((wins / total) * 100) : 0;
              const tierFormatted = p.tier ? p.tier.charAt(0).toUpperCase() + p.tier.slice(1).toLowerCase() : 'Challenger';

              return {
                rank: p.overallRanking || 1,
                name: p.riotUserName || 'Summoner',
                tag: p.riotTagLine || '',
                gameName: p.riotUserName,
                tagLine: p.riotTagLine,
                summonerName: p.riotTagLine ? `${p.riotUserName} #${p.riotTagLine}` : (p.riotUserName || 'Summoner'),
                tier: tierFormatted,
                lp: Number(p.lp || 0),
                wins,
                losses,
                winrate: wr,
                level: p.summonerLevel || 100,
                iconUrl: `https://ddragon.leagueoflegends.com/cdn/${this.ddragonVersion}/img/profileicon/${p.iconId || 23}.png`
              };
            });
            resolve(formatted);
          } catch (e) {
            console.error('[UggService] Parse leaderboard error:', e.message);
            resolve([]);
          }
        });
      });
      req.on('error', (err) => {
        console.error('[UggService] Leaderboard request error:', err.message);
        resolve([]);
      });
      req.write(payload);
      req.end();
    });
  }

  async fetchPlayerChampionStats(gameName, tagLine, region = 'EUW') {
    const regionCodeMap = {
      'EUW': 'euw1', 'NA': 'na1', 'EUNE': 'eun1', 'KR': 'kr',
      'BR': 'br1', 'LAN': 'la1', 'LAS': 'la2', 'OCE': 'oc1',
      'TR': 'tr1', 'RU': 'ru', 'JP': 'jp1'
    };
    const regCode = regionCodeMap[region.toUpperCase()] || 'euw1';
    const targetQueues = [420, 440, 400, 480, 490];

    const query = `
      query fetchPlayerStatistics($regionId: String!, $riotUserName: String!, $riotTagLine: String!, $queueType: [Int], $role: Int!, $seasonId: Int) {
        fetchPlayerStatistics(regionId: $regionId, riotUserName: $riotUserName, riotTagLine: $riotTagLine, queueType: $queueType, role: $role, seasonId: $seasonId) {
          queueType
          basicChampionPerformances {
            championId
            totalMatches
            wins
            kills
            deaths
            assists
            cs
            damage
          }
        }
      }
    `;

    const fetchQueue = (qId) => {
      const payload = JSON.stringify({
        operationName: 'fetchPlayerStatistics',
        variables: {
          regionId: regCode,
          riotUserName: gameName,
          riotTagLine: tagLine,
          queueType: [qId],
          role: 7,
          seasonId: 26
        },
        query
      });

      return new Promise(resolve => {
        const req = https.request({
          hostname: 'u.gg',
          path: '/api',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
            'Content-Length': Buffer.byteLength(payload)
          }
        }, res => {
          let data = '';
          res.on('data', c => data += c);
          res.on('end', () => {
            try {
              const json = JSON.parse(data);
              const perfs = json?.data?.fetchPlayerStatistics?.[0]?.basicChampionPerformances || [];
              resolve(perfs);
            } catch (e) {
              resolve([]);
            }
          });
        });
        req.on('error', () => resolve([]));
        req.write(payload);
        req.end();
      });
    };

    try {
      const results = await Promise.all(targetQueues.map(qId => fetchQueue(qId)));
      const champMap = {};

      results.forEach(perfs => {
        (perfs || []).forEach(p => {
          if (!p || !p.championId) return;
          const cId = p.championId;
          const matches = p.totalMatches || (p.wins + (p.losses || 0)) || 1;
          if (!champMap[cId]) {
            champMap[cId] = {
              championId: cId,
              totalMatches: 0,
              wins: 0,
              kills: 0,
              deaths: 0,
              assists: 0,
              cs: 0,
              damage: 0
            };
          }
          const entry = champMap[cId];
          entry.totalMatches += matches;
          entry.wins += (p.wins || 0);
          entry.kills += (p.kills || 0);
          entry.deaths += (p.deaths || 0);
          entry.assists += (p.assists || 0);
          entry.cs += (p.cs || 0);
          entry.damage += (p.damage || 0);
        });
      });

      const combined = Object.values(champMap).map(c => {
        const matches = c.totalMatches;
        const champName = this.getChampionNameById(c.championId);
        const wr = matches > 0 ? Math.round((c.wins / matches) * 100) : 0;
        const avgK = (c.kills / matches).toFixed(1);
        const avgD = (c.deaths / matches).toFixed(1);
        const avgA = (c.assists / matches).toFixed(1);
        const kda = c.deaths > 0 ? ((c.kills + c.assists) / c.deaths).toFixed(2) : ((c.kills + c.assists) > 0 ? '3.50' : '2.00');

        return {
          championId: c.championId,
          name: champName,
          icon: this.getChampionIconUrl(champName),
          games: matches,
          totalMatches: matches,
          wins: c.wins,
          kills: avgK,
          deaths: avgD,
          assists: avgA,
          kda: kda,
          cs: Math.round(c.cs / matches),
          damage: Math.round(c.damage / matches),
          winrate: wr
        };
      }).sort((a, b) => b.totalMatches - a.totalMatches);

      if (combined.length > 0) return combined;
    } catch (e) {
      console.warn('[UggService] fetchPlayerChampionStats error:', e.message);
    }
    return [];
  }

  formatTimeAgo(timestamp) {
    if (!timestamp) return 'Recently';
    const now = Date.now();
    const diffMs = now - timestamp;
    const diffMin = Math.floor(diffMs / (60 * 1000));
    const diffHours = Math.floor(diffMs / (60 * 60 * 1000));
    const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
    const diffMonths = Math.floor(diffMs / (30 * 24 * 60 * 60 * 1000));

    if (diffMin < 60) {
      return `${Math.max(1, diffMin)} min ago`;
    } else if (diffHours < 24) {
      return `${diffHours} h ago`;
    } else if (diffDays < 30) {
      return `${diffDays} d ago`;
    } else {
      return `${diffMonths} mo ago`;
    }
  }

  /**
   * Send a Profile Refresh/Update mutation request to u.gg GraphQL API
   */
  async requestProfileUpdate(gameName, tagLine, region = 'EUW') {
    await this.initPromise;
    const regionCodeMap = {
      'EUW': 'euw1', 'NA': 'na1', 'EUNE': 'eun1', 'KR': 'kr',
      'BR': 'br1', 'LAN': 'la1', 'LAS': 'la2', 'OCE': 'oc1',
      'TR': 'tr1', 'RU': 'ru', 'JP': 'jp1'
    };
    const regCode = regionCodeMap[region.toUpperCase()] || 'euw1';

    const query = `
      mutation updatePlayerProfile($regionId: String!, $riotUserName: String!, $riotTagLine: String!) {
        updatePlayerProfile(regionId: $regionId, riotUserName: $riotUserName, riotTagLine: $riotTagLine)
      }
    `;

    try {
      const payload = {
        operationName: 'updatePlayerProfile',
        variables: {
          regionId: regCode,
          riotUserName: gameName,
          riotTagLine: tagLine
        },
        query
      };

      return await new Promise((resolve) => {
        const postData = JSON.stringify(payload);
        const req = https.request({
          hostname: 'u.gg',
          path: '/api',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            'Content-Length': Buffer.byteLength(postData)
          }
        }, res => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            try {
              resolve(JSON.parse(data));
            } catch (e) {
              resolve({ success: false });
            }
          });
        });
        req.on('error', (err) => resolve({ success: false, error: err.message }));
        req.write(postData);
        req.end();
      });
    } catch (err) {
      console.error('[UggService] requestProfileUpdate error:', err.message);
      return { success: false };
    }
  }

  /**
   * Fetch Live Match History for a Player
   */
  async getRecentMatches(gameName, tagLine, region = 'EUW', page = 1) {
    await this.initPromise;
    const regionCodeMap = {
      'EUW': 'euw1', 'NA': 'na1', 'EUNE': 'eun1', 'KR': 'kr',
      'BR': 'br1', 'LAN': 'la1', 'LAS': 'la2', 'OCE': 'oc1',
      'TR': 'tr1', 'RU': 'ru', 'JP': 'jp1'
    };

    const regCode = regionCodeMap[region.toUpperCase()] || 'euw1';
    const query = `
      query fetchPlayerMatchSummaries($regionId: String!, $riotUserName: String!, $riotTagLine: String!, $page: Int, $queueType: [Int], $seasonIds: [Int]) {
        fetchPlayerMatchSummaries(regionId: $regionId, riotUserName: $riotUserName, riotTagLine: $riotTagLine, page: $page, queueType: $queueType, seasonIds: $seasonIds) {
          matchSummaries {
            matchId
            matchCreationTime
            matchDuration
            queueType
            championId
            kills
            deaths
            assists
            win
            cs
            visionScore
            items
            summonerSpells
          }
        }
      }
    `;

    try {
      const payload = {
        operationName: 'fetchPlayerMatchSummaries',
        variables: {
          regionId: regCode,
          riotUserName: gameName,
          riotTagLine: tagLine,
          page: page,
          seasonIds: [26, 25]
        },
        query
      };

      const res = await new Promise((resolve, reject) => {
        const postData = JSON.stringify(payload);
        const req = https.request({
          hostname: 'u.gg',
          path: '/api',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            'Content-Length': Buffer.byteLength(postData)
          }
        }, res => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
          });
        });
        req.on('error', reject);
        req.write(postData);
        req.end();
      });

      const summaries = res?.data?.fetchPlayerMatchSummaries?.matchSummaries || [];
      return summaries.map(m => {
        const champName = this.getChampionNameById(m.championId);
        const durationMin = Math.floor((m.matchDuration || 0) / 60);
        const durationSec = Math.floor((m.matchDuration || 0) % 60).toString().padStart(2, '0');
        const q = String(m.queueType || '').toLowerCase();
        const queueName = q.includes('solo') || m.queueType === 420 ? 'Ranked Solo' :
                          q.includes('flex') || m.queueType === 440 ? 'Ranked Flex' :
                          q.includes('swift') || q.includes('quick') || m.queueType === 490 || m.queueType === 480 ? 'Swiftplay' :
                          q.includes('draft') || m.queueType === 400 ? 'Normal Draft' :
                          q.includes('blind') || m.queueType === 430 ? 'Normal Blind' :
                          q.includes('aram') || m.queueType === 450 ? 'ARAM' :
                          q.includes('arena') || m.queueType === 1700 ? 'Arena' : 'Normal Match';

        const qId = q.includes('solo') || m.queueType === 420 ? 420 : (q.includes('flex') || m.queueType === 440 ? 440 : (q.includes('swift') || q.includes('quick') || m.queueType === 490 ? 490 : 400));

        const k = m.kills || 0;
        const d = m.deaths || 0;
        const a = m.assists || 0;
        const kdaRatio = d > 0 ? ((k + a) / d).toFixed(2) : ((k + a) > 0 ? '3.50' : '2.00');

        const items = (m.items || []).map(id => {
          if (!id || id <= 0) return null;
          return { id, url: `https://ddragon.leagueoflegends.com/cdn/${this.ddragonVersion}/img/item/${id}.png` };
        });

        return {
          id: `${regCode.toUpperCase()}_${m.matchId}`,
          mode: queueName,
          queueId: qId,
          win: Boolean(m.win),
          lpChange: (q.includes('solo') || m.queueType === 420) ? (m.win ? '+25 LP' : '-22 LP') : '',
          gameDuration: `${durationMin}:${durationSec}`,
          timeAgo: this.formatTimeAgo(m.matchCreationTime),
          championName: champName,
          championIcon: this.getChampionIconUrl(champName),
          champLevel: 18,
          kills: k,
          deaths: d,
          assists: a,
          kdaRatio: kdaRatio,
          cs: m.cs || 0,
          csPerMin: durationMin > 0 ? ((m.cs || 0) / durationMin).toFixed(1) : '0.0',
          visionScore: m.visionScore || 0,
          items: items
        };
      });
    } catch (err) {
      console.error('[UggService] getRecentMatches error:', err.message);
      return [];
    }
  }

  /**
   * Fetch Live Ranked Leaderboard (Challenger/Grandmaster/Master ladder)
   */
  async getLeaderboard(region = 'EUW', page = 1) {
    await this.initPromise;
    const regionCodeMap = {
      'EUW': 'euw1',
      'NA': 'na1',
      'EUNE': 'eun1',
      'KR': 'kr',
      'BR': 'br1',
      'LAN': 'la1',
      'LAS': 'la2',
      'OCE': 'oc1',
      'TR': 'tr1',
      'RU': 'ru',
      'JP': 'jp1'
    };

    const regCode = regionCodeMap[region.toUpperCase()] || 'euw1';
    const query = `
      query getRankedLeaderboard($page: Int, $queueType: Int, $regionId: String!) {
        leaderboardPage(page: $page, queueType: $queueType, regionId: $regionId) {
          totalPlayerCount
          players {
            iconId
            losses
            lp
            overallRanking
            rank
            summonerLevel
            riotTagLine
            riotUserName
            tier
            wins
          }
        }
      }
    `;

    try {
      const payload = {
        operationName: 'getRankedLeaderboard',
        variables: { page: page, queueType: 420, regionId: regCode },
        query
      };

      const res = await new Promise((resolve, reject) => {
        const postData = JSON.stringify(payload);
        const req = https.request({
          hostname: 'u.gg',
          path: '/api',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            'Content-Length': Buffer.byteLength(postData)
          }
        }, res => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            try {
              resolve(JSON.parse(data));
            } catch (e) {
              reject(e);
            }
          });
        });
        req.on('error', reject);
        req.write(postData);
        req.end();
      });

      const players = res?.data?.leaderboardPage?.players || [];
      if (players.length > 0) {
        return players.map((p, idx) => {
          const wins = Number(p.wins) || 0;
          const losses = Number(p.losses) || 0;
          const total = wins + losses;
          const wr = total > 0 ? Math.round((wins / total) * 100) : 50;
          const fullName = p.riotTagLine ? `${p.riotUserName} #${p.riotTagLine}` : (p.riotUserName || 'Summoner');

          return {
            rank: p.overallRanking || (idx + 1),
            summonerName: fullName,
            tier: (p.tier || 'CHALLENGER').toUpperCase(),
            lp: Number(p.lp) || 0,
            wins: wins,
            losses: losses,
            winrate: wr,
            profileIconUrl: `https://ddragon.leagueoflegends.com/cdn/${this.ddragonVersion}/img/profileicon/${p.iconId || 23}.png`
          };
        });
      }
    } catch (err) {
      console.error('[UggService] getLeaderboard error:', err.message);
    }
    return [];
  }
}

module.exports = UggService;
