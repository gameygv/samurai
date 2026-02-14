import React, { useState } from 'react';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Brain, AlertTriangle, CheckCircle2, GitBranch, TrendingUp, Search, 
  FileText, Download, User, ArrowRight, Clock, XCircle, Eye
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { toast } from 'sonner';

// --- MOCK DATA FOR DEMO ---
const timelineData = [
  { date: '14/2', accuracy: 42, version: 'v1.0' },
  { date: '15/2', accuracy: 45, version: 'v1.0' },
  { date: '16/2', accuracy: 48, version: 'v1.1' },
  { date: '17/2', accuracy: 52, version: 'v2.0' },
  { date: '18/2', accuracy: 58, version: 'v2.0' },
  { date: '19/2', accuracy: 65, version: 'v2.1' },
  { date: '20/2', accuracy: 68, version: 'v2.1' },
];

const errorsMock = [
  { id: 'corr_001', category: 'TONO_INCORRECTO', severity: 'ALTA', reporter: 'Anahí', status: 'APLICADA', improvement: '+13.5%', version: 'v2.1', date: '14/02 04:10' },
  { id: 'corr_002', category: 'INFO_FALTANTE', severity: 'MEDIA', reporter: 'Edith', status: 'APLICADA', improvement: '+8.2%', version: 'v2.1', date: '15/02 09:30' },
  { id: 'corr_003', category: 'LOGICA_FALLA', severity: 'CRITICA', reporter: 'Anahí', status: 'PENDIENTE', improvement: '-', version: '-', date: '19/02 11:20' },
  { id: 'corr_004', category: 'TONO_INCORRECTO', severity: 'MEDIA', reporter: 'Edith', status: 'VALIDADA', improvement: '+12.1%', version: 'v2.0', date: '16/02 14:15' },
  { id: 'corr_005', category: 'ESTADO_MAL', severity: 'BAJA', reporter: 'Gamey', status: 'RECHAZADA', improvement: '-', version: '-', date: '18/02 16:45' },
];

const versionsMock = [
  { version: 'v2.1', prompt: 'Detección Estados', improvement: '+7.2%', accStart: '58%', accEnd: '65%', errors: 3, status: 'ACTIVO' },
  { version: 'v2.0', prompt: 'Flujo Ventas', improvement: '+10.1%', accStart: '48%', accEnd: '58%', errors: 5, status: 'ARCHIVO' },
  { version: 'v1.1', prompt: 'Estados', improvement: '+3.2%', accStart: '45%', accEnd: '48%', errors: 2, status: 'ARCHIVO' },
];

const LearningLog = () => {
  const [selectedError, setSelectedError] = useState<any>(null);

  const handleExport = (type: string) => {
    toast.success(`Reporte ${type} generado y enviado a tu correo.`);
  };

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
                v2.1 Activa
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
                     <span className="text-3xl font-bold text-white">78%</span>
                     <span className="text-sm text-slate-500 ml-2">18/23</span>
                  </div>
                  <TrendingUp className="w-8 h-8 text-green-500 opacity-50" />
               </div>
               <div className="mt-2 text-xs text-green-400 flex items-center gap-1">
                  <ArrowRight className="w-3 h-3" />
                  Mejora global +12.3%
               </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="pb-2">
               <CardTitle className="text-sm font-medium text-slate-400">Top Categorías</CardTitle>
            </CardHeader>
            <CardContent>
               <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                     <span className="text-slate-300">1. Tono Incorrecto</span>
                     <span className="text-slate-500">8 errores</span>
                  </div>
                  <div className="flex justify-between text-sm">
                     <span className="text-slate-300">2. Info Faltante</span>
                     <span className="text-slate-500">5 errores</span>
                  </div>
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
                  <div className="flex items-center justify-between">
                     <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-500 flex items-center justify-center text-xs">A</div>
                        <span className="text-sm text-slate-300">Anahí</span>
                     </div>
                     <span className="text-sm font-bold text-white">15</span>
                  </div>
                  <div className="flex items-center justify-between">
                     <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-pink-500/20 text-pink-500 flex items-center justify-center text-xs">E</div>
                        <span className="text-sm text-slate-300">Edith</span>
                     </div>
                     <span className="text-sm font-bold text-white">8</span>
                  </div>
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
                  <Input placeholder="Buscar por ID, mensaje o categoría..." className="pl-8 bg-slate-950 border-slate-800" />
               </div>
               <Select defaultValue="all">
                  <SelectTrigger className="w-[180px] bg-slate-950 border-slate-800">
                     <SelectValue placeholder="Estado" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-white">
                     <SelectItem value="all">Todos los Estados</SelectItem>
                     <SelectItem value="aplicada">Aplicada</SelectItem>
                     <SelectItem value="pendiente">Pendiente</SelectItem>
                  </SelectContent>
               </Select>
               <Select defaultValue="all">
                  <SelectTrigger className="w-[180px] bg-slate-950 border-slate-800">
                     <SelectValue placeholder="Severidad" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-white">
                     <SelectItem value="all">Todas</SelectItem>
                     <SelectItem value="critica">Crítica</SelectItem>
                     <SelectItem value="alta">Alta</SelectItem>
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
                        {errorsMock.map((err) => (
                           <TableRow key={err.id} className="border-slate-800 hover:bg-slate-800/50">
                              <TableCell className="font-mono text-xs text-slate-500">{err.id}</TableCell>
                              <TableCell className="text-slate-300 font-medium">{err.category}</TableCell>
                              <TableCell>
                                 <Badge variant="outline" className={`
                                    ${err.severity === 'CRITICA' ? 'border-red-500 text-red-500 bg-red-500/10' :
                                      err.severity === 'ALTA' ? 'border-orange-500 text-orange-500 bg-orange-500/10' :
                                      err.severity === 'MEDIA' ? 'border-yellow-500 text-yellow-500 bg-yellow-500/10' :
                                      'border-blue-500 text-blue-500 bg-blue-500/10'}
                                 `}>
                                    {err.severity}
                                 </Badge>
                              </TableCell>
                              <TableCell className="text-slate-400 text-sm">
                                 <div className="flex items-center gap-2">
                                    <User className="w-3 h-3" /> {err.reporter}
                                 </div>
                              </TableCell>
                              <TableCell>
                                 {err.status === 'APLICADA' && <Badge className="bg-green-600">Aplicada</Badge>}
                                 {err.status === 'VALIDADA' && <Badge className="bg-emerald-600">Validada</Badge>}
                                 {err.status === 'PENDIENTE' && <Badge variant="secondary">Pendiente</Badge>}
                                 {err.status === 'RECHAZADA' && <Badge variant="destructive">Rechazada</Badge>}
                              </TableCell>
                              <TableCell className="text-green-400 font-mono text-xs">{err.improvement}</TableCell>
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
                                             Detalle #CORREGIRIA: {err.id}
                                          </DialogTitle>
                                          <DialogDescription className="text-slate-400">
                                             Reportado por {err.reporter} el {err.date}
                                          </DialogDescription>
                                       </DialogHeader>
                                       
                                       <div className="grid grid-cols-2 gap-6 py-4">
                                          <div className="col-span-2 space-y-2">
                                             <h4 className="text-xs font-semibold text-slate-500 uppercase">Contexto del Error</h4>
                                             <div className="bg-slate-950 p-4 rounded border border-slate-800 space-y-3">
                                                <div>
                                                   <span className="text-xs text-red-400 block mb-1">Respuesta IA (Incorrecta):</span>
                                                   <p className="text-sm text-slate-300 italic">"Es que el precio es el que es, no hay descuento."</p>
                                                </div>
                                                <div className="h-px bg-slate-800 w-full"></div>
                                                <div>
                                                   <span className="text-xs text-green-400 block mb-1">Corrección Propuesta:</span>
                                                   <p className="text-sm text-slate-300">"Entiendo la inversión. ¿Puedo ofrecerte opciones de cuotas para hacerlo más accesible?"</p>
                                                </div>
                                             </div>
                                          </div>

                                          <div className="space-y-2">
                                             <h4 className="text-xs font-semibold text-slate-500 uppercase">Análisis</h4>
                                             <div className="space-y-1 text-sm">
                                                <div className="flex justify-between border-b border-slate-800 pb-1">
                                                   <span className="text-slate-400">Categoría:</span>
                                                   <span className="text-white">{err.category}</span>
                                                </div>
                                                <div className="flex justify-between border-b border-slate-800 pb-1 pt-1">
                                                   <span className="text-slate-400">Severidad:</span>
                                                   <span className="text-white">{err.severity}</span>
                                                </div>
                                                <div className="flex justify-between pt-1">
                                                   <span className="text-slate-400">Versión:</span>
                                                   <span className="text-indigo-400 font-mono">{err.version}</span>
                                                </div>
                                             </div>
                                          </div>

                                          <div className="space-y-2">
                                             <h4 className="text-xs font-semibold text-slate-500 uppercase">Impacto</h4>
                                             <div className="space-y-1 text-sm">
                                                <div className="flex justify-between border-b border-slate-800 pb-1">
                                                   <span className="text-slate-400">Mejora:</span>
                                                   <span className="text-green-400 font-bold">{err.improvement}</span>
                                                </div>
                                                <div className="flex justify-between border-b border-slate-800 pb-1 pt-1">
                                                   <span className="text-slate-400">Estado:</span>
                                                   <span className="text-white">{err.status}</span>
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
                           <TableHead className="text-slate-400 text-right">Estado</TableHead>
                        </TableRow>
                     </TableHeader>
                     <TableBody>
                        {versionsMock.map((v) => (
                           <TableRow key={v.version} className="border-slate-800 hover:bg-slate-800/50">
                              <TableCell className="font-mono text-indigo-400 font-bold">{v.version}</TableCell>
                              <TableCell className="text-slate-300">{v.prompt}</TableCell>
                              <TableCell className="text-green-400 font-bold">{v.improvement}</TableCell>
                              <TableCell className="text-slate-400 text-xs">
                                 {v.accStart} <ArrowRight className="w-3 h-3 inline mx-1" /> <span className="text-white">{v.accEnd}</span>
                              </TableCell>
                              <TableCell className="text-slate-300 text-center">{v.errors}</TableCell>
                              <TableCell className="text-right">
                                 {v.status === 'ACTIVO' ? (
                                    <Badge className="bg-green-600">Activo</Badge>
                                 ) : (
                                    <Badge variant="secondary" className="text-slate-500">Archivo</Badge>
                                 )}
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
                        <YAxis stroke="#64748b" tick={{ fill: '#64748b' }} domain={[30, 80]} />
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