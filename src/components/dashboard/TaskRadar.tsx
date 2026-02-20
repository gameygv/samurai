import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, Send, Play, Brain, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Task {
  id: string;
  type: 'FOLLOWUP' | 'RESTART' | 'ANALYSIS';
  target: string;
  time: string;
  status: 'scheduled' | 'running';
}

interface TaskRadarProps {
  tasks: Task[];
}

export const TaskRadar = ({ tasks }: TaskRadarProps) => {
  return (
    <Card className="bg-slate-900 border-slate-800 shadow-xl overflow-hidden">
      <CardHeader className="py-3 border-b border-slate-800 bg-slate-950/20">
        <CardTitle className="text-[10px] uppercase text-white tracking-widest flex items-center gap-2">
          <Clock className="w-4 h-4 text-blue-400" /> Radar de Tareas Próximas
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-slate-800">
          {tasks.length === 0 ? (
            <div className="p-8 text-center text-slate-600 italic text-xs">
              No hay tareas automáticas programadas.
            </div>
          ) : (
            tasks.map((task) => (
              <div key={task.id} className="p-3 flex items-center justify-between hover:bg-slate-800/30 transition-colors group">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "p-1.5 rounded-lg",
                    task.type === 'FOLLOWUP' && "bg-blue-500/10 text-blue-400",
                    task.type === 'RESTART' && "bg-green-500/10 text-green-400",
                    task.type === 'ANALYSIS' && "bg-purple-500/10 text-purple-400"
                  )}>
                    {task.type === 'FOLLOWUP' && <Send className="w-3.5 h-3.5" />}
                    {task.type === 'RESTART' && <Play className="w-3.5 h-3.5" />}
                    {task.type === 'ANALYSIS' && <Brain className="w-3.5 h-3.5" />}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-200">{task.target}</span>
                    <span className="text-[9px] text-slate-500 uppercase font-mono">{task.type}</span>
                  </div>
                </div>
                <div className="text-right flex items-center gap-3">
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] font-bold text-slate-400">{task.time}</span>
                    <Badge variant="outline" className="text-[8px] h-3 px-1 border-slate-700 text-slate-500">PROGRAMADO</Badge>
                  </div>
                  <ChevronRight className="w-3 h-3 text-slate-700 group-hover:text-indigo-500 transition-colors" />
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};