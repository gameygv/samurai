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
  Brain, ShieldAlert, Award, MessageSquare, ArrowRight, UserCheck
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription as DialogDesc } from '@/components/ui/dialog';
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
  const [loading, setLoading] = useState(true);
  
  const [createForm, setCreateForm] = useState({ 
    email: '', password: '', fullName: '', phone: '', territories: '', role: 'sales_agent' 
  });
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [updating, setUpdating] = useState(false);

  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [transferToId, setTransferToId] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    const { data: uData } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    if (uData) setUsers(uData);
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

      await logActivity({ action: 'CREATE', resource: 'USERS', description: `Nuevo usuario creado: ${createForm.email}`, status: 'OK' });
      toast.success("Usuario activado e integrado al Kernel.");
      fetchAll();
      setIsCreateOpen(false);
      setCreateForm({ email: '', password: '', fullName: '', phone: '', territories: '', role: 'sales_agent' });
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
        const territoriesArray = Array.isArray(selectedUser.territories) 
            ? selectedUser.territories 
            : typeof selectedUser.territories === 'string' 
                ? selectedUser.territories.split(',').map((s: string) => s.trim()).filter(Boolean) 
                : [];

        const { error } = await supabase.from('profiles').update({ 
           role: selectedUser.role, 
           full_name: selectedUser.full_name,
           phone: selectedUser.phone, 
           territories: territoriesArray
        }).eq('id', selectedUser.id);
        
        if (error) throw error;
        toast.success("Perfil de usuario actualizado");
        setIsEditOpen(false);
        fetchAll();
     } catch (err: any) {
        toast.error(err.message);
     } finally {
        setUpdating(false);
     }
  };

  const handleDeleteUserFinal = async () => {
     if (!selectedUser || !transferToId) {
        toast.error("Selecciona un usuario para recibir los activos.");
        return;
     }
     
     setDeleting(true);
     const tid = toast.loading(`Transfiriendo y eliminando a ${selectedUser.full_name}...`);
     try {
        const { error } = await supabase.functions.invoke('manage-auth-users', { 
            body: { action: 'DELETE', userId: selectedUser.id, transferToId } 
        });
        if (error) throw error;
        toast.success("Misión cumplida: Usuario borrado y activos transferidos.", { id: tid });
        setIsDeleteOpen(false);
        setIsEditOpen(false);
        fetchAll();
     } catch (err: any) {
        toast.error(err.message, { id: tid });
     } finally {
        setDeleting(false);
     }
  };

  const getRoleLabel = (role: string) => {
      const r = role?.toLowerCase();
      if (r === 'sales_agent' || r === 'agent' || r === 'sales') return 'Agente de Ventas';
      if (r === 'admin') return 'Administrador';
      if (r === 'dev') return 'Developer';
      if (r === 'gerente') return 'Gerente';
      return role;
  };

  return (
    <Layout>
      <div className="max-w-[1600px] mx-auto space-y-6 pb-12 animate-in fade-in duration-500">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
             <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
               <div className="p-2 bg-indigo-900/30 rounded-xl border border-indigo-500/20">
                 <UsersIcon className="w-6 h-6 text-indigo-400" />
               </div>
               Gestión de Equipo
             </h1>
             <p className="text-slate-400">Control de accesos y protocolos de seguridad.</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={fetchAll} disabled={loading} className="bg-[#121214] border-[#222225] text-slate-400 hover:text-white h-11 px-4 rounded-xl text-[10px] font-bold uppercase tracking-widest">
               <RefreshCw className={cn("w-4 h-4 mr-2", loading && "animate-spin")} /> Refrescar
            </Button>
            <Button onClick={() => setIsCreateOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg h-11 px-6 rounded-xl text-[10px] font-bold uppercase tracking-widest">
               <UserPlus className="w-4 h-4 mr-2" /> Nuevo Miembro
            </Button>
          </div>
        </div>

        <Card className="bg-[#0f0f11] border-[#222225] shadow-2xl rounded-2xl overflow-hidden border-l-4 border-l-indigo-500">
           <CardContent className="p-0">
             <Table>
               <TableHeader><TableRow className="border-[#222225] bg-[#121214] hover:bg-[#121214]">
                  <TableHead className="text-slate-400 text-[10px] font-bold pl-6 tracking-widest py-4">Usuario</TableHead>
                  <TableHead className="text-slate-400 text-[10px] font-bold tracking-widest">Rol</TableHead>
                  <TableHead className="text-slate-400 text-[10px] font-bold tracking-widest">Territorios</TableHead>
                  <TableHead className="text-slate-400 text-[10px] font-bold tracking-widest">Estado</TableHead>
                  <TableHead className="text-slate-400 text-[10px] font-bold text-right pr-6 tracking-widest">Acciones</TableHead>
               </TableRow></TableHeader>
               <TableBody>
                 {loading ? (<TableRow><TableCell colSpan={5} className="text-center h-48"><Loader2 className="animate-spin mx-auto text-indigo-500" /></TableCell></TableRow>) : 
                   users.map((u) => (
                   <TableRow key={u.id} className="border-[#222225] hover:bg-[#161618] transition-colors">
                     <TableCell className="pl-6 py-4">
                        <div className="flex flex-col">
                           <span className="font-bold text-slate-100">{u.full_name || 'Sin nombre'} {u.id === currentUser?.id && <Badge variant="secondary" className="ml-2 text-[8px] bg-indigo-900/50 text-indigo-300 border-indigo-500/30">TÚ</Badge>}</span>
                           <span className="text-[10px] text-slate-500 font-mono mt-1">{u.email || 'Sin email'}</span>
                        </div>
                     </TableCell>
                     <TableCell><Badge variant="outline" className="text-[9px] font-bold uppercase border-[#333336] text-slate-400 bg-[#121214]">{getRoleLabel(u.role)}</Badge></TableCell>
                     <TableCell>
                        <div className="flex gap-1.5 flex-wrap max-w-[250px]">
                           {u.territories && u.territories.length > 0 ? u.territories.map((t: string, i: number) => <Badge key={i} variant="outline" className="text-[9px] border-[#333336] text-slate-400 bg-[#121214] uppercase">{t}</Badge>) : <span className="text-[10px] text-slate-500 italic">Global</span>}
                        </div>
                     </TableCell>
                     <TableCell>{u.is_active ? (<span className="text-emerald-500 text-[10px] flex items-center gap-1.5 font-bold uppercase"><div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div> ACTIVO</span>) : (<Badge variant="destructive" className="text-[9px]">INACTIVO</Badge>)}</TableCell>
                     <TableCell className="text-right pr-6">
                        <Button variant="outline" size="sm" className="bg-[#121214] border-[#333336] text-amber-500 hover:bg-amber-500 hover:text-slate-950 h-9 px-4 text-[10px] font-bold uppercase tracking-widest transition-colors rounded-xl" onClick={() => { setSelectedUser(u); setIsEditOpen(true); }}>
                           <Edit3 className="w-3.5 h-3.5 mr-1.5" /> Gestionar
                        </Button>
                     </TableCell>
                   </TableRow>
                 ))}
               </TableBody>
             </Table>
           </CardContent>
        </Card>

        {/* DIALOGO DE CREACIÓN */}
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
           <DialogContent className="bg-[#0f0f11] border-[#222225] text-white max-w-lg rounded-3xl">
              <DialogHeader><DialogTitle className="text-sm uppercase tracking-widest text-indigo-400 font-bold flex items-center gap-2"><UserPlus className="w-5 h-5"/> Nuevo Miembro</DialogTitle></DialogHeader>
              <form onSubmit={handleCreateUser} className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-2"><Label className="text-[10px] text-slate-400 uppercase font-bold">Nombre *</Label><Input value={createForm.fullName} onChange={e => setCreateForm({...createForm, fullName: e.target.value})} className="bg-[#161618] border-[#222225] h-11 rounded-xl text-slate-200" required /></div>
                   <div className="space-y-2"><Label className="text-[10px] text-slate-400 uppercase font-bold">WhatsApp</Label><Input value={createForm.phone} onChange={e => setCreateForm({...createForm, phone: e.target.value})} className="bg-[#161618] border-[#222225] h-11 rounded-xl text-slate-200" /></div>
                </div>
                <div className="space-y-2"><Label className="text-[10px] text-slate-400 uppercase font-bold">Email *</Label><Input type="email" value={createForm.email} onChange={e => setCreateForm({...createForm, email: e.target.value})} className="bg-[#161618] border-[#222225] h-11 rounded-xl text-slate-200" required /></div>
                <div className="space-y-2"><Label className="text-[10px] text-slate-400 uppercase font-bold">Contraseña (Mín. 6) *</Label><Input type="password" value={createForm.password} onChange={e => setCreateForm({...createForm, password: e.target.value})} className="bg-[#161618] border-[#222225] h-11 rounded-xl text-slate-200" required /></div>
                <div className="space-y-2"><Label className="text-[10px] text-slate-400 uppercase font-bold">Rol</Label>
                    <Select value={createForm.role} onValueChange={v => setCreateForm({...createForm, role: v})}>
                      <SelectTrigger className="bg-[#161618] border-[#222225] h-11 rounded-xl text-slate-200"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-[#121214] border-[#222225] text-white">
                         <SelectItem value="sales_agent">Agente de Ventas</SelectItem>
                         <SelectItem value="gerente">Gerente</SelectItem>
                         <SelectItem value="admin">Administrador</SelectItem>
                         <SelectItem value="dev">Developer</SelectItem>
                      </SelectContent>
                    </Select>
                </div>
                <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white h-12 rounded-xl font-bold text-[10px] uppercase mt-4 shadow-lg" disabled={creating}>{creating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : "Crear Usuario"}</Button>
              </form>
           </DialogContent>
        </Dialog>

        {/* DIALOGO DE EDICIÓN */}
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
           <DialogContent className="bg-[#0f0f11] border-[#222225] text-white max-w-lg rounded-3xl">
              <DialogHeader><DialogTitle className="flex items-center gap-2 text-amber-500 text-sm uppercase font-bold"><Shield className="w-5 h-5" /> Perfil de Miembro</DialogTitle></DialogHeader>
              {selectedUser && (
                <div className="space-y-6 py-4">
                  <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-2"><Label className="text-[10px] text-slate-400 uppercase font-bold">Nombre</Label><Input value={selectedUser.full_name} onChange={e => setSelectedUser({...selectedUser, full_name: e.target.value})} className="bg-[#161618] border-[#222225] h-11 rounded-xl text-slate-200" /></div>
                     <div className="space-y-2"><Label className="text-[10px] text-slate-400 uppercase font-bold">WhatsApp</Label><Input value={selectedUser.phone || ''} onChange={e => setSelectedUser({...selectedUser, phone: e.target.value})} className="bg-[#161618] border-[#222225] h-11 rounded-xl text-slate-200" /></div>
                  </div>
                  <div className="space-y-2">
                     <Label className="text-[10px] text-slate-400 uppercase font-bold">Rol</Label>
                     <Select value={['sales_agent', 'agent', 'sales'].includes(selectedUser.role) ? 'sales_agent' : selectedUser.role} onValueChange={v => setSelectedUser({...selectedUser, role: v})} disabled={selectedUser.id === currentUser?.id}>
                       <SelectTrigger className="bg-[#161618] border-[#222225] h-11 rounded-xl text-slate-200"><SelectValue /></SelectTrigger>
                       <SelectContent className="bg-[#121214] border-[#222225] text-white">
                          <SelectItem value="sales_agent">Agente de Ventas</SelectItem>
                          <SelectItem value="gerente">Gerente</SelectItem>
                          <SelectItem value="admin">Administrador</SelectItem>
                          <SelectItem value="dev">Developer</SelectItem>
                       </SelectContent>
                     </Select>
                  </div>
                  <div className="space-y-2">
                     <Label className="text-[10px] text-slate-400 uppercase font-bold">Territorios (Separados por coma)</Label>
                     <Input 
                        value={Array.isArray(selectedUser.territories) ? selectedUser.territories.join(', ') : (selectedUser.territories || '')} 
                        onChange={e => setSelectedUser({...selectedUser, territories: e.target.value})} 
                        className="bg-[#161618] border-[#222225] h-11 rounded-xl text-slate-200" 
                     />
                  </div>
                  <Button variant="ghost" className="w-full text-red-500 hover:bg-red-950/50 hover:text-red-400 h-11 uppercase text-[10px] font-bold rounded-xl border border-red-900/30" onClick={() => { setTransferToId(''); setIsDeleteOpen(true); }} disabled={selectedUser.id === currentUser?.id}><Trash2 className="w-4 h-4 mr-2" /> Dar de Baja</Button>
                </div>
              )}
              <DialogFooter>
                 <Button variant="ghost" onClick={() => setIsEditOpen(false)}>Cancelar</Button>
                 <Button onClick={handleUpdateUser} disabled={updating} className="bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold rounded-xl px-8 h-11 text-[10px] uppercase shadow-lg">{updating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2"/> + "Guardar"}</Button>
              </DialogFooter>
           </DialogContent>
        </Dialog>

        {/* DIALOGO DE ELIMINACIÓN CON TRANSFERENCIA */}
        <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
           <DialogContent className="bg-[#0f0f11] border-[#222225] text-white max-w-md rounded-3xl shadow-2xl">
              <DialogHeader>
                 <DialogTitle className="text-red-500 flex items-center gap-2 uppercase tracking-widest text-xs font-bold">
                    <ShieldAlert className="w-5 h-5"/> Protocolo de Baja y Transferencia
                 </DialogTitle>
                 <DialogDesc className="text-slate-400 text-xs mt-2">
                    Estás por eliminar a <strong>{selectedUser?.full_name}</strong>. Para evitar la pérdida de leads y ventas, debes transferir su cartera a otro miembro.
                 </DialogDesc>
              </DialogHeader>

              <div className="py-4 space-y-4">
                 <div className="space-y-2 bg-[#161618] p-4 rounded-xl border border-[#222225]">
                    <Label className="text-[10px] uppercase text-indigo-400 font-bold tracking-widest flex items-center gap-1.5">
                       <UserCheck className="w-3.5 h-3.5"/> Seleccionar Sucesor (Destino)
                    </Label>
                    <Select value={transferToId} onValueChange={setTransferToId}>
                       <SelectTrigger className="bg-[#0a0a0c] border-[#222225] h-11 rounded-xl text-slate-200">
                          <SelectValue placeholder="Elige quién heredará los activos..."/>
                       </SelectTrigger>
                       <SelectContent className="bg-[#121214] border-[#222225] text-white">
                          {users.filter(u => u.id !== selectedUser?.id && u.is_active).map(u => (
                             <SelectItem key={u.id} value={u.id}>{u.full_name} ({getRoleLabel(u.role)})</SelectItem>
                          ))}
                       </SelectContent>
                    </Select>
                 </div>

                 <div className="p-4 bg-red-950/20 border border-red-900/50 rounded-xl space-y-2">
                    <p className="text-[10px] text-red-400 font-bold uppercase flex items-center gap-2"><ArrowRight className="w-3 h-3"/> Se transferirán:</p>
                    <ul className="text-[10px] text-slate-400 space-y-1 list-disc pl-4">
                       <li>Todos los Leads asignados.</li>
                       <li>Historial de chats y notas.</li>
                       <li>Ventas a crédito activas (Responsable).</li>
                       <li>Recursos de conocimiento creados.</li>
                    </ul>
                 </div>
              </div>

              <DialogFooter className="gap-2">
                 <Button variant="ghost" onClick={() => setIsDeleteOpen(false)} className="rounded-xl font-bold uppercase text-[10px]">Cancelar</Button>
                 <Button 
                    onClick={handleDeleteUserFinal} 
                    disabled={deleting || !transferToId} 
                    className="bg-red-600 hover:bg-red-500 text-white font-bold px-8 h-11 rounded-xl shadow-lg uppercase text-[10px] tracking-widest"
                 >
                    {deleting ? <Loader2 className="w-4 h-4 animate-spin mr-2"/> : "Confirmar Baja y Transferir"}
                 </Button>
              </DialogFooter>
           </DialogContent>
        </Dialog>

      </div>
    </Layout>
  );
};

export default UsersPage;