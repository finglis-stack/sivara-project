import { useState } from 'react';
import { 
  LayoutDashboard, Search, Settings, Activity, ChevronLeft, 
  ChevronRight, Home, Database, Globe, FileText, BarChart3, Building
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface AdminLayoutProps {
  children: React.ReactNode;
  currentPage: string;
  onPageChange: (page: string) => void;
}

type MenuItem = {
  id: string;
  label: string;
  icon: React.ReactNode;
};

const menuItems: MenuItem[] = [
  { id: 'dashboard', label: 'Tableau de bord', icon: <LayoutDashboard className="h-5 w-5" /> },
  { id: 'search', label: 'Gestion des recherches', icon: <Search className="h-5 w-5" /> },
  { id: 'entities', label: 'Gestion des entités', icon: <Building className="h-5 w-5" /> },
  { id: 'crawl', label: 'Crawling', icon: <Globe className="h-5 w-5" /> },
  { id: 'monitor', label: 'Monitoring', icon: <Activity className="h-5 w-5" /> },
  { id: 'stats', label: 'Statistiques', icon: <BarChart3 className="h-5 w-5" /> },
  { id: 'settings', label: 'Paramètres', icon: <Settings className="h-5 w-5" /> },
];

const AdminLayout = ({ children, currentPage, onPageChange }: AdminLayoutProps) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-[#FAFAFA] font-sans">
      {/* Sidebar */}
      <aside
        className={cn(
          'fixed left-0 top-0 h-full bg-white border-r border-gray-200 transition-all duration-300 z-50',
          isCollapsed ? 'w-20' : 'w-64'
        )}
      >
        {/* Logo */}
        <div className="h-20 flex items-center justify-between px-4 border-b border-gray-100">
          {!isCollapsed && (
            <div className="flex items-center gap-2">
              <img src="/sivara-logo.png" alt="Sivara" className="w-8 h-8 object-contain" />
              <span className="text-xl font-bold text-gray-900 tracking-tight">Sivara</span>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="ml-auto"
          >
            {isCollapsed ? (
              <ChevronRight className="h-5 w-5" />
            ) : (
              <ChevronLeft className="h-5 w-5" />
            )}
          </Button>
        </div>

        {/* Menu */}
        <nav className="p-4 space-y-2">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onPageChange(item.id)}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200',
                currentPage === item.id
                  ? 'bg-gray-900 text-white shadow-md'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              )}
            >
              {item.icon}
              {!isCollapsed && (
                <span className="font-medium">{item.label}</span>
              )}
            </button>
          ))}
        </nav>

        {/* Footer */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-100">
          {!isCollapsed && (
            <p className="text-xs text-gray-400 text-center">
              Centre de contrôle
            </p>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main
        className={cn(
          'transition-all duration-300',
          isCollapsed ? 'ml-20' : 'ml-64'
        )}
      >
        {children}
      </main>
    </div>
  );
};

export default AdminLayout;