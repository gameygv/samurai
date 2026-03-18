import React, { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { MessageSquarePlus, Tag, Plus, Trash2, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const AgentTools = () => {
  const { user } = useAuth();
  
  const [localTemplates, setLocalTemplates] = useState<{id: string, title: string, text: string}[]>([]);
  const [localTags, setLocalTags] = useState<{id: string, text: string, color: string}[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) fetchLocalSettings();
  }, [user]);

  const fetchLocalSettings = async () => {
     setLoading(true);
     const { data } = await supabase.from('app_config').select('key, value').in('key', [`agent_templates_${user?.id}`, `agent_tags_${user?.id}`]);
     if (data) {
        const tpl = data.find(d => d.key === `agent_templates_${user?.id}`)?.value;
        const tgs = data.find(d => d.key === `agent_tags_${user?.id}`)?.value;
        if (tpl) try { setLocalTemplates(JSON.parse(tpl)); } catch(e){}
        if (tgs) try { setLocalTags(JSON.parse(tgs)); } catch(e){}
     }
     setLoading(false);
  };

  const handleSaveSettings = async () => {
     if (!user) return;
     setSaving(true);
     try {
        await supabase.from('app_config').upsert([
           { key: `agent_templates_${user.id}`, value: JSON.stringify(localTemplates), category: 'USER_SETTINGS' },
           { key: `agent_tags_${user.id}`, value: JSON.stringify(localTags), category: 'USER_SETTINGS' }
        ], { onConflict: 'key' });
        toast.success("Plantillas y etiquetas guardadas correctamente.");
     } catch (err: any) {
        toast.error("Error al guardar: " + err.message);
     } finally {
        setSaving(false);
     }
  };

  if (loading) {
     return <Layout><div className="flex h-[80vh] items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-indigo-500"/></div></Layout>;
  }

  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-8 pb-16 animate-in fade-in duration-300">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white mb-1">Mis Herramientas</h1>
            <p className="text-slate-400 text-sm">Gestiona tus respuestas rápidas y etiquetas de organización personales.</p>
          </div>
          <Button onClick={handleSaveSettings} disabled={saving} className="bg-indigo-600 hover:bg-indigo-500 text-white h-11 px-8 rounded-xl shadow-lg uppercase tracking-widest font-bold text-xs">
             {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2"/> : <Save className="w-4 h-4 mr-2"/>} Guardar Todo
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
           {/* ETIQUETAS */}
           <Card className="bg-[#0f0f11] border-[#222225] border-l-4 border-l-amber-500 shadow-2xl overflow-hidden rounded-2xl h-fit">
              <CardHeader className="flex flex-row items-center justify-between border-b border-[#161618] bg-[#161618] px-6 py-5">
                 <div className="space-y-1">
                    <CardTitle className="text-white flex items-center gap-2 text-base font-bold tracking-wide"><Tag className="w-5 h-5 text-amber-500" /> Mis Etiquetas</CardTitle>
                    <CardDescription className="text-xs text-slate-400">Categoriza tus leads con colores personalizados.</CardDescription>
                 </div>
                 <Button onClick={() => setLocalTags([...localTags, { id: Date.now().toString(), text: '', color: '#f59e0b' }])} variant="outline" className="border-[#333336] bg-[#0a0a0c] text-slate-300 hover:text-white h-10 px-4 text-xs rounded-xl uppercase tracking-widest font-bold"><Plus className="w-4 h-4 md:mr-2"/> <span className="hidden md:inline">Añadir</span></Button>
              </CardHeader>
              <CardContent className="space-y-4 p-6 bg-[#0a0a0c]">
                 {localTags.length === 0 ? (
                    <div className="text-center py-10 text-slate-600 italic uppercase text-[10px] font-bold tracking-widest">No tienes etiquetas creadas.</div>
                 ) : localTags.map(tag => (
                    <div key={tag.id} className="p-4 bg-[#161618] border border-[#222225] rounded-xl flex flex-col gap-4 group transition-colors hover:border-[#333336]">
                       <div className="space-y-2">
                          <Label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest ml-1">Nombre</Label>
                          <Input value={tag.text} onChange={e => setLocalTags(localTags.map(t => t.id === tag.id ? {...t, text: e.target.value.toUpperCase()} : t))} placeholder="Ej: VIP" className="bg-[#0a0a0c] border-[#222225] h-11 text-sm font-bold text-slate-200 uppercase focus-visible:ring-amber-500/50 rounded-xl" />
                       </div>
                       <div className="flex items-center gap-3">
                          <div className="relative shrink-0">
                             <input type="color" value={tag.color} onChange={e => setLocalTags(localTags.map(t => t.id === tag.id ? {...t, color: e.target.value} : t))} className="absolute inset-0 opacity-0 w-full h-full cursor-pointer" />
                             <div className="w-11 h-11 rounded-xl border-2 border-[#222225] shadow-inner" style={{ backgroundColor: tag.color }}></div>
                          </div>
                          <div className="flex-1">
                             <Badge style={{ backgroundColor: tag.color + '15', color: tag.color, borderColor: tag.color + '40' }} className="px-4 py-1.5 border shadow-sm text-xs font-bold truncate block">{tag.text || 'PREVIEW'}</Badge>
                          </div>
                          <Button variant="ghost" size="icon" onClick={() => setLocalTags(localTags.filter(t => t.id !== tag.id))} className="text-slate-600 hover:bg-red-500/10 hover:text-red-500 h-11 w-11 rounded-xl shrink-0"><Trash2 className="w-5 h-5" /></Button>
                       </div>
                    </div>
                 ))}
              </CardContent>
           </Card>

           {/* PLANTILLAS */}
           <Card className="bg-[#0f0f11] border-[#222225] border-l-4 border-l-indigo-500 shadow-2xl overflow-hidden rounded-2xl h-fit">
              <CardHeader className="flex flex-row items-center justify-between border-b border-[#161618] bg-[#161618] px-6 py-5">
                 <div className="space-y-1">
                    <CardTitle className="text-white flex items-center gap-2 text-base font-bold tracking-wide"><MessageSquarePlus className="w-5 h-5 text-indigo-400" /> Mis Plantillas Rápidas</CardTitle>
                    <CardDescription className="text-xs text-slate-400">Mensajes pre-guardados accesibles desde el chat.</CardDescription>
                 </div>
                 <Button onClick={() => setLocalTemplates([...localTemplates, { id: Date.now().toString(), title: '', text: '' }])} variant="outline" className="border-[#333336] bg-[#0a0a0c] text-slate-300 hover:text-white h-10 px-4 text-xs rounded-xl uppercase tracking-widest font-bold"><Plus className="w-4 h-4 md:mr-2"/> <span className="hidden md:inline">Añadir</span></Button>
              </CardHeader>
              <CardContent className="space-y-4 p-6 bg-[#0a0a0c]">
                 {localTemplates.length === 0 ? (
                    <div className="text-center py-10 text-slate-600 italic uppercase text-[10px] font-bold tracking-widest">No tienes plantillas creadas.</div>
                 ) : localTemplates.map(qr => (
                    <div key={qr.id} className="p-4 bg-[#161618] border border-[#222225] rounded-xl flex flex-col gap-4 group transition-colors hover:border-[#333336]">
                       <div className="space-y-2">
                          <Label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest ml-1">Título / Asunto</Label>
                          <Input value={qr.title} onChange={e => setLocalTemplates(localTemplates.map(t => t.id === qr.id ? {...t, title: e.target.value} : t))} placeholder="Título corto" className="bg-[#0a0a0c] border-[#222225] h-11 text-sm font-bold text-slate-200 focus-visible:ring-indigo-500/50 rounded-xl" />
                       </div>
                       <div className="space-y-2 relative">
                          <Label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest ml-1">Mensaje</Label>
                          <Textarea value={qr.text} onChange={e => setLocalTemplates(localTemplates.map(t => t.id === qr.id ? {...t, text: e.target.value} : t))} placeholder="Escribe el texto..." className="bg-[#0a0a0c] border-[#222225] text-sm min-h-[100px] text-slate-300 focus-visible:ring-indigo-500/50 rounded-xl leading-relaxed resize-none pr-12" />
                          <Button variant="ghost" size="icon" onClick={() => setLocalTemplates(localTemplates.filter(t => t.id !== qr.id))} className="absolute bottom-2 right-2 text-slate-600 hover:bg-red-500/10 hover:text-red-500 h-8 w-8 rounded-lg"><Trash2 className="w-4 h-4" /></Button>
                       </div>
                    </div>
                 ))}
              </CardContent>
           </Card>
        </div>
      </div>
    </Layout>
  );
};

export default AgentTools;