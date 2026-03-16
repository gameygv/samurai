import React, { useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { TerminalSquare, Upload, Download, AlertTriangle, Trash2, Loader2, ShieldAlert } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface KernelTabProps {
  kernelConfig: any;
  onChange: (key: string, value: string) => void;
}

export const KernelTab = ({ kernelConfig, onChange }: KernelTabProps) => {
  const [clearingLogs, setClearingLogs] = useState(false);
  const [wipingSystem, setWipingSystem] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClearAllLogs = async () => {
    if (!confirm("¿ESTÁS SEGURO? Esto vaciará permanentemente todos los logs de actividad del sistema.")) return;
    setClearingLogs(true);
    try {
      await supabase.from('activity_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      toast.success("Todos los logs han sido purgados.");
    } catch (err: any) {
      toast.error("Fallo al vaciar logs: " + err.message);
    } finally {
      setClearingLogs(false);
    }
  };

  const handleFactoryReset = async () => {
    const promptRes = prompt("⚠️ PELIGRO CRÍTICO ⚠️\nEscribe 'DESTRUIR' para borrar TODA LA CONFIGURACIÓN, LEADS, CHATS y USUARIOS (excepto gameygv@gmail.com).");
    if (promptRes !== 'DESTRUIR') {
        if (promptRes !== null) toast.error(" Palabra clave incorrecta.");
        return;
    }
    setWipingSystem(true);
    try {
        const { data, error } = await supabase.functions.invoke('system-wipe', { body: { confirmation: 'FACTORY_RESET' } });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        toast.success("SISTEMA DESTRUIDO CON ÉXITO. Limpiando cache...");
        setTimeout(() => window.location.reload(), 2000);
    } catch (err: any) { 
        toast.error("Fallo durante Factory Reset: " + err.message); 
    } finally { 
        setWipingSystem(false); 
    }
  };

  const handleExportConfig = async () => {
    try {
        const [
            { data: appConfig }, { data: followupConfigData }, { data: profiles },
            { data: mediaAssets }, { data: knowledgeBase }, { data: promptVersions }
        ] = await Promise.all([
            supabase.from('app_config').select('*'), supabase.from('followup_config').select('*'),
            supabase.from('profiles').select('*'), supabase.from('media_assets').select('*'),
            supabase.from('knowledge_documents').select('*'), supabase.from('prompt_versions').select('*')
        ]);

        const exportData = {
           metadata: { exported_at: new Date().toISOString(), version: '2.0', description: "Respaldo Total Integral" },
           app_config: appConfig, followup_config: followupConfigData, profiles: profiles,
           media_assets: mediaAssets, knowledge_documents: knowledgeBase, prompt_versions: promptVersions
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `samurai_full_backup_${Date.now()}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success("Respaldo Total Descargado");
    } catch (e) { 
        toast.error("Error al exportar todo el sistema"); 
    }
  };

  const handleImportConfig = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
        try {
            const json = JSON.parse(event.target?.result as string);
            if (!json.app_config) throw new Error("Formato inválido");
            const { error } = await supabase.from('app_config').upsert(json.app_config, { onConflict: 'key' });
            if (error) throw error;
            toast.success("Configuración Core inyectada con éxito. Recargando...");
            setTimeout(() => window.location.reload(), 1500);
        } catch (err: any) { 
            toast.error("Error al importar: " + err.message); 
        }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6">
      <Card className="bg-[#0D0B0A] border-slate-800 shadow-2xl rounded-2xl overflow-hidden border-l-4 border-l-indigo-500">
          <CardHeader className="border-b border-slate-800 bg-slate-900/50 flex flex-row items-center justify-between">
            <div>
                <CardTitle className="text-indigo-400 flex items-center gap-2 text-sm uppercase tracking-widest font-bold">
                  <TerminalSquare className="w-5 h-5" /> Samurai Kernel (Agnostic Core)
                </CardTitle>
                <CardDescription className="text-[10px] mt-1">Configura las instrucciones envolventes que rigen al bot para adaptarlo a cualquier otro giro de negocio.</CardDescription>
            </div>
            <div className="flex gap-2">
                <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={handleImportConfig} />
                <Button onClick={() => fileInputRef.current?.click()} variant="outline" className="h-9 text-[10px] bg-slate-900 border-slate-700 hover:text-indigo-400"><Upload className="w-3.5 h-3.5 mr-2" /> Importar Backup</Button>
                <Button onClick={handleExportConfig} className="bg-indigo-900 hover:bg-indigo-800 text-indigo-200 h-9 text-[10px]"><Download className="w-3.5 h-3.5 mr-2" /> Backup Total (JSON)</Button>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6">
            <div className="space-y-2">
                <Label className="text-[10px] text-indigo-400 uppercase font-bold tracking-widest">Reglas del Catálogo (Tienda)</Label>
                <Textarea value={kernelConfig.prompt_catalog_rules} onChange={e => onChange('prompt_catalog_rules', e.target.value)} className="bg-black border-slate-800 text-xs h-24 font-mono text-slate-300" />
            </div>
            <div className="space-y-2">
                <Label className="text-[10px] text-indigo-400 uppercase font-bold tracking-widest">Reglas Multimedia (Posters)</Label>
                <Textarea value={kernelConfig.prompt_media_rules} onChange={e => onChange('prompt_media_rules', e.target.value)} className="bg-black border-slate-800 text-xs h-24 font-mono text-slate-300" />
            </div>
            <div className="space-y-2">
                <Label className="text-[10px] text-indigo-400 uppercase font-bold tracking-widest">Reglas de Comportamiento (Anti-Robot)</Label>
                <Textarea value={kernelConfig.prompt_behavior_rules} onChange={e => onChange('prompt_behavior_rules', e.target.value)} className="bg-black border-slate-800 text-xs h-32 font-mono text-slate-300" />
            </div>
            <div className="space-y-2">
                <Label className="text-[10px] text-indigo-400 uppercase font-bold tracking-widest">Escalado a Humano (Handoff)</Label>
                <Textarea value={kernelConfig.prompt_human_handoff} onChange={e => onChange('prompt_human_handoff', e.target.value)} className="bg-black border-slate-800 text-xs h-32 font-mono text-slate-300" />
            </div>
            <div className="space-y-2">
                <Label className="text-[10px] text-amber-500 uppercase font-bold tracking-widest">Prompt Co-Piloto (Botones Chat)</Label>
                <Textarea value={kernelConfig.prompt_ai_suggestions} onChange={e => onChange('prompt_ai_suggestions', e.target.value)} className="bg-black border-slate-800 text-[10px] h-40 font-mono text-amber-500/80" />
            </div>
            <div className="space-y-2">
                <Label className="text-[10px] text-red-500 uppercase font-bold tracking-widest">Prompt Auditor de Agentes (QA)</Label>
                <Textarea value={kernelConfig.prompt_qa_auditor} onChange={e => onChange('prompt_qa_auditor', e.target.value)} className="bg-black border-slate-800 text-[10px] h-40 font-mono text-red-400/80" />
            </div>
          </CardContent>
      </Card>

      <Card className="bg-[#1A0C0B] border-red-900/50 shadow-2xl rounded-2xl overflow-hidden border-l-4 border-l-red-600">
          <CardHeader className="border-b border-red-900/30 bg-red-950/40">
            <CardTitle className="text-red-400 flex items-center gap-2 text-sm uppercase tracking-widest font-bold">
                <AlertTriangle className="w-5 h-5" /> ZONA DE PELIGRO (DANGER ZONE)
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6">
            <div className="space-y-2 p-4 border border-slate-800 rounded-xl bg-slate-950/50">
                <h4 className="text-white font-bold text-sm flex items-center gap-2"><Trash2 className="w-4 h-4 text-slate-400"/> Vaciar Logs del Sistema</h4>
                <p className="text-[10px] text-slate-400">Elimina de forma permanente todo el historial de actividad, errores y eventos del monitor.</p>
                <Button onClick={handleClearAllLogs} disabled={clearingLogs} variant="outline" className="mt-2 w-full border-red-900/50 text-red-400 hover:bg-red-900/30">
                  {clearingLogs ? <Loader2 className="w-4 h-4 animate-spin mr-2"/> : "Eliminar Todos los Logs"}
                </Button>
            </div>
            <div className="space-y-2 p-4 border border-red-900/50 rounded-xl bg-red-950/20">
                <h4 className="text-red-400 font-bold text-sm flex items-center gap-2"><ShieldAlert className="w-4 h-4"/> Factory Reset (Wipe Total)</h4>
                <p className="text-[10px] text-red-300/70">Borra de tajo TODO el contenido: Configuración, Leads, Chats, Documentos y Usuarios (Protegiendo a gameygv@gmail.com).</p>
                <Button onClick={handleFactoryReset} disabled={wipingSystem} className="mt-2 w-full bg-red-700 hover:bg-red-600 text-white font-bold tracking-widest text-[10px] uppercase shadow-lg shadow-red-900/50">
                  {wipingSystem ? <Loader2 className="w-4 h-4 animate-spin mr-2"/> : "DESTRUIR SISTEMA"}
                </Button>
            </div>
          </CardContent>
      </Card>
    </div>
  );
};