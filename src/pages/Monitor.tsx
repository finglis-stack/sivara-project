import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, CheckCircle, XCircle, Clock, ArrowLeft, Activity, Server, OctagonAlert, PlayCircle, Hash, FileText, Link as LinkIcon } from 'lucide-react';
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
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Fetch settings
  useEffect(() => {
    const fetchSettings = async () => {
      const { data } = await supabase
        .from('crawler_settings')
        .select('is_active')
        .eq('id', 1)
        .single();
      if (data) setIsActive(data.is_active);
    };
    fetchSettings();

    const channel = supabase
      .channel('settings_updates')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'crawler_settings' }, (payload) => {
        setIsActive(payload.new.is_active);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Fetch queue
  useEffect(() => {
    const fetchQueue = async () => {
      const { data } = await supabase
        .from('crawl_queue')
        .select('*')
        .order('added_at', { ascending: false })
        .limit(50);
      if (data) setQueue(data);
    };

    fetchQueue();

    const channel = supabase
      .channel('queue_updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'crawl_queue' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setQueue(prev => [payload.new as QueueItem, ...prev]);
        } else if (payload.eventType === 'UPDATE') {
          setQueue(prev => prev.map(item => item.id === payload.new.id ? payload.new as QueueItem : item));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Fetch logs
  useEffect(() => {
    if (!selectedId) {
      setLogs([]);
      return;
    }

    const fetchLogs = async () => {
      const { data } = await supabase
        .from('crawl_logs')
        .select('*')
        .eq('queue_id', selectedId)
        .order('created_at', { ascending: true });
      if (data) setLogs(data);
    };

    fetchLogs();

    const channel = supabase
      .channel(`logs:${selectedId}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'crawl_logs',
        filter: `queue_id=eq.${selectedId}`
      }, (payload) => {
        setLogs(prev => [...prev, payload.new as LogItem]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedId]);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

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
        // Relancer un batch
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
      'INIT': 'bg-gray-100 text-gray-800',
      'PARSING': 'bg-blue-50 text-blue-700',
      'ENCRYPTION': 'bg-purple-50 text-purple-700',
      'DISCOVERY': 'bg-indigo-50 text-indigo-700',
      'COMPLETE': 'bg-green-50 text-green-700',
      'ERROR': 'bg-red-50 text-red-700',
    };
    return variants[step] || 'bg-gray-100 text-gray-600';
  };

  const pendingCount = queue.filter(i => i.status === 'pending').length;
  const processingCount = queue.filter(i => i.status === 'processing').length;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="text-gray-500 hover:text-gray-900 hover:bg-gray-100">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Retour
            </Button>
            <div className="h-8 w-px bg-gray-200 mx-2 hidden md:block"></div>
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2 text-gray-800">
                Console Superviseur
                <Badge 
                  variant="outline" 
                  className={`ml-2 ${isActive ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}
                >
                  {isActive ? 'Système Actif' : 'En Pause'}
                </Badge>
              </h1>
              <p className="text-sm text-gray-500 flex items-center gap-3 mt-1">
                <span className="flex items-center gap-1"><Activity className="h-3 w-3" /> {processingCount} en cours</span>
                <span className="text-gray-300">•</span>
                <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {pendingCount} en attente</span>
              </p>
            </div>
          </div>
          
          <Button
            size="lg"
            variant={isActive ? "destructive" : "default"}
            onClick={toggleSystem}
            disabled={isToggling}
            className={`font-medium shadow-sm transition-all ${isActive ? '' : 'bg-green-600 hover:bg-green-700 text-white'}`}
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-180px)]">
          {/* Liste des tâches */}
          <Card className="flex flex-col border-gray-200 shadow-sm overflow-hidden">
            <CardHeader className="py-4 px-5 border-b border-gray-100 bg-gray-50/50">
              <CardTitle className="text-sm font-semibold text-gray-700 flex justify-between items-center">
                <span>File d'attente</span>
                <Badge variant="secondary" className="text-xs bg-white border border-gray-200 text-gray-600 shadow-sm">
                  3 tâches / batch
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden p-0 bg-white">
              <ScrollArea className="h-full">
                <div className="divide-y divide-gray-100">
                  {queue.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setSelectedId(item.id)}
                      className={`w-full text-left px-5 py-4 hover:bg-gray-50 transition-all duration-200 flex items-center justify-between group ${
                        selectedId === item.id ? 'bg-blue-50/60 border-l-4 border-blue-500' : 'border-l-4 border-transparent'
                      }`}
                    >
                      <div className="overflow-hidden flex-1 mr-4">
                        <div className="flex items-center gap-2 mb-1.5">
                          {getStatusIcon(item.status)}
                          <span className={`text-xs font-semibold uppercase tracking-wide ${
                            item.status === 'processing' ? 'text-blue-600' : 
                            item.status === 'completed' ? 'text-green-600' : 
                            item.status === 'failed' ? 'text-red-600' : 'text-amber-600'
                          }`}>
                            {item.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-gray-400 font-mono">
                          <Hash className="h-3 w-3" />
                          {item.id.split('-')[0]}...
                        </div>
                      </div>
                      <div className="text-right">
                         <span className="text-xs text-gray-400 font-medium">
                           {new Date(item.added_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                         </span>
                      </div>
                    </button>
                  ))}
                  {queue.length === 0 && (
                    <div className="p-10 text-center text-gray-400 flex flex-col items-center gap-2">
                      <div className="h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center">
                        <Clock className="h-6 w-6 text-gray-300" />
                      </div>
                      <p className="text-sm">File d'attente vide</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Détails & Logs */}
          <Card className="lg:col-span-2 flex flex-col border-gray-200 shadow-sm overflow-hidden">
            <CardHeader className="py-4 px-5 border-b border-gray-100 bg-gray-50/50 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-gray-500" />
                <CardTitle className="text-sm font-semibold text-gray-700">
                  {selectedId ? 'Détails de l\'exécution' : 'Sélectionnez une tâche'}
                </CardTitle>
              </div>
              {selectedId && (
                <div className="flex items-center gap-2 text-xs text-gray-500 font-mono bg-white px-2 py-1 rounded border border-gray-200">
                  ID: {selectedId}
                </div>
              )}
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden p-0 bg-white relative">
              {selectedId ? (
                <ScrollArea className="h-full">
                   <div className="p-6 space-y-6">
                      <div className="space-y-4">
                        {logs.map((log, idx) => (
                          <div key={log.id} className="flex gap-4 group animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <div className="flex flex-col items-center gap-1 min-w-[40px]">
                               <span className="text-[10px] font-mono text-gray-400">
                                 {new Date(log.created_at).toLocaleTimeString([], { minute:'2-digit', second:'2-digit' })}
                               </span>
                               <div className={`w-px h-full bg-gray-100 group-last:hidden`}></div>
                            </div>
                            
                            <div className="flex-1 pb-2">
                              <div className="flex items-center gap-3 mb-1">
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold tracking-wider ${getLogBadge(log.step)}`}>
                                  {log.step}
                                </span>
                              </div>
                              <p className={`text-sm ${log.status === 'error' ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
                                {log.message}
                              </p>
                            </div>
                          </div>
                        ))}
                        <div ref={logsEndRef} />
                      </div>
                   </div>
                </ScrollArea>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-4 bg-gray-50/30">
                  <div className="h-16 w-16 rounded-2xl bg-white shadow-sm border border-gray-100 flex items-center justify-center">
                    <Activity className="h-8 w-8 text-gray-300" />
                  </div>
                  <div className="text-center">
                    <p className="font-medium text-gray-600">En attente</p>
                    <p className="text-sm">Sélectionnez une tâche à gauche pour voir les logs</p>
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