import React, { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Users as UsersIcon, UserPlus, Loader2, RefreshCw, Shield, Trash2, 
  Edit3, Save, Phone, MapPin, Activity, AlertTriangle, TrendingUp, Target,
  Brain, ShieldAlert, Award, MessageSquare
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { logActivity } from '@/utils/logger';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';

const UsersPage = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [evaluations, setEvaluations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [createForm, setCreateForm] = useState({ 
    email: '', password: '', fullName: '', phone: '', territories: '', role: 'agent' 
  });
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    const { data: uData } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    if (uData) setUsers(uData);

    const { data: eData } = await supabase.from('agent_evaluations')
       .select('*, profiles!agent_evaluations_agent_id_fkey(full_name, role)')
       .order('created_at', { ascending: false })
       .limit(200);
    
    if (eData) setEvaluations(eData);
    setLoading(false);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-create-user', {
        body: { 
          email: createForm.email, 
          password: createForm.password, 
          fullName: createForm.fullName,
          role: createForm.role
        }
      });
      if (error || !data.success) throw new Error(data?.error || "Error al crear");
      
      const territoriesArray = createForm.territories.split(',').map(s => s.trim()).filter(Boolean);
      await supabase.from('profiles').update({ phone: createForm.phone, territories: territoriesArray }).eq('id', data.user.id);

      await logActivity({ action: 'CREATE', resource: 'USERS', description: `Nuevo usuario creado: ${createForm.email} con rol ${createForm.role}`, status: 'OK' });
      toast.success("Usuario activado instantáneamente.");
      fetchAll();
      setIsCreateOpen(false);
      setCreateForm({ email: '', password: '', fullName: '', phone: '', territories: '', role: 'agent' });
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setCreating(false);
    }
  };

  const handleUpdateUser = async () => {
     if (!selectedUser) return;
     setUpdating(true);
     try {
        const territoriesArray = typeof selectedUser.territories === 'string' 
            ? selectedUser.territories.split(',').map((s: string) => s.trim()).filter(Boolean) 
            : selectedUser.territories;

        const { error } = await supabase.from('profiles').update({ 
           role: selectedUser.role, 
           full_name: selectedUser.full_name,
           phone: selectedUser.phone, 
           territories: territoriesArray
        }).eq('id', selectedUser.id);
        
        if (error) throw error;
        await logActivity({ action: 'UPDATE', resource: 'USERS', description: `Permisos actualizados para: ${selectedUser.username || selectedUser.full_name}`, status: 'OK' });
        toast.success("Perfil de usuario actualizado");
        setIsEditOpen(false);
        fetchAll();
     } catch (err: any) {
        toast.error(err.message);
     } finally {
        setUpdating(false);
     }
  };

  const handleDeleteUser = async (id: string, name: string) => {
     if (id === currentUser?.id) { toast.error("Error de seguridad: No puedes eliminarte a ti mismo."); return; }
     if (!confirm(`¿ESTÁS SEGURO? Esto eliminará a ${name} permanentemente del sistema.`)) return;
     const tid = toast.loading("Eliminando usuario...");
     try {
        const { error } = await supabase.functions.invoke('manage-auth-users', { body: { action: 'DELETE', userId: id } });
        if (error) throw error;
        await logActivity({ action: 'DELETE', resource: 'USERS', description: `Usuario eliminado: ${name}`, status: 'OK' });
        toast.success("Usuario borrado definitivamente", { id: tid });
        fetchAll();
        setIsEditOpen(false);
     } catch (err: any) {
        toast.error(err.message, { id: tid });
     }
  };

  const getAgentStats = () => {
     const stats: any = {};
     evaluations.forEach(ev => {
         const agentId = ev.agent_id;
         const name = ev.profiles?.full_name || 'Desconocido';
         if (!stats[agentId]) stats[agentId] = { id: agentId, name, role: ev.profiles?.role, messages: 0, totalScore: 0, anomalies: 0 };
         
         stats[agentId].messages += 1;
         stats[agentId].totalScore += ev.score || 0;
         if (ev.anomaly_detected) stats[agentId].anomalies += 1;
     });

     return Object.values(stats).map((s: any) => ({
         ...s,
         avgScore: Math.round(s.totalScore / s.messages)
     })).sort((a: any, b: any) => b.avgScore - a.avgScore);
  };

  const agentLeaderboard = getAgentStats();
  const criticalAnomalies = evaluations.filter(e => e.anomaly_detected);

  return (
    <Layout>
      <div className="max-w-[1600px] mx-auto space-y-6 pb-12 animate-in fade-in duration-500">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
             <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
               <div className="p-2 bg-indigo-900/30 rounded-xl border border-indigo-500/20">
                 <UsersIcon className="w-6 h-6 text-indigo-400" />
               </div>
               Gestión y Rendimiento de Equipo
             </h1>
             <p className="text-slate-400">Control de acceso, territorios y auditoría de calidad (QA) con IA.</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={fetchAll} disabled={loading} className="bg-[#121214] border-[#222225] text-slate-400 hover:text-white h-11 px-4 rounded-xl text-[10px] uppercase font-bold tracking-widest shadow-sm">
               <RefreshCw className={cn("w-4 h-4 mr-2", loading && "animate-spin")} /> Refrescar
            </Button>
            <Button onClick={() => setIsCreateOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg h-11 px-6 rounded-xl text-[10px] uppercase font-bold tracking-widest transition-all">
               <UserPlus className="w-4 h-4 mr-2" /> Nuevo Agente
            </Button>
          </div>
        </div>

        <Tabs defaultValue="directorio" className="w-full">
           <TabsList className="bg-[#121214] border border-[#222225] p-1 rounded-xl h-auto flex-wrap">
              <TabsTrigger value="directorio" className="gap-2 px-6 py-2.5 text-xs data-[state=active]:bg-indigo-600 data-[state=active]:text-white font-bold uppercase tracking-widest"><Shield className="w-4 h-4" /> Directorio y Accesos</TabsTrigger>
              <TabsTrigger value="qa" className="gap-2 px-6 py-2.5 text-xs data-[state=active]:bg-emerald-600 data-[state=active]:text-white font-bold uppercase tracking-widest"><Activity className="w-4 h-4" /> Auditoría QA (IA)</TabsTrigger>
           </TabsList>

           <TabsContent value="directorio" className="mt-6">
              <Card className="bg-[#0f0f11] border-[#222225] shadow-2xl rounded-2xl overflow-hidden border-l-4 border-l-indigo-500">
                <CardHeader className="border-b border-[#222225] bg-[#161618]">
                   <CardTitle className="text-white flex items-center gap-2 text-sm uppercase tracking-widest font-bold">
                      <Shield className="w-4 h-4 text-indigo-400" /> Control de Roles y Zonas
                   </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader><TableRow className="border-[#222225] bg-[#121214] hover:bg-[#121214]">
                       <TableHead className="text-slate-400 text-[10px] uppercase font-bold pl-6 tracking-widest py-4">Usuario</TableHead>
                       <TableHead className="text-slate-400 text-[10px] uppercase font-bold tracking-widest">Rol</TableHead>
                       <TableHead className="text-slate-400 text-[10px] uppercase font-bold tracking-widest">Territorio de Asignación</TableHead>
                       <TableHead className="text-slate-400 text-[10px] uppercase font-bold tracking-widest">Estado</TableHead>
                       <TableHead className="text-slate-400 text-[10px] uppercase font-bold text-right pr-6 tracking-widest">Acciones</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {loading ? (<TableRow><TableCell colSpan={5} className="text-center h-48"><Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-500" /></TableCell></TableRow>) : 
                        users.map((u) => (
                        <TableRow key={u.id} className="border-[#222225] hover:bg-[#161618] transition-colors">
                          <TableCell className="pl-6 py-4">
                             <div className="flex flex-col">
                                <span className="font-bold text-slate-100">{u.full_name || 'Sin nombre'} {u.id === currentUser?.id && <Badge variant="secondary" className="ml-2 text-[8px] bg-indigo-900/50 text-indigo-300 border-indigo-500/30">TÚ</Badge>}</span>
                                <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1 mt-1"><Phone className="w-3 h-3"/> {u.phone || 'Sin WhatsApp'}</span>
                                <span className="text-[10px] text-slate-600 mt-0.5">{u.username}@...</span>
                             </div>
                          </TableCell>
                          <TableCell><Badge variant="outline" className={cn("text-[9px] font-bold uppercase tracking-widest px-2 py-0.5", u.role === 'admin' ? 'border-purple-500/50 text-purple-400 bg-purple-500/10' : u.role === 'dev' ? 'border-blue-500/50 text-blue-400 bg-blue-500/10' : u.role === 'gerente' ? 'border-amber-500/50 text-amber-400 bg-amber-500/10' : u.role === 'sales' ? 'border-emerald-500/50 text-emerald-400 bg-emerald-500/10' : 'border-[#333336] text-slate-400 bg-[#121214]')}>{u.role}</Badge></TableCell>
                          <TableCell>
                             <div className="flex gap-1.5 flex-wrap max-w-[250px]">
                                {u.territories && u.territories.length > 0 ? (
                                   u.territories.map((t: string, i: number) => <Badge key={i} variant="outline" className="text-[9px] border-[#333336] text-slate-400 bg-[#121214] px-2 uppercase tracking-widest">{t}</Badge>)
                                ) : (
                                   <span className="text-[10px] text-slate-500 italic">Tráfico Global (Sin segmentar)</span>
                                )}
                             </div>
                          </TableCell>
                          <TableCell>{u.is_active ? (<span className="text-emerald-500 text-[10px] flex items-center gap-1.5 font-bold uppercase tracking-widest"><div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div> ACTIVO</span>) : (<Badge variant="destructive" className="text-[9px]">SUSPENDIDO</Badge>)}</TableCell>
                          <TableCell className="text-right pr-6">
                             <Button variant="outline" size="sm" className="bg-[#121214] border-[#333336] text-amber-500 hover:bg-amber-500 hover:text-slate-950 h-9 px-4 text-[10px] font-bold tracking-widest uppercase transition-colors rounded-xl" onClick={() => { setSelectedUser(u); setIsEditOpen(true); }}>
                                <Edit3 className="w-3.5 h-3.5 mr-1.5" /> Gestionar
                             </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
           </TabsContent>

           <TabsContent value="qa" className="mt-6 space-y-6 animate-in fade-in duration-500">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 <Card className="bg-[#0f0f11] border-[#222225] p-6 rounded-2xl shadow-xl border-l-4 border-l-indigo-500">
                    <div className="flex justify-between items-start">
                       <div>
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Auditorías Realizadas</p>
                          <h3 className="text-3xl font-bold text-slate-50 mt-1 font-mono">{evaluations.length}</h3>
                       </div>
                       <div className="p-3 rounded-xl bg-indigo-900/30 border border-indigo-500/20 text-indigo-400"><Brain className="w-6 h-6" /></div>
                    </div>
                 </Card>
                 <Card className="bg-[#0f0f11] border-[#222225] p-6 rounded-2xl shadow-xl border-l-4 border-l-emerald-500">
                    <div className="flex justify-between items-start">
                       <div>
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Promedio de Calidad</p>
                          <h3 className="text-3xl font-bold text-slate-50 mt-1 font-mono">
                             {evaluations.length > 0 ? Math.round(evaluations.reduce((acc, e) => acc + (e.score || 0), 0) / evaluations.length) : 0}/100
                          </h3>
                       </div>
                       <div className="p-3 rounded-xl bg-emerald-900/30 border border-indigo-500/20 text-emerald-400"><TrendingUp className="w-6 h-6" /></div>
                    </div>
                 </Card>
                 <Card className="bg-[#0f0f11] border-[#222225] p-6 rounded-2xl shadow-xl border-l-4 border-l-red-500">
                    <div className="flex justify-between items-start">
                       <div>
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Infracciones Críticas</p>
                          <h3 className="text-3xl font-bold text-red-400 mt-1 font-mono">{criticalAnomalies.length}</h3>
                       </div>
                       <div className="p-3 rounded-xl bg-red-950/50 border border-red-900/50 text-red-500"><ShieldAlert className="w-6 h-6" /></div>
                    </div>
                 </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                 <div className="lg:col-span-5 space-y-6">
                    <Card className="bg-[#0f0f11] border-[#222225] shadow-2xl rounded-2xl overflow-hidden">
                       <CardHeader className="bg-[#161618] border-b border-[#222225] py-5">
                          <CardTitle className="text-amber-500 text-sm uppercase tracking-widest font-bold flex items-center gap-2">
                             <Award className="w-4 h-4" /> Leaderboard de Agentes
                          </CardTitle>
                       </CardHeader>
                       <CardContent className="p-0">
                          <Table>
                             <TableHeader>
                                <TableRow className="border-[#222225] bg-[#121214] hover:bg-[#121214]">
                                   <TableHead className="text-[10px] uppercase text-slate-500 font-bold pl-6 py-3">Agente</TableHead>
                                   <TableHead className="text-[10px] uppercase text-slate-500 font-bold text-center">Mensajes</TableHead>
                                   <TableHead className="text-[10px] uppercase text-slate-500 font-bold text-right pr-6">Score</TableHead>
                                </TableRow>
                             </TableHeader>
                             <TableBody>
                                {agentLeaderboard.length === 0 ? (
                                   <TableRow><TableCell colSpan={3} className="text-center py-10 text-slate-500 text-xs italic">Aún no hay datos suficientes.</TableCell></TableRow>
                                ) : agentLeaderboard.map((agent: any, idx: number) => (
                                   <TableRow key={agent.id} className="border-[#222225] hover:bg-[#161618]">
                                      <TableCell className="pl-6">
                                         <div className="flex items-center gap-3">
                                            <div className="w-6 h-6 rounded-full bg-[#222225] flex items-center justify-center text-[10px] font-bold text-slate-400">{idx + 1}</div>
                                            <div className="flex flex-col">
                                               <span className="font-bold text-sm text-slate-200">{agent.name}</span>
                                               {agent.anomalies > 0 && <span className="text-[9px] text-red-400 flex items-center gap-1 font-bold mt-0.5"><AlertTriangle className="w-2.5 h-2.5"/> {agent.anomalies} Infracciones</span>}
                                            </div>
                                         </div>
                                      </TableCell>
                                      <TableCell className="text-center font-mono text-xs text-slate-400">{agent.messages}</TableCell>
                                      <TableCell className="text-right pr-6">
                                         <Badge className={cn("text-[10px] font-bold font-mono px-2", agent.avgScore >= 80 ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : agent.avgScore >= 60 ? "bg-amber-500/20 text-amber-400 border-amber-500/30" : "bg-red-500/20 text-red-400 border-red-500/30")}>
                                            {agent.avgScore}/100
                                         </Badge>
                                      </TableCell>
                                   </TableRow>
                                ))}
                             </TableBody>
                          </Table>
                       </CardContent>
                    </Card>

                    {criticalAnomalies.length > 0 && (
                       <Card className="bg-[#1f0f0f] border-red-900/50 shadow-2xl rounded-2xl overflow-hidden border-l-4 border-l-red-500">
                          <CardHeader className="bg-red-950/30 border-b border-red-900/50 py-4">
                             <CardTitle className="text-red-400 text-xs uppercase tracking-widest font-bold flex items-center gap-2">
                                <ShieldAlert className="w-4 h-4" /> Alertas Críticas Recientes
                             </CardTitle>
                          </CardHeader>
                          <ScrollArea className="h-[250px] bg-[#0a0a0c]">
                             <div className="divide-y divide-[#222225]">
                                {criticalAnomalies.map(anom => (
                                   <div key={anom.id} className="p-4 hover:bg-[#121214] transition-colors">
                                      <div className="flex justify-between items-start mb-2">
                                         <span className="text-[10px] font-bold text-red-400 uppercase tracking-widest">{anom.profiles?.full_name}</span>
                                         <span className="text-[9px] text-slate-500 font-mono">{new Date(anom.created_at).toLocaleString()}</span>
                                      </div>
                                      <p className="text-xs text-slate-300 italic bg-[#161618] p-2 rounded-lg border border-[#222225] mb-2 leading-relaxed">"{anom.message_text}"</p>
                                      <div className="flex items-start gap-2 mt-2">
                                         <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                                         <span className="text-[10px] text-red-300/80 font-bold uppercase tracking-wide leading-relaxed">{anom.anomaly_details}</span>
                                      </div>
                                   </div>
                                ))}
                             </div>
                          </ScrollArea>
                       </Card>
                    )}
                 </div>

                 <div className="lg:col-span-7">
                    <Card className="bg-[#0f0f11] border-[#222225] shadow-2xl rounded-2xl overflow-hidden h-full flex flex-col">
                       <CardHeader className="bg-[#161618] border-b border-[#222225] py-5 shrink-0">
                          <CardTitle className="text-indigo-400 text-sm uppercase tracking-widest font-bold flex items-center gap-2">
                             <MessageSquare className="w-4 h-4" /> Flujo de Auditoría (En Vivo)
                          </CardTitle>
                          <CardDescription className="text-slate-400 text-xs mt-1">Los mensajes de los asesores están siendo evaluados en tiempo real por el QA Bot.</CardDescription>
                       </CardHeader>
                       <ScrollArea className="flex-1 bg-[#0a0a0c] p-6">
                          <div className="space-y-4">
                             {evaluations.length === 0 ? (
                                <p className="text-center text-slate-600 italic py-10 text-xs">Esperando tráfico humano...</p>
                             ) : evaluations.map(ev => (
                                <div key={ev.id} className={cn("p-4 rounded-xl border flex flex-col gap-3", ev.anomaly_detected ? "bg-red-950/10 border-red-900/30" : "bg-[#121214] border-[#222225]")}>
                                   <div className="flex justify-between items-center">
                                      <div className="flex items-center gap-2">
                                         <span className="text-xs font-bold text-slate-200">{ev.profiles?.full_name}</span>
                                         <Badge variant="outline" className="text-[8px] border-[#333336] text-slate-400 uppercase tracking-widest">{ev.tone_analysis || 'NEUTRO'}</Badge>
                                      </div>
                                      <div className="flex items-center gap-2">
                                         <span className="text-[9px] text-slate-500 font-mono">{new Date(ev.created_at).toLocaleTimeString()}</span>
                                         <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold font-mono border", ev.score >= 80 ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" : ev.score >= 60 ? "bg-amber-500/10 text-amber-400 border-amber-500/30" : ev.score >= 60 ? "bg-red-500/10 text-red-400 border-red-500/30" : "bg-red-500/10 text-red-400 border-red-500/30")}>
                                            {ev.score}
                                         </div>
                                      </div>
                                   </div>
                                   <p className="text-sm text-slate-300 leading-relaxed">"{ev.message_text}"</p>
                                </div>
                             ))}
                          </div>
                       </ScrollArea>
                    </Card>
                 </div>
              </div>
           </TabsContent>
        </Tabs>

        {/* DIALOGO DE CREACIÓN */}
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
           <DialogContent className="bg-[#0f0f11] border-[#222225] text-white max-w-lg rounded-3xl shadow-[0_0_50px_-12px_rgba(0,0,0,0.8)]">
              <DialogHeader><DialogTitle className="text-sm uppercase tracking-widest text-indigo-400 font-bold flex items-center gap-2"><UserPlus className="w-5 h-5"/> Añadir Miembro al Equipo</DialogTitle></DialogHeader>
              <form onSubmit={handleCreateUser} className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-2"><Label className="text-[10px] text-slate-400 uppercase font-bold tracking-widest ml-1">Nombre Completo *</Label><Input value={createForm.fullName} onChange={e => setCreateForm({...createForm, fullName: e.target.value})} className="bg-[#161618] border-[#222225] h-11 rounded-xl text-slate-200 focus-visible:ring-indigo-500" placeholder="Ej: Juan Pérez" required /></div>
                   <div className="space-y-2"><Label className="text-[10px] text-slate-400 uppercase font-bold tracking-widest ml-1">Teléfono WhatsApp</Label><Input value={createForm.phone} onChange={e => setCreateForm({...createForm, phone: e.target.value})} className="bg-[#161618] border-[#222225] h-11 rounded-xl text-slate-200 font-mono focus-visible:ring-indigo-500" placeholder="521..." /></div>
                </div>
                <div className="space-y-2"><Label className="text-[10px] text-slate-400 uppercase font-bold tracking-widest ml-1">Email de Acceso *</Label><Input type="email" value={createForm.email} onChange={e => setCreateForm({...createForm, email: e.target.value})} className="bg-[#161618] border-[#222225] h-11 rounded-xl text-slate-200 font-mono focus-visible:ring-indigo-500" placeholder="email@empresa.com" required /></div>
                <div className="space-y-2"><Label className="text-[10px] text-slate-400 uppercase font-bold tracking-widest ml-1">Contraseña (Mín. 6 chars) *</Label><Input type="password" value={createForm.password} onChange={e => setCreateForm({...createForm, password: e.target.value})} className="bg-[#161618] border-[#222225] h-11 rounded-xl text-slate-200 font-mono focus-visible:ring-indigo-500" required /></div>
                
                <div className="space-y-2"><Label className="text-[10px] text-slate-400 uppercase font-bold tracking-widest ml-1">Rol Inicial</Label>
                    <Select value={createForm.role} onValueChange={v => setCreateForm({...createForm, role: v})}>
                      <SelectTrigger className="bg-[#161618] border-[#222225] h-11 rounded-xl text-slate-200"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-[#121214] border-[#222225] text-white rounded-xl">
                         <SelectItem value="admin">Administrador</SelectItem>
                         <SelectItem value="dev">Developer</SelectItem>
                         <SelectItem value="gerente">Gerente</SelectItem>
                         <SelectItem value="sales">Ventas</SelectItem>
                         <SelectItem value="agent">Agente de Soporte</SelectItem>
                      </SelectContent>
                    </Select>
                </div>

                <div className="space-y-2 pt-2">
                   <Label className="flex items-center gap-2 text-indigo-400 text-[10px] uppercase font-bold tracking-widest ml-1"><MapPin className="w-3.5 h-3.5"/> Territorios (Routing IA)</Label>
                   <Input value={createForm.territories} onChange={e => setCreateForm({...createForm, territories: e.target.value})} className="bg-[#161618] border-[#222225] h-11 rounded-xl text-slate-200 focus-visible:ring-indigo-500" placeholder="Ej: Guadalajara, Jalisco" />
                </div>

                <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white h-12 rounded-xl shadow-lg font-bold text-[10px] uppercase tracking-widest mt-4" disabled={creating}>{creating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <UserPlus className="w-4 h-4 mr-2" />} Activar Ahora</Button>
              </form>
           </DialogContent>
        </Dialog>

        {/* DIALOGO DE EDICIÓN */}
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
           <DialogContent className="bg-[#0f0f11] border-[#222225] text-white max-w-lg rounded-3xl shadow-[0_0_50px_-12px_rgba(0,0,0,0.8)]">
              <DialogHeader><DialogTitle className="flex items-center gap-2 text-amber-500 text-sm uppercase tracking-widest font-bold"><Shield className="w-5 h-5" /> Gestionar Agente</DialogTitle></DialogHeader>
              {selectedUser && (
                <div className="space-y-6 py-4">
                  <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-2"><Label className="text-[10px] text-slate-400 uppercase font-bold tracking-widest ml-1">Nombre</Label><Input value={selectedUser.full_name} onChange={e => setSelectedUser({...selectedUser, full_name: e.target.value})} className="bg-[#161618] border-[#222225] h-11 rounded-xl text-slate-200 focus-visible:ring-amber-500" /></div>
                     <div className="space-y-2"><Label className="text-[10px] text-slate-400 uppercase font-bold tracking-widest ml-1">WhatsApp</Label><Input value={selectedUser.phone || ''} onChange={e => setSelectedUser({...selectedUser, phone: e.target.value})} className="bg-[#161618] border-[#222225] h-11 rounded-xl text-slate-200 font-mono focus-visible:ring-amber-500" /></div>
                  </div>
                  
                  <div className="space-y-2 pt-4 border-t border-[#222225]">
                     <Label className="flex items-center gap-2 text-amber-500 text-[10px] uppercase font-bold tracking-widest ml-1"><MapPin className="w-3.5 h-3.5"/> Zonas Asignadas</Label>
                     <Input 
                        value={Array.isArray(selectedUser.territories) ? selectedUser.territories.join(', ') : (selectedUser.territories || '')} 
                        onChange={e => setSelectedUser({...selectedUser, territories: e.target.value})} 
                        className="bg-[#161618] border-[#222225] h-11 rounded-xl text-slate-200 focus-visible:ring-amber-500" 
                        placeholder="Ej: Monterrey, Nuevo Leon"
                     />
                  </div>

                  <div className="space-y-2 pt-4 border-t border-[#222225]"><Label className="text-[10px] text-slate-400 uppercase font-bold tracking-widest ml-1">Rol del Sistema</Label>
                    <Select value={selectedUser.role} onValueChange={v => setSelectedUser({...selectedUser, role: v})} disabled={selectedUser.id === currentUser?.id}>
                      <SelectTrigger className="bg-[#161618] border-[#222225] h-11 rounded-xl text-slate-200"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-[#121214] border-[#222225] text-white rounded-xl">
                         <SelectItem value="admin">admin</SelectItem>
                         <SelectItem value="dev">dev</SelectItem>
                         <SelectItem value="gerente">gerente</SelectItem>
                         <SelectItem value="sales">sales</SelectItem>
                         <SelectItem value="agent">agent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="pt-6 border-t border-[#222225]">
                     <Button variant="ghost" className="w-full text-red-500 hover:bg-red-950/50 hover:text-red-400 h-11 uppercase text-[10px] font-bold tracking-widest rounded-xl border border-red-900/30" onClick={() => handleDeleteUser(selectedUser.id, selectedUser.full_name)} disabled={selectedUser.id === currentUser?.id}> 
                        <Trash2 className="w-4 h-4 mr-2" /> Eliminar Permanentemente
                     </Button>
                  </div>
                </div>
              )}
              <DialogFooter className="gap-2 sm:gap-0 mt-4 border-t border-[#222225] pt-4">
                 <Button variant="ghost" onClick={() => setIsEditOpen(false)} className="rounded-xl h-11 px-6 text-xs uppercase tracking-widest font-bold text-slate-400 hover:text-white">Cancelar</Button>
                 <Button onClick={handleUpdateUser} disabled={updating} className="bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold rounded-xl px-8 h-11 text-[10px] uppercase tracking-widest shadow-lg">
                    {updating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />} Guardar Cambios
                 </Button>
              </DialogFooter>
           </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default UsersPage;