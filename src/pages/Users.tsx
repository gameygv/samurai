import React, { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Users as UsersIcon, UserPlus, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { logActivity } from '@/utils/logger';

const UsersPage = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // New User Form State
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserRole, setNewUserRole] = useState('supervisor');
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
    setCreating(true);

    try {
      // 1. Create in Auth (Admin capability only via Supabase Edge Function usually, 
      // but here simulating client-side creation for demo or if RLS allows)
      // NOTE: In a real app, use supabase.auth.admin.createUser via a secure edge function.
      // Here we assume the user is manually added or we use a workaround if enabled.
      // For this demo, we will simulate the success message instructing to use Supabase Dashboard
      // because client-side `signUp` creates a session, logging out the admin.
      
      toast.info("Para crear usuarios, por favor usa el Dashboard de Supabase > Authentication", {
         description: "El SDK del cliente no permite crear otros usuarios sin cerrar tu sesión actual."
      });
      
      // LOGIC MOCK for UI
      /*
      await logActivity({
         action: 'CREATE',
         resource: 'USERS',
         description: `Intentó crear usuario: ${newUserName}`,
         status: 'OK'
      });
      */

    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setCreating(false);
      setIsDialogOpen(false);
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
               </DialogHeader>
               <form onSubmit={handleCreateUser} className="space-y-4 pt-4">
                  <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded text-yellow-500 text-xs">
                     ⚠️ Nota: Por seguridad, la creación directa está deshabilitada en el cliente. Usa el Dashboard de Supabase.
                  </div>
                  <div className="space-y-2">
                     <Label>Email</Label>
                     <Input 
                        value={newUserEmail} 
                        onChange={e => setNewUserEmail(e.target.value)} 
                        className="bg-slate-950 border-slate-800" 
                        placeholder="usuario@samurai.local"
                     />
                  </div>
                  <div className="space-y-2">
                     <Label>Nombre Completo</Label>
                     <Input 
                        value={newUserName} 
                        onChange={e => setNewUserName(e.target.value)} 
                        className="bg-slate-950 border-slate-800" 
                        placeholder="Nombre Apellido"
                     />
                  </div>
                  <div className="space-y-2">
                     <Label>Rol</Label>
                     <Select value={newUserRole} onValueChange={setNewUserRole}>
                        <SelectTrigger className="bg-slate-950 border-slate-800">
                           <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-slate-800 text-white">
                           <SelectItem value="supervisor">Supervisor</SelectItem>
                           <SelectItem value="dev">Desarrollador</SelectItem>
                           <SelectItem value="admin">Administrador</SelectItem>
                        </SelectContent>
                     </Select>
                  </div>
                  <Button type="submit" className="w-full bg-indigo-600" disabled={creating}>
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
                  <TableHead className="text-slate-400">Estado</TableHead>
                  <TableHead className="text-slate-400">Creado</TableHead>
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
                        <span className="text-xs text-slate-500">{u.username}</span>
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
                    <TableCell>
                       {u.is_active ? (
                          <span className="text-green-500 text-xs flex items-center gap-1">
                             <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div> Activo
                          </span>
                       ) : (
                          <span className="text-red-500 text-xs">Inactivo</span>
                       )}
                    </TableCell>
                    <TableCell className="text-slate-500 text-xs">
                       {new Date(u.created_at).toLocaleDateString()}
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