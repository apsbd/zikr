export function applyIOSChromeRenderFix() {
  const isIOS = /iP(hone|od|ad)/.test(navigator.userAgent);
  const isChrome = /CriOS/.test(navigator.userAgent);

  if (isIOS && isChrome) {
    window.addEventListener('load', () => {
      requestAnimationFrame(() => {
        const body = document.body;
        body.style.display = 'none';
        void body.offsetHeight;
        body.style.display = '';
      });
    });
  }
}
