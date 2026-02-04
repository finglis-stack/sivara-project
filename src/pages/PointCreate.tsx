import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { encryptionService } from '@/lib/encryption';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Presentation } from 'lucide-react';
import { showError, showSuccess } from '@/utils/toast';

type PointDocV1 = {
  version: 1;
  slides: Array<{
    id: string;
    name: string;
    background: { type: 'solid'; color: string };
    elements: Array<any>;
  }>;
};

const buildInitialPoint = (): PointDocV1 => ({
  version: 1,
  slides: [
    {
      id: crypto.randomUUID(),
      name: 'Slide 1',
      background: { type: 'solid', color: '#0B1220' },
      elements: [
        {
          id: crypto.randomUUID(),
          type: 'text',
          x: 0.08,
          y: 0.18,
          w: 0.84,
          h: 0.18,
          text: 'Nouveau Point',
          style: {
            fontSize: 56,
            fontWeight: 700,
            color: '#FFFFFF',
            align: 'center',
          },
        },
        {
          id: crypto.randomUUID(),
          type: 'text',
          x: 0.14,
          y: 0.42,
          w: 0.72,
          h: 0.14,
          text: 'Cliquez sur “Éditer” pour ajouter des slides, images et boutons.',
          style: {
            fontSize: 20,
            fontWeight: 400,
            color: '#CBD5E1',
            align: 'center',
          },
        },
      ],
    },
  ],
});

export default function PointCreate() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [searchParams] = useSearchParams();
  const parentId = useMemo(() => searchParams.get('folder'), [searchParams]);

  const [title, setTitle] = useState('Nouveau Point');
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (!user) return;
    encryptionService.initialize(user.id).catch(() => {
      showError("Impossible d'initialiser le chiffrement");
    });
  }, [user]);

  const createPoint = async () => {
    if (!user) return;
    setIsCreating(true);
    try {
      await encryptionService.initialize(user.id);

      const point = buildInitialPoint();
      // Synchroniser le titre avec la slide 1 (optionnel mais agréable)
      const firstSlideTitle = point.slides[0]?.elements?.find((e: any) => e.type === 'text');
      if (firstSlideTitle) firstSlideTitle.text = title.trim() || 'Nouveau Point';

      const plaintextTitle = title.trim() || 'Nouveau Point';
      const plaintextContent = JSON.stringify(point);

      const { encrypted: encryptedTitle, iv } = await encryptionService.encrypt(plaintextTitle);
      const { encrypted: encryptedContent } = await encryptionService.encrypt(plaintextContent, iv);

      const { data, error } = await supabase
        .from('documents')
        .insert({
          title: encryptedTitle,
          content: encryptedContent,
          owner_id: user.id,
          is_starred: false,
          encryption_iv: iv,
          icon: 'Presentation',
          color: '#F97316',
          type: 'point',
          visibility: 'private',
          public_permission: 'read',
          parent_id: parentId,
        })
        .select('id')
        .single();

      if (error) throw error;

      showSuccess('Point créé');

      const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      if (isLocal) {
        navigate(`/point/${data.id}?app=docs`);
      } else {
        window.location.href = `https://docs.sivara.ca/point/${data.id}`;
      }
    } catch (e: any) {
      console.error(e);
      showError('Erreur lors de la création');
    } finally {
      setIsCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-sm text-gray-500">Chargement...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Connexion requise</CardTitle>
            <CardDescription>Connectez-vous pour créer un Point sécurisé.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => (window.location.href = 'https://account.sivara.ca/login')} className="w-full">
              Se connecter
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-[env(safe-area-inset-top)]">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="container mx-auto px-4 lg:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/?app=docs' + (parentId ? `&folder=${parentId}` : ''))}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-lg bg-orange-600 text-white flex items-center justify-center">
                <Presentation className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm text-gray-500">Création</div>
                <div className="text-lg font-medium text-gray-900">Nouveau Point</div>
              </div>
            </div>
          </div>
          <Button onClick={createPoint} disabled={isCreating} className="bg-gray-900 hover:bg-black text-white">
            {isCreating ? 'Création…' : 'Créer'}
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 lg:px-6 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          <Card>
            <CardHeader>
              <CardTitle>Première page</CardTitle>
              <CardDescription>Donnez un titre à votre présentation. Tout est chiffré côté client.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Titre</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Pitch Deck" />
              </div>
              <div className="text-xs text-gray-500">
                Ensuite, vous pourrez : ajouter des slides, insérer des images, et créer des boutons qui naviguent entre pages.
              </div>
              <Button onClick={createPoint} disabled={isCreating} className="w-full bg-orange-600 hover:bg-orange-700 text-white">
                {isCreating ? 'Création…' : 'Créer et ouvrir'}
              </Button>
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle>Aperçu</CardTitle>
              <CardDescription>Format 16:9</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="w-full aspect-video rounded-lg bg-[#0B1220] border border-black/10 shadow-sm relative overflow-hidden">
                <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center">
                  <div className="text-white text-3xl sm:text-5xl font-bold leading-tight">
                    {title.trim() || 'Nouveau Point'}
                  </div>
                  <div className="mt-4 text-slate-300 text-sm sm:text-base max-w-md">
                    Slides • Images • Boutons de navigation
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
