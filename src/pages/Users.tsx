import React, { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Users as UsersIcon, UserPlus, Loader2 } from 'lucide-react';
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
      const { data, error } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data: {
            full_name: form.fullName,
          }
        }
      });

      if (error) throw error;
      
      // El trigger 'handle_new_user' en Supabase se encargará de crear el perfil con rol 'dev'.
      toast.success("Usuario creado exitosamente.", {
        description: "Se ha enviado un correo de confirmación a la nueva dirección."
      });
      
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
             <p className="text-slate-400">Control de acceso y roles del sistema</p>
          </div>
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
                  <DialogDescription>El nuevo usuario recibirá un correo para confirmar su cuenta. El rol por defecto es DEV.</DialogDescription>
               </DialogHeader>
               <form onSubmit={handleCreateUser} className="space-y-4 pt-4">
                  <div className="space-y-2">
                     <Label>Nombre Completo</Label>
                     <Input value={form.fullName} onChange={e => setForm({...form, fullName: e.target.value})} className="bg-slate-950 border-slate-800" placeholder="Nombre Apellido" required />
                  </div>
                  <div className="space-y-2">
                     <Label>Email</Label>
                     <Input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="bg-slate-950 border-slate-800" placeholder="email@ejemplo.com" required />
                  </div>
                  <div className="space-y-2">
                     <Label>Contraseña Temporal</Label>
                     <Input type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} className="bg-slate-950 border-slate-800" required />
                  </div>
                  <Button type="submit" className="w-full bg-indigo-600" disabled={creating}>
                     {creating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <UserPlus className="w-4 h-4 mr-2" />}
                     Crear Usuario
                  </Button>
               </form>
            </DialogContent>
          </Dialog>
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
                  <TableHead className="text-slate-400">Usuario</TableHead>
                  <TableHead className="text-slate-400">Rol</TableHead>
                  <TableHead className="text-slate-400">Email</TableHead>
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
                        <span className="font-medium text-slate-200">{u.username || 'Sin usuario'}</span>
                        <span className="text-xs text-slate-500">{u.full_name}</span>
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
                    <TableCell className="text-xs text-slate-500 font-mono">
                        {/* Aquí deberíamos obtener el email de auth.users, pero por simplicidad mostramos el username */}
                        {u.username}@...
                    </TableCell>
                    <TableCell>
                       {u.is_active ? (
                          <span className="text-green-500 text-xs flex items-center gap-1">
                             <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div> Activo
                          </span>
                       ) : (
                          <span className="text-red-500 text-xs">Inactivo</span>
                       )}
                    </TableCell>
                    <TableCell className="text-right">
                       <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white">
                          Editar
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