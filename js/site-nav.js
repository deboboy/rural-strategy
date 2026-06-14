(function () {
  const header = document.querySelector('.site-header');
  const toggle = document.querySelector('.nav-menu-toggle');
  const nav = document.getElementById('site-nav');
  if (!header || !toggle || !nav) return;

  const label = toggle.querySelector('.nav-menu-toggle-label');

  function setOpen(isOpen) {
    header.classList.toggle('is-nav-open', isOpen);
    toggle.setAttribute('aria-expanded', String(isOpen));
    toggle.setAttribute('aria-label', isOpen ? 'Close navigation menu' : 'Open navigation menu');
    if (label) {
      label.textContent = isOpen ? 'Close' : 'Menu';
    }
    document.body.classList.toggle('nav-menu-open', isOpen);
  }

  toggle.addEventListener('click', () => {
    setOpen(!header.classList.contains('is-nav-open'));
  });

  nav.addEventListener('click', (event) => {
    if (event.target === nav) {
      setOpen(false);
    }
  });

  nav.querySelectorAll('a, button').forEach((element) => {
    element.addEventListener('click', () => {
      if (window.matchMedia('(max-width: 767px)').matches) {
        setOpen(false);
      }
    });
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      setOpen(false);
    }
  });

  window.matchMedia('(min-width: 768px)').addEventListener('change', (event) => {
    if (event.matches) {
      setOpen(false);
    }
  });
})();
