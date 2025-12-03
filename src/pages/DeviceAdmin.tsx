import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { showSuccess, showError } from '@/utils/toast';
import { 
  Package, Plus, Search, Barcode, Laptop, ArrowLeft, 
  Trash2, CheckCircle2, Upload, Globe, Loader2,
  Mail, Phone, ChevronRight
} from 'lucide-react';

interface Product {
  id: string;
  name: string;
  description: string;
  base_price: number;
  image_url: string;
  specs: any;
  availability?: string;
  warranty_type?: string;
}

interface Unit {
  id: string;
  product_id: string;
  serial_number: string;
  status: 'available' | 'sold' | 'reserved' | 'maintenance';
  condition: 'new' | 'refurbished';
  unit_price: number;
  sold_to_user_id?: string;
  specific_specs: {
    ram_size: string;
    ram_speed: string;
    storage: string;
    features: {
        touch: boolean;
        wifi: boolean;
        bluetooth: boolean;
        fingerprint: boolean;
    }
  };
  product?: Product;
}

interface Customer {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string;
  avatar_url: string | null;
  is_pro: boolean;
  subscription_status: string;
}

const DeviceAdmin = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isVendor, setIsVendor] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  
  // CHANGEMENT: Onglet Clients par défaut
  const [activeTab, setActiveTab] = useState<'inventory' | 'customers'>('customers');

  // Inventory Data
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [units, setUnits] = useState<Unit[]>([]);
  
  // Customer Data
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState<Customer[]>([]);
  const [isSearchingCustomers, setIsSearchingCustomers] = useState(false);
  
  // UI State
  const [showProductDialog, setShowProductDialog] = useState(false);
  const [showUnitDialog, setShowUnitDialog] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Forms
  const [prodForm, setProdForm] = useState<Partial<Product>>({ 
      name: '', 
      description: '', 
      base_price: 0, 
      image_url: '', 
      availability: 'Global', 
      warranty_type: 'standard' 
  });

  const defaultFeatures = { touch: false, wifi: true, bluetooth: true, fingerprint: true };
  const [unitForm, setUnitForm] = useState({ 
      serial_number: '',
      status: 'available', 
      condition: 'new',
      unit_price: 0,
      ram_size: '16',
      ram_speed: '5200',
      storage: '512',
      features: defaultFeatures
  });

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

  // 2. Fetch Inventory
  const fetchProducts = async () => {
    const { data } = await supabase.from('device_products').select('*').order('created_at', { ascending: false });
    setProducts(data || []);
  };

  const fetchUnits = async (productId: string) => {
    const { data } = await supabase.from('device_units').select('*').eq('product_id', productId).order('created_at', { ascending: false });
    setUnits(data as any || []);
  };

  // 3. Customer Logic
  const handleCustomerSearch = async (query: string) => {
      setCustomerSearch(query);
      if (query.length < 2) {
          setCustomerResults([]);
          return;
      }

      setIsSearchingCustomers(true);
      try {
          // Recherche Profiles (Nom, Email, Tel)
          const { data: profiles } = await supabase
            .from('profiles')
            .select('*')
            .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,email.ilike.%${query}%,phone_number.ilike.%${query}%`)
            .limit(5);

          // Recherche par S/N (Device) pour trouver le proprio
          let serialMatches: any[] = [];
          if (query.length > 3) {
             const { data: units } = await supabase
                .from('device_units')
                .select('sold_to_user_id')
                .ilike('serial_number', `%${query}%`)
                .not('sold_to_user_id', 'is', null)
                .limit(5);
             
             if (units && units.length > 0) {
                 const userIds = units.map(u => u.sold_to_user_id);
                 const { data: owners } = await supabase.from('profiles').select('*').in('id', userIds);
                 serialMatches = owners || [];
             }
          }

          // Merge unique results
          const combined = [...(profiles || []), ...serialMatches];
          const unique = Array.from(new Map(combined.map(item => [item.id, item])).values()).slice(0, 5);
          
          setCustomerResults(unique as Customer[]);
      } catch (e) {
          console.error(e);
      } finally {
          setIsSearchingCustomers(false);
      }
  };

  const openCustomerDetails = (customer: Customer) => {
      // NAVIGATION VERS LA NOUVELLE PAGE
      navigate(`/admin/customer/${customer.id}?app=device`);
  };

  const handleSelectProduct = (product: Product) => {
    setSelectedProduct(product);
    fetchUnits(product.id);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    try {
        setIsUploading(true);
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}.${fileExt}`;
        const filePath = `${user.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from('device-products')
            .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage.from('device-products').getPublicUrl(filePath);
        setProdForm(prev => ({ ...prev, image_url: publicUrl }));
        showSuccess("Image uploadée");
    } catch (error) {
        console.error(error);
        showError("Erreur lors de l'upload");
    } finally {
        setIsUploading(false);
    }
  };

  // Product Actions
  const handleSaveProduct = async () => {
    try {
        if (!prodForm.name || !prodForm.base_price) return;
        
        const payload = {
            ...prodForm,
            vendor_id: user?.id,
            specs: { cpu: "Ryzen 7", type: "Laptop" } 
        };

        const { error } = await supabase.from('device_products').insert(payload);
        if (error) throw error;
        showSuccess("Produit créé");
        setShowProductDialog(false);
        setProdForm({ name: '', description: '', base_price: 0, image_url: '', availability: 'Global', warranty_type: 'standard' });
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

  // Unit Actions
  const generateSerialNumber = () => {
      const year = new Date().getFullYear().toString().slice(-2);
      const random = Math.random().toString(36).substring(2, 8).toUpperCase();
      return `SIV-${year}-${random}`;
  };

  const handleOpenUnitDialog = () => {
      setUnitForm({
          serial_number: '',
          status: 'available',
          condition: 'new',
          unit_price: selectedProduct?.base_price || 0,
          ram_size: '16',
          ram_speed: '5200',
          storage: '512',
          features: defaultFeatures
      });
      setShowUnitDialog(true);
  };

  const handleSaveUnit = async () => {
      try {
          if (!selectedProduct) return;
          const generatedSN = generateSerialNumber();
          
          const { error } = await supabase.from('device_units').insert({
              product_id: selectedProduct.id,
              serial_number: generatedSN,
              status: unitForm.status,
              condition: unitForm.condition,
              unit_price: unitForm.unit_price,
              specific_specs: {
                  ram_size: unitForm.ram_size,
                  ram_speed: unitForm.ram_speed,
                  storage: unitForm.storage,
                  features: unitForm.features
              }
          });

          if (error) throw error;
          showSuccess(`Unité ${generatedSN} ajoutée`);
          setShowUnitDialog(false);
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
                
                <div className="flex bg-gray-100 p-1 rounded-lg">
                    <button onClick={() => setActiveTab('customers')} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'customers' ? 'bg-white shadow-sm text-black' : 'text-gray-500 hover:text-gray-900'}`}>Clients</button>
                    <button onClick={() => setActiveTab('inventory')} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'inventory' ? 'bg-white shadow-sm text-black' : 'text-gray-500 hover:text-gray-900'}`}>Inventaire</button>
                </div>

                <div className="flex items-center gap-3">
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Connecté
                    </Badge>
                </div>
            </div>
        </header>

        <div className="flex-1 container mx-auto px-6 py-8 flex flex-col lg:flex-row gap-8 overflow-hidden h-[calc(100vh-64px)]">
            
            {/* VIEW: CUSTOMERS (Maintenant en premier) */}
            {activeTab === 'customers' && (
                <div className="w-full flex flex-col items-center max-w-4xl mx-auto h-full">
                    <div className="w-full mb-8">
                        <h1 className="text-2xl font-bold text-gray-900 mb-2">Recherche Client</h1>
                        <p className="text-gray-500 text-sm mb-6">Recherchez par nom, email, téléphone ou numéro de série d'appareil.</p>
                        
                        <div className="relative group">
                            <div className="absolute -inset-1 bg-gradient-to-r from-blue-100 to-purple-100 rounded-xl blur opacity-25 group-hover:opacity-50 transition duration-500"></div>
                            <div className="relative">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                                <Input 
                                    placeholder="Ex: Jean Dupont, 514..., SIV-24-..." 
                                    className="h-14 pl-12 text-lg bg-white shadow-lg border-gray-100 rounded-xl"
                                    value={customerSearch}
                                    onChange={(e) => handleCustomerSearch(e.target.value)}
                                />
                                {isSearchingCustomers && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-blue-600 animate-spin" />}
                            </div>
                        </div>
                    </div>

                    <div className="w-full grid gap-4">
                        {customerResults.map(customer => (
                            <Card 
                                key={customer.id} 
                                onClick={() => openCustomerDetails(customer)}
                                className="cursor-pointer hover:border-blue-300 hover:shadow-md transition-all group overflow-hidden"
                            >
                                <div className="p-4 flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <Avatar className="h-12 w-12 border border-gray-100">
                                            {customer.avatar_url && <AvatarImage src={customer.avatar_url} />}
                                            <AvatarFallback className="bg-gray-100 text-gray-500 font-bold">{customer.first_name[0]}</AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <h3 className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                                                {customer.first_name} {customer.last_name}
                                            </h3>
                                            <div className="flex items-center gap-3 text-sm text-gray-500 mt-0.5">
                                                <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {customer.email}</span>
                                                {customer.phone_number && <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {customer.phone_number}</span>}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        {customer.is_pro && <Badge className="bg-black text-white">PRO</Badge>}
                                        <ChevronRight className="text-gray-300 group-hover:text-blue-600" />
                                    </div>
                                </div>
                            </Card>
                        ))}
                        {customerResults.length === 0 && customerSearch.length > 1 && !isSearchingCustomers && (
                            <div className="text-center py-12 text-gray-400">Aucun client trouvé.</div>
                        )}
                    </div>
                </div>
            )}

            {/* VIEW: INVENTORY */}
            {activeTab === 'inventory' && (
                <>
                    {/* Colonne Gauche : Liste Produits */}
                    <div className="w-full lg:w-1/3 flex flex-col gap-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-bold text-gray-900">Catalogue</h2>
                            <Button onClick={() => setShowProductDialog(true)} size="sm" className="bg-black hover:bg-gray-800 text-white">
                                <Plus className="h-4 w-4 mr-2" /> Nouveau
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
                                            <div className="h-12 w-12 bg-gray-100 rounded-lg flex items-center justify-center shrink-0 overflow-hidden relative">
                                                {product.image_url ? <img src={product.image_url} className="w-full h-full object-cover" /> : <Laptop className="h-6 w-6 text-gray-400" />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-start">
                                                    <h3 className="font-bold text-gray-900 truncate">{product.name}</h3>
                                                    <span className="text-xs font-mono text-gray-500">${product.base_price}</span>
                                                </div>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <Badge variant="outline" className="text-[10px] h-4 px-1">{product.availability}</Badge>
                                                    <Badge variant="secondary" className="text-[10px] h-4 px-1">{product.warranty_type === 'extended' ? 'Garantie Étendue' : 'Standard'}</Badge>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                        </Card>
                    </div>

                    {/* Colonne Droite : Détails & Unités */}
                    <div className="flex-1 flex flex-col gap-4">
                        {selectedProduct ? (
                            <>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        {selectedProduct.image_url && <img src={selectedProduct.image_url} className="h-12 w-12 rounded-lg object-cover border border-gray-200" />}
                                        <div>
                                            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">{selectedProduct.name}</h2>
                                            <p className="text-sm text-gray-500 flex items-center gap-2"><Globe className="h-3 w-3" /> {selectedProduct.availability}</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button variant="outline" size="sm" onClick={() => handleDeleteProduct(selectedProduct.id)} className="text-red-600 hover:bg-red-50 border-red-200"><Trash2 className="h-4 w-4 mr-2" /> Supprimer</Button>
                                        <Button onClick={handleOpenUnitDialog} size="sm" className="bg-blue-600 hover:bg-blue-700 text-white"><Plus className="h-4 w-4 mr-2" /> Ajouter Unité</Button>
                                    </div>
                                </div>

                                <Card className="flex-1 flex flex-col overflow-hidden border-gray-200 shadow-sm">
                                    <div className="grid grid-cols-6 gap-4 p-4 border-b border-gray-100 bg-gray-50/50 text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        <div className="col-span-2">Info Unité</div>
                                        <div>Specs</div>
                                        <div>Prix</div>
                                        <div>État</div>
                                        <div className="text-right">Action</div>
                                    </div>
                                    <ScrollArea className="flex-1">
                                        <div className="divide-y divide-gray-100">
                                            {units.map(unit => (
                                                <div key={unit.id} className="grid grid-cols-6 gap-4 p-4 items-center text-sm hover:bg-gray-50 transition-colors group">
                                                    <div className="col-span-2">
                                                        <div className="font-mono text-gray-900 flex items-center gap-2 font-medium">
                                                            <Barcode className="h-4 w-4 text-gray-400" />
                                                            {unit.serial_number}
                                                        </div>
                                                        <div className="text-xs text-gray-500 capitalize">{unit.condition === 'new' ? 'Neuf' : 'Reconditionné'}</div>
                                                    </div>
                                                    <div className="text-xs text-gray-600">
                                                        <div className="font-semibold">{unit.specific_specs?.ram_size}GB RAM • {unit.specific_specs?.storage}GB</div>
                                                    </div>
                                                    <div className="font-medium">${unit.unit_price}</div>
                                                    <div>
                                                        <Badge variant="outline" className={`${unit.status === 'available' ? 'bg-green-50 text-green-700' : unit.status === 'sold' ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>{unit.status}</Badge>
                                                    </div>
                                                    <div className="text-right opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:bg-red-50" onClick={() => handleDeleteUnit(unit.id)}><Trash2 className="h-4 w-4" /></Button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </ScrollArea>
                                </Card>
                            </>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-gray-300 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50/50">
                                <Package className="h-16 w-16 mb-4 opacity-20" />
                                <p className="text-lg font-medium text-gray-400">Sélectionnez un produit</p>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>

        {/* Dialog Création Produit */}
        <Dialog open={showProductDialog} onOpenChange={setShowProductDialog}>
            <DialogContent className="max-w-2xl">
                <DialogHeader><DialogTitle>Nouveau Produit</DialogTitle></DialogHeader>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
                    <div className="space-y-4">
                        <div className="space-y-2"><Label>Nom du modèle</Label><Input value={prodForm.name} onChange={e => setProdForm({...prodForm, name: e.target.value})} placeholder="ex: Sivara Book Pro" /></div>
                        <div className="space-y-2"><Label>Description courte</Label><Textarea value={prodForm.description} onChange={e => setProdForm({...prodForm, description: e.target.value})} placeholder="Caractéristiques principales..." /></div>
                        <div className="space-y-2"><Label>Prix de base ($)</Label><Input type="number" value={prodForm.base_price} onChange={e => setProdForm({...prodForm, base_price: parseFloat(e.target.value)})} /></div>
                    </div>
                    
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>Image du produit</Label>
                            <div className="border-2 border-dashed border-gray-200 rounded-lg h-32 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => fileInputRef.current?.click()}>
                                {prodForm.image_url ? <img src={prodForm.image_url} className="h-full w-full object-cover rounded-lg" /> : <>{isUploading ? <Loader2 className="h-6 w-6 animate-spin text-gray-400" /> : <Upload className="h-6 w-6 text-gray-400" />}<span className="text-xs text-gray-500 mt-2">Cliquez pour uploader</span></>}
                            </div>
                            <input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                        </div>
                        <div className="space-y-2"><Label>Disponibilité</Label><Input value={prodForm.availability} onChange={e => setProdForm({...prodForm, availability: e.target.value})} placeholder="ex: Global" /></div>
                    </div>
                </div>
                <DialogFooter><Button onClick={handleSaveProduct}>Créer la fiche</Button></DialogFooter>
            </DialogContent>
        </Dialog>

        {/* Dialog Création Unité */}
        <Dialog open={showUnitDialog} onOpenChange={setShowUnitDialog}>
            <DialogContent className="max-w-3xl">
                <DialogHeader><DialogTitle>Ajouter une Unité</DialogTitle></DialogHeader>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 py-4">
                    <div className="space-y-6">
                        <div className="space-y-4">
                            <h3 className="font-semibold text-sm text-gray-900 border-b pb-2">Spécifications</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2"><Label>Quantité RAM</Label><Select value={unitForm.ram_size} onValueChange={(v) => setUnitForm({...unitForm, ram_size: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="16">16 GB</SelectItem><SelectItem value="32">32 GB</SelectItem><SelectItem value="64">64 GB</SelectItem></SelectContent></Select></div>
                                <div className="space-y-2"><Label>Stockage</Label><Select value={unitForm.storage} onValueChange={(v) => setUnitForm({...unitForm, storage: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="256">256 GB</SelectItem><SelectItem value="512">512 GB</SelectItem><SelectItem value="1024">1 TB</SelectItem></SelectContent></Select></div>
                            </div>
                        </div>
                    </div>
                    <div className="space-y-6">
                        <div className="space-y-4"><h3 className="font-semibold text-sm text-gray-900 border-b pb-2">Prix & Statut</h3><div className="space-y-2"><Label>Prix ($)</Label><Input type="number" value={unitForm.unit_price} onChange={(e) => setUnitForm({...unitForm, unit_price: parseFloat(e.target.value)})} /></div></div>
                    </div>
                </div>
                <DialogFooter><Button onClick={handleSaveUnit}>Ajouter au stock</Button></DialogFooter>
            </DialogContent>
        </Dialog>
    </div>
  );
};

export default DeviceAdmin;