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
  ExternalLink, Calendar, RefreshCw, Eye, Target, Sparkles, User, ShieldCheck, ZoomIn
} from 'lucide-react';
import { toast } from 'sonner';

const Payments = () => {
  const [payments, setPayments] = useState<any[]>([]);
  const [intents, setIntents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      // Ojo de Halcón: Solo imágenes categorizadas como PAYMENT
      const { data: media } = await supabase.from('media_assets').select('*').eq('category', 'PAYMENT');
      const { data: leads } = await supabase.from('leads').select('*').eq('buying_intent', 'ALTO').order('last_message_at', { ascending: false });
      
      setPayments(media || []);
      setIntents(leads || []);
    } finally {
      setLoading(false);
    }
  };

  const filteredIntents = intents.filter(i => (i.nombre || '').toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-2">
              <CreditCard className="w-8 h-8 text-green-500" /> Pagos & Ventas
            </h1>
            <p className="text-slate-400">Control de conversiones y auditoría visual de comprobantes.</p>
          </div>
          <Button variant="outline" className="border-slate-800" onClick={fetchAll}><RefreshCw className="w-4 h-4 mr-2" /> Actualizar Radar</Button>
        </div>

        <Tabs defaultValue="intenciones" className="w-full">
           <TabsList className="bg-slate-900 border border-slate-800 p-1">
              <TabsTrigger value="intenciones" className="gap-2"><Target className="w-4 h-4"/> Radar de Intenciones</TabsTrigger>
              <TabsTrigger value="ocr" className="gap-2"><ShieldCheck className="w-4 h-4"/> Ojo de Halcón (Auditoría)</TabsTrigger>
           </TabsList>

           <TabsContent value="intenciones" className="mt-6 space-y-4">
              <Card className="bg-slate-900 border-slate-800 border-t-4 border-t-indigo-500">
                 <CardHeader>
                    <div className="flex justify-between items-center">
                       <div>
                          <CardTitle className="text-white text-lg">Prospectos con Link Enviado</CardTitle>
                          <CardDescription>Clientes con alta intención que recibieron el link de reserva de $1500 MXN.</CardDescription>
                       </div>
                       <Badge className="bg-indigo-600 text-xs">{filteredIntents.length} PENDIENTES</Badge>
                    </div>
                 </CardHeader>
                 <CardContent className="p-0">
                    <Table>
                       <TableHeader>
                          <TableRow className="border-slate-800 bg-slate-950/30">
                             <TableHead className="text-slate-400">Cliente</TableHead>
                             <TableHead className="text-slate-400">Último Mensaje</TableHead>
                             <TableHead className="text-slate-400 text-center">Fase Recordatorio</TableHead>
                             <TableHead className="text-right">Acción</TableHead>
                          </TableRow>
                       </TableHeader>
                       <TableBody>
                          {loading ? (
                             <TableRow><TableCell colSpan={4} className="h-32 text-center"><Loader2 className="animate-spin mx-auto text-indigo-500" /></TableCell></TableRow>
                          ) : filteredIntents.length === 0 ? (
                             <TableRow><TableCell colSpan={4} className="h-32 text-center text-slate-500">Sin intenciones de pago activas.</TableCell></TableRow>
                          ) : filteredIntents.map(lead => (
                             <TableRow key={lead.id} className="border-slate-800 hover:bg-slate-800/20">
                                <TableCell>
                                   <div className="flex items-center gap-2">
                                      <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-indigo-400 font-bold">
                                         {lead.nombre?.substring(0,1)}
                                      </div>
                                      <div>
                                         <p className="text-xs font-bold text-white">{lead.nombre || lead.telefono}</p>
                                         <p className="text-[10px] text-slate-500">{lead.ciudad || 'Sin ubicación'}</p>
                                      </div>
                                   </div>
                                </TableCell>
                                <TableCell className="text-[10px] text-slate-400 font-mono">
                                   {lead.last_message_at ? new Date(lead.last_message_at).toLocaleString() : '---'}
                                </TableCell>
                                <TableCell className="text-center">
                                   <div className="flex justify-center gap-1">
                                      {[1,2,3,4].map(n => (
                                         <div key={n} className={`w-2 h-2 rounded-full ${lead.followup_stage >= n ? 'bg-indigo-500 shadow-[0_0_5px_rgba(99,102,241,0.5)]' : 'bg-slate-800'}`} />
                                      ))}
                                   </div>
                                </TableCell>
                                <TableCell className="text-right">
                                   <Button variant="ghost" size="sm" className="text-indigo-400 hover:text-white" onClick={() => window.location.href='/leads'}>
                                      IR AL CHAT <ExternalLink className="w-3 h-3 ml-2" />
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
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                 {payments.length === 0 ? (
                    <Card className="col-span-full bg-slate-900 border-slate-800 py-20 text-center">
                       <CreditCard className="w-12 h-12 text-slate-800 mx-auto mb-4" />
                       <p className="text-slate-600 italic">No hay comprobantes de pago recibidos para auditar.</p>
                    </Card>
                 ) : payments.map(pay => (
                    <Card key={pay.id} className="bg-slate-900 border-slate-800 overflow-hidden group">
                       <div className="aspect-[4/3] bg-black relative">
                          <img src={pay.url} className="w-full h-full object-contain" />
                          <div className="absolute top-2 right-2">
                             <Badge className="bg-orange-600 shadow-lg">AUDITORÍA PENDIENTE</Badge>
                          </div>
                       </div>
                       <CardContent className="p-4 space-y-3">
                          <p className="text-sm font-bold text-white">{pay.title}</p>
                          <div className="bg-black/50 p-3 rounded border border-slate-800">
                             <p className="text-[10px] text-green-500 font-bold uppercase mb-1 flex items-center gap-1"><ZoomIn className="w-3 h-3"/> Datos Ojo de Halcón:</p>
                             <pre className="text-[9px] text-slate-400 font-mono whitespace-pre-wrap">{pay.ocr_content || "Sin datos extraídos..."}</pre>
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