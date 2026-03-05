import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Database, Lock, Server } from 'lucide-react';

interface PayloadViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: any;
}

export const PayloadViewer = ({ open, onOpenChange, event }: PayloadViewerProps) => {
  if (!event) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-4xl">
        <DialogHeader>
          <DialogTitle className="text-amber-500 uppercase tracking-widest text-sm flex items-center gap-2">
             Inspector de Eventos (CAPI)
          </DialogTitle>
        </DialogHeader>
        
        <Tabs defaultValue="raw" className="mt-4">
           <TabsList className="bg-slate-950 border border-slate-800">
              <TabsTrigger value="raw" className="gap-2 text-xs"><Database className="w-3.5 h-3.5"/> 1. Datos del CRM</TabsTrigger>
              <TabsTrigger value="hashed" className="gap-2 text-xs"><Lock className="w-3.5 h-3.5"/> 2. Payload SHA-256</TabsTrigger>
              <TabsTrigger value="response" className="gap-2 text-xs"><Server className="w-3.5 h-3.5"/> 3. Respuesta Meta</TabsTrigger>
           </TabsList>

           <TabsContent value="raw" className="mt-4">
              <div className="space-y-2">
                 <p className="text-[10px] text-slate-400 uppercase tracking-widest">Información original extraída por la IA antes de encriptarse.</p>
                 <ScrollArea className="h-[400px] bg-[#0D0B0A] rounded-xl p-4 border border-slate-800 shadow-inner">
                   <pre className="text-xs text-indigo-300 font-mono leading-relaxed">{JSON.stringify(event.unhashed_data || { msg: "Datos crudos no disponibles en eventos antiguos" }, null, 2)}</pre>
                 </ScrollArea>
              </div>
           </TabsContent>

           <TabsContent value="hashed" className="mt-4">
              <div className="space-y-2">
                 <p className="text-[10px] text-slate-400 uppercase tracking-widest">Datos normalizados y hasheados (Lo que Meta recibe).</p>
                 <ScrollArea className="h-[400px] bg-[#0D0B0A] rounded-xl p-4 border border-slate-800 shadow-inner">
                   <pre className="text-xs text-amber-500/80 font-mono leading-relaxed">{JSON.stringify(event.payload_sent, null, 2)}</pre>
                 </ScrollArea>
              </div>
           </TabsContent>

           <TabsContent value="response" className="mt-4">
              <div className="space-y-2">
                 <p className="text-[10px] text-slate-400 uppercase tracking-widest">Confirmación del servidor Graph API.</p>
                 <ScrollArea className="h-[400px] bg-[#0D0B0A] rounded-xl p-4 border border-slate-800 shadow-inner">
                   <pre className="text-xs text-emerald-400 font-mono leading-relaxed">{JSON.stringify(event.meta_response, null, 2)}</pre>
                 </ScrollArea>
              </div>
           </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};