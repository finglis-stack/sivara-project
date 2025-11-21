import { useState, useRef } from 'react';
import { Plus, Play, Loader2, Activity, Upload, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { showSuccess, showError } from '@/utils/toast';
import { useNavigate } from 'react-router-dom';

const CrawlManager = () => {
  const [url, setUrl] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [importProgress, setImportProgress] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const addToQueue = async (urlToAdd: string): Promise<boolean> => {
    try {
      const response = await fetch('https://asctcqyupjwjifxidegq.supabase.co/functions/v1/add-to-queue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFzY3RjcXl1cGp3amlmeGlkZWdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMxNjU1ODEsImV4cCI6MjA3ODc0MTU4MX0.JUAXZaLsixxqQ2-hNzgZhmViVvA8aiDbL-3IOquanrs`,
        },
        body: JSON.stringify({ url: urlToAdd, priority: 1 }),
      });

      if (!response.ok) throw new Error('Failed');
      return true;
    } catch (e) {
      return false;
    }
  };

  const triggerProcess = () => {
    fetch('https://asctcqyupjwjifxidegq.supabase.co/functions/v1/process-queue', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFzY3RjcXl1cGp3amlmeGlkZWdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMxNjU1ODEsImV4cCI6MjA3ODc0MTU4MX0.JUAXZaLsixxqQ2-hNzgZhmViVvA8aiDbL-3IOquanrs`,
      },
      body: JSON.stringify({ batchSize: 5 }),
    }).catch(err => console.error("Trigger process failed", err));
  };

  const handleAddUrl = async () => {
    if (!url.trim()) {
      showError('Veuillez entrer une URL valide');
      return;
    }

    try {
      setIsAdding(true);
      const success = await addToQueue(url);
      if (success) {
        showSuccess('URL ajoutée à la file d\'attente sécurisée !');
        triggerProcess();
        setUrl('');
      } else {
        showError('Erreur lors de l\'ajout');
      }
    } catch (error) {
      console.error('Error adding URL:', error);
    } finally {
      setIsAdding(false);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsAdding(true);
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      const text = e.target.result as string;
      // Divise par ligne, enlève les espaces, filtre les lignes vides et celles qui ne sont pas des URLs
      const urls = text
        .split(/[\r\n]+/)
        .map(line => line.trim())
        .map(line => line.split(',')[0]) // Prend la première colonne si CSV
        .filter(line => line.startsWith('http'));

      if (urls.length === 0) {
        showError("Aucune URL valide trouvée dans le fichier");
        setIsAdding(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }

      let successCount = 0;
      
      for (let i = 0; i < urls.length; i++) {
        setImportProgress(`${i + 1}/${urls.length}`);
        const success = await addToQueue(urls[i]);
        if (success) successCount++;
      }

      showSuccess(`${successCount} URLs importées sur ${urls.length}`);
      triggerProcess();
      
      setImportProgress(null);
      setIsAdding(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    };

    reader.readAsText(file);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gestion du Crawling Sécurisé</CardTitle>
        <CardDescription>
          Ajoutez des URLs manuellement ou importez un fichier CSV (une URL par ligne).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="url">Ajout rapide</Label>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex-1 flex gap-2">
                <Input
                id="url"
                type="url"
                placeholder="https://example.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={isAdding}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && !isAdding && url.trim()) {
                    handleAddUrl();
                    }
                }}
                className="flex-1"
                />
                <Button 
                onClick={handleAddUrl} 
                disabled={isAdding || !url.trim()}
                className="whitespace-nowrap bg-gray-900 hover:bg-gray-800"
                >
                {isAdding && !importProgress ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                    <Plus className="h-4 w-4" />
                )}
                </Button>
            </div>

            <div className="relative">
                <input
                    type="file"
                    accept=".csv,.txt"
                    ref={fileInputRef}
                    className="hidden"
                    onChange={handleFileUpload}
                    disabled={isAdding}
                />
                <Button
                    variant="secondary"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isAdding}
                    className="w-full sm:w-auto whitespace-nowrap"
                >
                    {importProgress ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            {importProgress}
                        </>
                    ) : (
                        <>
                            <FileSpreadsheet className="mr-2 h-4 w-4" />
                            Import CSV
                        </>
                    )}
                </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Format CSV accepté : liste simple d'URLs ou URLs en première colonne.
          </p>
        </div>

        <div className="pt-4 border-t flex gap-3">
          <Button 
            onClick={() => navigate('/monitor')}
            variant="outline"
            className="w-full"
          >
            <Activity className="mr-2 h-4 w-4" />
            Ouvrir le Monitoring Live
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default CrawlManager;