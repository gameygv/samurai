import React, { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { UserCircle, Loader2, Edit, X, CreditCard, Target } from 'lucide-react';
import { toast } from 'sonner';


const Profile = () => {
  const { profile, user, fetchProfile, signOut } = useAuth();
  const [form, setForm] = useState({ fullName: '', email: '', phone: '' });
  
  const [isEditing, setIsEditing] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(false);

  // Local Settings
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
        `agent_bank_${user.id}`,
        `agent_closing_${user.id}`
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
        </div>
      </div>
    </Layout>
  );
};

export default Profile;