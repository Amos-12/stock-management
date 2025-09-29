import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Bell, 
  Package, 
  AlertTriangle, 
  CheckCircle, 
  TrendingDown,
  RefreshCw
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface StockMovement {
  id: string;
  product_id: string;
  movement_type: string;
  quantity: number;
  previous_quantity: number;
  new_quantity: number;
  reason: string;
  created_at: string;
  created_by: string;
  products?: {
    name: string;
    alert_threshold: number;
  };
}

interface Product {
  id: string;
  name: string;
  quantity: number;
  alert_threshold: number;
  category: string;
}

export const StockAlerts = () => {
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      await Promise.all([
        fetchStockMovements(),
        fetchLowStockProducts()
      ]);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les notifications",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchStockMovements = async () => {
    const { data, error } = await supabase
      .from('stock_movements')
      .select(`
        *,
        products (
          name,
          alert_threshold
        )
      `)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw error;
    setMovements(data || []);
  };

  const fetchLowStockProducts = async () => {
    const { data: products, error } = await supabase
      .from('products')
      .select('*')
      .eq('is_active', true);

    if (error) throw error;

    const lowStock = (products || []).filter(
      product => product.quantity <= product.alert_threshold
    );
    
    setLowStockProducts(lowStock);
  };

  const getMovementTypeColor = (type: string) => {
    switch (type) {
      case 'in':
        return 'default';
      case 'out':
        return 'destructive';
      case 'adjustment':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  const getMovementIcon = (type: string) => {
    switch (type) {
      case 'in':
        return <TrendingDown className="w-4 h-4 rotate-180" />;
      case 'out':
        return <TrendingDown className="w-4 h-4" />;
      default:
        return <Package className="w-4 h-4" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 text-primary animate-spin" />
        <span className="ml-2 text-muted-foreground">Chargement...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Notifications et Alertes</h2>
        <Button onClick={fetchData} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          Actualiser
        </Button>
      </div>

      {/* Alertes Stock Faible */}
      {lowStockProducts.length > 0 && (
        <Alert className="border-warning">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Alerte Stock Faible:</strong> {lowStockProducts.length} produit(s) nécessitent un réapprovisionnement.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Produits en Stock Faible */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-warning" />
              Stock Faible ({lowStockProducts.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {lowStockProducts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle className="w-12 h-12 mx-auto mb-4 text-success opacity-50" />
                <p>Tous les produits ont un stock suffisant</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {lowStockProducts.map((product) => (
                  <div 
                    key={product.id} 
                    className="flex items-center justify-between p-3 border rounded-lg bg-warning/5"
                  >
                    <div>
                      <div className="font-medium">{product.name}</div>
                      <div className="text-sm text-muted-foreground">
                        Catégorie: {product.category}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-warning">
                        {product.quantity} unités
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Seuil: {product.alert_threshold}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Mouvements de Stock Récents */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5" />
              Mouvements Récents ({movements.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {movements.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Aucun mouvement de stock récent</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {movements.map((movement) => (
                  <div 
                    key={movement.id} 
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent transition-smooth"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-secondary">
                        {getMovementIcon(movement.movement_type)}
                      </div>
                      <div>
                        <div className="font-medium">
                          {movement.products?.name || 'Produit inconnu'}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {movement.reason}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(movement.created_at).toLocaleString('fr-FR')}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant={getMovementTypeColor(movement.movement_type)}>
                        {movement.quantity > 0 ? '+' : ''}{movement.quantity}
                      </Badge>
                      <div className="text-xs text-muted-foreground mt-1">
                        {movement.previous_quantity} → {movement.new_quantity}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};