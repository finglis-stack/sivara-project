import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle, XCircle, Clock, ArrowLeft, Activity, OctagonAlert, PlayCircle, Zap, Link2, Link2Off, X, ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { showSuccess, showError } from '@/utils/toast';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

interface QueueItem {
  id: string;
  url: string;
  display_url: string;
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

const STATUS_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  pending:    { bg: 'bg-amber-50',  text: 'text-amber-700',  dot: 'bg-amber-400' },
  processing: { bg: 'bg-blue-50',   text: 'text-blue-700',   dot: 'bg-blue-500' },
  completed:  { bg: 'bg-green-50',  text: 'text-green-700',  dot: 'bg-green-500' },
  failed:     { bg: 'bg-red-50',    text: 'text-red-700',    dot: 'bg-red-500' },
};

const LOG_COLORS: Record<string, string> = {
  'INIT': 'text-gray-500 bg-gray-50 border-gray-200',
  'PARSING': 'text-indigo-600 bg-indigo-50 border-indigo-200',
  'GEMINI': 'text-purple-600 bg-purple-50 border-purple-200',
  'ENCRYPTION': 'text-slate-600 bg-slate-50 border-slate-200',
  'DISCOVERY': 'text-cyan-600 bg-cyan-50 border-cyan-200',
  'COMPLETE': 'text-green-600 bg-green-50 border-green-200',
  'ERROR': 'text-red-600 bg-red-50 border-red-200',
};

const Monitor = () => {
  const navigate = useNavigate();
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [isActive, setIsActive] = useState(true);
  const [isDiscoveryEnabled, setIsDiscoveryEnabled] = useState(true);
  const [isToggling, setIsToggling] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  // --- DATA FETCHING ---
  const fetchSettings = useCallback(async () => {
    const { data } = await supabase
      .from('crawler_settings')
      .select('is_active, discovery_enabled')
      .eq('id', 1)
      .single();
    if (data) {
      setIsActive(data.is_active);
      setIsDiscoveryEnabled(data.discovery_enabled !== false);
    }
  }, []);

  const fetchQueue = useCallback(async () => {
    const { data } = await supabase
      .from('crawl_queue')
      .select('id, url, display_url, status, added_at, error_message')
      .order('added_at', { ascending: false })
      .limit(2000);
    
    if (data) {
      setQueue(prev => {
        // Only update if data actually changed
        if (prev.length === data.length && prev[0]?.id === data[0]?.id && prev[0]?.status === data[0]?.status) return prev;
        return data;
      });
    }
  }, []);

  const fetchLogs = useCallback(async (id: string) => {
    const { data } = await supabase
      .from('crawl_logs')
      .select('*')
      .eq('queue_id', id)
      .order('created_at', { ascending: true });
    if (data) {
      setLogs(data);
      setTimeout(() => logsEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  }, []);

  // --- WATCHDOG ---
  useEffect(() => {
    const watchdog = setInterval(() => {
      if (!isActive) return;
      const pending = queue.filter(i => i.status === 'pending').length;
      const processing = queue.filter(i => i.status === 'processing').length;
      if (pending > 0 && processing === 0) {
        triggerProcessQueue();
      }
    }, 5000);
    return () => clearInterval(watchdog);
  }, [queue, isActive]);

  const triggerProcessQueue = useCallback(async () => {
    fetch('https://asctcqyupjwjifxidegq.supabase.co/functions/v1/process-queue', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFzY3RjcXl1cGp3amlmeGlkZWdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMxNjU1ODEsImV4cCI6MjA3ODc0MTU4MX0.JUAXZaLsixxqQ2-hNzgZhmViVvA8aiDbL-3IOquanrs`,
      },
      body: JSON.stringify({ batchSize: 5 }),
    }).catch(err => console.error("Watchdog trigger failed", err));
  }, []);

  // --- SUBSCRIPTIONS ---
  useEffect(() => {
    fetchSettings();
    fetchQueue();

    const settingsChannel = supabase.channel('settings_mon')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'crawler_settings' }, (payload) => {
        setIsActive(payload.new.is_active);
        if (payload.new.discovery_enabled !== undefined) setIsDiscoveryEnabled(payload.new.discovery_enabled);
      })
      .subscribe();

    const queueChannel = supabase.channel('queue_mon')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'crawl_queue' }, () => {
        fetchQueue();
      })
      .subscribe();

    const interval = setInterval(() => { fetchQueue(); fetchSettings(); }, 5000);

    return () => {
      supabase.removeChannel(settingsChannel);
      supabase.removeChannel(queueChannel);
      clearInterval(interval);
    };
  }, []);

  // --- LOG SUBSCRIPTION ---
  useEffect(() => {
    if (!selectedId) { setLogs([]); return; }
    fetchLogs(selectedId);

    const logsChannel = supabase.channel(`logs_mon:${selectedId}`)
      .on('postgres_changes', { 
        event: 'INSERT', schema: 'public', table: 'crawl_logs',
        filter: `queue_id=eq.${selectedId}`
      }, (payload) => {
        setLogs(prev => {
          const newLogs = [...prev, payload.new as LogItem];
          setTimeout(() => logsEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
          return newLogs;
        });
      })
      .subscribe();

    const logInterval = setInterval(() => {
      if (queue.find(q => q.id === selectedId)?.status === 'processing') fetchLogs(selectedId);
    }, 2000);

    return () => { supabase.removeChannel(logsChannel); clearInterval(logInterval); };
  }, [selectedId]);

  // --- ACTIONS ---
  const toggleSystem = async () => {
    try {
      setIsToggling(true);
      const newState = !isActive;
      const { error } = await supabase.from('crawler_settings').update({ is_active: newState }).eq('id', 1);
      if (error) throw error;
      if (newState) { showSuccess('Système relancé.'); triggerProcessQueue(); } 
      else { showSuccess("Arrêt du système (Pause)."); }
      fetchSettings();
    } catch (err: any) { showError(err.message); }
    finally { setIsToggling(false); }
  };

  const toggleDiscovery = async (checked: boolean) => {
    try {
      const { error } = await supabase.from('crawler_settings').update({ discovery_enabled: checked }).eq('id', 1);
      if (error) throw error;
      setIsDiscoveryEnabled(checked);
      showSuccess(checked ? 'Mode Découverte activé' : 'Mode Découverte désactivé');
    } catch { setIsDiscoveryEnabled(!checked); }
  };

  // --- COMPUTED ---
  const stats = useMemo(() => ({
    pending: queue.filter(i => i.status === 'pending').length,
    processing: queue.filter(i => i.status === 'processing').length,
    completed: queue.filter(i => i.status === 'completed').length,
    failed: queue.filter(i => i.status === 'failed').length,
    total: queue.length,
  }), [queue]);

  const getDisplayUrl = (item: QueueItem) => {
    if (item.display_url) return item.display_url;
    // Fallback: show truncated encrypted blob
    return item.url?.substring(0, 40) + '...' || item.id.substring(0, 12);
  };

  const selectedItem = useMemo(() => queue.find(q => q.id === selectedId), [queue, selectedId]);

  return (
    <div className="h-screen flex flex-col bg-[#0f1117] text-gray-200 font-sans overflow-hidden">
      {/* ── Header Bar ── */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#161822] border-b border-gray-800/60 flex-shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="text-gray-400 hover:text-white hover:bg-white/5 rounded px-2 h-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="h-5 w-px bg-gray-700" />
          <h1 className="text-sm font-bold text-white tracking-wide">SIVARA MONITOR</h1>
          <Badge className={`text-[10px] px-2 py-0.5 rounded font-bold border-0 ${isActive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
            {isActive ? '● LIVE' : '■ PAUSED'}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          {/* Stats pills */}
          <div className="hidden md:flex items-center gap-1.5 mr-2">
            <span className="text-[10px] font-mono bg-blue-500/15 text-blue-400 px-2 py-1 rounded">{stats.processing} active</span>
            <span className="text-[10px] font-mono bg-amber-500/15 text-amber-400 px-2 py-1 rounded">{stats.pending} pending</span>
            <span className="text-[10px] font-mono bg-green-500/15 text-green-400 px-2 py-1 rounded">{stats.completed} done</span>
            <span className="text-[10px] font-mono bg-red-500/15 text-red-400 px-2 py-1 rounded">{stats.failed} err</span>
            <span className="text-[10px] font-mono bg-white/5 text-gray-400 px-2 py-1 rounded">{stats.total} total</span>
          </div>

          <div className="flex items-center gap-1.5 bg-white/5 px-2.5 py-1.5 rounded border border-gray-700/50">
            <Switch id="disc" checked={isDiscoveryEnabled} onCheckedChange={toggleDiscovery} className="scale-75" />
            <Label htmlFor="disc" className="text-[10px] font-medium text-gray-400 cursor-pointer select-none">
              {isDiscoveryEnabled ? <Link2 className="h-3 w-3 inline text-blue-400" /> : <Link2Off className="h-3 w-3 inline text-gray-500" />}
            </Label>
          </div>

          {stats.pending > 0 && (
            <Button size="sm" variant="ghost" onClick={triggerProcessQueue} className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 h-8 text-xs">
              <Zap className="h-3 w-3 mr-1" /> Forcer
            </Button>
          )}
          <Button size="sm" onClick={toggleSystem} disabled={isToggling}
            className={`h-8 text-xs font-bold rounded ${isActive ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30' : 'bg-green-500/20 text-green-400 hover:bg-green-500/30 border border-green-500/30'}`}>
            {isToggling ? <Loader2 className="h-3 w-3 animate-spin" /> : isActive ? <><OctagonAlert className="h-3 w-3 mr-1" /> STOP</> : <><PlayCircle className="h-3 w-3 mr-1" /> START</>}
          </Button>
        </div>
      </div>

      {/* ── Main Content ── */}
      <div className="flex-1 flex overflow-hidden">
        {/* ── Table (Excel-style) ── */}
        <div className={`flex-1 flex flex-col overflow-hidden transition-all ${selectedId ? 'lg:w-[60%]' : 'w-full'}`}>
          {/* Table Header */}
          <div className="grid grid-cols-[60px_1fr_100px_100px_80px] gap-px bg-[#1a1d2b] border-b border-gray-800/60 text-[10px] font-bold text-gray-500 uppercase tracking-wider flex-shrink-0">
            <div className="px-3 py-2">#</div>
            <div className="px-3 py-2">URL</div>
            <div className="px-3 py-2 text-center">Status</div>
            <div className="px-3 py-2 text-center">Heure</div>
            <div className="px-3 py-2 text-center">Erreur</div>
          </div>

          {/* Table Body — Virtualized-style with overflow */}
          <div className="flex-1 overflow-y-auto" ref={tableRef}>
            {queue.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-3">
                <Clock className="h-8 w-8 text-gray-600" />
                <p className="text-sm">File d'attente vide</p>
              </div>
            ) : queue.map((item, idx) => {
              const colors = STATUS_COLORS[item.status] || STATUS_COLORS.pending;
              const isSelected = selectedId === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setSelectedId(isSelected ? null : item.id)}
                  className={`w-full grid grid-cols-[60px_1fr_100px_100px_80px] gap-px text-left transition-colors duration-100 border-b border-gray-800/30 group
                    ${isSelected ? 'bg-blue-500/10 border-l-2 border-l-blue-500' : 'bg-transparent hover:bg-white/[0.02] border-l-2 border-l-transparent'}
                    ${item.status === 'processing' ? 'bg-blue-500/5' : ''}
                  `}
                >
                  <div className="px-3 py-2 text-[11px] font-mono text-gray-600">{idx + 1}</div>
                  <div className="px-3 py-2 text-[12px] font-mono text-gray-300 truncate" title={getDisplayUrl(item)}>
                    {getDisplayUrl(item)}
                  </div>
                  <div className="px-3 py-2 flex justify-center">
                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded ${colors.bg} ${colors.text}`}>
                      {item.status === 'processing' && <Loader2 className="h-2.5 w-2.5 animate-spin" />}
                      {item.status === 'completed' && <CheckCircle className="h-2.5 w-2.5" />}
                      {item.status === 'failed' && <XCircle className="h-2.5 w-2.5" />}
                      {item.status === 'pending' && <Clock className="h-2.5 w-2.5" />}
                      {item.status}
                    </span>
                  </div>
                  <div className="px-3 py-2 text-[11px] font-mono text-gray-500 text-center">
                    {new Date(item.added_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </div>
                  <div className="px-3 py-2 text-center">
                    {item.error_message && (
                      <span className="text-[10px] text-red-400 font-mono truncate block" title={item.error_message}>
                        ⚠
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Log Panel (Slide-in) ── */}
        {selectedId && (
          <div className="w-full lg:w-[40%] flex flex-col bg-[#12141e] border-l border-gray-800/60 overflow-hidden">
            {/* Panel Header */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-[#161822] border-b border-gray-800/60 flex-shrink-0">
              <div className="flex items-center gap-2 overflow-hidden">
                <Activity className="h-3.5 w-3.5 text-blue-400 flex-shrink-0" />
                <span className="text-xs font-bold text-white truncate">CONSOLE</span>
                {selectedItem && (
                  <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${STATUS_COLORS[selectedItem.status]?.bg} ${STATUS_COLORS[selectedItem.status]?.text}`}>
                    {selectedItem.status}
                  </span>
                )}
              </div>
              <Button variant="ghost" size="sm" onClick={() => setSelectedId(null)} className="text-gray-500 hover:text-white h-6 w-6 p-0 hover:bg-white/5">
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>

            {/* URL display */}
            {selectedItem && (
              <div className="px-4 py-2 bg-[#0d0f16] border-b border-gray-800/40 flex-shrink-0">
                <p className="text-[11px] font-mono text-blue-400 truncate">{getDisplayUrl(selectedItem)}</p>
                <p className="text-[9px] font-mono text-gray-600 mt-0.5">ID: {selectedId}</p>
              </div>
            )}

            {/* Logs */}
            <div className="flex-1 overflow-y-auto p-3 space-y-1">
              {logs.length === 0 && (
                <div className="flex items-center justify-center h-20 text-gray-500 text-xs">
                  <Loader2 className="h-3 w-3 animate-spin mr-2" /> Attente de logs...
                </div>
              )}
              {logs.map((log) => (
                <div key={log.id} className="flex items-start gap-2 py-1 animate-in fade-in duration-200">
                  <span className="text-[9px] font-mono text-gray-600 pt-0.5 flex-shrink-0 w-10 text-right">
                    {new Date(log.created_at).toLocaleTimeString([], { minute: '2-digit', second: '2-digit' })}
                  </span>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border flex-shrink-0 ${LOG_COLORS[log.step] || 'text-gray-400 bg-gray-800 border-gray-700'}`}>
                    {log.step}
                  </span>
                  <span className={`text-[11px] font-mono break-all ${log.status === 'error' ? 'text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded' : 'text-gray-400'}`}>
                    {log.message}
                  </span>
                </div>
              ))}
              <div ref={logsEndRef} className="h-px" />
            </div>

            {/* Error display */}
            {selectedItem?.error_message && (
              <div className="px-4 py-3 bg-red-500/10 border-t border-red-500/20 flex-shrink-0">
                <p className="text-[10px] font-bold text-red-400 uppercase mb-1">Fatal Error</p>
                <p className="text-[11px] font-mono text-red-300">{selectedItem.error_message}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Monitor;