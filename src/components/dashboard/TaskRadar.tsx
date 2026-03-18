import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, Send, CalendarClock, MessageSquare, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Task {
  id: string;
  type: string;
  target: string;
  time: string;
  status: string;
  rawLead?: any;
}

interface TaskRadarProps {
  tasks: Task[];
}

export const TaskRadar = ({ tasks }: TaskRadarProps) => {
  const navigate = useNavigate();

  const handleTaskClick = (task: Task) => {
     if (task.rawLead && task.rawLead.id) {
         navigate(`/leads?id=${task.rawLead.id}`);
     } else if (task.id.startsWith('cobro-')) {
         navigate(`/payments`);
     }
  };

  return (
    <Card className="bg-[#0a0a0c] border-[#1a1a1a] shadow-2xl overflow-hidden flex flex-col h-[250px] rounded-3xl">
      <CardHeader className="py-4 border-b border-[#1a1a1a] bg-[#0f0f11]/50 shrink-0">
        <CardTitle className="text-xs uppercase text-slate-300 tracking-widest flex items-center gap-2 font-bold">
          <Clock className="w-4 h-4 text-blue-500" /> Próximas Tareas & Retargeting
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0 flex-1 overflow-y-auto custom-scrollbar">
        <div className="divide-y divide-[#1a1a1a]">
          {tasks.length === 0 ? (
            <div className="p-8 text-center text-slate-600 italic text-xs flex flex-col items-center gap-2 mt-4">
              <CalendarClock className="w-6 h-6 opacity-30" />
              No hay tareas programadas.
            </div>
          ) : (
            tasks.map((task) => (
              <button 
                key={task.id} 
                onClick={() => handleTaskClick(task)}
                className="w-full text-left p-4 flex items-center justify-between hover:bg-[#121214] transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "p-2 rounded-xl border",
                    task.type === 'ATRASADO' ? "bg-red-950/30 text-red-500 border-red-900/50" : 
                    task.type === 'COBRO HOY' ? "bg-amber-950/30 text-amber-500 border-amber-900/50" : 
                    "bg-blue-950/30 text-blue-400 border-blue-900/50"
                  )}>
                    {task.type === 'ATRASADO' ? <MessageSquare className="w-4 h-4" /> : <Send className="w-4 h-4" />}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-slate-200 group-hover:text-white transition-colors">{task.target}</span>
                    <span className={cn("text-[9px] uppercase font-bold tracking-widest mt-0.5", 
                        task.type === 'ATRASADO' ? 'text-red-500' : 
                        task.type === 'COBRO HOY' ? 'text-amber-500' : 
                        'text-blue-500'
                    )}>
                        {task.type}
                    </span>
                  </div>
                </div>
                <div className="text-right flex items-center gap-3">
                  <span className="text-[10px] font-bold text-slate-500 font-mono">{task.time}</span>
                  <ChevronRight className="w-4 h-4 text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </button>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};