import { Link } from 'react-router-dom';

const Footer = () => {
  const currentYear = new Date().getFullYear();
  
  const getHelpLink = () => {
    const hostname = window.location.hostname;
    const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';
    return isLocal ? '/?app=help' : 'https://help.sivara.ca';
  };

  return (
    <footer className="bg-[#09090b] text-zinc-400 py-8 border-t border-white/5 w-full z-40 relative font-sans">
      <div className="container mx-auto px-6">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          
          {/* GAUCHE : Infos compactes */}
          <div className="text-xs font-light space-y-1 text-center md:text-left">
            <div className="flex items-center gap-2 justify-center md:justify-start">
                <span className="font-medium text-white">Québec 4 serveur</span>
                <span className="text-zinc-600">•</span>
                <span className="font-mono text-zinc-500">NEQ: 2279458220</span>
            </div>
            <p className="text-zinc-500">6400 RUE Rue Gérard-Carmel, St-Hubert, QC J3Y 3H1</p>
            <p className="text-zinc-600 pt-1">&copy; {currentYear} Sivara. Tous droits réservés.</p>
          </div>

          {/* DROITE : Logo & Liens */}
          <div className="flex flex-col items-center md:items-end gap-3">
            <div className="flex items-center gap-2 opacity-90 hover:opacity-100 transition-opacity">
              <span className="text-lg font-bold tracking-tight text-white">Sivara</span>
              <img src="/sivara-logo.png" alt="Sivara" className="w-6 h-6 object-contain" />
            </div>
            
            <nav className="flex gap-6 text-xs font-medium">
              <a href={getHelpLink()} className="hover:text-white transition-colors">Centre d'aide</a>
              <a href="#" className="hover:text-white transition-colors">Confidentialité</a>
              <a href="#" className="hover:text-white transition-colors">Conditions</a>
            </nav>
          </div>

        </div>
      </div>
    </footer>
  );
};

export default Footer;