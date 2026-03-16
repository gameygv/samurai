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
  <div className="p-2 bg-slate-900 border border-slate-700 rounded-lg space-y-2 relative pr-8">
    <Button variant="ghost" size="icon" onClick={() => onRemove(reminder.id)} className="absolute right-1 top-1 h-6 w-6 text-slate-500 hover:text-red-400">
      <Trash2 className="w-3 h-3"/>
    </Button>
    <Input 
      value={reminder.title} 
      onChange={e => onUpdate(reminder.id, 'title', e.target.value)} 
      placeholder="Título..." 
      className="h-7 text-xs bg-slate-950 border-slate-800" 
    />
    <div className="flex gap-2">
      <Input 
        type="datetime-local" 
        value={reminder.datetime} 
        onChange={e => onUpdate(reminder.id, 'datetime', e.target.value)} 
        className="h-7 text-xs bg-slate-950 border-slate-800 flex-1" 
      />
      <div className="flex items-center gap-1 bg-slate-950 border-slate-800 border rounded-md px-2 shrink-0">
        <Bell className="w-3 h-3 text-slate-500" />
        <Input 
          type="number" 
          min="0" 
          value={reminder.notify_minutes} 
          onChange={e => onUpdate(reminder.id, 'notify_minutes', parseInt(e.target.value))} 
          className="h-5 w-10 p-0 text-xs bg-transparent border-0 text-center font-mono" 
        />
        <span className="text-[9px] text-slate-500">min</span>
      </div>
    </div>
  </div>
);