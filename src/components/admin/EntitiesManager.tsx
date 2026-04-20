import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Trash2, Plus, Edit2, CheckCircle2, X, Eye, EyeOff, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';

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
  is_public?: boolean;
  source?: string;
  created_at?: string;
}

const EntitiesManager = () => {
  const [entities, setEntities] = useState<SearchEntity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'queue' | 'all'>('queue');
  
  // State for quick queue edits
  const [quickUrls, setQuickUrls] = useState<Record<string, {logo: string, cover: string}>>({});
  
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
        .order('created_at', { ascending: true });

      if (error) throw error;
      setEntities(data || []);
    } catch (error: any) {
      toast.error('Erreur lors du chargement des entités:', error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickPublish = async (entityId: string) => {
    const urls = quickUrls[entityId] || { logo: '', cover: '' };
    if (!urls.logo || !urls.cover) {
      toast.error('Vous devez fournir le logo ET la couverture pour publier.');
      return;
    }

    try {
      const { error } = await supabase
        .from('search_entities')
        .update({ 
          logo_url: urls.logo,
          cover_url: urls.cover,
          is_public: true 
        })
        .eq('id', entityId);
      
      if (error) throw error;
      toast.success('Entité publiée avec succès !');
      // Clear quick inputs
      setQuickUrls(prev => {
        const next = { ...prev };
        delete next[entityId];
        return next;
      });
      fetchEntities();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const updateQuickUrl = (id: string, field: 'logo' | 'cover', value: string) => {
    setQuickUrls(prev => ({
      ...prev,
      [id]: { ...(prev[id] || { logo: '', cover: '' }), [field]: value }
    }));
  };

  const handleSave = async () => {
    try {
      const keywords = keywordsInput.split(',').map(k => k.trim()).filter(k => k !== '');
      const payload: any = {
        name: formData.name,
        phonetic: formData.phonetic || null,
        description: formData.description || null,
        logo_url: formData.logo_url || null,
        cover_url: formData.cover_url || null,
        website_url: formData.website_url || null,
        wikipedia_url: formData.wikipedia_url || null,
        keywords,
        priority: formData.priority || 0,
      };

      if (!payload.name) {
        toast.error('Le nom est requis');
        return;
      }

      if (isEditing && isEditing !== 'new') {
        const { error } = await supabase
          .from('search_entities')
          .update(payload)
          .eq('id', isEditing);
        if (error) throw error;
        toast.success("Entité mise à jour ✓");
      } else {
        const { error } = await supabase
          .from('search_entities')
          .insert([payload]);
        if (error) throw error;
        toast.success("Entité créée ✓");
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

  const handleTogglePublic = async (entity: SearchEntity) => {
    if (!entity.is_public) {
      if (!entity.logo_url || !entity.cover_url) {
        toast.error('Vous devez ajouter un logo ET une image de couverture avant de rendre cette entité publique.');
        return;
      }
    }
    try {
      const { error } = await supabase
        .from('search_entities')
        .update({ is_public: !entity.is_public })
        .eq('id', entity.id);
      if (error) throw error;
      toast.success(entity.is_public ? 'Entité rendue privée' : 'Entité rendue publique !');
      fetchEntities();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const formRef = useRef<HTMLDivElement>(null);

  const startEdit = (entity: SearchEntity) => {
    setIsEditing(entity.id);
    setFormData({
      name: entity.name,
      phonetic: entity.phonetic,
      description: entity.description,
      logo_url: entity.logo_url,
      cover_url: entity.cover_url,
      website_url: entity.website_url,
      wikipedia_url: entity.wikipedia_url,
      keywords: entity.keywords,
      priority: entity.priority,
    });
    setKeywordsInput(entity.keywords.join(', '));
    setActiveTab('all');
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

  const renderEditForm = () => (
    <div className="bg-blue-50/60 p-6 rounded-lg border border-blue-200 space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <Edit2 className="h-4 w-4 text-blue-600" />
        <span className="text-sm font-semibold text-blue-600">{isEditing && isEditing !== 'new' ? 'Modification en cours' : 'Nouvelle entité'}</span>
        {isEditing && isEditing !== 'new' && <span className="text-xs text-blue-400">ID: {isEditing}</span>}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-gray-600">Nom *</Label>
          <Input value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="ex: Sivara" className="text-sm" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-gray-600">Phonétique</Label>
          <Input value={formData.phonetic || ''} onChange={e => setFormData({...formData, phonetic: e.target.value})} placeholder="ex: /si.va.ʁa/" className="text-sm" />
        </div>
        <div className="space-y-1.5 md:col-span-2">
          <Label className="text-xs font-medium text-gray-600">Description</Label>
          <Textarea value={formData.description || ''} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="Brève description..." rows={2} className="text-sm" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-gray-600">URL du Logo (Carré)</Label>
          <Input value={formData.logo_url || ''} onChange={e => setFormData({...formData, logo_url: e.target.value})} placeholder="https://..." className="text-sm" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-gray-600">URL de Couverture (Paysage)</Label>
          <Input value={formData.cover_url || ''} onChange={e => setFormData({...formData, cover_url: e.target.value})} placeholder="https://..." className="text-sm" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-gray-600">Site Web</Label>
          <Input value={formData.website_url || ''} onChange={e => setFormData({...formData, website_url: e.target.value})} placeholder="https://..." className="text-sm" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-gray-600">Lien Wikipédia</Label>
          <Input value={formData.wikipedia_url || ''} onChange={e => setFormData({...formData, wikipedia_url: e.target.value})} placeholder="https://..." className="text-sm" />
        </div>
        <div className="space-y-1.5 md:col-span-2">
          <Label className="text-xs font-medium text-gray-600">Mots-clés (virgules)</Label>
          <Input value={keywordsInput} onChange={e => setKeywordsInput(e.target.value)} placeholder="ex: sivara, moteur de recherche" className="text-sm" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-gray-600">Priorité</Label>
          <Input type="number" value={formData.priority || 0} onChange={e => setFormData({...formData, priority: parseInt(e.target.value) || 0})} className="text-sm w-24" />
        </div>
      </div>
      <div className="flex gap-2 justify-end pt-2 border-t border-blue-100">
        <Button variant="outline" size="sm" onClick={resetForm}><X className="h-3.5 w-3.5 mr-1" /> Annuler</Button>
        <Button size="sm" onClick={handleSave} className="bg-[#00236F] hover:bg-[#1e3a8a] text-white">
          <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> {isEditing && isEditing !== 'new' ? 'Enregistrer' : 'Créer'}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="p-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-5xl">
      <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Gestionnaire d'entités</h1>
      <p className="text-gray-500 -mt-4">Gérez les cartes enrichies qui s'affichent dans les résultats de recherche Sivara.</p>

      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('queue')}
          className={`py-2 px-4 font-medium text-sm flex items-center transition-colors ${
            activeTab === 'queue'
              ? 'border-b-2 border-[#00236F] text-[#00236F]'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Sparkles className="mr-2 h-4 w-4" />
          File d'attente IA (À valider)
        </button>
        <button
          onClick={() => setActiveTab('all')}
          className={`py-2 px-4 font-medium text-sm transition-colors ${
            activeTab === 'all'
              ? 'border-b-2 border-[#00236F] text-[#00236F]'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Toutes les Entités (Outil Expert)
        </button>
      </div>

      {activeTab === 'queue' ? (
        <div className="space-y-6">
          {entities.filter(e => e.source === 'gemini' && !e.is_public).length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200 border-dashed">
              <Sparkles className="mx-auto h-8 w-8 text-gray-400 mb-2" />
              <p className="text-gray-500">Aucune entité IA en attente de validation.</p>
            </div>
          ) : (
            entities.filter(e => e.source === 'gemini' && !e.is_public).map(entity => (
              <div key={entity.id} className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-xl font-bold text-[#111111]">{entity.name}</h3>
                    <p className="text-sm text-gray-500 italic mt-1">{entity.phonetic || 'Aucune prononciation'}</p>
                    <p className="mt-3 text-sm text-gray-700 max-w-3xl line-clamp-3">{entity.description}</p>
                    <div className="flex flex-wrap gap-1 mt-3">
                      {entity.keywords.slice(0, 8).map((kw, i) => (
                        <span key={i} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded border border-gray-200">{kw}</span>
                      ))}
                      {entity.keywords.length > 8 && <span className="px-2 py-0.5 text-xs text-gray-400">+{entity.keywords.length - 8}</span>}
                    </div>
                  </div>
                  <div className="text-xs text-gray-400 text-right whitespace-nowrap ml-4">
                    Généré le<br/>
                    {new Date(entity.created_at || '').toLocaleDateString('fr-CA')}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 pt-4 border-t border-gray-100">
                  <div className="space-y-2">
                    <Label>URL Logo (Carré)</Label>
                    <Input 
                      placeholder="https://..." 
                      value={quickUrls[entity.id]?.logo || ''} 
                      onChange={e => updateQuickUrl(entity.id, 'logo', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>URL Fond (Paysage)</Label>
                    <Input 
                      placeholder="https://..." 
                      value={quickUrls[entity.id]?.cover || ''} 
                      onChange={e => updateQuickUrl(entity.id, 'cover', e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex justify-between items-center pt-2">
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => startEdit(entity)}>
                      <Edit2 className="mr-1 h-3.5 w-3.5" /> Modifier
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleDelete(entity.id)} className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200">
                      <Trash2 className="mr-1 h-3.5 w-3.5" /> Supprimer
                    </Button>
                  </div>
                  <Button onClick={() => handleQuickPublish(entity.id)} className="bg-green-600 hover:bg-green-700 text-white">
                    <CheckCircle2 className="mr-2 h-4 w-4" /> Publier public
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {!isEditing && (
            <div className="flex justify-end">
              <Button onClick={() => { resetForm(); setIsEditing('new'); }} className="bg-[#00236F] hover:bg-[#1e3a8a] text-white">
                <Plus className="h-4 w-4 mr-2" /> Ajouter une entité
              </Button>
            </div>
          )}

          {isEditing && (
            <div ref={formRef}>
              {renderEditForm()}
            </div>
          )}

          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Entité</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Statut</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Mots-clés</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {entities.map(entity => (
                  <tr key={entity.id} className={`hover:bg-gray-50 transition-colors ${isEditing === entity.id ? 'bg-blue-50/30 ring-1 ring-blue-200' : ''}`}>
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
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col gap-1.5">
                        {entity.is_public ? (
                          <Badge className="bg-green-100 text-green-800 hover:bg-green-100 w-fit"><Eye className="h-3 w-3 mr-1" /> Public</Badge>
                        ) : (
                          <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 w-fit"><EyeOff className="h-3 w-3 mr-1" /> Privé</Badge>
                        )}
                        {entity.source === 'gemini' && (
                          <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100 w-fit"><Sparkles className="h-3 w-3 mr-1" /> Gemini</Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {entity.keywords.slice(0, 5).map((kw, i) => (
                          <span key={i} className="px-2 py-1 bg-blue-100 text-[#00236F] text-xs rounded-md">{kw}</span>
                        ))}
                        {entity.keywords.length > 5 && <span className="px-2 py-0.5 text-xs text-gray-400">+{entity.keywords.length - 5}</span>}
                      </div>
                      <div className="text-xs text-gray-400 mt-1">Prio: {entity.priority}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <Button
                        variant="ghost" size="icon"
                        onClick={() => handleTogglePublic(entity)}
                        className={entity.is_public ? 'text-green-600 hover:text-green-900' : 'text-amber-600 hover:text-amber-900'}
                        title={entity.is_public ? 'Rendre privé' : 'Rendre public'}
                      >
                        {entity.is_public ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => startEdit(entity)} className="text-blue-600 hover:text-blue-900" title="Modifier">
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(entity.id)} className="text-red-600 hover:text-red-900 ml-1" title="Supprimer">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {entities.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-gray-500 text-sm">
                      Aucune entité configurée pour l'instant.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default EntitiesManager;
