import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { showSuccess, showError } from '@/utils/toast';
import { 
  LayoutDashboard, MessageSquare, Users, FileText, Settings, 
  Search, Filter, Clock, CheckCircle2, AlertCircle, Send, 
  MoreVertical, Phone, Paperclip, Archive, Ban, LogOut, 
  Folder, File as FileIcon, Crown
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';

interface Ticket {
  id: string;
  subject: string;
  status: 'open' | 'closed' | 'suspended';
  customer_email: string;
  last_message_at: string;
  profiles: {
    first_name: string;
    last_name: string;
    avatar_url: string | null;
    phone_number: string;
    is_pro: boolean;
  };
}

interface Message {
  id: string;
  body: string;
  created_at: string;
  is_staff_reply: boolean;
  sender_email: string;
  profiles?: {
    avatar_url: string | null;
    first_name: string;
  };
}

const HelpAdmin = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('support');
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [replyText, setReplyText] = useState('');
  const [isLoadingTickets, setIsLoadingTickets] = useState(true);
  const [isSending, setIsSending] = useState(false);
  
  // User Stats (Right Panel)
  const [userStats, setUserStats] = useState({ files: 0, folders: 0 });

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    checkStaff();
    fetchTickets();

    // Realtime Tickets
    const channel = supabase
      .channel('admin-support')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_tickets' }, () => fetchTickets())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'support_messages' }, (payload) => {
         if (payload.new.ticket_id === selectedTicketId) {
             fetchMessages(selectedTicketId);
         }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedTicketId]);

  const checkStaff = async () => {
    if (!user) return;
    const { data } = await supabase.from('profiles').select('is_staff').eq('id', user.id).single();
    if (!data?.is_staff) navigate('/');
  };

  const fetchTickets = async () => {
    setIsLoadingTickets(true);
    const { data } = await supabase
      .from('support_tickets')
      .select(`
        *,
        profiles:user_id (first_name, last_name, avatar_url, phone_number, is_pro)
      `)
      .order('last_message_at', { ascending: false });
    
    if (data) setTickets(data);
    setIsLoadingTickets(false);
  };

  const fetchMessages = async (ticketId: string) => {
    const { data } = await supabase
      .from('support_messages')
      .select(`*, profiles:sender_id(avatar_url, first_name)`)
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });
    
    if (data) {
        setMessages(data);
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  };

  const fetchUserStats = async (userId: string) => {
      // Count files & folders
      const { count: files } = await supabase.from('documents').select('id', { count: 'exact', head: true }).eq('owner_id', userId).eq('type', 'file');
      const { count: folders } = await supabase.from('documents').select('id', { count: 'exact', head: true }).eq('owner_id', userId).eq('type', 'folder');
      setUserStats({ files: files || 0, folders: folders || 0 });
  };

  const handleSelectTicket = (ticket: Ticket) => {
      setSelectedTicketId(ticket.id);
      fetchMessages(ticket.id);
      // Fetch stats if user exists (linked via profile)
      if (ticket.profiles) {
          // We need user_id, retrieved from ticket row actually
          // The types above are a bit loose for join, let's assume we have access to user_id
          // In a real world, we'd fetch it cleanly.
          // Re-fetching ticket specific raw data to get user_id reliably if needed
          supabase.from('support_tickets').select('user_id').eq('id', ticket.id).single().then(({data}) => {
              if(data?.user_id) fetchUserStats(data.user_id);
          });
      }
  };

  const handleSendReply = async (newStatus?: string) => {
      if (!selectedTicketId || !replyText.trim()) return;
      setIsSending(true);
      try {
          const { error } = await supabase.functions.invoke('support-outbound', {
              body: {
                  ticketId: selectedTicketId,
                  messageBody: replyText,
                  status: newStatus || 'open'
              }
          });
          
          if (error) throw error;
          
          setReplyText('');
          showSuccess('Réponse envoyée');
          fetchMessages(selectedTicketId);
          if (newStatus) fetchTickets(); // Refresh list status
      } catch (e) {
          showError("Erreur lors de l'envoi");
      } finally {
          setIsSending(false);
      }
  };

  const updateStatus = async (status: string) => {
      if(!selectedTicketId) return;
      await supabase.from('support_tickets').update({ status }).eq('id', selectedTicketId);
      fetchTickets();
      showSuccess(`Ticket ${status}`);
  };

  const selectedTicket = tickets.find(t => t.id === selectedTicketId);

  const getStatusColor = (status: string) => {
      switch(status) {
          case 'open': return 'bg-green-100 text-green-700 border-green-200';
          case 'closed': return 'bg-gray-100 text-gray-700 border-gray-200';
          case 'suspended': return 'bg-orange-100 text-orange-700 border-orange-200';
          default: return 'bg-gray-100';
      }
  };

  return (
    <div className="flex h-screen bg-white font-sans overflow-hidden">
      {/* SIDEBAR NAV */}
      <div className="w-16 bg-gray-900 flex flex-col items-center py-6 gap-6 shrink-0 z-20">
         <div className="h-10 w-10 bg-white/10 rounded-xl flex items-center justify-center text-white font-bold">S</div>
         <div className="flex-1 flex flex-col gap-4 w-full px-2">
            <button onClick={() => setActiveTab('support')} className={`p-3 rounded-xl transition-all ${activeTab === 'support' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}>
                <MessageSquare className="h-5 w-5" />
            </button>
            <button onClick={() => setActiveTab('content')} className={`p-3 rounded-xl transition-all ${activeTab === 'content' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}>
                <FileText className="h-5 w-5" />
            </button>
            <button onClick={() => setActiveTab('users')} className={`p-3 rounded-xl transition-all ${activeTab === 'users' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}>
                <Users className="h-5 w-5" />
            </button>
         </div>
         <button onClick={() => navigate('/')} className="p-3 text-gray-500 hover:text-white"><LogOut className="h-5 w-5" /></button>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* TICKET LIST */}
        <div className="w-80 border-r border-gray-200 flex flex-col bg-gray-50/50">
            <div className="p-4 border-b border-gray-200 bg-white">
                <h2 className="font-bold text-lg mb-4">Tickets</h2>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input placeholder="Rechercher..." className="pl-9 bg-gray-50 border-gray-200" />
                </div>
                <div className="flex gap-2 mt-4 overflow-x-auto no-scrollbar pb-1">
                    <Badge variant="outline" className="bg-white cursor-pointer hover:border-blue-500">Tous</Badge>
                    <Badge variant="outline" className="bg-white cursor-pointer hover:border-green-500 text-green-600">Ouverts</Badge>
                    <Badge variant="outline" className="bg-white cursor-pointer hover:border-gray-500 text-gray-500">Fermés</Badge>
                </div>
            </div>
            <ScrollArea className="flex-1">
                <div className="divide-y divide-gray-100">
                    {tickets.map(ticket => (
                        <button 
                            key={ticket.id} 
                            onClick={() => handleSelectTicket(ticket)}
                            className={`w-full text-left p-4 hover:bg-white transition-all hover:shadow-sm ${selectedTicketId === ticket.id ? 'bg-white border-l-4 border-l-blue-600 shadow-sm' : 'border-l-4 border-l-transparent'}`}
                        >
                            <div className="flex justify-between items-start mb-1">
                                <div className="flex items-center gap-2">
                                    <Avatar className="h-6 w-6">
                                        {ticket.profiles?.avatar_url && <AvatarImage src={ticket.profiles.avatar_url} />}
                                        <AvatarFallback className="text-[10px]">{ticket.profiles?.first_name?.[0]}</AvatarFallback>
                                    </Avatar>
                                    <span className="text-sm font-semibold text-gray-900 truncate max-w-[100px]">{ticket.profiles?.first_name || 'Inconnu'}</span>
                                </div>
                                <span className="text-[10px] text-gray-400 whitespace-nowrap">
                                    {new Date(ticket.last_message_at).toLocaleDateString()}
                                </span>
                            </div>
                            <h3 className="text-sm font-medium text-gray-800 truncate mb-1">{ticket.subject}</h3>
                            <div className="flex items-center gap-2">
                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium border capitalize ${getStatusColor(ticket.status)}`}>
                                    {ticket.status}
                                </span>
                                <span className="text-xs text-gray-400 truncate">{ticket.customer_email}</span>
                            </div>
                        </button>
                    ))}
                </div>
            </ScrollArea>
        </div>

        {/* CHAT AREA */}
        <div className="flex-1 flex flex-col bg-white min-w-0">
            {selectedTicket ? (
                <>
                    {/* Header Ticket */}
                    <div className="h-16 border-b border-gray-200 flex items-center justify-between px-6 shrink-0">
                        <div className="min-w-0">
                            <h2 className="font-bold text-gray-900 truncate flex items-center gap-3">
                                {selectedTicket.subject}
                                <span className={`text-xs px-2 py-0.5 rounded-full font-normal border ${getStatusColor(selectedTicket.status)}`}>
                                    {selectedTicket.status}
                                </span>
                            </h2>
                            <p className="text-xs text-gray-500">Ticket #{selectedTicket.id.substring(0, 8)}</p>
                        </div>
                        <div className="flex items-center gap-2">
                            {selectedTicket.status !== 'closed' && (
                                <Button variant="outline" size="sm" onClick={() => updateStatus('closed')} className="text-gray-600">
                                    <CheckCircle2 className="mr-2 h-4 w-4" /> Clore
                                </Button>
                            )}
                            {selectedTicket.status !== 'suspended' && (
                                <Button variant="outline" size="sm" onClick={() => updateStatus('suspended')} className="text-orange-600">
                                    <Ban className="mr-2 h-4 w-4" /> Suspendre
                                </Button>
                            )}
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => updateStatus('open')}>Réouvrir</DropdownMenuItem>
                                    <DropdownMenuItem className="text-red-600">Supprimer</DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </div>

                    {/* Messages List */}
                    <ScrollArea className="flex-1 bg-[#F8F9FA] p-6">
                        <div className="space-y-6 max-w-3xl mx-auto">
                            {messages.map((msg) => (
                                <div key={msg.id} className={`flex gap-4 ${msg.is_staff_reply ? 'flex-row-reverse' : ''}`}>
                                    <Avatar className="h-10 w-10 border-2 border-white shadow-sm shrink-0">
                                        {msg.profiles?.avatar_url && <AvatarImage src={msg.profiles.avatar_url} />}
                                        <AvatarFallback className={msg.is_staff_reply ? "bg-blue-600 text-white" : "bg-gray-200"}>
                                            {msg.is_staff_reply ? 'S' : msg.sender_email[0].toUpperCase()}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className={`flex flex-col max-w-[80%] ${msg.is_staff_reply ? 'items-end' : 'items-start'}`}>
                                        <div className="flex items-baseline gap-2 mb-1 px-1">
                                            <span className="text-xs font-bold text-gray-700">{msg.is_staff_reply ? 'Staff Sivara' : (msg.profiles?.first_name || msg.sender_email)}</span>
                                            <span className="text-[10px] text-gray-400">{new Date(msg.created_at).toLocaleString()}</span>
                                        </div>
                                        <div 
                                            className={`p-4 rounded-2xl shadow-sm text-sm leading-relaxed whitespace-pre-wrap ${
                                                msg.is_staff_reply 
                                                ? 'bg-blue-600 text-white rounded-tr-sm' 
                                                : 'bg-white text-gray-800 border border-gray-200 rounded-tl-sm'
                                            }`}
                                            dangerouslySetInnerHTML={{ __html: msg.body }} // HTML from email
                                        />
                                    </div>
                                </div>
                            ))}
                            <div ref={messagesEndRef} />
                        </div>
                    </ScrollArea>

                    {/* Input Area */}
                    <div className="p-4 border-t border-gray-200 bg-white">
                        <div className="max-w-3xl mx-auto relative">
                            <Textarea 
                                value={replyText}
                                onChange={(e) => setReplyText(e.target.value)}
                                placeholder="Écrire une réponse..." 
                                className="min-h-[100px] pr-24 resize-none bg-gray-50 border-gray-200 focus:bg-white transition-all rounded-xl"
                            />
                            <div className="absolute bottom-3 right-3 flex gap-2">
                                <Button variant="ghost" size="icon" className="text-gray-400 hover:text-gray-600"><Paperclip className="h-4 w-4" /></Button>
                                <Button 
                                    onClick={() => handleSendReply()} 
                                    disabled={isSending || !replyText.trim()}
                                    className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4"
                                >
                                    {isSending ? <span className="animate-spin">...</span> : <Send className="h-4 w-4" />}
                                </Button>
                            </div>
                        </div>
                        <div className="max-w-3xl mx-auto mt-2 flex justify-between text-xs text-gray-400 px-1">
                            <span>Markdown supporté</span>
                            <div className="flex gap-4">
                                <button onClick={() => handleSendReply('closed')} className="hover:text-blue-600 transition-colors">Envoyer et fermer</button>
                            </div>
                        </div>
                    </div>
                </>
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                    <MessageSquare className="h-16 w-16 mb-4 text-gray-200" />
                    <p>Sélectionnez un ticket pour commencer</p>
                </div>
            )}
        </div>

        {/* RIGHT SIDEBAR (PROFILE) */}
        {selectedTicket && (
            <div className="w-80 border-l border-gray-200 bg-white shrink-0 overflow-y-auto">
                <div className="p-6 flex flex-col items-center border-b border-gray-100">
                    <div className="relative mb-4">
                        <Avatar className="h-24 w-24 border-4 border-gray-50">
                            {selectedTicket.profiles?.avatar_url && <AvatarImage src={selectedTicket.profiles.avatar_url} />}
                            <AvatarFallback className="text-2xl bg-gray-100">{selectedTicket.profiles?.first_name?.[0]}</AvatarFallback>
                        </Avatar>
                        {selectedTicket.profiles?.is_pro && (
                            <div className="absolute bottom-0 right-0 bg-black text-white p-1.5 rounded-full border-2 border-white" title="Client PRO">
                                <Crown className="h-4 w-4 fill-current text-yellow-400" />
                            </div>
                        )}
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 text-center">
                        {selectedTicket.profiles?.first_name} {selectedTicket.profiles?.last_name}
                    </h2>
                    <p className="text-gray-500 text-sm mt-1">{selectedTicket.customer_email}</p>
                    {selectedTicket.profiles?.is_pro ? (
                        <Badge className="mt-3 bg-black hover:bg-gray-800">Sivara Pro</Badge>
                    ) : (
                        <Badge variant="outline" className="mt-3">Compte Gratuit</Badge>
                    )}
                </div>

                <div className="p-6 space-y-6">
                    <div>
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Coordonnées</h3>
                        <div className="space-y-3">
                            <div className="flex items-center gap-3 text-sm text-gray-600">
                                <Phone className="h-4 w-4 text-gray-400" />
                                <span>{selectedTicket.profiles?.phone_number || "Non renseigné"}</span>
                            </div>
                            <div className="flex items-center gap-3 text-sm text-gray-600">
                                <Clock className="h-4 w-4 text-gray-400" />
                                <span>Client depuis {new Date().getFullYear()}</span>
                            </div>
                        </div>
                    </div>

                    <div>
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Utilisation</h3>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="p-3 bg-gray-50 rounded-lg border border-gray-100 text-center">
                                <FileIcon className="h-5 w-5 mx-auto mb-2 text-blue-500" />
                                <div className="text-lg font-bold text-gray-900">{userStats.files}</div>
                                <div className="text-[10px] text-gray-500 uppercase">Fichiers</div>
                            </div>
                            <div className="p-3 bg-gray-50 rounded-lg border border-gray-100 text-center">
                                <Folder className="h-5 w-5 mx-auto mb-2 text-yellow-500" />
                                <div className="text-lg font-bold text-gray-900">{userStats.folders}</div>
                                <div className="text-[10px] text-gray-500 uppercase">Dossiers</div>
                            </div>
                        </div>
                    </div>

                    <div>
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Actions rapides</h3>
                        <div className="space-y-2">
                            <Button variant="outline" className="w-full justify-start text-gray-600 h-9">
                                <AlertCircle className="mr-2 h-4 w-4" /> Signaler le profil
                            </Button>
                            <Button variant="outline" className="w-full justify-start text-gray-600 h-9">
                                <Archive className="mr-2 h-4 w-4" /> Voir anciens tickets
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default HelpAdmin;