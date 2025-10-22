import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  ClipboardList, 
  ShoppingCart, 
  Package, 
  Users, 
  TrendingUp, 
  Settings,
  Search,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { useActivityLog, ActivityActionType } from '@/hooks/useActivityLog';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const getActionIcon = (actionType: ActivityActionType) => {
  switch (actionType) {
    case 'sale_created':
      return <ShoppingCart className="w-4 h-4" />;
    case 'product_added':
    case 'product_updated':
    case 'product_deleted':
      return <Package className="w-4 h-4" />;
    case 'stock_adjusted':
      return <TrendingUp className="w-4 h-4" />;
    case 'user_approved':
    case 'user_deactivated':
      return <Users className="w-4 h-4" />;
    case 'settings_updated':
      return <Settings className="w-4 h-4" />;
    default:
      return <ClipboardList className="w-4 h-4" />;
  }
};

const getActionBadgeVariant = (actionType: ActivityActionType): "default" | "secondary" | "destructive" | "outline" => {
  switch (actionType) {
    case 'sale_created':
      return 'default';
    case 'product_added':
      return 'secondary';
    case 'product_deleted':
    case 'user_deactivated':
      return 'destructive';
    default:
      return 'outline';
  }
};

const getActionLabel = (actionType: ActivityActionType): string => {
  const labels: Record<ActivityActionType, string> = {
    sale_created: 'Vente créée',
    product_added: 'Produit ajouté',
    product_updated: 'Produit modifié',
    product_deleted: 'Produit supprimé',
    stock_adjusted: 'Stock ajusté',
    user_approved: 'Utilisateur approuvé',
    user_deactivated: 'Utilisateur désactivé',
    settings_updated: 'Paramètres modifiés'
  };
  return labels[actionType] || actionType;
};

export const ActivityLogPanel = () => {
  const { logs, loading, totalCount, fetchActivityLogs } = useActivityLog();
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterActionType, setFilterActionType] = useState<ActivityActionType | 'all'>('all');
  const pageSize = 50;
  const totalPages = Math.ceil(totalCount / pageSize);

  useEffect(() => {
    const filters = {
      search: searchTerm || undefined,
      actionType: filterActionType !== 'all' ? filterActionType : undefined
    };
    fetchActivityLogs(filters, page, pageSize);
  }, [page, searchTerm, filterActionType]);

  const handleSearch = (value: string) => {
    setSearchTerm(value);
    setPage(1);
  };

  const handleFilterChange = (value: string) => {
    setFilterActionType(value as ActivityActionType | 'all');
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5" />
            Journal d'Activité
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher dans les logs..."
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterActionType} onValueChange={handleFilterChange}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Type d'action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les actions</SelectItem>
                <SelectItem value="sale_created">Ventes</SelectItem>
                <SelectItem value="product_added">Produits ajoutés</SelectItem>
                <SelectItem value="product_updated">Produits modifiés</SelectItem>
                <SelectItem value="product_deleted">Produits supprimés</SelectItem>
                <SelectItem value="stock_adjusted">Ajustements stock</SelectItem>
                <SelectItem value="user_approved">Utilisateurs approuvés</SelectItem>
                <SelectItem value="user_deactivated">Utilisateurs désactivés</SelectItem>
                <SelectItem value="settings_updated">Paramètres</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Chargement des logs...
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Aucun log d'activité trouvé
            </div>
          ) : (
            <div className="space-y-3">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="mt-1">
                    {getActionIcon(log.action_type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant={getActionBadgeVariant(log.action_type)}>
                        {getActionLabel(log.action_type)}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(log.created_at), 'dd MMM yyyy à HH:mm', { locale: fr })}
                      </span>
                    </div>
                    <p className="text-sm mb-1">{log.description}</p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>Par: {log.user_name}</span>
                      {log.entity_type && <span>Type: {log.entity_type}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <div className="text-sm text-muted-foreground">
                Page {page} sur {totalPages} ({totalCount} logs au total)
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
