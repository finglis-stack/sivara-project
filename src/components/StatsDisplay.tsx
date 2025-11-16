import { useEffect, useState } from 'react';
import { Database, Globe, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';

interface Stats {
  totalPages: number;
  totalDomains: number;
  lastCrawl: string | null;
}

const StatsDisplay = () => {
  const [stats, setStats] = useState<Stats>({
    totalPages: 0,
    totalDomains: 0,
    lastCrawl: null,
  });

  useEffect(() => {
    const fetchStats = async () => {
      const { data: statsData } = await supabase
        .from('crawl_stats')
        .select('*')
        .single();

      const { count: pagesCount } = await supabase
        .from('crawled_pages')
        .select('*', { count: 'exact', head: true });

      const { data: domainsData } = await supabase
        .from('crawled_pages')
        .select('domain');

      const uniqueDomains = new Set(domainsData?.map(d => d.domain) || []).size;

      setStats({
        totalPages: pagesCount || 0,
        totalDomains: uniqueDomains,
        lastCrawl: statsData?.last_crawl_at || null,
      });
    };

    fetchStats();

    // Rafraîchir toutes les 30 secondes
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Jamais';
    const date = new Date(dateString);
    return date.toLocaleString('fr-FR');
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Pages Indexées</CardTitle>
          <Database className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.totalPages}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Domaines</CardTitle>
          <Globe className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.totalDomains}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Dernier Crawl</CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-sm font-medium">{formatDate(stats.lastCrawl)}</div>
        </CardContent>
      </Card>
    </div>
  );
};

export default StatsDisplay;