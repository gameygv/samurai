import React, { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  CreditCard, Search, Loader2, CheckCircle2, Clock, 
  ExternalLink, RefreshCw, ZoomIn, ShieldCheck, Target, Mail, MapPin, 
  ShieldAlert, AlertTriangle, ShieldCheck as ShieldIcon, Terminal, Fingerprint, Banknote, DollarSign, UserPlus, ArrowRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';

const Payments = () => {
  const [paymentAssets, setPaymentAssets] = useState<any[]>([]);
  const [intents, setIntents] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedAsset, setSelectedAsset] = useState<any>(null);
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
  const [searchLead, setSearchLead] = useState('');
  const [linking, setLinking] = useState(false);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const { data: media } = await supabase
        .from('media_assets')
        .select('*')
        .eq('category', 'PAYMENT')
        .order('created_at', { ascending: false });

      const { data: highIntents } = await supabase
        .from('leads')
        .select('*')
        .eq('buying_intent', 'ALTO')
        .order('last_message_at', { ascending: false });

      const { data: allLeads } = await supabase
        .from('leads')
        .select('id, nombre, telefono, email')
        .limit(100);
      
      setPaymentAssets(media || []);
      setIntents(highIntents || []);
      setLeads(allLeads || []);
    } finally {
      setLoading(false);
    }
  };

  const handleLinkAndApprove = async (lead: any) => {
     if (!selectedAsset) return;
     setLinking(true);
     const tid = toast.loading(`Vinculando pago a ${lead.nombre}...`);

     try {
        // 1. Marcar Lead como COMPRADO
        await supabase.from('leads').update({
           buying_intent: 'COMPRADO',
           followup_stage: 100,
           summary: `PAGO VALIDADO MANUALMENTE. Ref: ${selectedAsset.title}`
        }).eq('id', lead.id);

        // 2. Registrar Log
        await supabase.from('activity_logs').insert({
           action: 'CREATE',
           resource: 'LEADS',
           description: `Venta CERRADA: ${lead.nombre} (Comprobante: ${selectedAsset.title})`,
           status: 'OK'
        });

        toast.success("Venta vinculada y cerrada exitosamente.", { id: tid });
        setIsLinkDialogOpen(false);
        fetchAll();
     } catch (err: any) {
        toast.error("Error: " + err.message, { id: tid });
     } finally {
        setLinking(false);
     }
  };

  const getTrustScore = (ocr: string) => {
     if (!ocr) return { score: 0, label: 'AUDITORÍA PENDIENTE', color: 'text-slate-500' };
     let score = 50;
     const text = ocr.toUpperCase();
     if (text.includes('EXITOSO') || text.includes('APROBADO') || text.includes('COMPLETADO')) score += 30;
     if (text.includes('BBVA') || text.includes('SPEI') || text.includes('SANTANDER')) score += 10;
     if (text.includes('1500')) score += 10;
     
     if (score > 80) return { score, label: 'ALTA CONFIANZA', color: 'text-emerald-500', icon: ShieldIcon };
     if (score > 50) return { score, label: 'SOSPECHOSO', color: 'text-yellow-500', icon: AlertTriangle };
     return { score, label: 'RIESGO CRÍTICO', color: 'text-red-500', icon: ShieldAlert };
  };

  const filteredLeads = leads.filter(l => 
     l.nombre?.toLowerCase().includes(searchLead.toLowerCase()) || 
     l.telefono?.includes(searchLead)
  );

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-6 pb-12">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <ShieldCheck className="w-8 h-8 text-emerald-500" /> Auditoría Ojo de Halcón
            </h1>
            <p className="text-slate-400">Layer 5: Validación de autenticidad y cierre financiero.</p>
          </div>
          <Button variant="outline" className="border-slate-800 text-slate-400" onClick={fetchAll}><RefreshCw className="w-4 h-4 mr-2" /> Actualizar Radar</Button>
        </div>

        <Tabs defaultValue="ocr" className="w-full">
           <TabsList className="bg-slate-900 border border-slate-800 p-1">
              <TabsTrigger value="ocr" className="gap-2"><ShieldCheck className="w-4 h-4"/> Bóveda de Comprobantes</TabsTrigger>
              <TabsTrigger value="intenciones" className="gap-2"><Target className="w-4 h-4"/> Prospectos Hot (Cierre)</TabsTrigger>
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
                          
                          <Button 
                            onClick={() => { setSelectedAsset(pay); setIsLinkDialogOpen(true); }}
                            className="w-full bg-emerald-600 hover:bg-emerald-700 h-9 text-[10px] font-bold shadow-lg shadow-emerald-900/20"
                          >
                             <UserPlus className="w-3 h-3 mr-2" /> VINCULAR A CLIENTE Y CERRAR
                          </Button>
                       </CardContent>
                    </Card>
                 )})}
              </div>
           </TabsContent>

           <TabsContent value="intenciones" className="mt-6">
              <Card className="bg-slate-900 border-slate-800 border-t-4 border-t-indigo-500 shadow-2xl">
                 <CardHeader>
                    <CardTitle className="text-white text-lg flex items-center gap-2"><Banknote className="w-5 h-5 text-indigo-400" /> Cierre de Ventas</CardTitle>
                    <CardDescription>Clientes con intención ALTA esperando link o cuenta.</CardDescription>
                 </CardHeader>
                 <CardContent className="p-0">
                    <Table>
                       <TableHeader>
                          <TableRow className="border-slate-800 bg-slate-950/30">
                             <TableHead className="text-slate-400 uppercase text-[10px]">Cliente</TableHead>
                             <TableHead className="text-slate-400 uppercase text-[10px]">Estatus</TableHead>
                             <TableHead className="text-right uppercase text-[10px]">Acción</TableHead>
                          </TableRow>
                       </TableHeader>
                       <TableBody>
                          {intents.map(lead => (
                             <TableRow key={lead.id} className="border-slate-800 hover:bg-slate-800/20">
                                <TableCell>
                                   <div className="flex items-center gap-3">
                                      <div className="w-10 h-10 rounded bg-slate-950 flex items-center justify-center text-indigo-400 font-bold border border-slate-800">
                                         {lead.nombre?.substring(0,1) || '?'}
                                      </div>
                                      <div><p className="text-xs font-bold text-white">{lead.nombre || lead.telefono}</p></div>
                                   </div>
                                </TableCell>
                                <TableCell><Badge variant="outline" className="text-[10px] border-indigo-500/30 text-indigo-400">ESPERANDO PAGO</Badge></TableCell>
                                <TableCell className="text-right">
                                   <Button variant="ghost" size="sm" onClick={() => window.location.href=`/leads?id=${lead.id}`}>VER CHAT</Button>
                                </TableCell>
                             </TableRow>
                          ))}
                       </TableBody>
                    </Table>
                 </CardContent>
              </Card>
           </TabsContent>
        </Tabs>

        {/* Dialogo de Vinculación */}
        <Dialog open={isLinkDialogOpen} onOpenChange={setIsLinkDialogOpen}>
           <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-md">
              <DialogHeader>
                 <DialogTitle>Vincular Pago a Cliente</DialogTitle>
                 <DialogDescription>Selecciona el cliente que realizó este depósito.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                 <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-500" />
                    <Input 
                        placeholder="Buscar por nombre o teléfono..." 
                        className="pl-8 bg-slate-950 border-slate-800"
                        value={searchLead}
                        onChange={e => setSearchLead(e.target.value)}
                    />
                 </div>
                 <ScrollArea className="h-60 border border-slate-800 rounded-md bg-slate-950">
                    <div className="p-2 space-y-1">
                       {filteredLeads.map(lead => (
                          <button
                             key={lead.id}
                             onClick={() => handleLinkAndApprove(lead)}
                             disabled={linking}
                             className="w-full text-left p-3 rounded-lg hover:bg-indigo-600/20 border border-transparent hover:border-indigo-500/30 transition-all flex justify-between items-center group"
                          >
                             <div>
                                <p className="text-xs font-bold text-white group-hover:text-indigo-400">{lead.nombre || 'Sin nombre'}</p>
                                <p className="text-[10px] text-slate-500">{lead.telefono}</p>
                             </div>
                             <ArrowRight className="w-4 h-4 text-slate-700 group-hover:text-indigo-500" />
                          </button>
                       ))}
                    </div>
                 </ScrollArea>
              </div>
           </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default Payments;