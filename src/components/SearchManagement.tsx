import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Dialog, DialogContent, DialogDescription, DialogFooter, 
  DialogHeader, DialogTitle 
} from '@/components/ui/dialog';
import { 
  Plus, Edit, Trash2, Search as SearchIcon, ExternalLink, 
  Loader2, RefreshCw, Globe, FileText, Calendar, CheckCircle, XCircle,
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Save, X, Star,
  ArrowUpDown
} from 'lucide-react';
import { showSuccess, showError, showConfirm } from '@/utils/toast';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';

interface CrawledPage {
  id: string;
  url: string;
  title: string;
  description: string;
  domain: string;
  status: string;
  crawled_at: string;
  updated_at: string;
  blind_index: string[];
  gemini_score: number;
}

const apiCall = async (body: any) => {
  const { data, error } = await supabase.functions.invoke('search-management', { body });
  if (error) throw new Error(error.message || 'Erreur');
  return data;
};

const SearchManagement = () => {
  const [pages, setPages] = useState<CrawledPage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const itemsPerPage = 25;

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<CrawledPage>>({});

  // Dialog for new page
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [newPage, setNewPage] = useState({ url: '', title: '', description: '', domain: '', gemini_score: 50 });

  // Detail panel
  const [selectedPage, setSelectedPage] = useState<CrawledPage | null>(null);

  const searchTimeout = useRef<any>(null);

  useEffect(() => { fetchPages(1); }, []);

  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      setCurrentPage(1);
      if (searchTerm.trim()) handleSearch(searchTerm, 1);
      else fetchPages(1);
    }, 400);
    return () => clearTimeout(searchTimeout.current);
  }, [searchTerm]);

  const fetchPages = async (page: number) => {
    try {
      setIsLoading(true);
      const data = await apiCall({ action: 'list', page, limit: itemsPerPage });
      setPages(data.pages || []);
      setTotalPages(data.totalPages || 1);
      setTotalItems(data.total || 0);
      setCurrentPage(page);
    } catch (e: any) { showError(e.message); }
    finally { setIsLoading(false); }
  };

  const handleSearch = async (query: string, page: number) => {
    try {
      setIsLoading(true);
      const data = await apiCall({ action: 'search', searchQuery: query, page, limit: itemsPerPage });
      setPages(data.pages || []);
      setTotalPages(data.totalPages || 1);
      setTotalItems(data.total || 0);
      setCurrentPage(page);
    } catch (e: any) { showError(e.message); }
    finally { setIsLoading(false); }
  };

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    if (searchTerm.trim()) handleSearch(searchTerm, newPage);
    else fetchPages(newPage);
  };

  const startEdit = (page: CrawledPage) => {
    setEditingId(page.id);
    setEditData({ ...page });
    setSelectedPage(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditData({});
  };

  const saveEdit = async () => {
    if (!editingId) return;
    try {
      setIsSaving(true);
      await apiCall({
        action: 'update', id: editingId,
        url: editData.url, title: editData.title,
        description: editData.description, domain: editData.domain,
        gemini_score: editData.gemini_score,
      });
      showSuccess('Page mise à jour');
      setEditingId(null);
      setEditData({});
      if (searchTerm.trim()) handleSearch(searchTerm, currentPage);
      else fetchPages(currentPage);
    } catch (e: any) { showError(e.message); }
    finally { setIsSaving(false); }
  };

  const handleCreate = async () => {
    if (!newPage.url.trim()) { showError("L'URL est requise"); return; }
    try {
      setIsSaving(true);
      const data = await apiCall({ action: 'create', ...newPage });
      showSuccess(`Page créée (${data.tokensCount} tokens NLP)`);
      setIsDialogOpen(false);
      setNewPage({ url: '', title: '', description: '', domain: '', gemini_score: 50 });
      fetchPages(1);
    } catch (e: any) { showError(e.message); }
    finally { setIsSaving(false); }
  };

  const handleDelete = async (page: CrawledPage) => {
    const confirmed = await showConfirm('Supprimer cette page ?', 'Cette action est irréversible.');
    if (!confirmed) return;
    try {
      await apiCall({ action: 'delete', id: page.id });
      showSuccess('Page supprimée');
      if (searchTerm.trim()) handleSearch(searchTerm, currentPage);
      else fetchPages(currentPage);
    } catch (e: any) { showError(e.message); }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-50 border-green-200';
    if (score >= 50) return 'text-amber-600 bg-amber-50 border-amber-200';
    return 'text-red-600 bg-red-50 border-red-200';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Gestion des recherches</h1>
          <p className="text-gray-500 mt-1">
            {totalItems} pages indexées • Score Gemini, titres, URLs — tout est modifiable.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { setSearchTerm(''); fetchPages(1); }} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
          <Button onClick={() => setIsDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Ajouter
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total pages', value: totalItems, color: 'text-gray-900' },
          { label: 'Domaines', value: new Set(pages.map(p => p.domain)).size, color: 'text-blue-600' },
          { label: 'Score moyen', value: pages.length ? Math.round(pages.reduce((s, p) => s + (p.gemini_score || 0), 0) / pages.length) : 0, color: 'text-amber-600' },
          { label: 'En erreur', value: pages.filter(p => p.status === 'failed').length, color: 'text-red-600' },
        ].map(stat => (
          <div key={stat.label} className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{stat.label}</p>
            <p className={`text-2xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Rechercher par titre, URL, domaine..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-10"
          />
          {isLoading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4 animate-spin" />}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {isLoading && pages.length === 0 ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : pages.length === 0 ? (
          <div className="text-center py-16">
            <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">{searchTerm ? 'Aucun résultat' : 'Aucune page indexée'}</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase w-[300px]">Page</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Domaine</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase w-20">Score</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase w-20">Tokens</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase w-24">Statut</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase w-24">Date</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase w-28">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {pages.map(page => (
                    editingId === page.id ? (
                      // --- INLINE EDIT ROW ---
                      <tr key={page.id} className="bg-blue-50/50">
                        <td colSpan={7} className="px-4 py-4">
                          <div className="space-y-4">
                            <div className="flex items-center gap-2 mb-2">
                              <Edit className="h-4 w-4 text-blue-600" />
                              <span className="text-sm font-semibold text-blue-600">Modification en cours</span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-1.5">
                                <Label className="text-xs font-medium text-gray-600">URL</Label>
                                <Input value={editData.url || ''} onChange={e => setEditData({...editData, url: e.target.value})} className="text-sm" />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-xs font-medium text-gray-600">Domaine</Label>
                                <Input value={editData.domain || ''} onChange={e => setEditData({...editData, domain: e.target.value})} className="text-sm" />
                              </div>
                              <div className="space-y-1.5 md:col-span-2">
                                <Label className="text-xs font-medium text-gray-600">Titre</Label>
                                <Input value={editData.title || ''} onChange={e => setEditData({...editData, title: e.target.value})} className="text-sm" />
                              </div>
                              <div className="space-y-1.5 md:col-span-2">
                                <Label className="text-xs font-medium text-gray-600">Description</Label>
                                <Textarea value={editData.description || ''} onChange={e => setEditData({...editData, description: e.target.value})} rows={3} className="text-sm" />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-xs font-medium text-gray-600">Score Gemini (0-100)</Label>
                                <div className="flex items-center gap-3">
                                  <Input 
                                    type="number" min={0} max={100}
                                    value={editData.gemini_score ?? 0} 
                                    onChange={e => setEditData({...editData, gemini_score: parseInt(e.target.value) || 0})} 
                                    className="text-sm w-24" 
                                  />
                                  <input 
                                    type="range" min={0} max={100} 
                                    value={editData.gemini_score ?? 0}
                                    onChange={e => setEditData({...editData, gemini_score: parseInt(e.target.value)})}
                                    className="flex-1 h-2 accent-blue-600"
                                  />
                                </div>
                              </div>
                            </div>
                            <div className="flex justify-end gap-2 pt-2 border-t border-blue-100">
                              <Button variant="outline" size="sm" onClick={cancelEdit}><X className="h-3.5 w-3.5 mr-1" /> Annuler</Button>
                              <Button size="sm" onClick={saveEdit} disabled={isSaving} className="bg-blue-600 hover:bg-blue-700">
                                {isSaving ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1" />}
                                Sauvegarder
                              </Button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      // --- NORMAL ROW ---
                      <tr key={page.id} className="hover:bg-gray-50/50 transition-colors group">
                        <td className="px-4 py-3">
                          <div className="max-w-[300px]">
                            <p className="text-sm font-medium text-gray-900 truncate">{page.title || 'Sans titre'}</p>
                            <a href={page.url} target="_blank" rel="noopener noreferrer"
                              className="text-xs text-blue-500 hover:underline truncate block mt-0.5 flex items-center gap-1">
                              <ExternalLink className="h-3 w-3 flex-shrink-0" />
                              <span className="truncate">{page.url}</span>
                            </a>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5 text-sm text-gray-600">
                            <Globe className="h-3.5 w-3.5 text-gray-400" />
                            <span className="truncate max-w-[150px]">{page.domain}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border ${getScoreColor(page.gemini_score || 0)}`}>
                            <Star className="h-3 w-3 mr-0.5" />
                            {page.gemini_score || 0}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-xs text-gray-500 font-mono">{page.blind_index?.length || 0}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {page.status === 'success' ? (
                            <Badge className="bg-green-100 text-green-700 border-green-200 text-xs"><CheckCircle className="h-3 w-3 mr-1" />OK</Badge>
                          ) : (
                            <Badge className="bg-red-100 text-red-700 border-red-200 text-xs"><XCircle className="h-3 w-3 mr-1" />Err</Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-xs text-gray-500">{new Date(page.crawled_at).toLocaleDateString('fr-FR')}</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEdit(page)} title="Modifier">
                              <Edit className="h-3.5 w-3.5 text-blue-600" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(page)} title="Supprimer">
                              <Trash2 className="h-3.5 w-3.5 text-red-500" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50/50">
                <p className="text-xs text-gray-500">
                  Page {currentPage}/{totalPages} • {totalItems} éléments
                </p>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) pageNum = i + 1;
                    else if (currentPage <= 3) pageNum = i + 1;
                    else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                    else pageNum = currentPage - 2 + i;
                    return (
                      <Button key={pageNum} variant={currentPage === pageNum ? "default" : "outline"} size="icon"
                        onClick={() => handlePageChange(pageNum)} className="h-8 w-8 text-xs">
                        {pageNum}
                      </Button>
                    );
                  })}
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Ajouter une nouvelle page</DialogTitle>
            <DialogDescription>Les données seront chiffrées et les tokens NLP générés automatiquement.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>URL *</Label>
              <Input placeholder="https://example.com/page" value={newPage.url} onChange={e => setNewPage({...newPage, url: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>Titre</Label>
              <Input placeholder="Titre de la page" value={newPage.title} onChange={e => setNewPage({...newPage, title: e.target.value})} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Domaine</Label>
                <Input placeholder="example.com" value={newPage.domain} onChange={e => setNewPage({...newPage, domain: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Score Gemini (0-100)</Label>
                <Input type="number" min={0} max={100} value={newPage.gemini_score} onChange={e => setNewPage({...newPage, gemini_score: parseInt(e.target.value) || 0})} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea placeholder="Description de la page" value={newPage.description} onChange={e => setNewPage({...newPage, description: e.target.value})} rows={4} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Annuler</Button>
            <Button onClick={handleCreate} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
              Ajouter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SearchManagement;