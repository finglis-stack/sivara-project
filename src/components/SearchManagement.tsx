import { useState, useEffect } from 'react';
import { 
  Card, CardContent, CardDescription, CardHeader, CardTitle 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Dialog, DialogContent, DialogDescription, DialogFooter, 
  DialogHeader, DialogTitle, DialogTrigger 
} from '@/components/ui/dialog';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from '@/components/ui/table';
import { 
  Collapsible, CollapsibleContent, CollapsibleTrigger 
} from '@/components/ui/collapsible';
import { 
  Plus, Edit, Trash2, Search as SearchIcon, ExternalLink, 
  Loader2, RefreshCw, Globe, FileText, Calendar, CheckCircle, XCircle,
  ChevronLeft, ChevronRight, ChevronDown, FolderOpen
} from 'lucide-react';
import { showSuccess, showError, showConfirm } from '@/utils/toast';
import { Badge } from '@/components/ui/badge';

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
}

interface PaginatedResponse {
  pages: CrawledPage[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  error?: string;
}

interface DomainGroup {
  domain: string;
  pages: CrawledPage[];
  total: number;
}

const SearchManagement = () => {
  const [pages, setPages] = useState<CrawledPage[]>([]);
  const [filteredPages, setFilteredPages] = useState<CrawledPage[]>([]);
  const [domainGroups, setDomainGroups] = useState<DomainGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPage, setEditingPage] = useState<CrawledPage | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [viewMode, setViewMode] = useState<'flat' | 'grouped'>('grouped');
  const [expandedDomains, setExpandedDomains] = useState<Set<string>>(new Set());
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const itemsPerPage = 20;
  
  // Form state
  const [formData, setFormData] = useState({
    url: '',
    title: '',
    description: '',
    domain: '',
  });

  useEffect(() => {
    fetchPages();
  }, [currentPage]);

  useEffect(() => {
    if (searchTerm) {
      const filtered = pages.filter(page => 
        page.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        page.url.toLowerCase().includes(searchTerm.toLowerCase()) ||
        page.domain.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredPages(filtered);
    } else {
      setFilteredPages(pages);
    }
  }, [searchTerm, pages]);

  useEffect(() => {
    // Regrouper les pages par domaine
    const groups: { [key: string]: CrawledPage[] } = {};
    filteredPages.forEach(page => {
      if (!groups[page.domain]) {
        groups[page.domain] = [];
      }
      groups[page.domain].push(page);
    });

    const domainGroupsArray: DomainGroup[] = Object.entries(groups).map(([domain, domainPages]) => ({
      domain,
      pages: domainPages,
      total: domainPages.length,
    })).sort((a, b) => b.total - a.total);

    setDomainGroups(domainGroupsArray);
  }, [filteredPages]);

  const toggleDomain = (domain: string) => {
    setExpandedDomains(prev => {
      const newSet = new Set(prev);
      if (newSet.has(domain)) {
        newSet.delete(domain);
      } else {
        newSet.add(domain);
      }
      return newSet;
    });
  };

  const fetchPages = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('https://asctcqyupjwjifxidegq.supabase.co/functions/v1/search-management', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFzY3RjcXl1cGp3amlmeGlkZWdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMxNjU1ODEsImV4cCI6MjA3ODc0MTU4MX0.JUAXZaLsixxqQ2-hNzgZhmViVvA8aiDbL-3IOquanrs`,
        },
        body: JSON.stringify({
          action: 'list',
          page: currentPage,
          limit: itemsPerPage,
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors du chargement');
      }

      setPages(data.pages || []);
      setFilteredPages(data.pages || []);
      setTotalPages(data.totalPages || 1);
      setTotalItems(data.total || 0);
    } catch (error) {
      console.error('Error fetching pages:', error);
      showError('Erreur lors du chargement des pages');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenDialog = (page?: CrawledPage) => {
    if (page) {
      setEditingPage(page);
      setFormData({
        url: page.url,
        title: page.title,
        description: page.description,
        domain: page.domain,
      });
    } else {
      setEditingPage(null);
      setFormData({
        url: '',
        title: '',
        description: '',
        domain: '',
      });
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingPage(null);
    setFormData({
      url: '',
      title: '',
      description: '',
      domain: '',
    });
  };

  const handleSave = async () => {
    if (!formData.url.trim()) {
      showError('L\'URL est requise');
      return;
    }

    try {
      setIsSaving(true);

      const action = editingPage ? 'update' : 'create';
      const body: any = {
        action,
        url: formData.url,
        title: formData.title,
        description: formData.description,
        domain: formData.domain,
      };

      if (editingPage) {
        body.id = editingPage.id;
      }

      const response = await fetch('https://asctcqyupjwjifxidegq.supabase.co/functions/v1/search-management', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFzY3RjcXl1cGp3amlmeGlkZWdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMxNjU1ODEsImV4cCI6MjA3ODc0MTU4MX0.JUAXZaLsixxqQ2-hNzgZhmViVvA8aiDbL-3IOquanrs`,
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors de la sauvegarde');
      }

      showSuccess(editingPage ? 'Page mise à jour avec succès' : 'Page ajoutée avec succès');
      handleCloseDialog();
      fetchPages();
    } catch (error) {
      console.error('Error saving page:', error);
      showError('Erreur lors de la sauvegarde');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (page: CrawledPage) => {
    const confirmed = await showConfirm(
      'Êtes-vous sûr de vouloir supprimer cette page ?',
      'Cette action est irréversible.'
    );

    if (!confirmed) return;

    try {
      const response = await fetch('https://asctcqyupjwjifxidegq.supabase.co/functions/v1/search-management', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFzY3RjcXl1cGp3amlmeGlkZWdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMxNjU1ODEsImV4cCI6MjA3ODc0MTU4MX0.JUAXZaLsixxqQ2-hNzgZhmViVvA8aiDbL-3IOquanrs`,
        },
        body: JSON.stringify({
          action: 'delete',
          id: page.id,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors de la suppression');
      }

      showSuccess('Page supprimée avec succès');
      
      // Si on est sur la dernière page et qu'il n'y a plus d'éléments, revenir à la page précédente
      if (filteredPages.length === 1 && currentPage > 1) {
        setCurrentPage(currentPage - 1);
      } else {
        fetchPages();
      }
    } catch (error) {
      console.error('Error deleting page:', error);
      showError('Erreur lors de la suppression');
    }
  };

  const handleDeleteDomain = async (domain: string) => {
    const confirmed = await showConfirm(
      `Êtes-vous sûr de vouloir supprimer toutes les pages du domaine "${domain}" ?`,
      `${domainGroups.find(g => g.domain === domain)?.total || 0} page(s) seront supprimées. Cette action est irréversible.`
    );

    if (!confirmed) return;

    try {
      const group = domainGroups.find(g => g.domain === domain);
      if (!group) return;

      // Supprimer toutes les pages du domaine
      await Promise.all(
        group.pages.map(page =>
          fetch('https://asctcqyupjwjifxidegq.supabase.co/functions/v1/search-management', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFzY3RjcXl1cGp3amlmeGlkZWdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMxNjU1ODEsImV4cCI6MjA3ODc0MTU4MX0.JUAXZaLsixxqQ2-hNzgZhmViVvA8aiDbL-3IOquanrs`,
            },
            body: JSON.stringify({
              action: 'delete',
              id: page.id,
            }),
          })
        )
      );

      showSuccess(`${group.total} page(s) supprimée(s) avec succès`);
      fetchPages();
    } catch (error) {
      console.error('Error deleting domain:', error);
      showError('Erreur lors de la suppression');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <Badge className="bg-green-100 text-green-700 border-green-200"><CheckCircle className="h-3 w-3 mr-1" /> Succès</Badge>;
      case 'failed':
        return <Badge className="bg-red-100 text-red-700 border-red-200"><XCircle className="h-3 w-3 mr-1" /> Échec</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Gestion des recherches</h1>
          <p className="text-gray-500 mt-1">
            Gérez les pages indexées dans le moteur de recherche
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setViewMode(viewMode === 'flat' ? 'grouped' : 'flat')}
          >
            {viewMode === 'flat' ? <FolderOpen className="h-4 w-4 mr-2" /> : <FileText className="h-4 w-4 mr-2" />}
            {viewMode === 'flat' ? 'Vue groupée' : 'Vue liste'}
          </Button>
          <Button
            variant="outline"
            onClick={fetchPages}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="h-4 w-4 mr-2" />
                Ajouter une page
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {editingPage ? 'Modifier la page' : 'Ajouter une nouvelle page'}
                </DialogTitle>
                <DialogDescription>
                  {editingPage 
                    ? 'Modifiez les informations de cette page indexée. Les données seront ré-encryptées et les tokens NLP régénérés.'
                    : 'Ajoutez une nouvelle page à l\'index de recherche. Les données seront encryptées et les tokens NLP générés automatiquement.'}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="url">URL *</Label>
                  <Input
                    id="url"
                    placeholder="https://example.com/page"
                    value={formData.url}
                    onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="title">Titre</Label>
                  <Input
                    id="title"
                    placeholder="Titre de la page"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="domain">Domaine</Label>
                  <Input
                    id="domain"
                    placeholder="example.com"
                    value={formData.domain}
                    onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Description de la page"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={4}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={handleCloseDialog}>
                  Annuler
                </Button>
                <Button onClick={handleSave} disabled={isSaving}>
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Sauvegarde...
                    </>
                  ) : (
                    editingPage ? 'Mettre à jour' : 'Ajouter'
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-500">Total pages</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalItems}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-500">Pages actives</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {pages.filter(p => p.status === 'success').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-500">Pages en erreur</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {pages.filter(p => p.status === 'failed').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-500">Domaines uniques</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Set(pages.map(p => p.domain)).size}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search & Filter */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Rechercher par titre, URL ou domaine..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Pages Table */}
      <Card>
        <CardHeader>
          <CardTitle>Pages indexées</CardTitle>
          <CardDescription>
            {filteredPages.length} page{filteredPages.length > 1 ? 's' : ''} affichée{filteredPages.length > 1 ? 's' : ''} sur {totalItems} au total
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : filteredPages.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">
                {searchTerm ? 'Aucun résultat trouvé' : 'Aucune page indexée'}
              </p>
            </div>
          ) : viewMode === 'grouped' ? (
            // Vue groupée par domaine
            <div className="space-y-4">
              {domainGroups.map((group) => (
                <Collapsible
                  key={group.domain}
                  open={expandedDomains.has(group.domain)}
                  onOpenChange={() => toggleDomain(group.domain)}
                >
                  <Card className="border-2">
                    <CollapsibleTrigger asChild>
                      <div className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors">
                        <div className="flex items-center gap-4">
                          <Globe className="h-5 w-5 text-gray-400" />
                          <div>
                            <h3 className="font-semibold text-gray-900">{group.domain}</h3>
                            <p className="text-sm text-gray-500">{group.total} page{group.total > 1 ? 's' : ''}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{group.total} pages</Badge>
                          <ChevronDown className={`h-5 w-5 text-gray-400 transition-transform ${expandedDomains.has(group.domain) ? 'rotate-180' : ''}`} />
                        </div>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="border-t p-4">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Titre</TableHead>
                              <TableHead>URL</TableHead>
                              <TableHead>Statut</TableHead>
                              <TableHead>Date</TableHead>
                              <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {group.pages.map((page) => (
                              <TableRow key={page.id}>
                                <TableCell className="font-medium max-w-xs truncate">
                                  {page.title || 'Sans titre'}
                                </TableCell>
                                <TableCell className="max-w-xs truncate">
                                  <a
                                    href={page.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:underline flex items-center gap-1"
                                  >
                                    <ExternalLink className="h-3 w-3" />
                                    {page.url}
                                  </a>
                                </TableCell>
                                <TableCell>{getStatusBadge(page.status)}</TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2 text-sm text-gray-500">
                                    <Calendar className="h-4 w-4" />
                                    {new Date(page.crawled_at).toLocaleDateString('fr-FR')}
                                  </div>
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleOpenDialog(page)}
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleDelete(page)}
                                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                        <div className="mt-4 pt-4 border-t flex justify-end">
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeleteDomain(group.domain)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Supprimer tout le domaine
                          </Button>
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              ))}
            </div>
          ) : (
            // Vue liste plate
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Titre</TableHead>
                      <TableHead>URL</TableHead>
                      <TableHead>Domaine</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Date d'indexation</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPages.map((page) => (
                      <TableRow key={page.id}>
                        <TableCell className="font-medium max-w-xs truncate">
                          {page.title || 'Sans titre'}
                        </TableCell>
                        <TableCell className="max-w-xs truncate">
                          <a
                            href={page.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline flex items-center gap-1"
                          >
                            <ExternalLink className="h-3 w-3" />
                            {page.url}
                          </a>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Globe className="h-4 w-4 text-gray-400" />
                            {page.domain}
                          </div>
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(page.status)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 text-sm text-gray-500">
                            <Calendar className="h-4 w-4" />
                            {new Date(page.crawled_at).toLocaleDateString('fr-FR')}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenDialog(page)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(page)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-6 pt-6 border-t">
                  <p className="text-sm text-gray-500">
                    Page {currentPage} sur {totalPages} ({totalItems} éléments au total)
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }
                        
                        return (
                          <Button
                            key={pageNum}
                            variant={currentPage === pageNum ? "default" : "outline"}
                            size="icon"
                            onClick={() => handlePageChange(pageNum)}
                            className="w-9 h-9"
                          >
                            {pageNum}
                          </Button>
                        );
                      })}
                    </div>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SearchManagement;