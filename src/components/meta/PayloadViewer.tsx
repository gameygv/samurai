import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Database, Lock, Server, CheckCircle2, AlertTriangle, Terminal, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { CAPIMarketingReport } from './CAPIMarketingReport';

interface PayloadViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: any;
}

export const PayloadViewer = ({ open, onOpenChange, event }: PayloadViewerProps) => {
  if (!event) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-950 border-slate-800 text-white max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-2xl shadow-2xl">
        <DialogHeader className="p-6 bg-slate-900 border-b border-slate-800 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={cn("p-2 rounded-xl", event.status === 'OK' ? 'bg-emerald-900/30 text-emerald-400' : 'bg-red-900/30 text-red-400')}>
                {event.status === 'OK' ? <CheckCircle2 className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
              </div>
              <div>
                <DialogTitle className="text-slate-100 uppercase tracking-widest text-xs font-bold">
                  Auditoría: {event.event_name}
                </DialogTitle>
                <DialogDescription className="text-[10px] font-mono mt-1 text-slate-500">
                  ID: {event.event_id} · {new Date(event.created_at).toLocaleString()}
                </DialogDescription>
              </div>
            </div>
            <Badge className={cn("text-[9px] font-bold uppercase", event.status === 'OK' ? 'bg-emerald-600' : 'bg-red-600')}>
              {event.status}
            </Badge>
          </div>
        </DialogHeader>

        <Tabs defaultValue="marketing" className="flex-1 flex flex-col min-h-0">
          <div className="px-6 bg-slate-900/50 border-b border-slate-800 shrink-0">
            <TabsList className="bg-transparent border-0 gap-2 h-12">
              <TabsTrigger value="marketing" className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white gap-2 text-xs rounded-lg px-4">
                <TrendingUp className="w-3.5 h-3.5" /> Informe Marketing
              </TabsTrigger>
              <TabsTrigger value="raw" className="data-[state=active]:bg-slate-700 data-[state=active]:text-white gap-2 text-xs rounded-lg px-4">
                <Database className="w-3.5 h-3.5" /> CRM Data (RAW)
              </TabsTrigger>
              <TabsTrigger value="hashed" className="data-[state=active]:bg-amber-600 data-[state=active]:text-slate-950 gap-2 text-xs rounded-lg px-4">
                <Lock className="w-3.5 h-3.5" /> Payload SHA-256
              </TabsTrigger>
              <TabsTrigger value="response" className="data-[state=active]:bg-slate-700 data-[state=active]:text-white gap-2 text-xs rounded-lg px-4">
                <Server className="w-3.5 h-3.5" /> Server Response
              </TabsTrigger>
            </TabsList>
          </div>

          {/* El contenedor principal de TabsContent debe ser flex-1 y min-h-0 para permitir scroll */}
          <div className="flex-1 overflow-hidden flex flex-col">
            {/* TAB: INFORME MARKETING */}
            <TabsContent value="marketing" className="flex-1 flex flex-col min-h-0 m-0 animate-in fade-in duration-300">
              <ScrollArea className="flex-1 w-full">
                <div className="p-6">
                  <CAPIMarketingReport event={event} />
                </div>
              </ScrollArea>
            </TabsContent>

            {/* TAB: RAW DATA */}
            <TabsContent value="raw" className="flex-1 flex flex-col min-h-0 m-0 p-6 animate-in fade-in duration-300">
              <div className="space-y-4 h-full flex flex-col">
                <div className="flex items-center justify-between text-[10px] text-slate-500 uppercase font-bold tracking-widest shrink-0">
                  <span>Información original extraída del chat</span>
                  <span className="text-indigo-400">Analista CAPI v2.0</span>
                </div>
                <ScrollArea className="flex-1 bg-black rounded-xl p-6 border border-slate-800 shadow-inner">
                  <pre className="text-xs text-indigo-300 font-mono leading-relaxed">
                    {JSON.stringify(event.unhashed_data || { msg: "Datos no capturados" }, null, 2)}
                  </pre>
                </ScrollArea>
                <div className="p-3 bg-indigo-900/10 border border-indigo-500/20 rounded-xl shrink-0">
                  <p className="text-[10px] text-indigo-300 italic">Datos legibles antes del protocolo de privacidad SHA-256.</p>
                </div>
              </div>
            </TabsContent>

            {/* TAB: HASHED PAYLOAD */}
            <TabsContent value="hashed" className="flex-1 flex flex-col min-h-0 m-0 p-6 animate-in fade-in duration-300">
              <div className="space-y-4 h-full flex flex-col">
                <div className="flex items-center justify-between text-[10px] text-slate-500 uppercase font-bold tracking-widest shrink-0">
                  <span>Payload de Producción (Encriptado)</span>
                  <span className="text-amber-500">Security: SHA-256 Active</span>
                </div>
                <ScrollArea className="flex-1 bg-black rounded-xl p-6 border border-slate-800 shadow-inner">
                  <pre className="text-xs text-amber-500/80 font-mono leading-relaxed">
                    {JSON.stringify(event.payload_sent, null, 2)}
                  </pre>
                </ScrollArea>
                <div className="p-3 bg-amber-900/10 border border-amber-500/20 rounded-xl shrink-0">
                  <p className="text-[10px] text-amber-500 italic">PII hasheados con SHA-256 antes de enviarse a la Graph API.</p>
                </div>
              </div>
            </TabsContent>

            {/* TAB: SERVER RESPONSE */}
            <TabsContent value="response" className="flex-1 flex flex-col min-h-0 m-0 p-6 animate-in fade-in duration-300">
              <div className="space-y-4 h-full flex flex-col">
                <div className="flex items-center justify-between text-[10px] text-slate-500 uppercase font-bold tracking-widest shrink-0">
                  <span>Respuesta del Servidor de Meta</span>
                  <span className={cn("font-mono", event.status === 'OK' ? 'text-emerald-500' : 'text-red-500')}>
                    HTTP: {event.status === 'OK' ? '200 OK' : 'ERROR'}
                  </span>
                </div>
                <ScrollArea className="flex-1 bg-black rounded-xl p-6 border border-slate-800 shadow-inner">
                  <div className="flex items-start gap-4 mb-4 border-b border-slate-800 pb-4">
                    <Terminal className="w-5 h-5 text-slate-700 mt-1" />
                    <span className="text-xs font-mono text-slate-500">Trace ID: {event.meta_response?.fbtrace_id || 'N/A'}</span>
                  </div>
                  <pre className={cn("text-xs font-mono leading-relaxed", event.status === 'OK' ? 'text-emerald-400' : 'text-red-400')}>
                    {JSON.stringify(event.meta_response, null, 2)}
                  </pre>
                </ScrollArea>
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};