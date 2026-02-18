import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Activity as ActivityIcon, MessageSquare, 
  UserPlus, AlertCircle, CheckCircle2, Terminal 
} from 'lucide-react';

interface ActivityFeedProps {
  activities: any[];
  loading: boolean;
}

const ActivityFeed = ({ activities, loading }: ActivityFeedProps) => {
  const getIcon = (action: string) => {
    switch (action) {
      case 'LOGIN': return <UserPlus className="w-5 h-5" />;
      case 'CHAT': return <MessageSquare className="w-5 h-5" />;
      case 'ERROR': return <AlertCircle className="w-5 h-5" />;
      case 'CREATE': return <CheckCircle2 className="w-5 h-5" />;
      case 'UPDATE': return <Terminal className="w-5 h-5" />;
      default: return <ActivityIcon className="w-5 h-5" />;
    }
  };

  const getColor = (action: string) => {
    switch (action) {
      case 'ERROR': return 'bg-red-500/10 text-red-500';
      case 'LOGIN': return 'bg-green-500/10 text-green-500';
      case 'CHAT': return 'bg-blue-500/10 text-blue-500';
      default: return 'bg-slate-800 text-slate-400';
    }
  };

  if (loading) return <div className="text-center py-10 text-slate-500">Cargando actividad...</div>;
  if (activities.length === 0) return <div className="text-center py-10 text-slate-500">No hay actividad reciente.</div>;

  return (
    <div className="relative border-l border-slate-800 ml-4 space-y-8 py-4">
      {activities.map((item) => (
        <div key={item.id} className="relative pl-8 group animate-in slide-in-from-left-2 duration-300">
          <div className={`absolute left-[-5px] top-1 w-2.5 h-2.5 rounded-full border border-slate-950 ${item.action === 'ERROR' ? 'bg-red-500' : 'bg-indigo-500'}`}></div>
          <Card className="bg-slate-900 border-slate-800 hover:border-slate-700 transition-colors">
            <CardContent className="p-4 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
              <div className="flex items-start gap-4">
                <div className={`p-2 rounded-lg ${getColor(item.action)}`}>
                  {getIcon(item.action)}
                </div>
                <div>
                  <h4 className="text-white font-medium">{item.description}</h4>
                  <p className="text-slate-500 text-xs mt-1 font-mono uppercase">{item.resource} | STATUS: {item.status}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-slate-300">{new Date(item.created_at).toLocaleTimeString()}</p>
                <p className="text-xs text-slate-500">por {item.username}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      ))}
    </div>
  );
};

export default ActivityFeed;