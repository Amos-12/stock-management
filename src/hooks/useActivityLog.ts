import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export type ActivityActionType = 
  | 'sale_created'
  | 'product_added'
  | 'product_updated'
  | 'product_deleted'
  | 'stock_adjusted'
  | 'user_approved'
  | 'user_deactivated'
  | 'settings_updated';

export interface ActivityLog {
  id: string;
  user_id?: string;
  action_type: ActivityActionType;
  entity_type: string;
  entity_id?: string;
  description: string;
  metadata?: any;
  created_at: string;
  user_name?: string;
}

export interface FilterOptions {
  actionType?: ActivityActionType;
  userId?: string;
  entityType?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
}

export const useActivityLog = () => {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  const fetchActivityLogs = async (
    filters?: FilterOptions,
    page: number = 1,
    pageSize: number = 50
  ) => {
    try {
      setLoading(true);

      let query = supabase
        .from('activity_logs')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false });

      if (filters?.actionType) {
        query = query.eq('action_type', filters.actionType);
      }

      if (filters?.userId) {
        query = query.eq('user_id', filters.userId);
      }

      if (filters?.entityType) {
        query = query.eq('entity_type', filters.entityType);
      }

      if (filters?.startDate) {
        query = query.gte('created_at', filters.startDate);
      }

      if (filters?.endDate) {
        query = query.lte('created_at', filters.endDate);
      }

      if (filters?.search) {
        query = query.ilike('description', `%${filters.search}%`);
      }

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;

      if (error) throw error;

      const logsWithUserNames = await Promise.all(
        (data || []).map(async (log) => {
          if (log.user_id) {
            const { data: profileData } = await supabase
              .from('profiles')
              .select('full_name')
              .eq('user_id', log.user_id)
              .single();
            
            return {
              ...log,
              user_name: profileData?.full_name || 'Utilisateur inconnu'
            };
          }
          return { ...log, user_name: 'Système' };
        })
      );

      setLogs(logsWithUserNames);
      setTotalCount(count || 0);
    } catch (error) {
      console.error('Error fetching activity logs:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les logs d'activité",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return {
    logs,
    loading,
    totalCount,
    fetchActivityLogs
  };
};
