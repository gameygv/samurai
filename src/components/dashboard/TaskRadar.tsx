import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, Send, Play, Brain, ChevronRight, CalendarClock, MessageSquare } from 'lucide-react';
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
  return (
    <Card className="bg-slate-900 border-slate-800 shadow-xl overflow-hidden flex flex-col h-[250px]">
      <CardHeader className="py-3 border-b border-slate-800 bg-slate-950/20 shrink-0">
        <CardTitle className="text-[10px] uppercase text-white tracking-widest flex items-center gap-2">
          <Clock className="w-4 h-4 text-blue-400" /> Próximas Tareas & Retargeting
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0 flex-1 overflow-y-auto custom-scrollbar">
        <div className="divide-y divide-slate-800">
          {tasks.length === 0 ? (
            <div className="p-8 text-center text-slate-600 italic text-xs flex flex-col items-center gap-2">
              <CalendarClock className="w-6 h-6 opacity-30" />
              No hay tareas programadas.
            </div>
          ) : (
            tasks.map((task) => (
              <div key={task.id} className="p-3 flex items-center justify-between hover:bg-slate-800/30 transition-colors group cursor-default">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "p-1.5 rounded-lg",
                    task.type === 'ATRASADO' ? "bg-red-500/10 text-red-400" : "bg-blue-500/10 text-blue-400"
                  )}>
                    {task.type === 'ATRASADO' ? <MessageSquare className="w-3.5 h-3.5" /> : <Send className="w-3.5 h-3.5" />}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-200">{task.target}</span>
                    <span className={cn("text-[9px] uppercase font-mono", task.type === 'ATRASADO' ? 'text-red-500' : 'text-slate-500')}>{task.type}</span>
                  </div>
                </div>
                <div className="text-right flex items-center gap-3">
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] font-bold text-slate-400">{task.time}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};