import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { Building2, Users, DollarSign, Clock } from 'lucide-react';

interface SaasStats {
  totalCompanies: number;
  activeCompanies: number;
  trialCompanies: number;
  expiredCompanies: number;
  totalUsers: number;
  mrr: number;
}

export const SaasKPIs = () => {
  const [stats, setStats] = useState<SaasStats>({
    totalCompanies: 0,
    activeCompanies: 0,
    trialCompanies: 0,
    expiredCompanies: 0,
    totalUsers: 0,
    mrr: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const { data: companies } = await supabase
          .from('companies')
          .select('id, is_active, subscription_plan, subscription_end');

        const { count: userCount } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true });

        if (companies) {
          const today = new Date().toISOString().split('T')[0];
          const active = companies.filter((c) => c.is_active && c.subscription_end >= today);
          const trial = companies.filter((c) => c.subscription_plan === 'trial' && c.subscription_end >= today);
          const expired = companies.filter((c) => c.subscription_end < today);

          const planPrices: Record<string, number> = { basic: 19, pro: 39, premium: 59 };
          const mrr = companies
            .filter((c) => c.is_active && c.subscription_end >= today && c.subscription_plan !== 'trial')
            .reduce((sum, c) => sum + (planPrices[c.subscription_plan] || 0), 0);

          setStats({
            totalCompanies: companies.length,
            activeCompanies: active.length,
            trialCompanies: trial.length,
            expiredCompanies: expired.length,
            totalUsers: userCount || 0,
            mrr,
          });
        }
      } catch (err) {
        console.error('Error fetching SaaS stats:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const kpiCards = [
    {
      title: 'Entreprises',
      icon: Building2,
      value: stats.totalCompanies,
      subtitle: `${stats.activeCompanies} actives`,
    },
    {
      title: 'Utilisateurs',
      icon: Users,
      value: stats.totalUsers,
      subtitle: 'sur la plateforme',
    },
    {
      title: 'MRR',
      icon: DollarSign,
      value: `$${stats.mrr}`,
      subtitle: 'revenus mensuels',
    },
    {
      title: 'En essai',
      icon: Clock,
      value: stats.trialCompanies,
      subtitle: `${stats.expiredCompanies} expirées`,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {kpiCards.map((kpi) => {
        const Icon = kpi.icon;
        return (
          <Card key={kpi.title}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Icon className="w-4 h-4" />
                {kpi.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{loading ? '...' : kpi.value}</p>
              <p className="text-xs text-muted-foreground">{kpi.subtitle}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
