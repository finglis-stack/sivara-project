import { createClient } from '@supabase/supabase-js'
import Cookies from 'js-cookie'

const supabaseUrl = 'https://asctcqyupjwjifxidegq.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFzY3RjcXl1cGp3amlmeGlkZWdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMxNjU1ODEsImV4cCI6MjA3ODc0MTU4MX0.JUAXZaLsixxqQ2-hNzgZhmViVvA8aiDbL-3IOquanrs'

// Détection de l'environnement de production (sivara.ca et tous ses sous-domaines)
const hostname = window.location.hostname;
const isProd = hostname.includes('sivara.ca');

// Configuration du domaine de cookie pour permettre le partage entre sous-domaines
// 'sivara.ca' permettra l'accès depuis account.sivara.ca, docs.sivara.ca, etc.
const cookieDomain = isProd ? 'sivara.ca' : undefined;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storageKey: 'sivara-auth-token',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true, // Important pour détecter les tokens dans le hash #
    flowType: 'pkce',
    storage: {
      getItem: (key) => {
        return Cookies.get(key);
      },
      setItem: (key, value) => {
        Cookies.set(key, value, { 
          domain: cookieDomain, 
          path: '/', 
          sameSite: 'Lax', 
          secure: isProd,
          expires: 365 
        });
      },
      removeItem: (key) => {
        Cookies.remove(key, { 
          domain: cookieDomain, 
          path: '/' 
        });
      },
    },
  }
})