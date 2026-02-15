import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Loader2, Send, Bot, User, UserCog, ShieldAlert, ZapOff, MessageSquare, BrainCircuit, TrendingUp, AlertCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  
  // Estado local para el análisis (último detectado)
  const [currentAnalysis, setCurrentAnalysis] = useState<any>(null);

  useEffect(() => {
    if (open && lead) {
      fetchMessages();
      subscribeToMessages();
      setIsAiPaused(lead.ai_paused || false);
      
      // Inicializar análisis con datos del lead
      setCurrentAnalysis({
         mood: lead.estado_emocional_actual,
         buying_intent: lead.buying_intent,
         summary: lead.summary
      });
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
       // Buscar el último mensaje de la IA que tenga análisis
       const lastAiMsg = [...data].reverse().find(m => m.emisor === 'SAMURAI' && m.metadata?.analysis);
       if (lastAiMsg) {
          setCurrentAnalysis(lastAiMsg.metadata.analysis);
       }
    }
    setLoading(false);
  };

  const subscribeToMessages = () => {
    const channel = supabase
      .channel(`chat:${lead.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'conversaciones', filter: `lead_id=eq.${lead.id}` }, (payload) => {
        setMessages((prev) => [...prev, payload.new]);
        // Si es mensaje de IA con análisis, actualizar visualización
        if (payload.new.emisor === 'SAMURAI' && payload.new.metadata?.analysis) {
           setCurrentAnalysis(payload.new.metadata.analysis);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  };

  const toggleAiPause = async () => {
    const newState = !isAiPaused;
    setIsAiPaused(newState);
    
    // Actualizar en BD
    await supabase.from('leads').update({ ai_paused: newState }).eq('id', lead.id);

    await logActivity({
      action: newState ? 'UPDATE' : 'CREATE',
      resource: 'SYSTEM',
      description: `${newState ? 'PAUSADO' : 'ACTIVADO'} Samurai para lead: ${lead.nombre}`,
      status: 'OK'
    });

    toast.info(newState ? 'Samurai pausado. Puedes hablar libremente.' : 'Samurai reactivado.');
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
      
      if (!isAiPaused) {
         toggleAiPause(); // Auto-pausar por seguridad
      }

      setNewMessage('');
    } catch (error: any) {
      toast.error('Error enviando mensaje');
    } finally {
      setSending(false);
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
                               <p className="whitespace-pre-wrap leading-relaxed text-xs">{msg.mensaje}</p>
                               <div className="flex justify-end items-center gap-2 mt-1">
                                  <span className="text-[9px] opacity-40">{new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                               </div>
                               
                               {/* Debug Metadata Hover */}
                               {msg.metadata?.analysis && (
                                 <div className="absolute -bottom-6 right-0 opacity-0 group-hover:opacity-100 transition-opacity bg-black/80 text-[9px] p-1 rounded text-green-400 font-mono whitespace-nowrap z-10">
                                    Mood: {msg.metadata.analysis.mood} | Intent: {msg.metadata.analysis.buying_intent}
                                 </div>
                               )}
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
           <div className="w-[280px] bg-slate-900/30 flex flex-col overflow-y-auto">
              <div className="p-4 space-y-6">
                 
                 {/* 1. ANÁLISIS PSICOLÓGICO */}
                 <div>
                    <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                       <BrainCircuit className="w-3 h-3" /> Perfil Psicológico
                    </h4>
                    <Card className="bg-slate-950 border-slate-800 shadow-none">
                       <CardContent className="p-3 space-y-3">
                          <div className="space-y-1">
                             <span className="text-[10px] text-slate-400 block">Estado Emocional</span>
                             <Badge variant="outline" className={`w-full justify-center py-1 ${getMoodColor(currentAnalysis?.mood)}`}>
                                {currentAnalysis?.mood || 'NEUTRO'}
                             </Badge>
                          </div>
                          
                          <div className="space-y-1">
                             <div className="flex justify-between text-[10px] text-slate-400">
                                <span>Intención Compra</span>
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
                          </div>
                       </CardContent>
                    </Card>
                 </div>

                 {/* 2. RESUMEN EJECUTIVO */}
                 <div>
                    <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                       <Bot className="w-3 h-3" /> Último Análisis
                    </h4>
                    <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
                       <p className="text-xs text-slate-300 italic leading-relaxed">
                          "{currentAnalysis?.summary || 'Esperando análisis suficiente para generar resumen...'}"
                       </p>
                    </div>
                 </div>

                 {/* 3. ACCIONES SUGERIDAS */}
                 <div>
                    <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                       <TrendingUp className="w-3 h-3" /> Próximos Pasos
                    </h4>
                    <div className="space-y-2">
                       <Button variant="outline" size="sm" className="w-full justify-start text-[10px] h-8 border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-300">
                          <AlertCircle className="w-3 h-3 mr-2 text-yellow-500" /> Reportar Error (#CORREGIRIA)
                       </Button>
                       <Button variant="outline" size="sm" className="w-full justify-start text-[10px] h-8 border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-300">
                          <MessageSquare className="w-3 h-3 mr-2 text-indigo-500" /> Enviar Catálogo PDF
                       </Button>
                    </div>
                 </div>

              </div>
           </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default ChatViewer;