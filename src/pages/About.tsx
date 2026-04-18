import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import Footer from '@/components/Footer';
import UserMenu from '@/components/UserMenu';
import LanguageSelector from '@/components/LanguageSelector';

const About = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#FAFAFA] font-sans selection:bg-blue-200 selection:text-black flex flex-col">
      <div className="bg-[#faf9f4] text-[#111111] flex flex-col antialiased relative font-sans flex-1">
        <style>{`
          .grid-bg-pattern {
              background-image: 
                  linear-gradient(to right, rgba(197, 197, 211, 0.4) 1px, transparent 1px),
                  linear-gradient(to bottom, rgba(197, 197, 211, 0.4) 1px, transparent 1px);
              background-size: 40px 40px;
          }
        `}</style>
        <div className="fixed inset-0 grid-bg-pattern opacity-50 z-0 pointer-events-none"></div>
        
        {/* TopNavBar */}
        <nav className="sticky top-0 z-50 bg-[#FAF9F4]/90 backdrop-blur-xl w-full border-b border-[#c5c5d3]/30">
          <div className="flex justify-between items-center w-full px-8 py-4 max-w-screen-2xl mx-auto">
            {/* Brand */}
            <div className="flex items-center gap-6">
              <div onClick={() => navigate('/')} className="flex items-center gap-3 cursor-pointer transition-all active:scale-95">
                <img src="/sivara-logo.png" alt="Sivara" className="w-8 h-8 object-contain" />
                <span className="text-xl font-bold tracking-tighter text-[#111111]">Sivara</span>
              </div>
              <button 
                onClick={() => navigate('/about')} 
                className="text-sm font-medium text-[#00236F] border-b-2 border-[#00236F] pb-1 hidden sm:block"
              >
                {t('about.navLink')}
              </button>
            </div>

            {/* Trailing Actions */}
            <div className="flex items-center gap-4 lg:gap-6">
              <LanguageSelector />
              <UserMenu />
            </div>
          </div>
        </nav>

        {/* Main Content Canvas */}
        <main className="flex-1 w-full max-w-screen-xl mx-auto px-6 md:px-12 py-16 flex flex-col gap-24 relative z-10">
          
          {/* Header Section */}
          <section className="flex flex-col md:flex-row items-center gap-12 animate-in fade-in slide-in-from-bottom-8 duration-1000">
            <div className="flex-1 space-y-6">
              <h1 className="text-5xl md:text-6xl font-light tracking-[-0.02em] text-[#111111] leading-tight">
                {t('about.title')}
              </h1>
              <div className="h-1 w-20 bg-[#00236F]"></div>
              <p className="text-xl md:text-2xl font-light text-[#5a5b67] leading-relaxed">
                {t('about.subtitle')}
              </p>
            </div>
            <div className="flex-1 w-full">
              <img 
                src="/help-hero.jpg" 
                alt="Digital Sovereignty" 
                className="w-full h-[400px] object-cover rounded-xl shadow-lg outline outline-1 outline-[#c5c5d3]/30"
              />
            </div>
          </section>

          {/* Mission & Compliance block */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-12 lg:gap-20 animate-in fade-in slide-in-from-bottom-12 duration-1000" style={{ animationDelay: '200ms' }}>
            <div className="flex flex-col justify-center space-y-6">
              <h2 className="text-3xl font-medium tracking-tight text-[#111111]">
                {t('about.missionTitle')}
              </h2>
              <p className="text-lg font-light text-[#2c2d38] leading-relaxed">
                {t('about.missionDesc')}
              </p>
            </div>
            <div className="bg-white p-10 md:p-12 rounded-xl shadow-sm border border-[#c5c5d3]/20 flex flex-col justify-center space-y-6">
              <h2 className="text-3xl font-medium tracking-tight text-[#00236F]">
                {t('about.complianceTitle')}
              </h2>
              <p className="text-lg font-light text-[#2c2d38] leading-relaxed">
                {t('about.complianceDesc')}
              </p>
            </div>
          </section>

          {/* Tech & Innovation Section */}
          <section className="flex flex-col md:flex-row-reverse items-center gap-12 animate-in fade-in slide-in-from-bottom-12 duration-1000" style={{ animationDelay: '400ms' }}>
            <div className="flex-1 space-y-6">
              <h2 className="text-3xl font-medium tracking-tight text-[#111111]">
                {t('about.techTitle')}
              </h2>
              <p className="text-lg font-light text-[#2c2d38] leading-relaxed">
                {t('about.techDesc')}
              </p>
            </div>
            <div className="flex-1 w-full grid grid-cols-2 gap-4">
              <img 
                src="/landing-tags/tulip-3502171_1920.jpg" 
                alt="Innovation 1" 
                className="w-full h-48 md:h-64 object-cover rounded-lg shadow-sm"
              />
              <img 
                src="/landing-tags/landscape-10071292_1280.jpg" 
                alt="Innovation 2" 
                className="w-full h-48 md:h-64 object-cover rounded-lg shadow-sm mt-8"
              />
            </div>
          </section>

          {/* Founders block */}
          <section className="bg-[#00236F] text-white rounded-xl p-10 md:p-16 flex flex-col items-center text-center gap-6 shadow-xl animate-in fade-in slide-in-from-bottom-12 duration-1000" style={{ animationDelay: '600ms' }}>
            <h2 className="text-4xl font-light tracking-tight">
              {t('about.founderTitle')}
            </h2>
            <p className="text-xl md:text-2xl font-light text-blue-100 max-w-3xl leading-relaxed">
              {t('about.founderDesc')}
            </p>
          </section>

        </main>
      </div>
      <Footer />
    </div>
  );
};

export default About;
