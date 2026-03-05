import React, { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { UserCircle, Key, Loader2, Edit, Save, X } from 'lucide-react';
import { toast } from 'sonner';
import { logActivity } from '@/utils/logger';

const Profile = () => {
  const { profile, user, fetchProfile } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loadingPassword, setLoadingPassword] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const [form, setForm] = useState({ fullName: '', email: '' });

  useEffect(() => {
    if (profile && user) {
      setForm({
        fullName: profile.full_name || '',
        email: user.email || ''
      });
    }
  }, [profile, user]);

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingProfile(true);
    try {
      // Actualizar email en Supabase Auth usando la Edge Function
      if (form.email !== user?.email) {
        const { error: functionError } = await supabase.functions.invoke('update-user-email', {
          body: { newEmail: form.email }
        });
        if (functionError) throw functionError;
        toast.info("Revisa tu nuevo email para confirmar el cambio. Puede que necesites volver a iniciar sesión.");
      }

      // Actualizar nombre en la tabla de perfiles
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ full_name: form.fullName })
        .eq('id', user?.id);
      
      if (profileError) throw profileError;

      await logActivity({
        action: 'UPDATE',
        resource: 'USERS',
        description: 'Usuario actualizó su perfil',
        status: 'OK'
      });

      toast.success('Perfil actualizado correctamente');
      setIsEditing(false);
      if (fetchProfile && user) fetchProfile(user.id); // Refrescar datos del perfil
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoadingProfile(false);
    }
  };

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

    setLoadingPassword(true);
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
    } finally {
      setLoadingPassword(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold text-white mb-2">Mi Perfil</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
           <Card className="bg-slate-900 border-slate-800">
             <CardHeader className="flex flex-row items-center justify-between">
               <CardTitle className="text-white flex items-center gap-2">
                 <UserCircle className="w-5 h-5 text-indigo-400" />
                 Información Personal
               </CardTitle>
               {!isEditing ? (
                  <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)}><Edit className="w-3 h-3 mr-2" /> Editar</Button>
               ) : (
                  <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}><X className="w-3 h-3 mr-2" /> Cancelar</Button>
               )}
             </CardHeader>
             <form onSubmit={handleProfileUpdate}>
               <CardContent className="space-y-4">
                 <div className="space-y-2">
                   <Label className="text-slate-400">Nombre Completo</Label>
                   <Input 
                     value={form.fullName}
                     onChange={(e) => setForm({...form, fullName: e.target.value})}
                     disabled={!isEditing}
                     className="bg-slate-950 border-slate-800 text-white disabled:opacity-70"
                   />
                 </div>
                 <div className="space-y-2">
                   <Label className="text-slate-400">Email</Label>
                   <Input 
                     type="email"
                     value={form.email}
                     onChange={(e) => setForm({...form, email: e.target.value})}
                     disabled={!isEditing}
                     className="bg-slate-950 border-slate-800 text-white disabled:opacity-70"
                   />
                 </div>
                 <div className="space-y-1">
                   <Label className="text-slate-400">Rol</Label>
                   <div className="p-2 h-10 flex items-center bg-slate-950 rounded border border-slate-800 text-white uppercase font-mono text-sm">
                     {profile?.role || 'User'}
                   </div>
                 </div>
               </CardContent>
               {isEditing && (
                 <CardFooter>
                   <Button type="submit" className="w-full bg-indigo-600" disabled={loadingProfile}>
                     {loadingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                     Guardar Cambios
                   </Button>
                 </CardFooter>
               )}
             </form>
           </Card>

           <Card className="bg-slate-900 border-slate-800">
             <CardHeader>
               <CardTitle className="text-white flex items-center gap-2">
                 <Key className="w-5 h-5 text-red-500" />
                 Cambiar Contraseña
               </CardTitle>
               <CardDescription>Asegúrate de usar una contraseña segura.</CardDescription>
             </CardHeader>
             <form onSubmit={handlePasswordChange}>
               <CardContent className="space-y-4">
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
               </CardContent>
               <CardFooter>
                 <Button 
                    type="submit" 
                    className="w-full bg-red-600 hover:bg-red-700" 
                    disabled={loadingPassword || !password}
                  >
                    {loadingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Actualizar Contraseña'}
                 </Button>
               </CardFooter>
             </form>
           </Card>
        </div>
      </div>
    </Layout>
  );
};

export default Profile;