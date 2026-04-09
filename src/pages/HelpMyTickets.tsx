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
import UserMenu from '@/components/UserMenu';
import Footer from '@/components/Footer';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  ArrowLeft, Plus, Send, Loader2, MessageSquare,
  Clock, CheckCircle2, PauseCircle, ChevronRight
} from 'lucide-react';

interface Ticket {
  id: string;
  subject: string;
  status: 'open' | 'closed' | 'suspended';
  last_message_at: string;
  created_at: string;
}

interface Message {
  id: string;
  ticket_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  is_staff_reply: boolean;
  sender_email: string;
  profiles?: {
    avatar_url: string | null;
    first_name: string | null;
  };
}

const HelpMyTickets = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [replyText, setReplyText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isLoadingTickets, setIsLoadingTickets] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

  // New ticket dialog
  const [showNewTicket, setShowNewTicket] = useState(false);
  const [newSubject, setNewSubject] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Redirect if not logged in
  useEffect(() => {
    if (!loading && !user) {
      const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      if (isLocal) window.location.href = '/?app=account&path=/login';
      else window.location.href = 'https://account.sivara.ca/login?returnTo=' + encodeURIComponent(window.location.href);
    }
  }, [user, loading]);

  // Fetch tickets
  useEffect(() => {
    if (!user) return;
    fetchTickets();
  }, [user]);

  // Realtime subscription
  useEffect(() => {
    if (!user) return;

    const channel = supabase.channel('user-tickets')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'support_tickets', filter: `user_id=eq.${user.id}` },
        () => { fetchTickets(); }
      )
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'support_messages' },
        async (payload) => {
          const newMsg = payload.new as Message;
          if (newMsg.ticket_id === selectedTicket?.id) {
            // Fetch with profile
            const { data: profile } = await supabase
              .from('profiles')
              .select('first_name, avatar_url')
              .eq('id', newMsg.sender_id)
              .single();

            const msgWithProfile = { ...newMsg, profiles: profile };
            setMessages(prev => {
              if (prev.some(m => m.id === newMsg.id)) return prev;
              return [...prev, msgWithProfile as any];
            });
            setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, selectedTicket?.id]);

  const fetchTickets = async () => {
    if (!user) return;
    setIsLoadingTickets(true);
    const { data, error } = await supabase
      .from('support_tickets')
      .select('id, subject, status, last_message_at, created_at')
      .eq('user_id', user.id)
      .order('last_message_at', { ascending: false });

    if (!error) setTickets(data || []);
    setIsLoadingTickets(false);
  };

  const selectTicket = async (ticket: Ticket) => {
    setSelectedTicket(ticket);
    setIsLoadingMessages(true);
    const { data } = await supabase
      .from('support_messages')
      .select(`*, profiles:sender_id(first_name, avatar_url)`)
      .eq('ticket_id', ticket.id)
      .order('created_at', { ascending: true });
    setMessages(data || []);
    setIsLoadingMessages(false);
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  const sendReply = async () => {
    if (!selectedTicket || !replyText.trim() || !user) return;
    const text = replyText;
    setReplyText('');
    setIsSending(true);
    try {
      const { error } = await supabase.from('support_messages').insert({
        ticket_id: selectedTicket.id,
        sender_id: user.id,
        sender_email: user.email || '',
        body: text.replace(/\n/g, '<br/>'),
        is_staff_reply: false
      });
      if (error) throw error;
      // Update ticket timestamp
      await supabase.from('support_tickets').update({
        last_message_at: new Date().toISOString(),
        status: 'open'
      }).eq('id', selectedTicket.id);
      showSuccess("Message envoyé");
    } catch (e) {
      showError("Erreur d'envoi");
      setReplyText(text);
    } finally {
      setIsSending(false);
    }
  };

  const createTicket = async () => {
    if (!newSubject.trim() || !newMessage.trim() || !user) return;
    setIsCreating(true);
    try {
      const { data: newTicket, error: ticketError } = await supabase
        .from('support_tickets')
        .insert({
          user_id: user.id,
          customer_email: user.email || '',
          subject: newSubject.trim(),
          status: 'open',
          last_message_at: new Date().toISOString()
        })
        .select()
        .single();

      if (ticketError) throw ticketError;

      const { error: msgError } = await supabase.from('support_messages').insert({
        ticket_id: newTicket.id,
        sender_id: user.id,
        sender_email: user.email || '',
        body: newMessage.replace(/\n/g, '<br/>'),
        is_staff_reply: false
      });

      if (msgError) throw msgError;

      showSuccess("Votre demande a été envoyée");
      setShowNewTicket(false);
      setNewSubject('');
      setNewMessage('');
      await fetchTickets();
      selectTicket(newTicket);
    } catch (e) {
      showError("Erreur lors de la création du ticket");
    } finally {
      setIsCreating(false);
    }
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'open': return { label: 'En cours', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: <Clock className="h-3 w-3" /> };
      case 'closed': return { label: 'Résolu', color: 'bg-gray-50 text-gray-500 border-gray-200', icon: <CheckCircle2 className="h-3 w-3" /> };
      case 'suspended': return { label: 'En attente', color: 'bg-amber-50 text-amber-700 border-amber-200', icon: <PauseCircle className="h-3 w-3" /> };
      default: return { label: status, color: 'bg-gray-50 text-gray-500 border-gray-200', icon: null };
    }
  };

  const handleLogin = () => {
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (isLocal) window.location.href = '/?app=account&path=/login';
    else window.location.href = 'https://account.sivara.ca/login?returnTo=' + encodeURIComponent(window.location.href);
  };

  if (loading) return <div className="h-screen flex items-center justify-center bg-white"><Loader2 className="h-8 w-8 animate-spin text-gray-300" /></div>;

  return (
    <div className="min-h-screen bg-[#FAFAFA] font-sans flex flex-col" style={{ fontFamily: "'Inter', 'Helvetica Neue', sans-serif" }}>
      {/* NAV */}
      <nav className="bg-white border-b border-gray-200/80 sticky top-0 z-50">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/')} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors">
              <ArrowLeft className="h-4 w-4" />
              <span className="text-sm font-light hidden sm:inline">Centre d'aide</span>
            </button>
            <div className="h-5 w-px bg-gray-200"></div>
            <h1 className="text-base font-light text-gray-900 tracking-tight">Mes demandes</h1>
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={() => setShowNewTicket(true)}
              size="sm"
              className="bg-gray-900 hover:bg-gray-800 text-white rounded-full px-5 h-9 text-sm font-normal gap-2 shadow-sm"
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Nouvelle demande</span>
            </Button>
            {user ? <UserMenu /> : <Button onClick={handleLogin} size="sm" variant="outline" className="rounded-full border-gray-300 text-gray-700">Connexion</Button>}
          </div>
        </div>
      </nav>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col lg:flex-row max-w-7xl w-full mx-auto">

        {/* TICKET LIST */}
        <div className={`lg:w-96 w-full border-r border-gray-200/80 bg-white flex flex-col shrink-0 ${selectedTicket ? 'hidden lg:flex' : 'flex'}`}>
          <div className="p-5 border-b border-gray-100">
            <p className="text-xs font-medium text-gray-600 uppercase tracking-wider">
              {tickets.length} demande{tickets.length !== 1 ? 's' : ''}
            </p>
          </div>

          <ScrollArea className="flex-1">
            {isLoadingTickets ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-5 w-5 animate-spin text-gray-300" />
              </div>
            ) : tickets.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
                <p className="text-sm font-medium text-gray-800 mb-1">Aucune demande</p>
                <p className="text-xs text-gray-600 mb-6">Créez votre première demande de support</p>
                <Button
                  onClick={() => setShowNewTicket(true)}
                  variant="outline"
                  size="sm"
                  className="rounded-full px-5 text-xs text-gray-800 border-gray-300"
                >
                  Nouvelle demande
                </Button>
              </div>
            ) : (
              <div>
                {tickets.map((t) => {
                  const status = getStatusConfig(t.status);
                  return (
                    <button
                      key={t.id}
                      onClick={() => selectTicket(t)}
                      className={`w-full text-left p-5 border-b border-gray-50 hover:bg-gray-50/50 transition-all group ${
                        selectedTicket?.id === t.id ? 'bg-gray-50 border-l-2 border-l-gray-900' : 'border-l-2 border-l-transparent'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <h3 className="text-sm font-medium text-gray-900 truncate leading-snug">{t.subject}</h3>
                          <p className="text-[11px] text-gray-500 font-medium mt-1.5">
                            {new Date(t.last_message_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant="outline" className={`text-[10px] h-5 px-2 font-medium border text-gray-700 bg-gray-100`}>
                            {status.label}
                          </Badge>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* CONVERSATION */}
        <div className={`flex-1 flex flex-col bg-white ${selectedTicket ? 'flex' : 'hidden lg:flex'}`}>
          {selectedTicket ? (
            <>
              {/* Header */}
              <div className="h-14 border-b border-gray-100 flex items-center justify-between px-6 shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    onClick={() => setSelectedTicket(null)}
                    className="lg:hidden text-gray-600 hover:text-gray-900 transition-colors"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  <div className="min-w-0">
                    <h2 className="text-sm font-medium text-gray-900 truncate">{selectedTicket.subject}</h2>
                  </div>
                </div>
                <Badge variant="outline" className={`text-[10px] h-5 px-2 font-medium border text-gray-700 bg-gray-100 shrink-0`}>
                  {getStatusConfig(selectedTicket.status).label}
                </Badge>
              </div>

              {/* Messages */}
              <ScrollArea className="flex-1 bg-[#FAFAFA]">
                <div className="max-w-2xl mx-auto py-6 px-4 sm:px-6 space-y-5">
                  {isLoadingMessages ? (
                    <div className="flex justify-center py-20">
                      <Loader2 className="h-5 w-5 animate-spin text-gray-300" />
                    </div>
                  ) : (
                    messages.map((m) => (
                      <div key={m.id} className={`flex gap-3 ${m.is_staff_reply ? '' : 'flex-row-reverse'}`}>
                        <Avatar className="h-8 w-8 shrink-0 border border-gray-100">
                          {m.profiles?.avatar_url && <AvatarImage src={m.profiles.avatar_url} />}
                          <AvatarFallback className={`text-[11px] font-medium ${m.is_staff_reply ? 'bg-gray-900 text-white' : 'bg-blue-50 text-blue-600'}`}>
                            {m.is_staff_reply ? (m.profiles?.first_name?.[0] || 'S') : 'V'}
                          </AvatarFallback>
                        </Avatar>
                        <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                          m.is_staff_reply
                            ? 'bg-white border border-gray-200 text-gray-900 rounded-tl-md shadow-sm'
                            : 'bg-gray-900 text-white rounded-tr-md'
                        }`}>
                          {m.is_staff_reply && m.profiles?.first_name && (
                            <p className="text-[10px] font-bold text-gray-600 mb-1 uppercase tracking-wider">{m.profiles.first_name} · Sivara</p>
                          )}
                          <div dangerouslySetInnerHTML={{ __html: m.body }} />
                          <p className={`text-[10px] mt-2 font-medium ${m.is_staff_reply ? 'text-gray-500' : 'text-white/60'}`}>
                            {new Date(m.created_at).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              {/* Reply input */}
              {selectedTicket.status !== 'closed' && (
                <div className="border-t border-gray-100 bg-white p-4">
                  <div className="max-w-2xl mx-auto relative">
                    <Textarea
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Écrivez votre message..."
                      className="min-h-[80px] pr-20 resize-none bg-gray-50 border-gray-300 text-gray-900 focus:bg-white focus:border-gray-400 transition-all text-sm rounded-xl font-medium"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply(); }
                      }}
                    />
                    <Button
                      className="absolute bottom-3 right-3 h-8 bg-gray-900 hover:bg-gray-800 text-white rounded-full shadow-sm px-4 text-xs font-semibold"
                      onClick={sendReply}
                      disabled={isSending || !replyText.trim()}
                    >
                      {isSending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Envoyer"}
                    </Button>
                  </div>
                </div>
              )}

              {selectedTicket.status === 'closed' && (
                <div className="border-t border-gray-200 bg-gray-50 py-4 text-center">
                  <p className="text-sm text-gray-600 font-medium">Cette demande est résolue</p>
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
              <p className="text-sm font-medium text-gray-800">Sélectionnez une demande</p>
              <p className="text-xs text-gray-600 mt-1">ou créez-en une nouvelle</p>
            </div>
          )}
        </div>
      </div>

      <Footer />

      {/* NEW TICKET DIALOG */}
      <Dialog open={showNewTicket} onOpenChange={setShowNewTicket}>
        <DialogContent className="sm:max-w-lg overflow-hidden p-0 border-0">
          <div className="relative p-8 px-10">
            <div className="absolute inset-0 z-0">
              <img src="/ticket-bg.jpg" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/80"></div>
            </div>
            
            <div className="relative z-10 text-white">
              <DialogHeader>
                <DialogTitle className="font-light text-2xl text-white">Nouvelle demande</DialogTitle>
              </DialogHeader>
              <div className="space-y-6 py-8">
                <div className="space-y-3">
                  <Label className="text-[11px] font-bold text-white/70 uppercase tracking-widest">Sujet</Label>
                  <Input
                    value={newSubject}
                    onChange={(e) => setNewSubject(e.target.value)}
                    placeholder="Ex: Problème d'accès à mon compte"
                    className="h-12 font-medium border-white/20 bg-white/10 text-white placeholder:text-white/40 focus:border-white/50 focus:ring-1 focus:ring-white/50 rounded-xl"
                  />
                </div>
                <div className="space-y-3">
                  <Label className="text-[11px] font-bold text-white/70 uppercase tracking-widest">Décrivez votre problème</Label>
                  <Textarea
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Donnez-nous tous les détails..."
                    className="min-h-[160px] font-medium resize-none border-white/20 bg-white/10 text-white placeholder:text-white/40 focus:border-white/50 focus:ring-1 focus:ring-white/50 rounded-xl"
                  />
                </div>
              </div>
              <DialogFooter className="gap-3 sm:gap-0 mt-2 border-t border-white/10 pt-6">
                <Button variant="ghost" onClick={() => setShowNewTicket(false)} className="font-medium text-white/70 hover:text-white hover:bg-white/10 rounded-full h-11">
                  Annuler
                </Button>
                <Button
                  onClick={createTicket}
                  disabled={isCreating || !newSubject.trim() || !newMessage.trim()}
                  className="bg-white hover:bg-gray-200 text-black h-11 rounded-full px-8 font-bold shadow-xl"
                >
                  {isCreating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : "Envoyer"}
                </Button>
              </DialogFooter>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default HelpMyTickets;
