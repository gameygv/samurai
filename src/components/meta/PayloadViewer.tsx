import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

interface PayloadViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payload: any;
  response: any;
}

export const PayloadViewer = ({ open, onOpenChange, payload, response }: PayloadViewerProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-3xl">
        <DialogHeader>
          <DialogTitle>Detalles del Evento</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 max-h-[60vh] pt-4">
          <div>
            <h3 className="text-sm font-bold mb-2 text-indigo-400">Payload Enviado</h3>
            <ScrollArea className="h-full bg-black rounded p-2 border border-slate-800">
              <pre className="text-xs text-slate-300">{JSON.stringify(payload, null, 2)}</pre>
            </ScrollArea>
          </div>
          <div>
            <h3 className="text-sm font-bold mb-2 text-green-400">Respuesta de Meta</h3>
            <ScrollArea className="h-full bg-black rounded p-2 border border-slate-800">
              <pre className="text-xs text-slate-300">{JSON.stringify(response, null, 2)}</pre>
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};