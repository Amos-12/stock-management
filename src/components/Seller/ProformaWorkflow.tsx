import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  ShoppingCart, 
  Package, 
  Search,
  Plus,
  Minus,
  ArrowRight,
  FileText,
  Printer,
  Trash2,
  Grid3X3,
  List,
  X,
  ArrowLeft,
  Download,
  Calendar,
  RefreshCw,
  Zap,
  Droplet,
  Wrench,
  Blocks,
  Shirt,
  Home,
  Coffee,
  CircleDot
} from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { generateProforma } from '@/lib/pdfGenerator';
import { useCategories, useSousCategories } from '@/hooks/useCategories';
import { useCurrencyCalculations } from '@/hooks/useCurrencyCalculations';
import { useCompanySettings } from '@/hooks/useCompanySettings';

interface Product {
  id: string;
  name: string;
  barcode?: string;
  category: string;
  unit: string;
  price: number;
  quantity: number;
  alert_threshold: number;
  is_active: boolean;
  sale_type: 'retail' | 'wholesale';
  currency: 'USD' | 'HTG';
  dimension?: string;
  surface_par_boite?: number;
  prix_m2?: number;
  stock_boite?: number;
  diametre?: string;
  longueur_barre?: number;
  longueur_barre_ft?: number;
  prix_par_metre?: number;
  prix_par_barre?: number;
  stock_barre?: number;
  decimal_autorise?: boolean;
  bars_per_ton?: number;
  type_energie?: any;
  puissance?: any;
  voltage?: any;
  capacite?: any;
  bloc_type?: string;
  bloc_poids?: number;
  vetement_taille?: string;
  vetement_genre?: string;
  vetement_couleur?: string;
  electromenager_sous_categorie?: string;
  electromenager_marque?: string;
  electromenager_modele?: string;
  specifications_techniques?: any;
}

interface CartItem extends Product {
  cartQuantity: number;
  displayUnit?: string;
  actualPrice?: number;
  sourceUnit?: 'barre' | 'tonne';
  sourceValue?: number;
}

type WorkflowStep = 'products' | 'preview';

// Session counter for proforma numbering
let proformaCounter = 1;

const getCategoryIcon = (category: string) => {
  const icons: Record<string, any> = {
    'fer': Wrench,
    'ceramique': Blocks,
    'energie': Zap,
    'boissons': Droplet,
    'gazeuses': Droplet,
    'alimentaires': Coffee,
    'blocs': Blocks,
    'vetements': Shirt,
    'electromenager': Home,
    'materiaux_de_construction': Blocks,
    'electronique': Zap,
    'autres': Package
  };
  return icons[category] || Package;
};

const getCategoryColor = (category: string) => {
  const colors: Record<string, string> = {
    'fer': 'bg-slate-500',
    'ceramique': 'bg-amber-500',
    'energie': 'bg-yellow-500',
    'boissons': 'bg-blue-500',
    'gazeuses': 'bg-cyan-500',
    'alimentaires': 'bg-green-500',
    'blocs': 'bg-gray-500',
    'vetements': 'bg-pink-500',
    'electromenager': 'bg-purple-500',
    'materiaux_de_construction': 'bg-orange-500',
    'electronique': 'bg-indigo-500',
    'autres': 'bg-gray-400'
  };
  return colors[category] || 'bg-gray-400';
};

export const ProformaWorkflow = () => {
  const { user, profile } = useAuth();
  const { categories: dynamicCategories } = useCategories();
  const { sousCategories: dynamicSousCategories } = useSousCategories();
  const { settings: companySettings } = useCompanySettings();
  const currencyCalc = useCurrencyCalculations();

  const [currentStep, setCurrentStep] = useState<WorkflowStep>('products');
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [sousCategoryFilter, setSousCategoryFilter] = useState<string>('all');
  const [customerName, setCustomerName] = useState('');
  const [validityDays, setValidityDays] = useState<string>('7');
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'cards' | 'list'>('cards');
  const [customQuantityValue, setCustomQuantityValue] = useState('');
  const [quantityUnit, setQuantityUnit] = useState<'barre' | 'tonne'>('barre');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showQuantityDialog, setShowQuantityDialog] = useState(false);
  const [authorizedCategories, setAuthorizedCategories] = useState<string[]>([]);

  // Dynamic categories for filtering
  const availableDynamicCategories = useMemo(() => {
    return [{ id: 'all', nom: 'Toutes les catégories' }, ...dynamicCategories];
  }, [dynamicCategories]);

  const availableSousCategories = useMemo(() => {
    if (categoryFilter === 'all') {
      return [{ id: 'all', nom: 'Toutes les sous-catégories' }, ...dynamicSousCategories];
    }
    const filtered = dynamicSousCategories.filter(sc => sc.categorie_id === categoryFilter);
    return [{ id: 'all', nom: 'Toutes les sous-catégories' }, ...filtered];
  }, [categoryFilter, dynamicSousCategories]);

  useEffect(() => {
    setSousCategoryFilter('all');
  }, [categoryFilter]);

  const formatAmount = (amount: number, currency: 'USD' | 'HTG' | boolean = true): string => {
    const formatted = amount.toLocaleString('fr-FR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      useGrouping: true
    }).replace(/\s/g, ' ');
    
    if (currency === false) return formatted;
    if (currency === 'USD') return `$${formatted}`;
    return `${formatted} HTG`;
  };

  // Utility functions for iron calculations
  const tonnageToBarres = (tonnage: number, barsPerTon: number): number => {
    return Math.round(tonnage * barsPerTon);
  };

  const getTonnageLabel = (tonnage: number): string => {
    const integerPart = Math.floor(tonnage);
    const decimalPart = tonnage - integerPart;
    
    let fractionStr = '';
    if (Math.abs(decimalPart - 0.25) < 0.01) {
      fractionStr = '1/4';
    } else if (Math.abs(decimalPart - 0.5) < 0.01) {
      fractionStr = '1/2';
    } else if (Math.abs(decimalPart - 0.75) < 0.01) {
      fractionStr = '3/4';
    } else if (decimalPart > 0.01) {
      fractionStr = decimalPart.toFixed(2);
    }
    
    if (integerPart > 0) {
      return fractionStr ? `${integerPart} ${fractionStr} tonne${tonnage > 1 ? 's' : ''}` : `${integerPart} tonne${integerPart > 1 ? 's' : ''}`;
    } else {
      return fractionStr ? `${fractionStr} tonne` : `${tonnage.toFixed(2)} tonne${tonnage > 1 ? 's' : ''}`;
    }
  };

  // Load authorized categories
  useEffect(() => {
    if (user?.id) {
      loadAuthorizedCategories();
    }
  }, [user?.id]);

  useEffect(() => {
    fetchProducts();
  }, [authorizedCategories]);

  const loadAuthorizedCategories = async () => {
    if (!user?.id) return;
    
    try {
      const { data, error } = await supabase
        .from('seller_authorized_categories')
        .select('category')
        .eq('user_id', user.id);

      if (error) throw error;
      
      if (data && data.length > 0) {
        setAuthorizedCategories(data.map(d => d.category));
      } else {
        setAuthorizedCategories([]);
      }
    } catch (error) {
      console.error('Error loading authorized categories:', error);
      setAuthorizedCategories([]);
    }
  };

  const fetchProducts = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('products')
        .select('*')
        .eq('is_active', true);
      
      if (authorizedCategories.length > 0) {
        query = query.in('category', authorizedCategories as any);
      }
      
      const { data, error } = await query.order('name');

      if (error) throw error;
      
      const availableProducts = (data || []).filter((product) => {
        let hasStock = false;
        
        if (product.category === 'ceramique') {
          hasStock = (product.stock_boite || 0) > 0;
        } else if (product.category === 'fer') {
          hasStock = (product.stock_barre || 0) > 0;
        } else {
          hasStock = product.quantity > 0;
        }
        
        return product.is_active && hasStock;
      }).map(p => ({
        ...p,
        currency: (p.currency || 'HTG') as 'USD' | 'HTG'
      }));
      
      setProducts(availableProducts);
      setFilteredProducts(availableProducts);
    } catch (error) {
      console.error('Error fetching products:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les produits",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const filtered = products.filter(product => {
      const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (product.barcode && product.barcode.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesCategory = categoryFilter === 'all' || 
        (product as any).categorie_id === categoryFilter ||
        product.category === categoryFilter;
      
      const matchesSousCategory = sousCategoryFilter === 'all' || 
        (product as any).sous_categorie_id === sousCategoryFilter;
      
      return matchesSearch && matchesCategory && matchesSousCategory;
    });
    setFilteredProducts(filtered);
  }, [searchTerm, categoryFilter, sousCategoryFilter, products]);

  const addToCart = useCallback((product: Product, quantity: number, options?: { unit?: 'barre' | 'tonne', actualPrice?: number }) => {
    setCart(prevCart => {
      const existingItem = prevCart.find(item => item.id === product.id);
      
      if (existingItem) {
        return prevCart.map(item => 
          item.id === product.id 
            ? { 
                ...item, 
                cartQuantity: item.cartQuantity + quantity,
                actualPrice: (item.actualPrice || 0) + (options?.actualPrice || product.price * quantity)
              }
            : item
        );
      }
      
      const newItem: CartItem = {
        ...product,
        cartQuantity: quantity,
        displayUnit: product.category === 'ceramique' ? 'm²' : 
                     product.category === 'fer' ? 'barre' : product.unit,
        actualPrice: options?.actualPrice || product.price * quantity,
        sourceUnit: options?.unit,
        sourceValue: quantity
      };
      
      return [...prevCart, newItem];
    });
    
    toast({
      title: "Ajouté au pro-forma",
      description: `${product.name} x${quantity}`,
    });
  }, []);

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.id !== productId));
  };

  const updateCartQuantity = (productId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeFromCart(productId);
      return;
    }
    
    setCart(prev => prev.map(item => {
      if (item.id !== productId) return item;
      
      const ratio = newQuantity / item.cartQuantity;
      return {
        ...item,
        cartQuantity: newQuantity,
        actualPrice: item.actualPrice ? item.actualPrice * ratio : item.price * newQuantity
      };
    }));
  };

  const clearCart = () => {
    setCart([]);
    setCustomerName('');
    setValidityDays('7');
  };

  // Calculate totals
  const cartTotals = useMemo(() => {
    let totalHTG = 0;
    let totalUSD = 0;
    
    cart.forEach(item => {
      const itemTotal = item.actualPrice || (item.price * item.cartQuantity);
      if (item.currency === 'USD') {
        totalUSD += itemTotal;
      } else {
        totalHTG += itemTotal;
      }
    });
    
    const rate = companySettings.usdHtgRate || 132;
    const displayCurrency = companySettings.displayCurrency || 'HTG';
    
    const unifiedTotal = displayCurrency === 'HTG'
      ? totalHTG + (totalUSD * rate)
      : totalUSD + (totalHTG / rate);
    
    const tvaAmount = unifiedTotal * (companySettings.tvaRate / 100);
    const totalTTC = unifiedTotal + tvaAmount;
    
    return {
      totalHTG,
      totalUSD,
      unifiedTotal,
      tvaAmount,
      totalTTC,
      displayCurrency,
      rate,
      hasMultipleCurrencies: totalHTG > 0 && totalUSD > 0
    };
  }, [cart, companySettings]);

  const generateProformaNumber = () => {
    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const number = `PF-${dateStr}-${String(proformaCounter).padStart(3, '0')}`;
    proformaCounter++;
    return number;
  };

  const handlePrintProforma = () => {
    if (cart.length === 0) {
      toast({
        title: "Panier vide",
        description: "Ajoutez des produits au pro-forma",
        variant: "destructive"
      });
      return;
    }

    const proformaNumber = generateProformaNumber();
    const validityDate = new Date();
    validityDate.setDate(validityDate.getDate() + parseInt(validityDays));

    const proformaData = {
      proforma_number: proformaNumber,
      customer_name: customerName || 'Client',
      validity_days: parseInt(validityDays),
      validity_date: validityDate.toISOString(),
      created_at: new Date().toISOString(),
      subtotal: cartTotals.unifiedTotal,
      tva_amount: cartTotals.tvaAmount,
      total_ttc: cartTotals.totalTTC
    };

    const pdfCompanySettings = {
      company_name: companySettings.companyName,
      company_description: companySettings.companyDescription || undefined,
      address: companySettings.address,
      city: companySettings.city,
      phone: companySettings.phone,
      email: companySettings.email,
      tva_rate: companySettings.tvaRate,
      logo_url: companySettings.logoUrl || undefined,
      usd_htg_rate: companySettings.usdHtgRate,
      default_display_currency: companySettings.displayCurrency
    };

    generateProforma(
      proformaData,
      pdfCompanySettings,
      cart,
      profile?.full_name || 'Vendeur'
    );

    toast({
      title: "Pro-forma généré",
      description: `Numéro: ${proformaNumber}`,
    });
  };

  const handleNewProforma = () => {
    clearCart();
    setCurrentStep('products');
  };

  const handleAddProduct = (product: Product) => {
    if (product.category === 'fer' || product.category === 'ceramique') {
      setSelectedProduct(product);
      setShowQuantityDialog(true);
      setCustomQuantityValue('');
      setQuantityUnit('barre');
    } else {
      addToCart(product, 1);
    }
  };

  const handleConfirmQuantity = () => {
    if (!selectedProduct || !customQuantityValue) return;
    
    const value = parseFloat(customQuantityValue);
    if (isNaN(value) || value <= 0) return;
    
    if (selectedProduct.category === 'fer') {
      let barsQty = value;
      let actualPrice = 0;
      
      if (quantityUnit === 'tonne' && selectedProduct.bars_per_ton) {
        barsQty = tonnageToBarres(value, selectedProduct.bars_per_ton);
      }
      
      if (selectedProduct.prix_par_barre) {
        actualPrice = barsQty * selectedProduct.prix_par_barre;
      } else {
        actualPrice = barsQty * selectedProduct.price;
      }
      
      addToCart(selectedProduct, barsQty, { unit: quantityUnit, actualPrice });
    } else if (selectedProduct.category === 'ceramique') {
      const actualPrice = value * (selectedProduct.prix_m2 || selectedProduct.price);
      addToCart(selectedProduct, value, { actualPrice });
    }
    
    setShowQuantityDialog(false);
    setSelectedProduct(null);
    setCustomQuantityValue('');
  };

  // Render product card
  const renderProductCard = (product: Product) => {
    const CategoryIcon = getCategoryIcon(product.category);
    const categoryColor = getCategoryColor(product.category);
    
    return (
      <Card 
        key={product.id}
        className="hover:shadow-md transition-all cursor-pointer group"
        onClick={() => handleAddProduct(product)}
      >
        <CardContent className="p-3">
          <div className="flex items-start gap-3">
            <div className={`w-10 h-10 rounded-lg ${categoryColor} flex items-center justify-center flex-shrink-0`}>
              <CategoryIcon className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-sm truncate">{product.name}</h4>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="text-xs">
                  {product.category}
                </Badge>
                {product.diametre && (
                  <Badge variant="secondary" className="text-xs">
                    Ø{product.diametre}
                  </Badge>
                )}
                {product.dimension && (
                  <Badge variant="secondary" className="text-xs">
                    {product.dimension}
                  </Badge>
                )}
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-sm font-bold text-primary">
                  {formatAmount(product.price, product.currency)}
                </span>
                <Badge 
                  variant={product.currency === 'USD' ? 'default' : 'secondary'}
                  className={product.currency === 'USD' ? 'bg-green-500' : 'bg-blue-500'}
                >
                  {product.currency}
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  // Render list view
  const renderProductList = () => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Produit</TableHead>
          <TableHead>Catégorie</TableHead>
          <TableHead className="text-right">Prix</TableHead>
          <TableHead className="text-center">Devise</TableHead>
          <TableHead className="text-center">Action</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {filteredProducts.map(product => (
          <TableRow key={product.id} className="cursor-pointer hover:bg-muted/50">
            <TableCell>
              <div className="flex items-center gap-2">
                <span className="font-medium">{product.name}</span>
                {product.diametre && (
                  <Badge variant="outline" className="text-xs">Ø{product.diametre}</Badge>
                )}
              </div>
            </TableCell>
            <TableCell>
              <Badge variant="secondary">{product.category}</Badge>
            </TableCell>
            <TableCell className="text-right font-medium">
              {formatAmount(product.price, product.currency)}
            </TableCell>
            <TableCell className="text-center">
              <Badge 
                variant={product.currency === 'USD' ? 'default' : 'secondary'}
                className={product.currency === 'USD' ? 'bg-green-500 text-white' : 'bg-blue-500 text-white'}
              >
                {product.currency}
              </Badge>
            </TableCell>
            <TableCell className="text-center">
              <Button size="sm" onClick={() => handleAddProduct(product)}>
                <Plus className="w-4 h-4" />
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  // Products step
  const renderProductsStep = () => (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold">Pro-forma</h2>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setViewMode(viewMode === 'cards' ? 'list' : 'cards')}
          >
            {viewMode === 'cards' ? <List className="w-4 h-4" /> : <Grid3X3 className="w-4 h-4" />}
          </Button>
          
          {cart.length > 0 && (
            <Button 
              onClick={() => setCurrentStep('preview')}
              className="relative"
            >
              <ShoppingCart className="w-4 h-4 mr-2" />
              Aperçu ({cart.length})
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          )}
        </div>
      </div>

      {/* Search and Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="relative sm:col-span-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Catégorie" />
          </SelectTrigger>
          <SelectContent>
            {availableDynamicCategories.map(cat => (
              <SelectItem key={cat.id} value={cat.id}>{cat.nom}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sousCategoryFilter} onValueChange={setSousCategoryFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Sous-catégorie" />
          </SelectTrigger>
          <SelectContent>
            {availableSousCategories.map(sc => (
              <SelectItem key={sc.id} value={sc.id}>{sc.nom}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Products Grid/List */}
      {loading ? (
        <div className="text-center py-8 text-muted-foreground">
          Chargement des produits...
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>Aucun produit trouvé</p>
        </div>
      ) : viewMode === 'cards' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredProducts.map(renderProductCard)}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            {renderProductList()}
          </CardContent>
        </Card>
      )}

      {/* Quantity Dialog */}
      {showQuantityDialog && selectedProduct && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Quantité - {selectedProduct.name}</span>
                <Button variant="ghost" size="icon" onClick={() => setShowQuantityDialog(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedProduct.category === 'fer' && (
                <div className="flex gap-2">
                  <Button
                    variant={quantityUnit === 'barre' ? 'default' : 'outline'}
                    className="flex-1"
                    onClick={() => setQuantityUnit('barre')}
                  >
                    Barres
                  </Button>
                  <Button
                    variant={quantityUnit === 'tonne' ? 'default' : 'outline'}
                    className="flex-1"
                    onClick={() => setQuantityUnit('tonne')}
                  >
                    Tonnes
                  </Button>
                </div>
              )}
              
              <div>
                <Label>
                  {selectedProduct.category === 'ceramique' 
                    ? 'Surface (m²)' 
                    : quantityUnit === 'tonne' 
                      ? 'Quantité (tonnes)' 
                      : 'Nombre de barres'}
                </Label>
                <Input
                  type="number"
                  step={selectedProduct.category === 'fer' && quantityUnit === 'tonne' ? '0.25' : '1'}
                  min="0"
                  value={customQuantityValue}
                  onChange={(e) => setCustomQuantityValue(e.target.value)}
                  placeholder="Entrez la quantité"
                  className="mt-2"
                  autoFocus
                />
                
                {selectedProduct.category === 'fer' && quantityUnit === 'tonne' && customQuantityValue && selectedProduct.bars_per_ton && (
                  <p className="text-sm text-muted-foreground mt-2">
                    ≈ {tonnageToBarres(parseFloat(customQuantityValue) || 0, selectedProduct.bars_per_ton)} barres
                  </p>
                )}
              </div>
              
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowQuantityDialog(false)}>
                  Annuler
                </Button>
                <Button className="flex-1" onClick={handleConfirmQuantity}>
                  Ajouter
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );

  // Preview step
  const renderPreviewStep = () => (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => setCurrentStep('products')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour aux produits
        </Button>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleNewProforma}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Nouveau
          </Button>
          <Button onClick={handlePrintProforma}>
            <Printer className="w-4 h-4 mr-2" />
            Imprimer PDF
          </Button>
        </div>
      </div>

      {/* Customer Info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Informations client</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Nom du client</Label>
              <Input
                placeholder="Nom du client (optionnel)"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Validité du devis</Label>
              <Select value={validityDays} onValueChange={setValidityDays}>
                <SelectTrigger className="mt-1">
                  <Calendar className="w-4 h-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 jours</SelectItem>
                  <SelectItem value="15">15 jours</SelectItem>
                  <SelectItem value="30">30 jours</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cart Items */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center justify-between">
            <span>Articles ({cart.length})</span>
            <Button variant="ghost" size="sm" onClick={clearCart} className="text-destructive">
              <Trash2 className="w-4 h-4 mr-1" />
              Vider
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {cart.map(item => {
              const CategoryIcon = getCategoryIcon(item.category);
              const itemTotal = item.actualPrice || (item.price * item.cartQuantity);
              
              return (
                <div key={item.id} className="flex items-center gap-3 p-3 border rounded-lg">
                  <div className={`w-10 h-10 rounded-lg ${getCategoryColor(item.category)} flex items-center justify-center flex-shrink-0`}>
                    <CategoryIcon className="w-5 h-5 text-white" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm truncate">{item.name}</h4>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {item.diametre && <span>Ø{item.diametre}</span>}
                      <span>•</span>
                      <span>{item.cartQuantity} {item.displayUnit || item.unit}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="outline" 
                      size="icon" 
                      className="h-8 w-8"
                      onClick={() => updateCartQuantity(item.id, item.cartQuantity - 1)}
                    >
                      <Minus className="w-3 h-3" />
                    </Button>
                    <span className="w-8 text-center text-sm font-medium">{item.cartQuantity}</span>
                    <Button 
                      variant="outline" 
                      size="icon" 
                      className="h-8 w-8"
                      onClick={() => updateCartQuantity(item.id, item.cartQuantity + 1)}
                    >
                      <Plus className="w-3 h-3" />
                    </Button>
                  </div>
                  
                  <div className="text-right min-w-[80px]">
                    <div className="font-bold text-sm">{formatAmount(itemTotal, item.currency)}</div>
                  </div>
                  
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 text-destructive"
                    onClick={() => removeFromCart(item.id)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Totals */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-2">
            {cartTotals.hasMultipleCurrencies && (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Sous-total HTG</span>
                  <span>{formatAmount(cartTotals.totalHTG, 'HTG')}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Sous-total USD</span>
                  <span>{formatAmount(cartTotals.totalUSD, 'USD')}</span>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Taux de change</span>
                  <span>1 USD = {cartTotals.rate.toFixed(2)} HTG</span>
                </div>
                <Separator className="my-2" />
              </>
            )}
            
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Sous-total HT</span>
              <span className="font-medium">{formatAmount(cartTotals.unifiedTotal, cartTotals.displayCurrency)}</span>
            </div>
            
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">TVA ({companySettings.tvaRate}%) <span className="text-xs">(indicatif)</span></span>
              <span>{formatAmount(cartTotals.tvaAmount, cartTotals.displayCurrency)}</span>
            </div>
            
            <Separator className="my-2" />
            
            <div className="flex justify-between items-center">
              <span className="font-semibold">Total TTC estimé</span>
              <span className="text-xl font-bold text-primary">
                {formatAmount(cartTotals.totalTTC, cartTotals.displayCurrency)}
              </span>
            </div>
          </div>
          
          <div className="mt-4 p-3 bg-muted/50 rounded-lg">
            <p className="text-xs text-muted-foreground text-center">
              Ce document est une estimation et ne constitue pas une facture. 
              Les prix peuvent être sujets à modification.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="space-y-4">
      {currentStep === 'products' && renderProductsStep()}
      {currentStep === 'preview' && renderPreviewStep()}
    </div>
  );
};
