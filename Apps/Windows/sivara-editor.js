// ============================================
// Sivara Editor — Offline Document Editor
// Uses TipTap (bundled from dist/tiptap-bundle.js)
// ============================================

class SivaraEditor {
  constructor() {
    this.filePath = null;
    this.fileName = null;
    this.fileData = null;
    this.encService = new EncryptionService();
    this.editor = null;
    this.isModified = false;
    this.isOnline = navigator.onLine;
    this.autoSaveInterval = null;
    this.lastSavedAt = null;

    this.init();
  }

  async init() {
    this.cacheElements();
    this.bindEvents();
    this.initTipTap();
    this.startConnectivityCheck();
    this.startAutoSave();

    if (window.electronAPI) {
      window.electronAPI.onOpenSivaraFile((filePath) => {
        if (!this.filePath) this.openFile(filePath);
      });

      const pendingFile = await window.electronAPI.getPendingFile();
      if (pendingFile) {
        await window.electronAPI.clearPendingFile();
        this.openFile(pendingFile);
      }
    }
  }

  // ---- TipTap Init ----

  initTipTap() {
    const { StarterKit, Underline, TextAlign, TextStyle, FontFamily, FontSize, AdvancedImage, Placeholder } = window.TipTapExtensions;

    this.editor = new window.TipTapEditor({
      element: document.getElementById('editor'),
      extensions: [
        StarterKit,
        Underline,
        TextStyle,
        FontFamily,
        FontSize,
        AdvancedImage,
        TextAlign.configure({ types: ['heading', 'paragraph'] }),
        Placeholder.configure({ placeholder: 'Commencez à écrire...' }),
      ],
      content: '',
      editorProps: {
        attributes: {
          class: 'tiptap',
          spellcheck: 'true',
        },
      },
      onUpdate: () => {
        this.markModified();
        this.updateCharCount();
        this.updateToolbarState();
      },
      onSelectionUpdate: () => {
        this.updateToolbarState();
      },
    });
  }

  cacheElements() {
    this.btnMinimize = document.getElementById('btn-minimize');
    this.btnMaximize = document.getElementById('btn-maximize');
    this.btnClose = document.getElementById('btn-close');
    this.btnBack = document.getElementById('btn-back');
    this.btnSave = document.getElementById('btn-save');
    this.btnRetryOnline = document.getElementById('btn-retry-online');

    this.docTitle = document.getElementById('doc-title');
    this.docIconBtn = document.getElementById('doc-icon-btn');
    this.statusDot = document.getElementById('status-dot');
    this.statusText = document.getElementById('status-text');
    this.charCount = document.getElementById('char-count');
    this.lastSavedEl = document.getElementById('last-saved');
    this.filePathDisplay = document.getElementById('file-path-display');
    this.connectivityBadge = document.getElementById('connectivity-badge');
    this.internetRequired = document.getElementById('internet-required');
    this.securityFlagsList = document.getElementById('security-flags-list');

    this.fontFamilySelect = document.getElementById('font-family');
    this.fontSizeSelect = document.getElementById('font-size');
  }

  bindEvents() {
    // Window controls
    this.btnMinimize.addEventListener('click', () => window.electronAPI?.minimize());
    this.btnMaximize.addEventListener('click', () => window.electronAPI?.maximize());
    this.btnClose.addEventListener('click', () => {
      if (this.isModified) {
        if (confirm('Des modifications non enregistrées seront perdues. Quitter ?')) {
          window.electronAPI?.close();
        }
      } else {
        window.electronAPI?.close();
      }
    });

    this.btnBack.addEventListener('click', () => {
      if (this.isModified && !confirm('Modifications non enregistrées. Retourner au navigateur ?')) return;
      window.location.href = 'index.html';
    });

    this.btnSave.addEventListener('click', () => this.saveFile());
    if (this.btnRetryOnline) this.btnRetryOnline.addEventListener('click', () => this.retryWithOnline());

    this.docTitle.addEventListener('input', () => this.markModified());

    // Font family
    this.fontFamilySelect.addEventListener('change', () => {
      this.editor?.chain().focus().setFontFamily(this.fontFamilySelect.value).run();
    });

    // Font size
    this.fontSizeSelect.addEventListener('change', () => {
      const size = this.fontSizeSelect.value;
      if (size) {
        this.editor?.chain().focus().setMark('textStyle', { fontSize: size }).run();
      }
    });

    // Toolbar buttons
    document.querySelectorAll('.tool-btn[data-cmd]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.execCommand(btn.dataset.cmd);
        this.editor?.commands.focus();
      });
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === 's') { e.preventDefault(); this.saveFile(); }
      if (e.ctrlKey && e.key === 'o') { e.preventDefault(); this.openFileDialog(); }
    });
  }

  // ---- Commands ----

  execCommand(cmd) {
    if (!this.editor) return;
    const chain = this.editor.chain().focus();
    switch (cmd) {
      case 'bold': chain.toggleBold().run(); break;
      case 'italic': chain.toggleItalic().run(); break;
      case 'underline': chain.toggleUnderline().run(); break;
      case 'alignLeft': chain.setTextAlign('left').run(); break;
      case 'alignCenter': chain.setTextAlign('center').run(); break;
      case 'alignRight': chain.setTextAlign('right').run(); break;
      case 'bulletList': chain.toggleBulletList().run(); break;
      case 'orderedList': chain.toggleOrderedList().run(); break;
      case 'image':
        const url = prompt('URL de l\'image :');
        if (url) chain.setImage({ src: url }).run();
        break;
    }
  }

  updateToolbarState() {
    if (!this.editor) return;
    document.querySelectorAll('.tool-btn[data-cmd]').forEach((btn) => {
      const cmd = btn.dataset.cmd;
      let active = false;
      switch (cmd) {
        case 'bold': active = this.editor.isActive('bold'); break;
        case 'italic': active = this.editor.isActive('italic'); break;
        case 'underline': active = this.editor.isActive('underline'); break;
        case 'alignLeft': active = this.editor.isActive({ textAlign: 'left' }); break;
        case 'alignCenter': active = this.editor.isActive({ textAlign: 'center' }); break;
        case 'alignRight': active = this.editor.isActive({ textAlign: 'right' }); break;
        case 'bulletList': active = this.editor.isActive('bulletList'); break;
        case 'orderedList': active = this.editor.isActive('orderedList'); break;
      }
      btn.classList.toggle('active', active);
    });

    // Update font family select
    const ff = this.editor.getAttributes('textStyle').fontFamily;
    if (ff) this.fontFamilySelect.value = ff;

    // Update font size select
    const fs = this.editor.getAttributes('textStyle').fontSize;
    if (fs) this.fontSizeSelect.value = fs;
  }

  // ---- File Operations ----

  async openFile(filePath) {
    this.setStatus('loading', 'Chargement...');

    try {
      const result = await window.electronAPI.readSivaraFile(filePath);
      if (!result.success) throw new Error(result.error);

      this.filePath = filePath;
      this.fileName = result.fileName;
      this.filePathDisplay.textContent = filePath;

      const data = sivaraVM.decompile(result.data);
      this.fileData = data;

      // Security check
      if (data.requiresInternet) {
        const isOnline = await this.checkOnline();
        if (!isOnline) {
          this.showInternetRequired(data.securityFlags);
          return;
        }
      }

      // Set icon/color
      if (data.color) this.docIconBtn.style.background = data.color;

      // Decrypt
      if (data.auto_key) {
        await this.encService.initialize(data.auto_key);
      } else if (data.salt) {
        const password = prompt('Ce document est protégé.\nEntrez le mot de passe :');
        if (!password) { this.setStatus('error', 'Annulé'); return; }
        await this.encService.initialize(password, data.salt);
      } else {
        throw new Error('Format de clé non supporté');
      }

      let decTitle, decContent;
      try {
        // SECURITY: v7 uses separate IVs for title and content; v6 uses same IV (title_iv === content_iv)
        decTitle = await this.encService.decrypt(data.encrypted_title, data.title_iv || data.iv);
        decContent = data.encrypted_content ? await this.encService.decrypt(data.encrypted_content, data.content_iv || data.iv) : '';
      } catch (e) {
        if (data.salt) { alert('Mot de passe incorrect.'); this.setStatus('error', 'Mot de passe invalide'); return; }
        throw e;
      }

      this.docTitle.value = decTitle;
      this.editor.commands.setContent(decContent || '<p></p>');
      this.isModified = false;
      this.updateCharCount();
      this.setStatus('saved', 'Ouvert');
      document.title = `${decTitle} — Sivara Editor`;
    } catch (err) {
      console.error('Open file error:', err);
      this.setStatus('error', 'Erreur');
      alert('Impossible d\'ouvrir ce fichier.\n\n' + err.message);
    }
  }

  async saveFile() {
    if (!this.filePath || !this.fileData) {
      const newPath = await window.electronAPI.saveSivaraDialog();
      if (!newPath) return;
      this.filePath = newPath;
      this.fileName = newPath.split(/[\\/]/).pop();
      this.filePathDisplay.textContent = this.filePath;
    }

    this.setStatus('saving', 'Enregistrement...');

    try {
      const title = this.docTitle.value || 'Sans titre';
      const content = this.editor.getHTML();
      const autoKey = this.fileData.auto_key || crypto.randomUUID();
      await this.encService.initialize(autoKey);

      // SECURITY: Generate separate IVs for title and content (AES-GCM IV reuse fix)
      const { encrypted: encTitle, iv: titleIv } = await this.encService.encrypt(title);
      const { encrypted: encContent, iv: contentIv } = await this.encService.encrypt(content);

      const payload = {
        encrypted_title: encTitle,
        encrypted_content: encContent,
        title_iv: titleIv,
        content_iv: contentIv,
        icon: this.fileData.icon || 'FileText',
        color: this.fileData.color || '#3B82F6',
        salt: null,
        security: {},
        embedded_key: autoKey,
      };

      // compile() is now async (v7 uses AES-GCM for metadata wrapping)
      const binary = await sivaraVM.compile(payload);
      const result = await window.electronAPI.writeSivaraFile(this.filePath, Array.from(binary));
      if (!result.success) throw new Error(result.error);

      this.fileData.auto_key = autoKey;
      this.isModified = false;
      this.lastSavedAt = new Date();
      this.lastSavedEl.textContent = `Sauvegardé à ${this.lastSavedAt.toLocaleTimeString('fr-FR')}`;
      this.setStatus('saved', 'Enregistré ✓');

      if (window.electronAPI.addToSyncQueue) {
        await window.electronAPI.addToSyncQueue({
          filePath: this.filePath, title, icon: this.fileData.icon, color: this.fileData.color,
        });
      }
    } catch (err) {
      console.error('Save error:', err);
      this.setStatus('error', 'Erreur sauvegarde');
      alert('Erreur lors de l\'enregistrement.\n\n' + err.message);
    }
  }

  async openFileDialog() {
    const filePath = await window.electronAPI?.openSivaraDialog();
    if (filePath) this.openFile(filePath);
  }

  // ---- Internet Required ----

  showInternetRequired(flags) {
    const flagLabels = {
      fingerprint: '🔑 Vérification d\'appareil (Digital Fingerprint)',
      email: '📧 Restriction par adresse e-mail',
      geofence: '📍 Restriction géographique (Geofencing)',
    };
    this.securityFlagsList.innerHTML = '';
    flags.forEach((flag) => {
      const li = document.createElement('li');
      li.textContent = flagLabels[flag] || flag;
      this.securityFlagsList.appendChild(li);
    });
    this.internetRequired.style.display = 'flex';
    this.setStatus('error', 'Internet requis');
  }

  async retryWithOnline() {
    if (await this.checkOnline()) {
      this.internetRequired.style.display = 'none';
      if (this.filePath) this.openFile(this.filePath);
    } else {
      alert('Toujours hors ligne.');
    }
  }

  // ---- Connectivity ----

  startConnectivityCheck() {
    this.updateConnectivity();
    setInterval(() => this.updateConnectivity(), 15000);
    window.addEventListener('online', () => this.updateConnectivity());
    window.addEventListener('offline', () => this.updateConnectivity());
  }

  async updateConnectivity() {
    try { this.isOnline = await window.electronAPI.checkOnline(); } catch (_) { this.isOnline = navigator.onLine; }
    this.connectivityBadge.className = this.isOnline ? 'badge badge-online' : 'badge badge-offline';
    this.connectivityBadge.innerHTML = this.isOnline
      ? '<span class="badge-dot"></span> En ligne'
      : '<span class="badge-dot"></span> Hors ligne';
  }

  async checkOnline() {
    try { return await window.electronAPI.checkOnline(); } catch (_) { return navigator.onLine; }
  }

  // ---- Auto Save ----

  startAutoSave() {
    this.autoSaveInterval = setInterval(() => {
      if (this.isModified && this.filePath) this.saveFile();
    }, 30000);
  }

  // ---- UI ----

  markModified() {
    if (!this.isModified) {
      this.isModified = true;
      this.setStatus('unsaved', 'Non enregistré');
    }
  }

  setStatus(type, text) {
    this.statusDot.className = 'dot';
    switch (type) {
      case 'saved': this.statusDot.classList.add('dot-saved'); break;
      case 'unsaved': this.statusDot.classList.add('dot-unsaved'); break;
      case 'saving': this.statusDot.classList.add('dot-saving'); break;
      case 'error': this.statusDot.classList.add('dot-error'); break;
      default: this.statusDot.classList.add('dot-idle');
    }
    this.statusText.textContent = text;
  }

  updateCharCount() {
    const text = this.editor?.getText() || '';
    const count = text.replace(/\s/g, '').length;
    this.charCount.textContent = `${count.toLocaleString('fr-FR')} caractères`;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.sivaraEditor = new SivaraEditor();
});
