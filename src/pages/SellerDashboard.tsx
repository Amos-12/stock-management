import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ResponsiveDashboardLayout } from '@/components/Layout/ResponsiveDashboardLayout';
import { SellerWorkflow } from '@/components/Seller/SellerWorkflow';
import { SellerDashboardStats } from '@/components/Dashboard/SellerDashboardStats';
import { StockAlerts } from '@/components/Notifications/StockAlerts';
import { ProductManagement } from '@/components/Products/ProductManagement';
import { 
  TrendingUp,
  Receipt,
  ShoppingCart,
  Package,
  Home
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface Sale {
  id: string;
  customer_name?: string;
  total_amount: number;
  payment_method: string;
  created_at: string;
}

const SellerDashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [currentSection, setCurrentSection] = useState('dashboard');

  useEffect(() => {
    if (user && !authLoading) {
      fetchMySales();
    }
  }, [user, authLoading]);

  const fetchMySales = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('sales')
        .select('*')
        .eq('seller_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setSales(data || []);
    } catch (error) {
      console.error('Error fetching sales:', error);
    }
  };

  const renderContent = () => {
    switch (currentSection) {
      case 'dashboard':
        return <SellerDashboardStats />;
      case 'sale':
        return <SellerWorkflow onSaleComplete={fetchMySales} />;
      case 'products':
        return <ProductManagement />;
      case 'notifications':
        return <StockAlerts />;
      case 'history':
        return (
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Mes Dernières Ventes (10 plus récentes)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {sales.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Receipt className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Aucune vente enregistrée</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {sales.map((sale) => (
                    <div key={sale.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent transition-smooth">
                      <div>
                        <div className="font-medium">
                          {sale.customer_name || 'Client non renseigné'}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {new Date(sale.created_at).toLocaleString('fr-FR')} • {sale.payment_method}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-success">{sale.total_amount.toFixed(2)} HTG</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        );
      default:
        return <SellerWorkflow onSaleComplete={fetchMySales} />;
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Package className="w-12 h-12 text-primary animate-pulse mx-auto mb-4" />
          <p className="text-muted-foreground">Chargement du tableau de bord...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-muted-foreground">Veuillez vous connecter</p>
        </div>
      </div>
    );
  }

  return (
    <ResponsiveDashboardLayout 
      title="Espace Vendeur" 
      role="seller" 
      currentSection={currentSection} 
      onSectionChange={setCurrentSection}
    >
      <div className="space-y-6">
        {renderContent()}
      </div>
    </ResponsiveDashboardLayout>
  );
};

export default SellerDashboard;