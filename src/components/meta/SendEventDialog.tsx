import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Send, FileJson } from 'lucide-react';
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
    whatsappId: '',
    value: '',
    currency: 'MXN',
    customData: '{}'
  });

  const handleSend = async () => {
    setSending(true);
    try {
      const payload = {
        eventData: {
          event_name: eventData.eventName,
          event_id: `${eventData.whatsappId}_${Date.now()}`,
          user_data: {
            ph: eventData.whatsappId,
          },
          custom_data: JSON.parse(eventData.customData),
          ...(eventData.eventName === 'Purchase' && {
            value: parseFloat(eventData.value),
            currency: eventData.currency,
          }),
        },
        config: {
          pixel_id: config.pixel_id,
          access_token: config.access_token,
          test_event_code: config.test_mode ? config.test_event_code : undefined,
        },
      };

      const { error } = await supabase.functions.invoke('meta-capi-sender', {
        body: payload,
      });

      if (error) throw error;

      toast.success(`Evento '${eventData.eventName}' enviado a Meta.`);
      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(`Error al enviar evento: ${err.message}`);
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-2xl">
        <DialogHeader>
          <DialogTitle>Enviar Evento Manual</DialogTitle>
          <DialogDescription>Simula un evento de conversión para pruebas o registros manuales.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-6 py-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo de Evento</Label>
              <Select value={eventData.eventName} onValueChange={v => setEventData({...eventData, eventName: v})}>
                <SelectTrigger className="bg-slate-950 border-slate-800"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-white">
                  <SelectItem value="Lead">Lead</SelectItem>
                  <SelectItem value="Purchase">Purchase</SelectItem>
                  <SelectItem value="CompleteRegistration">CompleteRegistration</SelectItem>
                  <SelectItem value="Contact">Contact</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>WhatsApp ID (Ej: 521234567890)</Label>
              <Input value={eventData.whatsappId} onChange={e => setEventData({...eventData, whatsappId: e.target.value})} className="bg-slate-950 border-slate-800" />
            </div>
            {eventData.eventName === 'Purchase' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Valor</Label>
                  <Input type="number" value={eventData.value} onChange={e => setEventData({...eventData, value: e.target.value})} className="bg-slate-950 border-slate-800" />
                </div>
                <div className="space-y-2">
                  <Label>Moneda</Label>
                  <Input value={eventData.currency} onChange={e => setEventData({...eventData, currency: e.target.value})} className="bg-slate-950 border-slate-800" />
                </div>
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label>Custom Data (JSON)</Label>
            <Textarea 
              value={eventData.customData}
              onChange={e => setEventData({...eventData, customData: e.target.value})}
              className="bg-slate-950 border-slate-800 font-mono text-xs h-full"
              placeholder={`{\n  "intention": "ALTO",\n  "psych_profile": "Directo y decidido"\n}`}
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSend} disabled={sending} className="bg-indigo-600">
            {sending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
            Enviar a Meta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};