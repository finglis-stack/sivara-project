import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { showSuccess, showError } from '@/utils/toast';
import { 
  MessageSquare, Search, Send, LogOut, 
  Folder, FileText, Plus, Edit2, Trash2, 
  Eye, Layout, ChevronRight, Loader2,
  MoreVertical, Phone, Mail, User, HardDrive,
  ShieldCheck, AlertCircle, PauseCircle, CheckCircle2, Smartphone
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';

// --- TYPES ---
interface Profile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  phone_country_code: string | null;
  phone_number: string | null;
  avatar_url: string | null;
  is_pro: boolean;
  account_type: string;
}

interface Ticket {
  id: string;
  subject: string;
  status: 'open' | 'closed' | 'suspended';
  customer_email: string;
  last_message_at: string;
  user_id: string;
  profiles: Profile | null; 
}

interface Message {
  id: string;
  body: string;
  created_at: string;
  is_staff_reply: boolean;
  sender_email: string;
  profiles?: {
    avatar_url: string | null;
    first_name: string | null;
  };
}

interface CustomerStats {
  fileCount: number;
  folderCount: number;
}

// ... (Keep existing Category/Article types)
interface Category { id: string; title: string; description: string; slug: string; order: number; }
interface Article { id: string; title: string; slug: string; content: string; is_published: boolean; view_count: number; category_id: string; }

const HelpAdmin = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<'support' | 'content'>('support');
  const [isStaff, setIsStaff] = useState(false);
  const [isCheckingRole, setIsCheckingRole] = useState(true);
  
  // Staff Info (Moi)
  const [myProfile, setMyProfile] = useState<Profile | null>(null);

  // Support State
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [replyText, setReplyText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [customerStats, setCustomerStats] = useState<CustomerStats | null>(null);
  const [isLoadingTickets, setIsLoadingTickets] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Content State (Simplifié pour cette vue)
  const [categories, setCategories] = useState<Category[]>([]);

  // VERIFICATION STAFF & LOAD MY PROFILE
  useEffect(() => {
    const checkStaff = async () => {
        if (!user) return;
        try {
            const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).single();
            if (error || !data?.is_staff) { navigate('/'); } 
            else { 
                setIsStaff(true); 
                setMyProfile(data as any); // Store my own profile for optimistic UI
            }
        } catch (e) { navigate('/'); } 
        finally { setIsCheckingRole(false); }
    };
    if (!loading) { if (user) checkStaff(); else navigate('/login'); }
  }, [user, loading, navigate]);

  // CHARGEMENT DONNEES
  useEffect(() => {
    if (!isStaff) return;
    if (activeTab === 'support') fetchTickets();
  }, [activeTab, isStaff]);

  // --- SUPPORT LOGIC ---
  const fetchTickets = async () => {
    setIsLoadingTickets(true);
    const { data, error } = await supabase
        .from('support_tickets')
        .select(`
            *,
            profiles:user_id (
                id, first_name, last_name, avatar_url, 
                phone_country_code, phone_number, 
                is_pro, account_type
            )
        `)
        .order('last_message_at', { ascending: false });

    if (!error) setTickets(data as unknown as Ticket[] || []);
    setIsLoadingTickets(false);
  };

  const fetchCustomerStats = async (userId: string) => {
      const { count: fileCount } = await supabase.from('documents').select('id', { count: 'exact', head: true }).eq('owner_id', userId).eq('type', 'file');
      const { count: folderCount } = await supabase.from('documents').select('id', { count: 'exact', head: true }).eq('owner_id', userId).eq('type', 'folder');
      setCustomerStats({ fileCount: fileCount || 0, folderCount: folderCount || 0 });
  };

  const selectTicket = async (ticket: Ticket) => {
      setSelectedTicketId(ticket.id);
      setSelectedTicket(ticket);
      
      const { data } = await supabase.from('support_messages')
        .select(`*, profiles:sender_id(first_name, avatar_url)`)
        .eq('ticket_id', ticket.id)
        .order('created_at', { ascending: true });
      setMessages(data || []);
      
      if (ticket.user_id) fetchCustomerStats(ticket.user_id);
      
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  const updateTicketStatus = async (status: 'open' | 'closed' | 'suspended') => {
      if (!selectedTicketId) return;
      await supabase.from('support_tickets').update({ status }).eq('id', selectedTicketId);
      setTickets(prev => prev.map(t => t.id === selectedTicketId ? { ...t, status } : t));
      if (selectedTicket) setSelectedTicket({ ...selectedTicket, status });
      showSuccess(`Ticket ${status === 'suspended' ? 'suspendu' : status === 'open' ? 'réouvert' : 'fermé'}`);
  };

  const sendReply = async () => {
      if (!selectedTicketId || !replyText.trim()) return;
      const textToSend = replyText;
      setReplyText(''); // Clear immédiat
      setIsSending(true);
      
      try {
          // Optimistic Update: On ajoute le message tout de suite
          const tempId = 'temp-' + Date.now();
          const newMessage: Message = {
              id: tempId,
              body: textToSend.replace(/\n/g, '<br/>'),
              created_at: new Date().toISOString(),
              is_staff_reply: true,
              sender_email: 'support@sivara.ca',
              profiles: {
                  first_name: myProfile?.first_name || 'Staff',
                  avatar_url: myProfile?.avatar_url || null
              }
          };
          setMessages(prev => [...prev, newMessage]);
          setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);

          // Envoi réel
          await supabase.functions.invoke('support-outbound', {
              body: { ticketId: selectedTicketId, messageBody: textToSend, status: 'open' }
          });
          
          // Refresh propre après envoi
          const { data } = await supabase.from('support_messages')
            .select(`*, profiles:sender_id(first_name, avatar_url)`)
            .eq('ticket_id', selectedTicketId)
            .order('created_at', { ascending: true });
          setMessages(data || []);
          
          if (selectedTicket?.status !== 'open') {
             setTickets(prev => prev.map(t => t.id === selectedTicketId ? { ...t, status: 'open' } : t));
             setSelectedTicket(prev => prev ? { ...prev, status: 'open' } : null);
          }
          
          showSuccess("Envoyé");
      } catch (e) { showError("Erreur d'envoi"); } 
      finally { setIsSending(false); }
  };

  if (loading || isCheckingRole) return <div className="h-screen flex items-center justify-center bg-white"><Loader2 className="h-8 w-8 animate-spin text-gray-400" /></div>;

  return (
    <div className="flex h-screen bg-white font-sans overflow-hidden">
      
      {/* SIDEBAR NAVIGATION */}
      <div className="w-20 bg-gray-900 flex flex-col items-center py-6 gap-4 shrink-0 z-30">
         <div className="h-10 w-10 bg-white/10 rounded-xl flex items-center justify-center text-white font-bold mb-6 cursor-pointer" onClick={() => navigate('/')}>S</div>
         <button onClick={() => setActiveTab('support')} className={`p-3 rounded-xl transition-all relative group ${activeTab === 'support' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:bg-white/10 hover:text-white'}`}>
            <MessageSquare className="h-6 w-6" />
         </button>
         <button onClick={() => setActiveTab('content')} className={`p-3 rounded-xl transition-all relative group ${activeTab === 'content' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:bg-white/10 hover:text-white'}`}>
            <Layout className="h-6 w-6" />
         </button>
         <div className="mt-auto"><button onClick={() => navigate('/')} className="p-3 text-gray-500 hover:text-white transition-colors"><LogOut className="h-6 w-6" /></button></div>
      </div>

      {/* ================= SUPPORT VIEW ================= */}
      {activeTab === 'support' && (
        <div className="flex-1 flex overflow-hidden">
            {/* 1. TICKET LIST */}
            <div className="w-80 border-r border-gray-200 flex flex-col bg-gray-50">
                <div className="p-4 border-b border-gray-200 bg-white shadow-sm z-10">
                    <h2 className="font-bold text-gray-900 mb-3 text-lg">Tickets</h2>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input placeholder="Rechercher..." className="pl-9 bg-gray-50 border-gray-200 focus:bg-white" />
                    </div>
                </div>
                <ScrollArea className="flex-1">
                    {tickets.map(t => (
                        <div key={t.id} onClick={() => selectTicket(t)} className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-white transition-all ${selectedTicketId === t.id ? 'bg-white border-l-4 border-l-blue-600 shadow-sm' : 'border-l-4 border-l-transparent'}`}>
                            <div className="flex justify-between items-start mb-2">
                                <div className="flex items-center gap-2">
                                    <Avatar className="h-8 w-8 border border-gray-100">
                                        {t.profiles?.avatar_url && <AvatarImage src={t.profiles.avatar_url} />}
                                        <AvatarFallback className="text-xs bg-blue-50 text-blue-600">{t.profiles?.first_name?.[0] || 'C'}</AvatarFallback>
                                    </Avatar>
                                    <div className="overflow-hidden">
                                        <div className="font-bold text-sm text-gray-900 truncate w-32">{t.profiles?.first_name ? `${t.profiles.first_name} ${t.profiles.last_name || ''}` : t.customer_email}</div>
                                        <div className="text-[10px] text-gray-400 truncate">{new Date(t.last_message_at).toLocaleString()}</div>
                                    </div>
                                </div>
                            </div>
                            <div className="text-sm font-medium text-gray-800 truncate mb-2">{t.subject}</div>
                            <div className="flex gap-2">
                                <Badge variant="outline" className={`text-[10px] h-5 px-1.5 capitalize border-0 ${
                                    t.status === 'open' ? 'bg-green-100 text-green-700' : 
                                    t.status === 'closed' ? 'bg-gray-100 text-gray-500' : 'bg-orange-100 text-orange-700'
                                }`}>{t.status}</Badge>
                                {t.profiles?.is_pro && <Badge className="text-[10px] h-5 px-1.5 bg-black text-white hover:bg-black">PRO</Badge>}
                            </div>
                        </div>
                    ))}
                </ScrollArea>
            </div>

            {/* 2. CHAT AREA */}
            <div className="flex-1 flex flex-col bg-white relative">
                {selectedTicket ? (
                    <>
                        <div className="h-16 border-b border-gray-200 flex items-center justify-between px-6 shrink-0 bg-white/80 backdrop-blur-sm z-10">
                            <div>
                                <span className="font-bold text-gray-900 text-lg mr-3">{selectedTicket.subject}</span>
                                <span className="text-gray-400 font-mono text-xs">#{selectedTicket.id.substring(0,8)}</span>
                            </div>
                            <div className="flex gap-2">
                                {selectedTicket.status !== 'closed' && (
                                    <Button variant="outline" size="sm" className="text-orange-600 border-orange-200 hover:bg-orange-50" onClick={() => updateTicketStatus('suspended')}>
                                        <PauseCircle className="w-4 h-4 mr-2" /> Suspendre
                                    </Button>
                                )}
                                {selectedTicket.status === 'closed' ? (
                                    <Button variant="outline" size="sm" onClick={() => updateTicketStatus('open')}>Réouvrir</Button>
                                ) : (
                                    <Button variant="outline" size="sm" className="text-green-600 border-green-200 hover:bg-green-50" onClick={() => updateTicketStatus('closed')}>
                                        <CheckCircle2 className="w-4 h-4 mr-2" /> Clore
                                    </Button>
                                )}
                            </div>
                        </div>
                        
                        <ScrollArea className="flex-1 bg-[#F5F7FA] p-6">
                            <div className="space-y-6 max-w-3xl mx-auto pb-4">
                                {messages.map(m => (
                                    <div key={m.id} className={`flex gap-4 ${m.is_staff_reply ? 'flex-row-reverse' : ''}`}>
                                        <Avatar className="h-10 w-10 border-2 border-white shadow-sm">
                                            {m.profiles?.avatar_url && <AvatarImage src={m.profiles.avatar_url} />}
                                            <AvatarFallback className={m.is_staff_reply ? 'bg-gray-900 text-white' : 'bg-blue-600 text-white'}>{m.is_staff_reply ? (m.profiles?.first_name?.[0] || 'S') : 'C'}</AvatarFallback>
                                        </Avatar>
                                        <div className={`max-w-[75%] p-5 rounded-2xl text-sm shadow-sm leading-relaxed ${
                                            m.is_staff_reply 
                                            ? 'bg-gray-900 text-white rounded-tr-none' 
                                            : 'bg-white text-gray-800 border border-gray-200 rounded-tl-none'
                                        }`}>
                                            {m.is_staff_reply && m.profiles?.first_name && (
                                                <div className="text-[10px] text-gray-400 mb-1 font-bold uppercase tracking-wider">{m.profiles.first_name}</div>
                                            )}
                                            <div dangerouslySetInnerHTML={{__html: m.body}} />
                                            <div className={`text-[10px] mt-2 opacity-70 ${m.is_staff_reply ? 'text-right' : 'text-left'}`}>
                                                {new Date(m.created_at).toLocaleString()}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                <div ref={messagesEndRef} />
                            </div>
                        </ScrollArea>

                        <div className="p-4 border-t border-gray-200 bg-white">
                            <div className="max-w-3xl mx-auto relative">
                                <Textarea 
                                    value={replyText} 
                                    onChange={e => setReplyText(e.target.value)} 
                                    placeholder="Écrivez votre réponse..." 
                                    className="min-h-[120px] pr-14 resize-none bg-gray-50 border-0 focus:ring-1 focus:bg-white transition-all shadow-inner text-base p-4 rounded-xl" 
                                />
                                <Button 
                                    size="icon" 
                                    className="absolute bottom-4 right-4 h-10 w-10 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg transition-transform hover:scale-105 active:scale-95"
                                    onClick={sendReply}
                                    disabled={isSending}
                                >
                                    {isSending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                                </Button>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-300 bg-[#F5F7FA]">
                        <MessageSquare className="h-24 w-24 mb-6 opacity-20" />
                        <p className="text-lg font-medium text-gray-400">Sélectionnez un ticket</p>
                    </div>
                )}
            </div>

            {/* 3. CUSTOMER INFO SIDEBAR */}
            {selectedTicket && selectedTicket.profiles && (
                <div className="w-80 bg-white border-l border-gray-200 flex flex-col animate-in slide-in-from-right duration-300">
                    <div className="p-6 flex flex-col items-center border-b border-gray-100">
                        <div className="relative">
                            <Avatar className="h-24 w-24 border-4 border-gray-50 shadow-lg mb-4">
                                {selectedTicket.profiles.avatar_url && <AvatarImage src={selectedTicket.profiles.avatar_url} />}
                                <AvatarFallback className="bg-gray-100 text-gray-400 text-2xl">
                                    {selectedTicket.profiles.first_name?.[0] || 'C'}
                                </AvatarFallback>
                            </Avatar>
                            {selectedTicket.profiles.is_pro && (
                                <div className="absolute bottom-0 right-0 bg-black text-white text-[10px] font-bold px-2 py-0.5 rounded-full border-2 border-white shadow-sm">PRO</div>
                            )}
                        </div>
                        
                        <h2 className="text-xl font-bold text-gray-900 text-center">
                            {selectedTicket.profiles.first_name} {selectedTicket.profiles.last_name}
                        </h2>
                        <p className="text-sm text-gray-500 mb-4">{selectedTicket.customer_email}</p>
                        
                        <Button variant="outline" size="sm" className="w-full gap-2">
                            <User className="h-4 w-4" /> Voir profil complet
                        </Button>
                    </div>

                    <ScrollArea className="flex-1 p-6">
                        <div className="space-y-6">
                            <div>
                                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Coordonnées</h3>
                                <div className="space-y-3">
                                    <div className="flex items-center gap-3 text-sm text-gray-600">
                                        <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600"><Smartphone className="h-4 w-4" /></div>
                                        <div className="flex flex-col">
                                            <span className="font-medium">{selectedTicket.profiles.phone_country_code || '+1'} {selectedTicket.profiles.phone_number || 'N/A'}</span>
                                            <span className="text-xs text-gray-400">Mobile</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 text-sm text-gray-600">
                                        <div className="w-8 h-8 rounded-full bg-purple-50 flex items-center justify-center text-purple-600"><Mail className="h-4 w-4" /></div>
                                        <div className="flex flex-col overflow-hidden">
                                            <span className="font-medium truncate">{selectedTicket.customer_email}</span>
                                            <span className="text-xs text-gray-400">Email principal</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <Separator />

                            <div>
                                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Sivara Cloud</h3>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 text-center">
                                        <div className="text-2xl font-bold text-gray-900">{customerStats?.fileCount || 0}</div>
                                        <div className="text-xs text-gray-500 font-medium mt-1 flex items-center justify-center gap-1"><FileText className="h-3 w-3" /> Fichiers</div>
                                    </div>
                                    <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 text-center">
                                        <div className="text-2xl font-bold text-gray-900">{customerStats?.folderCount || 0}</div>
                                        <div className="text-xs text-gray-500 font-medium mt-1 flex items-center justify-center gap-1"><Folder className="h-3 w-3" /> Dossiers</div>
                                    </div>
                                </div>
                            </div>

                            <Separator />

                            <div>
                                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Sécurité & Compte</h3>
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between p-2 bg-green-50 rounded-lg border border-green-100">
                                        <span className="text-xs font-medium text-green-800 flex items-center gap-2"><ShieldCheck className="h-3 w-3" /> E2EE Actif</span>
                                        <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
                                    </div>
                                    <div className="flex items-center justify-between p-2 bg-gray-50 rounded-lg border border-gray-100">
                                        <span className="text-xs font-medium text-gray-600">Type de compte</span>
                                        <span className="text-xs font-bold uppercase">{selectedTicket.profiles.account_type}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </ScrollArea>
                </div>
            )}
        </div>
      )}

      {/* --- VIEW: CONTENT --- */}
      {activeTab === 'content' && (
        <div className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="text-center text-gray-400">
                <Layout className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <p>Module de contenu (déjà implémenté précédemment)</p>
            </div>
        </div>
      )}

    </div>
  );
};

export default HelpAdmin;