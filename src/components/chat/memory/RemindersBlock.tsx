"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { CalendarClock, ChevronDown, Plus, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ReminderItem } from './ReminderItem';

interface RemindersBlockProps {
  memoryForm: any;
  savingReminders: boolean;
  onAddReminder: () => void;
  onUpdateReminder: (id: string, field: string, val: any) => void;
  onRemoveReminder: (id: string) => void;
  onSaveReminders: () => void;
}

export const RemindersBlock = ({
  memoryForm, savingReminders, onAddReminder, onUpdateReminder, onRemoveReminder, onSaveReminders
}: RemindersBlockProps) => {
  const [remindersOpen, setRemindersOpen] = useState(true);
  
  // ✅ CORREGIDO: Mapeo estricto del arreglo para evitar caídas si es undefined
  const safeReminders = Array.isArray(memoryForm?.reminders) ? memoryForm.reminders : [];

  return (
    <div className="pt-2 border-t border-[#1a1a1a]">
       <button onClick={() => setRemindersOpen(!remindersOpen)} className="w-full flex justify-between items-center py-2 text-[10px] font-bold text-white uppercase tracking-widest hover:text-blue-400 transition-colors">
          <span className="flex items-center gap-2"><CalendarClock className="w-3.5 h-3.5 text-blue-500" /> Tareas y Recordatorios</span>
          <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", remindersOpen ? "rotate-180" : "")} />
       </button>
       {remindersOpen && (
          <div className="pt-3 pb-2 space-y-3">
             {safeReminders.length === 0 ? (
                <p className="text-[10px] text-slate-600 italic text-center py-2">No hay tareas programadas.</p>
             ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-2">
                   {safeReminders.map((rem: any) => (
                      <ReminderItem key={rem.id} reminder={rem} onUpdate={onUpdateReminder} onRemove={onRemoveReminder} />
                   ))}
                </div>
             )}
             <div className="flex gap-2">
                <Button onClick={onAddReminder} variant="outline" className="flex-1 h-8 text-[10px] bg-[#121214] border-[#222225] text-blue-400 hover:text-blue-300 hover:bg-[#161618] uppercase tracking-widest font-bold">
                   <Plus className="w-3 h-3 mr-1" /> Nueva Tarea
                </Button>
                {safeReminders.length > 0 && (
                   <Button onClick={onSaveReminders} disabled={savingReminders} className="h-8 px-4 text-[10px] bg-blue-600 hover:bg-blue-500 text-white uppercase tracking-widest font-bold shadow-lg">
                      {savingReminders ? <Loader2 className="w-3 h-3 animate-spin"/> : "Guardar"}
                   </Button>
                )}
             </div>
          </div>
       )}
    </div>
  );
};