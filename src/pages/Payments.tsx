import React, { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription as DialogDesc } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  CreditCard, Search, Loader2, CheckCircle2, Clock, 
  ExternalLink, RefreshCw, ShieldCheck, Target, Mail, MapPin, 
  ShieldAlert, AlertTriangle, Terminal, Banknote, DollarSign, UserPlus, ArrowRight, CalendarDays, Wallet, Trash2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/context/AuthContext';
import { ManageCreditDialog } from '@/components/payments/ManageCreditDialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogHeader, AlertDialogTitle, AlertDialogFooter, AlertDialogDescription
} from "@/components/ui/alert-dialog";

const Payments = () => {
  const { user, isManager } = useAuth();
  const [activeTab, setActiveTab] = useState(isManager ? 'cobranza' : 'ocr');

  const [paymentAssets, setPaymentAssets] = useState<any[]>([]);
  const [intents, setIntents] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [creditSales, setCreditSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedAsset, setSelectedAsset] = useState<any>(null);
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
  const [searchLead, setSearchLead] = useState('');
  const [linking, setLinking] = useState(false);

  const [selectedSale, setSelectedSale] = useState<any>(null);
  const [isCreditDialogOpen, setIsCreditDialogOpen] = useState(false);

  // Estados para eliminación de crédito
  const [saleToDelete, setSaleToDelete] = useState<any>(null);
  const [isDeletingSale, setIsDeletingSale] = useState(false);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const { data: media } = await supabase.from('media_assets').select('*').eq('category', 'PAYMENT').order('created_at', { ascending: false });
      let intentsQuery = supabase.from('leads').select('*').eq('buying_intent', 'ALTO').order('last_message_at', { ascending: false });
      let leadsQuery = supabase.from('leads').select('id, nombre, telefono, email, ciudad, estado, cp, pais, apellido').limit(100);
      // FILTRO DE PRIVACIDAD
      if (!isManager) {
        intentsQuery = intentsQuery.eq('assigned_to', user?.id);
        leadsQuery = leadsQuery.eq('assigned_to', user?.id);
      }
      const { data: highIntents } = await intentsQuery;
      const { data: allLeads } = await leadsQuery;
        
      if (isManager) {
        const { data: salesData } = await supabase
          .from('credit_sales')
          .select(`
             *,
             contact:contacts(nombre, apellido, telefono, lead_id),
             installments:credit_installments(*)
          `)
          .order('created_at', { ascending: false });
        setCreditSales(salesData || []);
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
     const tid = toast.loading(`Validando comprobante de ${lead.nombre}...`);

     try {
        await supabase.from('leads').update({
           buying_intent: 'COMPRADO',
           payment_status: 'VALID',
           followup_stage: 100,
           summary: `PAGO COMPROBADO MANUALMENTE. Ref: ${selectedAsset.title}`
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

        toast.success("Venta comprobada y marcada como GANADO.", { id: tid });
        setIsLinkDialogOpen(false);
        fetchAll();
     } catch (err: any) {
        toast.error("Error: " + err.message, { id: tid });
     } finally {
        setLinking(false);
     }
  };

  const handleDeleteSale = async (sale: any) => {
    setIsDeletingSale(true);
    const tid = toast.loading("Eliminando venta a crédito permanentemente...");
    try {
      // 1. Eliminar cuotas (installments) para evitar problemas de llave foránea
      await supabase.from('credit_installments').delete().eq('sale_id', sale.id);
      
      // 2. Eliminar la venta principal
      const { error } = await supabase.from('credit_sales').delete().eq('id', sale.id);
      if (error) throw error;
      
      // 3. Registrar en bitácora
      await supabase.from('activity_logs').insert({
         action: 'DELETE', resource: 'SYSTEM',
         description: `Venta a crédito eliminada para ${sale.contact?.nombre || 'Cliente'} (${sale.concept})`, 
         status: 'OK'
      });

      toast.success("Crédito eliminado con éxito.", { id: tid });
      setSaleToDelete(null);
      fetchAll();
    } catch (err: any) {
      toast.error(err.message, { id: tid });
    } finally {
      setIsDeletingSale(false);
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
            <p className="text-slate-400 text-sm mt-1">Gestión separada de pagos de contado (Web) y cobranza manual (Créditos).</p>
          </div>
          <Button variant="outline" className="border-[#222225] bg-[#121214] text-slate-300 hover:bg-[#161618] h-11 px-6 rounded-xl text-xs uppercase tracking-widest font-bold" onClick={fetchAll}>
             <RefreshCw className={cn("w-4 h-4 mr-2", loading && "animate-spin")} /> Refrescar Datos
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
           <TabsList className="bg-[#121214] border border-[#222225] p-1 rounded-xl flex-wrap h-auto">
              {isManager && (
                 <TabsTrigger value="cobranza" className="gap-2 px-4 py-2 data-[state=active]:bg-amber-600 data-[state=active]:text-slate-950 uppercase text-[10px] font-bold tracking-widest">
                    <Wallet className="w-4 h-4"/> Créditos y Abonos
                 </TabsTrigger>
              )}
              <TabsTrigger value="intenciones" className="gap-2 px-4 py-2 data-[state=active]:bg-indigo-600 data-[state=active]:text-white uppercase text-[10px] font-bold tracking-widest">
                 <Target className="w-4 h-4"/> Ventas Online (Woocommerce)
              </TabsTrigger>
              <TabsTrigger value="ocr" className="gap-2 px-4 py-2 data-[state=active]:bg-emerald-600 data-[state=active]:text-white uppercase text-[10px] font-bold tracking-widest">
                 <ShieldCheck className="w-4 h-4"/> Validar Depósitos (Venta Contado)
              </TabsTrigger>
           </TabsList>

           {/* TAB: CARTERA DE COBRANZA (CRÉDITOS) - SOLO MANAGERS */}
           {isManager && (
             <TabsContent value="cobranza" className="mt-6">
                <Card className="bg-[#0f0f11] border-[#222225] border-l-4 border-l-amber-500 shadow-2xl overflow-hidden rounded-2xl">
                   <CardHeader className="border-b border-[#222225] bg-[#161618]">
                      <CardTitle className="text-white text-base flex items-center gap-2 font-bold tracking-wide">
                         <CalendarDays className="w-5 h-5 text-amber-500" /> Bóvedas de Crédito
                      </CardTitle>
                      <CardDescription className="text-slate-400 text-xs">
                         Selecciona una venta para registrar abonos flexibles.
                      </CardDescription>
                   </CardHeader>
                   <CardContent className="p-0">
                      <Table>
                         <TableHeader>
                            <TableRow className="border-[#222225] bg-[#161618] hover:bg-[#161618]">
                               <TableHead className="text-slate-400 uppercase text-[10px] tracking-widest font-bold pl-6">Cliente y Concepto</TableHead>
                               <TableHead className="text-slate-400 uppercase text-[10px] tracking-widest font-bold">Deuda Total</TableHead>
                               <TableHead className="text-slate-400 uppercase text-[10px] tracking-widest font-bold">Pagado</TableHead>
                               <TableHead className="text-slate-400 uppercase text-[10px] tracking-widest font-bold">Estado General</TableHead>
                               <TableHead className="text-right uppercase text-[10px] tracking-widest font-bold pr-6">Acciones</TableHead>
                            </TableRow>
                         </TableHeader>
                         <TableBody>
                            {loading ? (
                               <TableRow><TableCell colSpan={5} className="text-center h-48"><Loader2 className="animate-spin text-amber-500 mx-auto" /></TableCell></TableRow>
                            ) : creditSales.length === 0 ? (
                               <TableRow><TableCell colSpan={5} className="text-center h-48 text-slate-500 text-xs font-bold uppercase tracking-widest italic">No hay créditos activos.</TableCell></TableRow>
                            ) : creditSales.map(sale => {
                               const contactName = `${sale.contact?.nombre || ''} ${sale.contact?.apellido || ''}`.trim() || 'Cliente';
                               const totalAmount = parseFloat(sale.total_amount) || 0;
                               const downPayment = parseFloat(sale.down_payment) || 0;
                               const paidInst = (sale.installments || []).filter((i:any) => i.status === 'PAID').reduce((sum: number, i: any) => sum + parseFloat(i.amount), 0);
                               const totalPaid = downPayment + paidInst;
                               
                               return (
                               <TableRow key={sale.id} className="border-[#222225] hover:bg-[#121214] transition-colors">
                                  <TableCell className="pl-6">
                                     <div className="flex flex-col">
                                        <span className="text-sm font-bold text-white">{contactName}</span>
                                        <span className="text-[10px] text-slate-500 font-mono mt-0.5">{sale.contact?.telefono}</span>
                                        <span className="text-[10px] text-indigo-400 mt-1 truncate max-w-[200px]" title={sale.concept}>{sale.concept}</span>
                                     </div>
                                  </TableCell>
                                  <TableCell>
                                     <span className="font-mono text-sm font-bold text-white">
                                        ${totalAmount.toLocaleString()}
                                     </span>
                                  </TableCell>
                                  <TableCell>
                                     <div className="flex flex-col">
                                        <span className="text-sm font-mono font-bold text-emerald-400">
                                           ${totalPaid.toLocaleString()}
                                        </span>
                                        <div className="w-24 h-1 mt-1 bg-[#222225] rounded-full overflow-hidden">
                                           <div className="h-full bg-emerald-500" style={{ width: `${Math.min(100, (totalPaid / totalAmount) * 100)}%` }} />
                                        </div>
                                     </div>
                                  </TableCell>
                                  <TableCell>
                                     <Badge variant="outline" className={cn(
                                        "text-[9px] uppercase font-bold tracking-widest h-6 px-2",
                                        sale.status === 'PAID' ? "border-emerald-500/50 text-emerald-400 bg-emerald-500/10" : "border-amber-500/50 text-amber-400 bg-amber-500/10"
                                     )}>
                                        {sale.status === 'PAID' ? 'LIQUIDADO' : 'ACTIVO'}
                                     </Badge>
                                  </TableCell>
                                  <TableCell className="text-right pr-6">
                                     <div className="flex justify-end gap-2 items-center">
                                       <Button 
                                          size="sm" 
                                          variant="outline"
                                          onClick={() => { setSelectedSale(sale); setIsCreditDialogOpen(true); }}
                                          className="border-[#333336] bg-[#0a0a0c] text-amber-500 hover:bg-amber-500 hover:text-slate-950 font-bold text-[10px] uppercase tracking-widest rounded-xl shadow-sm h-9 px-4 transition-colors"
                                       >
                                          <Wallet className="w-3.5 h-3.5 mr-1.5" /> Gestionar
                                       </Button>
                                       <Button
                                          variant="ghost"
                                          size="icon"
                                          onClick={() => setSaleToDelete(sale)}
                                          className="text-slate-500 hover:text-red-500 hover:bg-red-500/10 h-9 w-9 rounded-xl transition-colors"
                                          title="Eliminar Crédito"
                                       >
                                          <Trash2 className="w-4 h-4" />
                                       </Button>
                                     </div>
                                  </TableCell>
                               </TableRow>
                            )})}
                         </TableBody>
                      </Table>
                   </CardContent>
                </Card>
             </TabsContent>
           )}

           <TabsContent value="intenciones" className="mt-6">
              <Card className="bg-[#0f0f11] border-[#222225] border-t-4 border-t-indigo-500 shadow-2xl rounded-2xl overflow-hidden">
                 <CardHeader className="bg-[#161618] border-b border-[#222225]">
                    <CardTitle className="text-white text-base flex items-center gap-2 font-bold tracking-wide"><Target className="w-5 h-5 text-indigo-400" /> Embudo Final: Esperando Venta Online</CardTitle>
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
                             <TableRow><TableCell colSpan={3} className="h-48 text-center text-slate-500 text-xs italic font-bold uppercase tracking-widest">No hay clientes en esta etapa.</TableCell></TableRow>
                          ) : intents.map(lead => (
                             <TableRow key={lead.id} className="border-[#222225] hover:bg-[#161618] transition-colors">
                                <TableCell className="pl-6 font-bold text-white">{lead.nombre || lead.telefono}</TableCell>
                                <TableCell><Badge variant="outline" className="text-[9px] border-indigo-500/30 text-indigo-400 bg-indigo-500/10">ESPERANDO COMPRA WC</Badge></TableCell>
                                <TableCell className="text-right pr-6"><Button variant="ghost" size="sm" onClick={() => window.location.href=`/leads?id=${lead.id}`}>Revisar Chat</Button></TableCell>
                             </TableRow>
                          ))}
                       </TableBody>
                    </Table>
                 </CardContent>
              </Card>
           </TabsContent>

           <TabsContent value="ocr" className="mt-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                 {paymentAssets.length === 0 ? (
                    <div className="col-span-full py-20 text-center text-slate-500 text-xs font-bold uppercase tracking-widest italic border-2 border-dashed border-[#222225] rounded-2xl">
                       No hay comprobantes pendientes de validación.
                    </div>
                 ) : paymentAssets.map(pay => (
                    <Card key={pay.id} className="bg-[#0f0f11] border-[#222225] shadow-2xl rounded-2xl p-4">
                       <img src={pay.url} className="w-full h-48 object-contain rounded-lg border border-[#222225] mb-4"/>
                       <Button onClick={() => { setSelectedAsset(pay); setIsLinkDialogOpen(true); }} className="w-full bg-emerald-600 hover:bg-emerald-500">Vincular y Aprobar</Button>
                    </Card>
                 ))}
              </div>
           </TabsContent>
        </Tabs>

        {/* Diálogo Vincular Venta de Contado */}
        <Dialog open={isLinkDialogOpen} onOpenChange={setIsLinkDialogOpen}>
          <DialogContent className="bg-[#0f0f11] border-[#222225] text-white max-w-3xl rounded-3xl p-0 overflow-hidden shadow-2xl flex flex-col md:flex-row h-[80vh] md:h-[600px]">
            <div className="w-full md:w-1/2 bg-[#0a0a0c] border-r border-[#222225] p-6 flex flex-col min-h-0">
               <DialogHeader className="mb-4 shrink-0">
                  <DialogTitle className="flex items-center gap-2 text-emerald-400 text-lg"><ShieldCheck className="w-5 h-5"/> Validar Comprobante</DialogTitle>
                  <DialogDesc className="text-slate-400 text-xs">Busca al cliente en el CRM y adjudícale esta venta.</DialogDesc>
               </DialogHeader>
               
               <div className="space-y-4 flex-1 flex flex-col min-h-0">
                  <div className="relative shrink-0">
                     <Search className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                     <Input placeholder="Buscar nombre o teléfono..." value={searchLead} onChange={e => setSearchLead(e.target.value)} className="pl-10 bg-[#161618] border-[#222225] h-10 rounded-xl focus-visible:ring-emerald-500 text-sm" />
                  </div>
                  <ScrollArea className="flex-1 border border-[#222225] rounded-xl bg-[#121214]">
                     <div className="divide-y divide-[#222225]">
                        {filteredLeads.length === 0 ? (
                           <div className="p-8 text-center text-slate-500 text-xs italic">No se encontraron clientes.</div>
                        ) : filteredLeads.map(lead => (
                           <div key={lead.id} className="p-3 hover:bg-[#161618] transition-colors flex justify-between items-center group">
                              <div className="flex flex-col min-w-0 pr-2">
                                 <span className="font-bold text-sm text-slate-200 truncate">{lead.nombre}</span>
                                 <span className="text-[10px] text-slate-500 font-mono">{lead.telefono}</span>
                              </div>
                              <Button size="sm" onClick={() => handleLinkAndApprove(lead)} disabled={linking} className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold uppercase tracking-widest text-[9px] h-8 rounded-lg shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                 Aprobar <ArrowRight className="w-3 h-3 ml-1"/>
                              </Button>
                           </div>
                        ))}
                     </div>
                  </ScrollArea>
               </div>
            </div>

            <div className="w-full md:w-1/2 bg-[#121214] p-6 flex flex-col gap-4 overflow-y-auto custom-scrollbar">
               {selectedAsset && (
                  <>
                     <div className="rounded-xl overflow-hidden border border-[#222225] bg-black shadow-inner relative group">
                        <img src={selectedAsset.url} className="w-full h-[250px] object-contain" alt="Comprobante" />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                           <a href={selectedAsset.url} target="_blank" rel="noreferrer" className="text-white flex items-center gap-2 text-xs font-bold bg-white/20 px-4 py-2 rounded-lg backdrop-blur-md hover:bg-white/30 transition-colors">
                              <ExternalLink className="w-4 h-4"/> Abrir en grande
                           </a>
                        </div>
                     </div>

                     <div className="bg-[#0a0a0c] border border-[#222225] rounded-xl p-4 space-y-3">
                        <div className="flex justify-between items-center">
                           <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-400 flex items-center gap-1.5"><Terminal className="w-3.5 h-3.5"/> Ojo de Halcón (OCR)</span>
                           <Badge variant="outline" className={cn("text-[9px] font-bold uppercase border bg-[#121214]", getTrustScore(selectedAsset.ocr_content).color)}>
                              {getTrustScore(selectedAsset.ocr_content).label}
                           </Badge>
                        </div>
                        <ScrollArea className="h-24 bg-black border border-[#222225] rounded-lg p-3">
                           {selectedAsset.ocr_content ? (
                              <p className="text-[10px] font-mono text-slate-400 leading-relaxed">{selectedAsset.ocr_content}</p>
                           ) : (
                              <p className="text-[10px] italic text-slate-600 text-center mt-6">Sin análisis OCR.</p>
                           )}
                        </ScrollArea>
                     </div>
                  </>
               )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Diálogo de Confirmación para Eliminar Crédito */}
        <AlertDialog open={!!saleToDelete} onOpenChange={(open) => !open && !isDeletingSale && setSaleToDelete(null)}>
          <AlertDialogContent className="bg-[#0f0f11] border-[#222225] text-white rounded-3xl">
            <AlertDialogHeader>
               <AlertDialogTitle className="text-red-400 flex items-center gap-2">
                  <Trash2 className="w-5 h-5" /> ¿Eliminar Venta a Crédito?
               </AlertDialogTitle>
               <AlertDialogDescription className="text-slate-400 text-sm">
                  Estás a punto de eliminar el crédito de <strong>{saleToDelete?.contact?.nombre}</strong> por el concepto de <strong>{saleToDelete?.concept}</strong>.
                  <br /><br />
                  Esta acción borrará de forma permanente el historial de todas las cuotas y abonos asociados a este crédito. <strong className="text-red-400">Esta acción no se puede deshacer.</strong>
               </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="mt-4">
              <AlertDialogCancel disabled={isDeletingSale} className="bg-transparent border-[#222225] text-slate-400 hover:text-white rounded-xl h-11 uppercase font-bold text-[10px] tracking-widest">
                 Cancelar
              </AlertDialogCancel>
              <AlertDialogAction disabled={isDeletingSale} onClick={() => handleDeleteSale(saleToDelete)} className="bg-red-600 hover:bg-red-500 text-white rounded-xl h-11 uppercase font-bold text-[10px] tracking-widest border-none shadow-lg">
                 {isDeletingSale ? <Loader2 className="w-4 h-4 animate-spin mr-2"/> : <Trash2 className="w-4 h-4 mr-2"/>} Eliminar Definitivamente
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

      </div>

      <ManageCreditDialog open={isCreditDialogOpen} onOpenChange={setIsCreditDialogOpen} sale={selectedSale} onSuccess={fetchAll} />
    </Layout>
  );
};

export default Payments;