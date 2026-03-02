import React, { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  CreditCard, Search, Loader2, CheckCircle2, Clock, 
  ExternalLink, RefreshCw, ZoomIn, ShieldCheck, Target, Mail, MapPin, 
  ShieldAlert, AlertTriangle, ShieldCheck as ShieldIcon, Terminal, Fingerprint, Banknote
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const Payments = () => {
  const [paymentAssets, setPaymentAssets] = useState<any[]>([]);
  const [intents, setIntents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [validatingId, setValidatingId] = useState<string | null>(null);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
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

  const handleApprovePayment = async (id: string, title: string) => {
     setValidatingId(id);
     try {
        const { error } = await supabase.from('activity_logs').insert({
           action: 'CREATE',
           resource: 'LEADS',
           description: `Pago VALIDADO: ${title}`,
           status: 'OK'
        });
        if (error) throw error;
        toast.success("Pago marcado como legítimo. Samurai notificará al cliente.");
        fetchAll();
     } catch (err: any) {
        toast.error(err.message);
     } finally {
        setValidatingId(null);
     }
  };

  const getTrustScore = (ocr: string) => {
     if (!ocr) return { score: 0, label: 'AUDITORÍA PENDIENTE', color: 'text-slate-500' };
     let score = 50;
     if (ocr.includes('EXITOSO') || ocr.includes('APROBADO')) score += 30;
     if (ocr.includes('BBVA') || ocr.includes('SPEI')) score += 10;
     if (ocr.includes('1500')) score += 10;
     
     if (score > 80) return { score, label: 'ALTA CONFIANZA', color: 'text-emerald-500', icon: ShieldIcon };
     if (score > 50) return { score, label: 'SOSPECHOSO', color: 'text-yellow-500', icon: AlertTriangle };
     return { score, label: 'RIESGO CRÍTICO', color: 'text-red-500', icon: ShieldAlert };
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-6 pb-12">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <ShieldCheck className="w-8 h-8 text-emerald-500" /> Auditoría Ojo de Halcón
            </h1>
            <p className="text-slate-400">Layer 5: Validación de autenticidad en comprobantes bancarios.</p>
          </div>
          <Button variant="outline" className="border-slate-800 text-slate-400" onClick={fetchAll}><RefreshCw className="w-4 h-4 mr-2" /> Actualizar Radar</Button>
        </div>

        <Tabs defaultValue="ocr" className="w-full">
           <TabsList className="bg-slate-900 border border-slate-800 p-1">
              <TabsTrigger value="ocr" className="gap-2"><ShieldCheck className="w-4 h-4"/> Bóveda de Comprobantes</TabsTrigger>
              <TabsTrigger value="intenciones" className="gap-2"><Target className="w-4 h-4"/> Radar de Depósitos</TabsTrigger>
           </TabsList>

           <TabsContent value="ocr" className="mt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                 {loading ? (
                    <div className="col-span-full py-20 text-center"><Loader2 className="animate-spin mx-auto text-indigo-500 w-10 h-10" /></div>
                 ) : paymentAssets.length === 0 ? (
                    <Card className="col-span-full bg-slate-900 border-slate-800 py-20 text-center border-2 border-dashed">
                       <CreditCard className="w-12 h-12 text-slate-800 mx-auto mb-4 opacity-20" />
                       <p className="text-slate-600 italic uppercase text-[10px] tracking-widest">Ojo de Halcón en espera de comprobantes...</p>
                    </Card>
                 ) : paymentAssets.map(pay => {
                    const trust = getTrustScore(pay.ocr_content);
                    const TrustIcon = trust.icon || ShieldCheck;
                    
                    return (
                    <Card key={pay.id} className="bg-slate-900 border-slate-800 overflow-hidden group shadow-2xl relative">
                       <div className="aspect-[3/4] bg-black relative border-b border-slate-800 flex items-center justify-center overflow-hidden">
                          <img src={pay.url} className="w-full h-full object-contain opacity-60 hover:opacity-100 transition-opacity" alt="Comprobante" />
                          <div className="absolute inset-0 pointer-events-none border-[12px] border-slate-900/30"></div>
                       </div>
                       
                       <CardContent className="p-4 space-y-4">
                          <div className="flex justify-between items-center">
                             <div className="flex items-center gap-2">
                                <div className={cn("p-1.5 rounded-lg bg-slate-950 border border-slate-800", trust.color)}>
                                   <TrustIcon className="w-4 h-4" />
                                </div>
                                <span className={cn("text-[10px] font-bold uppercase tracking-widest", trust.color)}>{trust.label}</span>
                             </div>
                             <span className="text-[10px] text-slate-500 font-mono">{new Date(pay.created_at).toLocaleDateString()}</span>
                          </div>

                          <div className="bg-black/50 p-4 rounded-xl border border-slate-800 shadow-inner space-y-3">
                             <p className="text-[9px] text-indigo-400 font-bold uppercase mb-2 flex items-center gap-2">
                                <Terminal className="w-3.5 h-3.5"/> Análisis Forense IA:
                             </p>
                             <div className="text-[10px] text-slate-300 font-mono whitespace-pre-wrap leading-relaxed max-h-40 overflow-y-auto custom-scrollbar">
                                {pay.ocr_content || "Iniciando escaneo de seguridad..."}
                             </div>
                          </div>
                          
                          <div className="flex gap-2">
                             <Button 
                               onClick={() => handleApprovePayment(pay.id, pay.title)} 
                               disabled={validatingId === pay.id}
                               className="flex-1 bg-emerald-600 hover:bg-emerald-700 h-9 text-[10px] font-bold shadow-lg shadow-emerald-900/20"
                             >
                                {validatingId === pay.id ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <ShieldCheck className="w-3 h-3 mr-2" />} 
                                VALIDAR Y REGISTRAR
                             </Button>
                          </div>
                       </CardContent>
                       <CardFooter className="bg-slate-950/40 p-3 border-t border-slate-800">
                           <p className="text-[9px] text-slate-600 truncate flex items-center gap-2"><Fingerprint className="w-3 h-3"/> SOURCE_ID: {pay.id}</p>
                       </CardFooter>
                    </Card>
                 )})}
              </div>
           </TabsContent>

           <TabsContent value="intenciones" className="mt-6">
              <Card className="bg-slate-900 border-slate-800 border-t-4 border-t-indigo-500 shadow-2xl">
                 <CardHeader>
                    <div className="flex justify-between items-center">
                       <div>
                          <CardTitle className="text-white text-lg flex items-center gap-2"><Banknote className="w-5 h-5 text-indigo-400" /> Prospectos Esperando Datos</CardTitle>
                          <CardDescription>Clientes que han solicitado datos para transferencia o depósito.</CardDescription>
                       </div>
                    </div>
                 </CardHeader>
                 <CardContent className="p-0">
                    <Table>
                       <TableHeader>
                          <TableRow className="border-slate-800 bg-slate-950/30">
                             <TableHead className="text-slate-400 uppercase text-[10px]">Cliente</TableHead>
                             <TableHead className="text-slate-400 uppercase text-[10px]">Estatus</TableHead>
                             <TableHead className="text-slate-400 uppercase text-[10px] text-center">Fase Recordatorio</TableHead>
                             <TableHead className="text-right uppercase text-[10px]">Acción</TableHead>
                          </TableRow>
                       </TableHeader>
                       <TableBody>
                          {loading ? (
                             <TableRow><TableCell colSpan={4} className="h-32 text-center"><Loader2 className="animate-spin mx-auto text-indigo-500" /></TableCell></TableRow>
                          ) : intents.map(lead => (
                             <TableRow key={lead.id} className="border-slate-800 hover:bg-slate-800/20">
                                <TableCell>
                                   <div className="flex items-center gap-3">
                                      <div className="w-10 h-10 rounded bg-slate-950 flex items-center justify-center text-indigo-400 font-bold border border-slate-800">
                                         {lead.nombre?.substring(0,1) || '?'}
                                      </div>
                                      <div>
                                         <p className="text-xs font-bold text-white">{lead.nombre || lead.telefono}</p>
                                         <span className="text-[9px] text-slate-500">{lead.ciudad || '---'}</span>
                                      </div>
                                   </div>
                                </TableCell>
                                <TableCell>
                                   <Badge className="bg-indigo-600/10 text-indigo-400 border-indigo-500/20 text-[10px]">ESPERANDO FICHA</Badge>
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
        </Tabs>
      </div>
    </Layout>
  );
};

export default Payments;