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

const UsersPage = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // New User Form State
  const [newUsername, setNewUsername] = useState('');
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
      // NOTE: In client-side logic we can't create users without logging out.
      // This is simulated logic or instructions.
      
      const email = `${newUsername.toLowerCase().trim()}@samurai.local`;
      
      toast.info("Instrucciones para crear en Supabase Dashboard:", {
         description: `1. Auth > Users > Invite/Create\n2. Email: ${email}\n3. Pass: (temporal)\n4. Insertar fila en tabla 'profiles'.`
      });

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
                  <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded text-blue-400 text-xs">
                     ℹ️ El sistema usa el dominio interno <strong>@samurai.local</strong>.
                     Solo ingresa el nombre de usuario.
                  </div>
                  <div className="space-y-2">
                     <Label>Usuario</Label>
                     <div className="flex items-center gap-2">
                        <Input 
                           value={newUsername} 
                           onChange={e => setNewUsername(e.target.value)} 
                           className="bg-slate-950 border-slate-800 flex-1" 
                           placeholder="ej: gamey"
                        />
                        <span className="text-slate-500 text-sm font-mono">@samurai.local</span>
                     </div>
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
                     Generar Instrucciones
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
                  <TableHead className="text-slate-400">Email Interno</TableHead>
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
                        {u.username}@samurai.local
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