import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Bell, Trash2 } from 'lucide-react';

interface ReminderItemProps {
  reminder: any;
  onUpdate: (id: string, field: string, val: any) => void;
  onRemove: (id: string) => void;
}

export const ReminderItem = ({ reminder, onUpdate, onRemove }: ReminderItemProps) => (
  <div className="p-3 bg-[#121214] border border-[#222225] rounded-xl space-y-3 relative group">
    <Button 
      variant="ghost" 
      size="icon" 
      onClick={() => onRemove(reminder.id)} 
      className="absolute right-2 top-2 h-6 w-6 text-slate-600 hover:text-red-500 hover:bg-red-500/10 rounded-md md:opacity-0 group-hover:opacity-100 transition-opacity z-10"
    >
      <Trash2 className="w-3.5 h-3.5"/>
    </Button>
    
    <Input 
      value={reminder.title} 
      onChange={e => onUpdate(reminder.id, 'title', e.target.value)} 
      placeholder="Ej: Llamar para cierre..." 
      className="h-8 text-xs bg-[#0a0a0c] border-[#222225] text-slate-200 focus-visible:ring-blue-500 pr-8 rounded-lg" 
    />
    
    <div className="flex gap-2">
      <Input 
        type="datetime-local" 
        value={reminder.datetime} 
        onChange={e => onUpdate(reminder.id, 'datetime', e.target.value)} 
        className="h-8 text-[10px] bg-[#0a0a0c] border-[#222225] flex-1 text-blue-400 focus-visible:ring-blue-500 rounded-lg" 
      />
      <div className="flex items-center gap-1 bg-[#0a0a0c] border-[#222225] border rounded-lg px-2 shrink-0">
        <Bell className="w-3 h-3 text-slate-500" />
        <Input 
          type="number" 
          min="0" 
          value={reminder.notify_minutes} 
          onChange={e => onUpdate(reminder.id, 'notify_minutes', parseInt(e.target.value))} 
          className="h-6 w-10 p-0 text-[10px] bg-transparent border-0 text-center font-mono text-amber-500 focus-visible:ring-0" 
        />
        <span className="text-[9px] text-slate-600 font-bold uppercase tracking-widest">min</span>
      </div>
    </div>
  </div>
);