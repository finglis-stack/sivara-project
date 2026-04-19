import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CrawlManager from '@/components/CrawlManager';
import StatsDisplay from '@/components/StatsDisplay';
import SearchManagement from '@/components/SearchManagement';
import EntitiesManager from '@/components/admin/EntitiesManager';
import AdminLayout from '@/components/AdminLayout';
import UserMenu from '@/components/UserMenu';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Activity } from 'lucide-react';

const Contribute = () => {
  const navigate = useNavigate();
  const [adminPage, setAdminPage] = useState('dashboard');

  const renderAdminContent = () => {
    switch (adminPage) {
      case 'dashboard':
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Tableau de bord</h1>
            <StatsDisplay />
            <CrawlManager />
          </div>
        );
      case 'search':
        return <SearchManagement />;
      case 'entities':
        return <EntitiesManager />;
      case 'crawl':
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Crawling</h1>
            <CrawlManager />
          </div>
        );
      case 'monitor':
        return (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center gap-3 mb-6">
              <Activity className="h-8 w-8 text-blue-600" />
              <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Monitoring</h1>
            </div>
            <Card className="p-8 text-center">
              <p className="text-gray-500">Le monitoring est disponible via la page dédiée.</p>
              <button 
                onClick={() => navigate('/monitor')}
                className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Ouvrir le Monitoring
              </button>
            </Card>
          </div>
        );
      case 'stats':
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Statistiques</h1>
            <StatsDisplay />
          </div>
        );
      case 'settings':
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Paramètres</h1>
            <Card>
              <CardHeader>
                <CardTitle>Paramètres du système</CardTitle>
                <CardDescription>Configurez les paramètres globaux du système</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-gray-500">Les paramètres seront bientôt disponibles.</p>
              </CardContent>
            </Card>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <AdminLayout currentPage={adminPage} onPageChange={setAdminPage}>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div 
            onClick={() => navigate('/')} 
            className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
          >
            <img src="/sivara-logo.png" alt="Sivara" className="w-8 h-8 object-contain" />
            <span className="text-2xl font-bold text-gray-900 tracking-tight">Sivara</span>
          </div>
          <UserMenu />
        </div>
        {renderAdminContent()}
      </div>
    </AdminLayout>
  );
};

export default Contribute;
