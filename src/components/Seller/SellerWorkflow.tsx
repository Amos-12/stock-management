import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  ShoppingCart, 
  Package, 
  Search,
  Plus,
  Minus,
  Receipt,
  CheckCircle,
  ArrowRight,
  AlertCircle,
  FileText,
  Printer,
  Trash2,
  ChevronDown
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { generateReceipt, generateInvoice } from '@/lib/pdfGenerator';
import jsPDF from 'jspdf';
import logo from '@/assets/logo.png';

interface Product {
  id: string;
  name: string;
  category: string;
  unit: string;
  price: number;
  quantity: number;
  alert_threshold: number;
  is_active: boolean;
  sale_type: 'retail' | 'wholesale';
  // Ceramic-specific fields
  dimension?: string;
  surface_par_boite?: number;
  prix_m2?: number;
  stock_boite?: number;
  // Iron bar-specific fields
  diametre?: string;
  longueur_barre?: number;
  longueur_barre_ft?: number;
  prix_par_metre?: number;
  prix_par_barre?: number;
  stock_barre?: number;
  decimal_autorise?: boolean;
  bars_per_ton?: number;  // Number of bars per metric ton (for iron category)
  // Energy-specific fields
  type_energie?: any;
  puissance?: any;
  voltage?: any;
  capacite?: any;
  // Blocs-specific fields
  bloc_type?: string;
  bloc_poids?: number;
  // Vêtements-specific fields
  vetement_taille?: string;
  vetement_genre?: string;
  vetement_couleur?: string;
}

interface CartItem extends Product {
  cartQuantity: number;
  displayUnit?: string; // For ceramics: "m²", For iron: "barre"
  actualPrice?: number; // Calculated price for ceramics
  sourceUnit?: 'barre' | 'tonne'; // Track original input unit for iron
  sourceValue?: number; // Track original input value for iron
}

type WorkflowStep = 'products' | 'cart' | 'checkout' | 'success';

interface SellerWorkflowProps {
  onSaleComplete?: () => void;
}

export const SellerWorkflow = ({ onSaleComplete }: SellerWorkflowProps) => {
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState<WorkflowStep>('products');
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [saleTypeFilter, setSaleTypeFilter] = useState<'all' | 'retail' | 'wholesale'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [authorizedCategories, setAuthorizedCategories] = useState<string[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [discountType, setDiscountType] = useState<'none' | 'percentage' | 'amount'>('none');
  const [discountValue, setDiscountValue] = useState('0');
  const [isProcessing, setIsProcessing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [completedSale, setCompletedSale] = useState<any>(null);
  const [customQuantityDialog, setCustomQuantityDialog] = useState<{open: boolean, product: Product | null}>({open: false, product: null});
  const [customQuantityValue, setCustomQuantityValue] = useState('');
  const [quantityUnit, setQuantityUnit] = useState<'barre' | 'tonne'>('barre'); // Track selected unit for iron
  const [paymentMethod, setPaymentMethod] = useState<'espece' | 'cheque' | 'virement'>('espece');
  const [companySettings, setCompanySettings] = useState<any>(null);

  // Utility function to format amounts with space as thousands separator
  const formatAmount = (amount: number, currency = true): string => {
    const formatted = amount.toLocaleString('fr-FR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      useGrouping: true
    }).replace(/\s/g, ' '); // Ensure space separator
    return currency ? `${formatted} HTG` : formatted;
  };

  // Utility function to convert decimal tonnage to fractional display
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

  // Convert tonnage to number of bars based on bars_per_ton (ROUNDED TO INTEGER)
  const tonnageToBarres = (tonnage: number, barsPerTon: number): number => {
    return Math.round(tonnage * barsPerTon); // Always return integer bars
  };

  // Convert bars to tonnage for display
  const barresToTonnage = (barres: number, barsPerTon: number): number => {
    return barres / barsPerTon;
  };

  // Load company settings once on mount
  useEffect(() => {
    fetchCompanySettings();
  }, []);

  // Load authorized categories when user is available
  useEffect(() => {
    if (user?.id) {
      loadAuthorizedCategories();
    }
  }, [user?.id]);

  // Fetch products when authorized categories change
  useEffect(() => {
    fetchProducts();
  }, [authorizedCategories]);

  const loadAuthorizedCategories = async () => {
    if (!user?.id) {
      console.log('⚠️ No user ID available yet');
      return; // Don't set anything, wait for user
    }
    
    try {
      console.log('🔍 Loading categories for user:', user.id);
      const { data, error } = await supabase
        .from('seller_authorized_categories')
        .select('category')
        .eq('user_id', user.id);

      if (error) throw error;
      
      if (data && data.length > 0) {
        // Seller has specific category restrictions
        setAuthorizedCategories(data.map(d => d.category));
      } else {
        // Seller has no restrictions = empty array (all categories)
        setAuthorizedCategories([]);
      }
    } catch (error) {
      console.error('Error loading authorized categories:', error);
      // Default to all categories on error
      setAuthorizedCategories([]);
    }
  };

  const fetchCompanySettings = async () => {
    try {
      const { data, error } = await supabase
        .from('company_settings')
        .select('*')
        .limit(1)
        .single();
      
      if (data) setCompanySettings(data);
    } catch (error) {
      console.error('Error fetching company settings:', error);
    }
  };

  useEffect(() => {
    const filtered = products.filter(product => {
      const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.category.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesSaleType = saleTypeFilter === 'all' || product.sale_type === saleTypeFilter;
      const matchesCategory = categoryFilter === 'all' || product.category === categoryFilter;
      return matchesSearch && matchesSaleType && matchesCategory;
    });
    setFilteredProducts(filtered);
  }, [searchTerm, saleTypeFilter, categoryFilter, products]);

  const fetchProducts = async () => {
    try {
      let query = supabase
        .from('products')
        .select('*')
        .eq('is_active', true);
      
      // Filter by authorized categories if restrictions exist (non-empty array)
      if (authorizedCategories.length > 0) {
        query = query.in('category', authorizedCategories as any);
      }
      
      const { data, error } = await query.order('name');

      if (error) throw error;
      
      // Filter products with available stock
      const availableProducts = (data || []).filter((product: Product) => {
        let hasStock = false;
        
        if (product.category === 'ceramique') {
          hasStock = (product.stock_boite || 0) > 0;
          if (hasStock) {
            console.log('✅ Ceramique available:', product.name, 'stock_boite:', product.stock_boite);
          }
        } else if (product.category === 'fer') {
          hasStock = (product.stock_barre || 0) > 0;
        } else {
          hasStock = product.quantity > 0;
        }
        
        return hasStock;
      });
    
      const byCat = availableProducts.reduce((acc: any, p: Product) => {
        acc[p.category] = (acc[p.category] || 0) + 1;
        return acc;
      }, {});
      console.log(byCat);
      
      setProducts(availableProducts as Product[]);
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

  const addToCart = (product: Product, customQty?: number, inputUnit?: 'barre' | 'tonne') => {
    // For ceramics, open dialog to get m² needed
    if (product.category === 'ceramique' && !customQty) {
      setCustomQuantityDialog({open: true, product});
      setQuantityUnit('barre'); // Reset unit
      return;
    }

    // For iron bars, open dialog if no custom quantity provided
    if (product.category === 'fer' && !customQty) {
      setCustomQuantityDialog({open: true, product});
      setQuantityUnit('barre'); // Default to barre
      return;
    }

    let quantityToAdd = customQty || 1;
    let actualPrice = product.price;
    let displayUnit = product.unit;
    let sourceUnit: 'barre' | 'tonne' | undefined;
    let sourceValue: number | undefined;

    // Calculate for ceramics - keep exact decimal quantities
    if (product.category === 'ceramique' && product.surface_par_boite && product.prix_m2) {
      const surfaceNeeded = customQty || 0;
      quantityToAdd = surfaceNeeded; // Store m² directly in cartQuantity
      actualPrice = surfaceNeeded * product.prix_m2; // Price based on exact surface needed
      displayUnit = 'm²';
    }

    // Calculate for iron bars - handle BOTH barre and tonne inputs
    if (product.category === 'fer' && product.prix_par_barre) {
      if (inputUnit === 'tonne') {
        // User selected tonnage input
        if (!product.bars_per_ton) {
          toast({
            title: "Configuration manquante",
            description: "Barres/tonne non défini pour ce diamètre. Impossible d'utiliser l'unité tonne.",
            variant: "destructive"
          });
          return;
        }
        const tonnageInput = customQty || 0;
        quantityToAdd = tonnageToBarres(tonnageInput, product.bars_per_ton); // Convert to INTEGER bars
        actualPrice = product.prix_par_barre * quantityToAdd; // Price per bar * number of bars
        displayUnit = 'barre'; // Standardize display unit
        sourceUnit = 'tonne';
        sourceValue = tonnageInput;
      } else {
        // User selected barres input (default)
        quantityToAdd = Math.max(1, Math.round(customQty || 1)); // Ensure integer
        actualPrice = product.prix_par_barre * quantityToAdd;
        displayUnit = 'barre';
        sourceUnit = 'barre';
        sourceValue = quantityToAdd;
      }
    }
    
    // Calculate for vêtements - standard pricing
    if (product.category === 'vetements') {
      quantityToAdd = customQty || 1;
      actualPrice = product.price * quantityToAdd;
      displayUnit = product.unit;
    }
    // Calculate for all other categories (électroménager, blocs, énergie, etc.)
    else if (product.category !== 'ceramique' && product.category !== 'fer') {
      quantityToAdd = customQty || 1;
      actualPrice = product.price * quantityToAdd;
      displayUnit = product.unit;
    }

    // Get available stock based on category
    const availableStock = product.category === 'ceramique' ? (product.stock_boite || 0) : 
                          product.category === 'fer' ? (product.stock_barre || 0) : 
                          product.quantity;

    // For iron, validate against stock in bars
    if (product.category === 'fer' && quantityToAdd > availableStock) {
      toast({
        title: "Stock insuffisant",
        description: `Stock disponible: ${availableStock} barres`,
        variant: "destructive"
      });
      return;
    }

    setCart(prevCart => {
      const existingItem = prevCart.find(item => item.id === product.id);
      
      if (existingItem) {
        const newCartQuantity = existingItem.cartQuantity + quantityToAdd;
        
        if (newCartQuantity > availableStock) {
          toast({
            title: "Stock insuffisant",
            description: `Stock disponible : ${availableStock} ${product.category === 'fer' ? 'barres' : displayUnit}`,
            variant: "destructive"
          });
          return prevCart;
        }
        
        return prevCart.map(item =>
          item.id === product.id
            ? { 
                ...item, 
                cartQuantity: newCartQuantity, 
                actualPrice: product.category === 'fer' && product.prix_par_barre 
                  ? product.prix_par_barre * newCartQuantity 
                  : actualPrice,
                displayUnit,
                sourceUnit,
                sourceValue
              }
            : item
        );
      } else {
        // Validate stock for new items
        if (quantityToAdd > availableStock) {
          toast({
            title: "Stock insuffisant",
            description: `Quantité demandée : ${quantityToAdd}\nStock disponible : ${availableStock} ${product.category === 'fer' ? 'barres' : displayUnit}`,
            variant: "destructive"
          });
          return prevCart;
        }
        
        return [...prevCart, { 
          ...product, 
          cartQuantity: quantityToAdd,
          actualPrice,
          displayUnit,
          sourceUnit,
          sourceValue
        }];
      }
    });

    setCustomQuantityDialog({open: false, product: null});
    setCustomQuantityValue('');
    setQuantityUnit('barre'); // Reset to default
  };

  const handleCustomQuantitySubmit = () => {
    const product = customQuantityDialog.product;
    if (!product || !customQuantityValue) return;

    const qty = parseFloat(customQuantityValue);
    if (isNaN(qty) || qty <= 0) {
      toast({
        title: "Quantité invalide",
        description: "Veuillez entrer une quantité valide",
        variant: "destructive"
      });
      return;
    }

    // Pass the selected unit for iron products
    if (product.category === 'fer') {
      addToCart(product, qty, quantityUnit);
    } else {
      addToCart(product, qty);
    }
  };

  const removeFromCart = (productId: string) => {
    setCart(prevCart => prevCart.filter(item => item.id !== productId));
    toast({
      title: "Article retiré",
      description: "L'article a été supprimé du panier",
    });
  };

  const handleDirectQuantityChange = (productId: string, newValue: string) => {
    const newQty = parseInt(newValue) || 0;
    
    // Validation minimum
    if (newQty < 1) {
      toast({
        title: "Quantité invalide",
        description: "La quantité doit être au moins 1",
        variant: "destructive"
      });
      return;
    }
    
    setCart(prevCart => {
      return prevCart.map(item => {
        if (item.id !== productId) return item;
        
        // Déterminer le stock disponible selon la catégorie
        let availableStock: number;
        if (item.category === 'ceramique') {
          availableStock = item.stock_boite || 0;
        } else if (item.category === 'fer') {
          availableStock = item.stock_barre || 0;
        } else {
          availableStock = item.quantity;
        }
        
        // Vérifier si la quantité demandée est disponible
        if (newQty > availableStock) {
          toast({
            title: "Stock insuffisant",
            description: `Stock disponible : ${availableStock} ${item.unit}`,
            variant: "destructive"
          });
          return item; // Ne pas modifier
        }
        
        // Calculer le nouveau prix selon la catégorie
        let actualPrice: number;
        
        if (item.category === 'ceramique') {
          actualPrice = (item.prix_m2 || item.price) * newQty;
        } else if (item.category === 'fer') {
          actualPrice = (item.prix_par_barre || item.price) * newQty;
        } else {
          actualPrice = item.price * newQty;
        }
        
        return {
          ...item,
          cartQuantity: newQty,
          actualPrice: actualPrice
        };
      });
    });
  };

  const updateQuantity = (productId: string, change: number) => {
    setCart(prevCart => {
      return prevCart.map(item => {
        if (item.id === productId) {
          // For ceramics, prevent direct +/- as quantity is in m² - user should re-enter surface
          if (item.category === 'ceramique') {
            toast({
              title: "Modification non autorisée",
              description: "Pour les céramiques, veuillez supprimer et ajouter à nouveau avec la surface correcte",
              variant: "destructive"
            });
            return item;
          }
          
          const newQuantity = Math.max(0, item.cartQuantity + change);
          if (newQuantity === 0) {
            return null; // Will be filtered out
          }
          
          // Check stock availability based on category
          const availableStock = item.category === 'fer' ? (item.stock_barre || 0) : item.quantity;
          
          if (newQuantity > availableStock) {
            toast({
              title: "Stock insuffisant",
              description: `Stock disponible : ${availableStock}`,
              variant: "destructive"
            });
            return item;
          }
          
          // Recalculate price and display unit based on category
          let actualPrice = item.price * newQuantity;
          let displayUnit = item.unit;
          
          // Recalculate for iron bars (always work with integer bars)
          if (item.category === 'fer' && item.prix_par_barre) {
            actualPrice = item.prix_par_barre * newQuantity;
            displayUnit = 'barre';
          }
          
          // Recalculate for clothing - standard pricing
          else if (item.category === 'vetements') {
            actualPrice = item.price * newQuantity;
            displayUnit = item.unit;
          }
          
          return { ...item, cartQuantity: newQuantity, actualPrice, displayUnit };
        }
        return item;
      }).filter(Boolean) as CartItem[];
    });
  };

  const getTotalAmount = () => {
    return cart.reduce((total, item) => {
      const price = item.actualPrice !== undefined ? item.actualPrice : (item.price * item.cartQuantity);
      return total + price;
    }, 0);
  };

  const getSubtotal = () => {
    return getTotalAmount();
  };

  const getDiscountAmount = () => {
    const subtotal = getSubtotal();
    const discVal = parseFloat(discountValue) || 0;
    
    if (discountType === 'percentage') {
      return Math.min(subtotal * (discVal / 100), subtotal);
    } else if (discountType === 'amount') {
      return Math.min(discVal, subtotal);
    }
    return 0;
  };

  const getFinalTotal = () => {
    return Math.max(0, getSubtotal() - getDiscountAmount());
  };

  const processSale = async () => {
    if (!user || cart.length === 0) return;

    setIsProcessing(true);

    try {
      const subtotal = getSubtotal();
      const discountAmount = getDiscountAmount();
      const totalAmount = getFinalTotal();

      // Validate cart items before sending
      const invalidItems = cart.filter(item => {
        if (item.category === 'fer') {
          const availableStock = item.stock_barre || 0;
          if (item.cartQuantity > availableStock) {
            return true;
          }
        }
        return false;
      });

      if (invalidItems.length > 0) {
        const itemNames = invalidItems.map(i => i.name).join(', ');
        throw new Error(`Stock insuffisant pour: ${itemNames}. Veuillez ajuster les quantités.`);
      }

      console.log('✅ Cart validation passed:', {
        itemCount: cart.length,
        totalAmount: totalAmount,
        hasDiscount: discountType !== 'none'
      });

      // Prepare sale data for Edge Function
      const saleRequest = {
        customer_name: customerName.trim() || null,
        customer_address: customerAddress.trim() ? customerAddress.trim() : null,
        payment_method: paymentMethod,
        subtotal: subtotal,
        discount_type: discountType,
        discount_value: parseFloat(discountValue) || 0,
        discount_amount: discountAmount,
        total_amount: totalAmount,
        items: cart.map(item => ({
          product_id: item.id,
          product_name: item.name,
          quantity: Math.round(item.cartQuantity), // ALWAYS INTEGER for database
          unit: item.category === 'fer' ? 'barre' : (item.displayUnit || item.unit), // Force 'barre' for iron
          unit_price: item.actualPrice !== undefined ? item.actualPrice / item.cartQuantity : item.price,
          subtotal: item.actualPrice !== undefined ? item.actualPrice : (item.price * item.cartQuantity)
        }))
      };

      console.log('📦 Sale payload:', JSON.stringify(saleRequest, null, 2));

      // Get the current session to pass auth token
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('Session non valide. Veuillez vous reconnecter.');
      }

      // Call Edge Function to process sale with auth header
      const { data, error } = await supabase.functions.invoke('process-sale', {
        body: saleRequest,
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (error) {
        console.error('🔴 Edge Function Error Details:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        throw new Error(`Erreur serveur (${error.code || 'UNKNOWN'}): ${error.message || 'Service temporairement indisponible. Réessayez dans quelques instants.'}`);
      }
      
      if (!data.success) {
        throw new Error(data.error || 'Échec du traitement de la vente');
      }

      toast({
        title: "Vente enregistrée",
        description: `Vente de ${formatAmount(totalAmount)} enregistrée avec succès`,
      });

      setCurrentStep('success');
      setCompletedSale({
        ...data.sale,
        payment_method: paymentMethod,
        customer_address: customerAddress.trim() || null,
        items: cart.map(item => {
          const itemTotal = item.actualPrice !== undefined ? item.actualPrice : (item.price * item.cartQuantity);
          const unitPrice = item.actualPrice !== undefined ? (item.actualPrice / item.cartQuantity) : item.price;
          return {
            name: item.name,
            quantity: item.cartQuantity,
            unit: item.displayUnit || item.unit,
            dimension: item.dimension,
            diametre: item.diametre,
            unit_price: unitPrice,
            total: itemTotal
          };
        })
      });
      
      // Refresh products
      fetchProducts();
      
      // Call parent callback
      onSaleComplete?.();

    } catch (error) {
      console.error('🔴 Erreur détaillée lors du traitement de la vente:', error);
      console.error('🔴 Stack trace:', error instanceof Error ? error.stack : 'N/A');
      console.error('🔴 Cart contents:', JSON.stringify(cart, null, 2));
      
      let errorTitle = "❌ Échec de la vente";
      let errorDescription = "";
      
      if (error instanceof Error) {
        const errorMsg = error.message.toLowerCase();
        
        // Quantité invalide (22P02 error)
        if (errorMsg.includes('22p02') || errorMsg.includes('invalid input syntax for type integer')) {
          errorTitle = "❌ Quantité invalide";
          errorDescription = "Quantité invalide (décimale) détectée. Les barres doivent être entières. Utilisez les boutons tonne: ils arrondissent automatiquement au nombre de barres.";
        }
        // Stock insuffisant
        else if (errorMsg.includes('stock') || errorMsg.includes('insufficient')) {
          errorTitle = "❌ Stock insuffisant";
          errorDescription = `Un ou plusieurs produits n'ont pas assez de stock disponible.\n\nDétails: ${error.message}`;
        } 
        // Problème de session/authentification
        else if (errorMsg.includes('session') || errorMsg.includes('auth') || errorMsg.includes('token')) {
          errorTitle = "🔐 Erreur d'authentification";
          errorDescription = `Votre session a expiré. Veuillez vous reconnecter et réessayer.\n\nDétails: ${error.message}`;
        } 
        // Problème réseau
        else if (errorMsg.includes('network') || errorMsg.includes('fetch') || errorMsg.includes('connection')) {
          errorTitle = "🌐 Problème de connexion";
          errorDescription = `Impossible de contacter le serveur. Vérifiez votre connexion internet.\n\nDétails: ${error.message}`;
        }
        // Erreur serveur
        else if (errorMsg.includes('serveur') || errorMsg.includes('server') || errorMsg.includes('service')) {
          errorTitle = "⚠️ Erreur serveur";
          errorDescription = `Le serveur a rencontré une erreur lors du traitement.\n\nDétails: ${error.message}\n\nVeuillez réessayer dans quelques instants.`;
        }
        // Erreur inconnue
        else {
          errorTitle = "❌ Erreur inattendue";
          errorDescription = `Une erreur s'est produite lors de l'enregistrement de la vente.\n\n📋 Détails techniques:\n${error.message}\n\n💡 Suggestion: Vérifiez les logs de la console (F12) pour plus d'informations.`;
        }
      } else {
        errorDescription = "Erreur inconnue. Contactez le support technique.";
      }
      
      toast({
        title: errorTitle,
        description: errorDescription,
        variant: "destructive",
        duration: 8000, // 8 secondes pour lire
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const resetWorkflow = () => {
    setCurrentStep('products');
    setCart([]);
    setCustomerName('');
    setCustomerAddress('');
    setSearchTerm('');
    setSaleTypeFilter('all');
    setCategoryFilter('all');
    setDiscountType('none');
    setDiscountValue('0');
    setPaymentMethod('espece');
    setCompletedSale(null);
    onSaleComplete?.();
  };

  const printReceipt58mm = async () => {
    if (!completedSale || !companySettings) return;
    
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('user_id', user?.id)
      .single();
    
    generateReceipt(
      completedSale,
      companySettings,
      cart,
      profile?.full_name || 'Vendeur',
      58
    );
  };

  const printReceipt80mm = async () => {
    if (!completedSale || !companySettings) return;
    
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('user_id', user?.id)
      .single();
    
    generateReceipt(
      completedSale,
      companySettings,
      cart,
      profile?.full_name || 'Vendeur',
      80
    );
  };

  const printInvoice = async () => {
    if (!completedSale || !companySettings) return;
    
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('user_id', user?.id)
      .single();
    
    generateInvoice(
      completedSale,
      companySettings,
      cart,
      profile?.full_name || 'Vendeur'
    );
  };

  const categories = [
    { value: 'alimentaires', label: 'Alimentaires' },
    { value: 'boissons', label: 'Boissons' },
    { value: 'gazeuses', label: 'Gazeuses' },
    { value: 'electronique', label: 'Électronique' },
    { value: 'ceramique', label: 'Céramique' },
    { value: 'fer', label: 'Fer / Acier' },
    { value: 'materiaux_de_construction', label: 'Matériaux de construction' },
    { value: 'energie', label: 'Énergie' },
    { value: 'blocs', label: 'Blocs' },
    { value: 'vetements', label: 'Vêtements' },
    { value: 'autres', label: 'Autres' }
  ];

  // Liste dynamique des catégories disponibles avec produits
  const availableCategories = useMemo(() => {
    let categoriesWithProducts = new Set(products.map(p => p.category));
    
    // Filter by authorized categories if restrictions exist (non-empty array)
    const hasRestrictions = authorizedCategories.length > 0;
    if (hasRestrictions) {
      categoriesWithProducts = new Set(
        Array.from(categoriesWithProducts).filter(cat => 
          authorizedCategories.includes(cat)
        )
      );
    }
    
    return [
      { value: 'all', label: 'Toutes les catégories' },
      ...categories.filter(cat => categoriesWithProducts.has(cat.value))
    ];
  }, [products, authorizedCategories]);

  const steps = [
    { id: 'products', label: 'Sélection Produits', icon: Package },
    { id: 'cart', label: 'Panier', icon: ShoppingCart },
    { id: 'checkout', label: 'Finalisation', icon: Receipt },
    { id: 'success', label: 'Confirmation', icon: CheckCircle }
  ];

  const getCurrentStepIndex = () => steps.findIndex(step => step.id === currentStep);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Package className="w-8 h-8 text-primary animate-pulse" />
        <span className="ml-2 text-muted-foreground">Chargement...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Workflow Progress */}
      <Card className="shadow-lg">
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            {steps.map((step, index) => {
              const StepIcon = step.icon;
              const isActive = step.id === currentStep;
              const isCompleted = index < getCurrentStepIndex();
              
              return (
                <div key={step.id} className="flex items-center w-full sm:w-auto">
                  <div className="flex items-center flex-1 sm:flex-initial">
                    <div
                      className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-smooth ${
                        isActive
                          ? 'border-primary bg-primary text-primary-foreground'
                          : isCompleted
                          ? 'border-success bg-success text-success-foreground'
                          : 'border-muted-foreground text-muted-foreground'
                      }`}
                    >
                      <StepIcon className="w-5 h-5" />
                    </div>
                    <div className="ml-3">
                      <div className={`text-sm font-medium ${isActive ? 'text-primary' : isCompleted ? 'text-success' : 'text-muted-foreground'}`}>
                        {step.label}
                      </div>
                    </div>
                  </div>
                  {index < steps.length - 1 && (
                    <ArrowRight className="hidden sm:block w-5 h-5 mx-4 text-muted-foreground" />
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Step Content */}
      {currentStep === 'products' && (
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              Étape 1: Sélection des Produits
            </CardTitle>
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher un produit..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={saleTypeFilter === 'all' ? 'default' : 'outline'}
                  onClick={() => setSaleTypeFilter('all')}
                >
                  Tous
                </Button>
                <Button
                  size="sm"
                  variant={saleTypeFilter === 'retail' ? 'default' : 'outline'}
                  onClick={() => setSaleTypeFilter('retail')}
                >
                  Détail
                </Button>
                <Button
                  size="sm"
                  variant={saleTypeFilter === 'wholesale' ? 'default' : 'outline'}
                  onClick={() => setSaleTypeFilter('wholesale')}
                >
                  Gros
                </Button>
              </div>
              
              <div className="flex gap-2 items-center mt-2">
                <Label htmlFor="category-filter" className="text-sm font-medium text-muted-foreground">
                  Catégorie:
                </Label>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger id="category-filter" className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableCategories.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex justify-between items-center mt-3 px-1">
                <Badge variant="secondary" className="text-base">
                  {filteredProducts.length} produit{filteredProducts.length > 1 ? 's' : ''} disponible{filteredProducts.length > 1 ? 's' : ''}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pb-32">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 max-h-[60vh] md:max-h-[65vh] lg:max-h-[70vh] overflow-y-auto">
              {filteredProducts.map((product) => {
                const cartItem = cart.find(item => item.id === product.id);
                let availableStock = product.quantity;
                let stockLabel = product.unit;
                
                // For ceramics, show boxes and m²
                if (product.category === 'ceramique' && product.stock_boite !== undefined) {
                  availableStock = product.stock_boite;
                  const cartQuantity = cartItem?.cartQuantity || 0; // cartQuantity is in m²
                  const cartBoxes = product.surface_par_boite ? (cartQuantity / product.surface_par_boite) : 0;
                  const remainingBoxes = product.stock_boite - cartBoxes;
                  const surfaceDisponible = product.surface_par_boite ? 
                    (remainingBoxes * product.surface_par_boite).toFixed(2) : 0;
                  stockLabel = `boîtes (${surfaceDisponible} m² restants)`;
                }
                
                // For iron bars
                if (product.category === 'fer' && product.stock_barre !== undefined) {
                  availableStock = product.stock_barre;
                  stockLabel = 'barres';
                }
                
                const cartQuantity = cartItem?.cartQuantity || 0;
                // For ceramics, cartQuantity is in m², need to convert to boxes for stock calculation
                const remainingStock = product.category === 'ceramique' && product.surface_par_boite
                  ? availableStock - (cartQuantity / product.surface_par_boite)
                  : availableStock - cartQuantity;
                
                return (
                  <Card key={product.id} className="border hover:shadow-md transition-smooth">
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        <div>
                          <h4 className="font-semibold text-base">{product.name}</h4>
                          
                          {/* Ceramic product details */}
                          {product.category === 'ceramique' && (
                            <div className="space-y-1 mt-1">
                              {product.dimension && (
                                <p className="text-xs text-muted-foreground">📐 Dimension: {product.dimension}</p>
                              )}
                              {product.surface_par_boite && (
                                <p className="text-xs text-muted-foreground">📦 Surface/boîte: {product.surface_par_boite} m²</p>
                              )}
                            </div>
                          )}
                          
                          {/* Iron bar details */}
                          {product.category === 'fer' && (
                            <div className="space-y-1 mt-1">
                              {product.diametre && (
                                <p className="text-xs text-muted-foreground">⭕ Diamètre: {product.diametre}</p>
                              )}
                              {product.longueur_barre_ft && (
                                <p className="text-xs text-muted-foreground">📏 Longueur: {product.longueur_barre_ft} ft</p>
                              )}
                            </div>
                          )}
                          
                          {/* Energy product details */}
                          {product.category === 'energie' && (
                            <div className="space-y-1 mt-1">
                              {product.type_energie && (
                                <p className="text-xs text-muted-foreground">⚡ Type: {product.type_energie}</p>
                              )}
                              {product.puissance && (
                                <p className="text-xs text-muted-foreground">💪 Puissance: {product.puissance}W</p>
                              )}
                              {product.voltage && (
                                <p className="text-xs text-muted-foreground">🔌 Voltage: {product.voltage}V</p>
                              )}
                              {product.capacite && (
                                <p className="text-xs text-muted-foreground">🔋 Capacité: {product.capacite}Ah</p>
                              )}
                            </div>
                          )}

                          {/* Blocs product details */}
                          {product.category === 'blocs' && (
                            <div className="space-y-1 mt-1">
                              {product.bloc_type && (
                                <p className="text-xs text-muted-foreground">🧱 Type: {product.bloc_type}</p>
                              )}
                              {product.bloc_poids && (
                                <p className="text-xs text-muted-foreground">⚖️ Poids: {product.bloc_poids} kg</p>
                              )}
                            </div>
                          )}

                          {/* Vêtements product details */}
                          {product.category === 'vetements' && (
                            <div className="space-y-1 mt-1">
                              {product.vetement_taille && (
                                <p className="text-xs text-muted-foreground">📏 Taille: {product.vetement_taille}</p>
                              )}
                              {product.vetement_genre && (
                                <p className="text-xs text-muted-foreground">👤 Genre: {product.vetement_genre}</p>
                              )}
                              {product.vetement_couleur && (
                                <p className="text-xs text-muted-foreground">🎨 Couleur: {product.vetement_couleur}</p>
                              )}
                            </div>
                          )}
                          
                          <div className="flex items-center gap-2 text-sm flex-wrap mt-2">
                            <Badge variant="outline" className="text-xs">
                              {categories.find(c => c.value === product.category)?.label}
                            </Badge>
                            <Badge variant={product.sale_type === 'retail' ? 'default' : 'secondary'} className="text-xs">
                              {product.sale_type === 'retail' ? 'Détail' : 'Gros'}
                            </Badge>
                          </div>
                          
                          {/* Pricing */}
                          <div className="mt-2">
                            {product.category === 'ceramique' && product.prix_m2 ? (
                              <div className="text-success font-bold text-lg">{formatAmount(product.prix_m2)}/m²</div>
                           ) : product.category === 'fer' && product.prix_par_barre ? (
                              <div className="text-success font-bold text-lg">{formatAmount(product.prix_par_barre)}/barre</div>
                            ) : product.category === 'vetements' ? (
                              <div className="text-success font-bold text-lg">{formatAmount(product.price)}/{product.unit}</div>
                            ) : (
                              <div className="text-success font-bold text-lg">{formatAmount(product.price)}</div>
                            )}
                          </div>
                          
                          {/* Stock info */}
                          <div className="flex items-center gap-2 text-sm mt-2">
                            <Package className="w-4 h-4 text-muted-foreground" />
                            <span className={remainingStock <= product.alert_threshold ? 'text-warning font-medium' : 'text-muted-foreground'}>
                              {product.category === 'ceramique' && product.surface_par_boite 
                                ? `${(remainingStock * product.surface_par_boite).toFixed(2)} m² restants`
                                : `${remainingStock} ${stockLabel}`}
                            </span>
                            {cartQuantity > 0 && (
                              <Badge variant="secondary" className="text-xs">
                                {product.category === 'ceramique' 
                                  ? `${cartQuantity.toFixed(2)} au panier`
                                  : `${cartQuantity} au panier`}
                              </Badge>
                            )}
                            {remainingStock <= product.alert_threshold && (
                              <AlertCircle className="w-4 h-4 text-warning" />
                            )}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => addToCart(product)}
                          disabled={remainingStock === 0}
                          className="w-full"
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          {product.category === 'ceramique' ? 'Entrer surface (m²)' : 
                           product.category === 'fer' ? 'Entrer nombre de barres' : 
                           'Ajouter au panier'}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
            
          </CardContent>
        </Card>
      )}

      {currentStep === 'cart' && (
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5" />
              Étape 2: Révision du Panier
            </CardTitle>
          </CardHeader>
          <CardContent>
            {cart.length === 0 ? (
              <div className="text-center py-8">
                <ShoppingCart className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground">Votre panier est vide</p>
                <Button 
                  onClick={() => setCurrentStep('products')} 
                  className="mt-4"
                  variant="outline"
                >
                  Retour aux produits
                </Button>
              </div>
            ) : (
              <div className="flex flex-col h-[55vh] md:h-[60vh] lg:h-[65vh]">
                {/* Scrollable products list */}
                <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                  {cart.map((item) => {
                    const itemTotal = item.actualPrice !== undefined ? item.actualPrice : (item.price * item.cartQuantity);
                    const displayQuantity = item.category === 'ceramique' ? item.cartQuantity.toFixed(2) : item.cartQuantity;
                    return (
                      <div key={item.id} className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-4 border rounded-lg">
                         <div className="flex-1 min-w-0">
                          <h5 className="font-medium break-words">{item.name}</h5>
                          <p className="text-sm text-muted-foreground break-words">
                            {item.category === 'fer' && item.bars_per_ton 
                              ? item.sourceUnit === 'tonne' 
                                ? `${item.cartQuantity} barres (≈ ${getTonnageLabel(barresToTonnage(item.cartQuantity, item.bars_per_ton))})`
                                : item.cartQuantity % item.bars_per_ton === 0
                                  ? `${item.cartQuantity} barres (= ${item.cartQuantity / item.bars_per_ton} tonne${item.cartQuantity / item.bars_per_ton > 1 ? 's' : ''})`
                                  : `${item.cartQuantity} barres`
                              : item.category === 'ceramique' && item.surface_par_boite
                                ? `${displayQuantity} m² (${(item.cartQuantity / item.surface_par_boite).toFixed(2)} boîtes)`
                                : `${displayQuantity} ${item.unit}`
                            }
                          </p>
                          <p className="text-sm font-medium text-success mt-1">
                            {formatAmount(itemTotal)}
                          </p>
                        </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {item.category === 'ceramique' ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => removeFromCart(item.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateQuantity(item.id, -1)}
                          >
                            <Minus className="w-3 h-3" />
                          </Button>
                          <Input
                            type="number"
                            min="1"
                            max={item.category === 'fer' ? item.stock_barre : item.quantity}
                            value={item.cartQuantity}
                            onChange={(e) => handleDirectQuantityChange(item.id, e.target.value)}
                            className="w-16 text-center text-sm font-medium [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateQuantity(item.id, 1)}
                            disabled={item.cartQuantity >= item.quantity}
                          >
                            <Plus className="w-3 h-3" />
                          </Button>
                        </>
                      )}
                      {item.category !== 'ceramique' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => removeFromCart(item.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                      </div>
                    );
                  })}
                </div>

                {/* Fixed footer with total and buttons */}
                <div className="border-t pt-4 mt-4 bg-background sticky bottom-0">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-lg font-semibold">Total:</span>
                    <span className="text-xl font-bold text-success">
                      {formatAmount(getTotalAmount())}
                    </span>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button 
                      onClick={() => setCurrentStep('products')} 
                      variant="outline"
                      className="flex-1"
                    >
                      Continuer les achats
                    </Button>
                    <Button 
                      onClick={() => setCurrentStep('checkout')} 
                      className="flex-1 gap-2"
                    >
                      Finaliser
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {currentStep === 'checkout' && (
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="w-5 h-5" />
              Étape 3: Finalisation de la Vente
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="customer-name">Nom du client (optionnel)</Label>
              <Input
                id="customer-name"
                placeholder="Nom du client"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="customer-address">Adresse du client (optionnel)</Label>
              <Input
                id="customer-address"
                placeholder="Adresse du client"
                value={customerAddress}
                onChange={(e) => setCustomerAddress(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="payment-method">Méthode de paiement</Label>
              <Select
                value={paymentMethod}
                onValueChange={(value: 'espece' | 'cheque' | 'virement') => setPaymentMethod(value)}
              >
                <SelectTrigger id="payment-method">
                  <SelectValue placeholder="Sélectionner" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="espece">Espèce</SelectItem>
                  <SelectItem value="cheque">Chèque</SelectItem>
                  <SelectItem value="virement">Virement</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="border rounded-lg p-4 bg-muted/50">
              <h4 className="font-medium mb-3">Résumé de la commande</h4>
              {cart.map((item) => {
                const itemTotal = item.actualPrice !== undefined ? item.actualPrice : (item.price * item.cartQuantity);
                const displayQuantity = item.category === 'ceramique' ? `${item.cartQuantity.toFixed(2)} m²` : `${item.cartQuantity} ${item.unit}`;
                return (
                  <div key={item.id} className="flex justify-between text-sm mb-2 gap-2">
                    <span className="break-words">{item.name} × {displayQuantity}</span>
                    <span className="font-medium shrink-0">{formatAmount(itemTotal)}</span>
                  </div>
                );
              })}
              <div className="border-t mt-3 pt-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span><strong>Sous-total</strong></span>
                  <span><strong>{formatAmount(getSubtotal())}</strong></span>
                </div>
                
                {/* Discount Section */}
                <div className="space-y-2 border-t pt-2">
                  <Label htmlFor="discount-type" className="text-sm">Type de remise</Label>
                  <Select
                    value={discountType}
                    onValueChange={(value: 'none' | 'percentage' | 'amount') => setDiscountType(value)}
                  >
                    <SelectTrigger id="discount-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Aucune remise</SelectItem>
                      <SelectItem value="percentage">Pourcentage (%)</SelectItem>
                      <SelectItem value="amount">Montant fixe (HTG)</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  {discountType !== 'none' && (
                    <div className="space-y-2">
                      <Label htmlFor="discount-value" className="text-sm">
                        Valeur de la remise {discountType === 'percentage' ? '(%)' : '(HTG)'}
                      </Label>
                      <Input
                        id="discount-value"
                        type="number"
                        min="0"
                        max={discountType === 'percentage' ? '100' : getSubtotal().toString()}
                        step={discountType === 'percentage' ? '1' : '0.01'}
                        value={discountValue}
                        onChange={(e) => setDiscountValue(e.target.value)}
                        placeholder="0"
                      />
                    </div>
                  )}
                  
                  {discountType !== 'none' && getDiscountAmount() > 0 && (
                    <div className="flex justify-between text-sm text-warning">
                      <span>Remise appliquée</span>
                      <span>-{formatAmount(getDiscountAmount())}</span>
                    </div>
                  )}
                </div>
                
                <div className="border-t pt-2 flex justify-between font-semibold text-lg">
                  <span>Total</span>
                  <span className="text-success">{formatAmount(getFinalTotal())}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                onClick={() => setCurrentStep('cart')}
                variant="outline"
                className="flex-1"
              >
                Retour au panier
              </Button>
              <Button
                onClick={processSale}
                disabled={isProcessing}
                className="flex-1 gap-2"
                variant="default"
              >
                {isProcessing ? 'Traitement...' : (
                  <>
                    Confirmer la vente
                    <CheckCircle className="w-4 h-4" />
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {currentStep === 'success' && (
        <Card className="shadow-lg">
          <CardContent className="p-8 text-center">
            <CheckCircle className="w-16 h-16 text-success mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">Vente confirmée !</h3>
            <p className="text-muted-foreground mb-6">
              La vente de {getFinalTotal().toFixed(2)} HTG a été enregistrée avec succès.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              {completedSale && (
                <>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button 
                        variant="outline" 
                        className="gap-2 w-full sm:w-auto"
                      >
                        <Printer className="w-4 h-4" />
                        Imprimer Reçu Thermique
                        <ChevronDown className="w-4 h-4 ml-1" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={printReceipt58mm}>
                        <Printer className="w-4 h-4 mr-2" />
                        Format 58 mm
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={printReceipt80mm}>
                        <Printer className="w-4 h-4 mr-2" />
                        Format 80 mm
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button 
                    onClick={printInvoice}
                    variant="outline" 
                    className="gap-2 w-full sm:w-auto"
                  >
                    <FileText className="w-4 h-4" />
                    Imprimer Facture A4
                  </Button>
                </>
              )}
              <Button onClick={resetWorkflow} className="gap-2 w-full sm:w-auto">
                <Plus className="w-4 h-4" />
                Nouvelle vente
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Custom Quantity Dialog */}
      <Dialog open={customQuantityDialog.open} onOpenChange={(open) => {
        if (!open) {
          setCustomQuantityDialog({open: false, product: null});
          setCustomQuantityValue('');
          setQuantityUnit('barre'); // Reset unit
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {customQuantityDialog.product?.category === 'ceramique' 
                ? 'Entrer la surface nécessaire' 
                : 'Entrer la quantité'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {customQuantityDialog.product && (
              <div className="p-3 border rounded-lg bg-muted/50">
                <p className="font-medium">{customQuantityDialog.product.name}</p>
                {customQuantityDialog.product.category === 'ceramique' && (
                  <>
                    <p className="text-sm text-muted-foreground">
                      Dimension: {customQuantityDialog.product.dimension}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Surface par boîte: {customQuantityDialog.product.surface_par_boite} m²
                    </p>
                    <p className="text-sm text-success">
                      Prix: {customQuantityDialog.product.prix_m2} HTG/m²
                    </p>
                  </>
                )}
                {customQuantityDialog.product.category === 'fer' && (
                  <>
                    <p className="text-sm text-muted-foreground">
                      Diamètre: {customQuantityDialog.product.diametre}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Longueur: {customQuantityDialog.product.longueur_barre_ft} ft par barre
                    </p>
                    <p className="text-sm text-success">
                      Prix: {customQuantityDialog.product.prix_par_barre} HTG/barre
                      {customQuantityDialog.product.bars_per_ton && (
                        <span className="text-xs text-muted-foreground block">
                          ({customQuantityDialog.product.bars_per_ton} barres/tonne)
                        </span>
                      )}
                    </p>
                  </>
                )}
              </div>
            )}
            
            {/* Unit selector for iron products */}
            {customQuantityDialog.product?.category === 'fer' && customQuantityDialog.product.bars_per_ton && (
              <div className="space-y-2">
                <Label>Unité</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={quantityUnit === 'barre' ? 'default' : 'outline'}
                    onClick={() => setQuantityUnit('barre')}
                    className="flex-1"
                  >
                    Barres
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={quantityUnit === 'tonne' ? 'default' : 'outline'}
                    onClick={() => setQuantityUnit('tonne')}
                    className="flex-1"
                  >
                    Tonnes
                  </Button>
                </div>
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="custom-quantity">
                {customQuantityDialog.product?.category === 'ceramique' 
                  ? 'Surface nécessaire (m²)' 
                  : customQuantityDialog.product?.category === 'fer'
                    ? quantityUnit === 'barre' ? 'Quantité (barres)' : 'Quantité (tonnes)'
                    : 'Quantité'}
              </Label>
              
              {/* Quick fraction buttons for iron (only when tonne is selected) */}
              {customQuantityDialog.product?.category === 'fer' && quantityUnit === 'tonne' && (
                <div className="grid grid-cols-4 gap-2 mb-3">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setCustomQuantityValue('0.25')}
                    className="text-xs"
                  >
                    1/4 T
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setCustomQuantityValue('0.5')}
                    className="text-xs"
                  >
                    1/2 T
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setCustomQuantityValue('0.75')}
                    className="text-xs"
                  >
                    3/4 T
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setCustomQuantityValue('1')}
                    className="text-xs"
                  >
                    1 T
                  </Button>
                </div>
              )}
              
              <Input
                id="custom-quantity"
                type="number"
                step={customQuantityDialog.product?.category === 'fer' && quantityUnit === 'barre' ? '1' : '0.01'}
                min="0"
                value={customQuantityValue}
                onChange={(e) => setCustomQuantityValue(e.target.value)}
                placeholder={
                  customQuantityDialog.product?.category === 'ceramique' 
                    ? 'Ex: 15.5' 
                    : quantityUnit === 'barre' 
                      ? 'Ex: 10' 
                      : 'Ex: 0.5'
                }
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleCustomQuantitySubmit();
                  }
                }}
              />
              {customQuantityDialog.product?.category === 'ceramique' && customQuantityValue && (
                <p className="text-xs text-muted-foreground">
                  {customQuantityDialog.product.surface_par_boite && (
                    <> 
                      Boîtes nécessaires: {(parseFloat(customQuantityValue) / customQuantityDialog.product.surface_par_boite).toFixed(2)}
                      {' '}(≈ {parseFloat(customQuantityValue).toFixed(2)} m²)
                    </>
                  )}
                </p>
              )}
              {customQuantityDialog.product?.category === 'fer' && customQuantityValue && customQuantityDialog.product.bars_per_ton && (
                <p className="text-xs text-muted-foreground">
                  {quantityUnit === 'tonne' ? (
                    <>
                      <span className="block font-medium">{getTonnageLabel(parseFloat(customQuantityValue))}</span>
                      <span className="block">
                        ≈ {tonnageToBarres(parseFloat(customQuantityValue), customQuantityDialog.product.bars_per_ton)} barres (arrondi)
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="block">{parseFloat(customQuantityValue)} barres</span>
                      {parseFloat(customQuantityValue) % customQuantityDialog.product.bars_per_ton === 0 && (
                        <span className="block">
                          = {parseFloat(customQuantityValue) / customQuantityDialog.product.bars_per_ton} tonne{parseFloat(customQuantityValue) / customQuantityDialog.product.bars_per_ton > 1 ? 's' : ''}
                        </span>
                      )}
                    </>
                  )}
                </p>
              )}
            </div>
            <div className="flex gap-2 justify-end">
              <Button 
                variant="outline" 
                onClick={() => {
                  setCustomQuantityDialog({open: false, product: null});
                  setCustomQuantityValue('');
                  setQuantityUnit('barre');
                }}
              >
                Annuler
              </Button>
              <Button onClick={handleCustomQuantitySubmit}>
                Ajouter au panier
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bouton flottant du panier - visible uniquement sur l'étape produits */}
      {cart.length > 0 && currentStep === 'products' && (
        <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-gradient-to-t from-background via-background to-transparent pointer-events-none">
          <div className="max-w-7xl mx-auto pointer-events-auto">
            <Card className="shadow-2xl border-2 border-primary/20">
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                  {/* Résumé du panier */}
                  <div className="flex items-center gap-4 flex-1">
                    <div className="flex items-center gap-2">
                      <ShoppingCart className="w-5 h-5 text-primary" />
                      <Badge variant="default" className="text-sm">
                        {cart.length} article{cart.length > 1 ? 's' : ''}
                      </Badge>
                    </div>
                    <Separator orientation="vertical" className="h-6 hidden sm:block" />
                    <div className="text-sm">
                      <span className="text-muted-foreground">Total : </span>
                      <span className="font-bold text-lg text-success">
                        {formatAmount(cart.reduce((total, item) => {
                          const itemPrice = item.actualPrice !== undefined 
                            ? item.actualPrice 
                            : (item.price * item.cartQuantity);
                          return total + itemPrice;
                        }, 0))}
                      </span>
                    </div>
                  </div>
                  
                  {/* Bouton Voir le panier */}
                  <Button 
                    onClick={() => setCurrentStep('cart')} 
                    className="gap-2 w-full sm:w-auto shadow-lg"
                    size="lg"
                  >
                    Voir le panier
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
     </div>
   );
 };