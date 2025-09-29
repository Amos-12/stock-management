import { useState } from 'react';
import { ResponsiveDashboardLayout } from '@/components/Layout/ResponsiveDashboardLayout';
import { AdminDashboardCharts } from '@/components/Dashboard/AdminDashboardCharts';
import { UserManagementPanel } from '@/components/UserManagement/UserManagementPanel';
import { AdvancedReports } from '@/components/Reports/AdvancedReports';
import { StockAlerts } from '@/components/Notifications/StockAlerts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Package, ShoppingCart, Users, TrendingUp } from 'lucide-react';

const AdminDashboard = () => {
  const [currentSection, setCurrentSection] = useState('dashboard');

  const renderContent = () => {
    switch (currentSection) {
      case 'dashboard':
        return <AdminDashboardCharts />;
      case 'products':
        return (
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5" />
                Gestion des Produits
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Interface de gestion des produits à venir</p>
            </CardContent>
          </Card>
        );
      case 'sales':
        return (
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5" />
                Gestion des Ventes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Interface de gestion des ventes à venir</p>
            </CardContent>
          </Card>
        );
      case 'users':
        return <UserManagementPanel />;
      case 'reports':
        return <AdvancedReports />;
      case 'notifications':
        return <StockAlerts />;
      default:
        return <AdminDashboardCharts />;
    }
  };

  return (
    <ResponsiveDashboardLayout 
      title="Tableau de Bord Admin" 
      role="admin" 
      currentSection={currentSection}
      onSectionChange={setCurrentSection}
    >
      <div className="space-y-6">
        {renderContent()}
      </div>
    </ResponsiveDashboardLayout>
  );
};

export default AdminDashboard;