import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Inbox, Send, Archive, Trash2, Star, Edit2, Search, 
  MoreVertical, RotateCw, Menu, ArrowLeft, Paperclip, 
  AlertCircle, LogOut, UserCircle
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// Mock Data
const MOCK_EMAILS = [
  { id: 1, sender: 'Équipe Sivara', subject: 'Bienvenue sur Sivara Mail', preview: 'Nous sommes ravis de vous compter parmi nos utilisateurs. Votre boîte est prête.', date: '10:42', unread: true, color: 'bg-blue-500' },
  { id: 2, sender: 'Sécurité', subject: 'Nouvelle connexion détectée', preview: 'Une connexion a été détectée depuis un nouvel appareil (Chrome, Mac OS).', date: 'Hier', unread: false, color: 'bg-red-500' },
  { id: 3, sender: 'Jean Dupont', subject: 'Projet Alpha - Mise à jour', preview: 'Voici les derniers documents concernant le projet Alpha. Merci de valider.', date: 'Lun', unread: false, color: 'bg-green-500' },
];

const MailInbox = () => {
  const { user, signOut } = useAuth();
  const [selectedFolder, setSelectedFolder] = useState('inbox');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  const handleNavigateToProfile = () => {
    const hostname = window.location.hostname;
    const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';
    const currentUrl = window.location.href;

    if (isLocal) {
       window.location.href = `/?app=account&path=/profile&returnTo=${encodeURIComponent(currentUrl)}`;
    } else {
       window.location.href = `https://account.sivara.ca/profile?returnTo=${encodeURIComponent(currentUrl)}`;
    }
  };

  const handleSignOut = async () => {
    await signOut();
    window.location.reload();
  };

  return (
    <div className="h-screen flex flex-col bg-white overflow-hidden font-sans">
      {/* Header */}
      <header className="h-16 border-b border-gray-200 flex items-center justify-between px-4 lg:px-6 bg-white z-20">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="text-gray-500">
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 bg-orange-500 rounded-lg flex items-center justify-center text-white font-bold">S</div>
            <h1 className="text-xl font-light text-gray-900 hidden sm:block">Mail</h1>
          </div>
        </div>

        <div className="flex-1 max-w-2xl mx-8 hidden md:block">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input 
              placeholder="Rechercher dans les messages..." 
              className="pl-10 bg-gray-100 border-0 focus-visible:ring-1 focus-visible:ring-gray-300 focus-visible:bg-white transition-colors"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="text-gray-500">
            <RotateCw className="h-5 w-5" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-10 w-10 rounded-full ml-2">
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="bg-gray-800 text-white">
                    {user?.email?.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>{user?.email}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleNavigateToProfile}>
                <UserCircle className="mr-2 h-4 w-4" /> Mon Profil
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => window.location.href = '/?app=www'}>
                 <ArrowLeft className="mr-2 h-4 w-4" /> Retour au moteur
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} className="text-red-600">
                <LogOut className="mr-2 h-4 w-4" /> Déconnexion
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside 
          className={`w-64 bg-gray-50 border-r border-gray-200 flex flex-col transition-all duration-300 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full absolute h-full z-10'}`}
        >
          <div className="p-4">
            <Button className="w-full bg-gray-900 hover:bg-black text-white shadow-md gap-2 h-12 rounded-xl">
              <Edit2 className="h-4 w-4" /> Nouveau message
            </Button>
          </div>

          <nav className="flex-1 px-2 space-y-1 overflow-y-auto">
            {[
              { id: 'inbox', label: 'Boîte de réception', icon: Inbox, count: 1 },
              { id: 'starred', label: 'Favoris', icon: Star, count: 0 },
              { id: 'sent', label: 'Envoyés', icon: Send, count: 0 },
              { id: 'archive', label: 'Archives', icon: Archive, count: 0 },
              { id: 'trash', label: 'Corbeille', icon: Trash2, count: 0 },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setSelectedFolder(item.id)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                  selectedFolder === item.id 
                    ? 'bg-orange-50 text-orange-700' 
                    : 'text-gray-600 hover:bg-gray-200/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <item.icon className={`h-5 w-5 ${selectedFolder === item.id ? 'text-orange-600' : 'text-gray-400'}`} />
                  {item.label}
                </div>
                {item.count > 0 && (
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${selectedFolder === item.id ? 'bg-orange-100 text-orange-700' : 'bg-gray-200 text-gray-600'}`}>
                    {item.count}
                  </span>
                )}
              </button>
            ))}
          </nav>

          <div className="p-4 border-t border-gray-200">
             <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                <div className="flex items-start gap-3">
                   <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0" />
                   <div>
                      <p className="text-xs font-bold text-blue-700 mb-1">Chiffrement E2EE</p>
                      <p className="text-[10px] text-blue-600 leading-tight">Votre clé privée est active. Vos messages sont chiffrés localement.</p>
                   </div>
                </div>
             </div>
          </div>
        </aside>

        {/* Main Content (Mail List) */}
        <main className={`flex-1 flex flex-col bg-white min-w-0 transition-all duration-300 ${!isSidebarOpen ? '-ml-64' : ''}`}>
          <div className="flex-1 overflow-y-auto">
            {MOCK_EMAILS.length > 0 ? (
              <div className="divide-y divide-gray-100">
                {MOCK_EMAILS.map((email) => (
                  <div 
                    key={email.id} 
                    className={`group flex items-center gap-4 p-4 hover:bg-gray-50 hover:shadow-sm cursor-pointer transition-all ${email.unread ? 'bg-white' : 'bg-gray-50/30'}`}
                  >
                    <div className="flex-shrink-0 pt-1">
                       <div className={`h-10 w-10 rounded-full flex items-center justify-center text-white font-bold text-sm ${email.color}`}>
                          {email.sender[0]}
                       </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline mb-1">
                        <h3 className={`truncate text-sm ${email.unread ? 'font-bold text-gray-900' : 'font-medium text-gray-700'}`}>
                          {email.sender}
                        </h3>
                        <span className={`text-xs flex-shrink-0 ${email.unread ? 'font-bold text-blue-600' : 'text-gray-400'}`}>
                          {email.date}
                        </span>
                      </div>
                      <h4 className={`text-sm truncate mb-0.5 ${email.unread ? 'font-semibold text-gray-800' : 'text-gray-600'}`}>
                        {email.subject}
                      </h4>
                      <p className="text-sm text-gray-500 truncate">
                        {email.preview}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                       <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-gray-600"><Archive className="h-4 w-4" /></Button>
                       <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-gray-400">
                <Inbox className="h-16 w-16 mb-4 text-gray-200" />
                <p>Votre boîte est vide</p>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default MailInbox;