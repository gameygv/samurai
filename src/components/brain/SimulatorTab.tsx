"use client";

import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageSquare, RefreshCcw, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface SimulatorTabProps {
  currentPrompts: Record<string, string>;
}

export const SimulatorTab = ({ currentPrompts }: SimulatorTabProps) => {
  const [simQuestion, setSimQuestion] = useState("");
  const [simHistory, setSimHistory] = useState<any[]>([]);
  const [simulating, setSimulating] = useState(false);

  const handleSimulate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!simQuestion.trim() || simulating) return;

    const currentQ = simQuestion;
    const newHistory = [...simHistory, { role: 'user', text: currentQ }];
    setSimHistory(newHistory);
    setSimQuestion("");
    setSimulating(true);

    try {
      const { data, error } = await supabase.functions.invoke('simulate-samurai', {
        body: { 
            question: currentQ, 
            history: newHistory.slice(-10), 
            customPrompts: currentPrompts 
        }
      });
      
      if (error || data?.error) throw new Error(data?.error || "Error en el Kernel");
      
      setSimHistory(prev => [...prev, { role: 'bot', text: data.answer, explanation: data.explanation }]);
    } catch (err: any) {
      toast.error(err.message);
      setSimHistory(prev => [...prev, { role: 'bot', text: "⚠ Fallo de conexión." }]);
    } finally {
      setSimulating(false);
    }
  };

  return (
    <Card className="bg-[#1A1714] border-slate-800 flex-1 flex flex-col overflow-hidden shadow-2xl rounded-2xl min-h-0">
      <CardHeader className="border-b border-slate-800 bg-slate-900/50 py-4 flex flex-row items-center justify-between shrink-0 px-6">
        <CardTitle className="text-slate-50 text-xs flex items-center gap-2 uppercase tracking-widest font-bold">
          <MessageSquare className="w-4 h-4 text-amber-500" /> Entorno de Pruebas
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={() => setSimHistory([])} className="h-8 text-[10px] text-slate-400 hover:text-amber-500">
          <RefreshCcw className="w-3 h-3 mr-2"/> Limpiar
        </Button>
      </CardHeader>
      <ScrollArea className="flex-1 p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {simHistory.map((m, i) => (
            <div key={i} className={cn("flex flex-col gap-2", m.role === 'user' ? 'items-end' : 'items-start')}>
              <div className={cn("p-4 rounded-2xl text-sm max-w-[85%] border shadow-lg", m.role === 'user' ? 'bg-indigo-900/40 border-indigo-900/60 text-slate-100' : 'bg-slate-900 border-slate-800 text-slate-200')}>
                {m.text}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
      <form onSubmit={handleSimulate} className="p-4 bg-slate-900/50 border-t border-slate-800 shrink-0 flex gap-4">
        <Input value={simQuestion} onChange={e => setSimQuestion(e.target.value)} placeholder="Simula un mensaje de cliente..." className="bg-slate-950 border-slate-800 text-slate-50 h-12 rounded-xl" disabled={simulating} />
        <Button type="submit" disabled={simulating || !simQuestion.trim()} className="bg-indigo-900 hover:bg-indigo-800 shrink-0 h-12 px-6 rounded-xl">
          <Send className="w-5 h-5 text-amber-500" />
        </Button>
      </form>
    </Card>
  );
};