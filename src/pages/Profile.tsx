import React, { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { UserCircle, Key, Loader2, Edit, Save, X, AlertTriangle, MapPin, MessageSquarePlus, Tag, Trash2, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { logActivity } from '@/utils/logger';

const Profile = () => {
  const { profile, user, fetchProfile, signOut } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loadingPassword, setLoadingPassword] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const [form, setForm] = useState({ fullName: '', email: '', phone: '' });

  // Local Settings
  const [localTemplates, setLocalTemplates] = useState<{id: string, title: string, text: string}[]>([]);
  const [localTags, setLocalTags] = useState<{id: string, text: string, color: string}[]>([]);
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    if (profile && user) {
      setForm({ fullName: profile.full_name || '', email: user.email || '', phone: profile.phone || '' });
      fetchLocalSettings();
    }
  }, [profile, user]);

  const fetchLocalSettings = async () => {
     if (!user) return;
     const { data } = await supabase.from('app_config').select('key, value').in('key', [`agent_templates_${user.id}`, `agent_tags_${user.id}`]);
     if (data) {
        const tpl = data.find(d => d.key === `agent_templates_${user.id}`)?.value;
        const tgs = data.find(d => d.key === `agent_tags_${user.id}`)?.value;
        if (tpl) try { setLocalTemplates(JSON.parse(tpl)); } catch(e){}
        if (tgs) try { setLocalTags(JSON.parse(tgs)); } catch(e){}
     }
  };

  const handleSaveLocalSettings = async () => {
     if (!user) return;
     setSavingSettings(true);
     try {
        await supabase.from('app_config').upsert([
           { key: `agent_templates_${user.id}`, value: JSON.stringify(localTemplates), category: 'USER_SETTINGS' },
           { key: `agent_tags_${user.id}`, value: JSON.stringify(localTags), category: 'USER_SETTINGS' }
        ], { onConflict: 'key' });
        toast.success("Configuraciones personales guardadas.");
     } catch (err: any) {
        toast.error("Error al guardar: " + err.message);
     } finally {
        setSavingSettings(false);
     }
  };

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingProfile(true);
    try {
      const emailChanged = form.email !== user?.email;

      if (emailChanged) {
        const { error: functionError } = await supabase.functions.invoke('update-user-email', { body: { email: form.email } });
        if (functionError) throw functionError;
      }

      const { error: profileError } = await supabase.from('profiles').update({ full_name: form.fullName, phone: form.phone }).eq('id', user?.id);
      if (profileError) throw profileError;

      await logActivity({ action: 'UPDATE', resource: 'USERS', description: `Usuario actualizó perfil`, status: 'OK' });

      if (emailChanged) {
          toast.success('¡Email actualizado al instante! Por seguridad, debes re-ingresar.');
          setTimeout(() => signOut(), 2000);
      } else {
          toast.success('Perfil actualizado correctamente');
          setIsEditing(false);
          if (fetchProfile && user) fetchProfile(user.id);
      }
    } catch (error: any) { toast.error(error.message); } finally { setLoadingProfile(false); }
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
      <div className="max-w-5xl mx-auto space-y-8 pb-16 animate-in fade-in duration-300">
        <div>
          <h1 className="text-3xl font-bold text-white mb-1">Mi Perfil y Entorno</h1>
          <p className="text-slate-400 text-sm">Gestiona tus datos de acceso, etiquetas personalizadas y respuestas rápidas.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
           <Card className="bg-[#0f0f11] border-[#222225] shadow-xl">
             <CardHeader className="flex flex-row items-center justify-between border-b border-[#161618] bg-[#161618] px-6 py-5">
               <CardTitle className="text-white flex items-center gap-2"><UserCircle className="w-5 h-5 text-indigo-400" /> Información Personal</CardTitle>
               {!isEditing ? (
                  <Button variant="outline" size="sm" className="h-8 border-[#333336] bg-[#0a0a0c] text-slate-300 hover:text-white" onClick={() => setIsEditing(true)}><Edit className="w-3 h-3 mr-2" /> Editar</Button>
               ) : (
                  <Button variant="ghost" size="sm" className="h-8 text-slate-400 hover:text-white" onClick={() => setIsEditing(false)}><X className="w-3 h-3 mr-2" /> Cancelar</Button>
               )}
             </CardHeader>
             <form onSubmit={handleProfileUpdate}>
               <CardContent className="space-y-5 p-6 bg-[#0a0a0c]">
                 <div className="space-y-2">
                   <Label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest ml-1">Nombre Completo</Label>
                   <Input value={form.fullName} onChange={(e) => setForm({...form, fullName: e.target.value})} disabled={!isEditing} className="bg-[#121214] border-[#222225] text-white disabled:opacity-70 h-11 rounded-xl" />
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest ml-1">WhatsApp</Label><Input value={form.phone} onChange={(e) => setForm({...form, phone: e.target.value})} disabled={!isEditing} className="bg-[#121214] border-[#222225] text-white disabled:opacity-70 font-mono h-11 rounded-xl" /></div>
                    <div className="space-y-2"><Label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest ml-1">Rol del Sistema</Label><div className="p-2 h-11 flex items-center bg-[#161618] rounded-xl border border-[#222225] text-indigo-400 uppercase font-bold tracking-widest text-xs">{getRoleLabel(profile?.role)}</div></div>
                 </div>
                 <div className="space-y-2 pt-4 border-t border-[#161618]">
                   <Label className="text-[10px] uppercase font-bold text-indigo-400 tracking-widest ml-1 flex items-center gap-1.5"><MapPin className="w-3 h-3"/> Zonas Asignadas (Routing IA)</Label>
                   <div className="flex flex-wrap gap-1.5 p-3 bg-[#121214] border border-[#222225] rounded-xl min-h-[40px]">
                      {profile?.territories && profile.territories.length > 0 ? (
                         profile.territories.map((t: string, i: number) => <Badge key={i} variant="outline" className="bg-[#161618] border-[#333336] text-slate-300">{t}</Badge>)
                      ) : (<span className="text-xs text-slate-500 italic mt-1">Global / Sin zonas asignadas.</span>)}
                   </div>
                 </div>
                 <div className="space-y-2 pt-4 border-t border-[#161618]">
                   <Label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest ml-1">Email (ID de Acceso)</Label>
                   <Input type="email" value={form.email} onChange={(e) => setForm({...form, email: e.target.value})} disabled={!isEditing} className="bg-[#121214] border-[#222225] text-white disabled:opacity-70 font-mono h-11 rounded-xl" />
                 </div>
               </CardContent>
             </form>
           </Card>
        </div>
      </div>
    </Layout>
  );
};

export default Profile;