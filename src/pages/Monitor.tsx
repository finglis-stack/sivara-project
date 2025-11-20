import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Terminal, CheckCircle, XCircle, Clock, ArrowLeft, Play, Pause, Activity } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { showSuccess } from '@/utils/toast';

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
  const [isAutoProcessing, setIsAutoProcessing] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Fetch initial queue
  useEffect(() => {
    const fetchQueue = async () => {
      const { data } = await supabase
        .from('crawl_queue')
        .select('*')
        .order('added_at', { ascending: false })
        .limit(50); // Increased limit to see backlog
      if (data) setQueue(data);
    };

    fetchQueue();

    // Realtime queue updates
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

  // "Cron" Client-Side : Vérifie et lance le traitement toutes les 3 secondes
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isAutoProcessing) {
      interval = setInterval(async () => {
        // Ne pas lancer si déjà en cours ou si pas de items pending
        const hasPending = queue.some(item => item.status === 'pending');
        
        if (!isProcessing && hasPending) {
          setIsProcessing(true);
          console.log("Auto-processing triggered...");
          
          try {
            const { data: { session } } = await supabase.auth.getSession();
            // On appelle la fonction sans attendre le retour pour ne pas bloquer l'UI
            // Mais on met isProcessing à true pour éviter de spammer la requête
            await fetch('https://asctcqyupjwjifxidegq.supabase.co/functions/v1/process-queue', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session?.access_token || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFzY3RjcXl1cGp3amlmeGlkZWdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMxNjU1ODEsImV4cCI6MjA3ODc0MTU4MX0.JUAXZaLsixxqQ2-hNzgZhmViVvA8aiDbL-3IOquanrs'}`,
              },
              body: JSON.stringify({ batchSize: 3 }), // Roule 3 à la fois
            });
          } catch (err) {
            console.error("Auto-process error", err);
          } finally {
            // On relâche le verrou après un court délai pour permettre le prochain tick
            setTimeout(() => setIsProcessing(false), 1000);
          }
        }
      }, 3000); // 3 secondes
    }

    return () => clearInterval(interval);
  }, [isAutoProcessing, isProcessing, queue]);

  // Fetch logs for selected item
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

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500';
      case 'processing': return 'bg-blue-500 animate-pulse';
      case 'completed': return 'bg-green-500';
      case 'failed': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getLogColor = (status: string) => {
    switch (status) {
      case 'success': return 'text-green-400';
      case 'error': return 'text-red-400';
      case 'info': return 'text-blue-300';
      default: return 'text-gray-300';
    }
  };

  const pendingCount = queue.filter(i => i.status === 'pending').length;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate('/')} className="text-gray-400 hover:text-white">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Retour
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Monitoring Temps Réel</h1>
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <span>{pendingCount} en attente</span>
                {isProcessing && <span className="text-blue-400 animate-pulse">• Traitement en cours...</span>}
              </div>
            </div>
          </div>
          <div className="flex gap-3">
             <Button 
              variant={isAutoProcessing ? "default" : "secondary"}
              size="sm"
              onClick={() => setIsAutoProcessing(!isAutoProcessing)}
              className={`${isAutoProcessing ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-700'}`}
            >
              {isAutoProcessing ? (
                <>
                  <Pause className="mr-2 h-4 w-4" />
                  Auto-Process On
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Auto-Process Off
                </>
              )}
            </Button>
            <Badge variant="outline" className="bg-green-900/20 text-green-400 border-green-900">
              Gemini 3.0 Pro
            </Badge>
            <Badge variant="outline" className="bg-blue-900/20 text-blue-400 border-blue-900">
              AES-256-GCM
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[80vh]">
          {/* Liste de la queue */}
          <Card className="bg-gray-900 border-gray-800 flex flex-col">
            <CardHeader className="py-3 px-4 border-b border-gray-800">
              <CardTitle className="text-sm font-medium text-gray-400">
                File d'attente (FIFO)
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden p-0">
              <ScrollArea className="h-full">
                <div className="divide-y divide-gray-800">
                  {queue.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setSelectedId(item.id)}
                      className={`w-full text-left p-3 hover:bg-gray-800 transition-colors flex items-center justify-between group ${
                        selectedId === item.id ? 'bg-gray-800 border-l-2 border-blue-500' : 'border-l-2 border-transparent'
                      }`}
                    >
                      <div className="overflow-hidden flex-1 mr-2">
                        <div className="flex items-center gap-2 mb-1">
                          <div className={`w-1.5 h-1.5 rounded-full ${getStatusColor(item.status)}`} />
                          <span className={`text-[10px] font-mono uppercase ${item.status === 'processing' ? 'text-blue-400' : 'text-gray-500'}`}>
                            {item.status}
                          </span>
                        </div>
                        <p className="text-xs text-gray-300 truncate font-mono opacity-80 group-hover:opacity-100">
                          Task {item.id.slice(0, 8)}...
                        </p>
                        <p className="text-[10px] text-gray-600 mt-0.5">
                          {new Date(item.added_at).toLocaleTimeString()}
                        </p>
                      </div>
                      {item.status === 'processing' && <Loader2 className="h-3 w-3 animate-spin text-blue-500" />}
                      {item.status === 'completed' && <CheckCircle className="h-3 w-3 text-green-500" />}
                      {item.status === 'failed' && <XCircle className="h-3 w-3 text-red-500" />}
                      {item.status === 'pending' && <Clock className="h-3 w-3 text-yellow-600" />}
                    </button>
                  ))}
                  {queue.length === 0 && (
                    <div className="p-8 text-center text-gray-500 text-sm">
                      File d'attente vide
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Console de logs */}
          <Card className="lg:col-span-2 bg-black border-gray-800 font-mono flex flex-col shadow-2xl shadow-black/50">
            <CardHeader className="py-3 px-4 border-b border-gray-800 bg-gray-900/30 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <Terminal className="h-4 w-4 text-green-500" />
                <CardTitle className="text-sm text-gray-300 font-normal">
                  {selectedId ? `Logs: ${selectedId}` : 'Console système'}
                </CardTitle>
              </div>
              {selectedId && (
                <Badge variant="outline" className="text-[10px] h-5 border-gray-700 text-gray-500">
                  ID: {selectedId}
                </Badge>
              )}
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden p-4 bg-black/90 relative">
              <ScrollArea className="h-full pr-4">
                <div className="space-y-1.5">
                  {logs.map((log) => (
                    <div key={log.id} className="flex gap-3 text-xs font-mono animate-in fade-in slide-in-from-left-1 duration-200">
                      <span className="text-gray-600 shrink-0 select-none w-16">
                        {new Date(log.created_at).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit' })}
                      </span>
                      <span className="text-blue-500 font-bold shrink-0 w-24 uppercase tracking-wider text-[10px] pt-0.5">
                        {log.step}
                      </span>
                      <span className={`${getLogColor(log.status)} break-all flex-1`}>
                        {log.message}
                      </span>
                    </div>
                  ))}
                  {!selectedId && (
                    <div className="h-full flex flex-col items-center justify-center text-gray-700 gap-4 opacity-50">
                      <Activity className="h-16 w-16 animate-pulse" />
                      <p className="text-sm">En attente de sélection d'une tâche...</p>
                    </div>
                  )}
                  <div ref={logsEndRef} />
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Monitor;