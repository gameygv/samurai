"use client";

import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bot, RefreshCcw, Loader2, ImageIcon, Send, FlaskConical, Sparkles, CheckCircle2, X, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface LabTabProps {
  currentPrompts: Record<string, string>;
  onApplyPrompts: (prompts: Record<string, string>) => void;
}

export const LabTab = ({ currentPrompts, onApplyPrompts }: LabTabProps) => {
  const [labMessages, setLabMessages] = useState<any[]>([]);
  const [labInput, setLabInput] = useState("");
  const [labImage, setLabImage] = useState<string | null>(null);
  const [labProcessing, setLabProcessing] = useState(false);
  const [proposedPrompts, setProposedPrompts] = useState<any>(null);

  const handleLabImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setLabImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleLabSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!labInput.trim() && !labImage) || labProcessing) return;

    const userMsg = { role: 'user', text: labInput, image: labImage };
    setLabMessages(prev => [...prev, userMsg]);
    const currentInput = labInput;
    const currentImage = labImage;
    setLabInput("");
    setLabImage(null);
    setLabProcessing(true);

    try {
      const { data, error } = await supabase.functions.invoke('tune-samurai-prompts', {
        body: { 
            messages: [...labMessages, { role: 'user', text: currentInput, image: currentImage }], 
            currentPrompts 
        }
      });
      
      if (error) throw error;
      
      setLabMessages(prev => [...prev, { role: 'assistant', text: data.result.message }]);
      setProposedPrompts(data.result.prompts);
      toast.info("El Arquitecto ha redactado una propuesta de mejora.");
    } catch (err: any) {
      toast.error("Error en Laboratorio: " + err.message);
    } finally {
      setLabProcessing(false);
    }
  };

  const applyProposedPrompts = () => {
    if (!proposedPrompts) return;
    onApplyPrompts(proposedPrompts);
    setProposedPrompts(null);
    toast.success("Propuesta inyectada en los editores. Pulsa 'Aplicar Cambios' para finalizar.");
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
      <div className="lg:col-span-8 flex flex-col gap-4 min-h-0">
        <Card className="bg-slate-900 border-slate-800 flex-1 flex flex-col overflow-hidden shadow-2xl rounded-2xl min-h-0">
          <CardHeader className="border-b border-slate-800 bg-slate-950/30 py-4 flex flex-row items-center justify-between shrink-0 px-6">
            <div>
              <CardTitle className="text-slate-50 text-xs flex items-center gap-2 uppercase tracking-widest font-bold">
                <FlaskConical className="w-4 h-4 text-amber-500" /> Arquitecto de Prompts
              </CardTitle>
              <CardDescription className="text-[10px] mt-1">Evolución asistida: sube capturas o describe errores.</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => { setLabMessages([]); setProposedPrompts(null); }} className="h-8 text-[10px] text-slate-400 hover:text-amber-500">
              <RefreshCcw className="w-3 h-3 mr-2"/> Reiniciar Sesión
            </Button>
          </CardHeader>
          
          <ScrollArea className="flex-1 p-6">
            <div className="space-y-6">
              {labMessages.length === 0 && (
                <div className="text-center py-20">
                  <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-amber-500/20">
                     <Bot className="w-8 h-8 text-amber-500" />
                  </div>
                  <p className="text-slate-400 italic text-sm max-w-md mx-auto">
                    "Hola, soy el Arquitecto. Muéstrame un chat donde Sam falló o dime qué quieres que aprenda, y yo reescribiré su ADN por ti."
                  </p>
                </div>
              )}
              {labMessages.map((m, i) => (
                <div key={i} className={cn("flex flex-col gap-2", m.role === 'user' ? 'items-end' : 'items-start')}>
                  <div className={cn(
                    "p-4 rounded-2xl text-sm max-w-[85%] border shadow-lg", 
                    m.role === 'user' ? 'bg-indigo-900/40 border-indigo-900/60 text-slate-100' : 'bg-slate-950 border-slate-800 text-slate-300'
                  )}>
                    {m.image && <img src={m.image} className="w-full max-w-[300px] rounded-lg mb-3 border border-white/10" alt="Uploaded" />}
                    {m.text}
                  </div>
                </div>
              ))}
              {labProcessing && (
                <div className="flex gap-2 items-center text-amber-500 text-xs animate-pulse font-bold">
                   <Loader2 className="w-4 h-4 animate-spin"/> EL ARQUITECTO ESTÁ REDACTANDO...
                </div>
              )}
            </div>
          </ScrollArea>
          
          <form onSubmit={handleLabSubmit} className="p-4 bg-slate-950/50 border-t border-slate-800 shrink-0 space-y-4">
            {labImage && (
              <div className="flex items-center gap-4 bg-slate-900 p-2 rounded-xl border border-slate-800 animate-in slide-in-from-bottom-2">
                <img src={labImage} className="w-12 h-12 rounded-lg object-cover border border-slate-700" alt="Preview" />
                <span className="text-[10px] text-amber-500 font-bold uppercase tracking-widest flex-1">Captura de error lista</span>
                <Button size="sm" variant="ghost" onClick={() => setLabImage(null)} className="text-red-400 hover:bg-red-900/20"><X className="w-4 h-4"/></Button>
              </div>
            )}
            <div className="flex gap-4">
              <div className="relative shrink-0">
                <input type="file" id="lab-upload" className="hidden" accept="image/*" onChange={handleLabImageUpload} />
                <label htmlFor="lab-upload" className="flex items-center justify-center w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 cursor-pointer hover:bg-slate-700 transition-colors">
                  <ImageIcon className="w-5 h-5 text-slate-300" />
                </label>
              </div>
              <Input 
                value={labInput} 
                onChange={e => setLabInput(e.target.value)} 
                placeholder="Ej: Sam fue muy agresivo en este chat, suaviza su tono..." 
                className="bg-slate-950 border-slate-800 text-slate-50 h-12 rounded-xl focus:border-amber-500" 
                disabled={labProcessing} 
              />
              <Button type="submit" disabled={labProcessing || (!labInput.trim() && !labImage)} className="bg-indigo-900 hover:bg-indigo-800 text-slate-50 h-12 px-6 rounded-xl shadow-lg">
                <Send className="w-5 h-5 text-amber-500" />
              </Button>
            </div>
          </form>
        </Card>
      </div>

      <div className="lg:col-span-4 flex flex-col gap-6">
        <Card className="bg-slate-900 border-slate-800 border-l-4 border-l-amber-600 shadow-xl rounded-2xl overflow-hidden">
          <CardHeader className="bg-slate-950/30 border-b border-slate-800">
             <CardTitle className="text-xs uppercase tracking-widest text-amber-500 flex items-center gap-2">
                <Sparkles className="w-4 h-4"/> Propuesta de Mejora
             </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            {!proposedPrompts ? (
              <div className="py-10 text-center text-slate-600 text-[10px] uppercase tracking-widest font-bold leading-relaxed">
                No hay cambios propuestos.<br/>Habla con el Arquitecto para generar una versión.
              </div>
            ) : (
              <div className="space-y-6 animate-in fade-in zoom-in-95">
                <div className="p-4 bg-amber-900/10 border border-amber-500/20 rounded-xl">
                   <p className="text-[11px] text-amber-200 leading-relaxed italic">
                      "He optimizado los prompts para corregir el comportamiento detectado. Pulsa el botón de abajo para cargar esta configuración en los editores."
                   </p>
                </div>
                <Button onClick={applyProposedPrompts} className="w-full bg-amber-600 hover:bg-amber-500 text-slate-950 h-14 font-bold shadow-lg rounded-xl uppercase tracking-widest text-xs flex flex-col gap-1">
                  <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> CARGAR PROPUESTA</div>
                  <span className="text-[8px] opacity-70">(Sobrescribirá los editores actuales)</span>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="bg-indigo-900/10 border border-indigo-500/20 p-5 rounded-2xl">
           <h4 className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-3 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" /> Seguridad del Kernel
           </h4>
           <p className="text-[11px] text-slate-400 leading-relaxed">
              El Arquitecto tiene acceso a la <strong>Verdad Maestra</strong> y a la <strong>Base de Conocimiento</strong> para asegurar que sus propuestas sean técnicamente correctas.
           </p>
        </div>
      </div>
    </div>
  );
};