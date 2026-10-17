/**
 * App entry — wires orchestrator, navbar, and page modules.
 */

import { orchestrator } from './orchestrator.js';
import { NavbarModule } from './modules/navbar.js';
import { LibraryModule } from './modules/library/index.js';
import { SettingsModule, applyTheme, getStoredTheme } from './modules/settings.js';

async function boot() {
  // Ensure theme is applied (inline script in HTML already did first paint)
  applyTheme(getStoredTheme());

  const navbarRoot = document.getElementById('navbar-root');
  const moduleRoot = document.getElementById('module-root');

  if (!navbarRoot || !moduleRoot) {
    console.error('App roots missing from DOM.');
    return;
  }

  orchestrator.init(moduleRoot);

  // Register active page modules: Library (0) and Settings (99)
  await orchestrator.register(new LibraryModule(orchestrator));
  await orchestrator.register(new SettingsModule());

  // Navbar is not a page module; it always stays mounted
  const navbar = new NavbarModule(orchestrator);
  navbar.mount(navbarRoot);

  // Show last module or Home
  orchestrator.showDefault();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    boot().catch((err) => console.error('Boot failed:', err));
  });
} else {
  boot().catch((err) => console.error('Boot failed:', err));
}
