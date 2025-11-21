import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, CheckCircle, XCircle, Clock, ArrowLeft, Activity, OctagonAlert, PlayCircle, Hash, FileText, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { showSuccess, showError } from '@/utils/toast';

interface QueueItem {
  id: string;
  url: string;
  status: string;
  added_at: string;
  error_message?: string;
}

interface LogItem {
  id: string;
  message: string;
  step: string;
  status: string;
  created_at: string;
}

const Monitor = () => {
  const navigate = useNavigate();
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [isActive, setIsActive] = useState(true);
  const [isToggling, setIsToggling] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const logsEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // --- DATA FETCHING FUNCTIONS ---

  const fetchSettings = async () => {
    const { data } = await supabase
      .from('crawler_settings')
      .select('is_active')
      .eq('id', 1)
      .single();
    if (data) setIsActive(data.is_active);
  };

  const fetchQueue = async () => {
    const { data } = await supabase
      .from('crawl_queue')
      .select('*')
      .order('added_at', { ascending: false })
      .limit(50);
    
    if (data) {
      // On ne met à jour que si les données ont changé pour éviter les re-renders inutiles
      setQueue(prev => {
        const isSame = prev.length === data.length && prev[0]?.id === data[0]?.id && prev[0]?.status === data[0]?.status;
        if (isSame) return prev;
        setLastUpdate(new Date());
        return data;
      });
    }
  };

  const fetchLogs = async (id: string) => {
    const { data } = await supabase
      .from('crawl_logs')
      .select('*')
      .eq('queue_id', id)
      .order('created_at', { ascending: true });
    
    if (data) {
      setLogs(data);
      // Auto-scroll down on fetch
      setTimeout(() => logsEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  };

  // --- SUBSCRIPTIONS & POLLING ---

  // 1. Settings & Global Queue (Realtime + Polling)
  useEffect(() => {
    fetchSettings();
    fetchQueue();

    // Subscription Realtime
    const settingsChannel = supabase
      .channel('settings_updates')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'crawler_settings' }, (payload) => {
        setIsActive(payload.new.is_active);
      })
      .subscribe();

    const queueChannel = supabase
      .channel('queue_updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'crawl_queue' }, () => {
        // Sur tout changement, on refetch pour être sûr d'avoir l'ordre correct
        fetchQueue();
      })
      .subscribe();

    // Polling de sécurité (toutes les 5s)
    const interval = setInterval(() => {
      fetchQueue();
      fetchSettings();
    }, 5000);

    return () => {
      supabase.removeChannel(settingsChannel);
      supabase.removeChannel(queueChannel);
      clearInterval(interval);
    };
  }, []);

  // 2. Logs for Selected Item (Realtime + Fast Polling)
  useEffect(() => {
    if (!selectedId) {
      setLogs([]);
      return;
    }

    // Initial fetch
    fetchLogs(selectedId);

    // Subscription
    const logsChannel = supabase
      .channel(`logs:${selectedId}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'crawl_logs',
        filter: `queue_id=eq.${selectedId}`
      }, (payload) => {
        setLogs(prev => {
          const newLogs = [...prev, payload.new as LogItem];
          // Auto-scroll immédiat sur nouvel événement
          setTimeout(() => logsEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
          return newLogs;
        });
      })
      .subscribe();

    // Fast Polling pour les logs (2s) car c'est critique de voir l'avancement
    const logInterval = setInterval(() => {
      if (queue.find(q => q.id === selectedId)?.status === 'processing') {
        fetchLogs(selectedId);
      }
    }, 2000);

    return () => {
      supabase.removeChannel(logsChannel);
      clearInterval(logInterval);
    };
  }, [selectedId]);

  // --- ACTIONS ---

  const toggleSystem = async () => {
    try {
      setIsToggling(true);
      const newState = !isActive;
      
      const { error } = await supabase
        .from('crawler_settings')
        .update({ is_active: newState })
        .eq('id', 1);

      if (error) throw error;

      if (newState) {
        showSuccess('Système relancé.');
        await fetch('https://asctcqyupjwjifxidegq.supabase.co/functions/v1/process-queue', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFzY3RjcXl1cGp3amlmeGlkZWdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMxNjU1ODEsImV4cCI6MjA3ODc0MTU4MX0.JUAXZaLsixxqQ2-hNzgZhmViVvA8aiDbL-3IOquanrs`,
          },
          body: JSON.stringify({ batchSize: 3 }),
        });
      } else {
        showSuccess("Arrêt du système (Pause).");
      }
      
      // Force refresh immédiat
      fetchSettings();
    } catch (err: any) {
      showError(err.message);
    } finally {
      setIsToggling(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="h-4 w-4 text-amber-500" />;
      case 'processing': return <Loader2 className="h-4 w-4 animate-spin text-blue-600" />;
      case 'completed': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'failed': return <XCircle className="h-4 w-4 text-red-600" />;
      default: return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getLogBadge = (step: string) => {
    const variants: {[key: string]: string} = {
      'INIT': 'bg-gray-100 text-gray-800 border-gray-200',
      'FETCH_DIRECT': 'bg-blue-50 text-blue-700 border-blue-200',
      'FETCH_PROXY': 'bg-orange-50 text-orange-700 border-orange-200',
      'PARSING': 'bg-indigo-50 text-indigo-700 border-indigo-200',
      'AI_ANALYSIS': 'bg-purple-50 text-purple-700 border-purple-200',
      'ENCRYPTION': 'bg-slate-100 text-slate-700 border-slate-200',
      'DISCOVERY': 'bg-cyan-50 text-cyan-700 border-cyan-200',
      'SAVE': 'bg-teal-50 text-teal-700 border-teal-200',
      'COMPLETE': 'bg-green-50 text-green-700 border-green-200',
      'ERROR': 'bg-red-50 text-red-700 border-red-200',
    };
    return variants[step] || 'bg-gray-50 text-gray-600 border-gray-200';
  };

  const pendingCount = queue.filter(i => i.status === 'pending').length;
  const processingCount = queue.filter(i => i.status === 'processing').length;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 p-4 md:p-6 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-full px-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Retour
            </Button>
            <div className="h-8 w-px bg-gray-200 mx-2 hidden md:block"></div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold text-gray-800">Console Superviseur</h1>
                <Badge 
                  variant="outline" 
                  className={`px-3 py-1 rounded-full border ${isActive ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}
                >
                  {isActive ? (
                    <span className="flex items-center gap-1.5"><span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span></span>Système Actif</span>
                  ) : (
                     <span className="flex items-center gap-1.5"><div className="h-2 w-2 rounded-full bg-red-500"></div>En Pause</span>
                  )}
                </Badge>
              </div>
              <p className="text-sm text-gray-500 flex items-center gap-3 mt-1.5">
                <span className="flex items-center gap-1.5 font-medium text-blue-600"><Activity className="h-3.5 w-3.5" /> {processingCount} en cours</span>
                <span className="text-gray-300">•</span>
                <span className="flex items-center gap-1.5 text-amber-600"><Clock className="h-3.5 w-3.5" /> {pendingCount} en attente</span>
                <span className="text-gray-300 hidden sm:inline">•</span>
                <span className="text-xs text-gray-400 hidden sm:flex items-center gap-1">
                  <RefreshCw className="h-3 w-3 animate-spin-slow" /> Live
                </span>
              </p>
            </div>
          </div>
          
          <Button
            size="lg"
            variant={isActive ? "destructive" : "default"}
            onClick={toggleSystem}
            disabled={isToggling}
            className={`font-medium shadow-sm transition-all rounded-lg ${isActive ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700 text-white'}`}
          >
            {isToggling ? (
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            ) : isActive ? (
              <>
                <OctagonAlert className="mr-2 h-5 w-5" />
                Arrêt d'urgence
              </>
            ) : (
              <>
                <PlayCircle className="mr-2 h-5 w-5" />
                Relancer le système
              </>
            )}
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-180px)] min-h-[500px]">
          {/* Liste des tâches */}
          <Card className="flex flex-col border-gray-200 shadow-sm overflow-hidden rounded-xl">
            <CardHeader className="py-3 px-4 border-b border-gray-100 bg-gray-50/80">
              <CardTitle className="text-xs font-bold text-gray-500 uppercase tracking-wider flex justify-between items-center">
                <span>File d'attente</span>
                <span className="text-[10px] font-normal bg-white px-2 py-0.5 rounded border border-gray-200 text-gray-400">
                  Live Feed
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden p-0 bg-white">
              <ScrollArea className="h-full">
                <div className="divide-y divide-gray-50">
                  {queue.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setSelectedId(item.id)}
                      className={`w-full text-left px-4 py-3.5 hover:bg-gray-50 transition-all duration-200 flex items-center justify-between group ${
                        selectedId === item.id ? 'bg-blue-50/50 border-l-4 border-blue-500 pl-3' : 'border-l-4 border-transparent pl-3'
                      }`}
                    >
                      <div className="overflow-hidden flex-1 mr-3">
                        <div className="flex items-center gap-2 mb-1">
                          {getStatusIcon(item.status)}
                          <span className={`text-xs font-bold uppercase tracking-wide ${
                            item.status === 'processing' ? 'text-blue-600' : 
                            item.status === 'completed' ? 'text-green-600' : 
                            item.status === 'failed' ? 'text-red-600' : 'text-amber-600'
                          }`}>
                            {item.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-gray-400 font-mono truncate">
                          <Hash className="h-3 w-3 flex-shrink-0" />
                          {item.id}
                        </div>
                      </div>
                      <div className="text-right flex flex-col items-end justify-center">
                         <span className="text-[10px] text-gray-400 font-medium bg-gray-50 px-1.5 py-0.5 rounded">
                           {new Date(item.added_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}
                         </span>
                      </div>
                    </button>
                  ))}
                  {queue.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-2 p-8">
                      <div className="h-10 w-10 rounded-full bg-gray-50 flex items-center justify-center">
                        <Clock className="h-5 w-5 text-gray-300" />
                      </div>
                      <p className="text-xs font-medium">File d'attente vide</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Détails & Logs */}
          <Card className="lg:col-span-2 flex flex-col border-gray-200 shadow-sm overflow-hidden rounded-xl">
            <CardHeader className="py-3 px-4 border-b border-gray-100 bg-gray-50/80 flex flex-row items-center justify-between h-[53px]">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-gray-500" />
                <CardTitle className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                  {selectedId ? 'Console Logs' : 'Aperçu'}
                </CardTitle>
              </div>
              {selectedId && (
                <div className="flex items-center gap-2 text-[10px] text-gray-500 font-mono bg-white px-2 py-1 rounded border border-gray-200 shadow-sm">
                  UUID: {selectedId}
                </div>
              )}
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden p-0 bg-white relative">
              {selectedId ? (
                <ScrollArea className="h-full w-full" ref={scrollAreaRef}>
                   <div className="p-6 space-y-6 min-h-full">
                      {logs.length === 0 && (
                        <div className="flex items-center justify-center h-20 text-gray-400 text-sm italic">
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Attente de logs...
                        </div>
                      )}
                      <div className="space-y-6 pb-4">
                        {logs.map((log, idx) => (
                          <div key={log.id} className="flex gap-4 group animate-in fade-in slide-in-from-bottom-1 duration-300">
                            <div className="flex flex-col items-center gap-1 min-w-[45px] pt-1">
                               <span className="text-[10px] font-mono text-gray-400">
                                 {new Date(log.created_at).toLocaleTimeString([], { minute:'2-digit', second:'2-digit' })}
                               </span>
                               <div className={`w-px flex-1 bg-gray-100 my-1 group-last:hidden`}></div>
                            </div>
                            
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1.5">
                                <span className={`text-[10px] px-2 py-0.5 rounded font-bold tracking-wide border ${getLogBadge(log.step)}`}>
                                  {log.step}
                                </span>
                              </div>
                              <p className={`text-sm leading-relaxed font-mono ${log.status === 'error' ? 'text-red-600 font-medium bg-red-50 p-2 rounded border border-red-100' : 'text-gray-600'}`}>
                                {log.message}
                              </p>
                            </div>
                          </div>
                        ))}
                        <div ref={logsEndRef} className="h-px w-full" />
                      </div>
                   </div>
                </ScrollArea>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-4 bg-gray-50/30">
                  <div className="h-16 w-16 rounded-2xl bg-white shadow-sm border border-gray-100 flex items-center justify-center">
                    <Activity className="h-8 w-8 text-gray-300" />
                  </div>
                  <div className="text-center">
                    <p className="font-medium text-gray-600 text-sm">En attente de sélection</p>
                    <p className="text-xs text-gray-400 mt-1">Cliquez sur une tâche à gauche pour voir le détail</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Monitor;