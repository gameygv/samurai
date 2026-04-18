import React, { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { UserCircle, Loader2, Edit, X, CreditCard, Target, Bot, CalendarDays, Plus, X as XIcon } from 'lucide-react';
import { toast } from 'sonner';

const DAYS_OF_WEEK = [
  { id: 1, name: 'Lunes' }, { id: 2, name: 'Martes' }, { id: 3, name: 'Miércoles' },
  { id: 4, name: 'Jueves' }, { id: 5, name: 'Viernes' }, { id: 6, name: 'Sábado' }, { id: 0, name: 'Domingo' }
];
interface TimeRange { start: string; end: string; }
interface DaySchedule { active: boolean; ranges: TimeRange[]; }
interface AiSchedule { [dayId: string]: DaySchedule; }


const Profile = () => {
  const { profile, user, fetchProfile, signOut } = useAuth();
  const [form, setForm] = useState({ fullName: '', email: '', phone: '' });
  
  const [isEditing, setIsEditing] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(false);

  // Local Settings
  const [bank, setBank] = useState({ enabled: false, bank_name: '', bank_account: '', bank_clabe: '', bank_holder: '' });
  const [closing, setClosing] = useState({ auto_close: true });
  const [savingSettings, setSavingSettings] = useState(false);

  // Agent self AI control
  const [selfAiEnabled, setSelfAiEnabled] = useState(true);
  const [selfAiSchedule, setSelfAiSchedule] = useState<AiSchedule>({});
  const [savingAi, setSavingAi] = useState(false);
  // Admin override indicator
  const [adminAiEnabled, setAdminAiEnabled] = useState<boolean | null>(null);
  const [adminHasSchedule, setAdminHasSchedule] = useState(false);

  useEffect(() => {
    if (profile && user) {
      setForm({ fullName: profile.full_name || '', email: user.email || '', phone: profile.phone || '' });
      fetchLocalSettings();
    }
  }, [profile, user]);

  const fetchLocalSettings = async () => {
     if (!user) return;
     const { data } = await supabase.from('app_config').select('key, value').in('key', [
        `agent_bank_${user.id}`,
        `agent_closing_${user.id}`,
        `agent_self_ai_status_${user.id}`,
        `agent_self_schedule_${user.id}`,
        `agent_ai_status_${user.id}`,
        `agent_ai_schedule_${user.id}`
     ]);

     if (data) {
        const bankData = data.find(d => d.key === `agent_bank_${user.id}`)?.value;
        const closingData = data.find(d => d.key === `agent_closing_${user.id}`)?.value;

        if (bankData) {
            try {
                const parsed = JSON.parse(bankData);
                setBank(prev => ({ ...prev, ...parsed, enabled: Boolean(parsed.enabled) }));
            } catch(e){}
        }
        if (closingData) {
            try {
                const parsed = JSON.parse(closingData);
                setClosing({ auto_close: parsed.auto_close !== false });
            } catch(e){}
        }

        // Agent self AI config
        const selfStatusData = data.find(d => d.key === `agent_self_ai_status_${user.id}`)?.value;
        const selfScheduleData = data.find(d => d.key === `agent_self_schedule_${user.id}`)?.value;
        if (selfStatusData) { try { const p = JSON.parse(selfStatusData); setSelfAiEnabled(p.enabled !== false); } catch(e){} }
        if (selfScheduleData) { try { setSelfAiSchedule(JSON.parse(selfScheduleData)); } catch(e){} }

        // Admin override indicators (read-only for agent)
        const adminStatusData = data.find(d => d.key === `agent_ai_status_${user.id}`)?.value;
        const adminScheduleData = data.find(d => d.key === `agent_ai_schedule_${user.id}`)?.value;
        if (adminStatusData) { try { const p = JSON.parse(adminStatusData); setAdminAiEnabled(p.enabled !== false ? true : false); } catch(e){} }
        if (adminScheduleData) {
          try {
            const s = JSON.parse(adminScheduleData);
            setAdminHasSchedule(Object.values(s).some((d: any) => d?.active));
          } catch(e){}
        }
     }
  };

  const handleSaveLocalSettings = async () => {
     if (!user) return;
     setSavingSettings(true);
     try {
        await supabase.from('app_config').upsert([
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

  const handleSaveAiSelf = async () => {
    if (!user) return;
    setSavingAi(true);
    try {
      await supabase.from('app_config').upsert([
        { key: `agent_self_ai_status_${user.id}`, value: JSON.stringify({ enabled: selfAiEnabled, updated_at: new Date().toISOString(), source: 'self' }), category: 'AI_CONTROL' },
        { key: `agent_self_schedule_${user.id}`, value: JSON.stringify(selfAiSchedule), category: 'AI_CONTROL' }
      ], { onConflict: 'key' });
      toast.success(selfAiEnabled ? "IA activada." : "IA desactivada.");
    } catch (err: any) {
      toast.error("Error: " + err.message);
    } finally { setSavingAi(false); }
  };

  const updateSelfDaySchedule = (dayId: number, field: string, value: any) => {
    setSelfAiSchedule(prev => {
      const dayCfg = prev[dayId.toString()] || { active: false, ranges: [{ start: '09:00', end: '21:00' }] };
      return { ...prev, [dayId.toString()]: { ...dayCfg, [field]: value } };
    });
  };

  const addSelfTimeRange = (dayId: number) => {
    setSelfAiSchedule(prev => {
      const dayCfg = prev[dayId.toString()] || { active: true, ranges: [] };
      return { ...prev, [dayId.toString()]: { ...dayCfg, ranges: [...dayCfg.ranges, { start: '14:00', end: '21:00' }] } };
    });
  };

  const removeSelfTimeRange = (dayId: number, rangeIdx: number) => {
    setSelfAiSchedule(prev => {
      const dayCfg = prev[dayId.toString()];
      if (!dayCfg) return prev;
      return { ...prev, [dayId.toString()]: { ...dayCfg, ranges: dayCfg.ranges.filter((_, i) => i !== rangeIdx) } };
    });
  };

  const updateSelfTimeRange = (dayId: number, rangeIdx: number, field: 'start' | 'end', value: string) => {
    setSelfAiSchedule(prev => {
      const dayCfg = prev[dayId.toString()];
      if (!dayCfg) return prev;
      return { ...prev, [dayId.toString()]: { ...dayCfg, ranges: dayCfg.ranges.map((r, i) => i === rangeIdx ? { ...r, [field]: value } : r) } };
    });
  };

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingProfile(true);
    try {
      const emailChanged = form.email !== user?.email;
      if (emailChanged) {
        const { error } = await supabase.functions.invoke('update-user-email', { body: { email: form.email } });
        if (error) throw error;
      }
      const { error } = await supabase.from('profiles').update({ full_name: form.fullName, phone: form.phone }).eq('id', user?.id);
      if (error) throw error;
      if (emailChanged) {
          toast.success('Email actualizado. Por seguridad, re-ingresa.');
          setTimeout(() => signOut(), 2000);
      } else {
          toast.success('Perfil actualizado.');
          setIsEditing(false);
          if (fetchProfile && user) fetchProfile(user.id);
      }
    } catch (error: any) { toast.error(error.message); } finally { setLoadingProfile(false); }
  };

  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-8 pb-16 animate-in fade-in duration-300">
        <div><h1 className="text-3xl font-bold text-white mb-1">Mi Perfil y Entorno</h1><p className="text-slate-400 text-sm">Gestiona tus datos de acceso, horario y estrategia de ventas.</p></div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
           <Card className="bg-[#0f0f11] border-[#222225] shadow-xl h-fit">
             <CardHeader className="flex flex-row items-center justify-between border-b border-[#161618] bg-[#161618] px-6 py-5">
               <CardTitle className="text-white flex items-center gap-2"><UserCircle className="w-5 h-5 text-indigo-400" /> Información Personal</CardTitle>
               {!isEditing ? <Button variant="outline" size="sm" className="h-8" onClick={() => setIsEditing(true)}><Edit className="w-3 h-3 mr-2" /> Editar</Button> : <Button variant="ghost" size="sm" className="h-8" onClick={() => setIsEditing(false)}><X className="w-3 h-3 mr-2" /> Cancelar</Button>}
             </CardHeader>
             <form onSubmit={handleProfileUpdate}>
               <CardContent className="space-y-5 p-6 bg-[#0a0a0c]">
                 <div className="space-y-2"><Label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest ml-1">Nombre Completo</Label><Input value={form.fullName} onChange={(e) => setForm({...form, fullName: e.target.value})} disabled={!isEditing} className="bg-[#121214] border-[#222225]" /></div>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest ml-1">WhatsApp</Label><Input value={form.phone} onChange={(e) => setForm({...form, phone: e.target.value})} disabled={!isEditing} className="bg-[#121214] border-[#222225]" /></div>
                    <div className="space-y-2"><Label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest ml-1">Rol</Label><div className="p-2 h-11 flex items-center bg-[#161618] rounded-xl border border-[#222225] text-indigo-400 uppercase font-bold text-xs">{profile?.role}</div></div>
                 </div>
                 <div className="space-y-2 pt-4 border-t border-[#161618]">
                    <Label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest ml-1">Email de Acceso</Label>
                    <Input type="email" value={form.email} onChange={(e) => setForm({...form, email: e.target.value})} disabled={!isEditing} className="bg-[#121214] border-[#222225]" />
                 </div>
                 {isEditing && <Button type="submit" disabled={loadingProfile} className="w-full bg-indigo-600 mt-4">Guardar Perfil</Button>}
               </CardContent>
             </form>
           </Card>

           <Card className="bg-[#0f0f11] border-[#222225] shadow-xl border-l-4 border-l-indigo-500 h-fit">
             <CardHeader className="bg-[#161618] px-6 py-5">
               <CardTitle className="text-white flex items-center gap-2"><Target className="w-5 h-5 text-indigo-500" /> Estrategia de Cierre</CardTitle>
             </CardHeader>
             <CardContent className="space-y-4 p-6 bg-[#0a0a0c]">
                 <div className="flex items-center justify-between bg-[#161618] p-4 rounded-xl border border-[#222225]">
                    <Label className="text-white font-bold text-sm cursor-pointer" onClick={() => setClosing({ auto_close: !closing.auto_close })}>Venta Automática</Label>
                    <Switch checked={Boolean(closing?.auto_close)} onCheckedChange={(c) => setClosing({ auto_close: c })} />
                 </div>
                 <Button onClick={handleSaveLocalSettings} disabled={savingSettings} className="w-full bg-[#161618] border border-[#333336]">Guardar Estrategia</Button>
             </CardContent>
           </Card>

           <Card className="bg-[#0f0f11] border-[#222225] shadow-xl border-l-4 border-l-emerald-500 h-fit">
             <CardHeader className="bg-[#161618] px-6 py-5">
               <CardTitle className="text-white flex items-center gap-2"><CreditCard className="w-5 h-5 text-emerald-500" /> Banco Personal</CardTitle>
             </CardHeader>
             <CardContent className="space-y-4 p-6 bg-[#0a0a0c]">
                 <div className="flex items-center justify-between bg-[#161618] p-4 rounded-xl border border-[#222225]">
                    <Label className="text-white font-bold text-sm cursor-pointer" onClick={() => setBank({...bank, enabled: !bank.enabled})}>Usar mi cuenta</Label>
                    <Switch checked={Boolean(bank?.enabled)} onCheckedChange={(c) => setBank({...bank, enabled: c})} />
                 </div>
                 {bank?.enabled && (
                    <div className="space-y-3">
                       <Input value={bank.bank_name} onChange={e => setBank({...bank, bank_name: e.target.value})} placeholder="Banco" className="bg-[#121214]" />
                       <Input value={bank.bank_account} onChange={e => setBank({...bank, bank_account: e.target.value})} placeholder="Cuenta" className="bg-[#121214]" />
                       <Input value={bank.bank_clabe} onChange={e => setBank({...bank, bank_clabe: e.target.value})} placeholder="CLABE" className="bg-[#121214]" />
                    </div>
                 )}
                 <Button onClick={handleSaveLocalSettings} disabled={savingSettings} className="w-full bg-[#161618] border border-[#333336]">Guardar Banco</Button>
             </CardContent>
           </Card>

           {/* Control IA del Agente */}
           <Card className="bg-[#0f0f11] border-[#222225] shadow-xl border-l-4 border-l-cyan-500 h-fit md:col-span-2">
             <CardHeader className="bg-[#161618] px-6 py-5">
               <CardTitle className="text-white flex items-center gap-2"><Bot className="w-5 h-5 text-cyan-500" /> Mi Control IA</CardTitle>
             </CardHeader>
             <CardContent className="space-y-5 p-6 bg-[#0a0a0c]">
                {/* Admin override warning */}
                {adminAiEnabled === false && (
                  <div className="bg-red-950/40 border border-red-500/30 rounded-xl p-4 text-red-300 text-xs">
                    <strong>⚠️ Tu administrador ha desactivado la IA para tu cuenta.</strong> Tu configuración personal no tendrá efecto hasta que el admin la reactive.
                  </div>
                )}
                {adminHasSchedule && (
                  <div className="bg-amber-950/30 border border-amber-500/20 rounded-xl p-3 text-amber-300 text-[10px]">
                    📋 Tu administrador ha configurado un horario IA para tu cuenta. Ese horario tiene prioridad. Tu horario personal solo aplica fuera del horario del admin.
                  </div>
                )}

                {/* Self AI toggle */}
                <div className="flex items-center justify-between bg-[#161618] p-4 rounded-xl border border-[#222225]">
                   <div>
                      <Label className="text-white font-bold text-sm cursor-pointer" onClick={() => setSelfAiEnabled(!selfAiEnabled)}>Asistente IA Activo</Label>
                      <p className="text-[10px] text-slate-400 mt-1">Activa o desactiva la IA para tus leads.</p>
                   </div>
                   <Switch checked={selfAiEnabled} onCheckedChange={setSelfAiEnabled} />
                </div>

                {/* Self schedule */}
                <div className="space-y-3">
                   <Label className="text-[10px] text-cyan-500 uppercase font-bold ml-1 flex items-center gap-1.5">
                      <CalendarDays className="w-3.5 h-3.5"/> Mi Horario IA
                   </Label>
                   <p className="text-[9px] text-slate-500 ml-1">Define tus horarios de atención IA. Fuera de estos horarios, la IA no responderá a tus leads.</p>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {DAYS_OF_WEEK.map((day) => {
                         const dayCfg = selfAiSchedule[day.id.toString()] || { active: false, ranges: [{ start: '09:00', end: '21:00' }] };
                         return (
                            <div key={day.id} className="p-3 bg-[#121214] border border-[#222225] rounded-xl space-y-2">
                               <div className="flex items-center gap-3">
                                  <Switch checked={Boolean(dayCfg.active)} onCheckedChange={(c) => updateSelfDaySchedule(day.id, 'active', c)} />
                                  <span className="text-xs font-bold w-16 text-slate-300">{day.name}</span>
                                  {!dayCfg.active && <span className="text-[10px] text-slate-600 uppercase font-bold flex-1 text-center">SIN HORARIO</span>}
                                  {dayCfg.active && (
                                     <Button type="button" variant="ghost" size="sm" className="ml-auto h-6 px-2 text-[9px] text-cyan-500 hover:text-cyan-400" onClick={() => addSelfTimeRange(day.id)}>
                                        <Plus className="w-3 h-3 mr-1" /> Rango
                                     </Button>
                                  )}
                               </div>
                               {dayCfg.active && dayCfg.ranges.map((range, idx) => (
                                  <div key={idx} className="flex items-center gap-2 ml-9">
                                     <Input type="time" value={range.start} onChange={e => updateSelfTimeRange(day.id, idx, 'start', e.target.value)} className="h-7 bg-[#0a0a0c] text-xs w-28 border-[#333336]" />
                                     <span className="text-slate-600 text-xs">-</span>
                                     <Input type="time" value={range.end} onChange={e => updateSelfTimeRange(day.id, idx, 'end', e.target.value)} className="h-7 bg-[#0a0a0c] text-xs w-28 border-[#333336]" />
                                     {dayCfg.ranges.length > 1 && (
                                        <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-500 hover:text-red-400" onClick={() => removeSelfTimeRange(day.id, idx)}>
                                           <XIcon className="w-3 h-3" />
                                        </Button>
                                     )}
                                  </div>
                               ))}
                            </div>
                         );
                      })}
                   </div>
                </div>

                <Button onClick={handleSaveAiSelf} disabled={savingAi} className="w-full bg-cyan-700 hover:bg-cyan-600 text-white h-10 uppercase text-[10px] font-bold rounded-xl">
                   {savingAi ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Bot className="w-4 h-4 mr-2" />} Guardar Control IA
                </Button>
             </CardContent>
           </Card>
        </div>
      </div>
    </Layout>
  );
};

export default Profile;