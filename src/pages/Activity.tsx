import React, { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity as ActivityIcon, Loader2, Terminal, Zap, ShieldAlert, CheckCircle2 } from 'lucide-react';
import ActivityFeed from '@/components/ActivityFeed';

const ActivityPage = () => {
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInitialActivities();

    const channel = supabase
      .channel('activity-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_logs' }, (payload) => {
        setActivities(prev => [payload.new, ...prev].slice(0, 50));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchInitialActivities = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('activity_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(30);
    
    if (data) setActivities(data);
    setLoading(false);
  };

  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
           <div>
              <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-2">
                 <ActivityIcon className="w-8 h-8 text-red-500" /> Monitor de Tráfico
              </h1>
              <p className="text-slate-400">Eventos del sistema capturados en tiempo real.</p>
           </div>
           <Badge className="bg-red-600/20 text-red-500 border-red-500/30 animate-pulse">
              LIVE STREAM
           </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
           <div className="md:col-span-3">
              <ActivityFeed activities={activities} loading={loading} />
           </div>
           <div className="space-y-4">
              <Card className="bg-slate-900 border-slate-800">
                 <CardHeader className="pb-2">
                    <CardTitle className="text-xs text-slate-500 uppercase font-mono">Estado Nodos</CardTitle>
                 </CardHeader>
                 <CardContent className="space-y-3">
                    <StatusLine label="Auth Core" status="OK" />
                    <StatusLine label="Database" status="OK" />
                    <StatusLine label="AI Edge" status="OK" />
                    <StatusLine label="Media Storage" status="OK" />
                 </CardContent>
              </Card>
              
              <div className="bg-indigo-900/10 border border-indigo-500/20 p-4 rounded-xl">
                 <p className="text-[10px] text-indigo-300 italic leading-relaxed">
                    Este monitor captura cada vez que Sam detecta un Email o una Ciudad, disparando automáticamente la sincronización con tu CRM y Meta CAPI.
                 </p>
              </div>
           </div>
        </div>
      </div>
    </Layout>
  );
};

const StatusLine = ({ label, status }: { label: string, status: string }) => (
   <div className="flex justify-between items-center text-xs">
      <span className="text-slate-400 font-mono">{label}</span>
      <span className="text-green-500 font-bold">● {status}</span>
   </div>
);

export default ActivityPage;