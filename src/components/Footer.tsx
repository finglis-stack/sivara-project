import { Link } from 'react-router-dom';

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-black text-white py-12 border-t border-white/10 w-full z-40 relative">
      <div className="container mx-auto px-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
          
          {/* Informations Entreprise (Gauche) */}
          <div className="text-sm text-gray-400 space-y-1.5 font-light">
            <p className="font-bold text-white mb-2">Québec 4 serveur</p>
            <p><span className="opacity-60">NEQ:</span> 2279458220</p>
            <p>6400 RUE Rue Gérard-Carmel</p>
            <p>St-Hubert, Québec J3Y 3H1</p>
            <p>Canada</p>
          </div>

          {/* Logo & Liens (Droite) */}
          <div className="flex flex-col items-start md:items-end gap-4 w-full md:w-auto">
            <div className="flex items-center gap-3">
              <span className="text-2xl font-bold tracking-tight">Sivara</span>
              <img src="/sivara-logo.png" alt="Sivara Logo" className="w-10 h-10 object-contain" />
            </div>
            
            <div className="flex flex-wrap gap-6 text-sm text-gray-400">
              <a href="/?app=help" className="hover:text-white transition-colors">Centre d'aide</a>
              <a href="#" className="hover:text-white transition-colors">Confidentialité</a>
              <a href="#" className="hover:text-white transition-colors">Conditions</a>
            </div>
            
            <p className="text-xs text-gray-600 mt-2">
              &copy; {currentYear} Sivara. Tous droits réservés.
            </p>
          </div>

        </div>
      </div>
    </footer>
  );
};

export default Footer;