import React, { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  CreditCard, Search, Loader2, CheckCircle2, Clock, 
  ExternalLink, RefreshCw, ZoomIn, ShieldCheck, Target, Mail, MapPin
} from 'lucide-react';

const Payments = () => {
  const [paymentAssets, setPaymentAssets] = useState<any[]>([]);
  const [intents, setIntents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      // Ojo de Halcón: FILTRO ESTRICTO por category PAYMENT
      const { data: media } = await supabase
        .from('media_assets')
        .select('*')
        .eq('category', 'PAYMENT')
        .order('created_at', { ascending: false });

      const { data: leads } = await supabase
        .from('leads')
        .select('*')
        .eq('buying_intent', 'ALTO')
        .order('last_message_at', { ascending: false });
      
      setPaymentAssets(media || []);
      setIntents(leads || []);
    } finally {
      setLoading(false);
    }
  };

  const filteredIntents = intents.filter(i => (i.nombre || '').toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-6 pb-12">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-2">
              <CreditCard className="w-8 h-8 text-emerald-500" /> Pagos & Ventas
            </h1>
            <p className="text-slate-400">Control de conversiones y auditoría de comprobantes recibidos.</p>
          </div>
          <Button variant="outline" className="border-slate-800 text-slate-400" onClick={fetchAll}><RefreshCw className="w-4 h-4 mr-2" /> Actualizar Radar</Button>
        </div>

        <Tabs defaultValue="intenciones" className="w-full">
           <TabsList className="bg-slate-900 border border-slate-800 p-1">
              <TabsTrigger value="intenciones" className="gap-2"><Target className="w-4 h-4"/> Radar de Intenciones</TabsTrigger>
              <TabsTrigger value="ocr" className="gap-2"><ShieldCheck className="w-4 h-4"/> Ojo de Halcón (Comprobantes)</TabsTrigger>
           </TabsList>

           <TabsContent value="intenciones" className="mt-6 space-y-4">
              <Card className="bg-slate-900 border-slate-800 border-t-4 border-t-indigo-500 shadow-2xl">
                 <CardHeader>
                    <div className="flex justify-between items-center">
                       <div>
                          <CardTitle className="text-white text-lg">Leads en Cierre (Link Enviado)</CardTitle>
                          <CardDescription>Clientes que recibieron el link de reserva de $1500 MXN.</CardDescription>
                       </div>
                       <Badge className="bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 font-bold">{filteredIntents.length} PENDIENTES</Badge>
                    </div>
                 </CardHeader>
                 <CardContent className="p-0">
                    <Table>
                       <TableHeader>
                          <TableRow className="border-slate-800 bg-slate-950/30">
                             <TableHead className="text-slate-400 uppercase text-[10px]">Cliente</TableHead>
                             <TableHead className="text-slate-400 uppercase text-[10px]">Última Actividad</TableHead>
                             <TableHead className="text-slate-400 uppercase text-[10px] text-center">Fase Recordatorio</TableHead>
                             <TableHead className="text-right uppercase text-[10px]">Acción</TableHead>
                          </TableRow>
                       </TableHeader>
                       <TableBody>
                          {loading ? (
                             <TableRow><TableCell colSpan={4} className="h-32 text-center"><Loader2 className="animate-spin mx-auto text-indigo-500" /></TableCell></TableRow>
                          ) : filteredIntents.length === 0 ? (
                             <TableRow><TableCell colSpan={4} className="h-32 text-center text-slate-500 italic">No hay intenciones de pago activas en el embudo.</TableCell></TableRow>
                          ) : filteredIntents.map(lead => (
                             <TableRow key={lead.id} className="border-slate-800 hover:bg-slate-800/20">
                                <TableCell>
                                   <div className="flex items-center gap-3">
                                      <div className="w-10 h-10 rounded bg-slate-950 flex items-center justify-center text-indigo-400 font-bold border border-slate-800">
                                         {lead.nombre?.substring(0,1) || '?'}
                                      </div>
                                      <div>
                                         <p className="text-xs font-bold text-white">{lead.nombre || lead.telefono}</p>
                                         <div className="flex items-center gap-3 mt-0.5">
                                            {lead.email && <span className="text-[9px] text-emerald-500 flex items-center gap-1"><Mail className="w-2.5 h-2.5"/> {lead.email}</span>}
                                            {lead.ciudad && <span className="text-[9px] text-slate-500 flex items-center gap-1"><MapPin className="w-2.5 h-2.5"/> {lead.ciudad}</span>}
                                         </div>
                                      </div>
                                   </div>
                                </TableCell>
                                <TableCell className="text-[10px] text-slate-500 font-mono">
                                   {lead.last_message_at ? new Date(lead.last_message_at).toLocaleString() : '---'}
                                </TableCell>
                                <TableCell className="text-center">
                                   <div className="flex justify-center gap-1">
                                      {[1,2,3,4].map(n => (
                                         <div key={n} className={`w-2 h-2 rounded-full ${lead.followup_stage >= n ? 'bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]' : 'bg-slate-800'}`} />
                                      ))}
                                   </div>
                                </TableCell>
                                <TableCell className="text-right">
                                   <Button variant="ghost" size="sm" className="text-indigo-400 hover:text-white" onClick={() => window.location.href=`/leads?id=${lead.id}`}>
                                      AUDITAR CHAT <ExternalLink className="w-3 h-3 ml-2" />
                                   </Button>
                                </TableCell>
                             </TableRow>
                          ))}
                       </TableBody>
                    </Table>
                 </CardContent>
              </Card>
           </TabsContent>

           <TabsContent value="ocr" className="mt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                 {loading ? (
                    <div className="col-span-full py-20 text-center"><Loader2 className="animate-spin mx-auto text-indigo-500 w-10 h-10" /></div>
                 ) : paymentAssets.length === 0 ? (
                    <Card className="col-span-full bg-slate-900 border-slate-800 py-20 text-center border-2 border-dashed">
                       <CreditCard className="w-12 h-12 text-slate-800 mx-auto mb-4 opacity-20" />
                       <p className="text-slate-600 italic">Ojo de Halcón no ha detectado comprobantes de pago aún.</p>
                    </Card>
                 ) : paymentAssets.map(pay => (
                    <Card key={pay.id} className="bg-slate-900 border-slate-800 overflow-hidden group shadow-xl">
                       <div className="aspect-[4/3] bg-black relative border-b border-slate-800">
                          <img src={pay.url} className="w-full h-full object-contain opacity-80 hover:opacity-100 transition-opacity" alt="Comprobante" />
                          <div className="absolute top-2 right-2">
                             <Badge className="bg-orange-600 shadow-lg border border-orange-500/30">PENDIENTE VALIDACIÓN</Badge>
                          </div>
                       </div>
                       <CardContent className="p-4 space-y-3">
                          <div className="flex justify-between items-start">
                             <p className="text-xs font-bold text-white truncate flex-1">{pay.title}</p>
                             <span className="text-[9px] text-slate-500 font-mono">{new Date(pay.created_at).toLocaleDateString()}</span>
                          </div>
                          <div className="bg-black p-3 rounded-lg border border-slate-800 shadow-inner">
                             <p className="text-[9px] text-indigo-400 font-bold uppercase mb-2 flex items-center gap-1"><ZoomIn className="w-3 h-3"/> Análisis Ojo de Halcón:</p>
                             <div className="text-[10px] text-slate-400 font-mono whitespace-pre-wrap leading-relaxed max-h-32 overflow-y-auto">
                                {pay.ocr_content || "Auditando comprobante... Por favor usa 'Analizar OCR' en el Media Manager si no ves datos aquí."}
                             </div>
                          </div>
                          <div className="flex gap-2">
                             <Button size="sm" className="flex-1 bg-indigo-600 h-8 text-[10px] font-bold"><CheckCircle2 className="w-3 h-3 mr-2" /> MARCAR COMO PAGADO</Button>
                          </div>
                       </CardContent>
                    </Card>
                 ))}
              </div>
           </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default Payments;