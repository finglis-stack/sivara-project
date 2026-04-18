const i18nDictionary = {
  fr: {
    "ob.welcome": "Bienvenue sur Sivara",
    "ob.subtitle": "Connectez-vous pour synchroniser vos documents et retrouver votre espace de travail.",
    "ob.login_btn": "Se connecter",
    "ob.or": "ou",
    "ob.signup": "Créer un compte",
    "ob.skip": "Continuer sans compte",
    
    "tab.new": "Nouvel onglet",
    "url.placeholder": "Rechercher ou entrer une URL...",
    
    "account.login_title": "Connectez-vous",
    "account.login_sub": "Synchronisez vos documents.",
    "account.btn_login": "Se connecter",
    "account.btn_sync": "Synchroniser",
    "account.btn_logout": "Se déconnecter",
    
    "ntp.greeting.morning": "Bonjour",
    "ntp.greeting.evening": "Bonsoir",
    "ntp.greeting.afternoon": "Bon après-midi",
    "ntp.search_placeholder": "Rechercher sur le web...",
  },
  en: {
    "ob.welcome": "Welcome to Sivara",
    "ob.subtitle": "Log in to sync your documents and recover your workspace.",
    "ob.login_btn": "Log in",
    "ob.or": "or",
    "ob.signup": "Create an account",
    "ob.skip": "Continue without an account",
    
    "tab.new": "New tab",
    "url.placeholder": "Search or enter a URL...",
    
    "account.login_title": "Log in",
    "account.login_sub": "Sync your documents.",
    "account.btn_login": "Log in",
    "account.btn_sync": "Sync",
    "account.btn_logout": "Log out",
    
    "ntp.greeting.morning": "Good morning",
    "ntp.greeting.evening": "Good evening",
    "ntp.greeting.afternoon": "Good afternoon",
    "ntp.search_placeholder": "Search the web...",
  }
};

let currentLang = 'en'; // default lang

function setLanguage(lang) {
  if (!i18nDictionary[lang]) lang = 'en';
  currentLang = lang;
  translatePage();
}

function translatePage(langToSet = currentLang) {
  currentLang = langToSet;
  const t = i18nDictionary[currentLang];
  if (!t) return;
  
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (!t[key]) return;
    
    // Some elements need placeholder translation instead of innerHTML
    if (el.tagName === 'INPUT' && el.hasAttribute('placeholder')) {
      el.setAttribute('placeholder', t[key]);
    } else {
      // Keep any internal icons/svgs if buttons use them, or just replace text nodes
      if (el.tagName === 'BUTTON' && el.querySelector('svg')) {
          // Si le bouton contient un svg, on change seulement le texte Node
          Array.from(el.childNodes).forEach(node => {
              if (node.nodeType === Node.TEXT_NODE && node.nodeValue.trim() !== '') {
                  node.nodeValue = ' ' + t[key];
              }
          });
      } else {
          el.innerText = t[key];
      }
    }
  });

  // Dispatch custom event so renderer components (like greetings) can refresh their dynamic text
  window.dispatchEvent(new CustomEvent('languageChanged', { detail: currentLang }));
}

// Expose helper to get single key dynamically inside JS
window.t = function(key) {
  return i18nDictionary[currentLang] && i18nDictionary[currentLang][key] ? i18nDictionary[currentLang][key] : key;
};

// Initial load (default EN)
document.addEventListener('DOMContentLoaded', () => {
    translatePage('en');
});
