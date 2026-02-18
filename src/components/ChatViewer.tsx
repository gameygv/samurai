import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Loader2, Send, Bot, User, UserCog, ShieldAlert, ZapOff, MessageSquare, BrainCircuit, TrendingUp, AlertCircle, Image as ImageIcon, ExternalLink, X, Save, Edit2, RotateCcw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { logActivity } from '@/utils/logger';

interface ChatViewerProps {
  lead: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ChatViewer = ({ lead, open, onOpenChange }: ChatViewerProps) => {
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [isAiPaused, setIsAiPaused] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // Memory State
  const [currentAnalysis, setCurrentAnalysis] = useState<any>(null);
  const [isEditingMemory, setIsEditingMemory] = useState(false);
  const [memoryForm, setMemoryForm] = useState({ mood: '', buying_intent: '', summary: '' });
  const [savingMemory, setSavingMemory] = useState(false);

  // Error Reporting State
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [errorContext, setErrorContext] = useState({ ia_response: '', correction: '', reason: '' });
  const [reporting, setReporting] = useState(false);

  useEffect(() => {
    if (open && lead) {
      fetchMessages();
      subscribeToMessages();
      setIsAiPaused(lead.ai_paused || false);
      
      // Load initial memory from lead prop, but we will refresh it from DB ideally
      const initialMemory = {
         mood: lead.estado_emocional_actual || 'NEUTRO',
         buying_intent: lead.buying_intent || 'BAJO',
         summary: lead.summary || ''
      };
      setCurrentAnalysis(initialMemory);
      setMemoryForm(initialMemory);
    }
  }, [open, lead]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const fetchMessages = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('conversaciones')
      .select('*')
      .eq('lead_id', lead.id)
      .order('created_at', { ascending: true });

    if (!error && data) {
       setMessages(data);
       // Refresh memory from actual DB lead row to be sure
       const { data: freshLead } = await supabase.from('leads').select('*').eq('id', lead.id).single();
       if (freshLead) {
          const freshMemory = {
             mood: freshLead.estado_emocional_actual || 'NEUTRO',
             buying_intent: freshLead.buying_intent || 'BAJO',
             summary: freshLead.summary || ''
          };
          setCurrentAnalysis(freshMemory);
          setMemoryForm(freshMemory);
       }
    }
    setLoading(false);
  };

  const subscribeToMessages = () => {
    const channel = supabase
      .channel(`chat:${lead.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'conversaciones', filter: `lead_id=eq.${lead.id}` }, (payload) => {
        setMessages((prev) => [...prev, payload.new]);
        // If AI replies with new analysis, update view (unless user is editing)
        if (payload.new.emisor === 'SAMURAI' && payload.new.metadata?.analysis && !isEditingMemory) {
           setCurrentAnalysis(payload.new.metadata.analysis);
           setMemoryForm(prev => ({ ...prev, ...payload.new.metadata.analysis }));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  };

  const toggleAiPause = async () => {
    const newState = !isAiPaused;
    setIsAiPaused(newState);
    await supabase.from('leads').update({ ai_paused: newState }).eq('id', lead.id);
    await logActivity({
      action: newState ? 'UPDATE' : 'CREATE',
      resource: 'SYSTEM',
      description: `${newState ? 'PAUSADO' : 'ACTIVADO'} Samurai para lead: ${lead.nombre}`,
      status: 'OK'
    });
    toast.info(newState ? 'Samurai pausado.' : 'Samurai reactivado.');
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    setSending(true);
    try {
      const { error } = await supabase.from('conversaciones').insert({
        lead_id: lead.id,
        mensaje: newMessage,
        emisor: 'HUMANO',
        platform: 'PANEL'
      });

      if (error) throw error;
      if (!isAiPaused) toggleAiPause();
      setNewMessage('');
    } catch (error: any) {
      toast.error('Error enviando mensaje');
    } finally {
      setSending(false);
    }
  };

  const handleSaveMemory = async () => {
     setSavingMemory(true);
     try {
        const { error } = await supabase
           .from('leads')
           .update({
              estado_emocional_actual: memoryForm.mood,
              buying_intent: memoryForm.buying_intent,
              summary: memoryForm.summary,
              last_ai_analysis: new Date().toISOString()
           })
           .eq('id', lead.id);

        if (error) throw error;

        setCurrentAnalysis(memoryForm);
        setIsEditingMemory(false);
        toast.success("Memoria del Samurai actualizada manualmente.");
        
        await logActivity({
           action: 'UPDATE',
           resource: 'BRAIN',
           description: `Intervención humana en memoria de lead: ${lead.nombre}`,
           status: 'OK'
        });
     } catch (err: any) {
        toast.error(err.message);
     } finally {
        setSavingMemory(false);
     }
  };

  const openReportDialog = () => {
     // Find last AI message to pre-fill
     const lastAi = [...messages].reverse().find(m => m.emisor === 'SAMURAI');
     setErrorContext({
        ia_response: lastAi ? lastAi.mensaje : '',
        correction: '',
        reason: ''
     });
     setIsReportOpen(true);
  };

  const submitError = async () => {
     if (!errorContext.correction) return toast.error("Debes sugerir una corrección.");
     setReporting(true);
     try {
        const { error } = await supabase.from('errores_ia').insert({
           cliente_id: lead.id,
           mensaje_cliente: "Reporte Manual desde Chat",
           respuesta_ia: errorContext.ia_response,
           correccion_sugerida: errorContext.correction,
           correccion_explicacion: errorContext.reason,
           categoria: 'CONDUCTA',
           severidad: 'MEDIA',
           estado_correccion: 'REPORTADA'
        });

        if (error) throw error;
        toast.success("Error reportado al núcleo de aprendizaje.");
        setIsReportOpen(false);
     } catch (err: any) {
        toast.error(err.message);
     } finally {
        setReporting(false);
     }
  };

  const getMoodColor = (mood: string) => {
     const m = mood?.toUpperCase() || 'NEUTRO';
     if (m.includes('ENOJADO') || m.includes('MOLESTO')) return 'text-red-500 border-red-500/50 bg-red-500/10';
     if (m.includes('FELIZ') || m.includes('CONTENTO')) return 'text-green-500 border-green-500/50 bg-green-500/10';
     if (m.includes('PRAGMATICO') || m.includes('TECNICO')) return 'text-blue-500 border-blue-500/50 bg-blue-500/10';
     return 'text-slate-400 border-slate-700 bg-slate-800';
  };

  const getIntentColor = (intent: string) => {
     const i = intent?.toUpperCase() || 'BAJO';
     if (i === 'ALTO') return 'bg-green-600';
     if (i === 'MEDIO') return 'bg-yellow-500';
     return 'bg-slate-600';
  };

  const isImage = (msg: any) => {
     if (msg.metadata?.type === 'image') return true;
     return msg.mensaje.match(/\.(jpeg|jpg|gif|png|webp)$/i) != null;
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl flex flex-col bg-slate-950 border-l border-slate-800 text-white p-0 shadow-2xl sm:border-l">
        
        {/* HEADER */}
        <SheetHeader className="p-4 border-b border-slate-800 bg-slate-900/50 flex flex-row items-center justify-between gap-4 space-y-0">
          <div className="flex items-center gap-3">
             <Avatar className="h-10 w-10 border border-slate-700">
                <AvatarFallback className="bg-indigo-600 text-white font-bold">{lead?.nombre?.substring(0, 2).toUpperCase() || 'CL'}</AvatarFallback>
             </Avatar>
             <div>
                <div className="text-sm font-bold truncate max-w-[200px] flex items-center gap-2">
                   {lead?.nombre || 'Cliente'}
                   <Badge variant="outline" className="text-[9px] border-slate-700 text-slate-500 h-4 px-1">{lead?.platform || 'WhatsApp'}</Badge>
                </div>
                <div className="text-[10px] text-slate-500 font-mono">{lead?.telefono}</div>
             </div>
          </div>
          
          <Button 
             variant={isAiPaused ? "destructive" : "outline"} 
             size="sm" 
             onClick={toggleAiPause}
             className="h-8 text-[10px] px-3 font-bold tracking-wider"
          >
             {isAiPaused ? <ZapOff className="w-3 h-3 mr-1" /> : <Bot className="w-3 h-3 mr-1" />}
             {isAiPaused ? 'IA PAUSADA' : 'AI ACTIVA'}
          </Button>
        </SheetHeader>

        <div className="flex-1 flex overflow-hidden">
           {/* ZONA DE CHAT (IZQUIERDA) */}
           <div className="flex-1 flex flex-col border-r border-slate-800 bg-slate-950/50">
              <ScrollArea className="flex-1 p-4">
                {loading ? (
                   <div className="flex h-full items-center justify-center text-slate-500 text-xs"><Loader2 className="w-4 h-4 animate-spin mr-2" /> Cargando historial...</div>
                ) : (
                   <div className="space-y-4 pb-4">
                      {messages.map((msg) => (
                         <div key={msg.id} className={`flex ${msg.emisor === 'CLIENTE' ? 'justify-start' : 'justify-end'}`}>
                            <div className={`max-w-[85%] rounded-2xl p-3 text-sm shadow-sm relative group
                               ${msg.emisor === 'CLIENTE' ? 'bg-slate-800 text-slate-200 rounded-tl-none' : 
                                 msg.emisor === 'SAMURAI' ? 'bg-indigo-600 text-white rounded-tr-none' : 
                                 'bg-slate-700 text-slate-300 rounded-tr-none border border-slate-600'}
                            `}>
                               {msg.emisor !== 'CLIENTE' && (
                                  <div className="text-[9px] opacity-70 mb-1 font-bold flex items-center gap-1 uppercase tracking-wider">
                                     {msg.emisor === 'SAMURAI' ? <Bot className="w-3 h-3" /> : <UserCog className="w-3 h-3" />}
                                     {msg.emisor}
                                  </div>
                               )}

                               {isImage(msg) ? (
                                  <div className="mt-1 mb-1">
                                     <div className="rounded-lg overflow-hidden border border-white/10 relative group/img cursor-pointer" onClick={() => window.open(msg.mensaje, '_blank')}>
                                        <img src={msg.mensaje} alt="Media sent" className="max-w-[200px] max-h-[200px] object-cover" />
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 flex items-center justify-center transition-opacity">
                                           <ExternalLink className="w-4 h-4 text-white" />
                                        </div>
                                     </div>
                                  </div>
                               ) : (
                                  <p className="whitespace-pre-wrap leading-relaxed text-xs">{msg.mensaje}</p>
                               )}

                               <div className="flex justify-end items-center gap-2 mt-1">
                                  <span className="text-[9px] opacity-40">{new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                               </div>
                            </div>
                         </div>
                      ))}
                      <div ref={scrollRef} />
                   </div>
                )}
              </ScrollArea>

              {/* INPUT AREA */}
              <div className="p-3 bg-slate-900 border-t border-slate-800">
                 <form onSubmit={handleSendMessage} className="flex gap-2">
                    <Input 
                       value={newMessage}
                       onChange={(e) => setNewMessage(e.target.value)}
                       className="bg-slate-950 border-slate-700 text-sm h-10 focus-visible:ring-indigo-500"
                       placeholder="Escribe un mensaje..."
                       disabled={sending}
                    />
                    <Button type="submit" size="icon" className="bg-indigo-600 hover:bg-indigo-700 shrink-0" disabled={sending || !newMessage.trim()}>
                       {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </Button>
                 </form>
                 {isAiPaused && (
                    <div className="mt-2 text-[10px] text-red-400 flex items-center justify-center gap-1 opacity-80">
                       <ShieldAlert className="w-3 h-3" /> Modo manual activado
                    </div>
                 )}
              </div>
           </div>

           {/* ZONA DE INTELIGENCIA (DERECHA) */}
           <div className="w-[280px] bg-slate-900/30 flex flex-col overflow-y-auto border-l border-slate-800">
              <div className="p-4 space-y-6">
                 
                 {/* HEADER CON BOTÓN EDITAR */}
                 <div className="flex items-center justify-between">
                    <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                       <BrainCircuit className="w-3 h-3" /> Memoria Viva
                    </h4>
                    {!isEditingMemory ? (
                       <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-500 hover:text-white" onClick={() => setIsEditingMemory(true)}>
                          <Edit2 className="w-3 h-3" />
                       </Button>
                    ) : (
                       <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-red-400 hover:text-red-300" onClick={() => setIsEditingMemory(false)}>
                             <X className="w-3 h-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-green-400 hover:text-green-300" onClick={handleSaveMemory} disabled={savingMemory}>
                             {savingMemory ? <Loader2 className="w-3 h-3 animate-spin"/> : <Save className="w-3 h-3" />}
                          </Button>
                       </div>
                    )}
                 </div>

                 {/* 1. ANÁLISIS PSICOLÓGICO */}
                 <Card className="bg-slate-950 border-slate-800 shadow-none">
                    <CardContent className="p-3 space-y-4">
                       <div className="space-y-1">
                          <Label className="text-[10px] text-slate-400 block uppercase tracking-wide">Estado Emocional</Label>
                          {isEditingMemory ? (
                             <Select value={memoryForm.mood} onValueChange={v => setMemoryForm({...memoryForm, mood: v})}>
                                <SelectTrigger className="h-7 text-xs bg-slate-900 border-slate-700"><SelectValue /></SelectTrigger>
                                <SelectContent className="bg-slate-900 border-slate-700 text-white">
                                   <SelectItem value="NEUTRO">Neutro</SelectItem>
                                   <SelectItem value="FELIZ">Feliz / Satisfecho</SelectItem>
                                   <SelectItem value="ENOJADO">Enojado / Molesto</SelectItem>
                                   <SelectItem value="PRAGMATICO">Pragmático / Técnico</SelectItem>
                                   <SelectItem value="CONFUNDIDO">Confundido</SelectItem>
                                </SelectContent>
                             </Select>
                          ) : (
                             <Badge variant="outline" className={`w-full justify-center py-1 ${getMoodColor(currentAnalysis?.mood)}`}>
                                {currentAnalysis?.mood || 'NEUTRO'}
                             </Badge>
                          )}
                       </div>
                       
                       <div className="space-y-1">
                          <div className="flex justify-between text-[10px] text-slate-400 uppercase tracking-wide">
                             <Label>Intención Compra</Label>
                          </div>
                          {isEditingMemory ? (
                             <Select value={memoryForm.buying_intent} onValueChange={v => setMemoryForm({...memoryForm, buying_intent: v})}>
                                <SelectTrigger className="h-7 text-xs bg-slate-900 border-slate-700"><SelectValue /></SelectTrigger>
                                <SelectContent className="bg-slate-900 border-slate-700 text-white">
                                   <SelectItem value="ALTO">Alta</SelectItem>
                                   <SelectItem value="MEDIO">Media</SelectItem>
                                   <SelectItem value="BAJO">Baja</SelectItem>
                                </SelectContent>
                             </Select>
                          ) : (
                             <>
                                <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                                   <span>Probabilidad</span>
                                   <span className={currentAnalysis?.buying_intent === 'ALTO' ? 'text-green-500 font-bold' : ''}>
                                      {currentAnalysis?.buying_intent || 'BAJA'}
                                   </span>
                                </div>
                                <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                                   <div 
                                      className={`h-full rounded-full transition-all duration-500 ${getIntentColor(currentAnalysis?.buying_intent)}`} 
                                      style={{ width: currentAnalysis?.buying_intent === 'ALTO' ? '90%' : currentAnalysis?.buying_intent === 'MEDIO' ? '50%' : '20%' }}
                                   />
                                </div>
                             </>
                          )}
                       </div>
                    </CardContent>
                 </Card>

                 {/* 2. RESUMEN EJECUTIVO */}
                 <div>
                    <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                       <Bot className="w-3 h-3" /> Resumen Contextual
                    </h4>
                    {isEditingMemory ? (
                       <Textarea 
                          value={memoryForm.summary}
                          onChange={e => setMemoryForm({...memoryForm, summary: e.target.value})}
                          className="bg-slate-950 border-slate-700 text-xs min-h-[150px] leading-relaxed font-mono"
                          placeholder="Escribe lo que la IA debe recordar..."
                       />
                    ) : (
                       <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 relative group">
                          <p className="text-xs text-slate-300 italic leading-relaxed">
                             "{currentAnalysis?.summary || 'Esperando análisis suficiente para generar resumen...'}"
                          </p>
                       </div>
                    )}
                 </div>

                 {/* 3. ACCIONES SUGERIDAS */}
                 {!isEditingMemory && (
                    <div className="pt-4 border-t border-slate-800/50">
                       <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                          <TrendingUp className="w-3 h-3" /> Acciones Rápidas
                       </h4>
                       <div className="space-y-2">
                          <Button 
                             variant="outline" 
                             size="sm" 
                             className="w-full justify-start text-[10px] h-8 border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white"
                             onClick={openReportDialog}
                          >
                             <AlertCircle className="w-3 h-3 mr-2 text-yellow-500" /> Reportar Error (#CORREGIRIA)
                          </Button>
                          <Button 
                             variant="outline" 
                             size="sm" 
                             className="w-full justify-start text-[10px] h-8 border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white"
                             onClick={() => setMemoryForm({...currentAnalysis, mood: 'NEUTRO', buying_intent: 'MEDIO', summary: ''}) || setIsEditingMemory(true)}
                          >
                             <RotateCcw className="w-3 h-3 mr-2 text-blue-500" /> Resetear Memoria
                          </Button>
                       </div>
                    </div>
                 )}
              </div>
           </div>
        </div>

        {/* DIALOGO DE REPORTE DE ERROR */}
        <Dialog open={isReportOpen} onOpenChange={setIsReportOpen}>
           <DialogContent className="bg-slate-900 border-slate-800 text-white">
              <DialogHeader>
                 <DialogTitle>Reportar Error de Conducta</DialogTitle>
                 <DialogDescription className="text-slate-400">
                    Ayuda al Samurai a mejorar. Describe qué hizo mal y qué debería haber hecho.
                 </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                 <div className="space-y-2">
                    <Label className="text-xs text-red-400">Respuesta Incorrecta (IA)</Label>
                    <div className="bg-slate-950 p-3 rounded border border-slate-800 text-xs italic text-slate-300">
                       {errorContext.ia_response || "No se detectó respuesta previa."}
                    </div>
                 </div>
                 <div className="space-y-2">
                    <Label className="text-xs text-green-400">Corrección Sugerida (Lo que debió decir)</Label>
                    <Textarea 
                       value={errorContext.correction}
                       onChange={e => setErrorContext({...errorContext, correction: e.target.value})}
                       className="bg-slate-950 border-slate-800 font-mono text-xs h-20"
                       placeholder="Ej: Debió saludar primero y luego dar el precio..."
                    />
                 </div>
                 <div className="space-y-2">
                    <Label className="text-xs text-slate-400">¿Por qué?</Label>
                    <Input 
                       value={errorContext.reason}
                       onChange={e => setErrorContext({...errorContext, reason: e.target.value})}
                       className="bg-slate-950 border-slate-800 text-xs"
                       placeholder="Ej: Fue muy agresivo / Olvidó el protocolo..."
                    />
                 </div>
              </div>
              <DialogFooter>
                 <Button variant="ghost" onClick={() => setIsReportOpen(false)}>Cancelar</Button>
                 <Button onClick={submitError} className="bg-yellow-600 hover:bg-yellow-700 text-white" disabled={reporting}>
                    {reporting ? <Loader2 className="w-4 h-4 animate-spin"/> : 'Enviar Reporte'}
                 </Button>
              </DialogFooter>
           </DialogContent>
        </Dialog>

      </SheetContent>
    </Sheet>
  );
};

export default ChatViewer;