const { ipcRenderer } = require('electron');

const editBadge = document.getElementById('edit-badge');
const ratioText = document.getElementById('ratio-text');
const ratioApBar = document.getElementById('ratio-ap-bar');
const ratioAdBar = document.getElementById('ratio-ad-bar');
const buildList = document.getElementById('build-list');

ipcRenderer.on('edit-mode-changed', (event, isEditMode) => {
  editBadge.style.display = isEditMode ? 'inline-block' : 'none';
});

ipcRenderer.on('live-game-data', (event, { buildAdvice, isEditMode }) => {
  editBadge.style.display = isEditMode ? 'inline-block' : 'none';

  if (!buildAdvice) return;

  const { damageRatio, suggestions } = buildAdvice;
  if (damageRatio) {
    ratioText.innerText = `${damageRatio.apPercent}% AP / ${damageRatio.adPercent}% AD`;
    ratioApBar.style.width = `${damageRatio.apPercent}%`;
    ratioAdBar.style.width = `${damageRatio.adPercent}%`;
  }

  if (suggestions && Array.isArray(suggestions)) {
    buildList.innerHTML = suggestions.map(s => `
      <div class="build-card">
        <img src="${s.item.icon}" class="item-img" alt="${s.item.name}">
        <div class="build-details">
          <div class="build-head">
            <span class="build-item-name">${s.item.name.split('/')[0]}</span>
            <span class="build-tag">${s.tag}</span>
          </div>
          <span class="build-reason" title="${s.description}">${s.description}</span>
        </div>
      </div>
    `).join('');
  }
});
