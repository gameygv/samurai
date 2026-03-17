import React, { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  CreditCard, Search, Loader2, CheckCircle2, Clock, 
  ExternalLink, RefreshCw, ShieldCheck, Target, Mail, MapPin, 
  ShieldAlert, AlertTriangle, Terminal, Banknote, DollarSign, UserPlus, ArrowRight, CalendarDays, Wallet
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/context/AuthContext';

const Payments = () => {
  const { isManager } = useAuth();
  const [activeTab, setActiveTab] = useState(isManager ? 'cobranza' : 'ocr');

  const [paymentAssets, setPaymentAssets] = useState<any[]>([]);
  const [intents, setIntents] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [installments, setInstallments] = useState<any[]>([]);
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
        .select('id, nombre, telefono, email, ciudad, estado, cp, pais, apellido')
        .limit(100);
        
      if (isManager) {
        const { data: instData } = await supabase
          .from('credit_installments')
          .select(`
             *,
             sale:credit_sales(*, contact:contacts(nombre, apellido, telefono, lead_id))
          `)
          .in('status', ['PENDING', 'LATE'])
          .order('due_date', { ascending: true });
        setInstallments(instData || []);
      }
      
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
        await supabase.from('leads').update({
           buying_intent: 'COMPRADO',
           payment_status: 'VALID',
           followup_stage: 100,
           summary: `PAGO VALIDADO MANUALMENTE. Ref: ${selectedAsset.title}`
        }).eq('id', lead.id);

        await supabase.from('activity_logs').insert({
           action: 'CREATE', resource: 'LEADS',
           description: `Venta CERRADA: ${lead.nombre} (Comprobante: ${selectedAsset.title})`, status: 'OK'
        });

        const { data: configs } = await supabase.from('app_config').select('key, value').in('key', ['meta_pixel_id', 'meta_access_token', 'meta_test_mode', 'meta_test_event_code']);
        if (configs && configs.length > 0) {
           const configObj = configs.reduce((acc, c) => ({...acc, [c.key]: c.value}), {} as Record<string, string>);
           if (configObj.meta_pixel_id && configObj.meta_access_token) {
              const eventData = {
                  event_name: 'Purchase', lead_id: lead.id, value: 1500, currency: 'MXN',
                  user_data: {
                      em: lead.email, ph: lead.telefono, fn: lead.nombre, ln: lead.apellido,
                      ct: lead.ciudad, st: lead.estado, zp: lead.cp, country: lead.pais || 'mx', external_id: lead.id
                  },
                  custom_data: { source: 'payment_validation_panel' }
              };
              await supabase.functions.invoke('meta-capi-sender', {
                  body: { eventData, config: { pixel_id: configObj.meta_pixel_id, access_token: configObj.meta_access_token, test_mode: configObj.meta_test_mode === 'true', test_event_code: configObj.meta_test_event_code } }
              });
           }
        }

        toast.success("Venta vinculada y cerrada exitosamente.", { id: tid });
        setIsLinkDialogOpen(false);
        fetchAll();
     } catch (err: any) {
        toast.error("Error: " + err.message, { id: tid });
     } finally {
        setLinking(false);
     }
  };

  const handleMarkInstallmentPaid = async (installmentId: string, amount: string, clientName: string) => {
      if (!confirm(`¿Confirmas que el cliente ${clientName} ha pagado la cantidad de $${amount}?`)) return;
      const tid = toast.loading("Registrando pago...");
      try {
          const { error } = await supabase.from('credit_installments').update({
              status: 'PAID',
              paid_at: new Date().toISOString()
          }).eq('id', installmentId);
          
          if (error) throw error;
          
          await supabase.from('activity_logs').insert({
              action: 'UPDATE', resource: 'SYSTEM',
              description: `Cobranza exitosa: $${amount} abonados por ${clientName}`, status: 'OK'
          });

          toast.success("Pago registrado correctamente.", { id: tid });
          fetchAll();
      } catch (err: any) {
          toast.error("Error al registrar pago: " + err.message, { id: tid });
      }
  };

  const getTrustScore = (ocr: string) => {
     if (!ocr) return { score: 0, label: 'AUDITORÍA PENDIENTE', color: 'text-slate-500' };
     let score = 50;
     const text = ocr.toUpperCase();
     if (text.includes('EXITOSO') || text.includes('APROBADO') || text.includes('COMPLETADO')) score += 30;
     if (text.includes('BBVA') || text.includes('SPEI') || text.includes('SANTANDER')) score += 10;
     if (text.includes('1500')) score += 10;
     
     if (score > 80) return { score, label: 'ALTA CONFIANZA', color: 'text-emerald-500', icon: ShieldCheck };
     if (score > 50) return { score, label: 'SOSPECHOSO', color: 'text-yellow-500', icon: AlertTriangle };
     return { score, label: 'RIESGO CRÍTICO', color: 'text-red-500', icon: ShieldAlert };
  };

  const filteredLeads = leads.filter(l => l.nombre?.toLowerCase().includes(searchLead.toLowerCase()) || l.telefono?.includes(searchLead));

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-6 pb-12 animate-in fade-in duration-500">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <div className="p-2 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                 <Banknote className="w-6 h-6 text-emerald-500" />
              </div>
              Centro Financiero
            </h1>
            <p className="text-slate-400 text-sm mt-1">Verificación de depósitos online, procesos de cierre y cobranza.</p>
          </div>
          <Button variant="outline" className="border-[#222225] bg-[#121214] text-slate-300 hover:bg-[#161618] h-11 px-6 rounded-xl text-xs uppercase tracking-widest font-bold" onClick={fetchAll}>
             <RefreshCw className={cn("w-4 h-4 mr-2", loading && "animate-spin")} /> Refrescar Datos
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
           <TabsList className="bg-[#121214] border border-[#222225] p-1 rounded-xl flex-wrap h-auto">
              {isManager && (
                 <TabsTrigger value="cobranza" className="gap-2 px-4 py-2 data-[state=active]:bg-amber-600 data-[state=active]:text-slate-950 uppercase text-[10px] font-bold tracking-widest">
                    <Wallet className="w-4 h-4"/> Créditos (Manual)
                 </TabsTrigger>
              )}
              <TabsTrigger value="ocr" className="gap-2 px-4 py-2 data-[state=active]:bg-indigo-600 data-[state=active]:text-white uppercase text-[10px] font-bold tracking-widest">
                 <ShieldCheck className="w-4 h-4"/> Depósitos y Transferencias
              </TabsTrigger>
              <TabsTrigger value="intenciones" className="gap-2 px-4 py-2 data-[state=active]:bg-indigo-600 data-[state=active]:text-white uppercase text-[10px] font-bold tracking-widest">
                 <Target className="w-4 h-4"/> Ventas Online (En Espera)
              </TabsTrigger>
           </TabsList>

           {/* TAB: CARTERA DE COBRANZA (CRÉDITOS) - SOLO MANAGERS */}
           {isManager && (
             <TabsContent value="cobranza" className="mt-6">
                <Card className="bg-[#0f0f11] border-[#222225] border-l-4 border-l-amber-500 shadow-2xl overflow-hidden rounded-2xl">
                   <CardHeader className="border-b border-[#222225] bg-[#161618]">
                      <CardTitle className="text-white text-base flex items-center gap-2 font-bold tracking-wide">
                         <CalendarDays className="w-5 h-5 text-amber-500" /> Vencimientos y Cobros Pendientes (Ventas a Crédito)
                      </CardTitle>
                      <CardDescription className="text-slate-400 text-xs">
                         Parcialidades programadas. NOTA: Los nuevos créditos solo se pueden generar desde el módulo de "Contactos".
                      </CardDescription>
                   </CardHeader>
                   <CardContent className="p-0">
                      <Table>
                         <TableHeader>
                            <TableRow className="border-[#222225] bg-[#161618] hover:bg-[#161618]">
                               <TableHead className="text-slate-400 uppercase text-[10px] tracking-widest font-bold pl-6">Cliente y Concepto</TableHead>
                               <TableHead className="text-slate-400 uppercase text-[10px] tracking-widest font-bold">Vencimiento</TableHead>
                               <TableHead className="text-slate-400 uppercase text-[10px] tracking-widest font-bold">Monto</TableHead>
                               <TableHead className="text-slate-400 uppercase text-[10px] tracking-widest font-bold">Estado</TableHead>
                               <TableHead className="text-right uppercase text-[10px] tracking-widest font-bold pr-6">Acción</TableHead>
                            </TableRow>
                         </TableHeader>
                         <TableBody>
                            {loading ? (
                               <TableRow><TableCell colSpan={5} className="text-center h-48"><Loader2 className="animate-spin text-amber-500 mx-auto" /></TableCell></TableRow>
                            ) : installments.length === 0 ? (
                               <TableRow><TableCell colSpan={5} className="text-center h-48 text-slate-500 text-xs font-bold uppercase tracking-widest italic">No hay cobros pendientes.</TableCell></TableRow>
                            ) : installments.map(inst => {
                               const isLate = inst.status === 'LATE' || new Date(inst.due_date) < new Date(new Date().toISOString().split('T')[0]);
                               const contactName = `${inst.sale?.contact?.nombre || ''} ${inst.sale?.contact?.apellido || ''}`.trim() || 'Cliente';
                               
                               return (
                               <TableRow key={inst.id} className="border-[#222225] hover:bg-[#121214] transition-colors">
                                  <TableCell className="pl-6">
                                     <div className="flex flex-col">
                                        <span className="text-sm font-bold text-white">{contactName}</span>
                                        <span className="text-[10px] text-slate-500 font-mono mt-0.5">{inst.sale?.contact?.telefono}</span>
                                        <span className="text-[10px] text-indigo-400 mt-1 truncate max-w-[200px]">{inst.sale?.concept} (Pago {inst.installment_number})</span>
                                     </div>
                                  </TableCell>
                                  <TableCell>
                                     <div className="flex items-center gap-2">
                                        <CalendarDays className={cn("w-4 h-4", isLate ? "text-red-500" : "text-amber-500")} />
                                        <span className={cn("font-mono text-xs font-bold", isLate ? "text-red-400" : "text-amber-400")}>
                                           {new Date(inst.due_date).toLocaleDateString()}
                                        </span>
                                     </div>
                                  </TableCell>
                                  <TableCell>
                                     <span className="text-sm font-mono font-bold text-emerald-400">
                                        ${Number(inst.amount).toLocaleString()}
                                     </span>
                                  </TableCell>
                                  <TableCell>
                                     <Badge variant="outline" className={cn(
                                        "text-[9px] uppercase font-bold tracking-widest h-6 px-2",
                                        isLate ? "border-red-500/50 text-red-400 bg-red-500/10" : "border-amber-500/50 text-amber-400 bg-amber-500/10"
                                     )}>
                                        {isLate ? 'ATRASADO' : 'PENDIENTE'}
                                     </Badge>
                                  </TableCell>
                                  <TableCell className="text-right pr-6">
                                     <Button 
                                        size="sm" 
                                        onClick={() => handleMarkInstallmentPaid(inst.id, inst.amount, contactName)}
                                        className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-[10px] uppercase tracking-widest rounded-xl shadow-lg h-9 px-4"
                                     >
                                        <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Registrar Pago
                                     </Button>
                                  </TableCell>
                               </TableRow>
                            )})}
                         </TableBody>
                      </Table>
                   </CardContent>
                </Card>
             </TabsContent>
           )}

           {/* TAB: OCR (DEPOSITOS) */}
           <TabsContent value="ocr" className="mt-6">
              <div className="bg-[#121214] border border-[#222225] p-4 rounded-xl mb-6 flex items-start gap-3">
                  <ShieldCheck className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                     <strong className="text-indigo-400">Ojo de Halcón (Verificación de Depósitos):</strong> Aquí aparecen todas las imágenes y PDFs enviados por clientes que Samurai ha clasificado como posibles pagos o transferencias bancarias. Analízalos y vincúlalos al cliente correcto para disparar la conversión a Meta Ads y marcar la venta como lograda.
                  </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                 {loading ? (
                    <div className="col-span-full py-20 text-center"><Loader2 className="animate-spin mx-auto text-indigo-500 w-10 h-10" /></div>
                 ) : paymentAssets.length === 0 ? (
                    <Card className="col-span-full bg-[#0f0f11] border-[#222225] py-20 text-center border-2 border-dashed rounded-2xl">
                       <CreditCard className="w-12 h-12 text-slate-800 mx-auto mb-4 opacity-20" />
                       <p className="text-slate-600 italic uppercase text-[10px] tracking-widest font-bold">Ojo de Halcón en espera de comprobantes...</p>
                    </Card>
                 ) : paymentAssets.map(pay => {
                    const trust = getTrustScore(pay.ocr_content);
                    const TrustIcon = trust.icon || ShieldCheck;
                    
                    return (
                    <Card key={pay.id} className="bg-[#0f0f11] border-[#222225] overflow-hidden group shadow-2xl relative rounded-2xl">
                       <div className="aspect-[3/4] bg-black relative border-b border-[#222225] flex items-center justify-center overflow-hidden">
                          <img src={pay.url} className="w-full h-full object-contain opacity-60 group-hover:opacity-100 transition-opacity" alt="Comprobante" />
                          <div className="absolute inset-0 pointer-events-none border-[12px] border-[#0f0f11]/50"></div>
                       </div>
                       
                       <CardContent className="p-5 space-y-5">
                          <div className="flex justify-between items-center">
                             <div className="flex items-center gap-2">
                                <div className={cn("p-1.5 rounded-lg bg-[#161618] border border-[#222225]", trust.color)}>
                                   <TrustIcon className="w-4 h-4" />
                                </div>
                                <span className={cn("text-[10px] font-bold uppercase tracking-widest", trust.color)}>{trust.label}</span>
                             </div>
                             <span className="text-[10px] text-slate-500 font-mono">{new Date(pay.created_at).toLocaleDateString()}</span>
                          </div>

                          <div className="bg-[#050505] p-4 rounded-xl border border-[#222225] shadow-inner space-y-3">
                             <p className="text-[9px] text-indigo-400 font-bold uppercase tracking-widest mb-2 flex items-center gap-2">
                                <Terminal className="w-3.5 h-3.5"/> Análisis Forense IA:
                             </p>
                             <div className="text-[10px] text-slate-300 font-mono whitespace-pre-wrap leading-relaxed max-h-40 overflow-y-auto custom-scrollbar">
                                {pay.ocr_content || "Iniciando escaneo de seguridad..."}
                             </div>
                          </div>
                          
                          <Button 
                            onClick={() => { setSelectedAsset(pay); setIsLinkDialogOpen(true); }}
                            className="w-full bg-indigo-600 hover:bg-indigo-500 h-11 rounded-xl text-[10px] font-bold uppercase tracking-widest shadow-lg"
                          >
                             <UserPlus className="w-4 h-4 mr-2" /> VINCULAR PAGO A CLIENTE
                          </Button>
                       </CardContent>
                    </Card>
                 )})}
              </div>
           </TabsContent>

           {/* TAB: INTENCIONES (CIERRE) */}
           <TabsContent value="intenciones" className="mt-6">
              <Card className="bg-[#0f0f11] border-[#222225] border-t-4 border-t-indigo-500 shadow-2xl rounded-2xl overflow-hidden">
                 <CardHeader className="bg-[#161618] border-b border-[#222225]">
                    <CardTitle className="text-white text-base flex items-center gap-2 font-bold tracking-wide"><Target className="w-5 h-5 text-indigo-400" /> Embudo Final: Esperando Pago</CardTitle>
                    <CardDescription className="text-xs text-slate-400">
                       Clientes que han mostrado intención ALTA de compra y se les ha enviado un link de WooCommerce o los datos para depósito.
                    </CardDescription>
                 </CardHeader>
                 <CardContent className="p-0">
                    <Table>
                       <TableHeader>
                          <TableRow className="border-[#222225] bg-[#121214] hover:bg-[#121214]">
                             <TableHead className="text-slate-500 uppercase text-[10px] font-bold tracking-widest pl-6">Cliente</TableHead>
                             <TableHead className="text-slate-500 uppercase text-[10px] font-bold tracking-widest">Estatus</TableHead>
                             <TableHead className="text-right uppercase text-[10px] font-bold tracking-widest pr-6">Acción</TableHead>
                          </TableRow>
                       </TableHeader>
                       <TableBody>
                          {intents.length === 0 ? (
                             <TableRow><TableCell colSpan={3} className="h-48 text-center text-slate-500 text-xs italic font-bold uppercase tracking-widest">No hay clientes en fase de cierre.</TableCell></TableRow>
                          ) : intents.map(lead => (
                             <TableRow key={lead.id} className="border-[#222225] hover:bg-[#161618] transition-colors">
                                <TableCell className="pl-6">
                                   <div className="flex items-center gap-4">
                                      <div className="w-10 h-10 rounded-xl bg-[#0a0a0c] flex items-center justify-center text-indigo-400 font-bold border border-[#222225] shadow-inner shrink-0">
                                         {lead.nombre?.substring(0,2).toUpperCase() || 'NA'}
                                      </div>
                                      <div className="flex flex-col">
                                         <p className="text-sm font-bold text-white">{lead.nombre || lead.telefono}</p>
                                         <p className="text-[10px] text-slate-500 font-mono mt-0.5">{lead.telefono}</p>
                                      </div>
                                   </div>
                                </TableCell>
                                <TableCell>
                                   <Badge variant="outline" className="text-[9px] border-indigo-500/30 text-indigo-400 bg-indigo-500/10 uppercase font-bold tracking-widest h-6 px-2">ESPERANDO PAGO</Badge>
                                </TableCell>
                                <TableCell className="text-right pr-6">
                                   <Button variant="ghost" size="sm" className="h-9 rounded-xl border border-[#333336] bg-[#0a0a0c] hover:bg-[#1a1a1d] text-slate-300 text-[10px] font-bold uppercase tracking-widest" onClick={() => window.location.href=`/leads?id=${lead.id}`}>
                                      Revisar Chat <ArrowRight className="w-3.5 h-3.5 ml-2 text-indigo-400" />
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

        {/* Dialogo de Vinculación */}
        <Dialog open={isLinkDialogOpen} onOpenChange={setIsLinkDialogOpen}>
           <DialogContent className="bg-[#0f0f11] border-[#222225] text-white max-w-md rounded-3xl p-0 overflow-hidden">
              <DialogHeader className="p-6 bg-[#161618] border-b border-[#222225]">
                 <DialogTitle className="text-indigo-400 text-lg flex items-center gap-2"><UserPlus className="w-5 h-5"/> Vincular Comprobante a Cliente</DialogTitle>
                 <DialogDescription className="text-slate-400 text-xs mt-1">Selecciona al cliente que envió este depósito por chat. Esto marcará su venta como pagada (Cerrada).</DialogDescription>
              </DialogHeader>
              <div className="p-6 space-y-4 bg-[#0a0a0c]">
                 <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                    <Input 
                        placeholder="Buscar por nombre o teléfono..." 
                        className="pl-10 bg-[#121214] border-[#222225] h-11 rounded-xl text-slate-200 focus-visible:ring-indigo-500"
                        value={searchLead}
                        onChange={e => setSearchLead(e.target.value)}
                    />
                 </div>
                 <ScrollArea className="h-64 border border-[#222225] rounded-2xl bg-[#121214] shadow-inner">
                    <div className="p-2 space-y-1">
                       {filteredLeads.map(lead => (
                          <button
                             key={lead.id}
                             onClick={() => handleLinkAndApprove(lead)}
                             disabled={linking}
                             className="w-full text-left p-3 rounded-xl hover:bg-[#161618] border border-transparent hover:border-indigo-500/30 transition-all flex justify-between items-center group"
                          >
                             <div>
                                <p className="text-sm font-bold text-slate-200 group-hover:text-indigo-400 transition-colors">{lead.nombre || 'Sin nombre'}</p>
                                <p className="text-[10px] text-slate-500 font-mono mt-0.5">{lead.telefono}</p>
                             </div>
                             <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-indigo-500 transition-colors" />
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