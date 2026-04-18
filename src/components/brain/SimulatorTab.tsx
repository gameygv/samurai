"use client";

import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, RefreshCcw, Send, Bot, User, Brain, Layers, Zap, Loader2 } from 'lucide-react';
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
      
      setSimHistory(prev => [...prev, { 
          role: 'bot', 
          text: data.answer, 
          explanation: data.explanation 
      }]);
    } catch (err: any) {
      toast.error(err.message);
      setSimHistory(prev => [...prev, { role: 'bot', text: "⚠ Fallo de conexión con el Kernel." }]);
    } finally {
      setSimulating(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
      {/* CHAT SIMULADO */}
      <div className="lg:col-span-8 flex flex-col min-h-0">
        <Card className="bg-[#1A1714] border-slate-800 flex-1 flex flex-col overflow-hidden shadow-2xl rounded-2xl">
          <CardHeader className="border-b border-slate-800 bg-slate-900/50 py-4 flex flex-row items-center justify-between shrink-0 px-6">
            <CardTitle className="text-slate-50 text-xs flex items-center gap-2 uppercase tracking-widest font-bold">
              <MessageSquare className="w-4 h-4 text-amber-500" /> Entorno de Pruebas (Sandbox)
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setSimHistory([])} className="h-8 text-[10px] text-slate-400 hover:text-amber-500">
              <RefreshCcw className="w-3 h-3 mr-2"/> Limpiar Chat
            </Button>
          </CardHeader>
          
          <ScrollArea className="flex-1 p-6">
            <div className="max-w-4xl mx-auto space-y-6">
              {simHistory.length === 0 && (
                <div className="text-center py-20 opacity-20">
                   <Bot className="w-16 h-16 mx-auto mb-4" />
                   <p className="text-sm font-bold uppercase tracking-widest">Kernel en espera de input...</p>
                </div>
              )}
              {simHistory.map((m, i) => (
                <div key={i} className={cn("flex flex-col gap-2", m.role === 'user' ? 'items-end' : 'items-start')}>
                  <div className={cn(
                    "p-4 rounded-2xl text-sm max-w-[85%] border shadow-lg",
                    m.role === 'user' ? 'bg-indigo-900/40 border-indigo-900/60 text-slate-100' : 'bg-slate-900 border-slate-800 text-slate-200'
                  )}>
                    {(() => {
                      if (m.role !== 'bot' || !m.text) return m.text;
                      const mediaRegex = /<<MEDIA:(https?:\/\/[^>]+)>>/g;
                      const parts: React.ReactNode[] = [];
                      let lastIdx = 0;
                      let match;
                      const txt = m.text as string;
                      while ((match = mediaRegex.exec(txt)) !== null) {
                        if (match.index > lastIdx) parts.push(txt.substring(lastIdx, match.index));
                        parts.push(<img key={match.index} src={match[1]} alt="Media IA" className="rounded-xl mt-2 mb-1 max-w-full border border-slate-700" />);
                        lastIdx = match.index + match[0].length;
                      }
                      if (lastIdx < txt.length) parts.push(txt.substring(lastIdx));
                      return parts.length > 0 ? parts : m.text;
                    })()}
                  </div>
                  <div className="flex items-center gap-2 px-2">
                     {m.role === 'bot' ? <Bot className="w-3 h-3 text-amber-500" /> : <User className="w-3 h-3 text-indigo-400" />}
                     <span className="text-[9px] uppercase font-bold text-slate-600 tracking-widest">{m.role === 'bot' ? 'Samurai AI' : 'Cliente Simulado'}</span>
                  </div>
                </div>
              ))}
              {simulating && (
                <div className="flex gap-2 items-center text-amber-500 text-[10px] font-bold animate-pulse">
                   <Loader2 className="w-3 h-3 animate-spin" /> PROCESANDO KERNEL...
                </div>
              )}
            </div>
          </ScrollArea>

          <form onSubmit={handleSimulate} className="p-4 bg-slate-900/50 border-t border-slate-800 shrink-0 flex gap-4">
            <Input 
              value={simQuestion} 
              onChange={e => setSimQuestion(e.target.value)} 
              placeholder="Simula un mensaje de cliente..." 
              className="bg-slate-950 border-slate-800 text-slate-50 h-12 rounded-xl focus:border-amber-500" 
              disabled={simulating} 
            />
            <Button type="submit" disabled={simulating || !simQuestion.trim()} className="bg-indigo-900 hover:bg-indigo-800 shrink-0 h-12 px-6 rounded-xl shadow-lg">
              <Send className="w-5 h-5 text-amber-500" />
            </Button>
          </form>
        </Card>
      </div>

      {/* PANEL DE RAZONAMIENTO */}
      <div className="lg:col-span-4 flex flex-col gap-6">
        <Card className="bg-slate-900 border-slate-800 border-l-4 border-l-indigo-500 shadow-xl rounded-2xl overflow-hidden">
          <CardHeader className="bg-slate-950/30 border-b border-slate-800">
             <CardTitle className="text-xs uppercase tracking-widest text-indigo-400 flex items-center gap-2">
                <Brain className="w-4 h-4" /> Razonamiento IA
             </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
             {simHistory.length > 0 && simHistory[simHistory.length - 1].role === 'bot' ? (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                   <div className="space-y-2">
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                         <Layers className="w-3 h-3" /> Capas Utilizadas:
                      </p>
                      <div className="flex flex-wrap gap-2">
                         {simHistory[simHistory.length - 1].explanation?.layers_used?.map((l: string) => (
                            <Badge key={l} variant="outline" className="bg-indigo-900/20 border-indigo-500/30 text-indigo-300 text-[9px]">{l}</Badge>
                         ))}
                      </div>
                   </div>
                   <div className="space-y-2">
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                         <Zap className="w-3 h-3" /> Lógica de Respuesta:
                      </p>
                      <p className="text-xs text-slate-400 leading-relaxed italic bg-slate-950 p-3 rounded-xl border border-slate-800">
                         "{simHistory[simHistory.length - 1].explanation?.reasoning}"
                      </p>
                   </div>
                </div>
             ) : (
                <div className="py-10 text-center text-slate-600 italic text-[10px] uppercase tracking-widest">
                   Envía un mensaje para ver el análisis del Kernel.
                </div>
             )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};