import { useState } from 'react';
import { Plus, Play, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { showSuccess, showError } from '@/utils/toast';

const CrawlManager = () => {
  const [url, setUrl] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleAddUrl = async () => {
    if (!url.trim()) {
      showError('Veuillez entrer une URL valide');
      return;
    }

    try {
      setIsAdding(true);
      
      const response = await fetch('https://asctcqyupjwjifxidegq.supabase.co/functions/v1/crawl-page', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFzY3RjcXl1cGp3amlmeGlkZWdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMxNjU1ODEsImV4cCI6MjA3ODc0MTU4MX0.JUAXZaLsixxqQ2-hNzgZhmViVvA8aiDbL-3IOquanrs`,
        },
        body: JSON.stringify({ url, maxDepth: 1 }),
      });

      if (!response.ok) {
        throw new Error('Erreur lors du crawling');
      }

      const data = await response.json();
      showSuccess(`Page crawlée avec succès: ${data.title}`);
      setUrl('');
    } catch (error) {
      console.error('Error adding URL:', error);
      showError('Erreur lors de l\'ajout de l\'URL');
    } finally {
      setIsAdding(false);
    }
  };

  const handleProcessQueue = async () => {
    try {
      setIsProcessing(true);
      
      const response = await fetch('https://asctcqyupjwjifxidegq.supabase.co/functions/v1/process-queue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFzY3RjcXl1cGp3amlmeGlkZWdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMxNjU1ODEsImV4cCI6MjA3ODc0MTU4MX0.JUAXZaLsixxqQ2-hNzgZhmViVvA8aiDbL-3IOquanrs`,
        },
        body: JSON.stringify({ batchSize: 5 }),
      });

      if (!response.ok) {
        throw new Error('Erreur lors du traitement de la queue');
      }

      const data = await response.json();
      showSuccess(`${data.processed} pages traitées`);
    } catch (error) {
      console.error('Error processing queue:', error);
      showError('Erreur lors du traitement de la queue');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gestion du Crawling</CardTitle>
        <CardDescription>
          Ajoutez des URLs à crawler et gérez la file d'attente
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="url">URL à crawler</Label>
          <div className="flex gap-2">
            <Input
              id="url"
              type="url"
              placeholder="https://example.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={isAdding}
            />
            <Button 
              onClick={handleAddUrl} 
              disabled={isAdding || !url.trim()}
              className="whitespace-nowrap"
            >
              {isAdding ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Crawling...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Crawler
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="pt-4 border-t">
          <Button 
            onClick={handleProcessQueue} 
            disabled={isProcessing}
            variant="secondary"
            className="w-full"
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Traitement en cours...
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                Traiter la file d'attente
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default CrawlManager;