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
      title: 'CS Monster',
      category: 'gold',
      icon: 'coins',
      desc: `Impressive average of ${csPerMin.toFixed(1)} CS/min`
    });
  } else if (csPerMin >= 7.0) {
    badges.push({
      id: 'cs_pro',
      title: 'Solid Farmer',
      category: 'purple',
      icon: 'coins',
      desc: `Great wave management (${csPerMin.toFixed(1)} CS/min)`
    });
  }

  if (dpm >= 750) {
    badges.push({
      id: 'dpm_monster',
      title: 'Damage Machine',
      category: 'purple',
      icon: 'zap',
      desc: `Huge teamfight presence (${Math.round(dpm)} DPM)`
    });
  } else if (dpm >= 550) {
    badges.push({
      id: 'dpm_active',
      title: 'Heavy Hitter',
      category: 'blue',
      icon: 'zap',
      desc: `Consistent damage output (${Math.round(dpm)} DPM)`
    });
  }

  if (kda >= 4.0) {
    badges.push({
      id: 'unkillable',
      title: 'Unkillable',
      category: 'gold',
      icon: 'crown',
      desc: `Outstanding ${kda.toFixed(2)} KDA ratio`
    });
  }

  if (winrate7d >= 65) {
    badges.push({
      id: 'hot_streak',
      title: 'On a Streak',
      category: 'gold',
      icon: 'flame',
      desc: `${winrate7d}% win rate over the last 7 days`
    });
  }

  if (mainChampPickrate >= 50) {
    badges.push({
      id: 'one_trick',
      title: 'One-Trick Pony',
      category: 'purple',
      icon: 'target',
      desc: `Plays main champion ${mainChampPickrate}% of games`
    });
  }

  if (visionScorePerMin >= 1.5) {
    badges.push({
      id: 'vision_master',
      title: 'Vision Master',
      category: 'blue',
      icon: 'eye',
      desc: `Superior map control (${visionScorePerMin.toFixed(1)} Vision/min)`
    });
  }

  // Ensure at least 2 default badges if new profile
  if (badges.length === 0) {
    badges.push({
      id: 'challenger_mindset',
      title: 'Consistent Warrior',
      category: 'blue',
      icon: 'swords',
      desc: 'Active ranked competitor'
    });
  }

  return badges;
}

module.exports = {
  computeBadges
};
