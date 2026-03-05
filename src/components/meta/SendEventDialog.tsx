import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Send, Database, DollarSign, Target, UserCheck, Code2 } from 'lucide-react';
import { toast } from 'sonner';

interface SendEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: any;
  onSuccess: () => void;
}

export const SendEventDialog = ({ open, onOpenChange, config, onSuccess }: SendEventDialogProps) => {
  const [sending, setSending] = useState(false);
  const [eventData, setEventData] = useState({
    eventName: 'Lead',
    whatsappId: '5210000000000',
    email: 'test@elephantbowl.com',
    fullName: 'Test User',
    city: 'CDMX',
    value: '0',
    currency: 'MXN',
    customData: '{\n  "source": "manual_test",\n  "intent": "ALTO"\n}'
  });

  const handleSend = async () => {
    if (!config.pixel_id || !config.access_token) {
        toast.error("Configura primero el Pixel ID y el Token.");
        return;
    }

    setSending(true);
    const tid = toast.loading(`Disparando evento '${eventData.eventName}'...`);
    
    try {
      const payload = {
        eventData: {
          event_name: eventData.eventName,
          event_id: `manual_${Date.now()}`,
          user_data: {
            ph: eventData.whatsappId,
            em: eventData.email,
            fn: eventData.fullName,
            ct: eventData.city,
          },
          value: parseFloat(eventData.value) || 0,
          currency: eventData.currency,
          custom_data: JSON.parse(eventData.customData)
        },
        config: {
          pixel_id: config.pixel_id,
          access_token: config.access_token,
          test_event_code: config.test_mode ? config.test_event_code : undefined,
        },
      };

      const { data, error } = await supabase.functions.invoke('meta-capi-sender', {
        body: payload,
      });

      if (error) throw error;
      if (data?.response?.error) throw new Error(data.response.error.message);

      toast.success(`Evento procesado por Meta con éxito.`, { id: tid });
      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(`Fallo en Graph API: ${err.message}`, { id: tid });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-2xl rounded-2xl shadow-2xl">
        <DialogHeader className="border-b border-slate-800 pb-4">
          <DialogTitle className="flex items-center gap-2 text-indigo-400 uppercase tracking-widest text-xs font-bold">
            <Target className="w-5 h-5" /> Simulador de Conversiones CAPI
          </DialogTitle>
          <DialogDescription className="text-[10px] text-slate-400">Este disparo permite auditar la conexión y la normalización de datos sin afectar a un lead real.</DialogDescription>
        </DialogHeader>
        
        <div className="grid grid-cols-2 gap-6 py-6">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase font-bold text-slate-500">Tipo de Evento Standard</Label>
              <Select value={eventData.eventName} onValueChange={v => setEventData({...eventData, eventName: v})}>
                <SelectTrigger className="bg-slate-950 border-slate-800 h-10 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-white">
                  <SelectItem value="Lead">Lead (Prospecto)</SelectItem>
                  <SelectItem value="Purchase">Purchase (Venta)</SelectItem>
                  <SelectItem value="CompleteRegistration">Complete Registration</SelectItem>
                  <SelectItem value="Contact">Contact</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase font-bold text-slate-500">WhatsApp ID</Label>
                    <Input value={eventData.whatsappId} onChange={e => setEventData({...eventData, whatsappId: e.target.value})} className="bg-slate-950 border-slate-800 text-xs rounded-xl" />
                </div>
                <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase font-bold text-slate-500">Ciudad</Label>
                    <Input value={eventData.city} onChange={e => setEventData({...eventData, city: e.target.value})} className="bg-slate-950 border-slate-800 text-xs rounded-xl" />
                </div>
            </div>

            <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-bold text-slate-500">Email de Prueba</Label>
                <Input value={eventData.email} onChange={e => setEventData({...eventData, email: e.target.value})} className="bg-slate-950 border-slate-800 text-xs rounded-xl font-mono" />
            </div>

            {eventData.eventName === 'Purchase' && (
              <div className="grid grid-cols-2 gap-3 animate-in fade-in slide-in-from-left-2">
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase font-bold text-emerald-500">Valor ($)</Label>
                  <div className="relative">
                     <DollarSign className="absolute left-2 top-2.5 h-4 w-4 text-emerald-500" />
                     <Input type="number" value={eventData.value} onChange={e => setEventData({...eventData, value: e.target.value})} className="pl-7 bg-slate-950 border-emerald-500/30 text-xs rounded-xl" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase font-bold text-slate-500">Moneda</Label>
                  <Input value={eventData.currency} onChange={e => setEventData({...eventData, currency: e.target.value})} className="bg-slate-950 border-slate-800 text-xs rounded-xl" />
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] uppercase font-bold text-indigo-400 flex items-center gap-2"><Code2 className="w-3.5 h-3.5"/> Custom Data (Raw JSON)</Label>
            <Textarea 
              value={eventData.customData}
              onChange={e => setEventData({...eventData, customData: e.target.value})}
              className="bg-black border-slate-800 font-mono text-[10px] h-[180px] rounded-xl focus:border-indigo-500 custom-scrollbar"
              placeholder={`{\n  "source": "manual",\n  "test": true\n}`}
            />
          </div>
        </div>

        <DialogFooter className="border-t border-slate-800 pt-4">
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="text-xs rounded-xl">Cancelar</Button>
          <Button onClick={handleSend} disabled={sending} className="bg-indigo-600 hover:bg-indigo-700 h-11 px-8 rounded-xl shadow-lg shadow-indigo-900/40 font-bold uppercase tracking-widest text-[10px]">
            {sending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
            EJECUTAR DISPARO
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};