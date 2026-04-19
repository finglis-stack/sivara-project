// ============================================
// Sivara Browser — Renderer
// ============================================

const SUPABASE_URL = 'https://asctcqyupjwjifxidegq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFzY3RjcXl1cGp3amlmeGlkZWdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMxNjU1ODEsImV4cCI6MjA3ODc0MTU4MX0.JUAXZaLsixxqQ2-hNzgZhmViVvA8aiDbL-3IOquanrs';

class SivaraBrowser {
  constructor() {
    this.tabs = [];
    this.activeTabId = null;
    this.tabIdCounter = 0;
    this.defaultSearchEngine = 'https://sivara.ca/search?q=';
    this.homePage = 'sivara://newtab';
    this.account = null;

    this.init();
  }

  async init() {
    this.cacheElements();
    this.bindEvents();
    this.bindOnboarding();
    await this.loadAccount();
    this.checkOnboarding();
    this.createNewTab();
    this.updateGreeting();

    window.addEventListener('languageChanged', (e) => {
      this.updateGreeting();
      // Update the current lang UI indicator
      const langCodeEl = document.getElementById('current-lang-code');
      if (langCodeEl) langCodeEl.textContent = e.detail.toUpperCase();
    });

    // Listen for .sivara file opens from main process
    if (window.electronAPI) {
      window.electronAPI.onOpenSivaraFile((filePath) => {
        this.openSivaraEditor(filePath);
      });
    }
  }

  cacheElements() {
    // Title bar controls
    this.btnMinimize = document.getElementById('btn-minimize');
    this.btnMaximize = document.getElementById('btn-maximize');
    this.btnClose = document.getElementById('btn-close');

    // Tab bar
    this.tabsContainer = document.getElementById('tabs-container');
    this.btnNewTab = document.getElementById('btn-new-tab');

    // Navigation
    this.btnBack = document.getElementById('btn-back');
    this.btnForward = document.getElementById('btn-forward');
    this.btnReload = document.getElementById('btn-reload');
    this.urlBar = document.getElementById('url-bar');
    this.urlSecurityIcon = document.getElementById('url-security-icon');
    this.btnGo = document.getElementById('btn-go');
    this.btnHome = document.getElementById('btn-home');
    this.btnOpenSivara = document.getElementById('btn-open-sivara');

    // Loading bar
    this.loadingBar = document.getElementById('loading-bar');

    // Content area
    this.browserContent = document.getElementById('browser-content');
    this.newTabPage = document.getElementById('new-tab-page');
    this.ntpSearchInput = document.getElementById('ntp-search-input');

    // Account
    this.btnAccount = document.getElementById('btn-account');
    this.accountPanel = document.getElementById('account-panel');
    this.accountAvatar = document.getElementById('account-avatar');
    this.accountLoggedOut = document.getElementById('account-logged-out');
    this.accountLoggedIn = document.getElementById('account-logged-in');
    this.btnLogin = document.getElementById('btn-login');
    this.profileName = document.getElementById('profile-name');
    this.profileEmail = document.getElementById('profile-email');
    this.profileAvatarLarge = document.getElementById('profile-avatar-large');
    this.btnSyncNow = document.getElementById('btn-sync-now');
    this.btnLogout = document.getElementById('btn-logout');
    this.btnPanelSignup = document.getElementById('btn-panel-signup');
  }

  bindEvents() {
    // Window controls
    this.btnMinimize.addEventListener('click', () => window.electronAPI.minimize());
    this.btnMaximize.addEventListener('click', () => window.electronAPI.maximize());
    this.btnClose.addEventListener('click', () => window.electronAPI.close());

    // Tab controls
    this.btnNewTab.addEventListener('click', () => this.createNewTab());

    // Navigation
    this.btnBack.addEventListener('click', () => this.goBack());
    this.btnForward.addEventListener('click', () => this.goForward());
    this.btnReload.addEventListener('click', () => this.reload());
    this.btnHome.addEventListener('click', () => this.goHome());
    this.btnGo.addEventListener('click', () => this.navigateFromUrlBar());

    // Open .sivara file
    this.btnOpenSivara.addEventListener('click', () => this.openSivaraFileDialog());

    // URL bar
    this.urlBar.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.navigateFromUrlBar();
      }
    });

    this.urlBar.addEventListener('focus', () => {
      this.urlBar.select();
    });

    // New tab page search
    this.ntpSearchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const query = this.ntpSearchInput.value.trim();
        if (query) {
          this.navigate(this.buildUrl(query));
          this.ntpSearchInput.value = '';
        }
      }
    });

    // Shortcuts
    document.querySelectorAll('.shortcut').forEach((shortcut) => {
      shortcut.addEventListener('click', () => {
        const url = shortcut.dataset.url;
        if (url) this.navigate(url);
      });
    });

    // Account panel toggle
    this.btnAccount.addEventListener('click', (e) => {
      e.stopPropagation();
      this.accountPanel.style.display =
        this.accountPanel.style.display === 'none' ? 'block' : 'none';
    });

    // Close panel on outside click
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#account-area')) {
        this.accountPanel.style.display = 'none';
      }
    });

    // Login button => open web login page
    this.btnLogin.addEventListener('click', () => this.handleLogin());

    // Panel signup button => open web onboarding page
    if (this.btnPanelSignup) {
      this.btnPanelSignup.addEventListener('click', () => {
        this.accountPanel.style.display = 'none';
        this.navigate('https://account.sivara.ca/onboarding');
      });
    }

    // Logout
    this.btnLogout.addEventListener('click', () => this.handleLogout());

    // Sync
    this.btnSyncNow.addEventListener('click', () => this.handleSync());

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === 't') {
        e.preventDefault();
        this.createNewTab();
      }
      if (e.ctrlKey && e.key === 'w') {
        e.preventDefault();
        if (this.activeTabId !== null) {
          this.closeTab(this.activeTabId);
        }
      }
      if (e.ctrlKey && e.key === 'l') {
        e.preventDefault();
        this.urlBar.focus();
        this.urlBar.select();
      }
      if (e.ctrlKey && e.key === 'r') {
        e.preventDefault();
        this.reload();
      }
      if (e.ctrlKey && e.key === 'o') {
        e.preventDefault();
        this.openSivaraFileDialog();
      }
      if (e.altKey && e.key === 'ArrowLeft') {
        e.preventDefault();
        this.goBack();
      }
      if (e.altKey && e.key === 'ArrowRight') {
        e.preventDefault();
        this.goForward();
      }
    });
  }

  // ---- Onboarding / Welcome ----

  bindOnboarding() {
    this.obOverlay = document.getElementById('onboarding-overlay');
    this.obLoginBtn = document.getElementById('onboarding-login-btn');
    this.obSignupBtn = document.getElementById('onboarding-signup-btn');
    this.obSkipBtn = document.getElementById('onboarding-skip');

    if (this.obLoginBtn) {
      this.obLoginBtn.addEventListener('click', () => {
        this.obOverlay.style.display = 'none';
        localStorage.setItem('sivara-onboarded-v2', 'true');
        this.navigate('https://account.sivara.ca/login');
      });
    }

    if (this.obSignupBtn) {
      this.obSignupBtn.addEventListener('click', () => {
        this.obOverlay.style.display = 'none';
        localStorage.setItem('sivara-onboarded-v2', 'true');
        this.navigate('https://account.sivara.ca/onboarding');
      });
    }

    if (this.obSkipBtn) {
      this.obSkipBtn.addEventListener('click', () => {
        this.obOverlay.style.display = 'none';
        localStorage.setItem('sivara-onboarded-v2', 'true');
      });
    }
  }

  checkOnboarding() {
    const onboarded = localStorage.getItem('sivara-onboarded-v2');
    if (!onboarded) {
      this.obOverlay.style.display = 'flex';
    }
  }

  updateGreeting() {
    const el = document.getElementById('ntp-greeting');
    if (!el) return;
    const hour = new Date().getHours();
    let greeting = window.t('ntp.greeting.morning');
    if (hour >= 18) greeting = window.t('ntp.greeting.evening');
    else if (hour >= 12) greeting = window.t('ntp.greeting.afternoon');
    if (this.account?.name) {
      greeting += `, ${this.account.name.split(' ')[0]}`;
    }
    el.textContent = greeting;

    // Initialize Lottie cat animation
    const lottieContainer = document.getElementById('ntp-lottie');
    if (lottieContainer && typeof lottie !== 'undefined' && !lottieContainer.dataset.loaded) {
      lottieContainer.dataset.loaded = 'true';
      lottie.loadAnimation({
        container: lottieContainer,
        renderer: 'svg',
        loop: true,
        autoplay: true,
        path: 'assets/Welcome.json',
      });
    }
  }

  async checkWebviewSessionState(webview) {
    try {
      const result = await webview.executeJavaScript(`
        (function() {
          // Sivara uses js-cookie storage with key 'sivara-auth-token'
          function getCookie(name) {
            const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
            return match ? decodeURIComponent(match[2]) : null;
          }
          
          const raw = getCookie('sivara-auth-token');
          console.log('[SessionSync] Cookie sivara-auth-token:', raw ? 'FOUND (' + raw.length + ' chars)' : 'NOT FOUND');
          
          if (raw) {
            try {
              const val = JSON.parse(raw);
              if (val && val.access_token) return JSON.stringify(val);
              // Supabase v2 nested format
              if (val && val.session && val.session.access_token) return JSON.stringify(val.session);
            } catch(e) {
              console.log('[SessionSync] Cookie parse error:', e.message);
            }
          }
          
          // Fallback: also check localStorage in case storage method changes
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (key.includes('sivara-auth') || key.startsWith('sb-'))) {
              try {
                const val = JSON.parse(localStorage.getItem(key));
                if (val && val.access_token) return JSON.stringify(val);
                if (val && val.session && val.session.access_token) return JSON.stringify(val.session);
              } catch(e) {}
            }
          }
          
          return null;
        })()
      `);

      console.log('[SessionSync] Poll result:', result ? 'TOKEN FOUND' : 'NO TOKEN');

      if (result) {
        const session = JSON.parse(result);
        if (!session.access_token) return;

        if (!this.account || this.account.access_token !== session.access_token) {
          console.log('[SessionSync] New session detected, syncing...');
          await this.syncFromWebSession(session);
        }
      } else {
        if (this.account) {
          console.log('[SessionSync] Session gone from web, syncing logout...');
          await this.handleLogout();
          this.updateGreeting();
        }
      }
    } catch (err) {
      console.log('[SessionSync] Poll error:', err.message);
    }
  }

  async syncFromWebSession(session) {
    try {
      // Fetch user info with the token
      const userResp = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': SUPABASE_ANON_KEY,
        },
      });

      if (!userResp.ok) return;
      const user = await userResp.json();

      // Fetch profile for name, avatar, language
      const profileRes = await fetch(
        `${SUPABASE_URL}/rest/v1/profiles?id=eq.${user.id}&select=first_name,last_name,avatar_url,language`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            apikey: SUPABASE_ANON_KEY,
          },
        }
      );
      const profiles = await profileRes.json();
      const profile = profiles?.[0] || {};

      this.account = {
        email: user.email,
        user_id: user.id,
        first_name: profile.first_name || '',
        last_name: profile.last_name || '',
        avatar_url: profile.avatar_url || null,
        language: profile.language || 'en',
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      };

      await window.electronAPI.saveAccount(this.account);
      this.showLoggedIn(user, profile);
      this.updateGreeting();
      if (this.account.language && window.setLanguage) {
        window.setLanguage(this.account.language);
      }

      // Close onboarding if it's still showing
      if (this.obOverlay) {
        this.obOverlay.style.display = 'none';
        localStorage.setItem('sivara-onboarded-v2', 'true');
      }

      console.log('[SessionSync] Synced from web:', this.account.email);
    } catch (err) {
      console.log('[SessionSync] Sync error:', err.message);
    }
  }

  // ---- Account Management ----

  async loadAccount() {
    try {
      const data = await window.electronAPI.getAccount();
      if (data && data.access_token) {
        // Verify the token is still valid
        const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
          headers: {
            Authorization: `Bearer ${data.access_token}`,
            apikey: SUPABASE_ANON_KEY,
          },
        });

        if (res.ok) {
          const user = await res.json();
          this.account = { ...data, user };
          this.showLoggedIn(user, data); // passing profile from local cache if saved
          if (this.account?.language && window.setLanguage) {
              window.setLanguage(this.account.language);
          }
        } else {
          // Token expired — try refresh
          const refreshed = await this.refreshToken(data.refresh_token);
          if (!refreshed) {
            await window.electronAPI.deleteAccount();
          }
        }
      }
    } catch (err) {
      console.error('Account load error:', err);
    }
  }

  async handleLogin() {
    // Web-based: open login page in a tab instead of local form
    this.accountPanel.style.display = 'none';
    this.navigate('https://account.sivara.ca/login');
  }

  async refreshToken(refreshToken) {
    try {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (!res.ok) return false;

      const data = await res.json();
      const accountData = {
        ...this.account,
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      };

      await window.electronAPI.saveAccount(accountData);
      this.account = { ...accountData, user: data.user };
      this.showLoggedIn(data.user);
      return true;
    } catch (_) {
      return false;
    }
  }

  async handleLogout() {
    await window.electronAPI.deleteAccount();
    this.account = null;
    this.showLoggedOut();
    this.accountPanel.style.display = 'none';
  }

  showLoggedIn(user, profile) {
    this.accountLoggedOut.style.display = 'none';
    this.accountLoggedIn.style.display = 'block';

    const name =
      (this.account?.first_name && this.account?.last_name)
        ? `${this.account.first_name} ${this.account.last_name}`
        : user.email?.split('@')[0] || 'Utilisateur';

    this.profileName.textContent = name;
    this.profileEmail.textContent = user.email || this.account?.email || '';

    // Avatar
    const avatarUrl = this.account?.avatar_url || profile?.avatar_url;
    if (avatarUrl) {
      this.accountAvatar.innerHTML = `<img src="${avatarUrl}" alt="Avatar">`;
      this.profileAvatarLarge.innerHTML = `<img src="${avatarUrl}" alt="Avatar">`;
    }
    this.accountAvatar.classList.add('logged-in');
  }

  showLoggedOut() {
    this.accountLoggedOut.style.display = 'block';
    this.accountLoggedIn.style.display = 'none';
    this.accountAvatar.classList.remove('logged-in');
    this.accountAvatar.innerHTML = `<svg width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="5" r="3" stroke="currentColor" stroke-width="1.2" fill="none"/><path d="M2 14c0-3.3 2.7-5 6-5s6 1.7 6 5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" fill="none"/></svg>`;
    this.profileAvatarLarge.innerHTML = `<svg width="32" height="32" viewBox="0 0 32 32"><circle cx="16" cy="12" r="5" stroke="currentColor" stroke-width="1.5" fill="none"/><path d="M6 28c0-5.5 4.5-8 10-8s10 2.5 10 8" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>`;
  }

  showLoginError(msg) {
    this.loginError.textContent = msg;
    this.loginError.style.display = 'block';
  }

  // ---- .sivara File Handling ----

  async openSivaraFileDialog() {
    try {
      if (!window.electronAPI?.openSivaraDialog) {
        console.error('[File] openSivaraDialog not available');
        return;
      }
      const filePath = await window.electronAPI.openSivaraDialog();
      if (filePath) this.openSivaraEditor(filePath);
    } catch (err) {
      console.error('[File] Error:', err);
    }
  }

  openSivaraEditor(filePath) {
    // Store the file path in main process so editor page can pick it up
    window.electronAPI.setPendingFile(filePath).then(() => {
      window.location.href = 'sivara-editor.html';
    });
  }

  // ---- Sync ----

  async handleSync() {
    if (!this.account) {
      alert('Vous devez être connecté pour synchroniser.');
      return;
    }

    try {
      const queue = await window.electronAPI.getSyncQueue();
      if (queue.length === 0) {
        alert('Aucun document à synchroniser.');
        return;
      }

      alert(`${queue.length} document(s) en attente de synchronisation.\nCette fonctionnalité sera disponible prochainement.`);
    } catch (err) {
      console.error('Sync error:', err);
    }
  }

  // ---- Tab Management ----

  createNewTab(url = null) {
    const tabId = this.tabIdCounter++;
    const tab = {
      id: tabId,
      title: window.t('tab.new'),
      url: url || this.homePage,
      webview: null,
      isLoading: false,
    };

    this.tabs.push(tab);
    this.renderTab(tab);

    if (url) {
      this.createWebview(tab, url);
    }

    this.switchToTab(tabId);
    return tab;
  }

  renderTab(tab) {
    const tabEl = document.createElement('div');
    tabEl.className = 'tab';
    tabEl.dataset.tabId = tab.id;

    tabEl.innerHTML = `
      <div class="tab-favicon">
        <svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.2" fill="none"/></svg>
      </div>
      <span class="tab-title">${tab.title}</span>
      <button class="tab-close" title="Fermer l'onglet">
        <svg width="10" height="10" viewBox="0 0 10 10"><path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
      </button>
    `;

    tabEl.addEventListener('click', (e) => {
      if (!e.target.closest('.tab-close')) {
        this.switchToTab(tab.id);
      }
    });

    tabEl.querySelector('.tab-close').addEventListener('click', (e) => {
      e.stopPropagation();
      this.closeTab(tab.id);
    });

    this.tabsContainer.appendChild(tabEl);
  }

  switchToTab(tabId) {
    this.activeTabId = tabId;
    const tab = this.getTab(tabId);

    // Update tab UI
    document.querySelectorAll('.tab').forEach((el) => el.classList.remove('active'));
    const tabEl = document.querySelector(`.tab[data-tab-id="${tabId}"]`);
    if (tabEl) tabEl.classList.add('active');

    // Show/hide webviews
    document.querySelectorAll('#browser-content webview').forEach((wv) => {
      wv.classList.remove('active');
    });

    if (tab.webview) {
      tab.webview.classList.add('active');
      this.newTabPage.classList.remove('active');
      this.updateUrlBar(tab.url);
      this.updateNavButtons(tab.webview);
    } else {
      this.newTabPage.classList.add('active');
      this.urlBar.value = '';
      this.btnBack.disabled = true;
      this.btnForward.disabled = true;
      this.ntpSearchInput.focus();
    }

    this.updateSecurityIcon(tab.url);
  }

  closeTab(tabId) {
    const tabIndex = this.tabs.findIndex((t) => t.id === tabId);
    if (tabIndex === -1) return;

    const tab = this.tabs[tabIndex];

    // Clean up session polling interval
    if (tab._sessionPollId) {
      clearInterval(tab._sessionPollId);
    }

    // Remove webview
    if (tab.webview) {
      tab.webview.remove();
    }

    // Remove tab element
    const tabEl = document.querySelector(`.tab[data-tab-id="${tabId}"]`);
    if (tabEl) {
      tabEl.style.transition = 'all 0.2s ease';
      tabEl.style.opacity = '0';
      tabEl.style.maxWidth = '0';
      tabEl.style.padding = '0';
      tabEl.style.margin = '0';
      setTimeout(() => tabEl.remove(), 200);
    }

    this.tabs.splice(tabIndex, 1);

    // If we closed the active tab
    if (this.activeTabId === tabId) {
      if (this.tabs.length > 0) {
        const nextTab = this.tabs[Math.min(tabIndex, this.tabs.length - 1)];
        this.switchToTab(nextTab.id);
      } else {
        // No tabs left, create a new one
        this.createNewTab();
      }
    }
  }

  getTab(tabId) {
    return this.tabs.find((t) => t.id === tabId);
  }

  // ---- Navigation ----

  navigate(url) {
    const tab = this.getTab(this.activeTabId);
    if (!tab) return;

    if (!tab.webview) {
      this.createWebview(tab, url);
    } else {
      tab.webview.loadURL(url);
    }

    tab.url = url;
    this.newTabPage.classList.remove('active');
    this.updateUrlBar(url);
    this.updateSecurityIcon(url);
  }

  navigateFromUrlBar() {
    const input = this.urlBar.value.trim();
    if (!input) return;

    const url = this.buildUrl(input);
    this.navigate(url);
    this.urlBar.blur();
  }

  buildUrl(input) {
    // Check if it looks like a URL
    if (/^https?:\/\//i.test(input)) {
      return input;
    }
    if (/^[\w-]+\.[a-z]{2,}/i.test(input) && !input.includes(' ')) {
      return 'https://' + input;
    }
    // Otherwise, search
    return this.defaultSearchEngine + encodeURIComponent(input);
  }

  goBack() {
    const tab = this.getTab(this.activeTabId);
    if (tab && tab.webview && tab.webview.canGoBack()) {
      tab.webview.goBack();
    }
  }

  goForward() {
    const tab = this.getTab(this.activeTabId);
    if (tab && tab.webview && tab.webview.canGoForward()) {
      tab.webview.goForward();
    }
  }

  reload() {
    const tab = this.getTab(this.activeTabId);
    if (tab && tab.webview) {
      tab.webview.reload();
    }
  }

  goHome() {
    const tab = this.getTab(this.activeTabId);
    if (!tab) return;

    if (tab.webview) {
      tab.webview.classList.remove('active');
      tab.webview.remove();
      tab.webview = null;
    }

    tab.url = this.homePage;
    tab.title = window.t('tab.new');
    this.updateTabTitle(tab.id, tab.title);
    this.newTabPage.classList.add('active');
    this.urlBar.value = '';
    this.btnBack.disabled = true;
    this.btnForward.disabled = true;
    this.ntpSearchInput.focus();
  }

  // ---- Webview Management ----

  createWebview(tab, url) {
    const webview = document.createElement('webview');
    webview.setAttribute('src', url);
    webview.setAttribute('autosize', 'on');
    webview.classList.add('active');

    // Events
    webview.addEventListener('did-start-loading', () => {
      tab.isLoading = true;
      this.showLoading();
      this.updateTabLoading(tab.id, true);
    });

    webview.addEventListener('did-stop-loading', () => {
      tab.isLoading = false;
      this.hideLoading();
      this.updateTabLoading(tab.id, false);
    });

    webview.addEventListener('did-navigate', (e) => {
      tab.url = e.url;
      if (this.activeTabId === tab.id) {
        this.updateUrlBar(e.url);
        this.updateNavButtons(webview);
        this.updateSecurityIcon(e.url);
      }

      // Auto-detect session changes on sivara.ca — continuous sync
      if (e.url.includes('sivara.ca')) {
        // Poll immediately after navigation and then set up repeat polling
        setTimeout(() => this.checkWebviewSessionState(webview), 2000);
        
        // Clear any existing poll interval for this tab
        if (tab._sessionPollId) clearInterval(tab._sessionPollId);
        tab._sessionPollId = setInterval(() => {
          if (tab.webview) this.checkWebviewSessionState(webview);
        }, 4000);
      }
    });

    webview.addEventListener('did-navigate-in-page', (e) => {
      tab.url = e.url;
      if (this.activeTabId === tab.id) {
        this.updateUrlBar(e.url);
        this.updateNavButtons(webview);
      }
      // SPA navigations (React Router) - check for session changes
      if (e.url.includes('sivara.ca')) {
        setTimeout(() => this.checkWebviewSessionState(webview), 1500);
      }
    });

    // Also check when page finishes loading (most reliable for SPA)
    webview.addEventListener('did-stop-loading', () => {
      const currentUrl = webview.getURL();
      if (currentUrl.includes('sivara.ca')) {
        setTimeout(() => this.checkWebviewSessionState(webview), 1500);
      }
    });

    webview.addEventListener('page-title-updated', (e) => {
      tab.title = e.title;
      this.updateTabTitle(tab.id, e.title);
    });

    webview.addEventListener('page-favicon-updated', (e) => {
      if (e.favicons && e.favicons.length > 0) {
        this.updateTabFavicon(tab.id, e.favicons[0]);
      }
    });

    webview.addEventListener('new-window', (e) => {
      e.preventDefault();
      this.createNewTab(e.url);
    });

    webview.addEventListener('did-fail-load', (e) => {
      if (e.errorCode !== -3) {
        // Ignore aborted loads
        console.error('Load failed:', e.errorDescription);
      }
    });

    tab.webview = webview;
    this.browserContent.appendChild(webview);
  }

  // ---- UI Updates ----

  updateUrlBar(url) {
    if (url === this.homePage) {
      this.urlBar.value = '';
    } else {
      this.urlBar.value = url;
    }
  }

  updateSecurityIcon(url) {
    const icon = this.urlSecurityIcon;
    if (url && url.startsWith('https://')) {
      icon.classList.add('secure');
      icon.innerHTML = `<svg width="14" height="14" viewBox="0 0 14 14"><path d="M7 1L2 3.5v3C2 10 4.2 12.5 7 13.5 9.8 12.5 12 10 12 6.5v-3L7 1z" stroke="currentColor" stroke-width="1.2" fill="none"/><path d="M5 7l1.5 1.5L9 5.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>`;
    } else {
      icon.classList.remove('secure');
      icon.innerHTML = `<svg width="14" height="14" viewBox="0 0 14 14"><path d="M7 1L2 3.5v3C2 10 4.2 12.5 7 13.5 9.8 12.5 12 10 12 6.5v-3L7 1z" stroke="currentColor" stroke-width="1.2" fill="none" opacity="0.5"/></svg>`;
    }
  }

  updateNavButtons(webview) {
    if (!webview) return;
    setTimeout(() => {
      this.btnBack.disabled = !webview.canGoBack();
      this.btnForward.disabled = !webview.canGoForward();
    }, 100);
  }

  updateTabTitle(tabId, title) {
    const tabEl = document.querySelector(`.tab[data-tab-id="${tabId}"]`);
    if (tabEl) {
      const titleEl = tabEl.querySelector('.tab-title');
      titleEl.textContent = title || 'Nouvel onglet';
      titleEl.title = title;
    }
  }

  updateTabFavicon(tabId, faviconUrl) {
    const tabEl = document.querySelector(`.tab[data-tab-id="${tabId}"]`);
    if (tabEl) {
      tabEl.dataset.faviconUrl = faviconUrl;
      const faviconEl = tabEl.querySelector('.tab-favicon');
      faviconEl.innerHTML = `<img src="${faviconUrl}" onerror="this.parentElement.innerHTML='<svg viewBox=\\'0 0 16 16\\'><circle cx=\\'8\\' cy=\\'8\\' r=\\'6\\' stroke=\\'currentColor\\' stroke-width=\\'1.2\\' fill=\\'none\\'/></svg>'">`;
    }
  }

  updateTabLoading(tabId, isLoading) {
    const tabEl = document.querySelector(`.tab[data-tab-id="${tabId}"]`);
    if (!tabEl) return;

    const faviconEl = tabEl.querySelector('.tab-favicon');
    if (isLoading) {
      faviconEl.innerHTML = '<div class="tab-loading"></div>';
    } else {
      // Restore last known favicon, or show default icon
      const lastFavicon = tabEl.dataset.faviconUrl;
      if (lastFavicon) {
        faviconEl.innerHTML = `<img src="${lastFavicon}" onerror="this.parentElement.innerHTML='<svg viewBox=\\'0 0 16 16\\'><circle cx=\\'8\\' cy=\\'8\\' r=\\'6\\' stroke=\\'currentColor\\' stroke-width=\\'1.2\\' fill=\\'none\\'/></svg>'">`;
      } else {
        faviconEl.innerHTML = '<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.2" fill="none"/></svg>';
      }
    }
  }

  showLoading() {
    this.loadingBar.className = 'loading';
  }

  hideLoading() {
    this.loadingBar.className = 'complete';
    setTimeout(() => {
      this.loadingBar.className = 'hidden';
      setTimeout(() => {
        this.loadingBar.className = '';
        this.loadingBar.style.width = '';
      }, 300);
    }, 400);
  }
}

// Initialize the browser
document.addEventListener('DOMContentLoaded', () => {
  window.browser = new SivaraBrowser();
});
