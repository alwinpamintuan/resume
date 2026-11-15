// Shared verbatim with the companion résumé.
export {};

const header = document.querySelector<HTMLElement>('.site-header');
const menu = header?.querySelector<HTMLDetailsElement>('.page-menu');
const navigation = header?.querySelector<HTMLElement>('[data-section-nav]');
const links = navigation ? [...navigation.querySelectorAll<HTMLAnchorElement>('a[href^="#"]')] : [];
const destinations = links.map((link) => document.getElementById(link.hash.slice(1)));
const compact = matchMedia('(max-width: 1000px)');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let menuAnimation: Animation | undefined;
let requestedOpen = menu?.open ?? false;

const finishMenu = (): void => {
  menuAnimation?.cancel();
  menuAnimation = undefined;
  if (menu) { menu.open = requestedOpen; delete menu.dataset.motionState; }
  if (navigation) navigation.inert = false;
};

const setMenu = (open: boolean, animate = false): void => {
  if (!menu || !navigation) return;
  // Read the current rendered frame before canceling, so a reversal never jumps.
  const styles = menu.open ? getComputedStyle(navigation) : undefined;
  const from = styles
    ? { transform: styles.transform, opacity: styles.opacity }
    : { transform: 'translateY(-6px) scale(.97)', opacity: '0' };
  requestedOpen = open;
  menuAnimation?.cancel();
  if (!animate || reducedMotion.matches || typeof navigation.animate !== 'function') {
    finishMenu();
    return;
  }
  menu.open = true;
  navigation.inert = !open;
  menu.dataset.motionState = open ? 'opening' : 'closing';
  const trigger = menu.querySelector('summary')?.getBoundingClientRect();
  if (trigger) navigation.style.transformOrigin = (trigger.left + trigger.width / 2 - navigation.getBoundingClientRect().left) + 'px 0px';
  const tokens = getComputedStyle(document.documentElement);
  menuAnimation = navigation.animate([from, open
    ? { transform: 'translateY(0px) scale(1)', opacity: '1' }
    : { transform: 'translateY(-6px) scale(.97)', opacity: '0' }], {
    duration: parseFloat(tokens.getPropertyValue('--motion-menu')) || 180,
    easing: tokens.getPropertyValue('--ease').trim(),
    fill: 'both',
  });
  menuAnimation.onfinish = finishMenu;
};
let scheduled = false;

const update = (): void => {
  scheduled = false;
  if (!header) return;
  header.dataset.scrolled = String(scrollY > 8);
  const maximumY = Math.max(0, document.documentElement.scrollHeight - innerHeight);
  const remainingScroll = Math.max(0, maximumY - scrollY);
  // As scrolling runs out, follow the visible content toward the viewport
  // center. Forcing the final item would skip short sections above it.
  const readingLine = Math.max(header.getBoundingClientRect().bottom + 24, innerHeight / 2 - remainingScroll);
  let current = -1;
  destinations.forEach((section, index) => {
    if (section && section.getBoundingClientRect().top <= readingLine + 1) current = index;
  });
  // A native anchor can stop short when the target is near the document end.
  // Honor that destination while at its clamped position, then resume tracking
  // as soon as the reader scrolls away, including at the document bottom.
  const anchorIndex = links.findIndex((link) => link.hash === location.hash);
  const anchor = destinations[anchorIndex];
  if (anchor) {
    const margin = parseFloat(getComputedStyle(anchor).scrollMarginTop) || 0;
    const targetY = anchor.getBoundingClientRect().top + scrollY - margin;
    const nativeY = Math.min(maximumY, Math.max(0, targetY));
    if (Math.abs(scrollY - nativeY) <= 2) current = anchorIndex;
  }
  links.forEach((link, index) => {
    if (index === current) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  });
};

const schedule = (): void => {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(update);
};

const measure = (): void => {
  if (header) document.documentElement.style.setProperty('--site-header-height', header.getBoundingClientRect().height + 'px');
  schedule();
};

if (header) {
  header.dataset.navigationEnhanced = '';
  const resetMenu = (): void => { setMenu(!compact.matches); measure(); };
  menu?.querySelector('summary')?.addEventListener('click', (event) => {
    if (!compact.matches || !menu) return;
    event.preventDefault();
    setMenu(menuAnimation ? !requestedOpen : !menu.open, event.detail > 0);
  });
  reducedMotion.addEventListener('change', () => { if (reducedMotion.matches && menuAnimation) finishMenu(); });
  resetMenu();
  compact.addEventListener('change', resetMenu);
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(measure).observe(header);
  void document.fonts.ready.then(measure);
  window.addEventListener('resize', measure, { passive: true });
  window.addEventListener('pageshow', measure);
  window.addEventListener('hashchange', schedule);
  document.addEventListener('scroll', schedule, { passive: true });
  links.forEach((link, index) => {
    link.addEventListener('click', (event) => {
      if (!compact.matches || !menu) return;
      setMenu(false);
      if (event.detail === 0) requestAnimationFrame(() => {
        const destination = destinations[index];
        if (destination) { destination.tabIndex = -1; destination.focus({ preventScroll: true }); }
      });
    });
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && compact.matches && menu?.open) {
      setMenu(false);
      menu.querySelector<HTMLElement>('summary')?.focus();
    }
  });
  document.addEventListener('click', (event) => {
    if (compact.matches && menu?.open && event.target instanceof Node && !menu.contains(event.target)) setMenu(false, true);
  });
}
