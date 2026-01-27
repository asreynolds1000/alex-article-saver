// Stash Web App (Google OAuth authentication)
// ES6 modules for modular architecture

import {
  appState,
  setSupabase,
  setUser,
  setCurrentView,
  setCurrentSave,
  setSaves,
  setTags,
  setFolders,
} from './lib/state.js';

import {
  escapeHtml,
  renderMarkdown,
  formatTime,
  getTimeAgo,
  showToast,
  getAIConfig,
  getResolvedModelDisplayName,
} from './lib/utils.js';

import {
  fetchSaves,
  fetchTags,
  fetchFolders,
  toggleArchive as toggleArchiveDB,
  toggleFavorite as toggleFavoriteDB,
  deleteSave as deleteSaveDB,
  addTagToSave as addTagToSaveDB,
  searchSaves,
  loadDigestPreferences,
  saveDigestPreferences,
  getSignedAudioUrl,
  addTagsToSave as addTagsToSaveDB,
} from './services/supabase.js';

import {
  initAudio,
  toggleAudioPlayback,
  stopAudio,
  setPlaybackSpeed,
  seekTo,
} from './services/audio.js';

import {
  processKindleFile,
  confirmImport as confirmKindleImport,
  groupHighlightsByBook,
} from './services/kindle.js';

import {
  callClaudeAPI,
  callClaudeAPIRaw,
  callOpenAIAPI,
  callOpenAIAPIRaw,
  callAI,
  callAIRaw,
} from './services/ai.js';

import {
  loadAIJobs,
  saveAIJobs,
  createAIJob,
  updateAIJob,
  updateAIJobsUI,
  renderAIJobsList,
} from './services/ai-jobs.js';

import {
  showModal,
  hideModal,
  showKindleImportModal,
  hideKindleImportModal,
  resetKindleImportModal,
  showDigestModal,
  hideDigestModal,
  updateDigestOptionsState,
  showAISettingsModal,
  hideAISettingsModal,
  updateAIProviderFields,
  showBookModal,
  hideBookModal,
  resetBookModal,
  showPodcastModal,
  hidePodcastModal,
  resetPodcastModal,
  updatePrettifyHint,
  setPendingPodcastFile,
  getPendingPodcastFile,
  showApplePodcastsModal,
  hideApplePodcastsModal,
  resetApplePodcastsModal,
  updateApplePodcastsAIHint,
  showAIJobsModal,
  hideAIJobsModal,
  bindModalCloseEvents,
} from './ui/modals.js';

import {
  openReadingPane,
  closeReadingPane,
  updateReadingProgress,
  isOpen as isReadingPaneOpen,
  getCurrentSave,
} from './ui/reading-pane.js';

import {
  renderSaveCard,
  renderBookCard,
  renderBreakdownBar,
  renderTimeline,
  getWeekDateRange,
  calculateInsightStats,
  extractTopics,
  renderTagsList,
  renderFoldersList,
  renderKindleBookCard,
  renderKindleHighlightCard,
  renderPodcastShowCard,
  renderPodcastEpisodeCard,
  renderRediscoveryCard,
  renderApplePodcastItem,
  renderImportBookItem,
} from './ui/renders.js';

class StashApp {
  constructor() {
    // Use centralized state from lib/state.js
    // Instance properties are proxies to appState for backwards compatibility
    this.init();
  }

  // Proxy getters/setters for backwards compatibility with existing code
  get supabase() { return appState.supabase; }
  set supabase(v) { setSupabase(v); }
  get user() { return appState.user; }
  set user(v) { setUser(v); }
  get currentView() { return appState.currentView; }
  set currentView(v) { setCurrentView(v); }
  get currentSave() { return appState.currentSave; }
  set currentSave(v) { setCurrentSave(v); }
  get saves() { return appState.saves; }
  set saves(v) { setSaves(v); }
  get tags() { return appState.tags; }
  set tags(v) { setTags(v); }
  get folders() { return appState.folders; }
  set folders(v) { setFolders(v); }
  get allowedEmails() { return appState.allowedEmails; }
  get aiJobs() { return appState.aiJobs; }
  get aiJobIdCounter() { return appState.aiJobIdCounter; }

  async init() {
    // Initialize Supabase
    setSupabase(window.supabase.createClient(
      CONFIG.SUPABASE_URL,
      CONFIG.SUPABASE_ANON_KEY
    ));

    // Load theme preference
    this.loadTheme();

    // Load AI jobs from localStorage (from ai-jobs service)
    loadAIJobs();

    // Refresh AI model cache in background (if keys exist)
    this.refreshModelCacheInBackground();

    // Check for existing session
    const { data: { session } } = await this.supabase.auth.getSession();

    if (session?.user) {
      // Validate email is allowed
      if (this.isEmailAllowed(session.user.email)) {
        this.user = session.user;
        this.showMainScreen();
        this.loadData();
      } else {
        // Email not allowed - sign them out
        await this.supabase.auth.signOut();
        this.showAuthScreen();
        this.showAuthError('Access denied. Your email is not authorized to use this app.');
      }
    } else {
      this.showAuthScreen();
    }

    // Listen for auth state changes (handles OAuth callback)
    this.supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        if (this.isEmailAllowed(session.user.email)) {
          this.user = session.user;
          this.showMainScreen();
          this.loadData();
        } else {
          // Email not allowed - sign them out
          await this.supabase.auth.signOut();
          this.showAuthScreen();
          this.showAuthError('Access denied. Your email is not authorized to use this app.');
        }
      } else if (event === 'SIGNED_OUT') {
        this.user = null;
        this.showAuthScreen();
      }
    });

    this.bindEvents();
  }

  isEmailAllowed(email) {
    if (!email) return false;
    return this.allowedEmails.includes(email.toLowerCase());
  }

  showAuthError(message) {
    const errorEl = document.getElementById('auth-error');
    if (errorEl) {
      errorEl.textContent = message;
    }
  }

  clearAuthError() {
    const errorEl = document.getElementById('auth-error');
    if (errorEl) {
      errorEl.textContent = '';
    }
  }

  // Theme Management
  loadTheme() {
    const savedTheme = localStorage.getItem('stash-theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    this.updateThemeToggle(savedTheme);
  }

  toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const newTheme = current === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('stash-theme', newTheme);
    this.updateThemeToggle(newTheme);
  }

  updateThemeToggle(theme) {
    const sunIcon = document.querySelector('.sun-icon');
    const moonIcon = document.querySelector('.moon-icon');
    const label = document.querySelector('.theme-label');

    if (theme === 'dark') {
      sunIcon?.classList.add('hidden');
      moonIcon?.classList.remove('hidden');
      if (label) label.textContent = 'Light Mode';
    } else {
      sunIcon?.classList.remove('hidden');
      moonIcon?.classList.add('hidden');
      if (label) label.textContent = 'Dark Mode';
    }
  }

  bindEvents() {
    // Google sign-in button
    document.getElementById('google-signin-btn').addEventListener('click', () => {
      this.signInWithGoogle();
    });

    document.getElementById('signout-btn').addEventListener('click', () => {
      this.signOut();
    });

    // Navigation
    document.querySelectorAll('.nav-item[data-view]').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const view = item.dataset.view;
        this.setView(view);
      });
    });

    // Search
    let searchTimeout;
    document.getElementById('search-input').addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        this.search(e.target.value);
      }, 300);
    });

    // Sort
    document.getElementById('sort-select').addEventListener('change', (e) => {
      this.loadSaves();
    });

    // Reading pane
    document.getElementById('close-reading-btn').addEventListener('click', () => {
      this.closeReadingPane();
    });

    document.getElementById('archive-btn').addEventListener('click', () => {
      this.toggleArchive();
    });

    document.getElementById('favorite-btn').addEventListener('click', () => {
      this.toggleFavorite();
    });

    document.getElementById('delete-btn').addEventListener('click', () => {
      this.deleteSave();
    });

    document.getElementById('add-tag-btn').addEventListener('click', () => {
      this.addTagToSave();
    });

    // Mobile menu
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('sidebar-overlay');

    document.getElementById('mobile-menu-btn').addEventListener('click', () => {
      sidebar.classList.add('open');
      overlay.classList.add('open');
    });

    overlay.addEventListener('click', () => {
      sidebar.classList.remove('open');
      overlay.classList.remove('open');
    });

    // Close sidebar when nav item clicked on mobile
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', () => {
        if (window.innerWidth <= 768) {
          sidebar.classList.remove('open');
          overlay.classList.remove('open');
        }
      });
    });

    // Add folder
    document.getElementById('add-folder-btn').addEventListener('click', () => {
      this.addFolder();
    });

    // Theme toggle
    document.getElementById('theme-toggle').addEventListener('click', () => {
      this.toggleTheme();
    });

    // Reading progress bar
    const readingContent = document.getElementById('reading-content');
    if (readingContent) {
      readingContent.addEventListener('scroll', () => {
        this.updateReadingProgress();
      });
    }

    // Audio player controls
    document.getElementById('audio-play-btn').addEventListener('click', () => {
      this.toggleAudioPlayback();
    });

    document.getElementById('audio-speed').addEventListener('change', (e) => {
      if (this.audio) {
        this.audio.playbackRate = parseFloat(e.target.value);
      }
    });

    document.getElementById('audio-progress-bar').addEventListener('click', (e) => {
      if (this.audio && this.audio.duration) {
        const rect = e.target.getBoundingClientRect();
        const percent = (e.clientX - rect.left) / rect.width;
        this.audio.currentTime = percent * this.audio.duration;
      }
    });

    // Kindle Import
    document.getElementById('kindle-import-btn').addEventListener('click', () => {
      this.showKindleImportModal();
    });

    const kindleModal = document.getElementById('kindle-import-modal');
    const kindleDropzone = document.getElementById('kindle-dropzone');
    const kindleFileInput = document.getElementById('kindle-file-input');

    // Modal close handlers
    kindleModal.querySelector('.modal-overlay').addEventListener('click', () => {
      this.hideKindleImportModal();
    });
    kindleModal.querySelector('.modal-close-btn').addEventListener('click', () => {
      this.hideKindleImportModal();
    });
    document.getElementById('kindle-cancel-btn').addEventListener('click', () => {
      this.hideKindleImportModal();
    });
    document.getElementById('kindle-confirm-btn').addEventListener('click', () => {
      this.confirmKindleImport();
    });

    // Dropzone interactions
    kindleDropzone.addEventListener('click', () => {
      kindleFileInput.click();
    });

    kindleFileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        this.handleKindleFile(e.target.files[0]);
      }
    });

    // Drag and drop
    kindleDropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      kindleDropzone.classList.add('dragover');
    });

    kindleDropzone.addEventListener('dragleave', () => {
      kindleDropzone.classList.remove('dragover');
    });

    kindleDropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      kindleDropzone.classList.remove('dragover');
      if (e.dataTransfer.files.length > 0) {
        this.handleKindleFile(e.dataTransfer.files[0]);
      }
    });

    // Digest Settings Modal
    const digestModal = document.getElementById('digest-modal');

    document.getElementById('digest-settings-btn').addEventListener('click', () => {
      this.showDigestModal();
    });

    digestModal.querySelector('.modal-overlay').addEventListener('click', () => {
      this.hideDigestModal();
    });
    digestModal.querySelector('.modal-close-btn').addEventListener('click', () => {
      this.hideDigestModal();
    });
    document.getElementById('digest-cancel-btn').addEventListener('click', () => {
      this.hideDigestModal();
    });
    document.getElementById('digest-save-btn').addEventListener('click', () => {
      this.saveDigestPreferences();
    });

    // Toggle enabled/disabled state of options
    document.getElementById('digest-enabled').addEventListener('change', () => {
      this.updateDigestOptionsState();
    });

    // AI Jobs Modal
    const aiJobsModal = document.getElementById('ai-jobs-modal');
    if (aiJobsModal) {
      document.getElementById('ai-jobs-btn').addEventListener('click', () => {
        this.showAIJobsModal();
      });

      aiJobsModal.querySelector('.modal-overlay').addEventListener('click', () => {
        this.hideAIJobsModal();
      });
      aiJobsModal.querySelector('.modal-close-btn').addEventListener('click', () => {
        this.hideAIJobsModal();
      });
    }

    // AI Settings Modal
    const aiSettingsModal = document.getElementById('ai-settings-modal');
    if (aiSettingsModal) {
      document.getElementById('ai-settings-btn').addEventListener('click', () => {
        this.showAISettingsModal();
      });

      aiSettingsModal.querySelector('.modal-overlay').addEventListener('click', () => {
        this.hideAISettingsModal();
      });
      aiSettingsModal.querySelector('.modal-close-btn').addEventListener('click', () => {
        this.hideAISettingsModal();
      });
      document.getElementById('ai-settings-cancel-btn').addEventListener('click', () => {
        this.hideAISettingsModal();
      });
      document.getElementById('ai-settings-save-btn').addEventListener('click', () => {
        this.saveAISettings();
      });

      // Update fields when provider changes
      document.getElementById('ai-provider').addEventListener('change', () => {
        this.updateAIProviderFields();
      });

      // Toggle password visibility
      document.querySelectorAll('.api-key-toggle').forEach(btn => {
        btn.addEventListener('click', () => {
          const input = document.getElementById(btn.dataset.target);
          input.type = input.type === 'password' ? 'text' : 'password';
        });
      });

      // Validate Key buttons
      document.getElementById('claude-key-validate').addEventListener('click', () => {
        this.validateClaudeKey();
      });
      document.getElementById('openai-key-validate').addEventListener('click', () => {
        this.validateOpenAIKey();
      });

      // Reset Key buttons
      document.getElementById('claude-key-reset').addEventListener('click', () => {
        this.resetClaudeKey();
      });
      document.getElementById('openai-key-reset').addEventListener('click', () => {
        this.resetOpenAIKey();
      });

      // Tier selection change - update hint
      document.querySelectorAll('input[name="ai-tier"]').forEach(radio => {
        radio.addEventListener('change', () => {
          this.updateTierHint();
        });
      });
    }

    // Podcast Modal
    const podcastModal = document.getElementById('podcast-modal');
    if (podcastModal) {
      document.getElementById('podcast-add-btn').addEventListener('click', () => {
        this.showPodcastModal();
      });

      podcastModal.querySelector('.modal-overlay').addEventListener('click', () => {
        this.hidePodcastModal();
      });
      podcastModal.querySelector('.modal-close-btn').addEventListener('click', () => {
        this.hidePodcastModal();
      });
      document.getElementById('podcast-cancel-btn').addEventListener('click', () => {
        this.hidePodcastModal();
      });
      document.getElementById('podcast-save-btn').addEventListener('click', () => {
        this.savePodcastTranscript();
      });

      // Tab switching
      document.querySelectorAll('.podcast-tab').forEach(tab => {
        tab.addEventListener('click', () => {
          document.querySelectorAll('.podcast-tab').forEach(t => t.classList.remove('active'));
          tab.classList.add('active');
          const tabId = tab.dataset.tab;
          document.getElementById('paste-tab').classList.toggle('hidden', tabId !== 'paste');
          document.getElementById('upload-tab').classList.toggle('hidden', tabId !== 'upload');
        });
      });

      // Podcast file dropzone
      const podcastDropzone = document.getElementById('podcast-dropzone');
      const podcastFileInput = document.getElementById('podcast-file-input');

      podcastDropzone.addEventListener('click', () => {
        podcastFileInput.click();
      });

      podcastFileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
          this.handlePodcastFile(e.target.files[0]);
        }
      });

      podcastDropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        podcastDropzone.classList.add('dragover');
      });

      podcastDropzone.addEventListener('dragleave', () => {
        podcastDropzone.classList.remove('dragover');
      });

      podcastDropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        podcastDropzone.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) {
          this.handlePodcastFile(e.dataTransfer.files[0]);
        }
      });
    }

    // Book Modal
    const bookModal = document.getElementById('book-modal');
    if (bookModal) {
      document.getElementById('book-add-btn').addEventListener('click', () => {
        this.showBookModal();
      });

      bookModal.querySelector('.modal-overlay').addEventListener('click', () => {
        this.hideBookModal();
      });
      bookModal.querySelector('.modal-close-btn').addEventListener('click', () => {
        this.hideBookModal();
      });
      document.getElementById('book-cancel-btn').addEventListener('click', () => {
        this.hideBookModal();
      });
      document.getElementById('book-save-btn').addEventListener('click', () => {
        this.saveBook();
      });
      document.getElementById('book-search-btn').addEventListener('click', () => {
        this.searchBooks();
      });
      document.getElementById('book-search').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          this.searchBooks();
        }
      });
      document.getElementById('book-clear-selection').addEventListener('click', () => {
        this.clearBookSelection();
      });
    }

    // Apple Podcasts Import Modal
    const applePodcastsModal = document.getElementById('apple-podcasts-modal');
    if (applePodcastsModal) {
      document.getElementById('apple-podcasts-import-btn').addEventListener('click', () => {
        this.showApplePodcastsModal();
      });

      applePodcastsModal.querySelector('.modal-overlay').addEventListener('click', () => {
        this.hideApplePodcastsModal();
      });
      applePodcastsModal.querySelector('.modal-close-btn').addEventListener('click', () => {
        this.hideApplePodcastsModal();
      });
      document.getElementById('apple-podcasts-cancel-btn').addEventListener('click', () => {
        this.hideApplePodcastsModal();
      });
      document.getElementById('apple-podcasts-import-btn-confirm').addEventListener('click', () => {
        this.confirmApplePodcastsImport();
      });

      // Apple Podcasts dropzone - supports folder drag and drop
      const applePodcastsDropzone = document.getElementById('apple-podcasts-dropzone');

      applePodcastsDropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        applePodcastsDropzone.classList.add('dragover');
      });

      applePodcastsDropzone.addEventListener('dragleave', () => {
        applePodcastsDropzone.classList.remove('dragover');
      });

      applePodcastsDropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        applePodcastsDropzone.classList.remove('dragover');
        this.handleApplePodcastsDrop(e);
      });
    }
  }

  showAuthScreen() {
    document.getElementById('auth-screen').classList.remove('hidden');
    document.getElementById('main-screen').classList.add('hidden');
  }

  showMainScreen() {
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('main-screen').classList.remove('hidden');
  }

  async signInWithGoogle() {
    const btn = document.getElementById('google-signin-btn');
    this.clearAuthError();

    btn.disabled = true;
    btn.innerHTML = `
      <div class="spinner" style="width: 18px; height: 18px;"></div>
      Signing in...
    `;

    const { error } = await this.supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: 'https://stash.alexreynolds.com',
      },
    });

    if (error) {
      this.showAuthError(error.message);
      btn.disabled = false;
      btn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        Sign in with Google
      `;
    }
    // If successful, the page will redirect to Google OAuth
  }

  async signOut() {
    await this.supabase.auth.signOut();
    this.user = null;
    this.showAuthScreen();
  }

  async loadData() {
    await Promise.all([
      this.loadSaves(),
      this.loadTags(),
      this.loadFolders(),
    ]);
  }

  async loadSaves() {
    const container = document.getElementById('saves-container');
    const loading = document.getElementById('loading');
    const empty = document.getElementById('empty-state');

    loading.classList.remove('hidden');
    container.innerHTML = '';

    const sortValue = document.getElementById('sort-select').value;
    const [column, direction] = sortValue.split('.');

    let query = this.supabase
      .from('saves')
      .select('*')
      .order(column, { ascending: direction === 'asc' });

    // Apply view filters
    if (this.currentView === 'highlights') {
      query = query.not('highlight', 'is', null);
    } else if (this.currentView === 'articles') {
      // Articles: no highlight, not a podcast, not a book
      query = query.is('highlight', null)
        .or('content_type.is.null,content_type.eq.article');
    } else if (this.currentView === 'archived') {
      query = query.eq('is_archived', true);
    } else if (this.currentView === 'weekly') {
      // Weekly review - get this week's saves
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      query = query.gte('created_at', weekAgo.toISOString());
    } else {
      query = query.eq('is_archived', false);
    }

    const { data, error } = await query;

    loading.classList.add('hidden');

    if (error) {
      console.error('Error loading saves:', error);
      return;
    }

    this.saves = data || [];

    if (this.saves.length === 0) {
      empty.classList.remove('hidden');
    } else {
      empty.classList.add('hidden');
      // Use special rendering for weekly view
      if (this.currentView === 'weekly') {
        this.renderWeeklyReview();
      } else {
        this.renderSaves();
      }
    }
  }

  renderSaves() {
    const container = document.getElementById('saves-container');

    container.innerHTML = this.saves.map(save => {
      const isHighlight = !!save.highlight;
      const date = new Date(save.created_at).toLocaleDateString();

      if (isHighlight) {
        return `
          <div class="save-card highlight" data-id="${save.id}">
            <div class="save-card-content">
              <div class="save-card-site">${this.escapeHtml(save.site_name || '')}</div>
              <div class="save-card-highlight">"${this.escapeHtml(save.highlight)}"</div>
              <div class="save-card-title">${this.escapeHtml(save.title || 'Untitled')}</div>
              <div class="save-card-meta">
                <span class="save-card-date">${date}</span>
              </div>
            </div>
          </div>
        `;
      }

      return `
        <div class="save-card" data-id="${save.id}">
          ${save.image_url ? `<img class="save-card-image" src="${save.image_url}" alt="" onerror="this.style.display='none'">` : ''}
          <div class="save-card-content">
            <div class="save-card-site">${this.escapeHtml(save.site_name || '')}</div>
            <div class="save-card-title">${this.escapeHtml(save.title || 'Untitled')}</div>
            <div class="save-card-excerpt">${this.escapeHtml(save.excerpt || '')}</div>
            <div class="save-card-meta">
              <span class="save-card-date">${date}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Bind click events
    container.querySelectorAll('.save-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.dataset.id;
        const save = this.saves.find(s => s.id === id);
        if (save) this.openReadingPane(save);
      });
    });
  }

  // Weekly Review special rendering
  renderWeeklyReview() {
    const container = document.getElementById('saves-container');

    // Calculate stats
    const articles = this.saves.filter(s => !s.highlight);
    const highlights = this.saves.filter(s => s.highlight);
    const totalWords = articles.reduce((sum, s) => {
      const words = (s.content || '').split(/\s+/).length;
      return sum + words;
    }, 0);

    // Get unique sites
    const sites = [...new Set(this.saves.map(s => s.site_name).filter(Boolean))];

    // Pick a random "rediscovery" from older saves
    let rediscovery = null;
    const allSavesQuery = this.supabase
      .from('saves')
      .select('*')
      .lt('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .limit(50);

    allSavesQuery.then(({ data }) => {
      if (data && data.length > 0) {
        rediscovery = data[Math.floor(Math.random() * data.length)];
        this.updateRediscovery(rediscovery);
      }
    });

    container.innerHTML = `
      <div class="weekly-review">
        <div class="weekly-header">
          <h3>Your Week in Review</h3>
          <p class="weekly-dates">${this.getWeekDateRange()}</p>
        </div>

        <div class="weekly-stats">
          <div class="weekly-stat">
            <span class="weekly-stat-value">${this.saves.length}</span>
            <span class="weekly-stat-label">items saved</span>
          </div>
          <div class="weekly-stat">
            <span class="weekly-stat-value">${articles.length}</span>
            <span class="weekly-stat-label">articles</span>
          </div>
          <div class="weekly-stat">
            <span class="weekly-stat-value">${highlights.length}</span>
            <span class="weekly-stat-label">highlights</span>
          </div>
          <div class="weekly-stat">
            <span class="weekly-stat-value">${Math.round(totalWords / 1000)}k</span>
            <span class="weekly-stat-label">words</span>
          </div>
        </div>

        ${sites.length > 0 ? `
          <div class="weekly-section">
            <h4>Sources</h4>
            <div class="weekly-sources">
              ${sites.slice(0, 10).map(site => `<span class="weekly-source">${this.escapeHtml(site)}</span>`).join('')}
            </div>
          </div>
        ` : ''}

        <div class="weekly-section" id="rediscovery-section">
          <h4>Rediscover</h4>
          <p class="weekly-rediscovery-hint">Loading a random gem from your archive...</p>
        </div>

        <div class="weekly-section">
          <h4>This Week's Saves</h4>
        </div>

        <div class="saves-grid">
          ${this.saves.map(save => this.renderSaveCard(save)).join('')}
        </div>
      </div>
    `;

    // Bind click events
    container.querySelectorAll('.save-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.dataset.id;
        const save = this.saves.find(s => s.id === id);
        if (save) this.openReadingPane(save);
      });
    });
  }

  updateRediscovery(save) {
    const section = document.getElementById('rediscovery-section');
    if (!section || !save) return;

    const date = new Date(save.created_at).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });

    section.innerHTML = `
      <h4>Rediscover</h4>
      <div class="rediscovery-card" data-id="${save.id}">
        <div class="rediscovery-meta">Saved ${date}</div>
        <div class="rediscovery-title">${this.escapeHtml(save.title || 'Untitled')}</div>
        ${save.highlight ? `<div class="rediscovery-highlight">"${this.escapeHtml(save.highlight)}"</div>` : ''}
        <div class="rediscovery-source">${this.escapeHtml(save.site_name || '')}</div>
      </div>
    `;

    section.querySelector('.rediscovery-card')?.addEventListener('click', () => {
      this.openReadingPane(save);
    });
  }

  renderSaveCard(save) {
    const isHighlight = !!save.highlight;
    const date = new Date(save.created_at).toLocaleDateString();

    if (isHighlight) {
      return `
        <div class="save-card highlight" data-id="${save.id}">
          <div class="save-card-content">
            <div class="save-card-site">${this.escapeHtml(save.site_name || '')}</div>
            <div class="save-card-highlight">"${this.escapeHtml(save.highlight)}"</div>
            <div class="save-card-title">${this.escapeHtml(save.title || 'Untitled')}</div>
            <div class="save-card-meta">
              <span class="save-card-date">${date}</span>
            </div>
          </div>
        </div>
      `;
    }

    return `
      <div class="save-card" data-id="${save.id}">
        ${save.image_url ? `<img class="save-card-image" src="${save.image_url}" alt="" onerror="this.style.display='none'">` : ''}
        <div class="save-card-content">
          <div class="save-card-site">${this.escapeHtml(save.site_name || '')}</div>
          <div class="save-card-title">${this.escapeHtml(save.title || 'Untitled')}</div>
          <div class="save-card-excerpt">${this.escapeHtml(save.excerpt || '')}</div>
          <div class="save-card-meta">
            <span class="save-card-date">${date}</span>
          </div>
        </div>
      </div>
    `;
  }

  getWeekDateRange() {
    const now = new Date();
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const options = { month: 'short', day: 'numeric' };
    return `${weekAgo.toLocaleDateString('en-US', options)} - ${now.toLocaleDateString('en-US', options)}`;
  }

  async loadTags() {
    const { data } = await this.supabase
      .from('tags')
      .select('*')
      .order('name');

    this.tags = data || [];
    this.renderTags();
  }

  renderTags() {
    const container = document.getElementById('tags-list');
    container.innerHTML = this.tags.map(tag => `
      <span class="tag" data-id="${tag.id}">${this.escapeHtml(tag.name)}</span>
    `).join('');

    container.querySelectorAll('.tag').forEach(el => {
      el.addEventListener('click', () => {
        // TODO: Filter by tag
      });
    });
  }

  async loadFolders() {
    const { data } = await this.supabase
      .from('folders')
      .select('*')
      .order('name');

    this.folders = data || [];
    this.renderFolders();
  }

  renderFolders() {
    const container = document.getElementById('folders-list');
    container.innerHTML = this.folders.map(folder => `
      <a href="#" class="nav-item" data-folder="${folder.id}">
        <span style="color: ${folder.color}">📁</span>
        ${this.escapeHtml(folder.name)}
      </a>
    `).join('');
  }

  setView(view) {
    this.currentView = view;

    // Update nav
    document.querySelectorAll('.nav-item[data-view]').forEach(item => {
      item.classList.toggle('active', item.dataset.view === view);
    });

    // Update title
    const titles = {
      all: 'All Saves',
      highlights: 'Highlights',
      articles: 'Articles',
      kindle: 'Kindle Highlights',
      podcasts: 'Podcasts',
      books: 'Books',
      archived: 'Archived',
      weekly: 'Weekly Review',
      insights: 'Insights',
      stats: 'Stats',
    };
    document.getElementById('view-title').textContent = titles[view] || 'Saves';

    if (view === 'stats') {
      this.showStats();
    } else if (view === 'kindle') {
      this.loadKindleHighlights();
    } else if (view === 'podcasts') {
      this.loadPodcasts();
    } else if (view === 'books') {
      this.loadBooks();
    } else if (view === 'insights') {
      this.loadInsights();
    } else {
      this.loadSaves();
    }
  }

  async search(query) {
    if (!query.trim()) {
      this.loadSaves();
      return;
    }

    const { data } = await this.supabase.rpc('search_saves', {
      search_query: query,
      user_uuid: this.user.id,
    });

    this.saves = data || [];
    this.renderSaves();
  }

  openReadingPane(save) {
    this.currentSave = save;
    const pane = document.getElementById('reading-pane');

    // Stop any existing audio
    this.stopAudio();

    document.getElementById('reading-title').textContent = save.title || 'Untitled';
    document.getElementById('reading-meta').innerHTML = `
      ${save.site_name || ''} ${save.author ? `· ${save.author}` : ''} · ${new Date(save.created_at).toLocaleDateString()}
    `;

    // Handle audio player visibility
    const audioPlayer = document.getElementById('audio-player');
    const audioGenerating = document.getElementById('audio-generating');

    if (save.audio_url) {
      // Audio is ready - show player
      audioPlayer.classList.remove('hidden');
      audioGenerating.classList.add('hidden');
      this.initAudio(save.audio_url);
    } else if (save.content_type === 'podcast' || save.content_type === 'book') {
      // Podcasts and books don't need TTS audio
      audioPlayer.classList.add('hidden');
      audioGenerating.classList.add('hidden');
    } else if (save.content && save.content.length > 100 && !save.highlight) {
      // Content exists but no audio yet - show generating indicator
      audioPlayer.classList.add('hidden');
      audioGenerating.classList.remove('hidden');
    } else {
      // No audio applicable (highlights, short content)
      audioPlayer.classList.add('hidden');
      audioGenerating.classList.add('hidden');
    }

    if (save.highlight) {
      document.getElementById('reading-body').innerHTML = `
        <blockquote style="font-style: italic; background: #fef3c7; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          "${this.escapeHtml(save.highlight)}"
        </blockquote>
        <p><a href="${save.url}" target="_blank" style="color: var(--primary);">View original →</a></p>
      `;
    } else if (save.content_type === 'podcast') {
      // Podcast transcript view
      const keyPoints = save.podcast_metadata?.key_points;
      const isProcessed = save.podcast_metadata?.processed;

      let html = '';

      // Show AI enrich button
      html += `
        <button class="prettify-btn ai-enrich-btn" onclick="app.aiEnrichContent()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
          </svg>
          ${isProcessed ? 'Re-enrich with AI' : 'AI Enrich'}
        </button>
      `;

      // Show key points if available
      if (keyPoints && keyPoints.length > 0) {
        html += `
          <div class="podcast-key-points" style="margin-bottom: 20px;">
            <h4>Key Points</h4>
            <ul>
              ${keyPoints.map(point => `<li>${this.escapeHtml(point)}</li>`).join('')}
            </ul>
          </div>
        `;
      }

      // Show transcript
      const content = save.content || save.excerpt || 'No content available.';
      html += this.renderMarkdown(content);

      document.getElementById('reading-body').innerHTML = html;
    } else if (save.content_type === 'book') {
      // Book view - parse JSON content and display nicely
      let html = '';
      let bookData = {};

      try {
        bookData = JSON.parse(save.content || '{}');
      } catch (e) {
        bookData = { description: save.content || save.excerpt || '' };
      }

      // Show AI enrich button
      const hasKeyPoints = save.ai_metadata?.key_points?.length > 0;
      html += `
        <button class="prettify-btn ai-enrich-btn" onclick="app.aiEnrichContent()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
          </svg>
          ${hasKeyPoints ? 'Re-enrich with AI' : 'AI Enrich'}
        </button>
      `;

      // Show AI-generated key points if available
      if (save.ai_metadata?.key_points?.length > 0) {
        html += `
          <div class="book-key-points" style="margin-bottom: 24px;">
            <h4 style="margin: 0 0 12px; font-size: 15px; font-weight: 600; color: var(--text);">Key Points</h4>
            <ul style="margin: 0; padding-left: 20px;">
              ${save.ai_metadata.key_points.map(point => `<li style="margin-bottom: 8px; line-height: 1.5;">${this.escapeHtml(point)}</li>`).join('')}
            </ul>
          </div>
        `;
      }

      // Book metadata section
      const metadata = bookData.metadata || {};
      if (metadata.yearRead || metadata.pageCount || metadata.categories) {
        html += `
          <div class="book-metadata" style="display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 24px; padding: 16px; background: var(--bg-secondary); border-radius: var(--radius);">
            ${metadata.yearRead ? `
              <div class="book-meta-item">
                <span style="font-size: 12px; color: var(--text-muted); display: block;">Year Read</span>
                <span style="font-size: 14px; font-weight: 600; color: var(--text);">${metadata.yearRead}</span>
              </div>
            ` : ''}
            ${metadata.dateRead ? `
              <div class="book-meta-item">
                <span style="font-size: 12px; color: var(--text-muted); display: block;">Date Read</span>
                <span style="font-size: 14px; font-weight: 600; color: var(--text);">${new Date(metadata.dateRead).toLocaleDateString()}</span>
              </div>
            ` : ''}
            ${metadata.pageCount ? `
              <div class="book-meta-item">
                <span style="font-size: 12px; color: var(--text-muted); display: block;">Pages</span>
                <span style="font-size: 14px; font-weight: 600; color: var(--text);">${metadata.pageCount}</span>
              </div>
            ` : ''}
            ${metadata.categories ? `
              <div class="book-meta-item">
                <span style="font-size: 12px; color: var(--text-muted); display: block;">Category</span>
                <span style="font-size: 14px; font-weight: 600; color: var(--text);">${this.escapeHtml(metadata.categories)}</span>
              </div>
            ` : ''}
            ${metadata.publishedDate ? `
              <div class="book-meta-item">
                <span style="font-size: 12px; color: var(--text-muted); display: block;">Published</span>
                <span style="font-size: 14px; font-weight: 600; color: var(--text);">${metadata.publishedDate.split('-')[0]}</span>
              </div>
            ` : ''}
          </div>
        `;
      }

      // User notes section
      if (bookData.notes || metadata.userNotes) {
        const notes = bookData.notes || metadata.userNotes;
        html += `
          <div class="book-notes" style="margin-bottom: 24px; padding: 16px; background: rgba(99, 102, 241, 0.1); border-left: 3px solid var(--primary); border-radius: 0 var(--radius) var(--radius) 0;">
            <h4 style="margin: 0 0 8px; font-size: 14px; font-weight: 600; color: var(--primary);">Your Notes</h4>
            <p style="margin: 0; line-height: 1.6; color: var(--text);">${this.escapeHtml(notes)}</p>
          </div>
        `;
      }

      // Book description
      if (bookData.description) {
        html += `
          <div class="book-description">
            <h4 style="margin: 0 0 12px; font-size: 15px; font-weight: 600; color: var(--text);">About This Book</h4>
            <p style="margin: 0; line-height: 1.7; color: var(--text-secondary);">${this.escapeHtml(bookData.description)}</p>
          </div>
        `;
      }

      // Link to Google Books
      if (save.url) {
        html += `
          <p style="margin-top: 24px;"><a href="${save.url}" target="_blank" style="color: var(--primary);">View on Google Books →</a></p>
        `;
      }

      document.getElementById('reading-body').innerHTML = html;
    } else {
      // Article view
      let html = '';

      // Show AI enrich button for articles with content
      if (save.content && save.content.length > 100) {
        const hasKeyPoints = save.ai_metadata?.key_points?.length > 0;
        html += `
          <button class="prettify-btn ai-enrich-btn" onclick="app.aiEnrichContent()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
            </svg>
            ${hasKeyPoints ? 'Re-enrich with AI' : 'AI Enrich'}
          </button>
        `;

        // Show AI-generated key points if available
        if (save.ai_metadata?.key_points?.length > 0) {
          html += `
            <div class="article-key-points" style="margin-bottom: 24px;">
              <h4 style="margin: 0 0 12px; font-size: 15px; font-weight: 600; color: var(--text);">Key Points</h4>
              <ul style="margin: 0; padding-left: 20px;">
                ${save.ai_metadata.key_points.map(point => `<li style="margin-bottom: 8px; line-height: 1.5;">${this.escapeHtml(point)}</li>`).join('')}
              </ul>
            </div>
          `;
        }
      }

      const content = save.content || save.excerpt || 'No content available.';
      html += this.renderMarkdown(content);
      document.getElementById('reading-body').innerHTML = html;
    }

    document.getElementById('open-original-btn').href = save.url || '#';

    // Update button states
    document.getElementById('archive-btn').classList.toggle('active', save.is_archived);
    document.getElementById('favorite-btn').classList.toggle('active', save.is_favorite);

    pane.classList.remove('hidden');
    // Add open class for mobile slide-in animation
    requestAnimationFrame(() => {
      pane.classList.add('open');
    });
  }

  closeReadingPane() {
    const pane = document.getElementById('reading-pane');
    pane.classList.remove('open');
    // Stop audio when closing
    this.stopAudio();
    // Reset progress bar
    const progressFill = document.getElementById('reading-progress-fill');
    if (progressFill) progressFill.style.width = '0%';
    // Wait for animation on mobile before hiding
    setTimeout(() => {
      if (!pane.classList.contains('open')) {
        pane.classList.add('hidden');
      }
    }, 300);
    this.currentSave = null;
  }

  // Reading Progress Bar
  updateReadingProgress() {
    const readingContent = document.getElementById('reading-content');
    const progressFill = document.getElementById('reading-progress-fill');

    if (!readingContent || !progressFill) return;

    const scrollTop = readingContent.scrollTop;
    const scrollHeight = readingContent.scrollHeight - readingContent.clientHeight;

    if (scrollHeight > 0) {
      const progress = (scrollTop / scrollHeight) * 100;
      progressFill.style.width = `${Math.min(progress, 100)}%`;
    }
  }

  // Audio player methods
  async initAudio(url) {
    this.stopAudio();

    // Extract filename from URL and get a signed URL
    const filename = url.split('/').pop();
    const signedUrl = await this.getSignedAudioUrl(filename);

    if (!signedUrl) {
      console.error('Failed to get signed URL for audio');
      return;
    }

    this.audio = new Audio(signedUrl);
    this.isPlaying = false;

    // Reset UI
    document.getElementById('audio-progress').style.width = '0%';
    document.getElementById('audio-current').textContent = '0:00';
    document.getElementById('audio-duration').textContent = '0:00';
    document.getElementById('audio-speed').value = '1';
    this.updatePlayButton();

    // Set up event listeners
    this.audio.addEventListener('loadedmetadata', () => {
      document.getElementById('audio-duration').textContent = this.formatTime(this.audio.duration);
    });

    this.audio.addEventListener('timeupdate', () => {
      const progress = (this.audio.currentTime / this.audio.duration) * 100;
      document.getElementById('audio-progress').style.width = `${progress}%`;
      document.getElementById('audio-current').textContent = this.formatTime(this.audio.currentTime);
    });

    this.audio.addEventListener('ended', () => {
      this.isPlaying = false;
      this.updatePlayButton();
    });

    this.audio.addEventListener('error', (e) => {
      console.error('Audio error:', e);
    });
  }

  toggleAudioPlayback() {
    if (!this.audio) return;

    if (this.isPlaying) {
      this.audio.pause();
      this.isPlaying = false;
    } else {
      this.audio.play();
      this.isPlaying = true;
    }
    this.updatePlayButton();
  }

  stopAudio() {
    if (this.audio) {
      this.audio.pause();
      this.audio.src = '';
      this.audio = null;
      this.isPlaying = false;
      this.updatePlayButton();
    }
  }

  updatePlayButton() {
    const playIcon = document.querySelector('#audio-play-btn .play-icon');
    const pauseIcon = document.querySelector('#audio-play-btn .pause-icon');

    if (this.isPlaying) {
      playIcon.classList.add('hidden');
      pauseIcon.classList.remove('hidden');
    } else {
      playIcon.classList.remove('hidden');
      pauseIcon.classList.add('hidden');
    }
  }

  // Delegate to lib/utils.js
  formatTime(seconds) {
    return formatTime(seconds);
  }

  async getSignedAudioUrl(path) {
    // Get a signed URL for the audio file (valid for 1 hour)
    const { data, error } = await this.supabase.storage
      .from('audio')
      .createSignedUrl(path, 3600);

    if (error) {
      console.error('Error getting signed URL:', error);
      return null;
    }
    return data.signedUrl;
  }

  async toggleArchive() {
    if (!this.currentSave) return;

    const newValue = !this.currentSave.is_archived;
    await this.supabase
      .from('saves')
      .update({ is_archived: newValue })
      .eq('id', this.currentSave.id);

    this.currentSave.is_archived = newValue;
    this.loadSaves();
    if (newValue) this.closeReadingPane();
  }

  async toggleFavorite() {
    if (!this.currentSave) return;

    const newValue = !this.currentSave.is_favorite;
    await this.supabase
      .from('saves')
      .update({ is_favorite: newValue })
      .eq('id', this.currentSave.id);

    this.currentSave.is_favorite = newValue;
    document.getElementById('favorite-btn').classList.toggle('active', newValue);
  }

  async deleteSave() {
    if (!this.currentSave) return;

    if (!confirm('Delete this save? This cannot be undone.')) return;

    await this.supabase
      .from('saves')
      .delete()
      .eq('id', this.currentSave.id);

    this.closeReadingPane();
    this.loadSaves();
  }

  async addTagToSave() {
    if (!this.currentSave) return;

    const tagName = prompt('Enter tag name:');
    if (!tagName?.trim()) return;

    // Get or create tag
    let { data: existingTag } = await this.supabase
      .from('tags')
      .select('*')
      .eq('name', tagName.trim())
      .single();

    if (!existingTag) {
      const { data: newTag } = await this.supabase
        .from('tags')
        .insert({ user_id: this.user.id, name: tagName.trim() })
        .select()
        .single();
      existingTag = newTag;
    }

    if (existingTag) {
      await this.supabase
        .from('save_tags')
        .insert({ save_id: this.currentSave.id, tag_id: existingTag.id });

      this.loadTags();
    }
  }

  async addFolder() {
    const name = prompt('Folder name:');
    if (!name?.trim()) return;

    await this.supabase
      .from('folders')
      .insert({ user_id: this.user.id, name: name.trim() });

    this.loadFolders();
  }

  async showStats() {
    const { data: saves } = await this.supabase
      .from('saves')
      .select('created_at, highlight, is_archived');

    const totalSaves = saves?.length || 0;
    const highlights = saves?.filter(s => s.highlight)?.length || 0;
    const articles = totalSaves - highlights;
    const archived = saves?.filter(s => s.is_archived)?.length || 0;

    // Group by month
    const byMonth = {};
    saves?.forEach(s => {
      const month = new Date(s.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
      byMonth[month] = (byMonth[month] || 0) + 1;
    });

    const content = document.querySelector('.content');
    content.innerHTML = `
      <div class="stats-container">
        <div class="stats-header">
          <h2>Your Stats</h2>
          <button class="btn secondary" onclick="app.setView('all')">← Back</button>
        </div>

        <div class="stats-cards">
          <div class="stat-card">
            <div class="stat-card-value">${totalSaves}</div>
            <div class="stat-card-label">Total Saves</div>
          </div>
          <div class="stat-card">
            <div class="stat-card-value">${articles}</div>
            <div class="stat-card-label">Articles</div>
          </div>
          <div class="stat-card">
            <div class="stat-card-value">${highlights}</div>
            <div class="stat-card-label">Highlights</div>
          </div>
          <div class="stat-card">
            <div class="stat-card-value">${archived}</div>
            <div class="stat-card-label">Archived</div>
          </div>
        </div>

        <div class="stats-section">
          <h3>Saves by Month</h3>
          <div style="display: flex; gap: 24px; flex-wrap: wrap; margin-top: 16px;">
            ${Object.entries(byMonth).slice(-6).map(([month, count]) => `
              <div>
                <div style="font-size: 24px; font-weight: 600; color: var(--primary);">${count}</div>
                <div style="font-size: 13px; color: var(--text-muted);">${month}</div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }

  // Kindle Highlights View
  async loadKindleHighlights() {
    const container = document.getElementById('saves-container');
    const loading = document.getElementById('loading');
    const empty = document.getElementById('empty-state');

    loading.classList.remove('hidden');
    container.innerHTML = '';

    const { data, error } = await this.supabase
      .from('saves')
      .select('*')
      .eq('source', 'kindle')
      .order('title', { ascending: true });

    loading.classList.add('hidden');

    if (error) {
      console.error('Error loading Kindle highlights:', error);
      return;
    }

    if (!data || data.length === 0) {
      empty.classList.remove('hidden');
      document.querySelector('.empty-icon').textContent = '📚';
      document.querySelector('.empty-state h3').textContent = 'No Kindle highlights yet';
      document.querySelector('.empty-state p').textContent = 'Import your Kindle highlights using the "Import Kindle" button in the sidebar, or sync from the Chrome extension.';
      return;
    }

    empty.classList.add('hidden');

    // Group by book title
    const books = {};
    data.forEach(save => {
      const key = save.title || 'Unknown Book';
      if (!books[key]) {
        books[key] = {
          title: save.title,
          author: save.author,
          highlights: [],
        };
      }
      books[key].highlights.push(save);
    });

    // Sort books by highlight count (most first)
    const sortedBooks = Object.values(books).sort((a, b) => b.highlights.length - a.highlights.length);

    this.renderKindleBooks(sortedBooks);
  }

  renderKindleBooks(books) {
    const container = document.getElementById('saves-container');

    container.innerHTML = `
      <div class="kindle-stats">
        <div class="kindle-stat">
          <span class="kindle-stat-value">${books.reduce((sum, b) => sum + b.highlights.length, 0)}</span>
          <span class="kindle-stat-label">highlights</span>
        </div>
        <div class="kindle-stat">
          <span class="kindle-stat-value">${books.length}</span>
          <span class="kindle-stat-label">books</span>
        </div>
        <button class="btn secondary kindle-clear-btn" id="clear-kindle-btn">Clear All Kindle Data</button>
      </div>
      <div class="kindle-books-grid">
        ${books.map(book => `
          <div class="kindle-book-card" data-title="${this.escapeHtml(book.title || '')}">
            <div class="kindle-book-header">
              <div class="kindle-book-icon">📖</div>
              <div class="kindle-book-info">
                <h3 class="kindle-book-title">${this.escapeHtml(book.title || 'Unknown Book')}</h3>
                ${book.author ? `<p class="kindle-book-author">${this.escapeHtml(book.author)}</p>` : ''}
              </div>
              <span class="kindle-book-count">${book.highlights.length}</span>
            </div>
            <div class="kindle-highlights-preview">
              ${book.highlights.slice(0, 3).map(h => `
                <div class="kindle-highlight-snippet" data-id="${h.id}">
                  "${this.escapeHtml(h.highlight?.substring(0, 150) || '')}${h.highlight?.length > 150 ? '...' : ''}"
                </div>
              `).join('')}
              ${book.highlights.length > 3 ? `
                <div class="kindle-more-highlights">+${book.highlights.length - 3} more highlights</div>
              ` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    `;

    // Bind click events to open highlights
    container.querySelectorAll('.kindle-highlight-snippet').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = el.dataset.id;
        const allHighlights = books.flatMap(b => b.highlights);
        const save = allHighlights.find(s => s.id === id);
        if (save) this.openReadingPane(save);
      });
    });

    // Bind book card clicks to expand
    container.querySelectorAll('.kindle-book-card').forEach(card => {
      card.addEventListener('click', () => {
        const title = card.dataset.title;
        const book = books.find(b => (b.title || '') === title);
        if (book) this.showBookHighlights(book);
      });
    });

    // Clear Kindle data button
    const clearBtn = document.getElementById('clear-kindle-btn');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => this.clearKindleData());
    }
  }

  async clearKindleData() {
    const count = this.saves?.length || 0;
    if (!confirm(`Delete all ${count} Kindle highlights? This cannot be undone.`)) {
      return;
    }

    try {
      const { error } = await this.supabase
        .from('saves')
        .delete()
        .eq('source', 'kindle');

      if (error) throw error;

      alert('All Kindle data cleared. You can now re-sync from the Chrome extension.');
      this.loadKindleHighlights();
    } catch (err) {
      console.error('Error clearing Kindle data:', err);
      alert('Failed to clear data: ' + err.message);
    }
  }

  showBookHighlights(book) {
    const container = document.getElementById('saves-container');

    container.innerHTML = `
      <div class="kindle-book-detail">
        <button class="btn secondary kindle-back-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          Back to all books
        </button>
        <div class="kindle-book-detail-header">
          <div class="kindle-book-icon-large">📖</div>
          <div>
            <h2>${this.escapeHtml(book.title || 'Unknown Book')}</h2>
            ${book.author ? `<p class="kindle-book-author">${this.escapeHtml(book.author)}</p>` : ''}
            <p class="kindle-book-meta">${book.highlights.length} highlights</p>
          </div>
        </div>
        <div class="kindle-highlights-list">
          ${book.highlights.map(h => `
            <div class="kindle-highlight-card" data-id="${h.id}">
              <div class="kindle-highlight-text">"${this.escapeHtml(h.highlight || '')}"</div>
              <div class="kindle-highlight-meta">
                ${new Date(h.created_at).toLocaleDateString()}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    // Back button
    container.querySelector('.kindle-back-btn').addEventListener('click', () => {
      this.loadKindleHighlights();
    });

    // Highlight clicks
    container.querySelectorAll('.kindle-highlight-card').forEach(el => {
      el.addEventListener('click', () => {
        const id = el.dataset.id;
        const save = book.highlights.find(s => s.id === id);
        if (save) this.openReadingPane(save);
      });
    });
  }

  // Kindle Import Methods
  showKindleImportModal() {
    const modal = document.getElementById('kindle-import-modal');
    modal.classList.remove('hidden');
    this.resetKindleImportModal();
  }

  hideKindleImportModal() {
    const modal = document.getElementById('kindle-import-modal');
    modal.classList.add('hidden');
    this.resetKindleImportModal();
  }

  resetKindleImportModal() {
    this.pendingKindleImport = null;
    document.getElementById('kindle-file-input').value = '';
    document.getElementById('kindle-import-preview').classList.add('hidden');
    document.getElementById('kindle-import-footer').classList.add('hidden');
    const dropzone = document.getElementById('kindle-dropzone');
    dropzone.classList.remove('success', 'processing');
  }

  async handleKindleFile(file) {
    if (!file.name.endsWith('.txt')) {
      alert('Please upload a .txt file (My Clippings.txt from your Kindle)');
      return;
    }

    const dropzone = document.getElementById('kindle-dropzone');
    dropzone.classList.add('processing');

    try {
      const content = await file.text();
      const highlights = this.parseMyClippings(content);

      if (highlights.length === 0) {
        alert('No highlights found in this file. Make sure it\'s a valid My Clippings.txt file.');
        dropzone.classList.remove('processing');
        return;
      }

      // Check for duplicates against existing saves
      const { data: existingSaves } = await this.supabase
        .from('saves')
        .select('highlight, title')
        .not('highlight', 'is', null);

      const existingSet = new Set(
        (existingSaves || []).map(s => `${s.highlight}|||${s.title}`)
      );

      let duplicateCount = 0;
      const newHighlights = highlights.filter(h => {
        const key = `${h.highlight}|||${h.title}`;
        if (existingSet.has(key)) {
          duplicateCount++;
          return false;
        }
        return true;
      });

      this.pendingKindleImport = newHighlights;

      // Group by book for display
      const bookCounts = {};
      newHighlights.forEach(h => {
        const key = h.title;
        if (!bookCounts[key]) {
          bookCounts[key] = { title: h.title, author: h.author, count: 0 };
        }
        bookCounts[key].count++;
      });

      // Update UI
      dropzone.classList.remove('processing');
      dropzone.classList.add('success');

      document.getElementById('import-total').textContent = newHighlights.length;
      document.getElementById('import-books').textContent = Object.keys(bookCounts).length;
      document.getElementById('import-duplicates').textContent = duplicateCount;

      const booksList = document.getElementById('import-books-list');
      booksList.innerHTML = Object.values(bookCounts)
        .sort((a, b) => b.count - a.count)
        .map(book => `
          <div class="import-book-item">
            <div>
              <div class="import-book-title">${this.escapeHtml(book.title)}</div>
              ${book.author ? `<div class="import-book-author">${this.escapeHtml(book.author)}</div>` : ''}
            </div>
            <span class="import-book-count">${book.count}</span>
          </div>
        `).join('');

      document.getElementById('kindle-import-preview').classList.remove('hidden');
      document.getElementById('kindle-import-footer').classList.remove('hidden');

    } catch (error) {
      console.error('Error parsing Kindle file:', error);
      alert('Error reading the file. Please try again.');
      dropzone.classList.remove('processing');
    }
  }

  parseMyClippings(content) {
    // Split by the Kindle clipping delimiter
    const clippings = content.split('==========').filter(c => c.trim());
    const highlights = [];

    for (const clipping of clippings) {
      const lines = clipping.trim().split('\n').filter(l => l.trim());
      if (lines.length < 3) continue;

      // First line: Book Title (Author)
      const titleLine = lines[0].trim();
      let title = titleLine;
      let author = null;

      // Extract author from parentheses at the end
      const authorMatch = titleLine.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
      if (authorMatch) {
        title = authorMatch[1].trim();
        author = authorMatch[2].trim();
      }

      // Second line: metadata (type, location, date)
      const metaLine = lines[1].trim();

      // Check if this is a highlight (not a bookmark or note)
      if (!metaLine.toLowerCase().includes('highlight')) {
        continue; // Skip bookmarks and notes
      }

      // Extract date from metadata line
      let addedAt = null;
      const dateMatch = metaLine.match(/Added on (.+)$/i);
      if (dateMatch) {
        try {
          addedAt = new Date(dateMatch[1]).toISOString();
        } catch (e) {
          // Ignore date parsing errors
        }
      }

      // Remaining lines are the highlight text
      const highlightText = lines.slice(2).join('\n').trim();

      if (!highlightText) continue;

      highlights.push({
        title,
        author,
        highlight: highlightText,
        addedAt,
      });
    }

    return highlights;
  }

  async confirmKindleImport() {
    if (!this.pendingKindleImport || this.pendingKindleImport.length === 0) {
      this.hideKindleImportModal();
      return;
    }

    const confirmBtn = document.getElementById('kindle-confirm-btn');
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Importing...';

    try {
      // Prepare saves for batch insert
      const saves = this.pendingKindleImport.map(h => ({
        user_id: this.user.id,
        title: h.title,
        author: h.author,
        highlight: h.highlight,
        site_name: 'Kindle',
        source: 'kindle',
        created_at: h.addedAt || new Date().toISOString(),
      }));

      // Insert in batches of 50 to avoid request size limits
      const batchSize = 50;
      for (let i = 0; i < saves.length; i += batchSize) {
        const batch = saves.slice(i, i + batchSize);
        const { error } = await this.supabase.from('saves').insert(batch);
        if (error) throw error;
      }

      // Success - close modal and refresh
      this.hideKindleImportModal();
      this.loadSaves();

      alert(`Successfully imported ${saves.length} highlights!`);

    } catch (error) {
      console.error('Error importing highlights:', error);
      alert('Error importing highlights. Please try again.');
    } finally {
      confirmBtn.disabled = false;
      confirmBtn.textContent = 'Import Highlights';
    }
  }

  // Delegate to lib/utils.js
  escapeHtml(text) {
    return escapeHtml(text);
  }

  // Delegate to lib/utils.js
  renderMarkdown(text) {
    return renderMarkdown(text);
  }

  // Digest Settings Methods
  showDigestModal() {
    const modal = document.getElementById('digest-modal');
    modal.classList.remove('hidden');
    this.loadDigestPreferences();
  }

  hideDigestModal() {
    const modal = document.getElementById('digest-modal');
    modal.classList.add('hidden');
    document.getElementById('digest-status').classList.add('hidden');
  }

  async loadDigestPreferences() {
    try {
      const { data, error } = await this.supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', this.user.id)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
        throw error;
      }

      // Populate form with existing preferences or defaults
      const prefs = data || {};
      document.getElementById('digest-enabled').checked = prefs.digest_enabled || false;
      document.getElementById('digest-email').value = prefs.digest_email || '';
      document.getElementById('digest-day').value = prefs.digest_day ?? 0;
      document.getElementById('digest-hour').value = prefs.digest_hour ?? 9;

      // Update UI state
      this.updateDigestOptionsState();

    } catch (error) {
      console.error('Error loading digest preferences:', error);
    }
  }

  updateDigestOptionsState() {
    const enabled = document.getElementById('digest-enabled').checked;
    const options = document.getElementById('digest-options');
    const schedule = document.getElementById('digest-schedule-group');

    if (enabled) {
      options.classList.remove('disabled');
      schedule.classList.remove('disabled');
    } else {
      options.classList.add('disabled');
      schedule.classList.add('disabled');
    }
  }

  async saveDigestPreferences() {
    const status = document.getElementById('digest-status');
    const saveBtn = document.getElementById('digest-save-btn');

    const enabled = document.getElementById('digest-enabled').checked;
    const email = document.getElementById('digest-email').value.trim();
    const day = parseInt(document.getElementById('digest-day').value);
    const hour = parseInt(document.getElementById('digest-hour').value);

    // Validate email if enabled
    if (enabled && !email) {
      status.textContent = 'Please enter an email address';
      status.className = 'digest-status error';
      status.classList.remove('hidden');
      return;
    }

    if (enabled && !email.includes('@')) {
      status.textContent = 'Please enter a valid email address';
      status.className = 'digest-status error';
      status.classList.remove('hidden');
      return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    try {
      // Upsert preferences (insert or update)
      const { error } = await this.supabase
        .from('user_preferences')
        .upsert({
          user_id: this.user.id,
          digest_enabled: enabled,
          digest_email: email || null,
          digest_day: day,
          digest_hour: hour,
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;

      status.textContent = enabled
        ? 'Digest enabled! You\'ll receive emails weekly.'
        : 'Digest disabled. You won\'t receive emails.';
      status.className = 'digest-status success';
      status.classList.remove('hidden');

      // Close modal after delay
      setTimeout(() => this.hideDigestModal(), 1500);

    } catch (error) {
      console.error('Error saving digest preferences:', error);
      status.textContent = 'Error saving preferences. Please try again.';
      status.className = 'digest-status error';
      status.classList.remove('hidden');
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save Settings';
    }
  }

  // ==================== AI Settings Methods ====================

  showAISettingsModal() {
    const modal = document.getElementById('ai-settings-modal');
    modal.classList.remove('hidden');
    this.loadAISettings();
  }

  hideAISettingsModal() {
    const modal = document.getElementById('ai-settings-modal');
    modal.classList.add('hidden');
    document.getElementById('ai-settings-status').classList.add('hidden');
  }

  loadAISettings() {
    const provider = localStorage.getItem('stash-ai-provider') || 'claude';
    const tier = localStorage.getItem('stash-ai-tier') || 'balanced';
    const claudeKey = localStorage.getItem('stash-claude-api-key') || '';
    const openaiKey = localStorage.getItem('stash-openai-api-key') || '';

    // Set provider
    document.getElementById('ai-provider').value = provider;

    // Set tier radio button
    const tierRadio = document.querySelector(`input[name="ai-tier"][value="${tier}"]`);
    if (tierRadio) {
      tierRadio.checked = true;
    }

    // Set API keys
    document.getElementById('claude-api-key').value = claudeKey;
    document.getElementById('openai-api-key').value = openaiKey;

    // Update provider-specific fields visibility
    this.updateAIProviderFields();

    // Update key status indicators
    if (claudeKey) {
      this.updateClaudeKeyStatus('validated');
    } else {
      this.updateClaudeKeyStatus('empty');
    }

    if (openaiKey) {
      this.updateOpenAIKeyStatus('validated');
    } else {
      this.updateOpenAIKeyStatus('empty');
    }

    // Update tier hint
    this.updateTierHint();
  }

  updateAIProviderFields() {
    const provider = document.getElementById('ai-provider').value;
    const claudeConfigGroup = document.getElementById('claude-config-group');
    const openaiConfigGroup = document.getElementById('openai-config-group');

    // Show config section for the selected provider
    if (provider === 'claude') {
      claudeConfigGroup.classList.remove('hidden');
      openaiConfigGroup.classList.add('hidden');
    } else {
      claudeConfigGroup.classList.add('hidden');
      openaiConfigGroup.classList.remove('hidden');
    }

    // Update tier hint when provider changes
    this.updateTierHint();
  }

  updateTierHint() {
    const provider = document.getElementById('ai-provider').value;
    const tier = document.querySelector('input[name="ai-tier"]:checked')?.value || 'balanced';
    const hint = document.getElementById('ai-tier-hint');

    // Get dynamically resolved model name
    const modelName = getResolvedModelDisplayName(provider, tier);
    hint.textContent = `Will use: ${modelName}`;
  }

  saveAISettings() {
    const status = document.getElementById('ai-settings-status');
    const provider = document.getElementById('ai-provider').value;
    const tier = document.querySelector('input[name="ai-tier"]:checked')?.value || 'balanced';
    const claudeKey = document.getElementById('claude-api-key').value.trim();
    const openaiKey = document.getElementById('openai-api-key').value.trim();

    // Validate that the selected provider has a key (warn but don't block)
    const selectedKeyMissing = (provider === 'claude' && !claudeKey) || (provider === 'openai' && !openaiKey);

    // Save to localStorage
    localStorage.setItem('stash-ai-provider', provider);
    localStorage.setItem('stash-ai-tier', tier);

    // Save or clear keys based on input
    if (claudeKey) {
      localStorage.setItem('stash-claude-api-key', claudeKey);
    } else {
      localStorage.removeItem('stash-claude-api-key');
    }

    if (openaiKey) {
      localStorage.setItem('stash-openai-api-key', openaiKey);
    } else {
      localStorage.removeItem('stash-openai-api-key');
    }

    // Get tier display name for status message
    const tierNames = { fast: 'Fast', balanced: 'Balanced', quality: 'Quality' };
    const tierName = tierNames[tier] || 'Balanced';
    const providerName = provider === 'claude' ? 'Claude' : 'OpenAI';

    if (selectedKeyMissing) {
      status.textContent = `Settings saved, but ${providerName} key is missing. AI processing won't work.`;
      status.className = 'ai-settings-status error';
    } else {
      status.textContent = `Settings saved! Using ${providerName} (${tierName} tier).`;
      status.className = 'ai-settings-status success';
    }
    status.classList.remove('hidden');

    setTimeout(() => this.hideAISettingsModal(), 1500);
  }

  // Delegate to lib/utils.js
  getAIConfig() {
    return getAIConfig();
  }

  // ==================== AI Model Cache ====================

  /**
   * Refresh model cache in background for any saved API keys
   * Called on app init to keep model lists current
   */
  async refreshModelCacheInBackground() {
    const claudeKey = localStorage.getItem('stash-claude-api-key');
    const openaiKey = localStorage.getItem('stash-openai-api-key');

    // Refresh both in parallel, silently (no UI updates on failure)
    const refreshPromises = [];

    if (claudeKey) {
      refreshPromises.push(this.refreshClaudeModelsCache(claudeKey));
    }

    if (openaiKey) {
      refreshPromises.push(this.refreshOpenAIModelsCache(openaiKey));
    }

    if (refreshPromises.length > 0) {
      await Promise.allSettled(refreshPromises);
    }
  }

  /**
   * Fetch and cache Claude models
   * @param {string} apiKey - Claude API key
   */
  async refreshClaudeModelsCache(apiKey) {
    try {
      const response = await fetch('https://api.anthropic.com/v1/models', {
        method: 'GET',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
      });

      if (!response.ok) return;

      const data = await response.json();
      const models = (data.data || [])
        .filter(m => m.type === 'model' && m.id.includes('claude'))
        .map(m => m.id);

      localStorage.setItem('stash-claude-models-cache', JSON.stringify(models));
    } catch (e) {
      // Silent failure - keep existing cache
    }
  }

  /**
   * Fetch and cache OpenAI models
   * @param {string} apiKey - OpenAI API key
   */
  async refreshOpenAIModelsCache(apiKey) {
    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      });

      if (!response.ok) return;

      const data = await response.json();
      const models = (data.data || [])
        .filter(m => {
          const id = m.id.toLowerCase();
          return (id.includes('gpt-4') || id.includes('gpt-5') || id.includes('gpt-3.5') ||
                  id.startsWith('o1') || id.startsWith('o3')) &&
                 !id.includes('instruct') && !id.includes('vision') && !id.includes('audio') &&
                 !id.includes('realtime') && !id.includes('embed');
        })
        .map(m => m.id);

      localStorage.setItem('stash-openai-models-cache', JSON.stringify(models));
    } catch (e) {
      // Silent failure - keep existing cache
    }
  }

  // ==================== API Key Validation Methods ====================

  async validateClaudeKey() {
    const key = document.getElementById('claude-api-key').value.trim();

    if (!key) {
      this.updateClaudeKeyStatus('error', 'Please enter an API key');
      return;
    }

    if (!key.startsWith('sk-ant-')) {
      this.updateClaudeKeyStatus('error', 'Invalid key format. Claude keys start with sk-ant-');
      return;
    }

    this.updateClaudeKeyStatus('validating');

    try {
      // Test the API key by fetching models (also caches them)
      const response = await fetch('https://api.anthropic.com/v1/models', {
        method: 'GET',
        headers: {
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Invalid API key');
        }
        throw new Error(`API error: ${response.status}`);
      }

      // Key is valid - save it and cache models
      localStorage.setItem('stash-claude-api-key', key);
      await this.refreshClaudeModelsCache(key);
      this.updateClaudeKeyStatus('validated');
      this.updateTierHint();

    } catch (error) {
      console.error('Claude key validation failed:', error);
      this.updateClaudeKeyStatus('error', error.message || 'Validation failed');
    }
  }

  async validateOpenAIKey() {
    const key = document.getElementById('openai-api-key').value.trim();

    if (!key) {
      this.updateOpenAIKeyStatus('error', 'Please enter an API key');
      return;
    }

    if (!key.startsWith('sk-')) {
      this.updateOpenAIKeyStatus('error', 'Invalid key format. OpenAI keys start with sk-');
      return;
    }

    this.updateOpenAIKeyStatus('validating');

    try {
      // Test the API key by fetching models (also caches them)
      const response = await fetch('https://api.openai.com/v1/models', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${key}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Invalid API key');
        }
        throw new Error(`API error: ${response.status}`);
      }

      // Key is valid - save it and cache models
      localStorage.setItem('stash-openai-api-key', key);
      await this.refreshOpenAIModelsCache(key);
      this.updateOpenAIKeyStatus('validated');
      this.updateTierHint();

    } catch (error) {
      console.error('OpenAI key validation failed:', error);
      this.updateOpenAIKeyStatus('error', error.message || 'Validation failed');
    }
  }

  resetClaudeKey() {
    document.getElementById('claude-api-key').value = '';
    localStorage.removeItem('stash-claude-api-key');
    localStorage.removeItem('stash-claude-models-cache');
    this.updateClaudeKeyStatus('empty');
    this.updateTierHint(); // Update to show default model
  }

  resetOpenAIKey() {
    document.getElementById('openai-api-key').value = '';
    localStorage.removeItem('stash-openai-api-key');
    localStorage.removeItem('stash-openai-models-cache');
    this.updateOpenAIKeyStatus('empty');
    this.updateTierHint(); // Update to show default model
  }

  updateClaudeKeyStatus(state, message = '') {
    const status = document.getElementById('claude-key-status');
    status.classList.remove('hidden');

    switch (state) {
      case 'empty':
        status.textContent = 'Enter your API key and click Validate';
        status.className = 'api-key-status';
        break;
      case 'validating':
        status.textContent = 'Validating...';
        status.className = 'api-key-status validating';
        break;
      case 'validated':
        status.textContent = '✓ API key validated';
        status.className = 'api-key-status validated';
        break;
      case 'error':
        status.textContent = `✗ ${message}`;
        status.className = 'api-key-status error';
        break;
    }
  }

  updateOpenAIKeyStatus(state, message = '') {
    const status = document.getElementById('openai-key-status');
    status.classList.remove('hidden');

    switch (state) {
      case 'empty':
        status.textContent = 'Enter your API key and click Validate';
        status.className = 'api-key-status';
        break;
      case 'validating':
        status.textContent = 'Validating...';
        status.className = 'api-key-status validating';
        break;
      case 'validated':
        status.textContent = '✓ API key validated';
        status.className = 'api-key-status validated';
        break;
      case 'error':
        status.textContent = `✗ ${message}`;
        status.className = 'api-key-status error';
        break;
    }
  }

  // ==================== Book Methods ====================

  showBookModal() {
    const modal = document.getElementById('book-modal');
    modal.classList.remove('hidden');
    this.resetBookModal();

    // Set default year to current year
    document.getElementById('book-year').value = new Date().getFullYear();
  }

  hideBookModal() {
    const modal = document.getElementById('book-modal');
    modal.classList.add('hidden');
    this.resetBookModal();
  }

  resetBookModal() {
    document.getElementById('book-search').value = '';
    document.getElementById('book-search-results').classList.add('hidden');
    document.getElementById('book-search-results').innerHTML = '';
    document.getElementById('book-selected-preview').classList.add('hidden');
    document.getElementById('book-title').value = '';
    document.getElementById('book-author').value = '';
    document.getElementById('book-year').value = '';
    document.getElementById('book-date').value = '';
    document.getElementById('book-notes').value = '';
    document.getElementById('book-google-id').value = '';
    document.getElementById('book-cover-url').value = '';
    document.getElementById('book-categories').value = '';
    document.getElementById('book-page-count').value = '';
    document.getElementById('book-published-date').value = '';
    document.getElementById('book-fetched-info').classList.add('hidden');
    document.getElementById('book-status').classList.add('hidden');
  }

  async searchBooks() {
    const query = document.getElementById('book-search').value.trim();
    if (!query) return;

    const resultsContainer = document.getElementById('book-search-results');
    resultsContainer.classList.remove('hidden');
    resultsContainer.innerHTML = `
      <div class="book-search-loading">
        <div class="spinner"></div>
        <span>Searching...</span>
      </div>
    `;

    try {
      const response = await fetch(
        `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=10`
      );
      const data = await response.json();

      if (!data.items || data.items.length === 0) {
        resultsContainer.innerHTML = `
          <div class="book-search-empty">
            No books found. Try a different search term.
          </div>
        `;
        return;
      }

      resultsContainer.innerHTML = data.items.map(book => {
        const info = book.volumeInfo;
        const thumbnail = info.imageLinks?.thumbnail || '';
        const authors = info.authors?.join(', ') || 'Unknown Author';
        const year = info.publishedDate?.split('-')[0] || '';

        return `
          <div class="book-search-result" data-book-id="${book.id}">
            ${thumbnail ? `<img src="${thumbnail}" alt="${this.escapeHtml(info.title)}">` : '<div class="book-search-result-placeholder">📚</div>'}
            <div class="book-search-result-info">
              <div class="book-search-result-title">${this.escapeHtml(info.title)}</div>
              <div class="book-search-result-author">${this.escapeHtml(authors)}</div>
              ${year ? `<div class="book-search-result-year">${year}</div>` : ''}
            </div>
          </div>
        `;
      }).join('');

      // Bind click events
      resultsContainer.querySelectorAll('.book-search-result').forEach(result => {
        result.addEventListener('click', () => {
          const bookId = result.dataset.bookId;
          const book = data.items.find(b => b.id === bookId);
          if (book) this.selectBook(book);
        });
      });

    } catch (error) {
      console.error('Error searching books:', error);
      resultsContainer.innerHTML = `
        <div class="book-search-empty">
          Error searching books. Please try again.
        </div>
      `;
    }
  }

  selectBook(book) {
    const info = book.volumeInfo;

    // Fill in form fields
    document.getElementById('book-title').value = info.title || '';
    document.getElementById('book-author').value = info.authors?.join(', ') || '';
    document.getElementById('book-google-id').value = book.id;
    document.getElementById('book-cover-url').value = info.imageLinks?.thumbnail?.replace('http:', 'https:') || '';
    document.getElementById('book-categories').value = info.categories?.join(', ') || '';
    document.getElementById('book-page-count').value = info.pageCount || '';
    document.getElementById('book-published-date').value = info.publishedDate || '';

    // Show preview
    const preview = document.getElementById('book-selected-preview');
    const coverImg = document.getElementById('book-cover-preview');
    const previewTitle = document.getElementById('book-preview-title');
    const previewAuthor = document.getElementById('book-preview-author');

    if (info.imageLinks?.thumbnail) {
      coverImg.src = info.imageLinks.thumbnail.replace('http:', 'https:');
      coverImg.style.display = 'block';
    } else {
      coverImg.style.display = 'none';
    }
    previewTitle.textContent = info.title;
    previewAuthor.textContent = info.authors?.join(', ') || 'Unknown Author';
    preview.classList.remove('hidden');

    // Show book description
    if (info.description) {
      document.getElementById('book-description').textContent = info.description;
      document.getElementById('book-fetched-info').classList.remove('hidden');
    }

    // Hide search results
    document.getElementById('book-search-results').classList.add('hidden');
  }

  clearBookSelection() {
    document.getElementById('book-selected-preview').classList.add('hidden');
    document.getElementById('book-title').value = '';
    document.getElementById('book-author').value = '';
    document.getElementById('book-google-id').value = '';
    document.getElementById('book-cover-url').value = '';
    document.getElementById('book-categories').value = '';
    document.getElementById('book-page-count').value = '';
    document.getElementById('book-published-date').value = '';
    document.getElementById('book-fetched-info').classList.add('hidden');
    document.getElementById('book-search').focus();
  }

  async saveBook() {
    const status = document.getElementById('book-status');
    const title = document.getElementById('book-title').value.trim();
    const author = document.getElementById('book-author').value.trim();
    const year = document.getElementById('book-year').value;
    const date = document.getElementById('book-date').value;
    const notes = document.getElementById('book-notes').value.trim();
    const googleId = document.getElementById('book-google-id').value;
    const coverUrl = document.getElementById('book-cover-url').value;
    const categories = document.getElementById('book-categories').value;
    const pageCount = document.getElementById('book-page-count').value;
    const publishedDate = document.getElementById('book-published-date').value;
    const description = document.getElementById('book-description').textContent;

    // Validation
    if (!title) {
      status.textContent = 'Please enter a book title';
      status.className = 'book-status error';
      status.classList.remove('hidden');
      return;
    }

    if (!year) {
      status.textContent = 'Please enter the year you read this book';
      status.className = 'book-status error';
      status.classList.remove('hidden');
      return;
    }

    status.textContent = 'Saving book...';
    status.className = 'book-status';
    status.classList.remove('hidden');

    try {
      // Create save record for the book
      const bookData = {
        user_id: this.user.id,
        title: title,
        author: author,
        content_type: 'book',
        source: 'manual',
        site_name: author, // Use author as site_name for display
        excerpt: description || '',
        content: notes || description || '',
        highlight: notes || null,
        image_url: coverUrl || null,
        is_archived: false,
        is_favorite: false,
        // Store additional book metadata in content as JSON
        url: googleId ? `https://books.google.com/books?id=${googleId}` : null,
      };

      // Store book-specific metadata
      const metadata = {
        googleId,
        categories,
        pageCount,
        publishedDate,
        yearRead: parseInt(year),
        dateRead: date || null,
        userNotes: notes,
      };

      // Append metadata to content
      bookData.content = JSON.stringify({
        description: description || '',
        notes: notes || '',
        metadata: metadata,
      });

      const { data, error } = await this.supabase
        .from('saves')
        .insert([bookData])
        .select();

      if (error) throw error;

      status.textContent = 'Book saved successfully!';
      status.className = 'book-status success';

      this.showToast(`"${title}" added to your books`, 'success');

      setTimeout(() => {
        this.hideBookModal();
        if (this.currentView === 'books') {
          this.loadBooks();
        }
      }, 1000);

    } catch (error) {
      console.error('Error saving book:', error);
      status.textContent = 'Error saving book. Please try again.';
      status.className = 'book-status error';
    }
  }

  async loadBooks() {
    const container = document.getElementById('saves-container');
    const loading = document.getElementById('loading');
    const empty = document.getElementById('empty-state');

    loading.classList.remove('hidden');
    container.innerHTML = '';

    const { data, error } = await this.supabase
      .from('saves')
      .select('*')
      .eq('content_type', 'book')
      .order('created_at', { ascending: false });

    loading.classList.add('hidden');

    if (error) {
      console.error('Error loading books:', error);
      return;
    }

    if (!data || data.length === 0) {
      empty.classList.remove('hidden');
      document.querySelector('.empty-icon').textContent = '📚';
      document.querySelector('.empty-state h3').textContent = 'No books yet';
      document.querySelector('.empty-state p').textContent = 'Add books you\'ve read using the "Add Book" button in the sidebar.';
      return;
    }

    empty.classList.add('hidden');
    this.saves = data;

    // Group books by year read
    const booksByYear = {};
    data.forEach(book => {
      let yearRead = new Date().getFullYear();
      try {
        const content = JSON.parse(book.content);
        yearRead = content.metadata?.yearRead || yearRead;
      } catch (e) {}

      if (!booksByYear[yearRead]) {
        booksByYear[yearRead] = [];
      }
      booksByYear[yearRead].push(book);
    });

    // Sort years descending
    const sortedYears = Object.keys(booksByYear).sort((a, b) => b - a);

    container.innerHTML = sortedYears.map(year => `
      <div class="books-year-section">
        <div class="books-year-header">
          ${year}
          <span class="books-year-count">(${booksByYear[year].length} ${booksByYear[year].length === 1 ? 'book' : 'books'})</span>
        </div>
        <div class="books-grid">
          ${booksByYear[year].map(book => this.renderBookCard(book)).join('')}
        </div>
      </div>
    `).join('');

    // Bind click events
    container.querySelectorAll('.book-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.dataset.id;
        const book = this.saves.find(s => s.id === id);
        if (book) this.openReadingPane(book);
      });
    });
  }

  renderBookCard(book) {
    const author = book.author || book.site_name || 'Unknown Author';
    let yearRead = '';
    try {
      const content = JSON.parse(book.content);
      yearRead = content.metadata?.yearRead || '';
    } catch (e) {}

    return `
      <div class="book-card" data-id="${book.id}">
        ${book.image_url
          ? `<img class="book-card-cover" src="${book.image_url}" alt="${this.escapeHtml(book.title)}">`
          : `<div class="book-card-cover-placeholder">📚</div>`
        }
        <div class="book-card-content">
          <div class="book-card-title" title="${this.escapeHtml(book.title)}">${this.escapeHtml(book.title)}</div>
          <div class="book-card-author">${this.escapeHtml(author)}</div>
          ${yearRead ? `<span class="book-card-year">${yearRead}</span>` : ''}
        </div>
      </div>
    `;
  }

  // ==================== Insights Methods ====================

  async loadInsights() {
    const container = document.getElementById('saves-container');
    const loading = document.getElementById('loading');
    const empty = document.getElementById('empty-state');

    loading.classList.remove('hidden');
    container.innerHTML = '';
    empty.classList.add('hidden');

    try {
      // Fetch all content for analysis
      const { data: allSaves } = await this.supabase
        .from('saves')
        .select('*')
        .eq('is_archived', false);

      loading.classList.add('hidden');

      if (!allSaves || allSaves.length === 0) {
        container.innerHTML = `
          <div class="insights-container">
            <div class="insights-header">
              <h2>Your Reading Insights</h2>
              <p>Start saving content to see patterns and insights about your reading habits.</p>
            </div>
          </div>
        `;
        return;
      }

      // Calculate stats
      const stats = this.calculateInsightStats(allSaves);

      container.innerHTML = `
        <div class="insights-container">
          <div class="insights-header">
            <h2>Your Reading Insights</h2>
            <p>Patterns and themes from your saved content</p>
          </div>

          <div class="insights-grid">
            <!-- Overview Stats -->
            <div class="insight-card">
              <h3>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                </svg>
                Your Library
              </h3>
              <div class="insight-stats">
                <div class="insight-stat">
                  <div class="insight-stat-value">${stats.totalItems}</div>
                  <div class="insight-stat-label">Total Items</div>
                </div>
                <div class="insight-stat">
                  <div class="insight-stat-value">${stats.thisMonth}</div>
                  <div class="insight-stat-label">This Month</div>
                </div>
                <div class="insight-stat">
                  <div class="insight-stat-value">${stats.thisWeek}</div>
                  <div class="insight-stat-label">This Week</div>
                </div>
              </div>
            </div>

            <!-- Content Breakdown -->
            <div class="insight-card">
              <h3>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="20" x2="18" y2="10"></line>
                  <line x1="12" y1="20" x2="12" y2="4"></line>
                  <line x1="6" y1="20" x2="6" y2="14"></line>
                </svg>
                Content Breakdown
              </h3>
              <div class="content-breakdown">
                ${this.renderBreakdownBar('Articles', stats.articles, stats.totalItems, 'articles')}
                ${this.renderBreakdownBar('Books', stats.books, stats.totalItems, 'books')}
                ${this.renderBreakdownBar('Podcasts', stats.podcasts, stats.totalItems, 'podcasts')}
                ${this.renderBreakdownBar('Highlights', stats.highlights, stats.totalItems, 'highlights')}
              </div>
            </div>

            <!-- Reading Timeline -->
            <div class="insight-card">
              <h3>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="16" y1="2" x2="16" y2="6"></line>
                  <line x1="8" y1="2" x2="8" y2="6"></line>
                  <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
                Activity (Last 12 Weeks)
              </h3>
              <div class="reading-timeline">
                ${this.renderTimeline(allSaves)}
              </div>
            </div>

            <!-- Top Topics -->
            <div class="insight-card">
              <h3>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                </svg>
                Common Topics
              </h3>
              <div class="word-cloud">
                ${this.extractTopics(allSaves)}
              </div>
            </div>

            <!-- AI Insights -->
            <div class="insight-card" style="grid-column: 1 / -1;">
              <h3>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 2a10 10 0 1 0 10 10H12V2z"></path>
                  <path d="M12 2a10 10 0 0 1 10 10"></path>
                  <circle cx="12" cy="12" r="6"></circle>
                </svg>
                AI-Powered Insights
              </h3>
              <div id="ai-insights-content">
                ${this.getAIConfig().hasKey
                  ? `<p class="ai-insight-content">Click the button below to generate personalized insights about your reading patterns and themes.</p>
                     <button class="btn primary insight-generate-btn" id="generate-ai-insights">
                       <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                         <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                       </svg>
                       Generate AI Insights
                     </button>`
                  : `<p class="ai-insight-content">Configure your AI settings to get personalized insights about your reading patterns and themes.</p>
                     <button class="btn secondary insight-generate-btn" onclick="document.getElementById('ai-settings-btn').click()">
                       Configure AI Settings
                     </button>`
                }
              </div>
            </div>
          </div>
        </div>
      `;

      // Bind AI insights button
      const generateBtn = document.getElementById('generate-ai-insights');
      if (generateBtn) {
        generateBtn.addEventListener('click', () => this.generateAIInsights(allSaves));
      }

    } catch (error) {
      console.error('Error loading insights:', error);
      loading.classList.add('hidden');
    }
  }

  calculateInsightStats(saves) {
    const now = new Date();
    const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);

    const stats = {
      totalItems: saves.length,
      thisWeek: saves.filter(s => new Date(s.created_at) >= weekAgo).length,
      thisMonth: saves.filter(s => new Date(s.created_at) >= monthAgo).length,
      articles: saves.filter(s => !s.highlight && s.content_type !== 'podcast' && s.content_type !== 'book').length,
      books: saves.filter(s => s.content_type === 'book').length,
      podcasts: saves.filter(s => s.content_type === 'podcast').length,
      highlights: saves.filter(s => !!s.highlight).length,
    };

    return stats;
  }

  renderBreakdownBar(label, count, total, type) {
    const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
    return `
      <div class="breakdown-item">
        <span class="breakdown-label">${label}</span>
        <div class="breakdown-bar-container">
          <div class="breakdown-bar ${type}" style="width: ${percentage}%"></div>
        </div>
        <span class="breakdown-value">${count}</span>
      </div>
    `;
  }

  renderTimeline(saves) {
    // Group saves by week for the last 12 weeks
    const weeks = [];
    const now = new Date();

    for (let i = 11; i >= 0; i--) {
      const weekStart = new Date(now - (i * 7 + 7) * 24 * 60 * 60 * 1000);
      const weekEnd = new Date(now - i * 7 * 24 * 60 * 60 * 1000);
      const count = saves.filter(s => {
        const date = new Date(s.created_at);
        return date >= weekStart && date < weekEnd;
      }).length;
      weeks.push(count);
    }

    const maxCount = Math.max(...weeks, 1);

    return weeks.map(count => {
      const height = Math.max(4, (count / maxCount) * 100);
      return `<div class="timeline-bar" style="height: ${height}%" title="${count} items"></div>`;
    }).join('');
  }

  extractTopics(saves) {
    // Extract common words from titles and excerpts
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been', 'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'what', 'which', 'who', 'when', 'where', 'why', 'how', 'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just', 'about', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'under', 'again', 'further', 'then', 'once', 'here', 'there', 'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 's', 't', 'can', 'will', 'just', 'don', 'should', 'now', 'your', 'new', 'one', 'first', 'get', 'like', 'make', 'know', 'back', 'time', 'year', 'good', 'also', 'people', 'way', 'think', 'see', 'come', 'want', 'look', 'use', 'find', 'give', 'tell', 'work', 'life', 'day', 'even', 'still', 'own', 'say']);

    const wordCounts = {};

    saves.forEach(save => {
      const text = `${save.title || ''} ${save.excerpt || ''}`.toLowerCase();
      const words = text.match(/\b[a-z]{4,}\b/g) || [];

      words.forEach(word => {
        if (!stopWords.has(word)) {
          wordCounts[word] = (wordCounts[word] || 0) + 1;
        }
      });
    });

    // Get top 15 words
    const topWords = Object.entries(wordCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15);

    if (topWords.length === 0) {
      return '<p style="color: var(--text-muted); text-align: center;">Add more content to see topic patterns</p>';
    }

    const maxCount = topWords[0][1];

    return topWords.map(([word, count]) => {
      const size = count === maxCount ? 'large' : count >= maxCount * 0.5 ? 'medium' : '';
      return `<span class="word-cloud-item ${size}">${word}</span>`;
    }).join('');
  }

  async generateAIInsights(saves) {
    const container = document.getElementById('ai-insights-content');
    const config = this.getAIConfig();

    if (!config.hasKey) {
      this.showToast('Please configure your AI settings first', 'error');
      return;
    }

    container.innerHTML = `
      <div class="insight-loading">
        <div class="spinner"></div>
        <span>Analyzing your reading patterns...</span>
      </div>
    `;

    try {
      // Prepare content summary for AI
      const contentSummary = saves.slice(0, 50).map(s => ({
        title: s.title,
        type: s.content_type || (s.highlight ? 'highlight' : 'article'),
        excerpt: (s.excerpt || s.highlight || '').substring(0, 200),
      }));

      const prompt = `Analyze this person's reading/content consumption patterns and provide 2-3 insightful observations. Be specific about themes, topics, and patterns you notice. Keep it concise and actionable.

Content saved (${saves.length} total items, showing sample):
${JSON.stringify(contentSummary, null, 2)}

Provide insights in 2-3 short paragraphs. Focus on:
1. Main themes or topics they're interested in
2. Any notable patterns (e.g., focus areas, gaps)
3. A suggestion for related content they might enjoy`;

      let response;

      if (config.provider === 'claude') {
        response = await this.callClaudeAPIRaw(prompt, config.apiKey, config.model, 1024);
      } else {
        response = await this.callOpenAIAPIRaw(prompt, config.apiKey, config.model, 1024);
      }

      container.innerHTML = `
        <div class="ai-insight-content">
          ${response.split('\n').filter(p => p.trim()).map(p => `<p>${this.escapeHtml(p)}</p>`).join('')}
        </div>
        <button class="btn secondary insight-generate-btn" id="regenerate-ai-insights">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="23 4 23 10 17 10"></polyline>
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
          </svg>
          Regenerate
        </button>
      `;

      document.getElementById('regenerate-ai-insights').addEventListener('click', () => {
        this.generateAIInsights(saves);
      });

    } catch (error) {
      console.error('Error generating AI insights:', error);
      container.innerHTML = `
        <p class="ai-insight-content" style="color: var(--danger);">
          Error generating insights: ${error.message || 'Please try again.'}
        </p>
        <button class="btn secondary insight-generate-btn" id="retry-ai-insights">
          Retry
        </button>
      `;

      document.getElementById('retry-ai-insights').addEventListener('click', () => {
        this.generateAIInsights(saves);
      });
    }
  }


  // ==================== Podcast Methods ====================

  showPodcastModal() {
    const modal = document.getElementById('podcast-modal');
    modal.classList.remove('hidden');
    this.resetPodcastModal();
    this.updatePrettifyHint();
  }

  hidePodcastModal() {
    const modal = document.getElementById('podcast-modal');
    modal.classList.add('hidden');
    this.resetPodcastModal();
  }

  resetPodcastModal() {
    document.getElementById('podcast-show-name').value = '';
    document.getElementById('podcast-episode-title').value = '';
    document.getElementById('podcast-episode-date').value = '';
    document.getElementById('podcast-transcript').value = '';
    document.getElementById('podcast-file-input').value = '';
    document.getElementById('podcast-file-name').classList.add('hidden');
    document.getElementById('podcast-status').classList.add('hidden');
    document.getElementById('podcast-prettify').checked = true;
    document.getElementById('podcast-dropzone').classList.remove('success');
    this.pendingPodcastFile = null;

    // Reset tabs
    document.querySelectorAll('.podcast-tab').forEach(t => t.classList.remove('active'));
    document.querySelector('.podcast-tab[data-tab="paste"]').classList.add('active');
    document.getElementById('paste-tab').classList.remove('hidden');
    document.getElementById('upload-tab').classList.add('hidden');
  }

  updatePrettifyHint() {
    const hint = document.getElementById('prettify-hint');
    const config = this.getAIConfig();
    if (config.hasKey) {
      hint.textContent = `Using ${config.provider === 'claude' ? 'Claude' : 'OpenAI'} for processing`;
      hint.style.color = 'var(--success)';
    } else {
      hint.textContent = 'Requires API key in AI Settings';
      hint.style.color = 'var(--text-muted)';
    }
  }

  async handlePodcastFile(file) {
    const validExtensions = ['.txt', '.srt'];
    const ext = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));

    if (!validExtensions.includes(ext)) {
      alert('Please upload a .txt or .srt file');
      return;
    }

    try {
      const content = await file.text();
      this.pendingPodcastFile = {
        name: file.name,
        content: ext === '.srt' ? this.parseSRT(content) : content,
      };

      const fileNameEl = document.getElementById('podcast-file-name');
      fileNameEl.innerHTML = `
        <span class="file-info">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
          </svg>
          ${this.escapeHtml(file.name)}
        </span>
        <span class="remove-file" onclick="app.removePodcastFile()">✕</span>
      `;
      fileNameEl.classList.remove('hidden');
      document.getElementById('podcast-dropzone').classList.add('success');
    } catch (error) {
      console.error('Error reading file:', error);
      alert('Error reading file. Please try again.');
    }
  }

  removePodcastFile() {
    this.pendingPodcastFile = null;
    document.getElementById('podcast-file-input').value = '';
    document.getElementById('podcast-file-name').classList.add('hidden');
    document.getElementById('podcast-dropzone').classList.remove('success');
  }

  parseSRT(content) {
    // Parse SRT format and extract just the text
    const lines = content.split('\n');
    const textLines = [];
    let skipNext = false;

    for (const line of lines) {
      const trimmed = line.trim();

      // Skip empty lines and sequence numbers
      if (!trimmed || /^\d+$/.test(trimmed)) {
        continue;
      }

      // Skip timestamp lines
      if (trimmed.includes('-->')) {
        continue;
      }

      // Remove HTML tags and add the text
      const cleanText = trimmed.replace(/<[^>]*>/g, '');
      if (cleanText) {
        textLines.push(cleanText);
      }
    }

    return textLines.join(' ');
  }

  async savePodcastTranscript() {
    const showName = document.getElementById('podcast-show-name').value.trim();
    const episodeTitle = document.getElementById('podcast-episode-title').value.trim();
    const episodeDate = document.getElementById('podcast-episode-date').value;
    const pastedTranscript = document.getElementById('podcast-transcript').value.trim();
    const shouldPrettify = document.getElementById('podcast-prettify').checked;
    const status = document.getElementById('podcast-status');
    const saveBtn = document.getElementById('podcast-save-btn');

    // Get transcript from either paste or file
    let transcript = pastedTranscript || (this.pendingPodcastFile?.content || '');

    if (!showName) {
      status.textContent = 'Please enter a podcast/show name';
      status.className = 'podcast-status error';
      status.classList.remove('hidden');
      return;
    }

    if (!episodeTitle) {
      status.textContent = 'Please enter an episode title';
      status.className = 'podcast-status error';
      status.classList.remove('hidden');
      return;
    }

    if (!transcript) {
      status.textContent = 'Please paste or upload a transcript';
      status.className = 'podcast-status error';
      status.classList.remove('hidden');
      return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    let processedContent = transcript;
    let keyPoints = null;
    let wasProcessed = false;
    let aiError = null;

    // Process with AI if requested
    if (shouldPrettify) {
      const config = this.getAIConfig();
      if (config.hasKey) {
        status.innerHTML = '<div class="spinner" style="width:16px;height:16px;border-width:2px;display:inline-block;margin-right:8px;"></div> Processing with AI...';
        status.className = 'podcast-status processing';
        status.classList.remove('hidden');

        try {
          const result = await this.processTranscriptWithAI(transcript, config);
          if (result) {
            processedContent = result.content;
            keyPoints = result.keyPoints;
            wasProcessed = true;
          }
        } catch (err) {
          console.warn('AI processing failed:', err);
          aiError = err;
          // Continue with raw transcript - will be saved anyway
        }
      }
    }

    try {
      // Save to database (with or without AI processing)
      const saveData = {
        user_id: this.user.id,
        title: episodeTitle,
        site_name: showName,
        content: processedContent,
        excerpt: processedContent.substring(0, 300) + '...',
        source: 'manual',
        content_type: 'podcast',
        podcast_metadata: {
          show_name: showName,
          episode_title: episodeTitle,
          episode_date: episodeDate || null,
          key_points: keyPoints,
          original_length: transcript.length,
          processed: wasProcessed,
        },
      };

      console.log('Saving podcast:', saveData);
      const { data, error } = await this.supabase.from('saves').insert(saveData).select();

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }
      console.log('Saved successfully:', data);

      // Show success message (with note about AI if it failed)
      if (aiError && shouldPrettify) {
        status.textContent = 'Transcript saved! (AI processing failed - you can clean it up later)';
      } else {
        status.textContent = 'Transcript saved!';
      }
      status.className = 'podcast-status success';
      status.classList.remove('hidden');

      setTimeout(() => {
        this.hidePodcastModal();
        // Navigate to podcasts view to show the new entry
        this.setView('podcasts');
      }, 1000);

    } catch (error) {
      console.error('Error saving podcast:', error);
      status.textContent = `Error saving transcript: ${error.message || 'Please try again.'}`;
      status.className = 'podcast-status error';
      status.classList.remove('hidden');
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save Transcript';
    }
  }

  async processTranscriptWithAI(transcript, config) {
    // For long transcripts, process in chunks to avoid output token limits
    const CHUNK_SIZE = 15000; // Characters per chunk (safe for input)

    if (transcript.length > CHUNK_SIZE) {
      return await this.processLongTranscriptWithAI(transcript, config);
    }

    const prompt = `You are a helpful assistant that processes podcast transcripts. Please:

1. Clean up the transcript: Fix punctuation, add proper paragraph breaks, remove filler words if excessive (um, uh, like), and improve readability while preserving the speaker's voice.

2. If you can identify different speakers, label them (e.g., "Host:", "Guest:", or use names if mentioned).

3. Remove advertisement reads. Look for clear indicators like:
   - Explicit sponsor mentions ("This episode is brought to you by...", "Thanks to [brand] for sponsoring...")
   - Promo codes and discount offers ("Use code X for 20% off...")
   - Product pitches that interrupt the main content with commercial language
   - Mid-roll ad transitions ("Now a word from our sponsors", "Now back to the show")
   Be CONSERVATIVE - only remove content you're highly confident is an ad. When in doubt, keep it.

4. Extract 3-5 key points or takeaways from the transcript.

IMPORTANT: Return the COMPLETE cleaned transcript (minus obvious ads). Do not truncate or summarize the actual content.

Return your response in this exact JSON format:
{
  "content": "The cleaned up transcript with proper formatting...",
  "keyPoints": ["Key point 1", "Key point 2", "Key point 3"]
}

Here is the transcript to process:

${transcript}`;

    try {
      if (config.provider === 'claude') {
        return await this.callClaudeAPI(prompt, config.apiKey, config.model, 16000);
      } else {
        return await this.callOpenAIAPI(prompt, config.apiKey, config.model, 16000);
      }
    } catch (error) {
      console.error('AI processing error:', error);
      return null;
    }
  }

  async processLongTranscriptWithAI(transcript, config) {
    // Split transcript into chunks, trying to break at paragraph/speaker boundaries
    const CHUNK_SIZE = 12000;
    const chunks = [];
    let remaining = transcript;

    while (remaining.length > 0) {
      if (remaining.length <= CHUNK_SIZE) {
        chunks.push(remaining);
        break;
      }

      // Try to find a good break point (double newline, speaker label, or single newline)
      let breakPoint = remaining.lastIndexOf('\n\n', CHUNK_SIZE);
      if (breakPoint < CHUNK_SIZE * 0.5) {
        breakPoint = remaining.lastIndexOf('\n**', CHUNK_SIZE); // Speaker label
      }
      if (breakPoint < CHUNK_SIZE * 0.5) {
        breakPoint = remaining.lastIndexOf('\n', CHUNK_SIZE);
      }
      if (breakPoint < CHUNK_SIZE * 0.5) {
        breakPoint = CHUNK_SIZE;
      }

      chunks.push(remaining.substring(0, breakPoint));
      remaining = remaining.substring(breakPoint).trim();
    }

    console.log(`Processing transcript in ${chunks.length} chunks`);

    // Process each chunk
    const processedChunks = [];
    for (let i = 0; i < chunks.length; i++) {
      const isFirst = i === 0;
      const isLast = i === chunks.length - 1;

      const prompt = `You are a helpful assistant that processes podcast transcripts. This is chunk ${i + 1} of ${chunks.length}.

Please clean up this transcript chunk:
- Fix punctuation and add proper paragraph breaks
- Remove excessive filler words (um, uh, like)
- Preserve speaker labels if present
- Remove obvious advertisement reads (sponsor mentions, promo codes, "brought to you by" segments). Be CONSERVATIVE - only remove content you're highly confident is an ad.
- IMPORTANT: Return the COMPLETE cleaned chunk (minus ads). Do not truncate, summarize, or omit actual content.

${isFirst ? 'This is the beginning of the transcript.' : 'This continues from the previous chunk.'}
${isLast ? 'This is the end of the transcript.' : 'More chunks will follow.'}

Return ONLY the cleaned transcript text, no JSON wrapper needed for chunks.

Here is the chunk to process:

${chunks[i]}`;

      try {
        let result;
        if (config.provider === 'claude') {
          result = await this.callClaudeAPIRaw(prompt, config.apiKey, config.model, 16000);
        } else {
          result = await this.callOpenAIAPIRaw(prompt, config.apiKey, config.model, 16000);
        }
        processedChunks.push(result);
      } catch (error) {
        console.error(`Error processing chunk ${i + 1}:`, error);
        // Use original chunk if processing fails
        processedChunks.push(chunks[i]);
      }
    }

    // Now get key points from the full transcript (using a summary)
    let keyPoints = null;
    try {
      const summaryPrompt = `Based on this podcast transcript, extract 3-5 key points or takeaways. Return ONLY a JSON array of strings, like: ["Point 1", "Point 2", "Point 3"]

Transcript (first 10000 chars):
${transcript.substring(0, 10000)}${transcript.length > 10000 ? '\n\n[... transcript continues ...]' : ''}`;

      let keyPointsResult;
      if (config.provider === 'claude') {
        keyPointsResult = await this.callClaudeAPIRaw(summaryPrompt, config.apiKey, config.model, 2000);
      } else {
        keyPointsResult = await this.callOpenAIAPIRaw(summaryPrompt, config.apiKey, config.model, 2000);
      }

      const jsonMatch = keyPointsResult.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        keyPoints = JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      console.warn('Failed to extract key points:', error);
    }

    return {
      content: processedChunks.join('\n\n'),
      keyPoints
    };
  }

  async callClaudeAPI(prompt, apiKey, model, maxTokens = 8000) {
    const result = await this.callClaudeAPIRaw(prompt, apiKey, model, maxTokens);

    // Parse JSON from response
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    return { content: result, keyPoints: null };
  }

  async callClaudeAPIRaw(prompt, apiKey, model, maxTokens = 8000) {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: model || 'claude-sonnet-4-20250514',
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Claude API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data.content[0].text;
  }

  async callOpenAIAPI(prompt, apiKey, model, maxTokens = 8000) {
    const result = await this.callOpenAIAPIRaw(prompt, apiKey, model, maxTokens);

    // Parse JSON from response
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    return { content: result, keyPoints: null };
  }

  async callOpenAIAPIRaw(prompt, apiKey, model, maxTokens = 8000) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model || 'gpt-4.1',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: maxTokens,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }

  // Load Podcasts View
  async loadPodcasts() {
    const container = document.getElementById('saves-container');
    const loading = document.getElementById('loading');
    const empty = document.getElementById('empty-state');

    loading.classList.remove('hidden');
    container.innerHTML = '';

    const { data, error } = await this.supabase
      .from('saves')
      .select('*')
      .eq('content_type', 'podcast')
      .order('created_at', { ascending: false });

    loading.classList.add('hidden');

    if (error) {
      console.error('Error loading podcasts:', error);
      return;
    }

    if (!data || data.length === 0) {
      empty.classList.remove('hidden');
      document.querySelector('.empty-icon').textContent = '🎙️';
      document.querySelector('.empty-state h3').textContent = 'No podcasts yet';
      document.querySelector('.empty-state p').textContent = 'Add podcast transcripts using the "Add Podcast Transcript" button in the sidebar.';
      return;
    }

    empty.classList.add('hidden');

    // Group by show name
    const shows = {};
    data.forEach(save => {
      const showName = save.site_name || 'Unknown Show';
      if (!shows[showName]) {
        shows[showName] = {
          name: showName,
          episodes: [],
        };
      }
      shows[showName].episodes.push(save);
    });

    const sortedShows = Object.values(shows).sort((a, b) => b.episodes.length - a.episodes.length);

    this.renderPodcastShows(sortedShows, data);
  }

  renderPodcastShows(shows, allEpisodes) {
    const container = document.getElementById('saves-container');

    container.innerHTML = `
      <div class="podcasts-stats">
        <div class="podcasts-stat">
          <span class="podcasts-stat-value">${allEpisodes.length}</span>
          <span class="podcasts-stat-label">episodes</span>
        </div>
        <div class="podcasts-stat">
          <span class="podcasts-stat-value">${shows.length}</span>
          <span class="podcasts-stat-label">shows</span>
        </div>
        <button class="btn primary podcasts-add-btn" id="podcasts-add-btn">+ Add Transcript</button>
      </div>
      <div class="podcasts-shows-grid">
        ${shows.map(show => `
          <div class="podcast-show-card" data-show="${this.escapeHtml(show.name)}">
            <div class="podcast-show-header">
              <div class="podcast-show-icon">🎙️</div>
              <div class="podcast-show-info">
                <h3 class="podcast-show-title">${this.escapeHtml(show.name)}</h3>
              </div>
              <span class="podcast-show-count">${show.episodes.length}</span>
            </div>
            <div class="podcast-episodes-preview">
              ${show.episodes.slice(0, 3).map(ep => `
                <div class="podcast-episode-snippet" data-id="${ep.id}">
                  ${this.escapeHtml(ep.title || 'Untitled Episode')}
                </div>
              `).join('')}
              ${show.episodes.length > 3 ? `
                <div class="podcast-more-episodes">+${show.episodes.length - 3} more episodes</div>
              ` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    `;

    // Bind add button
    document.getElementById('podcasts-add-btn').addEventListener('click', () => {
      this.showPodcastModal();
    });

    // Bind episode clicks
    container.querySelectorAll('.podcast-episode-snippet').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = el.dataset.id;
        const save = allEpisodes.find(s => s.id === id);
        if (save) this.openReadingPane(save);
      });
    });

    // Bind show card clicks
    container.querySelectorAll('.podcast-show-card').forEach(card => {
      card.addEventListener('click', () => {
        const showName = card.dataset.show;
        const show = shows.find(s => s.name === showName);
        if (show) this.showPodcastEpisodes(show);
      });
    });
  }

  showPodcastEpisodes(show) {
    const container = document.getElementById('saves-container');

    container.innerHTML = `
      <div class="kindle-book-detail">
        <button class="btn secondary kindle-back-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          Back to all shows
        </button>
        <div class="kindle-book-detail-header">
          <div class="kindle-book-icon-large">🎙️</div>
          <div>
            <h2>${this.escapeHtml(show.name)}</h2>
            <p class="kindle-book-meta">${show.episodes.length} episodes</p>
          </div>
        </div>
        <div class="kindle-highlights-list">
          ${show.episodes.map(ep => `
            <div class="kindle-highlight-card podcast-episode-card" data-id="${ep.id}" style="border-left-color: var(--primary);">
              <div class="kindle-highlight-text" style="font-style: normal; font-weight: 600;">
                ${this.escapeHtml(ep.title || 'Untitled Episode')}
              </div>
              <div style="margin-top: 8px; font-size: 14px; color: var(--text-secondary);">
                ${this.escapeHtml(ep.excerpt || '')}
              </div>
              ${ep.podcast_metadata?.key_points ? `
                <div class="podcast-key-points" style="margin-top: 12px;">
                  <h4>Key Points</h4>
                  <ul>
                    ${ep.podcast_metadata.key_points.map(point => `<li>${this.escapeHtml(point)}</li>`).join('')}
                  </ul>
                </div>
              ` : ''}
              <div class="kindle-highlight-meta">
                ${new Date(ep.created_at).toLocaleDateString()}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    // Back button
    container.querySelector('.kindle-back-btn').addEventListener('click', () => {
      this.loadPodcasts();
    });

    // Episode clicks
    container.querySelectorAll('.podcast-episode-card').forEach(el => {
      el.addEventListener('click', () => {
        const id = el.dataset.id;
        const save = show.episodes.find(s => s.id === id);
        if (save) this.openReadingPane(save);
      });
    });
  }

  // Re-prettify transcript from reading pane
  async prettifyCurrentTranscript() {
    if (!this.currentSave || this.currentSave.content_type !== 'podcast') return;

    const config = this.getAIConfig();
    if (!config.hasKey) {
      alert('Please configure an API key in AI Settings first.');
      return;
    }

    const prettifyBtn = document.querySelector('.prettify-btn');
    if (prettifyBtn) {
      prettifyBtn.disabled = true;
      prettifyBtn.innerHTML = '<div class="spinner" style="width:14px;height:14px;border-width:2px;"></div> Queued...';
    }

    // Show toast and close reading pane
    const title = this.currentSave.title || 'Transcript';
    this.showToast(`Processing "${title.substring(0, 30)}${title.length > 30 ? '...' : ''}" with AI...`, 'info', 3000);

    // Process in background
    this.prettifyTranscriptInBackground(this.currentSave, config);
  }

  async prettifyTranscriptInBackground(save, config) {
    const title = save.title || 'Transcript';
    const job = this.createAIJob(`AI cleanup: ${title.substring(0, 40)}`);
    this.updateAIJob(job.id, { status: 'processing' });

    try {
      const result = await this.processTranscriptWithAI(save.content, config);

      if (result) {
        // Update in database
        const newMetadata = {
          ...save.podcast_metadata,
          key_points: result.keyPoints,
          processed: true,
        };

        await this.supabase
          .from('saves')
          .update({
            content: result.content,
            excerpt: result.content.substring(0, 300) + '...',
            podcast_metadata: newMetadata,
          })
          .eq('id', save.id);

        this.updateAIJob(job.id, { status: 'completed' });
        this.showToast(`"${title.substring(0, 30)}${title.length > 30 ? '...' : ''}" processed successfully`, 'success');

        // If this save is still open, refresh the reading pane
        if (this.currentSave && this.currentSave.id === save.id) {
          this.currentSave.content = result.content;
          this.currentSave.podcast_metadata = newMetadata;
          this.openReadingPane(this.currentSave);
        }

        // Refresh podcasts list if on that view
        if (this.currentView === 'podcasts') {
          this.loadPodcasts();
        }
      } else {
        throw new Error('AI processing returned no result');
      }
    } catch (error) {
      console.error('Error prettifying transcript:', error);
      this.updateAIJob(job.id, { status: 'failed', error: error.message });
      this.showToast('Error processing transcript', 'error');
    }
  }

  // ==================== Apple Podcasts Import Methods ====================

  showApplePodcastsModal() {
    const modal = document.getElementById('apple-podcasts-modal');
    modal.classList.remove('hidden');
    this.resetApplePodcastsModal();
  }

  hideApplePodcastsModal() {
    const modal = document.getElementById('apple-podcasts-modal');
    modal.classList.add('hidden');
    this.resetApplePodcastsModal();
  }

  resetApplePodcastsModal() {
    this.pendingApplePodcasts = [];
    this.selectedApplePodcastPreview = null;

    // Show dropzone container, hide preview
    const dropzoneContainer = document.getElementById('apple-podcasts-dropzone-container');
    if (dropzoneContainer) dropzoneContainer.classList.remove('hidden');

    document.getElementById('apple-podcasts-processing').classList.add('hidden');
    document.getElementById('apple-podcasts-preview').classList.add('hidden');
    document.getElementById('apple-podcasts-footer').classList.add('hidden');
    document.getElementById('apple-podcasts-status').classList.add('hidden');
    document.getElementById('apple-podcasts-dropzone').classList.remove('success', 'processing');

    // Reset transcript preview
    const placeholder = document.querySelector('.apple-podcasts-preview-placeholder');
    const transcriptView = document.getElementById('apple-podcasts-transcript-view');
    if (placeholder) placeholder.classList.remove('hidden');
    if (transcriptView) transcriptView.classList.add('hidden');

    // Reset AI cleanup checkbox
    const aiCheckbox = document.getElementById('apple-podcasts-ai-cleanup');
    if (aiCheckbox) aiCheckbox.checked = false;
  }

  async handleApplePodcastsDrop(e) {
    const items = e.dataTransfer.items;
    if (!items || items.length === 0) return;

    const dropzoneContainer = document.getElementById('apple-podcasts-dropzone-container');
    const dropzone = document.getElementById('apple-podcasts-dropzone');
    const processing = document.getElementById('apple-podcasts-processing');

    dropzone.classList.add('processing');
    processing.classList.remove('hidden');

    // Collect transcripts and database files
    const collectedFiles = {
      transcripts: {},
      mainDB: null,
      walFile: null
    };

    // Process all dropped items (files or folders)
    const promises = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.webkitGetAsEntry) {
        const entry = item.webkitGetAsEntry();
        if (entry) {
          promises.push(this.traverseApplePodcastsEntry(entry, collectedFiles));
        }
      }
    }

    await Promise.all(promises);

    // Try to get episode metadata from SQLite database
    let episodeMetadata = {};
    if (collectedFiles.mainDB) {
      try {
        episodeMetadata = await this.parseApplePodcastsDatabase(
          collectedFiles.mainDB,
          collectedFiles.walFile,
          Object.keys(collectedFiles.transcripts)
        );
      } catch (err) {
        console.error('Error parsing Apple Podcasts database:', err);
      }
    }

    // Merge metadata into transcripts
    for (const [id, transcript] of Object.entries(collectedFiles.transcripts)) {
      if (episodeMetadata[id]) {
        transcript.title = episodeMetadata[id].title || transcript.title;
        transcript.showName = episodeMetadata[id].showName || transcript.showName;
        transcript.description = episodeMetadata[id].description;
        transcript.duration = episodeMetadata[id].duration;
        transcript.publishedAt = episodeMetadata[id].publishedAt;
      }
    }

    processing.classList.add('hidden');

    // Convert transcripts object to array and sort by modification date
    const transcriptArray = Object.values(collectedFiles.transcripts)
      .filter(t => t.content && t.content.length > 0)
      .sort((a, b) => b.lastModified - a.lastModified);

    if (transcriptArray.length === 0) {
      const status = document.getElementById('apple-podcasts-status');
      status.textContent = 'No transcripts found. Make sure you dropped the Apple Podcasts folder or .ttml files.';
      status.className = 'apple-podcasts-status error';
      status.classList.remove('hidden');
      dropzone.classList.remove('processing');
      return;
    }

    // Start with all episodes DESELECTED
    transcriptArray.forEach(t => t.selected = false);

    this.pendingApplePodcasts = transcriptArray;
    this.selectedApplePodcastPreview = null;

    // Hide dropzone container and show preview
    dropzoneContainer.classList.add('hidden');
    dropzone.classList.remove('processing');

    this.renderApplePodcastsPreview();
  }

  async traverseApplePodcastsEntry(entry, collectedFiles) {
    if (entry.isFile) {
      return new Promise((resolve) => {
        entry.file(async (file) => {
          if (file.name.endsWith('.ttml')) {
            const parsed = await this.parseTTMLFile(file);
            if (parsed) {
              collectedFiles.transcripts[parsed.id] = parsed;
            }
          } else if (file.name === 'MTLibrary.sqlite') {
            collectedFiles.mainDB = await file.arrayBuffer();
          } else if (file.name === 'MTLibrary.sqlite-wal') {
            collectedFiles.walFile = await file.arrayBuffer();
          }
          resolve();
        }, resolve);
      });
    } else if (entry.isDirectory) {
      return new Promise((resolve) => {
        const reader = entry.createReader();
        const readEntries = () => {
          reader.readEntries(async (entries) => {
            if (entries.length === 0) {
              resolve();
              return;
            }
            await Promise.all(entries.map(e => this.traverseApplePodcastsEntry(e, collectedFiles)));
            // Continue reading (directories can have >100 entries)
            readEntries();
          }, resolve);
        };
        readEntries();
      });
    }
  }

  async parseApplePodcastsDatabase(mainDB, walFile, transcriptIds) {
    // Initialize sql.js
    const SQL = await initSqlJs({
      locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/${file}`
    });

    // Try to open database with WAL file if available
    let db;
    try {
      const mainArray = new Uint8Array(mainDB);
      db = new SQL.Database(mainArray);
    } catch (err) {
      console.error('Error opening database:', err);
      return {};
    }

    const metadata = {};

    try {
      // Check which columns exist
      const tableInfo = db.exec('PRAGMA table_info(ZMTEPISODE);');
      if (!tableInfo.length || !tableInfo[0].values) {
        return {};
      }

      const columns = new Set(tableInfo[0].values.map(v => v[1]));
      const hasFirstTimeAvailable = columns.has('ZFIRSTTIMEAVAILABLE');

      // Build query based on available columns
      const selectColumns = [
        'ZSTORETRACKID',
        'ZAUTHOR',
        'ZCLEANEDTITLE',
        'ZITUNESSUBTITLE',
        'ZDURATION'
      ];
      if (hasFirstTimeAvailable) {
        selectColumns.push('ZFIRSTTIMEAVAILABLE');
      }

      // Query for all transcript IDs
      const idsToQuery = transcriptIds.filter(id => /^\d+$/.test(id));
      if (idsToQuery.length === 0) {
        return {};
      }

      const query = `
        SELECT ${selectColumns.join(', ')}
        FROM ZMTEPISODE
        WHERE ZSTORETRACKID IN (${idsToQuery.join(', ')})
      `;

      const results = db.exec(query);
      if (results.length && results[0].values) {
        for (const row of results[0].values) {
          const storeTrackId = String(row[0]);
          metadata[storeTrackId] = {
            showName: row[1] || 'Unknown Podcast',
            title: row[2] || `Episode ${storeTrackId}`,
            description: row[3] || '',
            duration: row[4] || 0,
            publishedAt: hasFirstTimeAvailable && row[5] ?
              new Date((row[5] + 978307200) * 1000) : null // Convert from Mac epoch
          };
        }
      }
    } catch (err) {
      console.error('Error querying database:', err);
    } finally {
      db.close();
    }

    return metadata;
  }

  async parseTTMLFile(file) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parser = new DOMParser();
          const xmlDoc = parser.parseFromString(reader.result, 'application/xml');

          // Check for parse errors
          const parseError = xmlDoc.querySelector('parsererror');
          if (parseError) {
            resolve(null);
            return;
          }

          // Extract podcast ID from filename (transcript_XXXXX.ttml)
          const idMatch = file.name.match(/transcript_(\d+)/);
          const podcastId = idMatch ? idMatch[1] : file.name;

          // Get title from tt element or body
          const ttElement = xmlDoc.querySelector('tt');
          const title = ttElement?.getAttribute('xml:lang') ?
            file.name.replace('.ttml', '').replace('transcript_', 'Episode ') :
            file.name.replace('.ttml', '');

          // Parse speaking chunks
          const chunks = [];
          const paragraphs = xmlDoc.querySelectorAll('p');

          for (const p of paragraphs) {
            const speaker = p.getAttribute('ttm:agent') || '';
            const sentences = [];

            // Get all spans with podcasts:unit='sentence'
            const spans = p.querySelectorAll('span');
            for (const span of spans) {
              if (span.getAttribute('podcasts:unit') === 'sentence') {
                // Get text from nested spans
                const words = [];
                const wordSpans = span.querySelectorAll('span');
                if (wordSpans.length > 0) {
                  for (const wordSpan of wordSpans) {
                    if (wordSpan.textContent.trim()) {
                      words.push(wordSpan.textContent.trim());
                    }
                  }
                } else if (span.textContent.trim()) {
                  words.push(span.textContent.trim());
                }
                if (words.length > 0) {
                  sentences.push(words.join(' '));
                }
              }
            }

            if (sentences.length > 0) {
              chunks.push({
                speaker,
                text: sentences.join(' ')
              });
            }
          }

          // Build full transcript text
          let content = '';
          let currentSpeaker = '';
          for (const chunk of chunks) {
            if (chunk.speaker && chunk.speaker !== currentSpeaker) {
              currentSpeaker = chunk.speaker;
              content += `\n\n**${currentSpeaker}:** `;
            }
            content += chunk.text + ' ';
          }

          resolve({
            id: podcastId,
            title: title,
            showName: 'Apple Podcasts',
            content: content.trim(),
            lastModified: file.lastModified,
            selected: true
          });
        } catch (err) {
          console.error('Error parsing TTML:', err);
          resolve(null);
        }
      };
      reader.onerror = () => resolve(null);
      reader.readAsText(file);
    });
  }

  renderApplePodcastsPreview() {
    const preview = document.getElementById('apple-podcasts-preview');
    const footer = document.getElementById('apple-podcasts-footer');
    const count = document.getElementById('apple-podcasts-count');
    const selectedCount = document.getElementById('apple-podcasts-selected-count');
    const list = document.getElementById('apple-podcasts-list');

    // Initialize filter state if not set
    if (this.applePodcastsFilter === undefined) {
      this.applePodcastsFilter = 'last30'; // Default to last 30 days
      this.applePodcastsSearch = '';
    }

    // Filter podcasts based on current filter and search
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const filteredPodcasts = this.pendingApplePodcasts.filter((podcast, index) => {
      // Store original index for reference
      podcast._originalIndex = index;

      // Apply date filter
      if (this.applePodcastsFilter === 'last30' && podcast.publishedAt) {
        const publishedDate = new Date(podcast.publishedAt);
        if (publishedDate < thirtyDaysAgo) return false;
      }

      // Apply search filter
      if (this.applePodcastsSearch) {
        const searchLower = this.applePodcastsSearch.toLowerCase();
        const titleMatch = (podcast.title || '').toLowerCase().includes(searchLower);
        const showMatch = (podcast.showName || '').toLowerCase().includes(searchLower);
        if (!titleMatch && !showMatch) return false;
      }

      return true;
    });

    count.textContent = `${filteredPodcasts.length} of ${this.pendingApplePodcasts.length}`;
    this.updateApplePodcastsSelectedCount();

    // Update AI hint based on config
    const config = this.getAIConfig();
    const aiHint = document.getElementById('apple-podcasts-ai-hint');
    if (aiHint) {
      if (config.hasKey) {
        aiHint.textContent = `Using ${config.provider === 'claude' ? 'Claude' : 'OpenAI'}`;
        aiHint.style.color = 'var(--success)';
      } else {
        aiHint.textContent = 'Requires API key in AI Settings';
        aiHint.style.color = '';
      }
    }

    // Add search and filter controls at top of list
    let html = `
      <div class="apple-podcasts-filters">
        <div class="apple-podcasts-search">
          <input type="text" id="apple-podcasts-search-input" placeholder="Search episodes..." value="${this.escapeHtml(this.applePodcastsSearch || '')}">
        </div>
        <div class="apple-podcasts-date-filter">
          <label>
            <input type="checkbox" id="apple-podcasts-last30" ${this.applePodcastsFilter === 'last30' ? 'checked' : ''}>
            Last 30 days only
          </label>
        </div>
      </div>
      <div class="apple-podcasts-select-all">
        <input type="checkbox" id="apple-podcasts-select-all">
        <label for="apple-podcasts-select-all">Select all visible (${filteredPodcasts.length})</label>
      </div>
    `;

    html += filteredPodcasts.map((podcast) => {
      const dateStr = podcast.publishedAt ?
        new Date(podcast.publishedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) :
        '';
      return `
      <div class="apple-podcast-item ${podcast.selected ? 'selected' : ''}" data-index="${podcast._originalIndex}">
        <input type="checkbox" ${podcast.selected ? 'checked' : ''}>
        <div class="apple-podcast-item-info">
          <div class="apple-podcast-item-title">${this.escapeHtml(podcast.title)}</div>
          <div class="apple-podcast-item-show">${this.escapeHtml(podcast.showName)}${dateStr ? ` · ${dateStr}` : ''}</div>
          <div class="apple-podcast-item-meta">${Math.round(podcast.content.length / 1000)}k characters</div>
        </div>
      </div>
    `;
    }).join('');

    list.innerHTML = html;

    // Bind search input event
    const searchInput = document.getElementById('apple-podcasts-search-input');
    searchInput.addEventListener('input', (e) => {
      this.applePodcastsSearch = e.target.value;
      this.renderApplePodcastsPreview();
    });

    // Bind date filter checkbox
    const dateFilterCheckbox = document.getElementById('apple-podcasts-last30');
    dateFilterCheckbox.addEventListener('change', (e) => {
      this.applePodcastsFilter = e.target.checked ? 'last30' : 'all';
      this.renderApplePodcastsPreview();
    });

    // Bind click events for episode items
    list.querySelectorAll('.apple-podcast-item').forEach(item => {
      // Click on the item info area shows preview
      item.querySelector('.apple-podcast-item-info').addEventListener('click', (e) => {
        e.stopPropagation();
        const index = parseInt(item.dataset.index);
        this.showApplePodcastTranscriptPreview(index);
      });

      // Click on checkbox area toggles selection
      item.querySelector('input').addEventListener('click', (e) => {
        e.stopPropagation();
      });

      item.querySelector('input').addEventListener('change', (e) => {
        const index = parseInt(item.dataset.index);
        this.pendingApplePodcasts[index].selected = e.target.checked;
        item.classList.toggle('selected', e.target.checked);
        this.updateApplePodcastsSelectAll();
        this.updateApplePodcastsSelectedCount();
      });

      // Click on the item itself (not info) also shows preview
      item.addEventListener('click', (e) => {
        if (e.target.type === 'checkbox') return;
        const index = parseInt(item.dataset.index);
        this.showApplePodcastTranscriptPreview(index);
      });
    });

    // Select all checkbox - only selects visible (filtered) items
    document.getElementById('apple-podcasts-select-all').addEventListener('change', (e) => {
      filteredPodcasts.forEach((p) => {
        this.pendingApplePodcasts[p._originalIndex].selected = e.target.checked;
      });
      list.querySelectorAll('.apple-podcast-item').forEach(item => {
        item.classList.toggle('selected', e.target.checked);
        item.querySelector('input').checked = e.target.checked;
      });
      this.updateApplePodcastsSelectedCount();
    });

    preview.classList.remove('hidden');
    footer.classList.remove('hidden');

    // Focus search input but don't select text if already has value
    if (!this.applePodcastsSearch) {
      searchInput.focus();
    }
  }

  showApplePodcastTranscriptPreview(index) {
    const podcast = this.pendingApplePodcasts[index];
    if (!podcast) return;

    this.selectedApplePodcastPreview = index;

    // Update active state in list
    const list = document.getElementById('apple-podcasts-list');
    list.querySelectorAll('.apple-podcast-item').forEach((item, i) => {
      item.classList.toggle('active', parseInt(item.dataset.index) === index);
    });

    // Show transcript preview
    const placeholder = document.querySelector('.apple-podcasts-preview-placeholder');
    const transcriptView = document.getElementById('apple-podcasts-transcript-view');
    const titleEl = document.getElementById('apple-podcasts-transcript-title');
    const showEl = document.getElementById('apple-podcasts-transcript-show');
    const contentEl = document.getElementById('apple-podcasts-transcript-content');

    placeholder.classList.add('hidden');
    transcriptView.classList.remove('hidden');

    titleEl.textContent = podcast.title;

    const dateStr = podcast.publishedAt ?
      new Date(podcast.publishedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) :
      '';
    showEl.textContent = podcast.showName + (dateStr ? ` · ${dateStr}` : '');

    // Render transcript content with basic markdown-like formatting
    contentEl.innerHTML = this.renderMarkdown(podcast.content);
  }

  updateApplePodcastsSelectAll() {
    const allSelected = this.pendingApplePodcasts.every(p => p.selected);
    const noneSelected = this.pendingApplePodcasts.every(p => !p.selected);
    const selectAll = document.getElementById('apple-podcasts-select-all');
    if (selectAll) {
      selectAll.checked = allSelected;
      selectAll.indeterminate = !allSelected && !noneSelected;
    }
  }

  updateApplePodcastsSelectedCount() {
    const selectedCount = document.getElementById('apple-podcasts-selected-count');
    if (selectedCount) {
      const count = this.pendingApplePodcasts.filter(p => p.selected).length;
      selectedCount.textContent = count;
    }
  }

  async confirmApplePodcastsImport() {
    const selected = this.pendingApplePodcasts.filter(p => p.selected);
    if (selected.length === 0) {
      const status = document.getElementById('apple-podcasts-status');
      status.textContent = 'Please select at least one transcript to import.';
      status.className = 'apple-podcasts-status error';
      status.classList.remove('hidden');
      return;
    }

    const shouldAICleanup = document.getElementById('apple-podcasts-ai-cleanup')?.checked;

    // Close modal immediately and navigate to podcasts view
    this.hideApplePodcastsModal();
    this.setView('podcasts');

    // Show toast to indicate background processing started
    const config = this.getAIConfig();
    const canUseAI = shouldAICleanup && config.hasKey;
    const message = canUseAI
      ? `Processing ${selected.length} podcast${selected.length === 1 ? '' : 's'} with AI...`
      : `Importing ${selected.length} podcast${selected.length === 1 ? '' : 's'}...`;
    this.showToast(message, 'info', 3000);

    // Process in background (don't await)
    this.processApplePodcastsInBackground(selected, shouldAICleanup);
  }

  // ==================== AI Job Queue Methods ====================

  showAIJobsModal() {
    const modal = document.getElementById('ai-jobs-modal');
    modal.classList.remove('hidden');
    this.renderAIJobsList();
  }

  hideAIJobsModal() {
    const modal = document.getElementById('ai-jobs-modal');
    modal.classList.add('hidden');
  }

  // Delegate to services/ai-jobs.js (called from init())
  // loadAIJobs() - imported function is called directly in init()

  // Delegate to services/ai-jobs.js
  saveAIJobs() {
    saveAIJobs();
  }

  // ==================== AI Enrichment ====================

  async aiEnrichContent() {
    if (!this.currentSave) {
      this.showToast('No content selected', 'error');
      return;
    }

    const config = this.getAIConfig();
    if (!config.hasKey) {
      this.showToast('Please configure your AI settings first', 'error');
      document.getElementById('ai-settings-btn').click();
      return;
    }

    const save = this.currentSave;
    const contentType = save.content_type || 'article';
    const title = save.title || 'Untitled';

    // Create AI job
    const job = this.createAIJob(`Enrich: ${title.substring(0, 40)}${title.length > 40 ? '...' : ''}`);

    this.showToast('AI enrichment started', 'success');

    // Run enrichment in background
    this.runAIEnrichment(save, config, job);
  }

  async runAIEnrichment(save, config, job) {
    this.updateAIJob(job.id, { status: 'processing' });

    try {
      // Get content to analyze
      let contentToAnalyze = '';
      const contentType = save.content_type || 'article';

      if (contentType === 'book') {
        try {
          const bookData = JSON.parse(save.content || '{}');
          contentToAnalyze = `Title: ${save.title}\nAuthor: ${save.author || save.site_name || 'Unknown'}\nDescription: ${bookData.description || ''}\nNotes: ${bookData.notes || ''}`;
        } catch (e) {
          contentToAnalyze = save.content || save.excerpt || '';
        }
      } else if (contentType === 'podcast') {
        contentToAnalyze = `Title: ${save.title}\nShow: ${save.site_name || 'Unknown'}\nTranscript: ${(save.content || save.excerpt || '').substring(0, 8000)}`;
      } else {
        contentToAnalyze = `Title: ${save.title}\nSource: ${save.site_name || 'Unknown'}\nContent: ${(save.content || save.excerpt || '').substring(0, 8000)}`;
      }

      const prompt = `Analyze this ${contentType} and provide:
1. 3-5 key points or takeaways (as a JSON array of strings)
2. 3-7 relevant tags/topics for categorization (as a JSON array of strings, lowercase, single words or short phrases)

${contentToAnalyze}

Respond ONLY with valid JSON in this exact format:
{
  "key_points": ["point 1", "point 2", "point 3"],
  "tags": ["tag1", "tag2", "tag3"]
}`;

      let result;
      if (config.provider === 'claude') {
        result = await this.callClaudeAPI(prompt, config.apiKey, config.model, 1024);
      } else {
        result = await this.callOpenAIAPI(prompt, config.apiKey, config.model, 1024);
      }

      // The API methods already parse JSON, but handle key_points vs keyPoints
      if (result.keyPoints && !result.key_points) {
        result.key_points = result.keyPoints;
      }

      // Update the save with AI metadata
      const aiMetadata = {
        key_points: result.key_points || [],
        tags: result.tags || [],
        enriched_at: new Date().toISOString(),
      };

      // Update in database
      const { error } = await this.supabase
        .from('saves')
        .update({ ai_metadata: aiMetadata })
        .eq('id', save.id);

      if (error) throw error;

      // Add tags to the save
      if (result.tags && result.tags.length > 0) {
        await this.addTagsToSave(save.id, result.tags);
      }

      // Update local save object
      save.ai_metadata = aiMetadata;

      // Mark job as completed
      this.updateAIJob(job.id, { status: 'completed', completedItems: 1 });

      this.showToast('AI enrichment completed', 'success');

      // Refresh the reading pane if this save is still open
      if (this.currentSave && this.currentSave.id === save.id) {
        this.currentSave = save;
        this.openReadingPane(save);
      }

      // Refresh the tags list
      this.loadTags();

    } catch (error) {
      console.error('AI enrichment failed:', error);
      this.updateAIJob(job.id, { status: 'failed', error: error.message || 'Unknown error' });
      this.showToast('AI enrichment failed: ' + (error.message || 'Unknown error'), 'error');
    }
  }

  async addTagsToSave(saveId, tags) {
    // Get existing tags for this save
    const { data: existingTags } = await this.supabase
      .from('save_tags')
      .select('tag_id, tags(name)')
      .eq('save_id', saveId);

    const existingTagNames = new Set((existingTags || []).map(t => t.tags?.name?.toLowerCase()));

    for (const tagName of tags) {
      const normalizedTag = tagName.toLowerCase().trim();

      // Skip if tag already exists on this save
      if (existingTagNames.has(normalizedTag)) continue;

      // Get or create the tag - use maybeSingle() to avoid error when tag doesn't exist
      let { data: tag, error: findError } = await this.supabase
        .from('tags')
        .select('id')
        .eq('name', normalizedTag)
        .eq('user_id', this.user.id)
        .maybeSingle();

      if (findError) {
        console.error('Error finding tag:', findError);
        continue;
      }

      if (!tag) {
        // Create new tag
        const { data: newTag, error: createError } = await this.supabase
          .from('tags')
          .insert([{ name: normalizedTag, user_id: this.user.id }])
          .select()
          .single();

        if (createError) {
          console.error('Error creating tag:', createError);
          continue;
        }
        tag = newTag;
      }

      // Link tag to save
      const { error: linkError } = await this.supabase
        .from('save_tags')
        .insert([{ save_id: saveId, tag_id: tag.id }]);

      if (linkError) {
        console.error('Error linking tag to save:', linkError);
      }
    }
  }

  // Delegate to services/ai-jobs.js
  createAIJob(title, totalItems = 1) {
    return createAIJob(title, totalItems);
  }

  // Delegate to services/ai-jobs.js
  updateAIJob(jobId, updates) {
    return updateAIJob(jobId, updates);
  }

  // Delegate to services/ai-jobs.js
  updateAIJobsUI() {
    updateAIJobsUI();
  }

  // Delegate to services/ai-jobs.js
  renderAIJobsList() {
    renderAIJobsList();
  }

  // Delegate to lib/utils.js
  getTimeAgo(date) {
    return getTimeAgo(date);
  }

  // Delegate to lib/utils.js
  showToast(message, type = 'success', duration = 4000) {
    showToast(message, type, duration);
  }

  // ==================== Background Import Processing ====================

  async processApplePodcastsInBackground(selected, shouldAICleanup) {
    const config = this.getAIConfig();
    const canUseAI = shouldAICleanup && config.hasKey;

    // Create a job for tracking
    const jobTitle = selected.length === 1
      ? selected[0].title.substring(0, 50)
      : `${selected.length} podcasts`;
    const job = this.createAIJob(canUseAI ? `AI processing: ${jobTitle}` : `Importing: ${jobTitle}`, selected.length);

    this.updateAIJob(job.id, { status: 'processing' });

    let successCount = 0;
    let aiSuccessCount = 0;

    try {
      for (let i = 0; i < selected.length; i++) {
        const podcast = selected[i];

        let processedContent = podcast.content;
        let keyPoints = null;
        let wasProcessed = false;

        // Try AI cleanup if enabled
        if (canUseAI) {
          try {
            const result = await this.processTranscriptWithAI(podcast.content, config);
            if (result) {
              processedContent = result.content;
              keyPoints = result.keyPoints;
              wasProcessed = true;
              aiSuccessCount++;
            }
          } catch (aiError) {
            console.warn('AI processing failed for:', podcast.title, aiError);
            // Continue with raw transcript
          }
        }

        const saveData = {
          user_id: this.user.id,
          title: podcast.title,
          site_name: podcast.showName,
          content: processedContent,
          excerpt: processedContent.substring(0, 300) + '...',
          source: 'apple-podcasts',
          content_type: 'podcast',
          podcast_metadata: {
            show_name: podcast.showName,
            episode_title: podcast.title,
            episode_date: podcast.publishedAt ? podcast.publishedAt.toISOString().split('T')[0] : null,
            apple_podcast_id: podcast.id,
            key_points: keyPoints,
            original_length: podcast.content.length,
            processed: wasProcessed,
          },
        };

        const { error } = await this.supabase.from('saves').insert(saveData);
        if (!error) {
          successCount++;
        } else {
          console.error('Supabase insert error for:', podcast.title, error);
        }

        // Update job progress
        this.updateAIJob(job.id, { completedItems: i + 1 });
      }

      // Mark job complete
      this.updateAIJob(job.id, { status: 'completed' });

      // Show success toast
      let message = `Imported ${successCount} podcast${successCount === 1 ? '' : 's'}`;
      if (canUseAI && aiSuccessCount > 0) {
        message += ` (${aiSuccessCount} with AI)`;
      }
      this.showToast(message, 'success');

      // Refresh the podcasts view if we're on it
      if (this.currentView === 'podcasts') {
        this.loadPodcasts();
      }

    } catch (error) {
      console.error('Error in background processing:', error);
      this.updateAIJob(job.id, { status: 'failed', error: error.message });
      this.showToast('Error processing podcasts', 'error');
    }
  }
}

// Initialize app and expose globally for inline onclick handlers
const app = new StashApp();
window.app = app;
