import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Wifi, WifiOff, Database, Brain, Zap, AlertCircle } from 'lucide-react';

interface ServiceStatus {
  name: string;
  status: 'online' | 'offline' | 'checking';
  latency?: number;
  icon: any;
}

export const SystemStatus = () => {
  const [services, setServices] = useState<ServiceStatus[]>([
    { name: 'Database', status: 'checking', icon: Database },
    { name: 'Auth Core', status: 'checking', icon: Zap },
    { name: 'AI Brain', status: 'checking', icon: Brain },
  ]);

  useEffect(() => {
    checkServices();
    const interval = setInterval(checkServices, 30000); // Check every 30s
    return () => clearInterval(interval);
  }, []);

  const checkServices = async () => {
    const newStatuses: ServiceStatus[] = [];

    // Check Database
    const dbStart = performance.now();
    const { error: dbError } = await supabase.from('profiles').select('count', { count: 'exact', head: true });
    const dbLatency = Math.round(performance.now() - dbStart);
    newStatuses.push({
      name: 'Database',
      status: dbError ? 'offline' : 'online',
      latency: dbLatency,
      icon: Database
    });

    // Check Auth
    const { data: { session } } = await supabase.auth.getSession();
    newStatuses.push({
      name: 'Auth Core',
      status: session ? 'online' : 'offline',
      icon: Zap
    });

    // Check AI Brain (config table)
    const { error: brainError } = await supabase.from('app_config').select('count', { count: 'exact', head: true });
    newStatuses.push({
      name: 'AI Brain',
      status: brainError ? 'offline' : 'online',
      icon: Brain
    });

    setServices(newStatuses);
  };

  return (
    <Card className="bg-slate-900 border-slate-800">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm text-slate-400 uppercase tracking-widest flex items-center gap-2">
          <Wifi className="w-4 h-4" /> Estado del Sistema
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {services.map((service) => {
          const Icon = service.icon;
          return (
            <div key={service.name} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon className={`w-4 h-4 ${service.status === 'online' ? 'text-green-500' : service.status === 'offline' ? 'text-red-500' : 'text-slate-500'}`} />
                <span className="text-xs text-slate-300">{service.name}</span>
              </div>
              <div className="flex items-center gap-2">
                {service.latency && (
                  <span className="text-[10px] text-slate-500 font-mono">{service.latency}ms</span>
                )}
                <div className={`w-2 h-2 rounded-full ${service.status === 'online' ? 'bg-green-500' : service.status === 'offline' ? 'bg-red-500' : 'bg-slate-500 animate-pulse'}`} />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};