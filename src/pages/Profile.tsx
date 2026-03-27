import React, { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { UserCircle, Key, Loader2, Edit, Save, X, MapPin, Clock, Bot } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { logActivity } from '@/utils/logger';

const Profile = () => {
  const { profile, user, fetchProfile, signOut } = useAuth();
  const [form, setForm] = useState({ fullName: '', email: '', phone: '' });
  
  const [isEditing, setIsEditing] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(false);

  // Local Settings
  const [schedule, setSchedule] = useState({ enabled: false, start: '08:00', end: '22:00' });
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    if (profile && user) {
      setForm({ fullName: profile.full_name || '', email: user.email || '', phone: profile.phone || '' });
      fetchLocalSettings();
    }
  }, [profile, user]);

  const fetchLocalSettings = async () => {
     if (!user) return;
     const { data } = await supabase.from('app_config').select('key, value').eq('key', `agent_schedule_${user.id}`).maybeSingle();
     if (data?.value) {
        try { setSchedule(JSON.parse(data.value)); } catch(e){}
     }
  };

  const handleSaveLocalSettings = async () => {
     if (!user) return;
     setSavingSettings(true);
     try {
        await supabase.from('app_config').upsert([
           { key: `agent_schedule_${user.id}`, value: JSON.stringify(schedule), category: 'USER_SETTINGS' }
        ], { onConflict: 'key' });
        toast.success("Horario automático guardado.");
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
          <p className="text-slate-400 text-sm">Gestiona tus datos de acceso y tu horario de trabajo con la IA.</p>
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
                 
                 {isEditing && (
                    <Button type="submit" disabled={loadingProfile} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold h-11 rounded-xl shadow-lg uppercase tracking-widest text-[10px] mt-4">
                       {loadingProfile ? <Loader2 className="w-4 h-4 animate-spin mr-2"/> : <Save className="w-4 h-4 mr-2"/>} Guardar Perfil
                    </Button>
                 )}
               </CardContent>
             </form>
           </Card>

           {/* TARJETA DE HORARIO AUTOMATICO */}
           <Card className="bg-[#0f0f11] border-[#222225] shadow-xl border-l-4 border-l-amber-500 h-fit">
             <CardHeader className="border-b border-[#161618] bg-[#161618] px-6 py-5">
               <CardTitle className="text-white flex items-center gap-2"><Clock className="w-5 h-5 text-amber-500" /> Horario de Trabajo (IA Automática)</CardTitle>
               <CardDescription className="text-xs text-slate-400 mt-1">
                 Define tu turno. Fuera de este horario, el bot se encenderá automáticamente para atender a los clientes de tus canales.
               </CardDescription>
             </CardHeader>
             <CardContent className="space-y-6 p-6 bg-[#0a0a0c]">
                 <div className="flex items-center justify-between bg-[#161618] p-4 rounded-xl border border-[#222225]">
                    <div className="space-y-1">
                       <Label className="text-white font-bold text-sm">Habilitar Auto-IA</Label>
                       <p className="text-[10px] text-slate-400">Si está activo, la IA cubrirá tu guardia nocturna.</p>
                    </div>
                    <Switch checked={schedule.enabled} onCheckedChange={(c) => setSchedule({...schedule, enabled: c})} />
                 </div>

                 {schedule.enabled && (
                    <div className="grid grid-cols-2 gap-4 animate-in slide-in-from-top-2">
                       <div className="space-y-2">
                          <Label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest ml-1">Hora Inicio Turno</Label>
                          <Input type="time" value={schedule.start} onChange={e => setSchedule({...schedule, start: e.target.value})} className="bg-[#121214] border-[#222225] text-white h-11 rounded-xl text-center text-lg" />
                       </div>
                       <div className="space-y-2">
                          <Label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest ml-1">Hora Fin Turno</Label>
                          <Input type="time" value={schedule.end} onChange={e => setSchedule({...schedule, end: e.target.value})} className="bg-[#121214] border-[#222225] text-white h-11 rounded-xl text-center text-lg" />
                       </div>
                    </div>
                 )}

                 <div className="bg-indigo-900/10 border border-indigo-500/20 p-4 rounded-xl flex items-start gap-3">
                    <Bot className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                    <p className="text-[10px] text-indigo-200 leading-relaxed">
                       Ejemplo: Si tu turno es de <strong>08:00 a 22:00</strong>, el bot permanecerá pausado (o como tú lo dejes) durante el día, pero a las 22:01 tomará el control de todos tus chats hasta las 07:59 am.
                    </p>
                 </div>

                 <Button onClick={handleSaveLocalSettings} disabled={savingSettings} className="w-full bg-amber-600 hover:bg-amber-500 text-slate-900 font-bold h-11 rounded-xl shadow-lg uppercase tracking-widest text-[10px]">
                    {savingSettings ? <Loader2 className="w-4 h-4 animate-spin mr-2"/> : <Save className="w-4 h-4 mr-2"/>} Guardar Horario
                 </Button>
             </CardContent>
           </Card>
        </div>
      </div>
    </Layout>
  );
};

export default Profile;