import { supabase } from '@/integrations/supabase/client';

export interface LogEntry {
  action: 'LOGIN' | 'LOGOUT' | 'CREATE' | 'UPDATE' | 'DELETE' | 'ERROR' | 'TEST';
  resource: 'AUTH' | 'USERS' | 'PROMPTS' | 'BRAIN' | 'SYSTEM';
  description: string;
  status: 'OK' | 'ERROR' | 'PENDING';
  metadata?: any;
}

export const logActivity = async (entry: LogEntry) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    // Obtener username del perfil si es posible, si no usar email o 'system'
    let username = 'system';
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', user.id)
        .single();
      username = profile?.username || user.email || 'unknown';
    }

    const { error } = await supabase.from('activity_logs').insert({
      user_id: user?.id || null,
      username: username,
      action: entry.action,
      resource: entry.resource,
      description: entry.description,
      status: entry.status,
      metadata: entry.metadata || {},
      created_at: new Date().toISOString(),
    });

    if (error) console.error('Error writing log:', error);
  } catch (err) {
    console.error('Critical logging error:', err);
  }
};