import React, { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Users as UsersIcon, UserPlus, Loader2, RefreshCw } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

const UsersPage = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [form, setForm] = useState({ email: '', password: '', fullName: '' });
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setUsers(data);
    }
    setLoading(false);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password.length < 6) {
      toast.error("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    setCreating(true);

    try {
      const { data, error } = await supabase.functions.invoke('admin-create-user', {
        body: { 
            email: form.email, 
            password: form.password, 
            fullName: form.fullName 
        }
      });

      if (error || !data.success) throw new Error(data?.error || "Error al crear usuario");
      
      toast.success("Usuario creado e activado instantáneamente.");
      
      fetchUsers();
      setIsDialogOpen(false);
      setForm({ email: '', password: '', fullName: '' });

    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
             <h1 className="text-3xl font-bold text-white mb-2">Gestión de Usuarios</h1>
             <p className="text-slate-400">Control de acceso total al sistema (Sin validación de email)</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={fetchUsers} disabled={loading} className="border-slate-800">
               <RefreshCw className={loading ? "animate-spin" : ""} size={16} />
            </Button>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                <Button className="bg-indigo-600 hover:bg-indigo-700">
                    <UserPlus className="w-4 h-4 mr-2" />
                    Nuevo Usuario
                </Button>
                </DialogTrigger>
                <DialogContent className="bg-slate-900 border-slate-800 text-white">
                <DialogHeader>
                    <DialogTitle>Crear Nuevo Usuario</DialogTitle>
                    <DialogDescription>El usuario se activará inmediatamente. No requiere confirmación de email.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreateUser} className="space-y-4 pt-4">
                    <div className="space-y-2">
                        <Label>Nombre Completo</Label>
                        <Input value={form.fullName} onChange={e => setForm({...form, fullName: e.target.value})} className="bg-slate-950 border-slate-800" placeholder="Nombre Apellido" required />
                    </div>
                    <div className="space-y-2">
                        <Label>Email Real</Label>
                        <Input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="bg-slate-950 border-slate-800" placeholder="email@gmail.com" required />
                    </div>
                    <div className="space-y-2">
                        <Label>Contraseña</Label>
                        <Input type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} className="bg-slate-950 border-slate-800" required />
                    </div>
                    <Button type="submit" className="w-full bg-indigo-600" disabled={creating}>
                        {creating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <UserPlus className="w-4 h-4 mr-2" />}
                        Activar Usuario Ahora
                    </Button>
                </form>
                </DialogContent>
            </Dialog>
          </div>
        </div>

        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="border-b border-slate-800">
            <CardTitle className="text-white flex items-center gap-2">
              <UsersIcon className="w-5 h-5 text-indigo-400" />
              Usuarios Registrados
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-slate-800 hover:bg-slate-900">
                  <TableHead className="text-slate-400">Usuario / Perfil</TableHead>
                  <TableHead className="text-slate-400">Rol</TableHead>
                  <TableHead className="text-slate-400">ID de Acceso (Email)</TableHead>
                  <TableHead className="text-slate-400">Estado</TableHead>
                  <TableHead className="text-slate-400 text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                   <TableRow>
                      <TableCell colSpan={5} className="text-center h-24 text-slate-500">
                         <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                      </TableCell>
                   </TableRow>
                ) : users.map((u) => (
                  <TableRow key={u.id} className="border-slate-800 hover:bg-slate-800/50">
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium text-slate-200">{u.full_name || 'Sin nombre'}</span>
                        <span className="text-[10px] text-slate-500 font-mono">UID: {u.id.substring(0,8)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`
                        ${u.role === 'admin' ? 'border-purple-500 text-purple-500' : 
                          u.role === 'dev' ? 'border-blue-500 text-blue-500' : 
                          'border-slate-500 text-slate-500'}
                      `}>
                        {u.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-slate-400 font-mono">
                        {u.username}@... (Inicia con Email real)
                    </TableCell>
                    <TableCell>
                       {u.is_active ? (
                          <span className="text-emerald-500 text-xs flex items-center gap-1 font-bold">
                             <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]"></div> ACTIVO
                          </span>
                       ) : (
                          <span className="text-red-500 text-xs">Inactivo</span>
                       )}
                    </TableCell>
                    <TableCell className="text-right">
                       <Button variant="ghost" size="sm" className="text-slate-500 hover:text-white">
                          Gestionar
                       </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default UsersPage;