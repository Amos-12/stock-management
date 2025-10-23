import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  Printer
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
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

  const addToCart = (product: Product, customQty?: number) => {
    // For ceramics, open dialog to get m² needed
    if (product.category === 'ceramique' && !customQty) {
      setCustomQuantityDialog({open: true, product});
      return;
    }

    // For iron bars, add directly in barres
    if (product.category === 'fer' && !customQty) {
      setCustomQuantityDialog({open: true, product});
      return;
    }

    let quantityToAdd = customQty || 1;
    let actualPrice = product.price;
    let displayUnit = product.unit;

    // Calculate for ceramics
    if (product.category === 'ceramique' && product.surface_par_boite && product.prix_m2) {
      const surfaceNeeded = customQty || 0;
      const boxesNeeded = Math.ceil(surfaceNeeded / product.surface_par_boite);
      const actualSurface = boxesNeeded * product.surface_par_boite;
      quantityToAdd = boxesNeeded;
      actualPrice = actualSurface * product.prix_m2;
      displayUnit = `m² (${boxesNeeded} boîtes)`;
    }

    // Calculate for iron bars
    if (product.category === 'fer' && product.prix_par_barre) {
      quantityToAdd = customQty || 1;
      actualPrice = product.prix_par_barre * quantityToAdd;
      displayUnit = 'barre';
    }
    
    // Calculate for vêtements - standard pricing
    if (product.category === 'vetements') {
      quantityToAdd = customQty || 1;
      actualPrice = product.price * quantityToAdd;
      displayUnit = product.unit;
    }

    setCart(prevCart => {
      const existingItem = prevCart.find(item => item.id === product.id);
      
      if (existingItem) {
        const newCartQuantity = existingItem.cartQuantity + quantityToAdd;
        const availableStock = product.category === 'ceramique' ? (product.stock_boite || 0) : 
                                product.category === 'fer' ? (product.stock_barre || 0) : 
                                product.quantity;
        
        if (newCartQuantity > availableStock) {
          toast({
            title: "Stock insuffisant",
            description: `Stock disponible : ${availableStock} ${displayUnit}`,
            variant: "destructive"
          });
          return prevCart;
        }
        
        return prevCart.map(item =>
          item.id === product.id
            ? { ...item, cartQuantity: newCartQuantity, actualPrice, displayUnit }
            : item
        );
      } else {
        return [...prevCart, { 
          ...product, 
          cartQuantity: quantityToAdd,
          actualPrice,
          displayUnit
        }];
      }
    });

    setCustomQuantityDialog({open: false, product: null});
    setCustomQuantityValue('');
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

    addToCart(product, qty);
  };

  const updateQuantity = (productId: string, change: number) => {
    setCart(prevCart => {
      return prevCart.map(item => {
        if (item.id === productId) {
          const newQuantity = Math.max(0, item.cartQuantity + change);
          if (newQuantity === 0) {
            return null; // Will be filtered out
          }
          
          // Check stock availability based on category
          const availableStock = item.category === 'ceramique' ? (item.stock_boite || 0) : 
                                item.category === 'fer' ? (item.stock_barre || 0) : 
                                item.quantity;
          
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
          
          // Recalculate for ceramics
          if (item.category === 'ceramique' && item.surface_par_boite && item.prix_m2) {
            const actualSurface = newQuantity * item.surface_par_boite;
            actualPrice = actualSurface * item.prix_m2;
            displayUnit = `m² (${newQuantity} boîtes)`;
          }
          
          // Recalculate for iron bars
          else if (item.category === 'fer' && item.prix_par_barre) {
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
          quantity: item.cartQuantity,
          unit: item.displayUnit || item.unit,
          unit_price: item.actualPrice !== undefined ? item.actualPrice / item.cartQuantity : item.price,
          subtotal: item.actualPrice !== undefined ? item.actualPrice : (item.price * item.cartQuantity)
        }))
      };

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

      if (error) throw error;
      
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
      console.error('Error processing sale:', error);
      const errorMessage = error instanceof Error ? error.message : "Impossible d'enregistrer la vente";
      toast({
        title: "Erreur",
        description: errorMessage,
        variant: "destructive"
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

  const printReceipt = async () => {
    if (!completedSale || !companySettings) return;
    
    try {
      // Format 58mm largeur pour imprimante thermique
      const receiptWidth = 58;
      
      const items = completedSale.items || [];
      
      // Calcul dynamique de la hauteur des infos client
      const customerInfoHeight = 
        (completedSale.customer_name ? 3 : 0) + 
        (completedSale.customer_address ? 3 : 0);
      
      // Calcul dynamique de la hauteur des items
      const itemsHeight = items.reduce((total: number, item: any) => {
        let itemHeight = 6; // hauteur de base du nom du produit + ligne prix
        
        // Si dimension ou diamètre, ajouter une ligne
        if (item.dimension || item.diametre) {
          itemHeight += 3;
        }
        
        // Si longueur en pieds pour le fer, ajouter une ligne
        const ironProd = cart.find((p: any) => p.name === item.name);
        if (ironProd?.longueur_barre_ft && ironProd.category === 'fer') {
          itemHeight += 3;
        }
        
        // Si bloc_type, ajouter une ligne
        if (item.bloc_type) {
          itemHeight += 3;
        }
        
        // Si vêtements (taille ou couleur), ajouter une ligne
        if (item.vetement_taille || item.vetement_couleur) {
          itemHeight += 3;
        }
        
        return total + itemHeight;
      }, 0);
      
      // Calcul du footer
      const hasDiscount = completedSale.discount_amount && completedSale.discount_amount > 0;
      const footerHeight = 30 + (hasDiscount ? 3 : 0); // +3 si remise
      
      const headerHeight = 55; // Légèrement augmenté
      const dynamicHeight = headerHeight + customerInfoHeight + itemsHeight + footerHeight + 15; // +15 marge sécurité
      
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [receiptWidth, dynamicHeight]
      });

      const margin = 3;
      const contentWidth = receiptWidth - (margin * 2);
      let currentY = margin;

      // Add logo image - use company logo if available, otherwise default
      try {
        const logoWidth = 18;
        const logoHeight = 18;
        const logoX = (receiptWidth - logoWidth) / 2;
        const logoToUse = companySettings.logo_url || logo;
        pdf.addImage(logoToUse, 'PNG', logoX, currentY, logoWidth, logoHeight);
        currentY += logoHeight + 3;
      } catch (e) {
        console.error('Error adding logo:', e);
        currentY += 3;
      }
      
      // Company Header - Dynamic from settings
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'bold');
      pdf.text(companySettings.company_name, contentWidth / 2 + margin, currentY, { align: 'center' });
      currentY += 3;
      pdf.setFontSize(6);
      pdf.setFont('helvetica', 'normal');
      pdf.text(companySettings.address, contentWidth / 2 + margin, currentY, { align: 'center' });
      currentY += 2.5;
      pdf.text(companySettings.city, contentWidth / 2 + margin, currentY, { align: 'center' });
      currentY += 2.5;
      pdf.text(`Tel: ${companySettings.phone}`, contentWidth / 2 + margin, currentY, { align: 'center' });
      currentY += 2.5;
      pdf.text(companySettings.email, contentWidth / 2 + margin, currentY, { align: 'center' });
      currentY += 3;
      pdf.text('-------------------------------', contentWidth / 2 + margin, currentY, { align: 'center' });
      
      // Invoice Info
      currentY += 4;
      pdf.setFontSize(7);
      const createdAt = new Date(completedSale.created_at || Date.now());
      const pad = (n: number) => n.toString().padStart(2, '0');
      const codeStamp = `${createdAt.getFullYear()}${pad(createdAt.getMonth()+1)}${pad(createdAt.getDate())}${pad(createdAt.getHours())}${pad(createdAt.getMinutes())}${pad(createdAt.getSeconds())}`;
      const receiptCode = `REC-${codeStamp}`;
      pdf.text(`No: ${receiptCode}`, margin, currentY);
      currentY += 3;
      const dateStr = `${pad(createdAt.getDate())}/${pad(createdAt.getMonth()+1)}/${createdAt.getFullYear()} ${pad(createdAt.getHours())}:${pad(createdAt.getMinutes())}`;
      pdf.text(`Date: ${dateStr}`, margin, currentY);
      
      // Space before customer info
      currentY += 4;
      pdf.text('-------------------------------', contentWidth / 2 + margin, currentY, { align: 'center' });
      
      // Customer Info Section
      currentY += 4;
      if (completedSale.customer_name) {
        pdf.text(`Client: ${completedSale.customer_name.substring(0, 30)}`, margin, currentY);
        currentY += 3;
      }
      if (completedSale.customer_address) {
        pdf.text(`Adresse: ${String(completedSale.customer_address).substring(0, 38)}`, margin, currentY);
        currentY += 3;
      }
      
      
      // Items Header
      currentY += 4;
      pdf.setFontSize(7);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Article', margin, currentY);
      pdf.text('Qte', contentWidth - 30, currentY);
      pdf.text('Prix', contentWidth - 20, currentY);
      pdf.text('Total', contentWidth - 1, currentY, { align: 'right' });
      
      currentY += 2;
      pdf.setFont('helvetica', 'normal');
      
      // Items - Dynamic with all product details
      items.forEach((item: any) => {
        currentY += 3;
        
        // Product name
        let itemName = item.name;
        if (itemName.length > 18) {
          itemName = itemName.substring(0, 18) + '...';
        }
        pdf.setFontSize(6);
        pdf.text(itemName, margin, currentY);
        
        // Add dimension or diameter on next line if available
        if (item.dimension || item.diametre) {
          currentY += 2.5;
          pdf.setFontSize(5);
          const detail = item.dimension ? `(${item.dimension})` : `(Ø ${item.diametre})`;
          pdf.text(detail, margin + 1, currentY);
          pdf.setFontSize(6);
          currentY += 0.5;
        }
        
        // Add longueur for iron bars
        const ironProduct = cart.find(p => p.name === item.name);
        if (ironProduct?.longueur_barre_ft && ironProduct.category === 'fer') {
          currentY += 2.5;
          pdf.setFontSize(5);
          pdf.text(`(${ironProduct.longueur_barre_ft} ft)`, margin + 1, currentY);
          pdf.setFontSize(6);
          currentY += 0.5;
        }
        
        // Add bloc type
        if (item.bloc_type) {
          currentY += 2.5;
          pdf.setFontSize(5);
          pdf.text(`(Type: ${item.bloc_type})`, margin + 1, currentY);
          pdf.setFontSize(6);
          currentY += 0.5;
        }
        
        // Add vêtements details
        if (item.vetement_taille || item.vetement_couleur) {
          currentY += 2.5;
          pdf.setFontSize(5);
          const details = [];
          if (item.vetement_taille) details.push(`T:${item.vetement_taille}`);
          if (item.vetement_couleur) details.push(item.vetement_couleur);
          pdf.text(details.join(' - '), margin + 1, currentY);
          pdf.setFontSize(6);
          currentY += 0.5;
        }
        
        // Quantity, Price, Total on the product name line
        const baseY = item.dimension || item.diametre ? currentY - 3 : currentY;
        pdf.text(item.quantity.toString(), contentWidth - 30, baseY);
        pdf.text(`${formatAmount(item.unit_price, false)}`, contentWidth - 20, baseY);
        pdf.text(`${formatAmount(item.total, false)}`, contentWidth - 2 + margin, baseY, { align: 'right' });
      });
      
      currentY += 3;
      pdf.text('-------------------------------', contentWidth / 2 + margin, currentY, { align: 'center' });
      
      // Subtotal (no TVA on receipt)
      currentY += 4;
      pdf.setFontSize(7);
      pdf.setFont('helvetica', 'normal');
      pdf.text('Sous-total:', margin, currentY);
      pdf.text(`${formatAmount(completedSale.subtotal, false)} HTG`, contentWidth - 2 + margin, currentY, { align: 'right' });
      
      // Discount (if applicable)
      if (completedSale.discount_amount && completedSale.discount_amount > 0) {
        currentY += 3;
        pdf.text(`Remise (${completedSale.discount_type === 'percentage' ? completedSale.discount_value + '%' : 'fixe'}):`, margin, currentY);
        pdf.text(`-${formatAmount(completedSale.discount_amount, false)} HTG`, contentWidth - 2 + margin, currentY, { align: 'right' });
      }
      
      currentY += 3;
      pdf.text('-------------------------------', contentWidth / 2 + margin, currentY, { align: 'center' });
      
      // Total (no TVA displayed on receipt)
      currentY += 4;
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'bold');
      pdf.text('TOTAL:', margin, currentY);
      pdf.text(`${formatAmount(completedSale.total_amount, false)} HTG`, contentWidth - 2 + margin, currentY, { align: 'right' });
      
      currentY += 4;
      pdf.setFontSize(6);
      pdf.setFont('helvetica', 'normal');
      const paymentLabel = completedSale.payment_method === 'espece' ? 'Espèce' : completedSale.payment_method === 'cheque' ? 'Chèque' : completedSale.payment_method === 'virement' ? 'Virement' : String(completedSale.payment_method);
      pdf.text(`Paiement: ${paymentLabel}`, margin, currentY);
      
      currentY += 3;
      pdf.text('-------------------------------', contentWidth / 2 + margin, currentY, { align: 'center' });
      
      // Footer
      currentY += 3;
      pdf.setFont('helvetica', 'italic');
      pdf.setFontSize(5);
      pdf.text(`Merci d'avoir choisi ${companySettings.company_name} !`, contentWidth / 2 + margin, currentY, { align: 'center'});

      // Save and auto-print
      const fileName = `${receiptCode}.pdf`;
      pdf.save(fileName);

      setTimeout(() => {
        window.print();
      }, 500);

      toast({
        title: "Reçu imprimé",
        description: "Le reçu a été généré et envoyé à l'impression"
      });

    } catch (error) {
      console.error('Error printing receipt:', error);
      toast({
        title: "Erreur",
        description: "Impossible d'imprimer le reçu",
        variant: "destructive"
      });
    }
  };

  const printInvoice = async () => {
    if (!completedSale || !companySettings) return;
    
    try {
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pageWidth = 210;
      const pageHeight = 297;
      const margin = 20;
      const contentWidth = pageWidth - (margin * 2);
      let currentY = margin;

      // Add logo image - use company logo if available, otherwise default
      try {
        const logoSize = 36;
        const logoToUse = companySettings.logo_url || logo;
        pdf.addImage(logoToUse, 'PNG', margin, currentY, logoSize, logoSize);
      } catch (e) {
        console.error('Error adding logo to invoice:', e);
      }

      // Invoice number and dates on the right
      const createdAt = new Date(completedSale.created_at || Date.now());
      const pad = (n: number) => n.toString().padStart(2, '0');
      const invoiceSeq = `${createdAt.getFullYear()}${pad(createdAt.getMonth()+1)}${pad(createdAt.getDate())}${pad(createdAt.getHours())}${pad(createdAt.getMinutes())}${pad(createdAt.getSeconds())}`;
      const invoiceNumber = `FACT-${invoiceSeq}`;
      
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(0, 0, 0);
      pdf.text(invoiceNumber, pageWidth - margin, currentY, { align: 'right' });
      
      currentY += 4;
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      const dateStr = `${pad(createdAt.getDate())}/${pad(createdAt.getMonth()+1)}/${createdAt.getFullYear()}`;
      pdf.text(`Date de facturation: ${dateStr}`, pageWidth - margin, currentY, { align: 'right' });
      
      // Company information on the left - Dynamic from settings
      currentY = margin + 42;
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(0, 0, 0);
      pdf.text(companySettings.company_name, margin, currentY);
      
      currentY += 4;
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      pdf.setTextColor(80, 80, 80);
      pdf.text(companySettings.company_description, margin, currentY);
      
      currentY += 5;
      pdf.setFontSize(9);
      pdf.text(companySettings.address, margin, currentY);
      
      currentY += 4;
      pdf.text(companySettings.city, margin, currentY);
      
      currentY += 4;
      pdf.text(companySettings.phone, margin, currentY);
      
      currentY += 4;
      pdf.text(companySettings.email, margin, currentY);

      // Customer information (if provided)
      currentY = margin + 72;
      if (completedSale.customer_name || completedSale.customer_address) {
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(0, 0, 0);
        pdf.text('Information Client :', margin, currentY);
        
        currentY += 5;
        pdf.setFont('helvetica', 'normal');
        if (completedSale.customer_name) {
          pdf.text(completedSale.customer_name, margin, currentY);
          currentY += 4;
        }
        if (completedSale.customer_address) {
          pdf.text(completedSale.customer_address, margin, currentY);
          currentY += 4;
        }
        currentY += 4;
      }

      // Thank you message - Dynamic
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'italic');
      pdf.setTextColor(80, 80, 80);
      pdf.text(`Merci d'avoir choisi ${companySettings.company_name} !`, margin, currentY);
      
      currentY += 4;

      // Table header with gray background
      pdf.setFillColor(220, 220, 220);
      pdf.rect(margin, currentY, contentWidth, 8, 'F');
      
      pdf.setDrawColor(180, 180, 180);
      pdf.setLineWidth(0.3);
      pdf.rect(margin, currentY, contentWidth, 8);

      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(0, 0, 0);

      const colX = {
        description: margin + 2,
        quantity: margin + 65,
        unit: margin + 85,
        unitPrice: margin + 115,
        total: margin + 150
      };

      currentY += 5.5;
      pdf.text('Description', colX.description, currentY);
      pdf.text('Qté', colX.quantity, currentY);
      pdf.text('Unité', colX.unit, currentY);
      pdf.text('Prix unitaire', colX.unitPrice, currentY);
      pdf.text('Montant', colX.total, currentY);

      currentY += 2.5;
      
      // Items
      const items = completedSale.items || [];
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      
      items.forEach((item: any) => {
        const rowHeight = 6;
        currentY += rowHeight;
        
        // Build description
        let description = item.name;
        const details = [];
        
        if (item.dimension) details.push(item.dimension);
        if (item.diametre) details.push(`Ø ${item.diametre}`);
        const ironProd = cart.find(p => p.name === item.name);
        if (ironProd?.longueur_barre_ft && ironProd.category === 'fer') {
          details.push(`${ironProd.longueur_barre_ft} ft`);
        }
        
        // For energy category, add specific fields
        const energyProd = cart.find(p => p.name === item.name);
        if (energyProd?.category === 'energie') {
          if (energyProd.type_energie) details.push(`Type: ${energyProd.type_energie}`);
          if (energyProd.puissance) details.push(`${energyProd.puissance}W`);
          if (energyProd.voltage) details.push(`${energyProd.voltage}V`);
          if (energyProd.capacite) details.push(`${energyProd.capacite}`);
        }
        
        if (details.length > 0) {
          description += ` (${details.join(', ')})`;
        }
        
        // Wrap long descriptions - reduced length due to narrower column
        if (description.length > 40) {
          description = description.substring(0, 38) + '...';
        }
        
        pdf.setTextColor(0, 0, 0);
        pdf.text(description, colX.description, currentY);
        pdf.text(item.quantity.toString(), colX.quantity, currentY);
        pdf.text(item.unit || 'pce', colX.unit, currentY);
        pdf.text(`${formatAmount(item.unit_price, false)} HTG`, colX.unitPrice, currentY);
        pdf.text(`${formatAmount(item.total, false)} HTG`, colX.total, currentY);
      });

      // Totals section
      currentY += 10;
      const totalStartY = currentY;
      
      // Calculate totals - Dynamic TVA from settings
      const subtotalBeforeDiscount = completedSale.subtotal || completedSale.total_amount;
      const discountAmount = completedSale.discount_amount || 0;
      const totalHT = subtotalBeforeDiscount - discountAmount;
      const tvaRate = companySettings.tva_rate / 100;
      const tvaAmount = totalHT * tvaRate;
      const totalTTC = totalHT + tvaAmount;
      
      pdf.setFont('aptos', 'bold');
      pdf.setFontSize(10);
      
      const totalsX = colX.unitPrice;
      
      // Total HT (before discount)
      pdf.text('Total HT', totalsX, currentY, { align: 'right' });
      pdf.text(`${formatAmount(subtotalBeforeDiscount, false)} HTG`, pageWidth - margin, currentY, { align: 'right' });
      
      // Discount (if applicable)
      if (discountAmount > 0) {
        currentY += 6;
        const discountLabel = completedSale.discount_type === 'percentage' 
          ? `Remise (${completedSale.discount_value}%)` 
          : 'Remise';
        pdf.setTextColor(220, 38, 38); // Red for discount
        pdf.text(discountLabel, totalsX, currentY, { align: 'right' });
        pdf.text(`-${formatAmount(discountAmount, false)} HTG`, pageWidth - margin, currentY, { align: 'right' });
        pdf.setTextColor(0, 0, 0); // Reset color
        
        // Total after discount
        currentY += 6;
        pdf.text('Total après remise', totalsX, currentY, { align: 'right' });
        pdf.text(`${formatAmount(totalHT, false)} HTG`, pageWidth - margin, currentY, { align: 'right' });
      }
      
      currentY += 6;
      // TVA with dynamic rate
      pdf.text(`TVA ${companySettings.tva_rate.toFixed(1)} %`, totalsX, currentY, { align: 'right' });
      pdf.text(`${formatAmount(tvaAmount, false)} HTG`, pageWidth - margin, currentY, { align: 'right' });
      
      // Line before Total TTC
      currentY += 2;
      pdf.setDrawColor(0, 0, 0);
      pdf.setLineWidth(0.5);
      pdf.line(totalsX, currentY, pageWidth - margin, currentY);
      
      currentY += 6;
      // Total TTC
      pdf.setFontSize(12);
      pdf.text('Total TTC', totalsX, currentY, { align: 'right' });
      pdf.text(`${formatAmount(totalTTC, false)} HTG`, pageWidth - margin, currentY, { align: 'right' });

      // Payment information
      currentY += 6;
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Moyens de paiement:', margin, currentY);
      
      pdf.setFont('helvetica', 'normal');
      const paymentMethodLabel = {
        espece: 'Espèces',
        cheque: 'Chèque',
        virement: 'Virement bancaire'
      }[completedSale.payment_method] || completedSale.payment_method || 'Espèces';
      pdf.text(paymentMethodLabel, margin + 33, currentY);
      
      // Payment terms from company settings
      if (companySettings.payment_terms) {
        currentY += 8;
        pdf.setFont('helvetica', 'bold');
        pdf.text('Conditions de paiement:', margin, currentY);
        
        pdf.setFont('helvetica', 'normal');
        const termsLines = pdf.splitTextToSize(companySettings.payment_terms, pageWidth - margin * 2 - 50);
        termsLines.forEach((line: string) => {
          pdf.text(line, margin + 38, currentY);
          currentY += 4;
        });
      }

      // Footer - Dynamic from settings
      currentY = pageHeight - 20;
      pdf.setDrawColor(180, 180, 180);
      pdf.setLineWidth(0.3);
      pdf.line(margin, currentY - 5, pageWidth - margin, currentY - 5);
      
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(100, 100, 100);
      pdf.text(`${companySettings.company_name} - ${companySettings.company_description}`, pageWidth / 2, currentY, { align: 'center' });
      
      currentY += 4;
      pdf.text(`${companySettings.address}, ${companySettings.city}`, pageWidth / 2, currentY, { align: 'center' });

      // Save
      const codeStamp = `${createdAt.getFullYear()}${pad(createdAt.getMonth()+1)}${pad(createdAt.getDate())}${pad(createdAt.getHours())}${pad(createdAt.getMinutes())}${pad(createdAt.getSeconds())}`;
      const fileName = `FACT-${codeStamp}.pdf`;
      pdf.save(fileName);

      toast({
        title: "Facture générée",
        description: "La facture a été téléchargée avec succès"
      });

    } catch (error) {
      console.error('Error printing invoice:', error);
      toast({
        title: "Erreur",
        description: "Impossible de générer la facture",
        variant: "destructive"
      });
    }
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
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 max-h-[60vh] md:max-h-[65vh] lg:max-h-[70vh] overflow-y-auto">
              {filteredProducts.map((product) => {
                const cartItem = cart.find(item => item.id === product.id);
                let availableStock = product.quantity;
                let stockLabel = product.unit;
                
                // For ceramics, show boxes and m²
                if (product.category === 'ceramique' && product.stock_boite !== undefined) {
                  availableStock = product.stock_boite;
                  const cartQuantity = cartItem?.cartQuantity || 0;
                  const remainingBoxes = product.stock_boite - cartQuantity;
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
                const remainingStock = availableStock - cartQuantity;
                
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
                              {remainingStock} {stockLabel}
                            </span>
                            {cartQuantity > 0 && (
                              <Badge variant="secondary" className="text-xs">
                                {cartQuantity} au panier
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
            
            {cart.length > 0 && (
              <div className="mt-6 flex flex-col sm:flex-row justify-end gap-2">
                <Button onClick={() => setCurrentStep('cart')} className="gap-2 w-full sm:w-auto">
                  Voir le panier ({cart.length})
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            )}
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
                    return (
                      <div key={item.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex-1">
                          <h5 className="font-medium">{item.name}</h5>
                          <p className="text-sm text-muted-foreground">
                            {item.cartQuantity} {item.displayUnit || item.unit} = {formatAmount(itemTotal)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateQuantity(item.id, -1)}
                          >
                            <Minus className="w-3 h-3" />
                          </Button>
                          <span className="text-sm font-medium w-8 text-center">
                            {item.cartQuantity}
                          </span>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateQuantity(item.id, 1)}
                            disabled={item.cartQuantity >= item.quantity}
                          >
                            <Plus className="w-3 h-3" />
                          </Button>
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
                const displayUnit = item.displayUnit || item.unit;
                return (
                  <div key={item.id} className="flex justify-between text-sm mb-2">
                    <span>{item.name} × {item.cartQuantity} {displayUnit}</span>
                    <span>{formatAmount(itemTotal)}</span>
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
                  <Button 
                    onClick={printReceipt}
                    variant="outline" 
                    className="gap-2 w-full sm:w-auto"
                  >
                    <Printer className="w-4 h-4" />
                    Imprimer Reçu Thermique
                  </Button>
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
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {customQuantityDialog.product?.category === 'ceramique' 
                ? 'Entrer la surface nécessaire' 
                : 'Entrer le nombre de barres'}
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
                    </p>
                  </>
                )}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="custom-quantity">
                {customQuantityDialog.product?.category === 'ceramique' 
                  ? 'Surface nécessaire (m²)' 
                  : 'Nombre de barres'}
              </Label>
              <Input
                id="custom-quantity"
                type="number"
                step={customQuantityDialog.product?.category === 'ceramique' ? '0.01' : '1'}
                min="0"
                value={customQuantityValue}
                onChange={(e) => setCustomQuantityValue(e.target.value)}
                placeholder={customQuantityDialog.product?.category === 'ceramique' ? 'Ex: 15.5' : 'Ex: 10'}
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
                      Boîtes nécessaires: {Math.ceil(parseFloat(customQuantityValue) / customQuantityDialog.product.surface_par_boite)}
                      {' '}(≈ {(Math.ceil(parseFloat(customQuantityValue) / customQuantityDialog.product.surface_par_boite) * customQuantityDialog.product.surface_par_boite).toFixed(2)} m²)
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
     </div>
   );
 };