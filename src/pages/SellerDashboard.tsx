import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ResponsiveDashboardLayout } from '@/components/Layout/ResponsiveDashboardLayout';
import { SellerWorkflow } from '@/components/Seller/SellerWorkflow';
import { SellerDashboardStats } from '@/components/Dashboard/SellerDashboardStats';
import { StockAlerts } from '@/components/Notifications/StockAlerts';
import { ProductManagement } from '@/components/Products/ProductManagement';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  TrendingUp,
  Receipt,
  ShoppingCart,
  Package,
  Home,
  AlertCircle
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import logo from '@/assets/logo.png';

interface Sale {
  id: string;
  customer_name?: string;
  total_amount: number;
  payment_method: string;
  created_at: string;
}

const SellerDashboard = () => {
  const { user, loading: authLoading, role } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [currentSection, setCurrentSection] = useState('dashboard');
  const [isApproved, setIsApproved] = useState<boolean | null>(null);
  const [loadingApproval, setLoadingApproval] = useState(true);
  const [displayCurrency, setDisplayCurrency] = useState<'USD' | 'HTG'>('HTG');
  const [usdHtgRate, setUsdHtgRate] = useState(132);

  useEffect(() => {
    if (user && !authLoading) {
      checkApprovalStatus();
      fetchMySales();
      fetchCompanySettings();
    }
  }, [user, authLoading]);

  const fetchCompanySettings = async () => {
    const { data } = await supabase
      .from('company_settings')
      .select('usd_htg_rate, default_display_currency')
      .single();
    
    if (data) {
      setUsdHtgRate(data.usd_htg_rate || 132);
      setDisplayCurrency((data.default_display_currency || 'HTG') as 'USD' | 'HTG');
    }
  };

  const checkApprovalStatus = async () => {
    if (!user) return;
    
    try {
      setLoadingApproval(true);
      const { data, error } = await supabase
        .from('user_roles')
        .select('is_active')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      setIsApproved(data?.is_active ?? false);
    } catch (error) {
      console.error('Error checking approval status:', error);
      setIsApproved(false);
    } finally {
      setLoadingApproval(false);
    }
  };

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
            <CardHeader className="pb-2 sm:pb-4 px-3 sm:px-6">
              <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
                <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" />
                Mes Ventes
                <span className="text-xs sm:text-sm font-normal text-muted-foreground ml-1">
                  (10 récentes)
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 sm:px-6">
              {sales.length === 0 ? (
                <div className="text-center py-6 sm:py-8 text-muted-foreground">
                  <Receipt className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 sm:mb-4 opacity-50" />
                  <p className="text-xs sm:text-sm">Aucune vente enregistrée</p>
                </div>
              ) : (
                <div className="space-y-2 sm:space-y-3">
                  {sales.map((sale) => (
                    <div 
                      key={sale.id} 
                      className="flex items-center justify-between p-2 sm:p-3 border rounded-lg hover:bg-accent/50 transition-all"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-xs sm:text-sm truncate max-w-[140px] sm:max-w-none">
                          {sale.customer_name || 'Client anonyme'}
                        </div>
                        <div className="text-[10px] sm:text-xs text-muted-foreground flex items-center gap-1 sm:gap-2 flex-wrap">
                          <span>
                            {new Date(sale.created_at).toLocaleString('fr-FR', {
                              day: '2-digit',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                          <span className="hidden sm:inline">•</span>
                          <span className="px-1.5 py-0.5 bg-muted rounded text-[9px] sm:text-xs">
                            {sale.payment_method || 'N/A'}
                          </span>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 ml-2">
                        <div className="font-bold text-xs sm:text-sm text-success">
                          {displayCurrency === 'USD' 
                            ? `$${(sale.total_amount / usdHtgRate).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` 
                            : `${sale.total_amount.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} HTG`
                          }
                        </div>
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

  if (authLoading || (user && loadingApproval)) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-primary-light via-background to-secondary">
        <div className="text-center">
          <img src={logo} alt="Logo" className="w-14 h-14 object-contain mx-auto mb-4 animate-pulse" />
          <p className="text-muted-foreground">Chargement du tableau de bord...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-primary-light via-background to-secondary">
        <div className="text-center">
          <p className="text-muted-foreground">Veuillez vous connecter</p>
        </div>
      </div>
    );
  }

  // If seller not approved, redirect to Index page which handles inactive accounts
  if (isApproved === false) {
    window.location.href = '/';
    return null;
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
