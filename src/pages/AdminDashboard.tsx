import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ResponsiveDashboardLayout } from '@/components/Layout/ResponsiveDashboardLayout';
import { AdminDashboardCharts } from '@/components/Dashboard/AdminDashboardCharts';
import { UserManagementPanel } from '@/components/UserManagement/UserManagementPanel';
import { AdvancedReports } from '@/components/Reports/AdvancedReports';
import { StockAlerts } from '@/components/Notifications/StockAlerts';
import { ProductManagement } from '@/components/Products/ProductManagement';
import { SalesManagement } from '@/components/Sales/SalesManagement';
import { CompanySettings } from '@/components/Settings/CompanySettings';
import { ActivityLogPanel } from '@/components/ActivityLog/ActivityLogPanel';

const AdminDashboard = () => {
  const [searchParams] = useSearchParams();
  const [currentSection, setCurrentSection] = useState(searchParams.get('section') || 'dashboard');
  const renderContent = () => {
    switch (currentSection) {
      case 'dashboard':
        return <AdminDashboardCharts />;
      case 'products':
        return <ProductManagement />;
      case 'sales':
        return <SalesManagement />;
      case 'users':
        return <UserManagementPanel />;
      case 'reports':
        return <AdvancedReports />;
      case 'activity':
        return <ActivityLogPanel />;
      case 'notifications':
        return <StockAlerts />;
      case 'settings':
        return <CompanySettings />;
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