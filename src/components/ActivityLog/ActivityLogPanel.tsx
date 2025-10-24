import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { 
  ClipboardList, 
  Search, 
  RefreshCcw, 
  Calendar as CalendarIcon,
  ShoppingCart,
  Package,
  UserCheck,
  UserX,
  Edit,
  Trash2,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { useActivityLog, ActivityLogFilter } from '@/hooks/useActivityLog';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const ACTION_TYPES = [
  { value: 'sale_created', label: 'Vente créée', icon: ShoppingCart, color: 'bg-green-500' },
  { value: 'product_added', label: 'Produit ajouté', icon: Package, color: 'bg-blue-500' },
  { value: 'product_updated', label: 'Produit modifié', icon: Edit, color: 'bg-yellow-500' },
  { value: 'product_deactivated', label: 'Produit désactivé', icon: Trash2, color: 'bg-red-500' },
  { value: 'product_deleted', label: 'Produit supprimé', icon: Trash2, color: 'bg-red-500' },
  { value: 'user_approved', label: 'Utilisateur approuvé', icon: UserCheck, color: 'bg-green-500' },
  { value: 'user_deactivated', label: 'Utilisateur désactivé', icon: UserX, color: 'bg-red-500' },
  { value: 'user_login', label: 'Connexion', icon: UserCheck, color: 'bg-blue-500' },
  { value: 'user_logout', label: 'Déconnexion', icon: UserX, color: 'bg-gray-500' },
  { value: 'user_signup', label: 'Inscription', icon: UserCheck, color: 'bg-green-500' },
  { value: 'user_update_password', label: 'Changement mot de passe', icon: Edit, color: 'bg-orange-500' },
  { value: 'connection_failed', label: 'Échec connexion', icon: UserX, color: 'bg-red-500' },
];

export const ActivityLogPanel = () => {
  const { logs, loading, totalCount, fetchActivityLogs } = useActivityLog();
  const [filters, setFilters] = useState<ActivityLogFilter>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [users, setUsers] = useState<Array<{ id: string; full_name: string }>>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const pageSize = 20;

  useEffect(() => {
    loadLogs();
    loadUsers();
  }, []);

  useEffect(() => {
    loadLogs();
  }, [filters, currentPage]);

  const loadUsers = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('user_id, full_name')
      .order('full_name');
    
    if (data) {
      setUsers(data.map(p => ({ id: p.user_id, full_name: p.full_name })));
    }
  };

  const loadLogs = async () => {
    await fetchActivityLogs(filters, currentPage, pageSize);
  };

  const handleSearch = () => {
    setFilters({
      ...filters,
      search: searchTerm || undefined,
      date_from: dateFrom?.toISOString(),
      date_to: dateTo?.toISOString()
    });
    setCurrentPage(0);
  };

  const handleReset = () => {
    setFilters({});
    setSearchTerm('');
    setDateFrom(undefined);
    setDateTo(undefined);
    setCurrentPage(0);
  };

  const getActionIcon = (actionType: string) => {
    const action = ACTION_TYPES.find(a => a.value === actionType);
    if (!action) return <ClipboardList className="w-4 h-4" />;
    const Icon = action.icon;
    return <Icon className="w-4 h-4" />;
  };

  const getActionBadge = (actionType: string) => {
    const action = ACTION_TYPES.find(a => a.value === actionType);
    if (!action) return <Badge variant="secondary">{actionType}</Badge>;
    
    return (
      <Badge className={`${action.color} text-white`}>
        {action.label}
      </Badge>
    );
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5" />
            Logs d'activité
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Type d'action</label>
                <Select
                  value={filters.action_type || 'all'}
                  onValueChange={(value) => {
                    setFilters({
                      ...filters,
                      action_type: value === 'all' ? undefined : value
                    });
                    setCurrentPage(0);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Tous les types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les types</SelectItem>
                    {ACTION_TYPES.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Utilisateur</label>
                <Select
                  value={filters.user_id || 'all'}
                  onValueChange={(value) => {
                    setFilters({
                      ...filters,
                      user_id: value === 'all' ? undefined : value
                    });
                    setCurrentPage(0);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Tous les utilisateurs" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les utilisateurs</SelectItem>
                    {users.map(user => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Date de début</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start">
                      <CalendarIcon className="mr-2 w-4 h-4" />
                      {dateFrom ? format(dateFrom, 'dd/MM/yyyy', { locale: fr }) : 'Sélectionner'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={dateFrom}
                      onSelect={setDateFrom}
                      locale={fr}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Date de fin</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start">
                      <CalendarIcon className="mr-2 w-4 h-4" />
                      {dateTo ? format(dateTo, 'dd/MM/yyyy', { locale: fr }) : 'Sélectionner'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={dateTo}
                      onSelect={setDateTo}
                      locale={fr}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Search and actions */}
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="flex-1">
                <Input
                  placeholder="Rechercher dans les descriptions..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSearch} className="flex-1 sm:flex-none">
                  <Search className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">Rechercher</span>
                </Button>
                <Button variant="outline" onClick={handleReset} className="flex-1 sm:flex-none">
                  <RefreshCcw className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">Réinitialiser</span>
                </Button>
              </div>
            </div>

            {/* Results count */}
            <div className="text-sm text-muted-foreground">
              {totalCount} résultat{totalCount > 1 ? 's' : ''} trouvé{totalCount > 1 ? 's' : ''}
            </div>

            {/* Table */}
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[140px] sm:w-[180px]">Date</TableHead>
                    <TableHead className="min-w-[150px] sm:w-[200px]">Utilisateur</TableHead>
                    <TableHead className="min-w-[140px] sm:w-[180px]">Action</TableHead>
                    <TableHead className="min-w-[200px]">Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8">
                        Chargement...
                      </TableCell>
                    </TableRow>
                  ) : logs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8">
                        Aucun log trouvé
                      </TableCell>
                    </TableRow>
                  ) : (
                    logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="font-mono text-sm">
                          {format(new Date(log.created_at), 'dd/MM/yyyy HH:mm', { locale: fr })}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">{log.user?.full_name || 'N/A'}</span>
                            <span className="text-xs text-muted-foreground">{log.user?.email || ''}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getActionIcon(log.action_type)}
                            {getActionBadge(log.action_type)}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-md">
                          <div className="text-sm">{log.description}</div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  Page {currentPage + 1} sur {totalPages}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                    disabled={currentPage === 0}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
                    disabled={currentPage >= totalPages - 1}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};