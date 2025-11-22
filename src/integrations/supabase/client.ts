import { createClient } from '@supabase/supabase-js'
import Cookies from 'js-cookie'

const supabaseUrl = 'https://asctcqyupjwjifxidegq.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFzY3RjcXl1cGp3amlmeGlkZWdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMxNjU1ODEsImV4cCI6MjA3ODc0MTU4MX0.JUAXZaLsixxqQ2-hNzgZhmViVvA8aiDbL-3IOquanrs'

// Détermine si on est en production pour définir le domaine du cookie
const hostname = window.location.hostname;
const isProd = hostname.endsWith('sivara.ca');

// Le point devant le domaine (.sivara.ca) est crucial pour le partage entre sous-domaines
const cookieDomain = isProd ? '.sivara.ca' : undefined;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Clé unique partagée entre tous les sous-domaines
    storageKey: 'sivara-auth-token',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
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
          expires: 365 // Persistance 1 an
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