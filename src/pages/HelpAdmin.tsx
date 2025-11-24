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
  ShieldCheck, AlertCircle, PauseCircle, CheckCircle2, Smartphone, GripVertical
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
import { Card } from '@/components/ui/card';

// DND Imports
import {
  DndContext, 
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

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

interface CustomerStats {
  fileCount: number;
  folderCount: number;
}

interface Category { 
    id: string; 
    title: string; 
    description: string; 
    slug: string; 
    order: number; 
}

interface Article { 
    id: string; 
    title: string; 
    slug: string; 
    content: string; 
    is_published: boolean; 
    view_count: number; 
    category_id: string;
    order: number;
}

// --- DND COMPONENT ---
const SortableItem = ({ id, children, className }: { id: string, children: React.ReactNode, className?: string }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
    opacity: isDragging ? 0.5 : 1,
    position: 'relative' as 'relative',
  };

  return (
    <div ref={setNodeRef} style={style} className={className}>
      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-2 text-gray-400 hover:text-gray-600">
        <GripVertical className="h-4 w-4" />
      </div>
      {children}
    </div>
  );
};

const HelpAdmin = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<'support' | 'content'>('support');
  const [isStaff, setIsStaff] = useState(false);
  const [isCheckingRole, setIsCheckingRole] = useState(true);
  
  // Staff Info
  const [myProfile, setMyProfile] = useState<Profile | null>(null);

  // --- SUPPORT STATE ---
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [replyText, setReplyText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [customerStats, setCustomerStats] = useState<CustomerStats | null>(null);
  const [isLoadingTickets, setIsLoadingTickets] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // --- CONTENT STATE ---
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [articles, setArticles] = useState<Article[]>([]);
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  
  // Content Dialogs & Forms
  const [showCatDialog, setShowCatDialog] = useState(false);
  const [showArticleDialog, setShowArticleDialog] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [catForm, setCatForm] = useState({ title: '', description: '', slug: '', order: 0 });
  const [artForm, setArtForm] = useState<Partial<Article>>({ title: '', slug: '', content: '', is_published: false });
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);

  // DND Sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // VERIFICATION STAFF
  useEffect(() => {
    const checkStaff = async () => {
        if (!user) return;
        try {
            const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).single();
            if (error || !data?.is_staff) { navigate('/'); } 
            else { 
                setIsStaff(true); 
                setMyProfile(data as any); 
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
    else fetchCategories();
  }, [activeTab, isStaff]);

  // REALTIME SUBSCRIPTION
  useEffect(() => {
    if (!isStaff || activeTab !== 'support') return;

    const channel = supabase.channel('admin-support')
        .on('postgres_changes', 
            { event: '*', schema: 'public', table: 'support_tickets' }, 
            async (payload) => {
                // Recharger la liste pour avoir les profils à jour (JOIN)
                // C'est plus simple que de gérer le merge manuel du profil
                const { data } = await supabase
                    .from('support_tickets')
                    .select(`*, profiles:user_id (id, first_name, last_name, avatar_url, phone_country_code, phone_number, is_pro, account_type)`)
                    .order('last_message_at', { ascending: false });
                
                if (data) setTickets(data as unknown as Ticket[]);
                
                // Mettre à jour le ticket sélectionné si c'est lui qui a changé
                if (payload.new && (payload.new as any).id === selectedTicketId) {
                    // On garde les profils existants pour éviter le clignotement
                    setSelectedTicket(prev => prev ? { ...prev, ...payload.new as any } : null);
                }
            }
        )
        .on('postgres_changes', 
            { event: 'INSERT', schema: 'public', table: 'support_messages' }, 
            async (payload) => {
                const newMessage = payload.new as Message;
                
                // Si le message concerne le ticket ouvert
                if (newMessage.ticket_id === selectedTicketId) {
                    // On doit récupérer le profil de l'envoyeur pour l'avatar
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('first_name, avatar_url')
                        .eq('id', newMessage.sender_id)
                        .single();
                    
                    const messageWithProfile = {
                        ...newMessage,
                        profiles: profile
                    };

                    setMessages(prev => {
                        // Éviter les doublons si on a fait un ajout optimiste (via ID temporaire)
                        const exists = prev.some(m => m.id === newMessage.id);
                        if (exists) return prev;
                        return [...prev, messageWithProfile as any];
                    });
                    
                    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
                }
            }
        )
        .subscribe();

    return () => {
        supabase.removeChannel(channel);
    };
  }, [isStaff, activeTab, selectedTicketId]); // Dépendance selectedTicketId importante pour le filtrage message

  // ================= SUPPORT LOGIC =================

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
      // Le realtime mettra à jour l'UI automatiquement
      showSuccess(`Ticket ${status}`);
  };

  const sendReply = async () => {
      if (!selectedTicketId || !replyText.trim()) return;
      const textToSend = replyText;
      setReplyText(''); 
      setIsSending(true);
      
      try {
          // Suppression de l'ajout optimiste ici car le Realtime va le gérer
          // Cela évite les conflits d'ID et doublons si le serveur répond vite
          
          await supabase.functions.invoke('support-outbound', {
              body: { ticketId: selectedTicketId, messageBody: textToSend, status: 'open' }
          });
          
          showSuccess("Envoyé");
      } catch (e) { showError("Erreur d'envoi"); } 
      finally { setIsSending(false); }
  };

  // ================= CONTENT LOGIC =================

  const fetchCategories = async () => {
    setIsLoadingContent(true);
    const { data } = await supabase.from('help_categories').select('*').order('order');
    setCategories(data || []);
    
    // Si on a des catégories et aucune sélectionnée, on prend la première
    if (data && data.length > 0 && !selectedCategory) {
        handleSelectCategory(data[0]);
    } else if (selectedCategory) {
        // Rafraîchir la catégorie sélectionnée
        const updated = data?.find(c => c.id === selectedCategory.id);
        if (updated) handleSelectCategory(updated);
    }
    setIsLoadingContent(false);
  };

  const handleSelectCategory = async (cat: Category) => {
    setSelectedCategory(cat);
    const { data } = await supabase.from('help_articles').select('*').eq('category_id', cat.id).order('order');
    setArticles(data || []);
  };

  // DND: Reorder Categories
  const handleDragEndCategories = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (active.id !== over?.id) {
      const oldIndex = categories.findIndex((c) => c.id === active.id);
      const newIndex = categories.findIndex((c) => c.id === over?.id);
      
      const newItems = arrayMove(categories, oldIndex, newIndex);
      setCategories(newItems);

      // Update DB
      const updates = newItems.map((cat, index) => ({ id: cat.id, order: index }));
      for (const update of updates) {
          await supabase.from('help_categories').update({ order: update.order }).eq('id', update.id);
      }
    }
  };

  // DND: Reorder Articles
  const handleDragEndArticles = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (active.id !== over?.id) {
      const oldIndex = articles.findIndex((a) => a.id === active.id);
      const newIndex = articles.findIndex((a) => a.id === over?.id);
      
      const newItems = arrayMove(articles, oldIndex, newIndex);
      setArticles(newItems);

      // Update DB
      const updates = newItems.map((art, index) => ({ id: art.id, order: index }));
      for (const update of updates) {
          await supabase.from('help_articles').update({ order: update.order }).eq('id', update.id);
      }
    }
  };

  // CRUD: Category
  const openCategoryDialog = (cat?: Category) => {
      if (cat) {
          setEditMode(true);
          setCatForm({ title: cat.title, description: cat.description, slug: cat.slug, order: cat.order });
          setSelectedCategory(cat); // Temporaire pour edit
      } else {
          setEditMode(false);
          setCatForm({ title: '', description: '', slug: '', order: categories.length });
      }
      setShowCatDialog(true);
  };

  const handleSaveCategory = async () => {
    try {
        const slug = catForm.slug || catForm.title.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '');
        if (editMode && selectedCategory) {
            await supabase.from('help_categories').update({ ...catForm, slug }).eq('id', selectedCategory.id);
            showSuccess("Catégorie mise à jour");
        } else {
            await supabase.from('help_categories').insert({ ...catForm, slug });
            showSuccess("Catégorie créée");
        }
        setShowCatDialog(false);
        fetchCategories();
    } catch (e) { showError("Erreur sauvegarde"); }
  };

  const handleDeleteCategory = async (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      if (!confirm("Supprimer cette catégorie et tous ses articles ?")) return;
      await supabase.from('help_categories').delete().eq('id', id);
      setSelectedCategory(null);
      fetchCategories();
  };

  // CRUD: Article
  const openArticleDialog = (art?: Article) => {
      if (art) {
          setEditMode(true);
          setSelectedArticle(art);
          setArtForm({ title: art.title, slug: art.slug, content: art.content, is_published: art.is_published });
      } else {
          setEditMode(false);
          setSelectedArticle(null);
          setArtForm({ title: '', slug: '', content: '', is_published: true });
      }
      setShowArticleDialog(true);
  };

  const handleSaveArticle = async () => {
      try {
        if (!selectedCategory || !artForm.title) return;
        const slug = artForm.slug || artForm.title.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '');
        
        const payload = {
            title: artForm.title,
            slug,
            content: artForm.content,
            is_published: artForm.is_published,
            category_id: selectedCategory.id
        };

        if (editMode && selectedArticle) {
            await supabase.from('help_articles').update(payload).eq('id', selectedArticle.id);
            showSuccess("Article mis à jour");
        } else {
            // Get max order
            const maxOrder = articles.length > 0 ? Math.max(...articles.map(a => a.order)) : -1;
            await supabase.from('help_articles').insert({ ...payload, author_id: user?.id, order: maxOrder + 1 });
            showSuccess("Article créé");
        }
        setShowArticleDialog(false);
        handleSelectCategory(selectedCategory);
      } catch (e) { showError("Erreur sauvegarde article"); }
  };

  const handleDeleteArticle = async (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      if (!confirm("Supprimer l'article ?")) return;
      await supabase.from('help_articles').delete().eq('id', id);
      if (selectedCategory) handleSelectCategory(selectedCategory);
  };

  if (loading || isCheckingRole) return <div className="h-screen flex items-center justify-center bg-white"><Loader2 className="h-8 w-8 animate-spin text-gray-400" /></div>;

  return (
    <div className="flex h-screen bg-white font-sans overflow-hidden">
      
      {/* SIDEBAR */}
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
            {/* LIST */}
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

            {/* CHAT */}
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

            {/* CLIENT INFO SIDEBAR */}
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

      {/* ================= CONTENT VIEW (CMS) ================= */}
      {activeTab === 'content' && (
        <div className="flex-1 flex overflow-hidden">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEndCategories}>
                <div className="w-72 border-r border-gray-200 bg-gray-50 flex flex-col">
                    <div className="p-4 border-b border-gray-200 flex justify-between items-center">
                        <h2 className="font-bold text-gray-900">Catégories</h2>
                        <Button variant="ghost" size="icon" onClick={() => openCategoryDialog()}><Plus className="h-4 w-4" /></Button>
                    </div>
                    <ScrollArea className="flex-1">
                        <SortableContext items={categories.map(c => c.id)} strategy={verticalListSortingStrategy}>
                            <div className="p-2 space-y-1">
                                {categories.map(cat => (
                                    <SortableItem key={cat.id} id={cat.id} className={`flex items-center p-2 rounded-lg cursor-pointer group ${selectedCategory?.id === cat.id ? 'bg-white shadow-sm text-indigo-600 font-medium' : 'hover:bg-gray-100 text-gray-600'}`}>
                                        <div className="flex-1 truncate" onClick={() => handleSelectCategory(cat)}>{cat.title}</div>
                                        <div className="flex opacity-0 group-hover:opacity-100">
                                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); openCategoryDialog(cat); }}><Edit2 className="h-3 w-3" /></Button>
                                            <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500" onClick={(e) => handleDeleteCategory(e, cat.id)}><Trash2 className="h-3 w-3" /></Button>
                                        </div>
                                    </SortableItem>
                                ))}
                            </div>
                        </SortableContext>
                    </ScrollArea>
                </div>
            </DndContext>

            <div className="flex-1 flex flex-col bg-white">
                <div className="p-6 border-b border-gray-200 flex justify-between items-center bg-gray-50/50">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">{selectedCategory ? selectedCategory.title : 'Sélectionnez une catégorie'}</h1>
                        <p className="text-sm text-gray-500">{selectedCategory?.description}</p>
                    </div>
                    {selectedCategory && (
                        <Button onClick={() => openArticleDialog()} className="bg-indigo-600 hover:bg-indigo-700"><Plus className="mr-2 h-4 w-4" /> Nouvel article</Button>
                    )}
                </div>

                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEndArticles}>
                    <ScrollArea className="flex-1 p-6">
                        <SortableContext items={articles.map(a => a.id)} strategy={verticalListSortingStrategy}>
                            <div className="space-y-2">
                                {articles.map(article => (
                                    <SortableItem key={article.id} id={article.id} className="flex items-center p-4 bg-white border border-gray-200 rounded-xl hover:shadow-md transition-all group">
                                        <div className="flex-1 min-w-0 pl-2">
                                            <h3 className="font-semibold text-gray-900 truncate">{article.title}</h3>
                                            <div className="flex items-center gap-3 mt-1">
                                                <Badge variant={article.is_published ? 'default' : 'secondary'} className="text-[10px] h-5">{article.is_published ? 'Publié' : 'Brouillon'}</Badge>
                                                <span className="text-xs text-gray-400 flex items-center gap-1"><Eye className="h-3 w-3" /> {article.view_count}</span>
                                                <span className="text-xs text-gray-400 font-mono">{article.slug}</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Button variant="outline" size="sm" onClick={() => openArticleDialog(article)}>Editer</Button>
                                            <Button variant="ghost" size="icon" className="text-red-500 hover:bg-red-50" onClick={(e) => handleDeleteArticle(e, article.id)}><Trash2 className="h-4 w-4" /></Button>
                                        </div>
                                    </SortableItem>
                                ))}
                            </div>
                        </SortableContext>
                    </ScrollArea>
                </DndContext>
            </div>
        </div>
      )}

      {/* --- DIALOGS (CMS) --- */}
      <Dialog open={showCatDialog} onOpenChange={setShowCatDialog}>
        <DialogContent>
            <DialogHeader><DialogTitle>{editMode ? 'Modifier' : 'Nouvelle'} Catégorie</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
                <div className="space-y-2"><Label>Titre</Label><Input value={catForm.title} onChange={e => setCatForm({...catForm, title: e.target.value})} /></div>
                <div className="space-y-2"><Label>Description</Label><Input value={catForm.description} onChange={e => setCatForm({...catForm, description: e.target.value})} /></div>
                <div className="space-y-2"><Label>Slug (Optionnel)</Label><Input value={catForm.slug} onChange={e => setCatForm({...catForm, slug: e.target.value})} placeholder="auto-genéré" /></div>
            </div>
            <DialogFooter><Button onClick={handleSaveCategory}>Enregistrer</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showArticleDialog} onOpenChange={setShowArticleDialog}>
        <DialogContent className="max-w-3xl h-[80vh] flex flex-col">
            <DialogHeader><DialogTitle>{editMode ? 'Modifier' : 'Nouvel'} Article</DialogTitle></DialogHeader>
            <div className="flex-1 overflow-y-auto space-y-4 py-4 pr-2">
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>Titre</Label><Input value={artForm.title} onChange={e => setArtForm({...artForm, title: e.target.value})} /></div>
                    <div className="space-y-2"><Label>Slug</Label><Input value={artForm.slug} onChange={e => setArtForm({...artForm, slug: e.target.value})} placeholder="auto-genéré" /></div>
                </div>
                <div className="flex items-center space-x-2 bg-gray-50 p-3 rounded-lg">
                    <Switch id="pub" checked={artForm.is_published} onCheckedChange={c => setArtForm({...artForm, is_published: c})} />
                    <Label htmlFor="pub" className="cursor-pointer">Publier cet article immédiatement</Label>
                </div>
                <div className="space-y-2 h-full flex flex-col">
                    <Label>Contenu (Markdown)</Label>
                    <Textarea className="flex-1 font-mono text-sm leading-relaxed" value={artForm.content} onChange={e => setArtForm({...artForm, content: e.target.value})} />
                </div>
            </div>
            <DialogFooter><Button onClick={handleSaveArticle}>Enregistrer</Button></DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default HelpAdmin;