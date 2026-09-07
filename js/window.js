// Paper.io 2 - window helpers
(function () {
  // Safe no-op for any SDK export calls that may not exist in this context
  if (typeof window.maeExportApis_ !== 'function') {
    window.maeExportApis_ = function () {};
  }

  // Prevent right-click context menu on the game canvas
  document.addEventListener('contextmenu', function (e) {
    e.preventDefault();
  });

  // Prevent default touch behavior (scroll/zoom) on the game area
  document.addEventListener('touchmove', function (e) {
    e.preventDefault();
  }, { passive: false });

  // Prevent spacebar from scrolling the page
  window.addEventListener('keydown', function (e) {
    if (e.code === 'Space' || e.key === ' ') {
      e.preventDefault();
    }
  });
})();
