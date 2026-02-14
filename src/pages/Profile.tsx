import React, { useState } from 'react';
import Layout from '@/components/Layout';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { UserCircle, Key, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { logActivity } from '@/utils/logger';

const Profile = () => {
  const { profile, user } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error('Las contraseñas no coinciden');
      return;
    }
    if (password.length < 6) {
      toast.error('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });

      if (error) throw error;

      await logActivity({
        action: 'UPDATE',
        resource: 'AUTH',
        description: 'Usuario cambió su contraseña',
        status: 'OK'
      });

      toast.success('Contraseña actualizada correctamente');
      setPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      toast.error(error.message);
      await logActivity({
        action: 'ERROR',
        resource: 'AUTH',
        description: 'Fallo al cambiar contraseña',
        status: 'ERROR',
        metadata: { error: error.message }
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold text-white mb-2">Mi Perfil</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
           {/* Info Card */}
           <Card className="bg-slate-900 border-slate-800">
             <CardHeader>
               <CardTitle className="text-white flex items-center gap-2">
                 <UserCircle className="w-5 h-5 text-indigo-400" />
                 Información Personal
               </CardTitle>
             </CardHeader>
             <CardContent className="space-y-4">
               <div className="space-y-1">
                 <Label className="text-slate-400">Nombre Completo</Label>
                 <div className="p-2 bg-slate-950 rounded border border-slate-800 text-white">
                   {profile?.full_name || 'No definido'}
                 </div>
               </div>
               <div className="space-y-1">
                 <Label className="text-slate-400">Email</Label>
                 <div className="p-2 bg-slate-950 rounded border border-slate-800 text-white">
                   {user?.email}
                 </div>
               </div>
               <div className="space-y-1">
                 <Label className="text-slate-400">Rol</Label>
                 <div className="p-2 bg-slate-950 rounded border border-slate-800 text-white uppercase font-mono text-sm">
                   {profile?.role || 'User'}
                 </div>
               </div>
             </CardContent>
           </Card>

           {/* Password Card */}
           <Card className="bg-slate-900 border-slate-800">
             <CardHeader>
               <CardTitle className="text-white flex items-center gap-2">
                 <Key className="w-5 h-5 text-red-500" />
                 Cambiar Contraseña
               </CardTitle>
               <CardDescription>Asegúrate de usar una contraseña segura.</CardDescription>
             </CardHeader>
             <CardContent>
               <form onSubmit={handlePasswordChange} className="space-y-4">
                 <div className="space-y-2">
                   <Label className="text-slate-300">Nueva Contraseña</Label>
                   <Input 
                     type="password" 
                     className="bg-slate-950 border-slate-800 text-white"
                     value={password}
                     onChange={(e) => setPassword(e.target.value)}
                   />
                 </div>
                 <div className="space-y-2">
                   <Label className="text-slate-300">Confirmar Contraseña</Label>
                   <Input 
                     type="password" 
                     className="bg-slate-950 border-slate-800 text-white"
                     value={confirmPassword}
                     onChange={(e) => setConfirmPassword(e.target.value)}
                   />
                 </div>
                 <Button 
                    type="submit" 
                    className="w-full bg-red-600 hover:bg-red-700" 
                    disabled={loading || !password}
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Actualizar Contraseña'}
                 </Button>
               </form>
             </CardContent>
           </Card>
        </div>
      </div>
    </Layout>
  );
};

export default Profile;