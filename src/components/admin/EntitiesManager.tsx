import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Trash2, Plus, Edit2, CheckCircle2, X } from 'lucide-react';
import { toast } from 'sonner';

export interface SearchEntity {
  id: string;
  name: string;
  phonetic: string | null;
  description: string | null;
  logo_url: string | null;
  cover_url: string | null;
  website_url: string | null;
  wikipedia_url: string | null;
  keywords: string[];
  priority: number;
}

const EntitiesManager = () => {
  const [entities, setEntities] = useState<SearchEntity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState<string | null>(null);
  
  // Form state
  const [formData, setFormData] = useState<Partial<SearchEntity>>({
    name: '',
    phonetic: '',
    description: '',
    logo_url: '',
    cover_url: '',
    website_url: '',
    wikipedia_url: '',
    keywords: [],
    priority: 0,
  });
  const [keywordsInput, setKeywordsInput] = useState('');

  useEffect(() => {
    fetchEntities();
  }, []);

  const fetchEntities = async () => {
    try {
      const { data, error } = await supabase
        .from('search_entities')
        .select('*')
        .order('priority', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setEntities(data || []);
    } catch (error: any) {
      toast.error('Erreur lors du chargement des entités:', error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const payload = {
        ...formData,
        keywords: keywordsInput.split(',').map(k => k.trim()).filter(k => k !== '')
      };

      if (!payload.name) {
        toast.error('Le nom est requis');
        return;
      }

      if (isEditing) {
        const { error } = await supabase
          .from('search_entities')
          .update(payload)
          .eq('id', isEditing);
        if (error) throw error;
        toast.success("Entité mise à jour");
      } else {
        const { error } = await supabase
          .from('search_entities')
          .insert([payload]);
        if (error) throw error;
        toast.success("Entité créée");
      }

      resetForm();
      fetchEntities();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Supprimer cette entité définitivement ?")) return;
    try {
      const { error } = await supabase.from('search_entities').delete().eq('id', id);
      if (error) throw error;
      toast.success("Entité supprimée");
      fetchEntities();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const startEdit = (entity: SearchEntity) => {
    setIsEditing(entity.id);
    setFormData(entity);
    setKeywordsInput(entity.keywords.join(', '));
  };

  const resetForm = () => {
    setIsEditing(null);
    setFormData({
      name: '', phonetic: '', description: '', logo_url: '',
      cover_url: '', website_url: '', wikipedia_url: '', priority: 0
    });
    setKeywordsInput('');
  };

  if (isLoading) return <div className="p-8">Chargement...</div>;

  return (
    <div className="p-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-5xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-[#111111]">Gestion des Entités (Knowledge Panels)</h1>
        <p className="text-gray-500 mt-2">Créez et modifiez les "cartes de savoir" qui s'affichent lors d'une recherche exacte.</p>
      </div>

      {/* Formulaire */}
      <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm space-y-4">
        <h2 className="text-xl font-semibold">{isEditing ? 'Modifier une entité' : 'Ajouter une entité'}</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Nom *</Label>
            <Input value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="ex: Sivara" />
          </div>
          <div className="space-y-2">
            <Label>Phonétique</Label>
            <Input value={formData.phonetic || ''} onChange={e => setFormData({...formData, phonetic: e.target.value})} placeholder="ex: /si.va.ʁa/" />
          </div>
          
          <div className="space-y-2 md:col-span-2">
            <Label>Description</Label>
            <Textarea value={formData.description || ''} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="Brève description de l'entité..." rows={3} />
          </div>

          <div className="space-y-2">
            <Label>URL du Logo (Image carrée)</Label>
            <Input value={formData.logo_url || ''} onChange={e => setFormData({...formData, logo_url: e.target.value})} placeholder="https://..." />
          </div>
          <div className="space-y-2">
            <Label>URL de Couverture (Image large)</Label>
            <Input value={formData.cover_url || ''} onChange={e => setFormData({...formData, cover_url: e.target.value})} placeholder="https://..." />
          </div>

          <div className="space-y-2">
            <Label>Site Web Utile</Label>
            <Input value={formData.website_url || ''} onChange={e => setFormData({...formData, website_url: e.target.value})} placeholder="https://..." />
          </div>
          <div className="space-y-2">
            <Label>Lien Wikipédia / Wiki</Label>
            <Input value={formData.wikipedia_url || ''} onChange={e => setFormData({...formData, wikipedia_url: e.target.value})} placeholder="https://..." />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label>Mots-clés de déclenchement (séparés par des virgules)</Label>
            <Input value={keywordsInput} onChange={e => setKeywordsInput(e.target.value)} placeholder="ex: sivara, moteur de recherche, projet educatif" />
            <p className="text-xs text-gray-500">Si la recherche de l'utilisateur contient l'un de ces mots de façon exacte (ou forte), la carte s'affichera.</p>
          </div>
          
          <div className="space-y-2">
            <Label>Priorité (Plus grand = Plus prioritaire)</Label>
            <Input type="number" value={formData.priority || 0} onChange={e => setFormData({...formData, priority: parseInt(e.target.value) || 0})} />
          </div>
        </div>

        <div className="flex gap-2 justify-end mt-4">
          {isEditing && (
            <Button variant="outline" onClick={resetForm}>
              <X className="mr-2 h-4 w-4" /> Annuler
            </Button>
          )}
          <Button onClick={handleSave} className="bg-[#00236F] hover:bg-[#1e3a8a] text-white">
            <CheckCircle2 className="mr-2 h-4 w-4" /> {isEditing ? 'Enregistrer' : 'Créer'}
          </Button>
        </div>
      </div>

      {/* Liste experte */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Entité</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Mots-clés</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {entities.map(entity => (
              <tr key={entity.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    {entity.logo_url ? (
                      <img src={entity.logo_url} alt="" className="h-10 w-10 rounded-full bg-gray-100 object-cover" />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-[#00236F] text-white flex items-center justify-center font-bold">
                        {entity.name.substring(0, 1)}
                      </div>
                    )}
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900">{entity.name}</div>
                      <div className="text-sm text-gray-500">{entity.phonetic || '-'}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-1">
                    {entity.keywords.map((kw, i) => (
                      <span key={i} className="px-2 py-1 bg-blue-100 text-[#00236F] text-xs rounded-md">
                        {kw}
                      </span>
                    ))}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">Prio: {entity.priority}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <Button variant="ghost" size="icon" onClick={() => startEdit(entity)} className="text-blue-600 hover:text-blue-900">
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(entity.id)} className="text-red-600 hover:text-red-900 ml-2">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            ))}
            {entities.length === 0 && (
              <tr>
                <td colSpan={3} className="px-6 py-8 text-center text-gray-500 text-sm">
                  Aucune entité configurée pour l'instant.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default EntitiesManager;
