import React, { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Brain, AlertTriangle, GitBranch, Search, 
  Loader2, CheckCircle2, RefreshCw, Edit, Save, Trash2,
  Terminal, Sparkles, ArrowRight, Lock
} from 'lucide-react';
import { toast } from 'sonner';
import { logActivity } from '@/utils/logger';

const LearningLog = () => {
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [errors, setErrors] = useState<any[]>([]);
  const [currentRelearningPrompt, setCurrentRelearningPrompt] = useState("");
  
  // Dialog State
  const [selectedError, setSelectedError] = useState<any>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({ correction: '', category: 'CONDUCTA', status: 'REPORTADA' });

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: errorsData } = await supabase.from('errores_ia').select('*').order('reported_at', { ascending: false });
      setErrors(errorsData || []);

      const { data: configData } = await supabase.from('app_config').select('value').eq('key', 'prompt_relearning').maybeSingle();
      setCurrentRelearningPrompt(configData?.value || "# Aún no hay lecciones inyectadas.");

    } catch (error) {
      toast.error('Error cargando datos');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenEditDialog = (err: any) => {
     setSelectedError(err);
     setEditForm({ 
        correction: err.correccion_sugerida, 
        category: err.categoria || 'CONDUCTA', 
        status: err.estado_correccion 
     });
     setEditMode(false);
     setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Seguro que quieres eliminar esta regla?")) return;
    try {
      const { error } = await supabase.from('errores_ia').delete().eq('error_id', id);
      if (error) throw error;
      toast.success("Regla eliminada");
      fetchData();
    } catch (err: any) {
      toast.error("Error al eliminar");
    }
  };

  const handleSaveChanges = async () => {
     if (!editForm.correction.trim()) {
        toast.error("La instrucción no puede estar vacía");
        return;
     }
     
     setUpdating(true);
     try {
        const { error } = await supabase
           .from('errores_ia')
           .update({
              correccion_sugerida: editForm.correction,
              categoria: editForm.category,
              estado_correccion: editForm.status,
              applied_at: editForm.status === 'VALIDADA' ? new Date().toISOString() : null
           })
           .eq('error_id', selectedError.error_id);

        if (error) throw error;
        toast.success("Regla actualizada correctamente");
        setIsDialogOpen(false);
        fetchData();

     } catch (err: any) {
        toast.error(err.message);
     } finally {
        setUpdating(false);
     }
  };

  const syncKnowledgeToPrompt = async () => {
    setSyncing(true);
    try {
      const validated = errors.filter(e => e.estado_correccion === 'VALIDADA');
      
      if (validated.length === 0) {
        toast.error("No hay correcciones #CIA validadas para sincronizar.");
        return;
      }

      const instructionBlock = `# REGLAS DE APRENDIZAJE CRÍTICAS (#CIA)\n` + 
        `# Este bloque se genera automáticamente desde la Bitácora.\n\n` +
        validated.map((e, i) => `REGLA ${i+1} [${e.categoria}]:\n- INSTRUCCIÓN: ${e.correccion_sugerida}`).join('\n\n');

      const { error } = await supabase
        .from('app_config')
        .upsert({
          key: 'prompt_relearning',
          value: instructionBlock,
          category: 'PROMPT',
          updated_at: new Date().toISOString()
        });

      if (error) throw error;

      await logActivity({
          action: 'UPDATE',
          resource: 'BRAIN',
          description: `Sincronización de Cerebro: ${validated.length} reglas inyectadas`,
          status: 'OK'
      });

      toast.success(`¡Cerebro actualizado! ${validated.length} reglas inyectadas.`);
      fetchData();
    } catch (err: any) {
      toast.error(`Fallo de sincronización: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const filteredErrors = errors.filter(err => {
    const matchesSearch = err.mensaje_cliente?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         err.categoria?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         err.correccion_sugerida?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || err.estado_correccion?.toLowerCase() === statusFilter.toLowerCase();
    return matchesSearch && matchesStatus;
  });

  const validatedCount = errors.filter(e => e.estado_correccion === 'VALIDADA').length;

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-6 pb-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-2">
              <Brain className="w-8 h-8 text-indigo-500" /> 
              Bitácora #CIA
            </h1>
            <p className="text-slate-400">Panel de auditoría y validación de lecciones aprendidas en los chats.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-slate-900 border-slate-800 p-6 border-l-4 border-l-indigo-600 shadow-xl">
             <div className="flex justify-between items-start">
                <div>
                   <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Lecciones Validadas</p>
                   <h3 className="text-3xl font-bold text-white mt-1">{validatedCount}</h3>
                </div>
                <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-500">
                   <CheckCircle2 className="w-6 h-6" />
                </div>
             </div>
             <p className="text-[9px] text-slate-500 mt-4 uppercase font-mono">LISTAS PARA SINCRONIZAR</p>
          </Card>
          <Card className="bg-slate-900 border-slate-800 p-6 border-l-4 border-l-yellow-600 shadow-xl">
             <div className="flex justify-between items-start">
                <div>
                   <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Pendientes de Revisión</p>
                   <h3 className="text-3xl font-bold text-white mt-1">{errors.filter(e => e.estado_correccion === 'REPORTADA').length}</h3>
                </div>
                <div className="p-3 rounded-xl bg-yellow-500/10 text-yellow-500">
                   <AlertTriangle className="w-6 h-6" />
                </div>
             </div>
             <p className="text-[9px] text-slate-500 mt-4 uppercase font-mono">REVISE ANTES DE APROBAR</p>
          </Card>
        </div>

        <Tabs defaultValue="errores" className="w-full">
          <TabsList className="bg-slate-900 border border-slate-800 p-1">
            <TabsTrigger value="errores" className="gap-2"><AlertTriangle className="w-4 h-4" /> Reportes de Chat</TabsTrigger>
            <TabsTrigger value="prompt" className="gap-2"><Terminal className="w-4 h-4" /> Cerebro Complementario</TabsTrigger>
          </TabsList>

          <TabsContent value="errores" className="mt-6 space-y-4">
            <div className="flex flex-col md:flex-row gap-4 bg-slate-900/50 p-4 rounded-lg border border-slate-800">
               <div className="relative flex-1">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                  <Input 
                    placeholder="Buscar por contenido o categoría..." 
                    className="pl-9 bg-slate-950 border-slate-800 text-white" 
                    value={searchTerm} 
                    onChange={e => setSearchTerm(e.target.value)} 
                  />
               </div>
               <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[180px] bg-slate-950 border-slate-800 text-slate-300">
                    <SelectValue placeholder="Filtrar Estado" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-white">
                     <SelectItem value="all">Todos los estados</SelectItem>
                     <SelectItem value="REPORTADA">Reportada</SelectItem>
                     <SelectItem value="VALIDADA">Validada (Activa)</SelectItem>
                     <SelectItem value="RECHAZADA">Rechazada</SelectItem>
                  </SelectContent>
               </Select>
            </div>

            <Card className="bg-slate-900 border-slate-800 overflow-hidden shadow-2xl">
               <Table>
                  <TableHeader>
                     <TableRow className="border-slate-800 bg-slate-950/30">
                        <TableHead className="text-slate-400 text-[10px] uppercase">Timestamp</TableHead>
                        <TableHead className="text-slate-400 text-[10px] uppercase">Categoría</TableHead>
                        <TableHead className="text-slate-400 text-[10px] uppercase">Instrucción #CIA</TableHead>
                        <TableHead className="text-slate-400 text-[10px] uppercase">Estado</TableHead>
                        <TableHead className="text-right text-slate-400 text-[10px] uppercase">Acciones</TableHead>
                     </TableRow>
                  </TableHeader>
                  <TableBody>
                     {loading ? (
                        <TableRow><TableCell colSpan={5} className="text-center h-32"><Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-500" /></TableCell></TableRow>
                     ) : filteredErrors.length === 0 ? (
                        <TableRow><TableCell colSpan={5} className="text-center h-32 text-slate-500 italic uppercase text-[10px]">No hay reportes que coincidan</TableCell></TableRow>
                     ) : (
                        filteredErrors.map(err => (
                           <TableRow key={err.error_id} className="border-slate-800 hover:bg-slate-800/30 transition-colors">
                              <TableCell className="text-[10px] text-slate-500 font-mono">
                                 {new Date(err.reported_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                              </TableCell>
                              <TableCell>
                                 <Badge variant="outline" className="text-[9px] border-indigo-500/30 text-indigo-400 font-bold">
                                    {err.category || err.categoria}
                                 </Badge>
                              </TableCell>
                              <TableCell className="max-w-md">
                                 <p className="text-xs text-slate-300 font-medium line-clamp-1">{err.correccion_sugerida}</p>
                              </TableCell>
                              <TableCell>
                                 <Badge className={
                                    err.estado_correccion === 'VALIDADA' ? 'bg-green-600/20 text-green-500 border-green-500/30' : 
                                    err.estado_correccion === 'RECHAZADA' ? 'bg-red-900/50 text-red-500' : 
                                    'bg-yellow-600/20 text-yellow-500 border border-yellow-500/20'
                                 }>
                                    {err.estado_correccion}
                                 </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                 <div className="flex justify-end gap-2">
                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:text-indigo-400" onClick={() => handleOpenEditDialog(err)}>
                                       <Edit className="w-4 h-4" />
                                    </Button>
                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:text-red-500" onClick={() => handleDelete(err.error_id)}>
                                       <Trash2 className="w-4 h-4" />
                                    </Button>
                                 </div>
                              </TableCell>
                           </TableRow>
                        ))
                     )}
                  </TableBody>
               </Table>
            </Card>
          </TabsContent>
          
          <TabsContent value="prompt" className="mt-6 animate-in fade-in-50">
             <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-8">
                   <Card className="bg-slate-900 border-slate-800 shadow-2xl relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
                      <CardHeader className="bg-slate-950/20 border-b border-slate-800 py-4 flex flex-row items-center justify-between">
                         <div>
                            <CardTitle className="text-sm text-white flex items-center gap-2 uppercase tracking-widest">
                               <Terminal className="w-4 h-4 text-indigo-400" /> Visor del Prompt Aprendido
                            </CardTitle>
                            <CardDescription className="text-[10px]">Este bloque se inyecta en la Capa 1 del Cerebro.</CardDescription>
                         </div>
                         <div className="flex gap-3">
                            <Button 
                               onClick={fetchData} 
                               variant="ghost" 
                               size="sm" 
                               className="h-8 text-[10px] text-slate-500"
                            >
                               <RefreshCw className="w-3 h-3 mr-2" /> RECARGAR DATOS
                            </Button>
                            <Button 
                               onClick={syncKnowledgeToPrompt} 
                               disabled={syncing || validatedCount === 0}
                               className="bg-indigo-600 hover:bg-indigo-700 h-8 text-[10px] font-bold shadow-lg shadow-indigo-900/20"
                            >
                               {syncing ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : <Zap className="w-3 h-3 mr-2" />}
                               SINCRONIZAR CEREBRO ({validatedCount})
                            </Button>
                         </div>
                      </CardHeader>
                      <CardContent className="p-0">
                         <ScrollArea className="h-[500px] bg-black">
                            <div className="p-6 font-mono text-[11px] leading-relaxed text-slate-400 select-text">
                               {syncing ? (
                                  <div className="h-full flex flex-col items-center justify-center py-20 gap-4">
                                     <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                                     <p className="animate-pulse">Consolidando reglas #CIA...</p>
                                  </div>
                               ) : (
                                  <pre className="whitespace-pre-wrap">{currentRelearningPrompt}</pre>
                               )}
                            </div>
                         </ScrollArea>
                      </CardContent>
                      <CardFooter className="bg-slate-950/40 border-t border-slate-800 p-4">
                         <div className="flex items-center gap-2 text-xs text-slate-500 italic">
                            <Sparkles className="w-4 h-4 text-indigo-400" />
                            <span>Samurai usa este bloque como su "brújula moral" para no repetir errores pasados.</span>
                         </div>
                      </CardFooter>
                   </Card>
                </div>

                <div className="lg:col-span-4 space-y-6">
                   <Card className="bg-slate-900 border-slate-800 shadow-xl border-l-4 border-l-green-500">
                      <CardHeader className="py-4">
                         <CardTitle className="text-xs uppercase tracking-widest text-slate-300">Próxima Inyección</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                         <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-500">Nuevas reglas validadas:</span>
                            <span className="font-bold text-green-500">{validatedCount}</span>
                         </div>
                         <div className="p-3 bg-slate-950 rounded border border-slate-800 space-y-2">
                            <p className="text-[10px] text-slate-400 font-bold uppercase">Impacto:</p>
                            <div className="space-y-1.5">
                               {errors.filter(e => e.estado_correccion === 'VALIDADA').slice(0, 3).map((e, i) => (
                                  <div key={i} className="flex items-center gap-2 text-[10px] text-slate-500">
                                     <ArrowRight className="w-2.5 h-2.5 text-indigo-500" />
                                     <span className="truncate">{e.correccion_sugerida}</span>
                                  </div>
                               ))}
                               {validatedCount > 3 && <p className="text-[9px] text-slate-600 pl-4">+ {validatedCount - 3} reglas más...</p>}
                            </div>
                         </div>
                      </CardContent>
                   </Card>
                </div>
             </div>
          </TabsContent>
        </Tabs>

        {/* DIALOG DE REVISIÓN / EDICIÓN */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
           <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-lg shadow-2xl">
              <DialogHeader>
                 <DialogTitle className="flex items-center gap-2 text-yellow-500">
                    <Zap className="w-5 h-5" /> 
                    {editMode ? 'Editar Regla #CIA' : 'Revisar Reporte de Chat'}
                 </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                 
                 {selectedError?.mensaje_cliente !== 'Creación Manual' && (
                    <div className="bg-slate-950/50 p-3 rounded border border-slate-800 space-y-3">
                       <div className="flex gap-2 items-start">
                          <span className="text-[9px] font-bold bg-slate-800 px-1 rounded text-slate-400 uppercase">Input Cliente</span>
                          <p className="text-xs text-slate-300 italic">"{selectedError?.mensaje_cliente}"</p>
                       </div>
                       <div className="flex gap-2 items-start">
                          <span className="text-[9px] font-bold bg-red-900/30 px-1 rounded text-red-400 uppercase">Fallo IA</span>
                          <p className="text-xs text-red-300/80 italic">"{selectedError?.respuesta_ia}"</p>
                       </div>
                    </div>
                 )}

                 <div className="space-y-3">
                    <div className="space-y-2">
                       <Label className="text-[10px] text-green-400 uppercase font-bold tracking-widest">Instrucción Maestra (#CIA)</Label>
                       <Textarea 
                          value={editForm.correction}
                          onChange={e => setEditForm({...editForm, correction: e.target.value})}
                          disabled={!editMode}
                          className="bg-slate-950 border-slate-800 font-mono text-xs h-32 focus:border-green-500"
                       />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                       <div className="space-y-2">
                          <Label className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">Categoría</Label>
                          <Select 
                             value={editForm.category} 
                             onValueChange={v => setEditForm({...editForm, category: v})}
                             disabled={!editMode}
                          >
                             <SelectTrigger className="h-8 text-xs bg-slate-950 border-slate-800"><SelectValue /></SelectTrigger>
                             <SelectContent className="bg-slate-900 border-slate-800 text-white">
                                <SelectItem value="CONDUCTA">Conducta</SelectItem>
                                <SelectItem value="VENTAS">Ventas</SelectItem>
                                <SelectItem value="INFO_ERRONEA">Dato Erróneo</SelectItem>
                                <SelectItem value="TONO">Tono Inadecuado</SelectItem>
                             </SelectContent>
                          </Select>
                       </div>
                       <div className="space-y-2">
                          <Label className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">Estado</Label>
                          <Select 
                             value={editForm.status} 
                             onValueChange={v => setEditForm({...editForm, status: v})}
                             disabled={!editMode}
                          >
                             <SelectTrigger className="h-8 text-xs bg-slate-950 border-slate-800"><SelectValue /></SelectTrigger>
                             <SelectContent className="bg-slate-900 border-slate-800 text-white">
                                <SelectItem value="REPORTADA">Reportada (Pendiente)</SelectItem>
                                <SelectItem value="VALIDADA">Validada (Activa)</SelectItem>
                                <SelectItem value="RECHAZADA">Rechazada</SelectItem>
                             </SelectContent>
                          </Select>
                       </div>
                    </div>
                 </div>

              </div>
              <DialogFooter className="gap-2 sm:gap-0">
                 {!editMode ? (
                    <>
                       <Button variant="ghost" onClick={() => setIsDialogOpen(false)}>Cerrar</Button>
                       <Button variant="outline" className="border-indigo-500 text-indigo-400 hover:bg-indigo-500/10" onClick={() => setEditMode(true)}>
                          <Lock className="w-3 h-3 mr-2" /> Editar Regla
                       </Button>
                       {editForm.status === 'REPORTADA' && (
                          <Button className="bg-green-600 hover:bg-green-700" onClick={() => { setEditForm({...editForm, status: 'VALIDADA'}); setEditMode(true); }}>
                             <CheckCircle2 className="w-4 h-4 mr-2" /> Validar Rápido
                          </Button>
                       )}
                    </>
                 ) : (
                    <>
                       <Button variant="ghost" onClick={() => setEditMode(false)}>Cancelar</Button>
                       <Button className="bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-900/20" onClick={handleSaveChanges} disabled={updating}>
                          {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                          Actualizar Regla
                       </Button>
                    </>
                 )}
              </DialogFooter>
           </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default LearningLog;