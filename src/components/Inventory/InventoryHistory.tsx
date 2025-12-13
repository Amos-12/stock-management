import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { usePagination } from '@/hooks/usePagination';
import { TablePagination } from '@/components/ui/table-pagination';
import { 
  Search, 
  RefreshCw, 
  Download,
  Calendar as CalendarIcon,
  ArrowUpCircle,
  ArrowDownCircle,
  Settings2,
  TrendingUp,
  TrendingDown,
  Minus,
  Package,
  FileText
} from 'lucide-react';
import { generateInventoryHistoryPDF, CompanySettings } from '@/lib/pdfGenerator';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import * as XLSX from 'xlsx';

interface StockMovement {
  id: string;
  product_id: string;
  movement_type: string;
  quantity: number;
  previous_quantity: number;
  new_quantity: number;
  reason: string | null;
  sale_id: string | null;
  created_at: string;
  created_by: string | null;
  product_name?: string;
  product_category?: string;
  user_name?: string;
}

type MovementFilter = 'all' | 'in' | 'out' | 'adjustment';
type DateRange = { from: Date; to: Date };

export const InventoryHistory = () => {
  const { toast } = useToast();
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [movementFilter, setMovementFilter] = useState<MovementFilter>('all');
  const [dateRange, setDateRange] = useState<DateRange>({
    from: subDays(new Date(), 30),
    to: new Date()
  });
  const [calendarOpen, setCalendarOpen] = useState(false);

  const fetchMovements = async () => {
    setLoading(true);
    try {
      // Fetch stock movements with product details
      const { data: movementsData, error: movementsError } = await supabase
        .from('stock_movements')
        .select(`
          *,
          products!inner(name, category)
        `)
        .gte('created_at', startOfDay(dateRange.from).toISOString())
        .lte('created_at', endOfDay(dateRange.to).toISOString())
        .order('created_at', { ascending: false });

      if (movementsError) throw movementsError;

      // Get unique user IDs
      const userIds = [...new Set(movementsData?.map(m => m.created_by).filter(Boolean))];
      
      // Fetch user profiles
      let profilesMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', userIds);
        
        if (profiles) {
          profilesMap = profiles.reduce((acc, p) => {
            acc[p.user_id] = p.full_name;
            return acc;
          }, {} as Record<string, string>);
        }
      }

      // Merge data
      const enrichedMovements = movementsData?.map(m => ({
        ...m,
        product_name: (m.products as any)?.name || 'Produit inconnu',
        product_category: (m.products as any)?.category || '',
        user_name: m.created_by ? profilesMap[m.created_by] || 'Utilisateur inconnu' : 'Système'
      })) || [];

      setMovements(enrichedMovements);
    } catch (error) {
      console.error('Error fetching movements:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de charger l\'historique',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMovements();
  }, [dateRange]);

  // Filter movements
  const filteredMovements = useMemo(() => {
    return movements.filter(m => {
      // Search filter
      if (searchQuery) {
        const search = searchQuery.toLowerCase();
        if (!m.product_name?.toLowerCase().includes(search) &&
            !m.reason?.toLowerCase().includes(search)) {
          return false;
        }
      }

      // Movement type filter
      if (movementFilter !== 'all') {
        const isIn = ['restock', 'adjustment_in', 'return', 'in'].includes(m.movement_type);
        const isOut = ['sale', 'adjustment_out', 'loss', 'out'].includes(m.movement_type);
        const isAdjust = ['adjustment', 'inventory_adjustment'].includes(m.movement_type);
        
        if (movementFilter === 'in' && !isIn) return false;
        if (movementFilter === 'out' && !isOut) return false;
        if (movementFilter === 'adjustment' && !isAdjust) return false;
      }

      return true;
    });
  }, [movements, searchQuery, movementFilter]);

  // Pagination
  const { 
    paginatedItems, 
    currentPage, 
    totalPages, 
    totalItems, 
    pageSize, 
    nextPage, 
    prevPage, 
    hasNextPage, 
    hasPrevPage,
    resetPage
  } = usePagination(filteredMovements, 20);

  useEffect(() => {
    resetPage();
  }, [searchQuery, movementFilter]);

  // Stats
  const stats = useMemo(() => {
    const ins = movements.filter(m => 
      ['restock', 'adjustment_in', 'return', 'in'].includes(m.movement_type)
    ).reduce((sum, m) => sum + m.quantity, 0);
    
    const outs = movements.filter(m => 
      ['sale', 'adjustment_out', 'loss', 'out'].includes(m.movement_type)
    ).reduce((sum, m) => sum + m.quantity, 0);
    
    const adjustments = movements.filter(m => 
      ['adjustment', 'inventory_adjustment'].includes(m.movement_type)
    ).length;

    return { ins, outs, adjustments, total: movements.length };
  }, [movements]);

  const getMovementBadge = (type: string, quantity: number, prev: number, next: number) => {
    const isPositive = next > prev;
    const isNegative = next < prev;
    
    if (['restock', 'adjustment_in', 'return', 'in'].includes(type)) {
      return (
        <Badge className="bg-green-600 text-white border-green-700 flex items-center gap-1">
          <ArrowUpCircle className="w-3 h-3" />
          +{quantity.toFixed(2)}
        </Badge>
      );
    }
    
    if (['sale', 'adjustment_out', 'loss', 'out'].includes(type)) {
      return (
        <Badge className="bg-red-600 text-white border-red-700 flex items-center gap-1">
          <ArrowDownCircle className="w-3 h-3" />
          -{quantity.toFixed(2)}
        </Badge>
      );
    }
    
    return (
      <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20 flex items-center gap-1">
        <Settings2 className="w-3 h-3" />
        {isPositive ? '+' : isNegative ? '' : ''}{next - prev}
      </Badge>
    );
  };

  const getMovementLabel = (type: string) => {
    const labels: Record<string, string> = {
      'restock': 'Réapprovisionnement',
      'sale': 'Vente',
      'adjustment': 'Ajustement',
      'adjustment_in': 'Ajustement (+)',
      'adjustment_out': 'Ajustement (-)',
      'inventory_adjustment': 'Inventaire',
      'return': 'Retour',
      'loss': 'Perte'
    };
    return labels[type] || type;
  };

  const exportToExcel = () => {
    const data = filteredMovements.map(m => ({
      'Date': format(new Date(m.created_at), 'dd/MM/yyyy HH:mm', { locale: fr }),
      'Produit': m.product_name,
      'Catégorie': m.product_category,
      'Type': getMovementLabel(m.movement_type),
      'Quantité': m.quantity,
      'Stock avant': m.previous_quantity,
      'Stock après': m.new_quantity,
      'Raison': m.reason || '-',
      'Utilisateur': m.user_name
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Historique');
    XLSX.writeFile(wb, `historique_inventaire_${format(new Date(), 'yyyy-MM-dd_HHmm')}.xlsx`);
  };

  const exportToPDF = async () => {
    const { data: settings } = await supabase
      .from('company_settings')
      .select('*')
      .single();
    
    if (!settings) {
      toast({
        title: 'Erreur',
        description: 'Paramètres de l\'entreprise non disponibles',
        variant: 'destructive'
      });
      return;
    }

    generateInventoryHistoryPDF(
      filteredMovements.map(m => ({
        date: m.created_at,
        productName: m.product_name || 'Produit inconnu',
        category: m.product_category || '',
        movementType: m.movement_type,
        quantity: m.quantity,
        previousQuantity: m.previous_quantity,
        newQuantity: m.new_quantity,
        reason: m.reason,
        userName: m.user_name || 'Système'
      })),
      settings as CompanySettings,
      stats,
      dateRange
    );

    toast({
      title: 'Export réussi',
      description: 'Le rapport PDF a été téléchargé'
    });
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('fr-FR', { 
      minimumFractionDigits: 0,
      maximumFractionDigits: 2 
    }).format(num);
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Entrées</p>
                <p className="text-xl font-bold text-green-600">+{formatNumber(stats.ins)}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-500 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Sorties</p>
                <p className="text-xl font-bold text-red-600">-{formatNumber(stats.outs)}</p>
              </div>
              <TrendingDown className="w-8 h-8 text-red-500 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Ajustements</p>
                <p className="text-xl font-bold text-blue-600">{stats.adjustments}</p>
              </div>
              <Settings2 className="w-8 h-8 text-blue-500 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total mouvements</p>
                <p className="text-xl font-bold">{stats.total}</p>
              </div>
              <Package className="w-8 h-8 text-primary opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher produit, raison..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="min-w-[240px] justify-start">
                  <CalendarIcon className="w-4 h-4 mr-2" />
                  {format(dateRange.from, 'dd/MM/yyyy', { locale: fr })} - {format(dateRange.to, 'dd/MM/yyyy', { locale: fr })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="range"
                  selected={{ from: dateRange.from, to: dateRange.to }}
                  onSelect={(range) => {
                    if (range?.from && range?.to) {
                      setDateRange({ from: range.from, to: range.to });
                      setCalendarOpen(false);
                    } else if (range?.from) {
                      setDateRange({ from: range.from, to: range.from });
                    }
                  }}
                  locale={fr}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>

            <Select value={movementFilter} onValueChange={(v) => setMovementFilter(v as MovementFilter)}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent className="z-[100]">
                <SelectItem value="all">Tous les types</SelectItem>
                <SelectItem value="in">Entrées</SelectItem>
                <SelectItem value="out">Sorties</SelectItem>
                <SelectItem value="adjustment">Ajustements</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex gap-2">
              <Button variant="outline" size="icon" onClick={fetchMovements} disabled={loading}>
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
              <Button variant="outline" onClick={exportToExcel}>
                <Download className="w-4 h-4 mr-2" />
                Excel
              </Button>
              <Button variant="outline" onClick={exportToPDF}>
                <FileText className="w-4 h-4 mr-2" />
                PDF
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Movements Table */}
      <Card>
        <CardContent className="p-0">
          <ScrollArea className="h-[500px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date/Heure</TableHead>
                  <TableHead>Produit</TableHead>
                  <TableHead className="hidden md:table-cell">Type</TableHead>
                  <TableHead className="text-center">Quantité</TableHead>
                  <TableHead className="hidden sm:table-cell text-center">Stock</TableHead>
                  <TableHead className="hidden lg:table-cell">Raison</TableHead>
                  <TableHead className="hidden lg:table-cell">Utilisateur</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-10">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : paginatedItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                      Aucun mouvement trouvé
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedItems.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="whitespace-nowrap">
                        <div className="text-sm font-medium">
                          {format(new Date(m.created_at), 'dd/MM/yyyy', { locale: fr })}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(m.created_at), 'HH:mm', { locale: fr })}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{m.product_name}</div>
                        <div className="text-xs text-muted-foreground capitalize md:hidden">
                          {getMovementLabel(m.movement_type)}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <span className="text-sm">{getMovementLabel(m.movement_type)}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        {getMovementBadge(m.movement_type, m.quantity, m.previous_quantity, m.new_quantity)}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-center">
                        <span className="text-muted-foreground">{m.previous_quantity.toFixed(2)}</span>
                        <span className="mx-1">→</span>
                        <span className="font-medium">{m.new_quantity.toFixed(2)}</span>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell max-w-[200px] truncate">
                        {m.reason || <span className="text-muted-foreground">-</span>}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                        {m.user_name}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>

          <TablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalItems}
            pageSize={pageSize}
            onPrevPage={prevPage}
            onNextPage={nextPage}
            hasPrevPage={hasPrevPage}
            hasNextPage={hasNextPage}
          />
        </CardContent>
      </Card>
    </div>
  );
};
