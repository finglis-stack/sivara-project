import React, { createContext, useContext, useState, useEffect } from 'react';
import Cookies from 'js-cookie';

export type Language = 'fr-CA' | 'en-CA';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>('en-CA');

  useEffect(() => {
    // 1. Check Cookie
    const storedLang = Cookies.get('sivara-lang') as Language;
    if (storedLang === 'fr-CA' || storedLang === 'en-CA') {
      setLanguageState(storedLang);
    } else {
      // 2. Fallback to Browser Language
      const browserLang = navigator.language.startsWith('fr') ? 'fr-CA' : 'en-CA';
      setLanguageState(browserLang);
      Cookies.set('sivara-lang', browserLang, { 
          expires: 365, 
          path: '/',
          domain: window.location.hostname.includes('sivara.ca') ? '.sivara.ca' : undefined,
          sameSite: 'Lax',
          secure: window.location.hostname.includes('sivara.ca')
      });
    }
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    Cookies.set('sivara-lang', lang, { 
        expires: 365, 
        path: '/',
        domain: window.location.hostname.includes('sivara.ca') ? '.sivara.ca' : undefined,
        sameSite: 'Lax',
        secure: window.location.hostname.includes('sivara.ca')
    });
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
