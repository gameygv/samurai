import React, { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UserCircle, Key, Loader2, Edit, Save, X, AlertTriangle, MapPin, Phone, MessageSquarePlus, Tag, Trash2, Plus } from 'lucide-react';
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
        // FIXED: El parámetro correcto es 'email', no 'newEmail'
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

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) return toast.error('Las contraseñas no coinciden');
    if (password.length < 6) return toast.error('La contraseña debe tener al menos 6 caracteres');

    setLoadingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      await logActivity({ action: 'UPDATE', resource: 'AUTH', description: 'Usuario cambió su contraseña', status: 'OK' });
      toast.success('Contraseña actualizada correctamente');
      setPassword(''); setConfirmPassword('');
    } catch (error: any) { toast.error(error.message); } finally { setLoadingPassword(false); }
  };

  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-6 pb-12">
        <h1 className="text-3xl font-bold text-white mb-2">Mi Perfil y Entorno</h1>

        <Tabs defaultValue="perfil" className="w-full">
           <TabsList className="bg-slate-900 border border-slate-800 p-1 mb-6 rounded-xl">
              <TabsTrigger value="perfil" className="gap-2"><UserCircle className="w-4 h-4"/> Perfil Operativo</TabsTrigger>
              <TabsTrigger value="plantillas" className="gap-2"><MessageSquarePlus className="w-4 h-4"/> Mis Plantillas</TabsTrigger>
              <TabsTrigger value="etiquetas" className="gap-2"><Tag className="w-4 h-4"/> Mis Etiquetas</TabsTrigger>
           </TabsList>

           <TabsContent value="perfil" className="mt-0">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <Card className="bg-slate-900 border-slate-800">
                   <CardHeader className="flex flex-row items-center justify-between">
                     <CardTitle className="text-white flex items-center gap-2"><UserCircle className="w-5 h-5 text-indigo-400" /> Información Personal</CardTitle>
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
                         <Input value={form.fullName} onChange={(e) => setForm({...form, fullName: e.target.value})} disabled={!isEditing} className="bg-slate-950 border-slate-800 text-white disabled:opacity-70" />
                       </div>
                       <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2"><Label className="text-slate-400">WhatsApp de Contacto</Label><Input value={form.phone} onChange={(e) => setForm({...form, phone: e.target.value})} disabled={!isEditing} className="bg-slate-950 border-slate-800 text-white disabled:opacity-70 font-mono" /></div>
                          <div className="space-y-2"><Label className="text-slate-400">Rol del Sistema</Label><div className="p-2 h-10 flex items-center bg-slate-950 rounded-md border border-slate-800 text-indigo-400 uppercase font-bold tracking-widest text-xs">{profile?.role || 'User'}</div></div>
                       </div>
                       <div className="space-y-2 pt-2 border-t border-slate-800">
                         <Label className="text-slate-400 flex items-center gap-2"><MapPin className="w-3.5 h-3.5"/> Zonas Asignadas (Routing IA)</Label>
                         <div className="flex flex-wrap gap-1.5 p-2 bg-slate-950 border border-slate-800 rounded-md min-h-[40px]">
                            {profile?.territories && profile.territories.length > 0 ? (
                               profile.territories.map((t: string, i: number) => <Badge key={i} variant="outline" className="bg-slate-900 border-slate-700 text-slate-300">{t}</Badge>)
                            ) : (<span className="text-xs text-slate-500 italic mt-1">Recibes todo el tráfico (Global) o no tienes zonas.</span>)}
                         </div>
                       </div>
                       <div className="space-y-2 pt-2 border-t border-slate-800">
                         <Label className="text-slate-400">Email (ID de Acceso)</Label>
                         <Input type="email" value={form.email} onChange={(e) => setForm({...form, email: e.target.value})} disabled={!isEditing} className="bg-slate-950 border-slate-800 text-white disabled:opacity-70 font-mono" />
                         {isEditing && <p className="text-[10px] text-amber-500 flex items-center gap-1 mt-1"><AlertTriangle size={12} /> Al cambiar el email, se cerrará tu sesión actual.</p>}
                       </div>
                     </CardContent>
                     {isEditing && (
                       <CardFooter><Button type="submit" className="w-full bg-indigo-600" disabled={loadingProfile}>{loadingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-2" />} Guardar Cambios</Button></CardFooter>
                     )}
                   </form>
                 </Card>

                 <Card className="bg-slate-900 border-slate-800 h-fit">
                   <CardHeader>
                     <CardTitle className="text-white flex items-center gap-2"><Key className="w-5 h-5 text-red-500" /> Cambiar Contraseña</CardTitle>
                   </CardHeader>
                   <form onSubmit={handlePasswordChange}>
                     <CardContent className="space-y-4">
                       <div className="space-y-2"><Label className="text-slate-300">Nueva Contraseña</Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="bg-slate-950 border-slate-800" /></div>
                       <div className="space-y-2"><Label className="text-slate-300">Confirmar Contraseña</Label><Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="bg-slate-950 border-slate-800" /></div>
                     </CardContent>
                     <CardFooter><Button type="submit" className="w-full bg-red-600 hover:bg-red-700" disabled={loadingPassword || !password}>{loadingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Actualizar Contraseña'}</Button></CardFooter>
                   </form>
                 </Card>
              </div>
           </TabsContent>

           <TabsContent value="plantillas" className="mt-0">
              <Card className="bg-slate-900 border-slate-800 border-l-4 border-l-indigo-500">
                 <CardHeader className="flex flex-row items-center justify-between border-b border-slate-800 bg-slate-950/30">
                    <div>
                       <CardTitle className="text-white flex items-center gap-2"><MessageSquarePlus className="w-5 h-5 text-indigo-400" /> Mis Plantillas Privadas</CardTitle>
                       <CardDescription className="text-xs">Respuestas rápidas que solo aparecerán en tu panel de chat.</CardDescription>
                    </div>
                    <div className="flex gap-2">
                       <Button onClick={() => setLocalTemplates([...localTemplates, { id: Date.now().toString(), title: '', text: '' }])} variant="outline" className="border-slate-700 text-slate-300 hover:text-white"><Plus className="w-4 h-4 mr-2"/> Añadir</Button>
                       <Button onClick={handleSaveLocalSettings} disabled={savingSettings} className="bg-indigo-600 hover:bg-indigo-700 shadow-lg"><Save className="w-4 h-4 mr-2"/> Guardar</Button>
                    </div>
                 </CardHeader>
                 <CardContent className="space-y-4 pt-6">
                    {localTemplates.length === 0 ? (
                       <div className="text-center py-10 text-slate-500 italic text-sm">No tienes plantillas personales creadas.</div>
                    ) : localTemplates.map(qr => (
                       <div key={qr.id} className="p-4 bg-slate-950 border border-slate-800 rounded-xl flex gap-4 items-start group">
                          <div className="flex-1 space-y-3">
                             <Input value={qr.title} onChange={e => setLocalTemplates(localTemplates.map(t => t.id === qr.id ? {...t, title: e.target.value} : t))} placeholder="Título (Ej: Mi Saludo)" className="bg-slate-900 border-slate-700 h-9 text-xs font-bold text-white" />
                             <Textarea value={qr.text} onChange={e => setLocalTemplates(localTemplates.map(t => t.id === qr.id ? {...t, text: e.target.value} : t))} placeholder="Mensaje..." className="bg-slate-900 border-slate-700 text-xs min-h-[80px]" />
                          </div>
                          <Button variant="ghost" size="icon" onClick={() => setLocalTemplates(localTemplates.filter(t => t.id !== qr.id))} className="text-slate-500 hover:text-red-500"><Trash2 className="w-4 h-4" /></Button>
                       </div>
                    ))}
                 </CardContent>
              </Card>
           </TabsContent>

           <TabsContent value="etiquetas" className="mt-0">
              <Card className="bg-slate-900 border-slate-800 border-l-4 border-l-amber-500">
                 <CardHeader className="flex flex-row items-center justify-between border-b border-slate-800 bg-slate-950/30">
                    <div>
                       <CardTitle className="text-white flex items-center gap-2"><Tag className="w-5 h-5 text-amber-500" /> Mis Etiquetas de Segmentación</CardTitle>
                       <CardDescription className="text-xs">Personaliza colores para organizar tus leads visualmente.</CardDescription>
                    </div>
                    <div className="flex gap-2">
                       <Button onClick={() => setLocalTags([...localTags, { id: Date.now().toString(), text: '', color: '#3b82f6' }])} variant="outline" className="border-slate-700 text-slate-300 hover:text-white"><Plus className="w-4 h-4 mr-2"/> Añadir Etiqueta</Button>
                       <Button onClick={handleSaveLocalSettings} disabled={savingSettings} className="bg-indigo-600 hover:bg-indigo-700 shadow-lg"><Save className="w-4 h-4 mr-2"/> Guardar</Button>
                    </div>
                 </CardHeader>
                 <CardContent className="space-y-4 pt-6">
                    {localTags.length === 0 ? (
                       <div className="text-center py-10 text-slate-500 italic text-sm">No tienes etiquetas personales creadas.</div>
                    ) : localTags.map(tag => (
                       <div key={tag.id} className="p-4 bg-slate-950 border border-slate-800 rounded-xl flex gap-4 items-center group">
                          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                             <div className="space-y-1">
                                <Label className="text-[10px] uppercase font-bold text-slate-500">Texto de la Etiqueta</Label>
                                <Input value={tag.text} onChange={e => setLocalTags(localTags.map(t => t.id === tag.id ? {...t, text: e.target.value.toUpperCase()} : t))} placeholder="Ej: VIP" className="bg-slate-900 border-slate-700 h-9 text-xs font-bold text-white uppercase" />
                             </div>
                             <div className="space-y-1">
                                <Label className="text-[10px] uppercase font-bold text-slate-500">Color (Hex/Tailwind)</Label>
                                <div className="flex items-center gap-2">
                                   <input type="color" value={tag.color} onChange={e => setLocalTags(localTags.map(t => t.id === tag.id ? {...t, color: e.target.value} : t))} className="w-9 h-9 rounded cursor-pointer bg-slate-900 border border-slate-700 p-0" />
                                   <Input value={tag.color} onChange={e => setLocalTags(localTags.map(t => t.id === tag.id ? {...t, color: e.target.value} : t))} className="bg-slate-900 border-slate-700 h-9 text-xs font-mono w-28" />
                                   <Badge style={{ backgroundColor: tag.color + '20', color: tag.color, borderColor: tag.color + '50' }} className="ml-4 px-3 border shadow-sm">{tag.text || 'VISTA PREVIA'}</Badge>
                                </div>
                             </div>
                          </div>
                          <Button variant="ghost" size="icon" onClick={() => setLocalTags(localTags.filter(t => t.id !== tag.id))} className="text-slate-500 hover:text-red-500 mt-5"><Trash2 className="w-4 h-4" /></Button>
                       </div>
                    ))}
                 </CardContent>
              </Card>
           </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default Profile;