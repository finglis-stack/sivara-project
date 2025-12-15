import { Link } from 'react-router-dom';

const Footer = () => {
  const currentYear = new Date().getFullYear();
  
  const getHelpLink = () => {
    const hostname = window.location.hostname;
    const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';
    return isLocal ? '/?app=help' : 'https://help.sivara.ca';
  };

  return (
    <footer className="bg-[#09090b] text-zinc-400 py-16 border-t border-white/5 w-full z-40 relative font-sans">
      <div className="container mx-auto px-6">
        <div className="flex flex-col md:flex-row justify-between items-start gap-12">
          
          {/* GAUCHE : Infos Légales & Entreprise */}
          <div className="space-y-6 text-sm font-light max-w-xs">
            <div>
                <h4 className="text-white font-medium mb-1 text-base">Québec 4 serveur</h4>
                <p className="text-zinc-500 font-mono text-xs">NEQ: 2279458220</p>
            </div>
            <div className="text-zinc-500 leading-relaxed">
              <p>6400 RUE Rue Gérard-Carmel</p>
              <p>St-Hubert, Québec J3Y 3H1</p>
              <p>Canada</p>
            </div>
            <div className="pt-2">
                <p className="text-xs text-zinc-600">
                &copy; {currentYear} Sivara. Tous droits réservés.
                </p>
            </div>
          </div>

          {/* DROITE : Marque & Navigation */}
          <div className="flex flex-col items-start md:items-end gap-6 flex-1">
            <div className="flex items-center gap-3">
              <span className="text-2xl font-bold tracking-tight text-white">Sivara</span>
              <img src="/sivara-logo.png" alt="Sivara Logo" className="w-8 h-8 object-contain opacity-90" />
            </div>
            
            <nav className="flex flex-wrap justify-end gap-x-8 gap-y-2 text-sm font-medium">
              <a href={getHelpLink()} className="hover:text-white transition-colors text-zinc-400">Centre d'aide</a>
              <a href="#" className="hover:text-white transition-colors text-zinc-400">Confidentialité</a>
              <a href="#" className="hover:text-white transition-colors text-zinc-400">Conditions</a>
            </nav>
          </div>

        </div>
      </div>
    </footer>
  );
};

export default Footer;