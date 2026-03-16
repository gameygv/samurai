import React, { useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { TerminalSquare, Upload, Download, AlertTriangle, Trash2, Loader2, ShieldAlert, Lock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface KernelTabProps {
  kernelConfig: any;
  onChange: (key: string, value: string) => void;
}

export const KernelTab = ({ kernelConfig, onChange }: KernelTabProps) => {
  const { isDev } = useAuth();
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
      if (promptRes !== null) toast.error("Palabra clave incorrecta.");
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
      const [{ data: appConfig }, { data: followupConfigData }, { data: profiles }, { data: mediaAssets }, { data: knowledgeBase }, { data: promptVersions }] = await Promise.all([
        supabase.from('app_config').select('*'), supabase.from('followup_config').select('*'),
        supabase.from('profiles').select('*'), supabase.from('media_assets').select('*'),
        supabase.from('knowledge_documents').select('*'), supabase.from('prompt_versions').select('*')
      ]);
      const exportData = {
        metadata: { exported_at: new Date().toISOString(), version: '2.0' },
        app_config: appConfig, followup_config: followupConfigData, profiles,
        media_assets: mediaAssets, knowledge_documents: knowledgeBase, prompt_versions: promptVersions
      };
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url; link.download = `samurai_backup_${Date.now()}.json`;
      document.body.appendChild(link); link.click(); document.body.removeChild(link);
      toast.success("Respaldo descargado.");
    } catch (e) { toast.error("Error al exportar."); }
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
        toast.success("Configuración inyectada. Recargando...");
        setTimeout(() => window.location.reload(), 1500);
      } catch (err: any) { toast.error("Error al importar: " + err.message); }
    };
    reader.readAsText(file);
  };

  const promptFields = [
    { key: 'prompt_catalog_rules', label: 'Reglas del Catálogo (Tienda)', color: 'text-indigo-400' },
    { key: 'prompt_media_rules', label: 'Reglas Multimedia (Posters)', color: 'text-indigo-400' },
    { key: 'prompt_behavior_rules', label: 'Reglas de Comportamiento (Anti-Robot)', color: 'text-indigo-400' },
    { key: 'prompt_human_handoff', label: 'Escalado a Humano (Handoff)', color: 'text-indigo-400' },
    { key: 'prompt_ai_suggestions', label: 'Prompt Co-Piloto (Botones Chat)', color: 'text-amber-500' },
    { key: 'prompt_qa_auditor', label: 'Prompt Auditor de Agentes (QA)', color: 'text-red-500' },
  ];

  return (
    <div className="space-y-6">
      {!isDev && (
        <Card className="bg-amber-900/10 border-amber-500/30 rounded-2xl overflow-hidden">
          <CardContent className="p-6 flex items-start gap-4">
            <div className="p-3 bg-amber-500/10 rounded-xl border border-amber-500/20 shrink-0">
              <Lock className="w-6 h-6 text-amber-500" />
            </div>
            <div>
              <h3 className="font-bold text-amber-400 mb-1">Acceso Restringido — Kernel Dev</h3>
              <p className="text-sm text-amber-300/70 leading-relaxed">
                Esta sección contiene los prompts agnósticos del Kernel. Solo el rol <strong>Developer</strong> puede modificarlos directamente para evitar cambios accidentales que afecten el comportamiento de la IA en producción.
                <br /><br />
                Como Administrador, puedes proponer mejoras a través del <strong>Laboratorio IA</strong> en la sección de Cerebro Core.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className={`bg-[#0D0B0A] border-slate-800 shadow-2xl rounded-2xl overflow-hidden border-l-4 ${isDev ? 'border-l-indigo-500' : 'border-l-slate-700'}`}>
        <CardHeader className="border-b border-slate-800 bg-slate-900/50 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-indigo-400 flex items-center gap-2 text-sm uppercase tracking-widest font-bold">
              <TerminalSquare className="w-5 h-5" /> Samurai Kernel (Agnostic Core)
              {!isDev && <Badge variant="outline" className="ml-2 text-[9px] border-slate-700 text-slate-500"><Lock className="w-2.5 h-2.5 mr-1"/> Solo Dev</Badge>}
            </CardTitle>
            <CardDescription className="text-[10px] mt-1">Instrucciones envolventes que rigen al bot.</CardDescription>
          </div>
          <div className="flex gap-2">
            <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={handleImportConfig} />
            {isDev && (
              <>
                <Button onClick={() => fileInputRef.current?.click()} variant="outline" className="h-9 text-[10px] bg-slate-900 border-slate-700 hover:text-indigo-400"><Upload className="w-3.5 h-3.5 mr-2" /> Importar</Button>
                <Button onClick={handleExportConfig} className="bg-indigo-900 hover:bg-indigo-800 text-indigo-200 h-9 text-[10px]"><Download className="w-3.5 h-3.5 mr-2" /> Backup JSON</Button>
              </>
            )}
            {!isDev && (
              <Button onClick={handleExportConfig} variant="outline" className="h-9 text-[10px] bg-slate-900 border-slate-700"><Download className="w-3.5 h-3.5 mr-2" /> Backup JSON</Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6">
          {promptFields.map(field => (
            <div key={field.key} className="space-y-2">
              <Label className={`text-[10px] uppercase font-bold tracking-widest ${field.color}`}>{field.label}</Label>
              <Textarea
                value={kernelConfig[field.key] || ''}
                onChange={e => isDev && onChange(field.key, e.target.value)}
                readOnly={!isDev}
                className={cn(
                  "bg-black border-slate-800 text-xs h-24 font-mono",
                  !isDev && "text-slate-600 cursor-not-allowed opacity-60"
                )}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="bg-[#1A0C0B] border-red-900/50 shadow-2xl rounded-2xl overflow-hidden border-l-4 border-l-red-600">
        <CardHeader className="border-b border-red-900/30 bg-red-950/40">
          <CardTitle className="text-red-400 flex items-center gap-2 text-sm uppercase tracking-widest font-bold">
            <AlertTriangle className="w-5 h-5" /> ZONA DE PELIGRO
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6">
          <div className="space-y-2 p-4 border border-slate-800 rounded-xl bg-slate-950/50">
            <h4 className="text-white font-bold text-sm flex items-center gap-2"><Trash2 className="w-4 h-4 text-slate-400" /> Vaciar Logs</h4>
            <p className="text-[10px] text-slate-400">Elimina permanentemente todo el historial de actividad.</p>
            <Button onClick={handleClearAllLogs} disabled={clearingLogs} variant="outline" className="mt-2 w-full border-red-900/50 text-red-400 hover:bg-red-900/30">
              {clearingLogs ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : "Eliminar Todos los Logs"}
            </Button>
          </div>
          {isDev && (
            <div className="space-y-2 p-4 border border-red-900/50 rounded-xl bg-red-950/20">
              <h4 className="text-red-400 font-bold text-sm flex items-center gap-2"><ShieldAlert className="w-4 h-4" /> Factory Reset</h4>
              <p className="text-[10px] text-red-300/70">Borra TODO: Configuración, Leads, Chats y Usuarios.</p>
              <Button onClick={handleFactoryReset} disabled={wipingSystem} className="mt-2 w-full bg-red-700 hover:bg-red-600 text-white font-bold text-[10px] uppercase">
                {wipingSystem ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : "DESTRUIR SISTEMA"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};