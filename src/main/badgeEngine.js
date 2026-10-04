/**
 * Badge Engine for PowderHelpMe LoL Stats App
 * Computes League-of-Graphs style badges based on player statistics.
 */

function computeBadges(stats) {
  const { csPerMin, dpm, kda, winrate7d, visionScorePerMin, mainChampPickrate } = stats;
  const badges = [];

  if (csPerMin >= 8.5) {
    badges.push({
      id: 'cs_god',
      title: 'Monstre du CS',
      category: 'gold',
      icon: 'coins',
      desc: `Moyenne impressionnante de ${csPerMin.toFixed(1)} CS/min`
    });
  } else if (csPerMin >= 7.0) {
    badges.push({
      id: 'cs_pro',
      title: 'Solide Farmeur',
      category: 'purple',
      icon: 'coins',
      desc: `Bonne gestion des vagues (${csPerMin.toFixed(1)} CS/min)`
    });
  }

  if (dpm >= 750) {
    badges.push({
      id: 'dpm_monster',
      title: 'Machine à Dégâts',
      category: 'purple',
      icon: 'zap',
      desc: `Énorme présence en combat (${Math.round(dpm)} DPM)`
    });
  } else if (dpm >= 550) {
    badges.push({
      id: 'dpm_active',
      title: 'Gros Dégâts',
      category: 'blue',
      icon: 'zap',
      desc: `Dégâts constants (${Math.round(dpm)} DPM)`
    });
  }

  if (kda >= 4.0) {
    badges.push({
      id: 'unkillable',
      title: 'Insubmersible',
      category: 'gold',
      icon: 'crown',
      desc: `Ratio KDA impressionnant de ${kda.toFixed(2)}`
    });
  }

  if (winrate7d >= 65) {
    badges.push({
      id: 'hot_streak',
      title: 'Sur une Vague',
      category: 'gold',
      icon: 'flame',
      desc: `${winrate7d}% de winrate sur les 7 derniers jours`
    });
  }

  if (mainChampPickrate >= 50) {
    badges.push({
      id: 'one_trick',
      title: 'One-Trick Pony',
      category: 'purple',
      icon: 'target',
      desc: `Joue son main champion ${mainChampPickrate}% du temps`
    });
  }

  if (visionScorePerMin >= 1.5) {
    badges.push({
      id: 'vision_master',
      title: 'Maître de la Vision',
      category: 'blue',
      icon: 'eye',
      desc: `Contrôle de carte supérieur (${visionScorePerMin.toFixed(1)} Vision/min)`
    });
  }

  // Ensure at least 2 default badges if new profile
  if (badges.length === 0) {
    badges.push({
      id: 'challenger_mindset',
      title: 'Combattant Régulier',
      category: 'blue',
      icon: 'swords',
      desc: 'Joueur actif en partie classée'
    });
  }

  return badges;
}

module.exports = {
  computeBadges
};
