import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { showSuccess, showError } from '@/utils/toast';
import { 
  Package, Plus, Search, Barcode, Laptop, ArrowLeft, 
  Trash2, Edit2, CheckCircle2, AlertCircle, Box, DollarSign
} from 'lucide-react';

interface Product {
  id: string;
  name: string;
  description: string;
  base_price: number;
  image_url: string;
  specs: any;
}

interface Unit {
  id: string;
  product_id: string;
  serial_number: string;
  status: 'available' | 'sold' | 'reserved' | 'maintenance';
  condition: 'new' | 'refurbished';
}

const DeviceAdmin = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isVendor, setIsVendor] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Data State
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [units, setUnits] = useState<Unit[]>([]);
  
  // UI State
  const [showProductDialog, setShowProductDialog] = useState(false);
  const [showUnitDialog, setShowUnitDialog] = useState(false);
  
  // Forms
  const [prodForm, setProdForm] = useState<Partial<Product>>({ name: '', description: '', base_price: 0, image_url: '' });
  const [unitForm, setUnitForm] = useState<Partial<Unit>>({ serial_number: '', status: 'available', condition: 'new' });

  // 1. Check Vendor Role
  useEffect(() => {
    const checkRole = async () => {
      if (!user) return navigate('/login');
      const { data } = await supabase.from('profiles').select('is_vendor').eq('id', user.id).single();
      if (!data?.is_vendor) {
        showError("Accès refusé. Espace réservé aux vendeurs certifiés.");
        navigate('/?app=device');
      } else {
        setIsVendor(true);
        fetchProducts();
      }
      setIsLoading(false);
    };
    checkRole();
  }, [user, navigate]);

  // 2. Fetch Data
  const fetchProducts = async () => {
    const { data } = await supabase.from('device_products').select('*').order('created_at', { ascending: false });
    setProducts(data || []);
  };

  const fetchUnits = async (productId: string) => {
    const { data } = await supabase.from('device_units').select('*').eq('product_id', productId).order('created_at', { ascending: false });
    setUnits(data as any || []);
  };

  const handleSelectProduct = (product: Product) => {
    setSelectedProduct(product);
    fetchUnits(product.id);
  };

  // 3. Product Actions
  const handleSaveProduct = async () => {
    try {
        if (!prodForm.name || !prodForm.base_price) return;
        
        if (selectedProduct && showProductDialog) {
             // Edit logic here if needed
        } else {
            const { error } = await supabase.from('device_products').insert({
                ...prodForm,
                vendor_id: user?.id,
                specs: { cpu: "Ryzen 7", ram: "32GB" } // Mock specs for now
            });
            if (error) throw error;
            showSuccess("Produit créé");
        }
        setShowProductDialog(false);
        setProdForm({ name: '', description: '', base_price: 0, image_url: '' });
        fetchProducts();
    } catch (e) {
        showError("Erreur lors de la sauvegarde");
    }
  };

  const handleDeleteProduct = async (id: string) => {
      if (!confirm("Supprimer ce produit et TOUTES ses unités ?")) return;
      await supabase.from('device_products').delete().eq('id', id);
      setSelectedProduct(null);
      fetchProducts();
  };

  // 4. Unit Actions
  const handleSaveUnit = async () => {
      try {
          if (!selectedProduct || !unitForm.serial_number) return;
          const { error } = await supabase.from('device_units').insert({
              ...unitForm,
              product_id: selectedProduct.id
          });
          if (error) throw error;
          showSuccess("Unité ajoutée au stock");
          setShowUnitDialog(false);
          setUnitForm({ serial_number: '', status: 'available', condition: 'new' });
          fetchUnits(selectedProduct.id);
      } catch (e: any) {
          showError(e.message || "Erreur lors de l'ajout");
      }
  };

  const handleDeleteUnit = async (id: string) => {
      await supabase.from('device_units').delete().eq('id', id);
      if (selectedProduct) fetchUnits(selectedProduct.id);
  };

  if (!isVendor) return null;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
        {/* Header Admin */}
        <header className="bg-white border-b border-gray-200 sticky top-0 z-20">
            <div className="container mx-auto px-6 h-16 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => navigate('/?app=device')}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div className="h-6 w-px bg-gray-200"></div>
                    <div className="flex items-center gap-2">
                        <div className="bg-black text-white p-1.5 rounded-lg"><Package className="h-4 w-4" /></div>
                        <span className="font-bold text-gray-900">Sivara Vendor</span>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Compte Vérifié
                    </Badge>
                </div>
            </div>
        </header>

        <div className="flex-1 container mx-auto px-6 py-8 flex flex-col lg:flex-row gap-8 overflow-hidden h-[calc(100vh-64px)]">
            
            {/* Colonne Gauche : Liste Produits */}
            <div className="w-full lg:w-1/3 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold text-gray-900">Catalogue</h2>
                    <Button onClick={() => setShowProductDialog(true)} size="sm" className="bg-black hover:bg-gray-800 text-white">
                        <Plus className="h-4 w-4 mr-2" /> Nouveau Produit
                    </Button>
                </div>

                <Card className="flex-1 flex flex-col overflow-hidden border-gray-200 shadow-sm">
                    <div className="p-4 border-b border-gray-100">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <Input placeholder="Rechercher un modèle..." className="pl-9 bg-gray-50 border-gray-200" />
                        </div>
                    </div>
                    <ScrollArea className="flex-1">
                        <div className="divide-y divide-gray-100">
                            {products.map(product => (
                                <div 
                                    key={product.id} 
                                    onClick={() => handleSelectProduct(product)}
                                    className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors flex items-start gap-4 ${selectedProduct?.id === product.id ? 'bg-blue-50 border-l-4 border-blue-600' : 'border-l-4 border-transparent'}`}
                                >
                                    <div className="h-12 w-12 bg-gray-100 rounded-lg flex items-center justify-center shrink-0 overflow-hidden">
                                        {product.image_url ? <img src={product.image_url} className="w-full h-full object-cover" /> : <Laptop className="h-6 w-6 text-gray-400" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start">
                                            <h3 className="font-bold text-gray-900 truncate">{product.name}</h3>
                                            <span className="text-xs font-mono text-gray-500">${product.base_price}</span>
                                        </div>
                                        <p className="text-xs text-gray-500 line-clamp-1 mt-1">{product.description}</p>
                                    </div>
                                </div>
                            ))}
                            {products.length === 0 && (
                                <div className="p-8 text-center text-gray-400">
                                    <Package className="h-10 w-10 mx-auto mb-2 opacity-20" />
                                    <p className="text-sm">Aucun produit en vente</p>
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                </Card>
            </div>

            {/* Colonne Droite : Détails & Unités */}
            <div className="flex-1 flex flex-col gap-4">
                {selectedProduct ? (
                    <>
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                                <Box className="h-5 w-5 text-gray-400" />
                                Stock : {selectedProduct.name}
                            </h2>
                            <div className="flex gap-2">
                                <Button variant="outline" size="sm" onClick={() => handleDeleteProduct(selectedProduct.id)} className="text-red-600 hover:bg-red-50 border-red-200">
                                    <Trash2 className="h-4 w-4 mr-2" /> Supprimer Produit
                                </Button>
                                <Button onClick={() => setShowUnitDialog(true)} size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
                                    <Plus className="h-4 w-4 mr-2" /> Ajouter Unité
                                </Button>
                            </div>
                        </div>

                        <Card className="flex-1 flex flex-col overflow-hidden border-gray-200 shadow-sm">
                            <div className="grid grid-cols-5 gap-4 p-4 border-b border-gray-100 bg-gray-50/50 text-xs font-medium text-gray-500 uppercase tracking-wider">
                                <div className="col-span-2">Numéro de Série</div>
                                <div>État</div>
                                <div>Condition</div>
                                <div className="text-right">Action</div>
                            </div>
                            <ScrollArea className="flex-1">
                                <div className="divide-y divide-gray-100">
                                    {units.map(unit => (
                                        <div key={unit.id} className="grid grid-cols-5 gap-4 p-4 items-center text-sm hover:bg-gray-50 transition-colors group">
                                            <div className="col-span-2 font-mono text-gray-900 flex items-center gap-2">
                                                <Barcode className="h-4 w-4 text-gray-400" />
                                                {unit.serial_number}
                                            </div>
                                            <div>
                                                <Badge variant="outline" className={`
                                                    ${unit.status === 'available' ? 'bg-green-50 text-green-700 border-green-200' : ''}
                                                    ${unit.status === 'sold' ? 'bg-gray-100 text-gray-600 border-gray-200' : ''}
                                                    ${unit.status === 'maintenance' ? 'bg-orange-50 text-orange-700 border-orange-200' : ''}
                                                `}>
                                                    {unit.status}
                                                </Badge>
                                            </div>
                                            <div>
                                                <span className="text-gray-600 capitalize">{unit.condition}</span>
                                            </div>
                                            <div className="text-right opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:bg-red-50" onClick={() => handleDeleteUnit(unit.id)}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                    {units.length === 0 && (
                                        <div className="p-12 text-center text-gray-400">
                                            <Barcode className="h-12 w-12 mx-auto mb-3 opacity-20" />
                                            <p className="font-medium">Stock épuisé ou vide</p>
                                            <p className="text-xs mt-1">Ajoutez des unités pour commencer la vente</p>
                                        </div>
                                    )}
                                </div>
                            </ScrollArea>
                        </Card>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-300 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50/50">
                        <Package className="h-16 w-16 mb-4 opacity-20" />
                        <p className="text-lg font-medium text-gray-400">Sélectionnez un produit pour gérer son stock</p>
                    </div>
                )}
            </div>
        </div>

        {/* Dialog Création Produit */}
        <Dialog open={showProductDialog} onOpenChange={setShowProductDialog}>
            <DialogContent>
                <DialogHeader><DialogTitle>Nouveau Produit</DialogTitle></DialogHeader>
                <div className="space-y-4 py-2">
                    <div className="space-y-2"><Label>Nom du modèle</Label><Input value={prodForm.name} onChange={e => setProdForm({...prodForm, name: e.target.value})} placeholder="ex: Sivara Book Pro" /></div>
                    <div className="space-y-2"><Label>Description courte</Label><Textarea value={prodForm.description} onChange={e => setProdForm({...prodForm, description: e.target.value})} placeholder="Caractéristiques principales..." /></div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2"><Label>Prix de base ($)</Label><Input type="number" value={prodForm.base_price} onChange={e => setProdForm({...prodForm, base_price: parseFloat(e.target.value)})} /></div>
                        <div className="space-y-2"><Label>Image URL (Optionnel)</Label><Input value={prodForm.image_url} onChange={e => setProdForm({...prodForm, image_url: e.target.value})} placeholder="https://..." /></div>
                    </div>
                </div>
                <DialogFooter><Button onClick={handleSaveProduct}>Créer la fiche</Button></DialogFooter>
            </DialogContent>
        </Dialog>

        {/* Dialog Création Unité */}
        <Dialog open={showUnitDialog} onOpenChange={setShowUnitDialog}>
            <DialogContent>
                <DialogHeader><DialogTitle>Ajouter une Unité</DialogTitle><DialogDescription>Ajout physique au stock pour {selectedProduct?.name}</DialogDescription></DialogHeader>
                <div className="space-y-4 py-2">
                    <div className="space-y-2"><Label>Numéro de Série (S/N)</Label><Input value={unitForm.serial_number} onChange={e => setUnitForm({...unitForm, serial_number: e.target.value})} placeholder="SIV-XXXX-YYYY" /></div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>État</Label>
                            <Select value={unitForm.status} onValueChange={(v: any) => setUnitForm({...unitForm, status: v})}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="available">Disponible</SelectItem>
                                    <SelectItem value="reserved">Réservé</SelectItem>
                                    <SelectItem value="maintenance">Maintenance</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Condition</Label>
                            <Select value={unitForm.condition} onValueChange={(v: any) => setUnitForm({...unitForm, condition: v})}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="new">Neuf</SelectItem>
                                    <SelectItem value="refurbished">Reconditionné</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>
                <DialogFooter><Button onClick={handleSaveUnit}>Ajouter au stock</Button></DialogFooter>
            </DialogContent>
        </Dialog>
    </div>
  );
};

export default DeviceAdmin;