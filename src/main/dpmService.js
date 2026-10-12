const { BrowserWindow } = require('electron');

async function fetchDpmData(rioId) {
  if (!rioId) return null;
  const normalizedId = rioId.trim();

  const url = `https://dpm.lol/${encodeURIComponent(normalizedId)}`;
  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      offscreen: true,
      images: true,
      webSecurity: false
    }
  });

  try {
    win.webContents.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36');
    win.loadURL(url);

    const result = await new Promise((resolve) => {
      let attempts = 0;
      const interval = setInterval(async () => {
        attempts++;
        if (win.isDestroyed()) {
          clearInterval(interval);
          resolve(null);
          return;
        }

        try {
          // Attempt clicking on Solo Q card if present
          await win.webContents.executeJavaScript(`
            (() => {
              const el = Array.from(document.querySelectorAll('*')).find(e => e.innerText && (e.innerText.includes('MASTER') || e.innerText === 'Classé Solo' || e.innerText.includes('Ranked Solo')));
              if (el) el.click();
            })()
          `).catch(() => {});

          const res = await win.webContents.executeJavaScript(`
            (() => {
              const allSpans = Array.from(document.querySelectorAll('span'));
              const peakSpan = allSpans.find(s => s.innerText.trim().toUpperCase() === 'PEAK');
              const mmrSpan = allSpans.find(s => s.innerText.trim().toUpperCase() === 'MMR');
              const svgEl = document.querySelector('svg.recharts-surface');

              if (peakSpan || mmrSpan || svgEl) {
                const pParent = peakSpan ? peakSpan.parentElement : null;
                const pImg = pParent ? pParent.querySelector('img') : null;
                const mParent = mmrSpan ? mmrSpan.parentElement : null;
                const mImg = mParent ? mParent.querySelector('img') : null;

                return {
                  peakText: pParent ? pParent.innerText.replace(/PEAK/i, '').trim() : '',
                  peakImg: pImg ? pImg.src : '',
                  mmrText: mParent ? mParent.innerText.replace(/MMR/i, '').trim() : '',
                  mmrImg: mImg ? mImg.src : '',
                  svg: svgEl ? svgEl.outerHTML : ''
                };
              }
              return null;
            })()
          `);

          if ((res && (res.peakText || res.mmrText || res.svg)) || attempts >= 20) {
            clearInterval(interval);
            resolve(res);
          }
        } catch (e) {
          if (attempts >= 20) {
            clearInterval(interval);
            resolve(null);
          }
        }
      }, 300);
    });

    if (result) {
      const parseTier = (imgUrl) => {
        if (!imgUrl) return '';
        const match = imgUrl.match(/%2Frank%2F([A-Z]+)_SMALL\.webp/i) || imgUrl.match(/\/rank\/([A-Z]+)_SMALL\.webp/i);
        if (!match) return '';
        const key = match[1].toUpperCase();
        return key.charAt(0) + key.slice(1).toLowerCase();
      };

      const peakTier = parseTier(result.peakImg);
      const mmrTier = parseTier(result.mmrImg);

      result.peakFormatted = (peakTier ? peakTier + ' ' : '') + result.peakText;
      result.mmrFormatted = (mmrTier ? mmrTier + ' ' : '') + result.mmrText;
    }

    return result;
  } catch (err) {
    console.error('[dpmService] Error fetching dpm.lol:', err);
    return null;
  } finally {
    if (!win.isDestroyed()) win.destroy();
  }
}

module.exports = {
  fetchDpmData
};
