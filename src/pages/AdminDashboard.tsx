import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DashboardLayout } from '@/components/Layout/DashboardLayout';
import { 
  Package, 
  Plus, 
  Edit, 
  Trash2, 
  TrendingUp, 
  AlertTriangle, 
  ShoppingCart, 
  Users,
  DollarSign
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { z } from 'zod';

interface Product {
  id: string;
  name: string;
  category: string;
  description?: string;
  price: number;
  quantity: number;
  alert_threshold: number;
  is_active: boolean;
  created_at: string;
}

interface Sale {
  id: string;
  customer_name?: string;
  total_amount: number;
  payment_method: string;
  created_at: string;
  seller: {
    full_name: string;
  };
}

interface DashboardStats {
  totalProducts: number;
  lowStockProducts: number;
  totalSales: number;
  totalRevenue: number;
}

const productSchema = z.object({
  name: z.string().trim().min(1, 'Le nom est requis').max(100, 'Nom trop long'),
  category: z.string().min(1, 'La catégorie est requise'),
  description: z.string().optional(),
  price: z.number().min(0, 'Le prix doit être positif'),
  quantity: z.number().min(0, 'La quantité doit être positive'),
  alert_threshold: z.number().min(0, 'Le seuil doit être positif')
});

const AdminDashboard = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    totalProducts: 0,
    lowStockProducts: 0,
    totalSales: 0,
    totalRevenue: 0
  });
  const [loading, setLoading] = useState(true);
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [productForm, setProductForm] = useState({
    name: '',
    category: '',
    description: '',
    price: '',
    quantity: '',
    alert_threshold: '10'
  });

  const categories = [
    { value: 'alimentaires', label: 'Alimentaires' },
    { value: 'boissons', label: 'Boissons' },
    { value: 'gazeuses', label: 'Gazeuses' },
    { value: 'electronique', label: 'Électronique' },
    { value: 'autres', label: 'Autres' }
  ];

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch products
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });

      if (productsError) throw productsError;
      setProducts(productsData || []);

      // Fetch recent sales with seller info
      const { data: salesData, error: salesError } = await supabase
        .from('sales')
        .select(`
          id,
          customer_name,
          total_amount,
          payment_method,
          created_at,
          seller_id
        `)
        .order('created_at', { ascending: false })
        .limit(10);

      if (salesError) throw salesError;
      
      // Fetch seller names separately
      const salesWithSellers = await Promise.all(
        (salesData || []).map(async (sale) => {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('user_id', sale.seller_id)
            .single();
          
          return {
            ...sale,
            seller: { full_name: profileData?.full_name || 'Inconnu' }
          };
        })
      );
      
      setSales(salesWithSellers);

      // Calculate stats
      const totalProducts = productsData?.length || 0;
      const lowStockProducts = productsData?.filter(p => p.quantity <= p.alert_threshold).length || 0;
      const totalSales = salesData?.length || 0;
      const totalRevenue = salesData?.reduce((sum, sale) => sum + sale.total_amount, 0) || 0;

      setStats({
        totalProducts,
        lowStockProducts,
        totalSales,
        totalRevenue
      });

    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les données",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setProductForm({
      name: '',
      category: '',
      description: '',
      price: '',
      quantity: '',
      alert_threshold: '10'
    });
    setErrors({});
    setEditingProduct(null);
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    try {
      const validatedData = productSchema.parse({
        ...productForm,
        price: parseFloat(productForm.price),
        quantity: parseInt(productForm.quantity),
        alert_threshold: parseInt(productForm.alert_threshold)
      });

      setIsAddingProduct(true);

      const insertData = {
        name: validatedData.name,
        category: validatedData.category as any,
        description: validatedData.description,
        price: validatedData.price,
        quantity: validatedData.quantity,
        alert_threshold: validatedData.alert_threshold,
        created_by: (await supabase.auth.getUser()).data.user?.id
      };

      const { error } = await supabase
        .from('products')
        .insert(insertData);

      if (error) throw error;

      toast({
        title: "Succès",
        description: "Produit ajouté avec succès"
      });

      resetForm();
      fetchData();

    } catch (error) {
      if (error instanceof z.ZodError) {
        const formattedErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path) {
            formattedErrors[err.path[0]] = err.message;
          }
        });
        setErrors(formattedErrors);
      } else {
        toast({
          title: "Erreur",
          description: "Impossible d'ajouter le produit",
          variant: "destructive"
        });
      }
    } finally {
      setIsAddingProduct(false);
    }
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setProductForm({
      name: product.name,
      category: product.category,
      description: product.description || '',
      price: product.price.toString(),
      quantity: product.quantity.toString(),
      alert_threshold: product.alert_threshold.toString()
    });
  };

  const handleUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;

    setErrors({});

    try {
      const validatedData = productSchema.parse({
        ...productForm,
        price: parseFloat(productForm.price),
        quantity: parseInt(productForm.quantity),
        alert_threshold: parseInt(productForm.alert_threshold)
      });

      const updateData = {
        name: validatedData.name,
        category: validatedData.category as any,
        description: validatedData.description,
        price: validatedData.price,
        quantity: validatedData.quantity,
        alert_threshold: validatedData.alert_threshold
      };

      const { error } = await supabase
        .from('products')
        .update(updateData)
        .eq('id', editingProduct.id);

      if (error) throw error;

      toast({
        title: "Succès",
        description: "Produit modifié avec succès"
      });

      resetForm();
      fetchData();

    } catch (error) {
      if (error instanceof z.ZodError) {
        const formattedErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path) {
            formattedErrors[err.path[0]] = err.message;
          }
        });
        setErrors(formattedErrors);
      } else {
        toast({
          title: "Erreur",
          description: "Impossible de modifier le produit",
          variant: "destructive"
        });
      }
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce produit ?')) return;

    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', productId);

      if (error) throw error;

      toast({
        title: "Succès",
        description: "Produit supprimé avec succès"
      });

      fetchData();

    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de supprimer le produit",
        variant: "destructive"
      });
    }
  };

  if (loading) {
    return (
      <DashboardLayout title="Dashboard Administrateur" role="admin">
        <div className="flex items-center justify-center h-64">
          <Package className="w-8 h-8 text-primary animate-pulse" />
          <span className="ml-2 text-muted-foreground">Chargement...</span>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Dashboard Administrateur" role="admin">
      <div className="space-y-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Produits</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalProducts}</div>
            </CardContent>
          </Card>

          <Card className="shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Stock Faible</CardTitle>
              <AlertTriangle className="h-4 w-4 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-warning">{stats.lowStockProducts}</div>
            </CardContent>
          </Card>

          <Card className="shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ventes Totales</CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalSales}</div>
            </CardContent>
          </Card>

          <Card className="shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Chiffre d'Affaires</CardTitle>
              <DollarSign className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">
                {stats.totalRevenue.toFixed(2)} €
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Products Management */}
        <Card className="shadow-lg">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5" />
                Gestion des Produits
              </CardTitle>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="hero" onClick={resetForm}>
                    <Plus className="w-4 h-4 mr-2" />
                    Nouveau Produit
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>
                      {editingProduct ? 'Modifier le produit' : 'Ajouter un produit'}
                    </DialogTitle>
                  </DialogHeader>
                  <form onSubmit={editingProduct ? handleUpdateProduct : handleAddProduct} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Nom du produit</Label>
                      <Input
                        id="name"
                        value={productForm.name}
                        onChange={(e) => setProductForm(prev => ({ ...prev, name: e.target.value }))}
                        className={errors.name ? 'border-destructive' : ''}
                        required
                      />
                      {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="category">Catégorie</Label>
                      <Select 
                        value={productForm.category} 
                        onValueChange={(value) => setProductForm(prev => ({ ...prev, category: value }))}
                      >
                        <SelectTrigger className={errors.category ? 'border-destructive' : ''}>
                          <SelectValue placeholder="Sélectionner une catégorie" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map(category => (
                            <SelectItem key={category.value} value={category.value}>
                              {category.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {errors.category && <p className="text-sm text-destructive">{errors.category}</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="price">Prix (€)</Label>
                        <Input
                          id="price"
                          type="number"
                          step="0.01"
                          min="0"
                          value={productForm.price}
                          onChange={(e) => setProductForm(prev => ({ ...prev, price: e.target.value }))}
                          className={errors.price ? 'border-destructive' : ''}
                          required
                        />
                        {errors.price && <p className="text-sm text-destructive">{errors.price}</p>}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="quantity">Quantité</Label>
                        <Input
                          id="quantity"
                          type="number"
                          min="0"
                          value={productForm.quantity}
                          onChange={(e) => setProductForm(prev => ({ ...prev, quantity: e.target.value }))}
                          className={errors.quantity ? 'border-destructive' : ''}
                          required
                        />
                        {errors.quantity && <p className="text-sm text-destructive">{errors.quantity}</p>}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="alert_threshold">Seuil d'alerte</Label>
                      <Input
                        id="alert_threshold"
                        type="number"
                        min="0"
                        value={productForm.alert_threshold}
                        onChange={(e) => setProductForm(prev => ({ ...prev, alert_threshold: e.target.value }))}
                        className={errors.alert_threshold ? 'border-destructive' : ''}
                        required
                      />
                      {errors.alert_threshold && <p className="text-sm text-destructive">{errors.alert_threshold}</p>}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="description">Description (optionnelle)</Label>
                      <Textarea
                        id="description"
                        value={productForm.description}
                        onChange={(e) => setProductForm(prev => ({ ...prev, description: e.target.value }))}
                        rows={3}
                      />
                    </div>

                    <div className="flex gap-2 pt-4">
                      <Button type="submit" disabled={isAddingProduct} className="flex-1">
                        {isAddingProduct ? 'Ajout...' : editingProduct ? 'Modifier' : 'Ajouter'}
                      </Button>
                      {editingProduct && (
                        <Button type="button" variant="outline" onClick={resetForm}>
                          Annuler
                        </Button>
                      )}
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom</TableHead>
                    <TableHead>Catégorie</TableHead>
                    <TableHead>Prix</TableHead>
                    <TableHead>Stock</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell className="font-medium">{product.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {categories.find(c => c.value === product.category)?.label}
                        </Badge>
                      </TableCell>
                      <TableCell>{product.price.toFixed(2)} €</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span>{product.quantity}</span>
                          {product.quantity <= product.alert_threshold && (
                            <AlertTriangle className="w-4 h-4 text-warning" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={product.quantity <= product.alert_threshold ? 'destructive' : 'default'}
                        >
                          {product.quantity <= product.alert_threshold ? 'Stock faible' : 'En stock'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEditProduct(product)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDeleteProduct(product.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Recent Sales */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Ventes Récentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Vendeur</TableHead>
                    <TableHead>Montant</TableHead>
                    <TableHead>Paiement</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sales.map((sale) => (
                    <TableRow key={sale.id}>
                      <TableCell>
                        {new Date(sale.created_at).toLocaleDateString('fr-FR')}
                      </TableCell>
                      <TableCell>{sale.customer_name || 'Client anonyme'}</TableCell>
                      <TableCell>{sale.seller.full_name}</TableCell>
                      <TableCell className="font-semibold">
                        {sale.total_amount.toFixed(2)} €
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {sale.payment_method}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default AdminDashboard;