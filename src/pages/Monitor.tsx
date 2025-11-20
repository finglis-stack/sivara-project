import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Terminal, CheckCircle, XCircle, Clock, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

interface QueueItem {
  id: string;
  url: string; // Encrypted, we won't decrypt on client for security unless we implement a client-side decryptor (complex)
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
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Fetch initial queue
  useEffect(() => {
    const fetchQueue = async () => {
      const { data } = await supabase
        .from('crawl_queue')
        .select('*')
        .order('added_at', { ascending: false })
        .limit(20);
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

    // Realtime logs
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
      case 'processing': return 'bg-blue-500';
      case 'completed': return 'bg-green-500';
      case 'failed': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getLogColor = (status: string) => {
    switch (status) {
      case 'success': return 'text-green-400';
      case 'error': return 'text-red-400';
      default: return 'text-gray-300';
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate('/')} className="text-gray-400 hover:text-white">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Retour
            </Button>
            <h1 className="text-2xl font-bold">Monitoring Temps Réel</h1>
          </div>
          <div className="flex gap-2">
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
            <CardHeader>
              <CardTitle className="text-lg text-gray-100">File d'attente</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden p-0">
              <ScrollArea className="h-full">
                <div className="divide-y divide-gray-800">
                  {queue.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setSelectedId(item.id)}
                      className={`w-full text-left p-4 hover:bg-gray-800 transition-colors flex items-center justify-between ${
                        selectedId === item.id ? 'bg-gray-800 border-l-2 border-blue-500' : ''
                      }`}
                    >
                      <div className="overflow-hidden">
                        <div className="flex items-center gap-2 mb-1">
                          <div className={`w-2 h-2 rounded-full ${getStatusColor(item.status)}`} />
                          <span className="text-xs font-mono text-gray-500 uppercase">{item.status}</span>
                        </div>
                        <p className="text-sm text-gray-300 truncate font-mono">
                          {/* On ne peut pas décrypter l'URL côté client, on affiche l'ID ou un placeholder */}
                          Task {item.id.slice(0, 8)}...
                        </p>
                        <p className="text-xs text-gray-600 mt-1">
                          {new Date(item.added_at).toLocaleTimeString()}
                        </p>
                      </div>
                      {item.status === 'processing' && <Loader2 className="h-4 w-4 animate-spin text-blue-500" />}
                      {item.status === 'completed' && <CheckCircle className="h-4 w-4 text-green-500" />}
                      {item.status === 'failed' && <XCircle className="h-4 w-4 text-red-500" />}
                      {item.status === 'pending' && <Clock className="h-4 w-4 text-yellow-600" />}
                    </button>
                  ))}
                  {queue.length === 0 && (
                    <div className="p-8 text-center text-gray-500">
                      File d'attente vide
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Console de logs */}
          <Card className="lg:col-span-2 bg-black border-gray-800 font-mono flex flex-col">
            <CardHeader className="border-b border-gray-800 bg-gray-900/50">
              <div className="flex items-center gap-2">
                <Terminal className="h-4 w-4 text-green-500" />
                <CardTitle className="text-sm text-gray-300">
                  {selectedId ? `Logs: ${selectedId}` : 'Sélectionnez une tâche pour voir les logs'}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden p-4">
              <ScrollArea className="h-full">
                <div className="space-y-2">
                  {logs.map((log) => (
                    <div key={log.id} className="flex gap-3 text-sm animate-in fade-in slide-in-from-left-2 duration-300">
                      <span className="text-gray-600 shrink-0">
                        [{new Date(log.created_at).toLocaleTimeString()}]
                      </span>
                      <span className="text-blue-500 font-bold shrink-0 w-24">
                        {log.step}
                      </span>
                      <span className={`${getLogColor(log.status)} break-all`}>
                        {log.message}
                      </span>
                    </div>
                  ))}
                  {!selectedId && (
                    <div className="h-full flex items-center justify-center text-gray-600">
                      <div className="text-center">
                        <Terminal className="h-12 w-12 mx-auto mb-4 opacity-20" />
                        <p>En attente de sélection...</p>
                      </div>
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