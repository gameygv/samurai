import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BrainCircuit, CheckCircle2, AlertTriangle, ShieldCheck, Globe, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BrainHealthCardProps {
  health: {
    adnCoreStatus: 'ok' | 'missing';
    ciaRules: number;
    webHealth: number;
    overallStatus: 'Operational' | 'Degraded' | 'Sync Required';
  };
}

const StatusItem = ({ icon: Icon, label, value, status }: { icon: React.ElementType, label: string, value: string | number, status: 'ok' | 'warn' | 'error' }) => (
  <div className="flex items-center justify-between text-xs">
    <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
      <Icon className={cn(
        "w-3.5 h-3.5",
        status === 'ok' && 'text-green-500',
        status === 'warn' && 'text-yellow-500',
        status === 'error' && 'text-red-500'
      )} />
      <span>{label}</span>
    </div>
    <span className="font-mono text-slate-500 dark:text-slate-400">{value}</span>
  </div>
);

export const BrainHealthCard = ({ health }: BrainHealthCardProps) => {
  const getStatusBadgeVariant = () => {
    switch (health.overallStatus) {
      case 'Operational': return 'bg-green-600/20 text-green-600 dark:text-green-400 border-green-500/30';
      case 'Degraded': return 'bg-yellow-600/20 text-yellow-600 dark:text-yellow-400 border-yellow-500/30';
      case 'Sync Required': return 'bg-red-600/20 text-red-600 dark:text-red-400 border-red-500/30';
      default: return 'secondary';
    }
  };

  return (
    <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-lg dark:shadow-xl">
      <CardHeader className="border-b border-slate-200 dark:border-slate-800 py-3">
        <CardTitle className="text-slate-800 dark:text-white text-[10px] uppercase tracking-widest flex items-center gap-2">
          <BrainCircuit className="w-4 h-4 text-purple-500 dark:text-purple-400" />
          Estado del Cerebro IA
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 space-y-3">
        <StatusItem
          icon={ShieldCheck}
          label="ADN Core"
          value={health.adnCoreStatus === 'ok' ? 'Cargado' : 'Faltante'}
          status={health.adnCoreStatus === 'ok' ? 'ok' : 'error'}
        />
        <StatusItem
          icon={AlertTriangle}
          label="Reglas #CIA Activas"
          value={`${health.ciaRules} reglas`}
          status={'ok'}
        />
        <StatusItem
          icon={Globe}
          label="Salud Verdad Maestra"
          value={`${health.webHealth}%`}
          status={health.webHealth > 80 ? 'ok' : (health.webHealth > 50 ? 'warn' : 'error')}
        />
      </CardContent>
      <div className="p-3 bg-slate-50 dark:bg-slate-950/30 border-t border-slate-200 dark:border-slate-800 text-center">
        <Badge variant="outline" className={cn("text-[9px] font-bold", getStatusBadgeVariant())}>
          ESTADO: {health.overallStatus.toUpperCase()}
        </Badge>
      </div>
    </Card>
  );
};
