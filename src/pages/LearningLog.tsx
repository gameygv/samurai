import React, { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Brain, AlertTriangle, GitBranch, TrendingUp, Search, 
  FileText, Download, User, ArrowRight, Eye, Loader2
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { toast } from 'sonner';
import { logActivity } from '@/utils/logger';

const LearningLog = () => {
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [errors, setErrors] = useState<any[]>([]);
  const [versions, setVersions] = useState<any[]>([]);
  const [timelineData, setTimelineData] = useState<any[]>([]);
  const [selectedError, setSelectedError] = useState<any>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');

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

      if (versionsData) {
        const sortedVersions = [...versionsData].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        setTimelineData(sortedVersions.map(v => ({
          date: new Date(v.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'numeric' }),
          accuracy: v.test_accuracy_nuevo,
          version: v.version_numero
        })));
      }
    } catch (error) {
      toast.error('Error cargando datos');
    } finally {
      setLoading(false);
    }
  };

  const updateErrorStatus = async (status: string) => {
    if (!selectedError) return;
    setUpdating(true);
    try {
      const { error } = await supabase
        .from('errores_ia')
        .update({ estado_correccion: status, applied_at: status === 'VALIDADA' ? new Date().toISOString() : null })
        .eq('error_id', selectedError.error_id);

      if (error) throw error;

      await logActivity({
        action: 'UPDATE',
        resource: 'BRAIN',
        description: `Error IA ${selectedError.error_id.substring(0,8)} marcado como ${status}`,
        status: 'OK'
      });

      toast.success(`Estado actualizado a ${status}`);
      setIsDialogOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUpdating(false);
    }
  };

  const filteredErrors = errors.filter(err => {
    const matchesSearch = err.mensaje_cliente?.toLowerCase().includes(searchTerm.toLowerCase()) || err.categoria?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || err.estado_correccion?.toLowerCase() === statusFilter.toLowerCase();
    const matchesSeverity = severityFilter === 'all' || err.severidad?.toLowerCase() === severityFilter.toLowerCase();
    return matchesSearch && matchesStatus && matchesSeverity;
  });

  // Stats
  const appliedPercentage = errors.length > 0 ? Math.round((errors.filter(e => e.estado_correccion === 'VALIDADA').length / errors.length) * 100) : 0;

  if (loading) return <Layout><div className="flex h-[80vh] items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div></Layout>;

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-6 pb-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-2"><Brain className="w-8 h-8 text-indigo-500" /> Bitácora de Aprendizaje Real</h1>
            <p className="text-slate-400">Tracking y validación de mejoras del Samurai.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-slate-900 border-slate-800 p-6">
             <p className="text-sm font-medium text-slate-400">Eficiencia de Aprendizaje</p>
             <h3 className="text-3xl font-bold text-white mt-1">{appliedPercentage}% <span className="text-sm text-slate-500">Validados</span></h3>
             <div className="w-full bg-slate-800 h-1.5 rounded-full mt-4"><div className="bg-indigo-500 h-1.5 rounded-full" style={{ width: `${appliedPercentage}%` }}></div></div>
          </Card>
        </div>

        <Tabs defaultValue="corregiria" className="w-full">
          <TabsList className="bg-slate-900 border border-slate-800">
            <TabsTrigger value="corregiria"><AlertTriangle className="w-4 h-4 mr-2" /> #CORREGIRIA</TabsTrigger>
            <TabsTrigger value="versiones"><GitBranch className="w-4 h-4 mr-2" /> Versiones</TabsTrigger>
          </TabsList>

          <TabsContent value="corregiria" className="mt-6 space-y-4">
            <div className="flex flex-col md:flex-row gap-4 bg-slate-900 p-4 rounded-lg border border-slate-800">
               <Input placeholder="Buscar..." className="bg-slate-950 border-slate-800" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
               <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[180px] bg-slate-950 border-slate-800"><SelectValue placeholder="Estado" /></SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-white">
                     <SelectItem value="all">Todos</SelectItem>
                     <SelectItem value="REPORTADA">Reportada</SelectItem>
                     <SelectItem value="PENDIENTE">Pendiente</SelectItem>
                     <SelectItem value="VALIDADA">Validada</SelectItem>
                  </SelectContent>
               </Select>
            </div>

            <Card className="bg-slate-900 border-slate-800 overflow-hidden">
               <Table>
                  <TableHeader>
                     <TableRow className="border-slate-800">
                        <TableHead>Categoría</TableHead>
                        <TableHead>Severidad</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                     </TableRow>
                  </TableHeader>
                  <TableBody>
                     {filteredErrors.map(err => (
                        <TableRow key={err.error_id} className="border-slate-800">
                           <TableCell className="text-slate-300 font-medium">{err.categoria}</TableCell>
                           <TableCell><Badge variant="outline" className={err.severidad === 'CRITICA' ? 'text-red-500' : 'text-yellow-500'}>{err.severidad}</Badge></TableCell>
                           <TableCell><Badge className={err.estado_correccion === 'VALIDADA' ? 'bg-green-600' : 'bg-slate-700'}>{err.estado_correccion}</Badge></TableCell>
                           <TableCell className="text-right">
                              <Button variant="ghost" size="sm" onClick={() => { setSelectedError(err); setIsDialogOpen(true); }}>
                                 <Eye className="w-4 h-4" />
                              </Button>
                           </TableCell>
                        </TableRow>
                     ))}
                  </TableBody>
               </Table>
            </Card>
          </TabsContent>
        </Tabs>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
           <DialogContent className="bg-slate-900 border-slate-800 text-white">
              <DialogHeader><DialogTitle>Gestionar Error IA</DialogTitle></DialogHeader>
              <div className="space-y-4 py-4">
                 <div className="bg-slate-950 p-3 rounded border border-slate-800">
                    <p className="text-xs text-red-400">Respuesta IA:</p>
                    <p className="text-sm italic">"{selectedError?.respuesta_ia}"</p>
                 </div>
                 <div className="bg-slate-950 p-3 rounded border border-slate-800">
                    <p className="text-xs text-green-400">Corrección Sugerida:</p>
                    <p className="text-sm font-medium">"{selectedError?.correccion_sugerida}"</p>
                 </div>
              </div>
              <DialogFooter>
                 <Button variant="outline" className="border-slate-700" onClick={() => updateErrorStatus('RECHAZADA')} disabled={updating}>Rechazar</Button>
                 <Button className="bg-indigo-600" onClick={() => updateErrorStatus('VALIDADA')} disabled={updating}>Validar Mejora</Button>
              </DialogFooter>
           </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default LearningLog;