import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell, Package, AlertTriangle, Check, X, Settings } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface LowStockProduct {
  id: string;
  name: string;
  category: string;
  quantity: number;
  alert_threshold: number;
  price: number;
}

interface StockAlert {
  id: string;
  product: LowStockProduct;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  created_at: string;
}

export const StockAlerts = () => {
  const [alerts, setAlerts] = useState<StockAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState<string[]>([]);

  const fetchLowStockProducts = async () => {
    try {
      setLoading(true);
      
      const { data: products, error } = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .order('quantity', { ascending: true });

      if (error) throw error;

      // Generate alerts for low stock products
      const stockAlerts: StockAlert[] = [];
      
      products?.forEach(product => {
        const stockRatio = product.quantity / product.alert_threshold;
        
        let severity: 'critical' | 'warning' | 'info' = 'info';
        let message = '';

        if (product.quantity === 0) {
          severity = 'critical';
          message = `Rupture de stock pour ${product.name}`;
        } else if (product.quantity <= product.alert_threshold) {
          severity = 'critical';
          message = `Stock critique: ${product.name} (${product.quantity} restant)`;
        } else if (product.quantity <= product.alert_threshold * 1.5) {
          severity = 'warning';
          message = `Stock faible: ${product.name} (${product.quantity} restant)`;
        }

        if (message) {
          stockAlerts.push({
            id: `stock-${product.id}`,
            product,
            severity,
            message,
            created_at: new Date().toISOString()
          });
        }
      });

      setAlerts(stockAlerts);
    } catch (error) {
      console.error('Error fetching stock alerts:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les alertes stock",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLowStockProducts();
    
    // Refresh alerts every 5 minutes
    const interval = setInterval(fetchLowStockProducts, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const dismissAlert = (alertId: string) => {
    setDismissed(prev => [...prev, alertId]);
    toast({
      title: "Alerte masquée",
      description: "L'alerte a été masquée jusqu'au prochain rechargement"
    });
  };

  const markAsResolved = async (alertId: string) => {
    // In a real app, you might want to store resolved alerts in the database
    setDismissed(prev => [...prev, alertId]);
    toast({
      title: "Alerte résolue",
      description: "L'alerte a été marquée comme résolue"
    });
  };

  const getAlertIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertTriangle className="w-4 h-4 text-destructive" />;
      case 'warning':
        return <Package className="w-4 h-4 text-warning" />;
      default:
        return <Bell className="w-4 h-4 text-primary" />;
    }
  };

  const getAlertBadgeVariant = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'destructive' as const;
      case 'warning':
        return 'secondary' as const;
      default:
        return 'outline' as const;
    }
  };

  const activeAlerts = alerts.filter(alert => !dismissed.includes(alert.id));
  const criticalAlerts = activeAlerts.filter(alert => alert.severity === 'critical');
  const warningAlerts = activeAlerts.filter(alert => alert.severity === 'warning');

  if (loading) {
    return (
      <Card className="shadow-lg">
        <CardContent className="p-8">
          <div className="flex items-center justify-center">
            <Bell className="w-8 h-8 text-primary animate-pulse mr-2" />
            <span className="text-muted-foreground">Chargement des alertes...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Alert Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Alertes Actives</CardTitle>
            <Bell className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeAlerts.length}</div>
          </CardContent>
        </Card>

        <Card className="shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Alertes Critiques</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{criticalAlerts.length}</div>
          </CardContent>
        </Card>

        <Card className="shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avertissements</CardTitle>
            <Package className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">{warningAlerts.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Alerts List */}
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5" />
              Alertes de Stock
            </CardTitle>
            <Button variant="outline" size="sm" onClick={fetchLowStockProducts}>
              <Settings className="w-4 h-4 mr-2" />
              Actualiser
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {activeAlerts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Bell className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">Aucune alerte active</p>
              <p>Tous vos produits sont en stock suffisant</p>
            </div>
          ) : (
            <div className="space-y-4">
              {activeAlerts.map((alert) => (
                <div 
                  key={alert.id} 
                  className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border-l-4 border-l-primary"
                  style={{
                    borderLeftColor: alert.severity === 'critical' ? 'hsl(var(--destructive))' :
                                   alert.severity === 'warning' ? 'hsl(var(--warning))' :
                                   'hsl(var(--primary))'
                  }}
                >
                  <div className="flex items-center gap-4">
                    {getAlertIcon(alert.severity)}
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">{alert.message}</span>
                        <Badge variant={getAlertBadgeVariant(alert.severity)}>
                          {alert.severity === 'critical' ? 'Critique' : 
                           alert.severity === 'warning' ? 'Attention' : 'Info'}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        <span className="capitalize">{alert.product.category}</span> • 
                        <span className="ml-1">{alert.product.price.toFixed(2)} €</span> • 
                        <span className="ml-1">Seuil: {alert.product.alert_threshold}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => markAsResolved(alert.id)}
                      className="hover:bg-success/10 hover:text-success"
                    >
                      <Check className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => dismissAlert(alert.id)}
                      className="hover:bg-muted"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      {activeAlerts.length > 0 && (
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg">Actions Rapides</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" className="text-success hover:bg-success/10">
                <Package className="w-4 h-4 mr-2" />
                Réapprovisionner tout
              </Button>
              <Button variant="outline" size="sm" className="text-primary hover:bg-primary/10">
                <Bell className="w-4 h-4 mr-2" />
                Configurer les seuils
              </Button>
              <Button variant="outline" size="sm" className="text-warning hover:bg-warning/10">
                <AlertTriangle className="w-4 h-4 mr-2" />
                Alertes critiques uniquement
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};