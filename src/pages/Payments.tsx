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
  ExternalLink, Calendar, RefreshCw, Eye, Target, Sparkles, User
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
      const { data: media } = await supabase.from('media_assets').select('*').eq('type', 'IMAGE').ilike('ai_instructions', '%OCR DATA%');
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
            <p className="text-slate-400">Radar de conversiones y validación de comprobantes.</p>
          </div>
          <Button variant="outline" className="border-slate-800" onClick={fetchAll}><RefreshCw className="w-4 h-4 mr-2" /> Actualizar Todo</Button>
        </div>

        <Tabs defaultValue="intenciones" className="w-full">
           <TabsList className="bg-slate-900 border border-slate-800 p-1">
              <TabsTrigger value="intenciones" className="gap-2"><Target className="w-4 h-4"/> Radar de Intenciones</TabsTrigger>
              <TabsTrigger value="ocr" className="gap-2"><Eye className="w-4 h-4"/> Ojo de Halcón (Comprobantes)</TabsTrigger>
           </TabsList>

           <TabsContent value="intenciones" className="mt-6 space-y-4">
              <Card className="bg-slate-900 border-slate-800 border-t-4 border-t-indigo-500">
                 <CardHeader>
                    <div className="flex justify-between items-center">
                       <div>
                          <CardTitle className="text-white text-lg">Leads con Link Enviado</CardTitle>
                          <CardDescription>Prospectos que afirmaron su intención de inscribirse y recibieron el link de $1500 MXN.</CardDescription>
                       </div>
                       <Badge className="bg-indigo-600 text-xs">{filteredIntents.length} PENDIENTES</Badge>
                    </div>
                 </CardHeader>
                 <CardContent className="p-0">
                    <Table>
                       <TableHeader>
                          <TableRow className="border-slate-800 bg-slate-950/30">
                             <TableHead className="text-slate-400">Cliente</TableHead>
                             <TableHead className="text-slate-400">Link Enviado</TableHead>
                             <TableHead className="text-slate-400 text-center">Recordatorios</TableHead>
                             <TableHead className="text-right">Acción</TableHead>
                          </TableRow>
                       </TableHeader>
                       <TableBody>
                          {loading ? (
                             <TableRow><TableCell colSpan={4} className="h-32 text-center"><Loader2 className="animate-spin mx-auto text-indigo-500" /></TableCell></TableRow>
                          ) : filteredIntents.length === 0 ? (
                             <TableRow><TableCell colSpan={4} className="h-32 text-center text-slate-500">No hay intenciones de pago activas en este momento.</TableCell></TableRow>
                          ) : filteredIntents.map(lead => (
                             <TableRow key={lead.id} className="border-slate-800 hover:bg-slate-800/20">
                                <TableCell>
                                   <div className="flex items-center gap-2">
                                      <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center"><User className="w-4 h-4 text-slate-400" /></div>
                                      <div>
                                         <p className="text-xs font-bold text-white">{lead.nombre || lead.telefono}</p>
                                         <p className="text-[10px] text-slate-500">{lead.ciudad || 'Sin ciudad'}</p>
                                      </div>
                                   </div>
                                </TableCell>
                                <TableCell className="text-[10px] text-slate-400 font-mono">
                                   {new Date(lead.last_message_at).toLocaleDateString()}
                                </TableCell>
                                <TableCell className="text-center">
                                   <div className="flex justify-center gap-1">
                                      {[1,2,3,4].map(n => (
                                         <div key={n} className={`w-2 h-2 rounded-full ${lead.followup_stage >= n ? 'bg-indigo-500' : 'bg-slate-800'}`} />
                                      ))}
                                   </div>
                                </TableCell>
                                <TableCell className="text-right">
                                   <Button variant="ghost" size="sm" className="text-indigo-400 hover:text-white" onClick={() => window.open(`/leads`, '_self')}>
                                      VER CHAT <ExternalLink className="w-3 h-3 ml-2" />
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
              <Card className="bg-slate-900 border-slate-800"><CardHeader><CardTitle>Validación Visual de Comprobantes</CardTitle></CardHeader>
              <CardContent className="py-20 text-center text-slate-600 italic">Módulo "Ojo de Halcón" en espera de comprobantes recibidos vía chat.</CardContent></Card>
           </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default Payments;