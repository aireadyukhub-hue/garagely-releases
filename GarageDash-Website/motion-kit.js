// GarageDash Motion Kit — pairs with motion-kit.css. Framework-free, reusable
// on any static site: watches every .reveal / .reveal-stagger element and
// adds .in-view the first time it scrolls into the viewport.
(function () {
  var targets = document.querySelectorAll('.reveal, .reveal-stagger');
  if (!('IntersectionObserver' in window) || !targets.length) {
    // No IntersectionObserver support (very old browser) — just show everything.
    targets.forEach(function (el) { el.classList.add('in-view'); });
    return;
  }
  var observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
  );
  targets.forEach(function (el) { observer.observe(el); });
})();
