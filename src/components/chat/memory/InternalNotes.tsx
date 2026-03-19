"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StickyNote, ChevronDown, Send, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface InternalNotesProps {
  internalNotes: any[];
  onAddNote: (text: string) => void;
  onDeleteNote: (id: string) => void;
  sendingNote: boolean;
}

export const InternalNotes = ({ internalNotes, onAddNote, onDeleteNote, sendingNote }: InternalNotesProps) => {
  const [notesOpen, setNotesOpen] = useState(true);
  const [newNote, setNewNote] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
     e.preventDefault();
     if (!newNote.trim()) return;
     onAddNote(newNote);
     setNewNote('');
  };

  return (
    <div className="pt-2 border-t border-[#1a1a1a]">
       <button onClick={() => setNotesOpen(!notesOpen)} className="w-full flex justify-between items-center py-2 text-[10px] font-bold text-white uppercase tracking-widest hover:text-amber-400 transition-colors">
          <span className="flex items-center gap-2"><StickyNote className="w-3.5 h-3.5 text-amber-500" /> Notas Internas (Equipo)</span>
          <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", notesOpen ? "rotate-180" : "")} />
       </button>
       {notesOpen && (
          <div className="pt-3 pb-2 space-y-3">
             {internalNotes.length === 0 ? (
                <p className="text-[10px] text-slate-600 italic text-center py-2">No hay notas registradas.</p>
             ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-2">
                   {internalNotes.map(n => (
                      <div key={n.id} className="bg-amber-950/20 border border-amber-900/50 p-2.5 rounded-lg group relative">
                         <div className="flex justify-between items-center mb-1">
                            <span className="text-[9px] font-bold text-amber-500">{n.metadata?.author || 'Agente'}</span>
                            <div className="flex items-center gap-2">
                               <span className="text-[8px] text-slate-500 font-mono">{new Date(n.created_at).toLocaleDateString()}</span>
                               <button 
                                 onClick={() => onDeleteNote(n.id)}
                                 className="text-slate-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                 title="Borrar nota"
                               >
                                  <Trash2 className="w-3 h-3" />
                               </button>
                            </div>
                         </div>
                         <p className="text-[10px] text-amber-100/90 leading-relaxed pr-4">{n.mensaje}</p>
                      </div>
                   ))}
                </div>
             )}
             <form onSubmit={handleSubmit} className="flex gap-2">
                <Input value={newNote} onChange={e => setNewNote(e.target.value)} placeholder="Añadir nota rápida..." className="h-8 text-[10px] bg-[#121214] border-[#222225] focus-visible:ring-amber-500 text-slate-200" disabled={sendingNote}/>
                <Button type="submit" size="icon" className="h-8 w-8 bg-amber-600 hover:bg-amber-500 text-slate-900 shrink-0" disabled={sendingNote || !newNote.trim()}><Send className="w-3 h-3"/></Button>
             </form>
          </div>
       )}
    </div>
  );
};