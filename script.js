/* ─────────────────────────────────────────
   Mobile menu toggle
───────────────────────────────────────── */
function toggleMenu() {
  const menu = document.getElementById('mobileMenu');
  menu.classList.toggle('open');
}

/* ─────────────────────────────────────────
   Scroll-triggered animations (existing)
───────────────────────────────────────── */
const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry, i) => {
    if (entry.isIntersecting) {
      setTimeout(() => {
        entry.target.classList.add('visible');
      }, 80 * i);
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });

document.querySelectorAll('.animate-up').forEach(el => observer.observe(el));

/* ─────────────────────────────────────────
   Navbar scroll opacity
───────────────────────────────────────── */
window.addEventListener('scroll', () => {
  const navbar = document.querySelector('.navbar');
  if (window.scrollY > 30) {
    navbar.style.background = 'rgba(6, 14, 32, 0.85)';
  } else {
    navbar.style.background = 'rgba(6, 14, 32, 0.6)';
  }
});

/* ─────────────────────────────────────────
   Smooth scroll — ALL anchor links
   (including Features / How It Works nav)
───────────────────────────────────────── */
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const targetId = a.getAttribute('href');
    if (!targetId || targetId === '#') return;
    const target = document.querySelector(targetId);
    if (!target) return;
    e.preventDefault();

    // Close mobile menu if open
    const mobileMenu = document.getElementById('mobileMenu');
    if (mobileMenu) mobileMenu.classList.remove('open');

    target.scrollIntoView({ behavior: 'smooth' });

    // Trigger slide-in highlight on the target section
    triggerSectionSlideIn(targetId.replace('#', ''));
  });
});

/* ─────────────────────────────────────────
   Section slide-in effect
   Called when Features or How It Works is
   clicked in the nav
───────────────────────────────────────── */
function triggerSectionSlideIn(sectionId) {
  const section = document.getElementById(sectionId);
  if (!section) return;

  // Reset then re-animate so it's visible even if already scrolled past
  section.classList.remove('section-slide-in', 'section-slide-active');

  // Force reflow so removing+re-adding the class triggers CSS transition
  void section.offsetWidth;

  section.classList.add('section-slide-in');

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      section.classList.add('section-slide-active');
    });
  });

  // Clean up classes after animation finishes (600 ms)
  setTimeout(() => {
    section.classList.remove('section-slide-in', 'section-slide-active');
  }, 900);
}
