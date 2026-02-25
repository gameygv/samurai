import React, { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { 
  Brain, AlertTriangle, GitBranch, Search, 
  Eye, Loader2, Zap, CheckCircle2, RefreshCcw, Edit, Lock, Plus, Save
} from 'lucide-react';
import { toast } from 'sonner';
import { logActivity } from '@/utils/logger';

const LearningLog = () => {
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [errors, setErrors] = useState<any[]>([]);
  const [versions, setVersions] = useState<any[]>([]);
  
  // Dialog State
  const [selectedError, setSelectedError] = useState<any>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
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

      const { data: versionsData } = await supabase.from('versiones_prompts_aprendidas').select('*').order('created_at', { ascending: false });
      setVersions(versionsData || []);
    } catch (error) {
      toast.error('Error cargando datos');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenEditDialog = (err: any) => {
     setIsCreating(false);
     setSelectedError(err);
     setEditForm({ 
        correction: err.correccion_sugerida, 
        category: err.categoria || 'CONDUCTA', 
        status: err.estado_correccion 
     });
     setEditMode(false);
     setIsDialogOpen(true);
  };

  const handleOpenCreateDialog = () => {
     setIsCreating(true);
     setSelectedError(null);
     setEditForm({ 
        correction: '', 
        category: 'CONDUCTA', 
        status: 'VALIDADA' // Por defecto validada si se crea manual
     });
     setEditMode(true);
     setIsDialogOpen(true);
  };

  const handleSaveChanges = async () => {
     if (!editForm.correction.trim()) {
        toast.error("La instrucción no puede estar vacía");
        return;
     }
     
     setUpdating(true);
     try {
        if (isCreating) {
           const { error } = await supabase
              .from('errores_ia')
              .insert({
                 correccion_sugerida: editForm.correction,
                 categoria: editForm.category,
                 estado_correccion: editForm.status,
                 mensaje_cliente: 'Creación Manual',
                 respuesta_ia: 'N/A',
                 applied_at: editForm.status === 'VALIDADA' ? new Date().toISOString() : null
              });

           if (error) throw error;

           await logActivity({
              action: 'CREATE',
              resource: 'BRAIN',
              description: `Nueva regla #CIA manual creada: ${editForm.category}`,
              status: 'OK'
           });

           toast.success("Nueva regla guardada correctamente");
        } else {
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

           await logActivity({
              action: 'UPDATE',
              resource: 'BRAIN',
              description: `Regla #CIA actualizada: ${editForm.category}`,
              status: 'OK'
           });

           toast.success("Regla actualizada correctamente");
        }

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

      const instructionBlock = `# LECCIONES APRENDIDAS (#CIA AUTO-GENERADO)\n` + 
        validated.map(e => `[${e.categoria}] REGLA: ${e.correccion_sugerida}`).join('\n');

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
        description: `Sincronización #CIA: ${validated.length} reglas inyectadas.`,
        status: 'OK'
      });

      toast.success(`¡Cerebro actualizado! ${validated.length} reglas #CIA inyectadas.`);
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
            <p className="text-slate-400">Gestiona las reglas de corrección y sincroniza el cerebro.</p>
          </div>
          <div className="flex gap-3">
             <Button 
               variant="outline"
               className="border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/10"
               onClick={handleOpenCreateDialog}
             >
                <Plus className="w-4 h-4 mr-2" /> Nueva Regla #CIA
             </Button>
             <Button 
               onClick={syncKnowledgeToPrompt} 
               disabled={syncing || validatedCount === 0}
               className="bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-900/20"
             >
               {syncing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCcw className="w-4 h-4 mr-2" />}
               Sincronizar Cerebro ({validatedCount})
             </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-slate-900 border-slate-800 p-6">
             <div className="flex justify-between items-start">
                <div>
                   <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Reglas Activas</p>
                   <h3 className="text-3xl font-bold text-white mt-1">{validatedCount}</h3>
                </div>
                <div className="p-3 rounded-xl bg-green-500/10 text-green-500">
                   <CheckCircle2 className="w-6 h-6" />
                </div>
             </div>
             <p className="text-[10px] text-slate-500 mt-4 uppercase">Inyectadas en Prompt</p>
          </Card>
          <Card className="bg-slate-900 border-slate-800 p-6">
             <div className="flex justify-between items-start">
                <div>
                   <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Pendientes</p>
                   <h3 className="text-3xl font-bold text-white mt-1">{errors.filter(e => e.estado_correccion === 'REPORTADA').length}</h3>
                </div>
                <div className="p-3 rounded-xl bg-yellow-500/10 text-yellow-500">
                   <AlertTriangle className="w-6 h-6" />
                </div>
             </div>
             <p className="text-[10px] text-slate-500 mt-4 uppercase">Requieren revisión</p>
          </Card>
        </div>

        <Tabs defaultValue="errores" className="w-full">
          <TabsList className="bg-slate-900 border border-slate-800">
            <TabsTrigger value="errores"><AlertTriangle className="w-4 h-4 mr-2" /> Reportes #CIA</TabsTrigger>
            <TabsTrigger value="versiones"><GitBranch className="w-4 h-4 mr-2" /> Historial de Versiones</TabsTrigger>
          </TabsList>

          <TabsContent value="errores" className="mt-6 space-y-4">
            <div className="flex flex-col md:flex-row gap-4 bg-slate-900/50 p-4 rounded-lg border border-slate-800">
               <div className="relative flex-1">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                  <Input 
                    placeholder="Buscar regla #CIA..." 
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
                     <SelectItem value="all">Todos</SelectItem>
                     <SelectItem value="REPORTADA">Reportada</SelectItem>
                     <SelectItem value="VALIDADA">Validada (Activa)</SelectItem>
                     <SelectItem value="RECHAZADA">Rechazada (Inactiva)</SelectItem>
                  </SelectContent>
               </Select>
            </div>

            <Card className="bg-slate-900 border-slate-800 overflow-hidden">
               <Table>
                  <TableHeader>
                     <TableRow className="border-slate-800 bg-slate-950/30">
                        <TableHead className="text-slate-400">Fecha</TableHead>
                        <TableHead className="text-slate-400">Categoría</TableHead>
                        <TableHead className="text-slate-400">Regla #CIA</TableHead>
                        <TableHead className="text-slate-400">Estado</TableHead>
                        <TableHead className="text-right text-slate-400">Editar</TableHead>
                     </TableRow>
                  </TableHeader>
                  <TableBody>
                     {loading ? (
                        <TableRow>
                           <TableCell colSpan={5} className="text-center h-24"><Loader2 className="w-6 h-6 animate-spin mx-auto text-indigo-500" /></TableCell>
                        </TableRow>
                     ) : filteredErrors.length === 0 ? (
                        <TableRow>
                           <TableCell colSpan={5} className="text-center h-24 text-slate-500">No hay reportes que coincidan.</TableCell>
                        </TableRow>
                     ) : (
                        filteredErrors.map(err => (
                           <TableRow key={err.error_id} className="border-slate-800 hover:bg-slate-800/30">
                              <TableCell className="text-[10px] text-slate-500 font-mono">
                                 {new Date(err.reported_at).toLocaleDateString()}
                              </TableCell>
                              <TableCell>
                                 <Badge variant="outline" className="text-[10px] border-indigo-500/30 text-indigo-400">
                                    {err.categoria}
                                 </Badge>
                              </TableCell>
                              <TableCell className="max-w-md">
                                 <p className="text-xs text-slate-300 truncate font-mono">{err.correccion_sugerida}</p>
                              </TableCell>
                              <TableCell>
                                 <Badge className={
                                    err.estado_correccion === 'VALIDADA' ? 'bg-green-600' : 
                                    err.estado_correccion === 'RECHAZADA' ? 'bg-red-900/50 text-red-500' : 
                                    'bg-yellow-600/20 text-yellow-500 border border-yellow-500/20'
                                 }>
                                    {err.estado_correccion}
                                 </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                 <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:text-indigo-400" onClick={() => handleOpenEditDialog(err)}>
                                    <Edit className="w-4 h-4" />
                                 </Button>
                              </TableCell>
                           </TableRow>
                        ))
                     )}
                  </TableBody>
               </Table>
            </Card>
          </TabsContent>
          
          <TabsContent value="versiones">
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
                {versions.map(v => (
                   <Card key={v.version_id} className="bg-slate-900 border-slate-800 hover:border-indigo-500/50 transition-colors">
                      <CardHeader className="pb-2">
                         <div className="flex justify-between items-start">
                            <Badge className="bg-indigo-600">{v.version_numero}</Badge>
                            <span className="text-[10px] text-slate-500 font-mono">{new Date(v.created_at).toLocaleDateString()}</span>
                         </div>
                         <CardTitle className="text-sm text-white mt-2">Puntuación: {v.test_accuracy_nuevo}%</CardTitle>
                      </CardHeader>
                      <CardContent>
                         <p className="text-xs text-slate-400 line-clamp-3 italic">"{v.motivo_creacion || 'Sin descripción'}"</p>
                      </CardContent>
                   </Card>
                ))}
             </div>
          </TabsContent>
        </Tabs>

        {/* DIALOG DE EDICIÓN / CREACIÓN */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
           <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-lg">
              <DialogHeader>
                 <DialogTitle className="flex items-center gap-2">
                    {isCreating ? <Plus className="w-5 h-5 text-indigo-400" /> : <Zap className="w-5 h-5 text-yellow-500" />} 
                    {isCreating ? 'Añadir Nueva Instrucción' : (editMode ? 'Editar Regla #CIA' : 'Revisar Reporte')}
                 </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                 
                 {/* Mensajes de Contexto (Solo lectura, si no es creación) */}
                 {!isCreating && selectedError?.mensaje_cliente !== 'Creación Manual' && (
                    <div className="bg-slate-950/50 p-3 rounded border border-slate-800 space-y-3">
                       <div className="flex gap-2 items-start">
                          <span className="text-[10px] bg-slate-800 px-1 rounded text-slate-400">INPUT</span>
                          <p className="text-xs text-slate-300 italic">"{selectedError?.mensaje_cliente}"</p>
                       </div>
                       <div className="flex gap-2 items-start">
                          <span className="text-[10px] bg-red-900/30 px-1 rounded text-red-400">ERROR IA</span>
                          <p className="text-xs text-red-300/80 italic">"{selectedError?.respuesta_ia}"</p>
                       </div>
                    </div>
                 )}

                 {/* Formulario de Edición */}
                 <div className="space-y-3">
                    <div className="space-y-2">
                       <Label className="text-xs text-green-400">Instrucción Maestra (#CIA)</Label>
                       <Textarea 
                          value={editForm.correction}
                          onChange={e => setEditForm({...editForm, correction: e.target.value})}
                          disabled={!editMode}
                          className="bg-slate-950 border-slate-800 font-mono text-xs h-32 focus:border-green-500"
                          placeholder="Ej: Si el cliente pregunta por el taller Nivel 1, menciona siempre que incluye el cuenco de regalo."
                       />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                       <div className="space-y-2">
                          <Label className="text-xs text-slate-400">Categoría</Label>
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
                          <Label className="text-xs text-slate-400">Estado</Label>
                          <Select 
                             value={editForm.status} 
                             onValueChange={v => setEditForm({...editForm, status: v})}
                             disabled={!editMode}
                          >
                             <SelectTrigger className="h-8 text-xs bg-slate-950 border-slate-800"><SelectValue /></SelectTrigger>
                             <SelectContent className="bg-slate-900 border-slate-800 text-white">
                                <SelectItem value="REPORTADA">Reportada (Pendiente)</SelectItem>
                                <SelectItem value="VALIDADA">Validada (Activa)</SelectItem>
                                <SelectItem value="RECHAZADA">Rechazada (Inactiva)</SelectItem>
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
                          <Lock className="w-3 h-3 mr-2" /> Desbloquear Edición
                       </Button>
                       {editForm.status === 'REPORTADA' && (
                          <Button className="bg-green-600 hover:bg-green-700" onClick={() => { setEditForm({...editForm, status: 'VALIDADA'}); setEditMode(true); }}>
                             <CheckCircle2 className="w-4 h-4 mr-2" /> Aprobar Rápido
                          </Button>
                       )}
                    </>
                 ) : (
                    <>
                       <Button variant="ghost" onClick={() => { if (isCreating) setIsDialogOpen(false); else setEditMode(false); }}>Cancelar</Button>
                       <Button className="bg-indigo-600 hover:bg-indigo-700" onClick={handleSaveChanges} disabled={updating}>
                          {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                          {isCreating ? 'Guardar Regla' : 'Guardar Cambios'}
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