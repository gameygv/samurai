import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Activity as ActivityIcon, MessageSquare, 
  UserPlus, AlertCircle, CheckCircle2, Terminal, Cpu, Database, Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ActivityFeedProps {
  activities: any[];
  loading: boolean;
}

const ActivityFeed = ({ activities, loading }: ActivityFeedProps) => {
  const getIcon = (action: string) => {
    switch (action) {
      case 'LOGIN': return <Zap className="w-4 h-4" />;
      case 'CHAT': return <MessageSquare className="w-4 h-4" />;
      case 'ERROR': return <AlertCircle className="w-4 h-4" />;
      case 'CREATE': return <Cpu className="w-4 h-4" />;
      case 'UPDATE': return <Terminal className="w-4 h-4" />;
      default: return <ActivityIcon className="w-4 h-4" />;
    }
  };

  const getStatusColor = (status: string, action: string) => {
    if (status === 'ERROR' || action === 'ERROR') return 'text-red-500 border-red-500/20 bg-red-500/5';
    if (action === 'LOGIN') return 'text-emerald-500 border-emerald-500/20 bg-emerald-500/5';
    if (action === 'CHAT') return 'text-indigo-400 border-indigo-500/20 bg-indigo-500/5';
    return 'text-slate-400 border-slate-800 bg-slate-900/50';
  };

  if (loading) return <div className="text-center py-20 text-indigo-500 font-mono text-xs animate-pulse uppercase tracking-widest">Interceptando Transmisiones...</div>;
  if (activities.length === 0) return <div className="text-center py-20 text-slate-600 italic uppercase text-[10px] tracking-widest">No mission data available.</div>;

  return (
    <div className="space-y-3">
      {activities.map((item) => (
        <div key={item.id} className="animate-in fade-in slide-in-from-left-2 duration-300">
          <div className={cn(
            "border rounded-xl p-3 flex items-start gap-4 transition-all hover:bg-slate-900/80 group",
            getStatusColor(item.status, item.action)
          )}>
            <div className="p-2 rounded-lg bg-slate-950 border border-inherit shrink-0">
              {getIcon(item.action)}
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-start">
                <h4 className="text-xs font-bold text-slate-200 truncate pr-4">{item.description}</h4>
                <span className="text-[9px] font-mono text-slate-500 whitespace-nowrap">{new Date(item.created_at).toLocaleTimeString()}</span>
              </div>
              <div className="flex items-center gap-3 mt-1.5">
                <span className="text-[9px] font-mono uppercase tracking-tighter bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800 text-slate-500">
                  SRC: {item.resource}
                </span>
                <span className="text-[9px] text-slate-600 truncate">
                  BY: <span className="text-slate-400">{item.username || 'System'}</span>
                </span>
              </div>
            </div>

            {item.status === 'ERROR' && (
               <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.6)] mt-1.5" />
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default ActivityFeed;