import React, { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users as UsersIcon, UserPlus, Loader2, RefreshCw, Shield, Trash2, Edit3, Save, X, ShieldAlert, Lock, Phone, MapPin, Activity, CheckCircle2, AlertTriangle, TrendingUp, Target } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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
  
  const [createForm, setCreateForm] = useState({ email: '', password: '', fullName: '', phone: '', territories: '' });
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    
    // Fetch users
    const { data: uData } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    if (uData) setUsers(uData);

    // Fetch evaluations for QA Analytics
    const { data: eData } = await supabase.from('agent_evaluations')
       .select('*, profiles!agent_evaluations_agent_id_fkey(full_name, role)')
       .order('created_at', { ascending: false })
       .limit(100);
    
    if (eData) setEvaluations(eData);

    setLoading(false);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-create-user', {
        body: { email: createForm.email, password: createForm.password, fullName: createForm.fullName }
      });
      if (error || !data.success) throw new Error(data?.error || "Error al crear");
      
      const territoriesArray = createForm.territories.split(',').map(s => s.trim()).filter(Boolean);
      await supabase.from('profiles').update({ phone: createForm.phone, territories: territoriesArray }).eq('id', data.user.id);

      await logActivity({ action: 'CREATE', resource: 'USERS', description: `Nuevo usuario creado: ${createForm.email}`, status: 'OK' });
      toast.success("Usuario activado instantáneamente.");
      fetchAll();
      setIsCreateOpen(false);
      setCreateForm({ email: '', password: '', fullName: '', phone: '', territories: '' });
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
           role: selectedUser.role, is_active: selectedUser.is_active, full_name: selectedUser.full_name,
           phone: selectedUser.phone, territories: territoriesArray
        }).eq('id', selectedUser.id);
        
        if (error) throw error;
        await logActivity({ action: 'UPDATE', resource: 'USERS', description: `Permisos actualizados para: ${selectedUser.username}`, status: 'OK' });
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

  // Cálculos de QA
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
      <div className="max-w-7xl mx-auto space-y-6 pb-12">
        <div className="flex items-center justify-between">
          <div><h1 className="text-3xl font-bold text-white mb-2">Gestión y Rendimiento de Equipo</h1><p className="text-slate-400">Control de acceso, territorios y auditoría de calidad (QA) con IA.</p></div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={fetchAll} disabled={loading} className="border-slate-800 text-slate-400"><RefreshCw className={loading ? "animate-spin" : ""} size={16} /></Button>
            <Button onClick={() => setIsCreateOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-900/20"><UserPlus className="w-4 h-4 mr-2" /> Nuevo Agente</Button>
          </div>
        </div>

        <Tabs defaultValue="directorio" className="w-full">
           <TabsList className="bg-slate-900 border border-slate-800 p-1 rounded-xl">
              <TabsTrigger value="directorio" className="gap-2"><UsersIcon className="w-4 h-4" /> Directorio y Accesos</TabsTrigger>
              <TabsTrigger value="qa" className="gap-2"><Activity className="w-4 h-4" /> Auditoría QA (Rendimiento)</TabsTrigger>
           </TabsList>

           <TabsContent value="directorio" className="mt-6">
              <Card className="bg-slate-900 border-slate-800 shadow-2xl rounded-2xl overflow-hidden">
                <CardHeader className="border-b border-slate-800 bg-slate-950/20"><CardTitle className="text-white flex items-center gap-2 text-sm uppercase tracking-widest font-bold"><Shield className="w-4 h-4 text-indigo-400" /> Control de Roles y Zonas</CardTitle></CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader><TableRow className="border-slate-800 bg-slate-900/40">
                       <TableHead className="text-slate-400 text-[10px] uppercase font-bold pl-6">Usuario</TableHead>
                       <TableHead className="text-slate-400 text-[10px] uppercase font-bold">Rol</TableHead>
                       <TableHead className="text-slate-400 text-[10px] uppercase font-bold">Territorio de Asignación</TableHead>
                       <TableHead className="text-slate-400 text-[10px] uppercase font-bold">Estado</TableHead>
                       <TableHead className="text-slate-400 text-[10px] uppercase font-bold text-right pr-6">Acciones</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {loading ? (<TableRow><TableCell colSpan={5} className="text-center h-48"><Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-500" /></TableCell></TableRow>) : 
                        users.map((u) => (
                        <TableRow key={u.id} className="border-slate-800 hover:bg-slate-800/40 transition-colors">
                          <TableCell className="pl-6">
                             <div className="flex flex-col">
                                <span className="font-bold text-slate-200">{u.full_name || 'Sin nombre'} {u.id === currentUser?.id && <Badge variant="secondary" className="ml-2 text-[8px] bg-indigo-900/50 text-indigo-300">TÚ</Badge>}</span>
                                <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1"><Phone className="w-2.5 h-2.5"/> {u.phone || 'Sin WhatsApp'}</span>
                                <span className="text-[10px] text-slate-600 mt-0.5">{u.username}@...</span>
                             </div>
                          </TableCell>
                          <TableCell><Badge variant="outline" className={cn("text-[9px] font-bold uppercase tracking-widest", u.role === 'admin' ? 'border-purple-500/50 text-purple-400 bg-purple-500/10' : u.role === 'dev' ? 'border-blue-500/50 text-blue-400 bg-blue-500/10' : u.role === 'sales' ? 'border-emerald-500/50 text-emerald-400 bg-emerald-500/10' : 'border-slate-600 text-slate-400')}>{u.role}</Badge></TableCell>
                          <TableCell>
                             <div className="flex gap-1 flex-wrap max-w-[200px]">
                                {u.territories && u.territories.length > 0 ? (
                                   u.territories.map((t: string, i: number) => <Badge key={i} variant="outline" className="text-[8px] border-slate-700 text-slate-400 bg-slate-950 px-1.5 h-4">{t}</Badge>)
                                ) : (
                                   <span className="text-[9px] text-slate-500 italic">Tráfico Global (Sin segmentar)</span>
                                )}
                             </div>
                          </TableCell>
                          <TableCell>{u.is_active ? (<span className="text-emerald-500 text-[9px] flex items-center gap-1.5 font-bold uppercase tracking-widest"><div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div> ACTIVO</span>) : (<Badge variant="destructive" className="text-[9px]">SUSPENDIDO</Badge>)}</TableCell>
                          <TableCell className="text-right pr-6"><Button variant="ghost" size="sm" className="text-amber-500 hover:bg-amber-500/10 hover:text-amber-400 h-8 text-[10px] font-bold tracking-widest" onClick={() => { setSelectedUser(u); setIsEditOpen(true); }}><Edit3 className="w-3.5 h-3.5 mr-2" /> GESTIONAR</Button></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
           </TabsContent>

           <TabsContent value="qa" className="mt-6">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                 {/* Ranking de Calidad */}
                 <div className="lg:col-span-7 space-y-6">
                    <Card className="bg-slate-900 border-slate-800 shadow-2xl rounded-2xl overflow-hidden border-t-4 border-t-indigo-500">
                       <CardHeader className="bg-slate-950/20 border-b border-slate-800">
                          <CardTitle className="text-xs text-white uppercase tracking-widest flex items-center gap-2"><Target className="w-4 h-4 text-indigo-400"/> Calidad de Atención (Leaderboard)</CardTitle>
                          <CardDescription className="text-[10px]">Evaluación automática de cada mensaje enviado por los humanos.</CardDescription>
                       </CardHeader>
                       <CardContent className="p-0">
                          <Table>
                             <TableHeader>
                                <TableRow className="border-slate-800 bg-slate-900/40">
                                   <TableHead className="text-[10px] uppercase font-bold text-slate-500 pl-6">Asesor</TableHead>
                                   <TableHead className="text-[10px] uppercase font-bold text-slate-500 text-center">Mensajes Auditados</TableHead>
                                   <TableHead className="text-[10px] uppercase font-bold text-slate-500 text-center">Score IA (0-100)</TableHead>
                                   <TableHead className="text-[10px] uppercase font-bold text-slate-500 text-center">Anomalías Detectadas</TableHead>
                                </TableRow>
                             </TableHeader>
                             <TableBody>
                                {agentLeaderboard.length === 0 ? (
                                   <TableRow><TableCell colSpan={4} className="text-center h-32 text-slate-500 text-xs italic">Aún no hay mensajes auditados.</TableCell></TableRow>
                                ) : agentLeaderboard.map((agent: any, idx: number) => (
                                   <TableRow key={agent.id} className="border-slate-800 hover:bg-slate-800/40 transition-colors">
                                      <TableCell className="pl-6">
                                         <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-full bg-slate-950 border border-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-400">
                                               {idx + 1}
                                            </div>
                                            <span className="font-bold text-slate-200 text-xs">{agent.name}</span>
                                            <Badge variant="outline" className="ml-2 text-[8px] border-slate-700 text-slate-500 h-4 px-1 uppercase">{agent.role}</Badge>
                                         </div>
                                      </TableCell>
                                      <TableCell className="text-center text-xs text-slate-400 font-mono">{agent.messages}</TableCell>
                                      <TableCell className="text-center">
                                         <span className={cn("text-xs font-bold", agent.avgScore >= 80 ? "text-emerald-400" : agent.avgScore >= 60 ? "text-amber-400" : "text-red-400")}>
                                            {agent.avgScore}
                                         </span>
                                      </TableCell>
                                      <TableCell className="text-center">
                                         {agent.anomalies === 0 ? (
                                            <span className="text-[10px] text-emerald-500/50 flex items-center justify-center gap-1"><CheckCircle2 className="w-3 h-3"/> 0</span>
                                         ) : (
                                            <Badge variant="outline" className="bg-red-900/30 text-red-400 border-red-500/50 text-[9px] h-5"><AlertTriangle className="w-2.5 h-2.5 mr-1"/> {agent.anomalies}</Badge>
                                         )}
                                      </TableCell>
                                   </TableRow>
                                ))}
                             </TableBody>
                          </Table>
                       </CardContent>
                    </Card>

                    {/* Feed de tonos generales */}
                    <div className="space-y-3">
                       <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 px-2">Últimos Tonos Detectados</h3>
                       <div className="flex gap-2 flex-wrap">
                          {evaluations.slice(0, 10).map((ev, i) => (
                             <Badge key={i} variant="secondary" className="bg-slate-900 border border-slate-800 text-slate-400 text-[10px] font-medium py-1 px-3">
                                {ev.profiles?.full_name?.split(' ')[0]}: <span className="text-indigo-400 ml-1">{ev.tone_analysis || 'Neutral'}</span>
                             </Badge>
                          ))}
                       </div>
                    </div>
                 </div>

                 {/* Feed de Alertas Críticas (Anomalías) */}
                 <div className="lg:col-span-5 space-y-6">
                    <Card className="bg-[#1A1110] border-red-900/50 shadow-2xl rounded-2xl overflow-hidden flex flex-col h-[500px]">
                       <CardHeader className="bg-red-950/40 border-b border-red-900/50 py-4">
                          <CardTitle className="text-red-400 text-xs flex items-center gap-2 uppercase tracking-widest font-bold">
                             <ShieldAlert className="w-4 h-4" /> Alertas Críticas de Seguridad
                          </CardTitle>
                          <CardDescription className="text-[10px] text-red-300/60 mt-1">Precios o datos bancarios incorrectos dados por humanos.</CardDescription>
                       </CardHeader>
                       <ScrollArea className="flex-1 p-0">
                          {criticalAnomalies.length === 0 ? (
                             <div className="flex flex-col items-center justify-center py-20 text-emerald-500/50 gap-3">
                                <CheckCircle2 className="w-10 h-10 opacity-50" />
                                <span className="text-[10px] font-bold uppercase tracking-widest">Sin violaciones de seguridad</span>
                             </div>
                          ) : (
                             <div className="divide-y divide-red-900/30">
                                {criticalAnomalies.map((anom) => (
                                   <div key={anom.id} className="p-5 hover:bg-red-900/10 transition-colors">
                                      <div className="flex justify-between items-start mb-3">
                                         <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-full bg-red-900/50 flex items-center justify-center text-red-400 font-bold text-[10px]">
                                               {anom.profiles?.full_name?.substring(0, 1)}
                                            </div>
                                            <span className="text-xs font-bold text-red-200">{anom.profiles?.full_name}</span>
                                         </div>
                                         <span className="text-[9px] text-red-400/60 font-mono">{new Date(anom.created_at).toLocaleDateString()}</span>
                                      </div>
                                      <div className="bg-black/50 p-3 rounded-lg border border-red-900/50 mb-3">
                                         <p className="text-[11px] text-red-100 italic leading-relaxed">"{anom.message_text}"</p>
                                      </div>
                                      <div className="flex items-start gap-2 text-[10px] text-red-400">
                                         <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                         <span className="font-bold">{anom.anomaly_details}</span>
                                      </div>
                                   </div>
                                ))}
                             </div>
                          )}
                       </ScrollArea>
                    </Card>
                 </div>
              </div>
           </TabsContent>
        </Tabs>

        {/* DIALOGO DE CREACIÓN */}
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
           <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-lg rounded-2xl shadow-2xl">
              <DialogHeader><DialogTitle className="text-sm uppercase tracking-widest text-indigo-400 font-bold">Añadir Miembro al Equipo</DialogTitle></DialogHeader>
              <form onSubmit={handleCreateUser} className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-2"><Label className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">Nombre Completo *</Label><Input value={createForm.fullName} onChange={e => setCreateForm({...createForm, fullName: e.target.value})} className="bg-slate-950 border-slate-800 h-10" placeholder="Ej: Juan Pérez" required /></div>
                   <div className="space-y-2"><Label className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">Teléfono WhatsApp</Label><Input value={createForm.phone} onChange={e => setCreateForm({...createForm, phone: e.target.value})} className="bg-slate-950 border-slate-800 h-10 font-mono" placeholder="521..." /></div>
                </div>
                <div className="space-y-2"><Label className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">Email de Acceso *</Label><Input type="email" value={createForm.email} onChange={e => setCreateForm({...createForm, email: e.target.value})} className="bg-slate-950 border-slate-800 h-10 font-mono" placeholder="email@empresa.com" required /></div>
                <div className="space-y-2"><Label className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">Contraseña (Mín. 6 chars) *</Label><Input type="password" value={createForm.password} onChange={e => setCreateForm({...createForm, password: e.target.value})} className="bg-slate-950 border-slate-800 h-10 font-mono" required /></div>
                
                <div className="space-y-2 pt-4 border-t border-slate-800">
                   <Label className="flex items-center gap-2 text-indigo-400 text-[10px] uppercase font-bold tracking-widest"><MapPin className="w-3.5 h-3.5"/> Territorios de Venta (Routing IA)</Label>
                   <Input 
                      value={createForm.territories} 
                      onChange={e => setCreateForm({...createForm, territories: e.target.value})} 
                      className="bg-slate-950 border-slate-800 h-10" 
                      placeholder="Ej: Guadalajara, Jalisco, Colima" 
                   />
                   <p className="text-[9px] text-slate-500 italic">Separa por comas. La IA usará esto para asignar clientes geográficamente.</p>
                </div>

                <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 h-11 rounded-xl shadow-lg font-bold text-[10px] uppercase tracking-widest mt-2" disabled={creating}>{creating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <UserPlus className="w-4 h-4 mr-2" />} Activar Ahora</Button>
              </form>
           </DialogContent>
        </Dialog>

        {/* DIALOGO DE EDICIÓN */}
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
           <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-lg rounded-2xl shadow-2xl">
              <DialogHeader><DialogTitle className="flex items-center gap-2 text-amber-500 text-sm uppercase tracking-widest font-bold"><Shield className="w-5 h-5" /> Gestionar Agente</DialogTitle></DialogHeader>
              {selectedUser && (
                <div className="space-y-6 py-4">
                  <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-2"><Label className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">Nombre</Label><Input value={selectedUser.full_name} onChange={e => setSelectedUser({...selectedUser, full_name: e.target.value})} className="bg-slate-950 border-slate-800 h-10" /></div>
                     <div className="space-y-2"><Label className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">WhatsApp</Label><Input value={selectedUser.phone || ''} onChange={e => setSelectedUser({...selectedUser, phone: e.target.value})} className="bg-slate-950 border-slate-800 h-10 font-mono" /></div>
                  </div>
                  
                  <div className="space-y-2 pt-2 border-t border-slate-800">
                     <Label className="flex items-center gap-2 text-indigo-400 text-[10px] uppercase font-bold tracking-widest"><MapPin className="w-3.5 h-3.5"/> Zonas Asignadas</Label>
                     <Input 
                        value={Array.isArray(selectedUser.territories) ? selectedUser.territories.join(', ') : (selectedUser.territories || '')} 
                        onChange={e => setSelectedUser({...selectedUser, territories: e.target.value})} 
                        className="bg-slate-950 border-slate-800 h-10" 
                        placeholder="Ej: Monterrey, Nuevo Leon, Saltillo"
                     />
                  </div>

                  <div className="space-y-2 pt-2 border-t border-slate-800"><Label className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">Rol del Sistema</Label>
                    <Select value={selectedUser.role} onValueChange={v => setSelectedUser({...selectedUser, role: v})} disabled={selectedUser.id === currentUser?.id}>
                      <SelectTrigger className="bg-slate-950 border-slate-800 h-10 rounded-xl"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-slate-900 border-slate-800 text-white rounded-xl">
                         <SelectItem value="admin">Administrador (Full Access)</SelectItem>
                         <SelectItem value="dev">Developer (Full Access)</SelectItem>
                         <SelectItem value="sales">Ventas (Limitado a su cartera)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-slate-950 rounded-xl border border-slate-800">
                     <div className="space-y-0.5"><Label>Acceso General</Label><p className="text-[9px] text-slate-500 uppercase font-bold">CRM Habilitado</p></div>
                     <Switch checked={selectedUser.is_active} onCheckedChange={c => setSelectedUser({...selectedUser, is_active: c})} disabled={selectedUser.id === currentUser?.id} />
                  </div>
                  
                  <div className="pt-4 border-t border-slate-800"><Button variant="ghost" className="w-full text-red-500 hover:bg-red-500/10 h-11 uppercase text-[10px] font-bold tracking-widest rounded-xl" onClick={() => handleDeleteUser(selectedUser.id, selectedUser.full_name)} disabled={selectedUser.id === currentUser?.id}><Trash2 className="w-4 h-4 mr-2" /> Eliminar Permanentemente</Button></div>
                </div>
              )}
              <DialogFooter className="gap-2 sm:gap-0 mt-2">
                 <Button variant="ghost" onClick={() => setIsEditOpen(false)} className="rounded-xl h-11 text-xs">Cancelar</Button>
                 <Button onClick={handleUpdateUser} disabled={updating} className="bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold rounded-xl h-11 text-[10px] uppercase tracking-widest shadow-lg">
                    {updating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />} Guardar Todo
                 </Button>
              </DialogFooter>
           </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default UsersPage;