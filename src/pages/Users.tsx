import React, { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Users as UsersIcon, UserPlus, Loader2, RefreshCw, Shield, Trash2, Edit3, Save, X, ShieldAlert, Lock, Phone, MapPin } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { logActivity } from '@/utils/logger';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';

const UsersPage = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [createForm, setCreateForm] = useState({ email: '', password: '', fullName: '', phone: '', territories: '' });
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => { fetchUsers(); }, []);

  const fetchUsers = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    if (!error && data) setUsers(data);
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
      
      // Actualizar perfil con los nuevos campos
      const territoriesArray = createForm.territories.split(',').map(s => s.trim()).filter(Boolean);
      await supabase.from('profiles').update({ 
         phone: createForm.phone, 
         territories: territoriesArray 
      }).eq('id', data.user.id);

      await logActivity({ action: 'CREATE', resource: 'USERS', description: `Nuevo usuario creado: ${createForm.email}`, status: 'OK' });
      toast.success("Usuario activado instantáneamente.");
      fetchUsers();
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
           role: selectedUser.role, 
           is_active: selectedUser.is_active, 
           full_name: selectedUser.full_name,
           phone: selectedUser.phone,
           territories: territoriesArray
        }).eq('id', selectedUser.id);
        
        if (error) throw error;
        await logActivity({ action: 'UPDATE', resource: 'USERS', description: `Permisos actualizados para: ${selectedUser.username}`, status: 'OK' });
        toast.success("Perfil de usuario actualizado");
        setIsEditOpen(false);
        fetchUsers();
     } catch (err: any) {
        toast.error(err.message);
     } finally {
        setUpdating(false);
     }
  };

  const handleDeleteUser = async (id: string, name: string) => {
     if (id === currentUser?.id) {
         toast.error("Error de seguridad: No puedes eliminarte a ti mismo.");
         return;
     }
     if (!confirm(`¿ESTÁS SEGURO? Esto eliminará a ${name} permanentemente del sistema.`)) return;
     const tid = toast.loading("Eliminando usuario...");
     try {
        const { error } = await supabase.functions.invoke('manage-auth-users', { body: { action: 'DELETE', userId: id } });
        if (error) throw error;
        await logActivity({ action: 'DELETE', resource: 'USERS', description: `Usuario eliminado: ${name}`, status: 'OK' });
        toast.success("Usuario borrado definitivamente", { id: tid });
        fetchUsers();
        setIsEditOpen(false);
     } catch (err: any) {
        toast.error(err.message, { id: tid });
     }
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-6 pb-12">
        <div className="flex items-center justify-between">
          <div><h1 className="text-3xl font-bold text-white mb-2">Gestión de Usuarios</h1><p className="text-slate-400">Control de acceso y territorios de agentes.</p></div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={fetchUsers} disabled={loading} className="border-slate-800 text-slate-400"><RefreshCw className={loading ? "animate-spin" : ""} size={16} /></Button>
            <Button onClick={() => setIsCreateOpen(true)} className="bg-indigo-600 hover:bg-indigo-700"><UserPlus className="w-4 h-4 mr-2" /> Nuevo Usuario</Button>
          </div>
        </div>

        <Card className="bg-slate-900 border-slate-800"><CardHeader className="border-b border-slate-800"><CardTitle className="text-white flex items-center gap-2"><UsersIcon className="w-5 h-5 text-indigo-400" /> Directorio del Sistema</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow className="border-slate-800 hover:bg-slate-900">
                 <TableHead className="text-slate-400">Usuario</TableHead>
                 <TableHead className="text-slate-400">Rol</TableHead>
                 <TableHead className="text-slate-400">Territorio</TableHead>
                 <TableHead className="text-slate-400">Estado</TableHead>
                 <TableHead className="text-slate-400 text-right">Acciones</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {loading ? (<TableRow><TableCell colSpan={5} className="text-center h-48"><Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-500" /></TableCell></TableRow>) : 
                  users.map((u) => (
                  <TableRow key={u.id} className="border-slate-800 hover:bg-slate-800/50 transition-colors">
                    <TableCell>
                       <div className="flex flex-col">
                          <span className="font-bold text-slate-200">{u.full_name || 'Sin nombre'} {u.id === currentUser?.id && <Badge variant="secondary" className="ml-2 text-[8px] bg-indigo-900/50 text-indigo-300">TÚ</Badge>}</span>
                          <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1"><Phone className="w-2.5 h-2.5"/> {u.phone || 'Sin WhatsApp'}</span>
                          <span className="text-[10px] text-slate-600 mt-0.5">{u.username}@...</span>
                       </div>
                    </TableCell>
                    <TableCell><Badge variant="outline" className={cn("text-[10px] font-bold uppercase tracking-wider", u.role === 'admin' ? 'border-purple-500 text-purple-500 bg-purple-500/5' : u.role === 'dev' ? 'border-blue-500 text-blue-500 bg-blue-500/5' : u.role === 'sales' ? 'border-emerald-500 text-emerald-500 bg-emerald-500/5' : 'border-slate-500 text-slate-400')}>{u.role}</Badge></TableCell>
                    <TableCell>
                       <div className="flex gap-1 flex-wrap max-w-[200px]">
                          {u.territories && u.territories.length > 0 ? (
                             u.territories.map((t: string, i: number) => <Badge key={i} variant="outline" className="text-[9px] border-slate-700 text-slate-400 bg-slate-950">{t}</Badge>)
                          ) : (
                             <span className="text-[10px] text-slate-500 italic">Global (Sin zona)</span>
                          )}
                       </div>
                    </TableCell>
                    <TableCell>{u.is_active ? (<span className="text-emerald-500 text-[10px] flex items-center gap-1.5 font-bold uppercase tracking-widest"><div className="w-2 h-2 rounded-full bg-emerald-500"></div> AUTORIZADO</span>) : (<Badge variant="destructive" className="text-[9px]">SUSPENDIDO</Badge>)}</TableCell>
                    <TableCell className="text-right"><Button variant="ghost" size="sm" className="text-amber-500 hover:bg-amber-500/10" onClick={() => { setSelectedUser(u); setIsEditOpen(true); }}><Edit3 className="w-4 h-4 mr-2" /> GESTIONAR</Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* DIALOGO DE CREACIÓN */}
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
           <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-lg">
              <DialogHeader><DialogTitle>Añadir Miembro al Equipo</DialogTitle></DialogHeader>
              <form onSubmit={handleCreateUser} className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-2"><Label>Nombre Completo *</Label><Input value={createForm.fullName} onChange={e => setCreateForm({...createForm, fullName: e.target.value})} className="bg-slate-950 border-slate-800" placeholder="Ej: Juan Pérez" required /></div>
                   <div className="space-y-2"><Label>Teléfono WhatsApp</Label><Input value={createForm.phone} onChange={e => setCreateForm({...createForm, phone: e.target.value})} className="bg-slate-950 border-slate-800" placeholder="521..." /></div>
                </div>
                <div className="space-y-2"><Label>Email de Acceso *</Label><Input type="email" value={createForm.email} onChange={e => setCreateForm({...createForm, email: e.target.value})} className="bg-slate-950 border-slate-800" placeholder="email@gmail.com" required /></div>
                <div className="space-y-2"><Label>Contraseña *</Label><Input type="password" value={createForm.password} onChange={e => setCreateForm({...createForm, password: e.target.value})} className="bg-slate-950 border-slate-800" required /></div>
                
                <div className="space-y-2 pt-2 border-t border-slate-800">
                   <Label className="flex items-center gap-2 text-indigo-400"><MapPin className="w-4 h-4"/> Territorios de Venta (Separados por coma)</Label>
                   <Input 
                      value={createForm.territories} 
                      onChange={e => setCreateForm({...createForm, territories: e.target.value})} 
                      className="bg-slate-950 border-slate-800" 
                      placeholder="Ej: Guadalajara, Jalisco, Colima" 
                   />
                   <p className="text-[10px] text-slate-500">La IA usará esto para asignar clientes geográficamente.</p>
                </div>

                <Button type="submit" className="w-full bg-indigo-600" disabled={creating}>{creating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <UserPlus className="w-4 h-4 mr-2" />} Activar Ahora</Button>
              </form>
           </DialogContent>
        </Dialog>

        {/* DIALOGO DE EDICIÓN */}
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
           <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-lg">
              <DialogHeader><DialogTitle className="flex items-center gap-2"><Shield className="w-5 h-5 text-amber-500" /> Gestionar Agente</DialogTitle></DialogHeader>
              {selectedUser && (
                <div className="space-y-6 py-4">
                  <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-2"><Label>Nombre</Label><Input value={selectedUser.full_name} onChange={e => setSelectedUser({...selectedUser, full_name: e.target.value})} className="bg-slate-950 border-slate-800" /></div>
                     <div className="space-y-2"><Label>Teléfono WhatsApp</Label><Input value={selectedUser.phone || ''} onChange={e => setSelectedUser({...selectedUser, phone: e.target.value})} className="bg-slate-950 border-slate-800" /></div>
                  </div>
                  
                  <div className="space-y-2 pt-2 border-t border-slate-800">
                     <Label className="flex items-center gap-2 text-indigo-400"><MapPin className="w-4 h-4"/> Zonas Asignadas (Separadas por comas)</Label>
                     <Input 
                        value={Array.isArray(selectedUser.territories) ? selectedUser.territories.join(', ') : (selectedUser.territories || '')} 
                        onChange={e => setSelectedUser({...selectedUser, territories: e.target.value})} 
                        className="bg-slate-950 border-slate-800" 
                        placeholder="Ej: Monterrey, Nuevo Leon, Saltillo"
                     />
                  </div>

                  <div className="space-y-2 pt-2 border-t border-slate-800"><Label>Rol del Sistema</Label>
                    <Select value={selectedUser.role} onValueChange={v => setSelectedUser({...selectedUser, role: v})} disabled={selectedUser.id === currentUser?.id}>
                      <SelectTrigger className="bg-slate-950 border-slate-800"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-slate-900 border-slate-800 text-white">
                         <SelectItem value="admin">Administrador</SelectItem>
                         <SelectItem value="dev">Developer</SelectItem>
                         <SelectItem value="sales">Ventas (Recibe Leads Locales)</SelectItem>
                         <SelectItem value="agent">Soporte</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-slate-950 rounded-xl border border-slate-800">
                     <div className="space-y-0.5"><Label>Acceso</Label><p className="text-[10px] text-slate-500 uppercase font-bold">CRM Habilitado</p></div>
                     <Switch checked={selectedUser.is_active} onCheckedChange={c => setSelectedUser({...selectedUser, is_active: c})} disabled={selectedUser.id === currentUser?.id} />
                  </div>
                  
                  <div className="pt-4 border-t border-slate-800"><Button variant="ghost" className="w-full text-red-500 hover:bg-red-500/10 h-10 uppercase text-[10px] font-bold tracking-widest" onClick={() => handleDeleteUser(selectedUser.id, selectedUser.full_name)} disabled={selectedUser.id === currentUser?.id}><Trash2 className="w-3.5 h-3.5 mr-2" /> Eliminar Permanentemente</Button></div>
                </div>
              )}
              <DialogFooter className="gap-2 sm:gap-0"><Button variant="ghost" onClick={() => setIsEditOpen(false)}>Cancelar</Button><Button onClick={handleUpdateUser} disabled={updating} className="bg-amber-600 hover:bg-amber-700 text-slate-900 font-bold">{updating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />} Guardar Todo</Button></DialogFooter>
           </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default UsersPage;