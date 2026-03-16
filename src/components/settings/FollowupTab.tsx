import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Clock, DollarSign, Sparkles } from 'lucide-react';

interface FollowupTabProps {
  followupConfig: any;
  setFollowupConfig: (val: any) => void;
  salesConfig: any;
  setSalesConfig: (val: any) => void;
}

export const FollowupTab = ({ followupConfig, setFollowupConfig, salesConfig, setSalesConfig }: FollowupTabProps) => {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <Card className="bg-slate-900 border-slate-800 shadow-xl">
        <CardHeader className="bg-slate-950/30 border-b border-slate-800">
          <CardTitle className="text-white flex items-center gap-2 text-sm font-bold"><Clock className="w-4 h-4 text-indigo-400" /> Horario de Operación IA</CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 gap-6 max-w-lg">
            <div className="space-y-2">
              <Label className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Hora Inicio (0-23)</Label>
              <Input type="number" min="0" max="23" value={followupConfig.start_hour || 9} onChange={e => setFollowupConfig({...followupConfig, start_hour: parseInt(e.target.value)})} className="bg-slate-950 border-slate-800" />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Hora Fin (0-23)</Label>
              <Input type="number" min="0" max="23" value={followupConfig.end_hour || 21} onChange={e => setFollowupConfig({...followupConfig, end_hour: parseInt(e.target.value)})} className="bg-slate-950 border-slate-800" />
            </div>
          </div>
          <p className="text-[10px] text-slate-600 mt-4 italic">Sam solo enviará mensajes de retargeting automático dentro de este rango horario para evitar molestar a deshoras.</p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ESTRATEGIA 1: EXPLORACIÓN */}
        <Card className="bg-slate-900 border-slate-800 border-t-4 border-t-amber-500 shadow-xl">
          <CardHeader className="border-b border-slate-800 bg-slate-950/30">
            <div className="flex justify-between items-center">
              <div className="space-y-1">
                 <CardTitle className="text-amber-500 flex items-center gap-2 uppercase tracking-widest text-xs font-bold"><Sparkles className="w-4 h-4"/> 1. Exploración</CardTitle>
                 <p className="text-[9px] text-slate-500">Para leads que no han dado datos.</p>
              </div>
              <Switch checked={!!followupConfig.enabled} onCheckedChange={c => setFollowupConfig({...followupConfig, enabled: c})} />
            </div>
          </CardHeader>
          <CardContent className="space-y-6 pt-6 transition-all">
            {[1, 2, 3].map(stage => (
              <div key={stage} className={`space-y-2 border-b border-slate-800 pb-4 last:border-0 ${!followupConfig.enabled ? 'opacity-40 grayscale pointer-events-none' : ''}`}>
                <div className="flex justify-between items-end">
                  <Label className="text-amber-400 font-bold text-[10px] uppercase">Fase {stage}</Label>
                  <div className="flex items-center gap-2">
                    <Input type="number" value={followupConfig[`stage_${stage}_delay`] || 0} onChange={e => setFollowupConfig({...followupConfig, [`stage_${stage}_delay`]: parseInt(e.target.value)})} className="bg-slate-950 border-slate-800 w-20 h-7 text-xs text-center font-mono text-amber-500" />
                    <span className="text-[9px] text-slate-500">Minutos</span>
                  </div>
                </div>
                <Textarea value={followupConfig[`stage_${stage}_message`] || ''} onChange={e => setFollowupConfig({...followupConfig, [`stage_${stage}_message`]: e.target.value})} className="bg-slate-950 border-slate-800 text-xs h-16 resize-none" placeholder="Escribe el mensaje de la fase..." />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* ESTRATEGIA 2: CIERRE */}
        <Card className="bg-slate-900 border-slate-800 border-t-4 border-t-emerald-500 shadow-xl">
          <CardHeader className="border-b border-slate-800 bg-slate-950/30">
            <div className="flex justify-between items-center">
              <div className="space-y-1">
                 <CardTitle className="text-emerald-500 flex items-center gap-2 uppercase tracking-widest text-xs font-bold"><DollarSign className="w-4 h-4"/> 2. Cierre de Ventas</CardTitle>
                 <p className="text-[9px] text-slate-500">Para leads con intención ALTA.</p>
              </div>
              <Switch checked={!!salesConfig.enabled} onCheckedChange={c => setSalesConfig({...salesConfig, enabled: c})} />
            </div>
          </CardHeader>
          <CardContent className="space-y-6 pt-6 transition-all">
            {[1, 2, 3].map(stage => (
              <div key={stage} className={`space-y-2 border-b border-slate-800 pb-4 last:border-0 ${!salesConfig.enabled ? 'opacity-40 grayscale pointer-events-none' : ''}`}>
                <div className="flex justify-between items-end">
                  <Label className="text-emerald-400 font-bold text-[10px] uppercase">Fase {stage}</Label>
                  <div className="flex items-center gap-2">
                    <Input type="number" value={salesConfig[`stage_${stage}_delay`] || 0} onChange={e => setSalesConfig({...salesConfig, [`stage_${stage}_delay`]: parseInt(e.target.value)})} className="bg-slate-950 border-slate-800 w-20 h-7 text-xs text-center font-mono text-emerald-500" />
                    <span className="text-[9px] text-slate-500">Minutos</span>
                  </div>
                </div>
                <Textarea value={salesConfig[`stage_${stage}_message`] || ''} onChange={e => setSalesConfig({...salesConfig, [`stage_${stage}_message`]: e.target.value})} className="bg-slate-950 border-slate-800 text-xs h-16 resize-none" placeholder="Escribe el mensaje de cierre..." />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};