import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Database, HardDrive, Trash2, RefreshCw, AlertTriangle } from 'lucide-react';

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

export const DatabaseMonitoring = () => {
  const [dbSize, setDbSize] = useState<DbSizeInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [cleaning, setCleaning] = useState(false);

  const fetchDbSize = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('check_database_size');
      if (error) throw error;
      setDbSize(data as unknown as DbSizeInfo);
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
  };

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
  }, []);

  const getStatusColor = (percent: number) => {
    if (percent >= 80) return 'text-destructive';
    if (percent >= 60) return 'text-warning';
    return 'text-success';
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5" />
              Surveillance Base de Données
            </CardTitle>
            <CardDescription>
              Gestion automatique de l'espace disque (512 MB max)
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchDbSize}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {dbSize && (
          <>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Utilisation du disque</span>
                </div>
                <span className={`text-lg font-bold ${getStatusColor(dbSize.usage_percent)}`}>
                  {dbSize.usage_percent.toFixed(1)}%
                </span>
              </div>
              
              <Progress value={dbSize.usage_percent} className="h-3" />
              
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>{dbSize.size_mb.toFixed(2)} MB utilisés</span>
                <span>{dbSize.max_size_mb} MB disponibles</span>
              </div>
            </div>

            {dbSize.needs_cleanup && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>⚠️ Seuil critique atteint !</strong>
                  <br />
                  La base de données a dépassé {dbSize.threshold_mb} MB (80% de capacité).
                  Un nettoyage automatique s'exécutera chaque jour à 3h du matin.
                </AlertDescription>
              </Alert>
            )}

            <div className="pt-4 border-t space-y-3">
              <h4 className="font-semibold text-sm">Politique de rétention des données</h4>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li>• Logs d'activité : conservés 6 mois</li>
                <li>• Mouvements de stock : conservés 1 an</li>
                <li>• Ventes et reçus : conservés 2 ans minimum</li>
              </ul>
            </div>

            <Button
              onClick={handleManualCleanup}
              disabled={cleaning}
              variant={dbSize.needs_cleanup ? 'destructive' : 'outline'}
              className="w-full"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              {cleaning ? 'Nettoyage en cours...' : 'Nettoyer maintenant'}
            </Button>

            <p className="text-xs text-muted-foreground text-center">
              Le nettoyage automatique s'exécute quotidiennement à 3h du matin
            </p>
          </>
        )}

        {!dbSize && loading && (
          <div className="text-center py-8">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground mt-2">Chargement...</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
