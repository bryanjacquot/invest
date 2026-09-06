/**
 * Client-Side SPA Router for InvestTracker
 */
import { state } from './state.js';

class Router {
  constructor() {
    this.routes = new Map();
    this.currentView = null;
    this.container = null;

    window.addEventListener('popstate', () => {
      this.handleRoute();
    });

    // Intercept clicks on links with data-link
    document.addEventListener('click', (e) => {
      const link = e.target.closest('[data-link]');
      if (link) {
        e.preventDefault();
        const href = link.getAttribute('href') || link.getAttribute('data-link');
        if (href) {
          this.navigate(href);
        }
      }
    });
  }

  init(containerElement) {
    this.container = containerElement;
    this.handleRoute();
  }

  register(path, viewModule) {
    this.routes.set(path, viewModule);
  }

  navigate(url, replace = false) {
    if (replace) {
      window.history.replaceState(null, '', url);
    } else {
      window.history.pushState(null, '', url);
    }
    this.handleRoute();
  }

  async handleRoute() {
    if (!this.container) return;

    const path = window.location.pathname.replace(/\/+$/, '') || '/';
    const searchParams = new URLSearchParams(window.location.search);

    // Normalize path aliases
    let normalizedPath = path;
    if (normalizedPath === '' || normalizedPath === '/') {
      normalizedPath = '/overview';
    }

    state.activeRoute = normalizedPath;

    // Find matching route view
    let viewModule = this.routes.get(normalizedPath);
    if (!viewModule) {
      // Default fallback
      viewModule = this.routes.get('/overview');
      normalizedPath = '/overview';
    }

    // Call lifecycle hooks
    if (this.currentView && this.currentView !== viewModule) {
      if (typeof this.currentView.unmount === 'function') {
        this.currentView.unmount();
      }
    }

    this.currentView = viewModule;

    if (viewModule && typeof viewModule.mount === 'function') {
      await viewModule.mount(this.container, searchParams);
    }

    // Dispatch global route changed event for components (sidebar, header)
    window.dispatchEvent(new CustomEvent('invest:route-changed', {
      detail: { path: normalizedPath, params: searchParams }
    }));
  }
}

export const router = new Router();
