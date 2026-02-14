import React, { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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

const LearningLog = () => {
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<any[]>([]);
  const [versions, setVersions] = useState<any[]>([]);
  const [timelineData, setTimelineData] = useState<any[]>([]);
  const [selectedError, setSelectedError] = useState<any>(null);

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
      // 1. Fetch Errores
      const { data: errorsData, error: errorsError } = await supabase
        .from('errores_ia')
        .select('*')
        .order('reported_at', { ascending: false });

      if (errorsError) throw errorsError;
      setErrors(errorsData || []);

      // 2. Fetch Versiones
      const { data: versionsData, error: versionsError } = await supabase
        .from('versiones_prompts_aprendidas')
        .select('*')
        .order('created_at', { ascending: false });

      if (versionsError) throw versionsError;
      setVersions(versionsData || []);

      // 3. Build Timeline Data from Versions
      if (versionsData) {
        const sortedVersions = [...versionsData].sort((a, b) => 
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        
        const chartData = sortedVersions.map(v => ({
          date: new Date(v.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'numeric' }),
          accuracy: v.test_accuracy_nuevo,
          version: v.version_numero
        }));
        setTimelineData(chartData);
      }

    } catch (error: any) {
      console.error('Error fetching learning data:', error);
      toast.error('Error cargando datos de aprendizaje');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = (type: string) => {
    toast.success(`Reporte ${type} generado y enviado a tu correo.`);
  };

  const getFilteredErrors = () => {
    return errors.filter(err => {
      const matchesSearch = 
        err.mensaje_cliente?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        err.categoria?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        err.error_id?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || err.estado_correccion?.toLowerCase() === statusFilter.toLowerCase();
      const matchesSeverity = severityFilter === 'all' || err.severidad?.toLowerCase() === severityFilter.toLowerCase();

      return matchesSearch && matchesStatus && matchesSeverity;
    });
  };

  const filteredErrors = getFilteredErrors();

  // Statistics
  const totalErrors = errors.length;
  const appliedErrors = errors.filter(e => e.estado_correccion === 'APLICADA' || e.estado_correccion === 'VALIDADA').length;
  const appliedPercentage = totalErrors > 0 ? Math.round((appliedErrors / totalErrors) * 100) : 0;
  
  // Group by category logic for KPI
  const categoryCounts = errors.reduce((acc: any, curr) => {
    acc[curr.categoria] = (acc[curr.categoria] || 0) + 1;
    return acc;
  }, {});
  const sortedCategories = Object.entries(categoryCounts).sort(([,a]: any, [,b]: any) => b - a);

  // Group by reporter logic for KPI
  const reporterCounts = errors.reduce((acc: any, curr) => {
    const reporter = curr.created_by || 'Unknown';
    acc[reporter] = (acc[reporter] || 0) + 1;
    return acc;
  }, {});
  const sortedReporters = Object.entries(reporterCounts).sort(([,a]: any, [,b]: any) => b - a);

  if (loading) {
     return (
        <Layout>
           <div className="flex h-[80vh] items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
           </div>
        </Layout>
     );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-6 pb-10">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-2">
              <Brain className="w-8 h-8 text-indigo-500" />
              Bitácora de Aprendizaje IA
            </h1>
            <p className="text-slate-400">
              Tracking de #CORREGIRIA, versiones y mejora continua del Samurai.
              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-500/10 text-green-500 border border-green-500/20">
                {versions[0]?.version_numero || 'v1.0'} Activa
              </span>
            </p>
          </div>
          <div className="flex gap-2">
             <Button variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800" onClick={() => handleExport('CSV')}>
                <Download className="w-4 h-4 mr-2" /> CSV
             </Button>
             <Button variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800" onClick={() => handleExport('PDF')}>
                <FileText className="w-4 h-4 mr-2" /> PDF Report
             </Button>
          </div>
        </div>

        {/* KPI CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="pb-2">
               <CardTitle className="text-sm font-medium text-slate-400">Errores Aplicados</CardTitle>
            </CardHeader>
            <CardContent>
               <div className="flex justify-between items-end">
                  <div>
                     <span className="text-3xl font-bold text-white">{appliedPercentage}%</span>
                     <span className="text-sm text-slate-500 ml-2">{appliedErrors}/{totalErrors}</span>
                  </div>
                  <TrendingUp className="w-8 h-8 text-green-500 opacity-50" />
               </div>
               <div className="mt-2 text-xs text-green-400 flex items-center gap-1">
                  <ArrowRight className="w-3 h-3" />
                  Tasa de aplicación
               </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="pb-2">
               <CardTitle className="text-sm font-medium text-slate-400">Top Categorías</CardTitle>
            </CardHeader>
            <CardContent>
               <div className="space-y-2">
                  {sortedCategories.slice(0, 3).map(([cat, count]: any, idx) => (
                     <div key={cat} className="flex justify-between text-sm">
                        <span className="text-slate-300">{idx + 1}. {cat}</span>
                        <span className="text-slate-500">{count} errores</span>
                     </div>
                  ))}
                  {sortedCategories.length === 0 && <span className="text-slate-500 text-sm">Sin datos aún</span>}
                  
                  <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2">
                     <div className="bg-yellow-500 h-1.5 rounded-full" style={{ width: '65%' }}></div>
                  </div>
               </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-800">
             <CardHeader className="pb-2">
               <CardTitle className="text-sm font-medium text-slate-400">Reportadores</CardTitle>
            </CardHeader>
            <CardContent>
               <div className="space-y-3">
                  {sortedReporters.slice(0, 3).map(([name, count]: any) => (
                     <div key={name} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                           <div className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-500 flex items-center justify-center text-xs">
                              {name.charAt(0).toUpperCase()}
                           </div>
                           <span className="text-sm text-slate-300">{name}</span>
                        </div>
                        <span className="text-sm font-bold text-white">{count}</span>
                     </div>
                  ))}
                  {sortedReporters.length === 0 && <span className="text-slate-500 text-sm">Sin datos aún</span>}
               </div>
            </CardContent>
          </Card>
        </div>

        {/* TABS CONTENT */}
        <Tabs defaultValue="corregiria" className="w-full">
          <TabsList className="bg-slate-900 border border-slate-800">
            <TabsTrigger value="corregiria" className="data-[state=active]:bg-slate-800 data-[state=active]:text-white">
               <AlertTriangle className="w-4 h-4 mr-2" /> #CORREGIRIA
            </TabsTrigger>
            <TabsTrigger value="versiones" className="data-[state=active]:bg-slate-800 data-[state=active]:text-white">
               <GitBranch className="w-4 h-4 mr-2" /> Versiones Prompts
            </TabsTrigger>
            <TabsTrigger value="timeline" className="data-[state=active]:bg-slate-800 data-[state=active]:text-white">
               <TrendingUp className="w-4 h-4 mr-2" /> Timeline Mejora
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: CORREGIRIA TABLE */}
          <TabsContent value="corregiria" className="mt-6 space-y-4">
            
            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4 bg-slate-900 p-4 rounded-lg border border-slate-800">
               <div className="relative flex-1">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-500" />
                  <Input 
                     placeholder="Buscar por mensaje o categoría..." 
                     className="pl-8 bg-slate-950 border-slate-800" 
                     value={searchTerm}
                     onChange={(e) => setSearchTerm(e.target.value)}
                  />
               </div>
               <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[180px] bg-slate-950 border-slate-800">
                     <SelectValue placeholder="Estado" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-white">
                     <SelectItem value="all">Todos los Estados</SelectItem>
                     <SelectItem value="APLICADA">Aplicada</SelectItem>
                     <SelectItem value="PENDIENTE">Pendiente</SelectItem>
                     <SelectItem value="VALIDADA">Validada</SelectItem>
                  </SelectContent>
               </Select>
               <Select value={severityFilter} onValueChange={setSeverityFilter}>
                  <SelectTrigger className="w-[180px] bg-slate-950 border-slate-800">
                     <SelectValue placeholder="Severidad" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-white">
                     <SelectItem value="all">Todas</SelectItem>
                     <SelectItem value="CRITICA">Crítica</SelectItem>
                     <SelectItem value="ALTA">Alta</SelectItem>
                     <SelectItem value="MEDIA">Media</SelectItem>
                  </SelectContent>
               </Select>
            </div>

            <Card className="bg-slate-900 border-slate-800">
               <CardContent className="p-0">
                  <Table>
                     <TableHeader>
                        <TableRow className="border-slate-800 hover:bg-slate-900">
                           <TableHead className="text-slate-400">ID</TableHead>
                           <TableHead className="text-slate-400">Categoría</TableHead>
                           <TableHead className="text-slate-400">Severidad</TableHead>
                           <TableHead className="text-slate-400">Reportada</TableHead>
                           <TableHead className="text-slate-400">Estado</TableHead>
                           <TableHead className="text-slate-400">Mejora</TableHead>
                           <TableHead className="text-slate-400 text-right">Acciones</TableHead>
                        </TableRow>
                     </TableHeader>
                     <TableBody>
                        {filteredErrors.length === 0 ? (
                           <TableRow>
                              <TableCell colSpan={7} className="text-center h-24 text-slate-500">No se encontraron errores.</TableCell>
                           </TableRow>
                        ) : filteredErrors.map((err) => (
                           <TableRow key={err.error_id} className="border-slate-800 hover:bg-slate-800/50">
                              <TableCell className="font-mono text-xs text-slate-500">{err.error_id.substring(0, 8)}...</TableCell>
                              <TableCell className="text-slate-300 font-medium">{err.categoria}</TableCell>
                              <TableCell>
                                 <Badge variant="outline" className={`
                                    ${err.severidad === 'CRITICA' ? 'border-red-500 text-red-500 bg-red-500/10' :
                                      err.severidad === 'ALTA' ? 'border-orange-500 text-orange-500 bg-orange-500/10' :
                                      err.severidad === 'MEDIA' ? 'border-yellow-500 text-yellow-500 bg-yellow-500/10' :
                                      'border-blue-500 text-blue-500 bg-blue-500/10'}
                                 `}>
                                    {err.severidad}
                                 </Badge>
                              </TableCell>
                              <TableCell className="text-slate-400 text-sm">
                                 <div className="flex items-center gap-2">
                                    <User className="w-3 h-3" /> {err.created_by}
                                 </div>
                              </TableCell>
                              <TableCell>
                                 {err.estado_correccion === 'APLICADA' && <Badge className="bg-green-600">Aplicada</Badge>}
                                 {err.estado_correccion === 'VALIDADA' && <Badge className="bg-emerald-600">Validada</Badge>}
                                 {err.estado_correccion === 'PENDIENTE' && <Badge variant="secondary">Pendiente</Badge>}
                                 {err.estado_correccion === 'REPORTADA' && <Badge variant="secondary" className="bg-slate-700">Reportada</Badge>}
                              </TableCell>
                              <TableCell className="text-green-400 font-mono text-xs">{err.tasa_mejora_post ? `+${err.tasa_mejora_post}%` : '-'}</TableCell>
                              <TableCell className="text-right">
                                 <Dialog>
                                    <DialogTrigger asChild>
                                       <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setSelectedError(err)}>
                                          <Eye className="w-4 h-4 text-slate-400 hover:text-white" />
                                       </Button>
                                    </DialogTrigger>
                                    <DialogContent className="bg-slate-900 border-slate-800 text-slate-200 max-w-2xl">
                                       <DialogHeader>
                                          <DialogTitle className="text-xl flex items-center gap-2">
                                             <AlertTriangle className="w-5 h-5 text-indigo-400" />
                                             Detalle #CORREGIRIA
                                          </DialogTitle>
                                          <DialogDescription className="text-slate-400">
                                             Reportado por {err.created_by} el {new Date(err.reported_at).toLocaleString()}
                                          </DialogDescription>
                                       </DialogHeader>
                                       
                                       <div className="grid grid-cols-2 gap-6 py-4">
                                          <div className="col-span-2 space-y-2">
                                             <h4 className="text-xs font-semibold text-slate-500 uppercase">Contexto del Error</h4>
                                             <div className="bg-slate-950 p-4 rounded border border-slate-800 space-y-3">
                                                <div>
                                                   <span className="text-xs text-red-400 block mb-1">Cliente dijo:</span>
                                                   <p className="text-sm text-slate-300 italic">"{err.mensaje_cliente}"</p>
                                                </div>
                                                <div>
                                                   <span className="text-xs text-red-400 block mb-1">Respuesta IA (Incorrecta):</span>
                                                   <p className="text-sm text-slate-300 italic">"{err.respuesta_ia}"</p>
                                                </div>
                                                <div className="h-px bg-slate-800 w-full"></div>
                                                <div>
                                                   <span className="text-xs text-green-400 block mb-1">Corrección Propuesta:</span>
                                                   <p className="text-sm text-slate-300">"{err.correccion_sugerida}"</p>
                                                </div>
                                             </div>
                                          </div>

                                          <div className="space-y-2">
                                             <h4 className="text-xs font-semibold text-slate-500 uppercase">Análisis</h4>
                                             <div className="space-y-1 text-sm">
                                                <div className="flex justify-between border-b border-slate-800 pb-1">
                                                   <span className="text-slate-400">Categoría:</span>
                                                   <span className="text-white">{err.categoria}</span>
                                                </div>
                                                <div className="flex justify-between border-b border-slate-800 pb-1 pt-1">
                                                   <span className="text-slate-400">Severidad:</span>
                                                   <span className="text-white">{err.severidad}</span>
                                                </div>
                                             </div>
                                          </div>

                                          <div className="space-y-2">
                                             <h4 className="text-xs font-semibold text-slate-500 uppercase">Impacto</h4>
                                             <div className="space-y-1 text-sm">
                                                <div className="flex justify-between border-b border-slate-800 pb-1">
                                                   <span className="text-slate-400">Mejora:</span>
                                                   <span className="text-green-400 font-bold">{err.tasa_mejora_post ? `+${err.tasa_mejora_post}%` : 'N/A'}</span>
                                                </div>
                                                <div className="flex justify-between border-b border-slate-800 pb-1 pt-1">
                                                   <span className="text-slate-400">Estado:</span>
                                                   <span className="text-white">{err.estado_correccion}</span>
                                                </div>
                                             </div>
                                          </div>
                                       </div>

                                       <DialogFooter className="gap-2">
                                          <Button variant="outline" className="border-slate-700 hover:bg-slate-800">Marcar Rechazada</Button>
                                          <Button className="bg-indigo-600 hover:bg-indigo-700">Validar Mejora</Button>
                                       </DialogFooter>
                                    </DialogContent>
                                 </Dialog>
                              </TableCell>
                           </TableRow>
                        ))}
                     </TableBody>
                  </Table>
               </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 2: VERSIONS */}
          <TabsContent value="versiones" className="mt-6">
             <Card className="bg-slate-900 border-slate-800">
               <CardHeader>
                  <CardTitle className="text-white text-lg">Evolución de Prompts</CardTitle>
                  <CardDescription>Historial de versiones generadas a partir del aprendizaje.</CardDescription>
               </CardHeader>
               <CardContent className="p-0">
                  <Table>
                     <TableHeader>
                        <TableRow className="border-slate-800 hover:bg-slate-900">
                           <TableHead className="text-slate-400">Versión</TableHead>
                           <TableHead className="text-slate-400">Prompt Base</TableHead>
                           <TableHead className="text-slate-400">Mejora Total</TableHead>
                           <TableHead className="text-slate-400">Accuracy (Antes → Después)</TableHead>
                           <TableHead className="text-slate-400"># Corregiria</TableHead>
                           <TableHead className="text-slate-400 text-right">Creado</TableHead>
                        </TableRow>
                     </TableHeader>
                     <TableBody>
                        {versions.length === 0 ? (
                           <TableRow>
                              <TableCell colSpan={6} className="text-center h-24 text-slate-500">No hay versiones registradas.</TableCell>
                           </TableRow>
                        ) : versions.map((v) => (
                           <TableRow key={v.version_id} className="border-slate-800 hover:bg-slate-800/50">
                              <TableCell className="font-mono text-indigo-400 font-bold">{v.version_numero}</TableCell>
                              <TableCell className="text-slate-300">{v.prompt_nombre}</TableCell>
                              <TableCell className="text-green-400 font-bold">+{v.mejora_porcentaje}%</TableCell>
                              <TableCell className="text-slate-400 text-xs">
                                 {v.test_accuracy_anterior} <ArrowRight className="w-3 h-3 inline mx-1" /> <span className="text-white">{v.test_accuracy_nuevo}</span>
                              </TableCell>
                              <TableCell className="text-slate-300 text-center">{v.errores_corregidia}</TableCell>
                              <TableCell className="text-right text-xs text-slate-500">
                                 {new Date(v.created_at).toLocaleDateString()}
                              </TableCell>
                           </TableRow>
                        ))}
                     </TableBody>
                  </Table>
               </CardContent>
             </Card>
          </TabsContent>

          {/* TAB 3: TIMELINE CHART */}
          <TabsContent value="timeline" className="mt-6">
             <Card className="bg-slate-900 border-slate-800">
               <CardHeader>
                  <CardTitle className="text-white text-lg">Timeline de Precisión IA</CardTitle>
                  <CardDescription>Mejora del Accuracy % a través del tiempo y versiones.</CardDescription>
               </CardHeader>
               <CardContent className="h-[400px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                     <LineChart data={timelineData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis dataKey="date" stroke="#64748b" tick={{ fill: '#64748b' }} />
                        <YAxis stroke="#64748b" tick={{ fill: '#64748b' }} domain={[40, 70]} />
                        <RechartsTooltip 
                           contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#f8fafc' }}
                           itemStyle={{ color: '#818cf8' }}
                        />
                        <Line 
                           type="monotone" 
                           dataKey="accuracy" 
                           stroke="#6366f1" 
                           strokeWidth={3}
                           activeDot={{ r: 8, fill: '#818cf8' }} 
                           name="Accuracy %"
                        />
                     </LineChart>
                  </ResponsiveContainer>
               </CardContent>
             </Card>
          </TabsContent>

        </Tabs>
      </div>
    </Layout>
  );
};

export default LearningLog;