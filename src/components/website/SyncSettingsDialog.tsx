import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Clock, Save, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface SyncSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const SyncSettingsDialog = ({ open, onOpenChange }: SyncSettingsDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [syncHour, setSyncHour] = useState("03:00");

  useEffect(() => {
    if (open) fetchConfig();
  }, [open]);

  const fetchConfig = async () => {
    const { data } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', 'main_website_sync_hour')
      .maybeSingle();
    if (data?.value) setSyncHour(data.value);
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('app_config')
        .upsert({ 
          key: 'main_website_sync_hour', 
          value: syncHour,
          category: 'SYSTEM',
          description: 'Hora de sincronización diaria de Verdad Maestra'
        }, { onConflict: 'key' });
      
      if (error) throw error;
      toast.success("Programación actualizada correctamente.");
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-indigo-400" />
            Sincronización Diaria
          </DialogTitle>
          <DialogDescription>
            Define a qué hora Samurai debe refrescar su memoria desde el sitio web.
          </DialogDescription>
        </DialogHeader>
        <div className="py-6 space-y-4">
          <div className="space-y-2">
            <Label>Hora de ejecución (Formato 24h)</Label>
            <Input 
              type="time" 
              value={syncHour} 
              onChange={e => setSyncHour(e.target.value)}
              className="bg-slate-950 border-slate-800 text-center text-xl h-14"
            />
          </div>
          <p className="text-[10px] text-slate-500 italic text-center">
            Se recomienda programar en horas de bajo tráfico (ej: 03:00 AM).
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} className="bg-indigo-600" disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            Aplicar Programación
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};