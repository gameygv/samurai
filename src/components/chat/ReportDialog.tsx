import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ShieldAlert, Loader2 } from 'lucide-react';

interface ReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  errorContext: { ia_response: string; correction: string; reason: string };
  setErrorContext: (val: any) => void;
  onSubmit: () => void;
  reporting: boolean;
}

export const ReportDialog = ({ open, onOpenChange, errorContext, setErrorContext, onSubmit, reporting }: ReportDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-800 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-yellow-500">
            <ShieldAlert className="w-5 h-5" /> Comando #CIA
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Estás por enviar una orden de corrección absoluta. El Samurai registrará esto como una nueva ley.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label className="text-xs text-slate-400">Error detectado (IA)</Label>
            <div className="bg-slate-950 p-3 rounded border border-slate-800 text-xs italic text-slate-500 line-clamp-2">
              {errorContext.ia_response || "..."}
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-green-400">Instrucción #CIA (Sé directivo)</Label>
            <Textarea
              value={errorContext.correction}
              onChange={e => setErrorContext({ ...errorContext, correction: e.target.value })}
              className="bg-slate-950 border-slate-800 font-mono text-xs h-24 focus:border-green-500"
              placeholder="Ej: NUNCA ofrezcas descuento en el primer mensaje. Espera a que el cliente muestre interés real."
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={onSubmit} className="bg-yellow-600 hover:bg-yellow-700 text-white" disabled={reporting}>
            {reporting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Enviar Orden #CIA'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};