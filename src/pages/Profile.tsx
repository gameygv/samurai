import React, { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { UserCircle, Loader2, Edit, Save, X, MapPin, Clock, Bot, CreditCard, Target, CalendarDays } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { logActivity } from '@/utils/logger';

const defaultWorkingHours = {
  1: { active: true, start: '08:00', end: '22:00' }, // Lunes
  2: { active: true, start: '08:00', end: '22:00' }, // Martes
  3: { active: true, start: '08:00', end: '22:00' }, // Miércoles
  4: { active: true, start: '08:00', end: '22:00' }, // Jueves
  5: { active: true, start: '08:00', end: '22:00' }, // Viernes
  6: { active: false, start: '08:00', end: '14:00' }, // Sábado
  0: { active: false, start: '08:00', end: '14:00' }, // Domingo
};

const DAYS_OF_WEEK = [
  { id: 1, name: 'Lunes' }, { id: 2, name: 'Martes' }, { id: 3, name: 'Miércoles' },
  { id: 4, name: 'Jueves' }, { id: 5, name: 'Viernes' }, { id: 6, name: 'Sábado' }, { id: 0, name: 'Domingo' }
];

const Profile = () => {
  const { profile, user, fetchProfile, signOut } = useAuth();
  const [form, setForm] = useState({ fullName: '', email: '', phone: '' });
  
  const [isEditing, setIsEditing] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(false);

  // Local Settings
  const [schedule, setSchedule] = useState<any>({ enabled: false, working_hours: defaultWorkingHours });
  const [bank, setBank] = useState({ enabled: false, bank_name: '', bank_account: '', bank_clabe: '', bank_holder: '' });
  const [closing, setClosing] = useState({ auto_close: true });
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    if (profile && user) {
      setForm({ fullName: profile.full_name || '', email: user.email || '', phone: profile.phone || '' });
      fetchLocalSettings();
    }
  }, [profile, user]);

  const fetchLocalSettings = async () => {
     if (!user) return;
     const { data } = await supabase.from('app_config').select('key, value').in('key', [
        `agent_schedule_${user.id}`, 
        `agent_bank_${user.id}`,
        `agent_closing_${user.id}`
     ]);

     if (data) {
        const scheduleData = data.find(d => d.key === `agent_schedule_${user.id}`)?.value;
        const bankData = data.find(d => d.key === `agent_bank_${user.id}`)?.value;
        const closingData = data.find(d => d.key === `agent_closing_${user.id}`)?.value;
        
        if (scheduleData) {
            try { 
               const parsed = JSON.parse(scheduleData); 
               // Migración para usuarios viejos
               if (!parsed.working_hours) {
                  parsed.working_hours = { ...defaultWorkingHours };
                  Object.keys(parsed.working_hours).forEach(k => {
                     parsed.working_hours[k].start = parsed.start || '08:00';
                     parsed.working_hours[k].end = parsed.end || '22:00';
                  });
               }
               setSchedule({ ...parsed, enabled: !!parsed.enabled }); 
            } catch(e){}
        }
        if (bankData) {
            try { 
                const parsed = JSON.parse(bankData); 
                setBank({ ...bank, ...parsed, enabled: !!parsed.enabled }); 
            } catch(e){}
        }
        if (closingData) {
            try { 
                const parsed = JSON.parse(closingData); 
                setClosing({ auto_close: parsed.auto_close !== false }); 
            } catch(e){}
        }
     }
  };

  const handleSaveLocalSettings = async () => {
     if (!user) return;
     setSavingSettings(true);
     try {
        await supabase.from('app_config').upsert([
           { key: `agent_schedule_${user.id}`, value: JSON.stringify(schedule), category: 'USER_SETTINGS' },
           { key: `agent_bank_${user.id}`, value: JSON.stringify(bank), category: 'USER_SETTINGS' },
           { key: `agent_closing_${user.id}`, value: JSON.stringify(closing), category: 'USER_SETTINGS' }
        ], { onConflict: 'key' });
        toast.success("Configuración personal guardada exitosamente.");
     } catch (err: any) {
        toast.error("Error al guardar: " + err.message);
     } finally {
        setSavingSettings(false);
     }
  };

  const updateDaySchedule = (dayId: number, field: string, value: any) => {
     setSchedule((prev: any) => ({
        ...prev,
        working_hours: {
           ...prev.working_hours,
           [dayId]: {
              ...prev.working_hours[dayId],
              [field]: value
           }
        }
     }));
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
          <p className="text-slate-400 text-sm">Gestiona tus datos de acceso, horario y estrategia de ventas.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
           <Card className="bg-[#0f0f11] border-[#222225] shadow-xl h-fit">
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
           <Card className="bg-[#0f0f11] border-[#222225] shadow-xl border-l-4 border-l-amber-500 h-fit md:row-span-2">
             <CardHeader className="border-b border-[#161618] bg-[#161618] px-6 py-5">
               <CardTitle className="text-white flex items-center gap-2"><CalendarDays className="w-5 h-5 text-amber-500" /> Mi Disponibilidad (Horario)</CardTitle>
               <CardDescription className="text-xs text-slate-400 mt-1">
                 Fuera de tu horario o en tus días de descanso, el bot se encenderá automáticamente para no dejar al cliente en visto.
               </CardDescription>
             </CardHeader>
             <CardContent className="space-y-6 p-6 bg-[#0a0a0c]">
                 <div className="flex items-center justify-between bg-[#161618] p-4 rounded-xl border border-[#222225]">
                    <div className="space-y-1 flex-1 cursor-pointer" onClick={() => setSchedule({...schedule, enabled: !schedule.enabled})}>
                       <Label htmlFor="switch-horario" className="text-white font-bold text-sm cursor-pointer">Habilitar Auto-Asistente</Label>
                       <p className="text-[10px] text-slate-400">Protege tu guardia nocturna y fines de semana.</p>
                    </div>
                    <Switch id="switch-horario" checked={!!schedule?.enabled} onCheckedChange={(c) => setSchedule({...schedule, enabled: c})} />
                 </div>

                 {schedule?.enabled && (
                    <div className="space-y-3 animate-in slide-in-from-top-2">
                       {DAYS_OF_WEEK.map((day) => {
                          const dayCfg = schedule.working_hours?.[day.id] || { active: false, start: '08:00', end: '22:00' };
                          return (
                             <div key={day.id} className="flex items-center gap-3 p-3 bg-[#121214] border border-[#222225] rounded-xl transition-colors hover:border-[#333336]">
                                {/* FIX: Se ha expandido el ancho para que el Switch de Sábado y Domingo no se oculte */}
                                <div className="w-[110px] flex items-center gap-2 shrink-0">
                                   <Switch checked={!!dayCfg.active} onCheckedChange={(c) => updateDaySchedule(day.id, 'active', c)} className="scale-75 origin-left" />
                                   <span className={`text-[11px] font-bold ${dayCfg.active ? 'text-slate-200' : 'text-slate-600'}`}>{day.name}</span>
                                </div>
                                <div className="flex-1 flex items-center gap-2">
                                   {dayCfg.active ? (
                                      <>
                                         <Input type="time" value={dayCfg.start} onChange={e => updateDaySchedule(day.id, 'start', e.target.value)} className="h-8 text-xs bg-[#0a0a0c] border-[#333336] text-white px-2" />
                                         <span className="text-slate-600 text-xs">a</span>
                                         <Input type="time" value={dayCfg.end} onChange={e => updateDaySchedule(day.id, 'end', e.target.value)} className="h-8 text-xs bg-[#0a0a0c] border-[#333336] text-white px-2" />
                                      </>
                                   ) : (
                                      <span className="text-[10px] text-amber-500/80 uppercase font-bold tracking-widest flex items-center gap-1.5 bg-amber-950/20 px-2 py-1 rounded-md w-full justify-center">
                                         <Bot className="w-3 h-3"/> Día Libre
                                      </span>
                                   )}
                                </div>
                             </div>
                          );
                       })}
                    </div>
                 )}

                 <Button onClick={handleSaveLocalSettings} disabled={savingSettings} className="w-full bg-[#161618] hover:bg-[#222225] border border-[#333336] text-slate-300 font-bold h-11 rounded-xl shadow-lg uppercase tracking-widest text-[10px]">
                    {savingSettings ? <Loader2 className="w-4 h-4 animate-spin mr-2"/> : <Save className="w-4 h-4 mr-2"/>} Guardar Horario
                 </Button>
             </CardContent>
           </Card>

           {/* TARJETA DE ESTRATEGIA DE CIERRE */}
           <Card className="bg-[#0f0f11] border-[#222225] shadow-xl border-l-4 border-l-indigo-500 h-fit">
             <CardHeader className="border-b border-[#161618] bg-[#161618] px-6 py-5">
               <CardTitle className="text-white flex items-center gap-2"><Target className="w-5 h-5 text-indigo-500" /> Estrategia de Cierre (IA)</CardTitle>
               <CardDescription className="text-xs text-slate-400 mt-1">
                 Decide si quieres que la IA procese el pago o prefieres cerrarlo tú manualmente.
               </CardDescription>
             </CardHeader>
             <CardContent className="space-y-6 p-6 bg-[#0a0a0c]">
                 <div className="flex items-center justify-between bg-[#161618] p-4 rounded-xl border border-[#222225]">
                    <div className="space-y-1 flex-1 cursor-pointer" onClick={() => setClosing({ ...closing, auto_close: !closing.auto_close })}>
                       <Label htmlFor="switch-cierre" className="text-white font-bold text-sm cursor-pointer">Cierre de Ventas Automático</Label>
                       <p className="text-[10px] text-slate-400 max-w-[200px]">La IA enviará métodos de pago y cuentas bancarias.</p>
                    </div>
                    <Switch id="switch-cierre" checked={!!closing?.auto_close} onCheckedChange={(c) => setClosing({ ...closing, auto_close: c })} />
                 </div>

                 {!closing?.auto_close && (
                    <div className="bg-indigo-900/10 border border-indigo-500/20 p-4 rounded-xl flex items-start gap-3 animate-in slide-in-from-top-2">
                       <Bot className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                       <p className="text-[10px] text-indigo-200 leading-relaxed">
                          La IA <strong>ocultará</strong> los precios y métodos de pago. Cuando el cliente quiera comprar, el bot detendrá la venta y le informará que tú ({profile?.full_name?.split(' ')[0] || 'su asesor'}) te pondrás en contacto personalmente para brindarle los detalles.
                       </p>
                    </div>
                 )}

                 <Button onClick={handleSaveLocalSettings} disabled={savingSettings} className="w-full bg-[#161618] hover:bg-[#222225] border border-[#333336] text-slate-300 font-bold h-11 rounded-xl shadow-lg uppercase tracking-widest text-[10px]">
                    {savingSettings ? <Loader2 className="w-4 h-4 animate-spin mr-2"/> : <Save className="w-4 h-4 mr-2"/>} Guardar Estrategia
                 </Button>
             </CardContent>
           </Card>

           {/* TARJETA DE BANCO PERSONAL */}
           <Card className="bg-[#0f0f11] border-[#222225] shadow-xl border-l-4 border-l-emerald-500 h-fit">
             <CardHeader className="border-b border-[#161618] bg-[#161618] px-6 py-5">
               <CardTitle className="text-white flex items-center gap-2"><CreditCard className="w-5 h-5 text-emerald-500" /> Cuenta Bancaria Personal</CardTitle>
               <CardDescription className="text-xs text-slate-400 mt-1">
                 Si la activas, la IA dará esta cuenta en lugar de la general.
               </CardDescription>
             </CardHeader>
             <CardContent className="space-y-6 p-6 bg-[#0a0a0c]">
                 <div className="flex items-center justify-between bg-[#161618] p-4 rounded-xl border border-[#222225]">
                    <div className="space-y-1 flex-1 cursor-pointer" onClick={() => setBank({...bank, enabled: !bank.enabled})}>
                       <Label htmlFor="switch-banco" className="text-emerald-400 font-bold text-sm cursor-pointer">Usar mi cuenta propia</Label>
                       <p className="text-[10px] text-slate-400">Sobrescribe los datos de pago para mis leads.</p>
                    </div>
                    <Switch id="switch-banco" checked={!!bank?.enabled} onCheckedChange={(c) => setBank({...bank, enabled: c})} />
                 </div>

                 {bank?.enabled && (
                    <div className="space-y-4 animate-in slide-in-from-top-2">
                       <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                             <Label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest ml-1">Banco</Label>
                             <Input value={bank.bank_name} onChange={e => setBank({...bank, bank_name: e.target.value})} className="bg-[#121214] border-[#222225] text-white h-11 rounded-xl" placeholder="Ej: BBVA" />
                          </div>
                          <div className="space-y-2">
                             <Label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest ml-1">Titular</Label>
                             <Input value={bank.bank_holder} onChange={e => setBank({...bank, bank_holder: e.target.value})} className="bg-[#121214] border-[#222225] text-white h-11 rounded-xl" placeholder="Nombre completo" />
                          </div>
                       </div>
                       <div className="space-y-2">
                          <Label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest ml-1">Número de Cuenta / Tarjeta</Label>
                          <Input value={bank.bank_account} onChange={e => setBank({...bank, bank_account: e.target.value})} className="bg-[#121214] border-[#222225] text-white font-mono h-11 rounded-xl" />
                       </div>
                       <div className="space-y-2">
                          <Label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest ml-1">CLABE Interbancaria</Label>
                          <Input value={bank.bank_clabe} onChange={e => setBank({...bank, bank_clabe: e.target.value})} className="bg-[#121214] border-[#222225] text-white font-mono h-11 rounded-xl" />
                       </div>
                    </div>
                 )}

                 <Button onClick={handleSaveLocalSettings} disabled={savingSettings} className="w-full bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold h-11 rounded-xl shadow-lg uppercase tracking-widest text-[10px]">
                    {savingSettings ? <Loader2 className="w-4 h-4 animate-spin mr-2"/> : <Save className="w-4 h-4 mr-2"/>} Guardar Datos Bancarios
                 </Button>
             </CardContent>
           </Card>
        </div>
      </div>
    </Layout>
  );
};

export default Profile;