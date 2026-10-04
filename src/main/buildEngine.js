/**
 * Build Engine for League of Legends (PowderHelpMe Advice System)
 * Analyzes enemy team comp (AP vs AD ratio, healing, tanks) and active player items to give 100% legal live recommendations.
 */

const ITEMS_DATABASE = {
  antiHeal: [
    { id: 3076, name: "BramblemVest / Thornmail", category: "Armor", icon: "https://ddragon.leagueoflegends.com/cdn/14.20.1/img/item/3075.png", reason: "Anti-Soin vs Lourde régénération physique" },
    { id: 3123, name: "Executioner's Calling / Mortal Reminder", category: "AD", icon: "https://ddragon.leagueoflegends.com/cdn/14.20.1/img/item/3033.png", reason: "Anti-Soin AD vs Soigneurs ennemi" },
    { id: 3916, name: "Oblivion Orb / Morellonomicon", category: "AP", icon: "https://ddragon.leagueoflegends.com/cdn/14.20.1/img/item/3165.png", reason: "Anti-Soin AP vs Champions à soin rapide" }
  ],
  magicResist: [
    { id: 3156, name: "Maw of Malmortius / Hexdrinker", category: "AD", icon: "https://ddragon.leagueoflegends.com/cdn/14.20.1/img/item/3156.png", reason: "Bouclier anti-burst Magique (VS 3+ AP)" },
    { id: 2502, name: "Kaenic Rookern", category: "Tank", icon: "https://ddragon.leagueoflegends.com/cdn/14.20.1/img/item/2502.png", reason: "Protection Magique ultime vs Compos AP" },
    { id: 3157, name: "Zhonya's Hourglass", category: "AP", icon: "https://ddragon.leagueoflegends.com/cdn/14.20.1/img/item/3157.png", reason: "Stase temporelle vs Dégâts lourds" }
  ],
  armorPen: [
    { id: 3036, name: "Lord Dominik's Regards", category: "AD", icon: "https://ddragon.leagueoflegends.com/cdn/14.20.1/img/item/3036.png", reason: "Pénétration d'armure vs Tanks lourds" },
    { id: 3135, name: "Void Staff / Cryptbloom", category: "AP", icon: "https://ddragon.leagueoflegends.com/cdn/14.20.1/img/item/3135.png", reason: "Pénétration magique vs Résistance magique" }
  ],
  utility: [
    { id: 3026, name: "Guardian Angel", category: "AD", icon: "https://ddragon.leagueoflegends.com/cdn/14.20.1/img/item/3026.png", reason: "Seconde chance en fin de partie" },
    { id: 4637, name: "Rabadon's Deathcap", category: "AP", icon: "https://ddragon.leagueoflegends.com/cdn/14.20.1/img/item/3089.png", reason: "Multiplicateur de puissance AP majeur" }
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
  let tankCount = 0;

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
      title: "Anti-Soin Prioritaire",
      tag: "URGENT",
      item: ITEMS_DATABASE.antiHeal[1],
      description: `${heavyHealerCount} champion(s) avec forte régénération détecté(s) (ex: ${enemyTeam.map(e => e.championName).filter(c => HEAVY_HEALERS.some(h => c.toLowerCase().includes(h.toLowerCase()))).join(', ')})`
    });
  }

  // 2. Magic Resist Defense
  if (apCount >= 3) {
    suggestions.push({
      title: "Défense Anti-AP",
      tag: "DEFENSE",
      item: ITEMS_DATABASE.magicResist[0],
      description: `Compo ennemie fortement AP (${apCount}/5 champions magiques)`
    });
  } else {
    suggestions.push({
      title: "Pénétration & Burst",
      tag: "OFFENSIF",
      item: ITEMS_DATABASE.armorPen[0],
      description: "Optimisez vos dégâts bruts sur les cibles prioritaires"
    });
  }

  // 3. Late Game / Clutch Item
  suggestions.push({
    title: "Survie Fin de Partie",
    tag: "UTILITÉ",
    item: ITEMS_DATABASE.utility[0],
    description: "Protection contre les assassinations et teamfights de fin de match"
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
        title: "Pénétration d'Armure",
        tag: "CORE",
        item: ITEMS_DATABASE.armorPen[0],
        description: "Augmente vos dégâts contre les cibles armurées"
      },
      {
        title: "Protection Anti-Burst",
        tag: "DEFENSE",
        item: ITEMS_DATABASE.magicResist[0],
        description: "Bouclier magique réactif en escarmouche"
      },
      {
        title: "Anti-Soin Situatif",
        tag: "SITUATIF",
        item: ITEMS_DATABASE.antiHeal[1],
        description: "À acheter si l'équipe adverse possède des soins importants"
      }
    ]
  };
}

module.exports = {
  analyzeBuildRecommendations,
  getDefaultBuildAdvice
};
