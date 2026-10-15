/**
 * App entry — wires orchestrator, navbar, and page modules.
 */

import { orchestrator } from './orchestrator.js';
import { NavbarModule } from './modules/navbar.js';
import { HomeModule } from './modules/home.js';
import { Section1Module } from './modules/section1.js';
import { Section2Module } from './modules/section2/index.js';
import { Section67Module } from './modules/section67/index.js';
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

  // Register page modules (0, 1, 2, 99) — await so submodule packages finish load()
  await orchestrator.register(new HomeModule(orchestrator));
  await orchestrator.register(new Section1Module());
  await orchestrator.register(new Section2Module());
  await orchestrator.register(new Section67Module());
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
