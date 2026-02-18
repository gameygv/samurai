import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { BrainCircuit, Send, Phone, User, Bot, Loader2, Save, MapPin, Target } from 'lucide-react';
import { toast } from 'sonner';

interface ChatViewerProps {
  lead: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ChatViewer = ({ lead, open, onOpenChange }: ChatViewerProps) => {
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  
  // Perfilado Local para edición
  const [profile, setProfile] = useState({
    ciudad: lead.ciudad || '',
    preferencias: lead.preferencias || '',
    perfil_psicologico: lead.perfil_psicologico || '',
    buying_intent: lead.buying_intent || 'BAJO'
  });

  useEffect(() => {
    if (open && lead) {
      fetchMessages();
      setProfile({
        ciudad: lead.ciudad || '',
        preferencias: lead.preferencias || '',
        perfil_psicologico: lead.perfil_psicologico || '',
        buying_intent: lead.buying_intent || 'BAJO'
      });
    }
  }, [open, lead]);

  const fetchMessages = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('conversaciones')
      .select('*')
      .eq('lead_id', lead.id)
      .order('created_at', { ascending: true });

    if (!error && data) setMessages(data);
    setLoading(false);
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
      setNewMessage('');
      fetchMessages();
    } catch (error: any) {
      toast.error('Error enviando mensaje');
    } finally {
      setSending(false);
    }
  };

  const saveManualProfile = async () => {
     try {
        const { error } = await supabase
           .from('leads')
           .update(profile)
           .eq('id', lead.id);
        if (error) throw error;
        toast.success('Perfil actualizado manualmente');
     } catch (err: any) {
        toast.error(err.message);
     }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-3xl flex flex-col bg-slate-950 border-l border-slate-800 text-white p-0">
        <SheetHeader className="p-4 border-b border-slate-800 bg-slate-900/50 flex flex-row items-center gap-4 space-y-0">
          <Avatar className="h-10 w-10 border border-slate-700">
             <AvatarFallback className="bg-indigo-600 text-white font-bold">{lead.nombre?.substring(0,2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <SheetTitle className="text-white text-base">{lead.nombre || 'Cliente'}</SheetTitle>
            <div className="text-xs text-slate-500 font-mono flex items-center gap-2">
               <Phone className="w-3 h-3" /> {lead.telefono}
            </div>
          </div>
          <Badge variant={lead.ai_paused ? "destructive" : "outline"} className="h-6">
             {lead.ai_paused ? 'SAMURAI DETENIDO' : 'SAMURAI ACTIVO'}
          </Badge>
        </SheetHeader>

        <div className="flex-1 flex overflow-hidden">
           {/* LADO IZQUIERDO: CHAT */}
           <div className="flex-1 flex flex-col border-r border-slate-800 bg-slate-950/50">
              <ScrollArea className="flex-1 p-4">
                 {loading ? (
                    <div className="flex h-full items-center justify-center text-slate-500 text-xs">Cargando historial...</div>
                 ) : (
                    <div className="space-y-4">
                       {messages.map((msg) => (
                          <div key={msg.id} className={`flex ${msg.emisor === 'CLIENTE' ? 'justify-start' : 'justify-end'}`}>
                             <div className={`max-w-[80%] rounded-2xl p-3 text-sm shadow-sm
                                ${msg.emisor === 'CLIENTE' ? 'bg-slate-800 text-slate-200 rounded-tl-none' : 
                                  msg.emisor === 'SAMURAI' ? 'bg-indigo-600 text-white rounded-tr-none' : 
                                  'bg-slate-700 text-slate-300 rounded-tr-none border border-slate-600'}
                             `}>
                                <div className="text-[9px] opacity-70 mb-1 font-bold flex items-center gap-1 uppercase tracking-wider">
                                   {msg.emisor === 'SAMURAI' ? <Bot className="w-3 h-3" /> : <User className="w-3 h-3" />}
                                   {msg.emisor}
                                </div>
                                <p className="whitespace-pre-wrap leading-relaxed">{msg.mensaje}</p>
                             </div>
                          </div>
                       ))}
                    </div>
                 )}
              </ScrollArea>
              
              <form onSubmit={handleSendMessage} className="p-4 bg-slate-900/50 border-t border-slate-800 flex gap-2">
                 <Input 
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Escribe como un humano..."
                    className="bg-slate-950 border-slate-700 h-10 text-sm"
                    disabled={sending}
                 />
                 <Button type="submit" size="icon" className="bg-indigo-600 hover:bg-indigo-700" disabled={sending}>
                    {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                 </Button>
              </form>
           </div>

           {/* LADO DERECHO: CEREBRO / PERFIL */}
           <div className="w-72 bg-slate-900/30 p-4 space-y-6 overflow-y-auto">
              <div className="space-y-2">
                 <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <BrainCircuit className="w-3 h-3" /> Memoria Viva
                 </h4>
                 <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-4">
                    <div className="space-y-1">
                       <Label className="text-[10px] text-slate-500">CIUDAD DETECTADA</Label>
                       <div className="relative">
                          <MapPin className="absolute left-2 top-2 h-3 w-3 text-slate-600" />
                          <Input 
                             value={profile.ciudad} 
                             onChange={e => setProfile({...profile, ciudad: e.target.value})}
                             className="bg-slate-900 border-slate-800 text-xs h-7 pl-7" 
                             placeholder="¿De dónde es?"
                          />
                       </div>
                    </div>
                    <div className="space-y-1">
                       <Label className="text-[10px] text-slate-500">INTENCIÓN DE COMPRA</Label>
                       <div className="flex gap-1">
                          {['BAJO', 'MEDIO', 'ALTO'].map(v => (
                             <Badge 
                                key={v}
                                variant={profile.buying_intent === v ? "default" : "outline"}
                                className={`text-[9px] cursor-pointer ${profile.buying_intent === v ? 'bg-indigo-600' : 'text-slate-500'}`}
                                onClick={() => setProfile({...profile, buying_intent: v})}
                             >
                                {v}
                             </Badge>
                          ))}
                       </div>
                    </div>
                 </div>
              </div>

              <div className="space-y-2">
                 <Label className="text-[10px] font-bold text-slate-500 uppercase">Preferencias detectadas</Label>
                 <Textarea 
                    value={profile.preferencias}
                    onChange={e => setProfile({...profile, preferencias: e.target.value})}
                    className="bg-slate-950 border-slate-800 text-[11px] h-20 leading-relaxed italic"
                    placeholder="Ej: Busca cuencos tibetanos de 7 metales para meditación profunda."
                 />
              </div>

              <div className="space-y-2">
                 <Label className="text-[10px] font-bold text-slate-500 uppercase">Perfil Psicológico</Label>
                 <Textarea 
                    value={profile.perfil_psicologico}
                    onChange={e => setProfile({...profile, perfil_psicologico: e.target.value})}
                    className="bg-slate-950 border-slate-800 text-[11px] h-24 leading-relaxed font-mono"
                    placeholder="Ej: Cliente racional, pide especificaciones técnicas antes de hablar de precios."
                 />
              </div>

              <Button onClick={saveManualProfile} className="w-full bg-slate-800 hover:bg-slate-700 text-xs h-8 border border-slate-700">
                 <Save className="w-3 h-3 mr-2" /> Guardar Memoria
              </Button>
           </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default ChatViewer;