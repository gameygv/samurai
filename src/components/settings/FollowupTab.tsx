import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Clock, DollarSign, Sparkles, Save, CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FollowupTabProps {
  followupConfig: any;
  setFollowupConfig: (val: any) => void;
  salesConfig: any;
  setSalesConfig: (val: any) => void;
  onSave: () => void;
  saving: boolean;
}

export const FollowupTab = ({ followupConfig, setFollowupConfig, salesConfig, setSalesConfig, onSave, saving }: FollowupTabProps) => {
  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      <Card className="bg-[#0f0f11] border-[#222225] shadow-2xl rounded-2xl">
        <CardHeader className="bg-[#161618] border-b border-[#222225]">
          <CardTitle className="text-white flex items-center gap-2 text-sm font-bold"><Clock className="w-4 h-4 text-indigo-400" /> Horario de Operación IA</CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 gap-6 max-w-lg">
            <div className="space-y-2">
              <Label className="text-[10px] text-slate-500 uppercase font-bold tracking-widest ml-1">Hora Inicio (0-23)</Label>
              <Input type="number" min="0" max="23" value={followupConfig.start_hour || 9} onChange={e => setFollowupConfig({...followupConfig, start_hour: parseInt(e.target.value)})} className="bg-[#0a0a0c] border-[#222225] h-11 rounded-xl text-center font-bold" />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] text-slate-500 uppercase font-bold tracking-widest ml-1">Hora Fin (0-23)</Label>
              <Input type="number" min="0" max="23" value={followupConfig.end_hour || 21} onChange={e => setFollowupConfig({...followupConfig, end_hour: parseInt(e.target.value)})} className="bg-[#0a0a0c] border-[#222225] h-11 rounded-xl text-center font-bold" />
            </div>
          </div>
          <p className="text-[10px] text-slate-600 mt-4 italic">Sam solo enviará mensajes de retargeting automático dentro de este rango horario para evitar molestar a deshoras.</p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ESTRATEGIA 1: EXPLORACIÓN */}
        <Card className="bg-[#0f0f11] border-[#222225] border-t-4 border-t-amber-500 shadow-2xl rounded-2xl">
          <CardHeader className="border-b border-[#222225] bg-[#161618] p-5">
            <div className="flex justify-between items-center">
              <div className="space-y-1">
                 <CardTitle className="text-amber-500 flex items-center gap-2 uppercase tracking-widest text-sm font-bold"><Sparkles className="w-4 h-4"/> 1. Exploración</CardTitle>
                 <p className="text-[9px] text-slate-500">Para leads que no han dado datos.</p>
              </div>
              <Button 
                 onClick={() => setFollowupConfig({...followupConfig, enabled: !followupConfig.enabled})}
                 className={cn("h-8 text-[10px] uppercase tracking-widest font-bold", followupConfig.enabled ? "bg-amber-600 hover:bg-amber-500 text-slate-950" : "bg-transparent border border-[#333336] text-slate-400 hover:text-white")}
              >
                 {followupConfig.enabled ? <><CheckCircle2 className="w-3.5 h-3.5 mr-1.5"/> Activado</> : <><XCircle className="w-3.5 h-3.5 mr-1.5"/> Desactivado</>}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6 pt-6 transition-all">
            {[1, 2, 3].map(stage => (
              <div key={stage} className={`space-y-3 border-b border-[#222225] pb-6 last:border-0 ${!followupConfig.enabled ? 'opacity-30 grayscale pointer-events-none' : ''}`}>
                <div className="flex justify-between items-end">
                  <Label className="text-amber-400 font-bold text-[10px] uppercase">Fase {stage}</Label>
                  <div className="flex items-center gap-2 bg-[#0a0a0c] px-2 py-1 rounded-lg border border-[#222225]">
                    <Input type="number" value={followupConfig[`stage_${stage}_delay`] || 0} onChange={e => setFollowupConfig({...followupConfig, [`stage_${stage}_delay`]: parseInt(e.target.value)})} className="bg-transparent border-0 w-16 h-6 text-xs text-center font-mono text-amber-500 focus-visible:ring-0 p-0" />
                    <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Minutos</span>
                  </div>
                </div>
                <Textarea value={followupConfig[`stage_${stage}_message`] || ''} onChange={e => setFollowupConfig({...followupConfig, [`stage_${stage}_message`]: e.target.value})} className="bg-[#0a0a0c] border-[#222225] text-xs h-20 resize-none rounded-xl focus-visible:ring-amber-500/50" placeholder="Escribe el mensaje de la fase..." />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* ESTRATEGIA 2: CIERRE */}
        <Card className="bg-[#0f0f11] border-[#222225] border-t-4 border-t-emerald-500 shadow-2xl rounded-2xl">
          <CardHeader className="border-b border-[#222225] bg-[#161618] p-5">
            <div className="flex justify-between items-center">
              <div className="space-y-1">
                 <CardTitle className="text-emerald-500 flex items-center gap-2 uppercase tracking-widest text-sm font-bold"><DollarSign className="w-4 h-4"/> 2. Cierre de Ventas</CardTitle>
                 <p className="text-[9px] text-slate-500">Para leads con intención ALTA.</p>
              </div>
              <Button 
                 onClick={() => setSalesConfig({...salesConfig, enabled: !salesConfig.enabled})}
                 className={cn("h-8 text-[10px] uppercase tracking-widest font-bold", salesConfig.enabled ? "bg-emerald-600 hover:bg-emerald-500 text-slate-950" : "bg-transparent border border-[#333336] text-slate-400 hover:text-white")}
              >
                 {salesConfig.enabled ? <><CheckCircle2 className="w-3.5 h-3.5 mr-1.5"/> Activado</> : <><XCircle className="w-3.5 h-3.5 mr-1.5"/> Desactivado</>}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6 pt-6 transition-all">
            {[1, 2, 3].map(stage => (
              <div key={stage} className={`space-y-3 border-b border-[#222225] pb-6 last:border-0 ${!salesConfig.enabled ? 'opacity-30 grayscale pointer-events-none' : ''}`}>
                <div className="flex justify-between items-end">
                  <Label className="text-emerald-400 font-bold text-[10px] uppercase">Fase {stage}</Label>
                  <div className="flex items-center gap-2 bg-[#0a0a0c] px-2 py-1 rounded-lg border border-[#222225]">
                    <Input type="number" value={salesConfig[`stage_${stage}_delay`] || 0} onChange={e => setSalesConfig({...salesConfig, [`stage_${stage}_delay`]: parseInt(e.target.value)})} className="bg-transparent border-0 w-16 h-6 text-xs text-center font-mono text-emerald-500 focus-visible:ring-0 p-0" />
                    <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Minutos</span>
                  </div>
                </div>
                <Textarea value={salesConfig[`stage_${stage}_message`] || ''} onChange={e => setSalesConfig({...salesConfig, [`stage_${stage}_message`]: e.target.value})} className="bg-[#0a0a0c] border-[#222225] text-xs h-20 resize-none rounded-xl focus-visible:ring-emerald-500/50" placeholder="Escribe el mensaje de cierre..." />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end pt-4">
         <Button onClick={onSave} disabled={saving} className="bg-indigo-600 hover:bg-indigo-500 shadow-lg px-8 rounded-xl font-bold uppercase tracking-widest text-[10px] h-11">
            {saving ? <span className="animate-spin mr-2">⏳</span> : <Save className="w-4 h-4 mr-2" />} GUARDAR RETARGETING
         </Button>
      </div>
    </div>
  );
};