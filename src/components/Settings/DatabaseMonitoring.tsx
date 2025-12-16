import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  Database, 
  HardDrive, 
  Trash2, 
  RefreshCw, 
  AlertTriangle,
  CheckCircle2,
  Table2,
  Users,
  Package,
  ShoppingCart,
  FileText,
  Activity,
  Clock,
  TrendingDown,
  Shield
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface DbSizeInfo {
  size_mb: number;
  max_size_mb: number;
  threshold_mb: number;
  usage_percent: number;
  needs_cleanup: boolean;
}

interface CleanupResult {
  deleted_logs: number;
  deleted_movements: number;
  deleted_sales: number;
  deleted_items: number;
  space_freed_mb: number;
  size_before_mb: number;
  size_after_mb: number;
}

interface TableStats {
  name: string;
  count: number;
  icon: React.ElementType;
  color: string;
}

export const DatabaseMonitoring = () => {
  const [dbSize, setDbSize] = useState<DbSizeInfo | null>(null);
  const [tableStats, setTableStats] = useState<TableStats[]>([]);
  const [loading, setLoading] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchTableStats = useCallback(async () => {
    try {
      const [
        { count: productsCount },
        { count: salesCount },
        { count: usersCount },
        { count: logsCount },
        { count: movementsCount },
        { count: categoriesCount }
      ] = await Promise.all([
        supabase.from('products').select('*', { count: 'exact', head: true }),
        supabase.from('sales').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('activity_logs').select('*', { count: 'exact', head: true }),
        supabase.from('stock_movements').select('*', { count: 'exact', head: true }),
        supabase.from('categories').select('*', { count: 'exact', head: true })
      ]);

      setTableStats([
        { name: 'Produits', count: productsCount || 0, icon: Package, color: 'text-blue-500' },
        { name: 'Ventes', count: salesCount || 0, icon: ShoppingCart, color: 'text-green-500' },
        { name: 'Utilisateurs', count: usersCount || 0, icon: Users, color: 'text-purple-500' },
        { name: 'Logs', count: logsCount || 0, icon: FileText, color: 'text-orange-500' },
        { name: 'Mouvements', count: movementsCount || 0, icon: Activity, color: 'text-cyan-500' },
        { name: 'Catégories', count: categoriesCount || 0, icon: Table2, color: 'text-pink-500' }
      ]);
    } catch (error) {
      console.error('Error fetching table stats:', error);
    }
  }, []);

  const fetchDbSize = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('check_database_size');
      if (error) throw error;
      setDbSize(data as unknown as DbSizeInfo);
      setLastRefresh(new Date());
      await fetchTableStats();
    } catch (error: any) {
      console.error('Error fetching DB size:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de récupérer la taille de la base de données',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [fetchTableStats]);

  const handleManualCleanup = async () => {
    setCleaning(true);
    try {
      const { data, error } = await supabase.rpc('cleanup_old_data');
      if (error) throw error;

      const result = data as unknown as CleanupResult;
      toast({
        title: 'Nettoyage terminé',
        description: `${result.space_freed_mb} MB libérés. ${result.deleted_logs} logs, ${result.deleted_movements} mouvements et ${result.deleted_sales} ventes supprimés.`,
      });

      fetchDbSize();
    } catch (error: any) {
      console.error('Error cleaning database:', error);
      toast({
        title: 'Erreur',
        description: error.message || 'Échec du nettoyage',
        variant: 'destructive',
      });
    } finally {
      setCleaning(false);
    }
  };

  useEffect(() => {
    fetchDbSize();
  }, [fetchDbSize]);

  const getStatusColor = (percent: number) => {
    if (percent >= 80) return 'text-destructive';
    if (percent >= 60) return 'text-amber-500';
    return 'text-emerald-500';
  };

  const getProgressColor = (percent: number) => {
    if (percent >= 80) return 'bg-destructive';
    if (percent >= 60) return 'bg-amber-500';
    return 'bg-emerald-500';
  };

  const getStatusBadge = (percent: number) => {
    if (percent >= 80) return { label: 'Critique', variant: 'destructive' as const, icon: AlertTriangle };
    if (percent >= 60) return { label: 'Attention', variant: 'secondary' as const, icon: AlertTriangle };
    return { label: 'Sain', variant: 'default' as const, icon: CheckCircle2 };
  };

  const formatNumber = (num: number) => {
    return num.toLocaleString('fr-FR');
  };

  const status = dbSize ? getStatusBadge(dbSize.usage_percent) : null;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <Database className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
            Base de données
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Surveillance et maintenance de l'espace disque
          </p>
        </div>
        <div className="flex items-center gap-2">
          {lastRefresh && (
            <span className="text-[10px] sm:text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {lastRefresh.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={fetchDbSize}
            disabled={loading}
            className="h-8"
          >
            <RefreshCw className={cn("w-4 h-4 mr-1 sm:mr-2", loading && "animate-spin")} />
            <span className="hidden sm:inline">Actualiser</span>
          </Button>
        </div>
      </div>

      {/* Main Storage Card */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-2 sm:pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
              <HardDrive className="w-4 h-4 sm:w-5 sm:h-5" />
              Utilisation du stockage
            </CardTitle>
            {status && (
              <Badge variant={status.variant} className="flex items-center gap-1 text-[10px] sm:text-xs">
                <status.icon className="w-3 h-3" />
                {status.label}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading && !dbSize ? (
            <div className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          ) : dbSize ? (
            <>
              {/* Usage Display */}
              <div className="flex items-end justify-between">
                <div>
                  <span className={cn("text-3xl sm:text-4xl font-bold", getStatusColor(dbSize.usage_percent))}>
                    {dbSize.usage_percent.toFixed(1)}%
                  </span>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                    {dbSize.size_mb.toFixed(2)} MB / {dbSize.max_size_mb} MB
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg sm:text-xl font-semibold text-muted-foreground">
                    {(dbSize.max_size_mb - dbSize.size_mb).toFixed(2)} MB
                  </p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">disponibles</p>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="relative">
                <Progress value={dbSize.usage_percent} className="h-3 sm:h-4" />
                <div 
                  className={cn(
                    "absolute top-0 h-full rounded-full transition-all duration-500",
                    getProgressColor(dbSize.usage_percent)
                  )}
                  style={{ width: `${Math.min(dbSize.usage_percent, 100)}%` }}
                />
                {/* Threshold marker */}
                <div 
                  className="absolute top-0 h-full w-0.5 bg-destructive/50"
                  style={{ left: '80%' }}
                />
              </div>

              <div className="flex justify-between text-[10px] sm:text-xs text-muted-foreground">
                <span>0 MB</span>
                <span className="text-destructive/70">Seuil 80%</span>
                <span>{dbSize.max_size_mb} MB</span>
              </div>

              {/* Alert if needed */}
              {dbSize.needs_cleanup && (
                <Alert variant="destructive" className="mt-4">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-xs sm:text-sm">
                    <strong>Seuil critique atteint !</strong> La base a dépassé {dbSize.threshold_mb} MB.
                    Un nettoyage automatique s'exécute chaque jour à 3h.
                  </AlertDescription>
                </Alert>
              )}
            </>
          ) : null}
        </CardContent>
      </Card>

      {/* Table Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
        {loading && tableStats.length === 0 ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="p-3">
              <Skeleton className="h-8 w-8 rounded-full mb-2" />
              <Skeleton className="h-4 w-12 mb-1" />
              <Skeleton className="h-3 w-16" />
            </Card>
          ))
        ) : (
          tableStats.map((stat) => (
            <Card key={stat.name} className="p-3 sm:p-4 hover:shadow-md transition-shadow">
              <div className="flex flex-col items-center text-center">
                <div className={cn("p-2 rounded-full bg-muted mb-2", stat.color)}>
                  <stat.icon className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <span className="text-lg sm:text-xl font-bold">{formatNumber(stat.count)}</span>
                <span className="text-[10px] sm:text-xs text-muted-foreground">{stat.name}</span>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Retention Policy & Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Retention Policy */}
        <Card>
          <CardHeader className="pb-2 sm:pb-3">
            <CardTitle className="text-sm sm:text-base flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              Politique de rétention
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 sm:space-y-3">
            <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-orange-500" />
                <span className="text-xs sm:text-sm">Logs d'activité</span>
              </div>
              <Badge variant="outline" className="text-[10px] sm:text-xs">6 mois</Badge>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-cyan-500" />
                <span className="text-xs sm:text-sm">Mouvements stock</span>
              </div>
              <Badge variant="outline" className="text-[10px] sm:text-xs">1 an</Badge>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-green-500" />
                <span className="text-xs sm:text-sm">Ventes & reçus</span>
              </div>
              <Badge variant="outline" className="text-[10px] sm:text-xs">2 ans</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Cleanup Action */}
        <Card>
          <CardHeader className="pb-2 sm:pb-3">
            <CardTitle className="text-sm sm:text-base flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-primary" />
              Nettoyage manuel
            </CardTitle>
            <CardDescription className="text-[10px] sm:text-xs">
              Supprime les données selon la politique de rétention
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  disabled={cleaning || loading}
                  variant={dbSize?.needs_cleanup ? 'destructive' : 'outline'}
                  className="w-full"
                  size="sm"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  {cleaning ? 'Nettoyage en cours...' : 'Nettoyer maintenant'}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="max-w-[95vw] sm:max-w-md">
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2 text-base sm:text-lg">
                    <AlertTriangle className="w-5 h-5 text-destructive" />
                    Confirmer le nettoyage
                  </AlertDialogTitle>
                  <AlertDialogDescription className="space-y-3 text-xs sm:text-sm">
                    <p>Cette action est <strong className="text-destructive">irréversible</strong>. Elle supprimera :</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>Logs d'activité &gt; 6 mois</li>
                      <li>Mouvements de stock &gt; 1 an</li>
                      <li>Ventes &gt; 2 ans</li>
                    </ul>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                  <AlertDialogCancel className="mt-0">Annuler</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={handleManualCleanup}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Confirmer
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <p className="text-[10px] sm:text-xs text-muted-foreground text-center flex items-center justify-center gap-1">
              <Clock className="w-3 h-3" />
              Nettoyage auto : chaque jour à 3h
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
