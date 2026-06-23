document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('header').forEach((header) => {
    const nav = header.querySelector('nav.center-links');
    const navRight = header.querySelector('.nav-right');
    if (!nav || !navRight || header.querySelector('.mobile-menu-toggle')) return;

    const actions = document.createElement('div');
    actions.className = 'mobile-menu-actions';
    const signIn = navRight.querySelector('.signin-link');
    const create = navRight.querySelector('.btn-gold');
    if (signIn) actions.innerHTML += `<a href="${signIn.getAttribute('href')}">Sign In</a>`;
    if (create) actions.innerHTML += `<a class="primary" href="${create.getAttribute('href')}">Create Account</a>`;
    nav.appendChild(actions);

    const button = document.createElement('button');
    button.className = 'mobile-menu-toggle';
    button.type = 'button';
    button.setAttribute('aria-label', 'Open navigation menu');
    button.setAttribute('aria-expanded', 'false');
    button.innerHTML = '<span></span>';
    button.addEventListener('click', () => {
      const open = header.classList.toggle('nav-open');
      button.setAttribute('aria-expanded', String(open));
      button.setAttribute('aria-label', open ? 'Close navigation menu' : 'Open navigation menu');
    });
    navRight.appendChild(button);

    nav.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => {
      header.classList.remove('nav-open');
      button.setAttribute('aria-expanded', 'false');
    }));
  });
});
