import { useState } from 'react';
import { Plus, Play, Loader2, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { showSuccess, showError } from '@/utils/toast';
import { useNavigate } from 'react-router-dom';

const CrawlManager = () => {
  const [url, setUrl] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const navigate = useNavigate();

  const handleAddUrl = async () => {
    if (!url.trim()) {
      showError('Veuillez entrer une URL valide');
      return;
    }

    try {
      setIsAdding(true);
      
      // Appel à la fonction add-to-queue qui chiffre et insère (très rapide)
      const response = await fetch('https://asctcqyupjwjifxidegq.supabase.co/functions/v1/add-to-queue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFzY3RjcXl1cGp3amlmeGlkZWdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMxNjU1ODEsImV4cCI6MjA3ODc0MTU4MX0.JUAXZaLsixxqQ2-hNzgZhmViVvA8aiDbL-3IOquanrs`,
        },
        body: JSON.stringify({ url, priority: 1 }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Erreur HTTP ${response.status}`);
      }

      showSuccess('URL ajoutée à la file d\'attente sécurisée !');
      
      // Déclenchement asynchrone du processeur (Fire & Forget)
      fetch('https://asctcqyupjwjifxidegq.supabase.co/functions/v1/process-queue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFzY3RjcXl1cGp3amlmeGlkZWdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMxNjU1ODEsImV4cCI6MjA3ODc0MTU4MX0.JUAXZaLsixxqQ2-hNzgZhmViVvA8aiDbL-3IOquanrs`,
        },
        body: JSON.stringify({ batchSize: 5 }),
      }).catch(err => console.error("Trigger process failed", err));

      setUrl('');
    } catch (error) {
      console.error('Error adding URL:', error);
      showError(`Erreur: ${error.message}`);
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gestion du Crawling Sécurisé</CardTitle>
        <CardDescription>
          Ajoutez des URLs à crawler. Le traitement est asynchrone et sécurisé.
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
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isAdding && url.trim()) {
                  handleAddUrl();
                }
              }}
            />
            <Button 
              onClick={handleAddUrl} 
              disabled={isAdding || !url.trim()}
              className="whitespace-nowrap"
            >
              {isAdding ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Ajout...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Ajouter à la file
                </>
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Les URLs sont chiffrées avant d'être stockées.
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