/**
 * Build Engine for League of Legends (PowderHelpMe Advice System)
 * Analyzes enemy team comp (AP vs AD ratio, healing, tanks) and active player items to give 100% legal live recommendations.
 */

const ITEMS_DATABASE = {
  antiHeal: [
    { id: 3076, name: "Bramble Vest / Thornmail", category: "Armor", icon: "https://ddragon.leagueoflegends.com/cdn/14.20.1/img/item/3075.png", reason: "Grievous Wounds vs Heavy Physical Regen" },
    { id: 3123, name: "Executioner's Calling / Mortal Reminder", category: "AD", icon: "https://ddragon.leagueoflegends.com/cdn/14.20.1/img/item/3033.png", reason: "AD Grievous Wounds vs Enemy Healers" },
    { id: 3916, name: "Oblivion Orb / Morellonomicon", category: "AP", icon: "https://ddragon.leagueoflegends.com/cdn/14.20.1/img/item/3165.png", reason: "AP Grievous Wounds vs Fast Healing Champions" }
  ],
  magicResist: [
    { id: 3156, name: "Maw of Malmortius / Hexdrinker", category: "AD", icon: "https://ddragon.leagueoflegends.com/cdn/14.20.1/img/item/3156.png", reason: "Anti-Magic Burst Shield (VS 3+ AP)" },
    { id: 2502, name: "Kaenic Rookern", category: "Tank", icon: "https://ddragon.leagueoflegends.com/cdn/14.20.1/img/item/2502.png", reason: "Ultimate Magic Protection vs AP Comps" },
    { id: 3157, name: "Zhonya's Hourglass", category: "AP", icon: "https://ddragon.leagueoflegends.com/cdn/14.20.1/img/item/3157.png", reason: "Stasis vs Heavy Burst Damage" }
  ],
  armorPen: [
    { id: 3036, name: "Lord Dominik's Regards", category: "AD", icon: "https://ddragon.leagueoflegends.com/cdn/14.20.1/img/item/3036.png", reason: "Armor Penetration vs Heavy Tanks" },
    { id: 3135, name: "Void Staff / Cryptbloom", category: "AP", icon: "https://ddragon.leagueoflegends.com/cdn/14.20.1/img/item/3135.png", reason: "Magic Penetration vs Magic Resist" }
  ],
  utility: [
    { id: 3026, name: "Guardian Angel", category: "AD", icon: "https://ddragon.leagueoflegends.com/cdn/14.20.1/img/item/3026.png", reason: "Second chance in late game teamfights" },
    { id: 4637, name: "Rabadon's Deathcap", category: "AP", icon: "https://ddragon.leagueoflegends.com/cdn/14.20.1/img/item/3089.png", reason: "Major AP Power Multiplier" }
  ]
};

// Champions categorized by high healing / high AP / high Armor
const HEAVY_HEALERS = ['Aatrox', 'Sylas', 'Soraka', 'Yuumi', 'DrMundo', 'Warwick', 'Briar', 'Swain', 'Vladimir', 'Kayn', 'Volibear'];
const HEAVY_AP = ['Syndra', 'Ahri', 'Lux', 'Veigar', 'Viktor', 'Xerath', 'Zoe', 'LeBlanc', 'Kassadin', 'Evelynn', 'Katarina', 'Fiddlesticks'];

function analyzeBuildRecommendations(allPlayers, activePlayerName) {
  if (!allPlayers || !Array.isArray(allPlayers) || allPlayers.length === 0) {
    return getDefaultBuildAdvice();
  }

  const activePlayer = allPlayers.find(p => p.summonerName === activePlayerName) || allPlayers[0];
  const enemyTeam = allPlayers.filter(p => p.team !== activePlayer.team);

  let heavyHealerCount = 0;
  let apCount = 0;
  let adCount = 0;

  enemyTeam.forEach(enemy => {
    const champ = enemy.championName || '';
    if (HEAVY_HEALERS.some(h => champ.toLowerCase().includes(h.toLowerCase()))) {
      heavyHealerCount++;
    }
    if (HEAVY_AP.some(ap => champ.toLowerCase().includes(ap.toLowerCase()))) {
      apCount++;
    } else {
      adCount++;
    }
  });

  const suggestions = [];

  // 1. Anti-Heal Priority
  if (heavyHealerCount > 0) {
    suggestions.push({
      title: "Priority Anti-Heal",
      tag: "URGENT",
      item: ITEMS_DATABASE.antiHeal[1],
      description: `${heavyHealerCount} high-regen champion(s) detected (e.g. ${enemyTeam.map(e => e.championName).filter(c => HEAVY_HEALERS.some(h => c.toLowerCase().includes(h.toLowerCase()))).join(', ')})`
    });
  }

  // 2. Magic Resist Defense
  if (apCount >= 3) {
    suggestions.push({
      title: "Anti-AP Defense",
      tag: "DEFENSE",
      item: ITEMS_DATABASE.magicResist[0],
      description: `Heavy AP enemy comp (${apCount}/5 magic champions)`
    });
  } else {
    suggestions.push({
      title: "Penetration & Burst",
      tag: "OFFENSIVE",
      item: ITEMS_DATABASE.armorPen[0],
      description: "Maximize raw burst damage on priority targets"
    });
  }

  // 3. Late Game / Clutch Item
  suggestions.push({
    title: "Late Game Survival",
    tag: "UTILITY",
    item: ITEMS_DATABASE.utility[0],
    description: "Protection against assassinations in end-game teamfights"
  });

  return {
    damageRatio: {
      apPercent: Math.round((apCount / (apCount + adCount || 1)) * 100),
      adPercent: Math.round((adCount / (apCount + adCount || 1)) * 100)
    },
    heavyHealerDetected: heavyHealerCount > 0,
    suggestions: suggestions
  };
}

function getDefaultBuildAdvice() {
  return {
    damageRatio: { apPercent: 40, adPercent: 60 },
    heavyHealerDetected: false,
    suggestions: [
      {
        title: "Armor Penetration",
        tag: "CORE",
        item: ITEMS_DATABASE.armorPen[0],
        description: "Increases physical damage against armored targets"
      },
      {
        title: "Anti-Burst Shield",
        tag: "DEFENSE",
        item: ITEMS_DATABASE.magicResist[0],
        description: "Reactive magic shield in skirmishes"
      },
      {
        title: "Situational Anti-Heal",
        tag: "SITUATIONAL",
        item: ITEMS_DATABASE.antiHeal[1],
        description: "Purchase if enemy team exhibits heavy healing"
      }
    ]
  };
}

module.exports = {
  analyzeBuildRecommendations,
  getDefaultBuildAdvice
};
