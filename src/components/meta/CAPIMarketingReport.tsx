import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  TrendingUp, Target, Users, Zap, CheckCircle2, AlertTriangle, 
  ArrowRight, Brain, BarChart3, Mail, Phone, MapPin
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface CAPIMarketingReportProps {
  event: any;
}

const EMQ_FIELDS = [
  { key: 'em', label: 'Email', icon: Mail, weight: 'Alta' },
  { key: 'ph', label: 'Teléfono', icon: Phone, weight: 'Alta' },
  { key: 'fn', label: 'Nombre', icon: Users, weight: 'Media' },
  { key: 'ln', label: 'Apellido', icon: Users, weight: 'Media' },
  { key: 'ct', label: 'Ciudad', icon: MapPin, weight: 'Media' },
  { key: 'st', label: 'Estado', icon: MapPin, weight: 'Baja' },
  { key: 'zp', label: 'Código Postal', icon: MapPin, weight: 'Baja' },
];

const EVENT_EXPLANATIONS: Record<string, { why: string; benefit: string; audience: string; color: string }> = {
  Lead: {
    why: "Se disparó porque el prospecto proporcionó su email y/o teléfono durante la conversación, indicando intención de contacto.",
    benefit: "Meta puede crear audiencias similares (Lookalike) basadas en este perfil para encontrar más personas con el mismo patrón de comportamiento.",
    audience: "Lookalike 1-3% · Retargeting de Leads Fríos · Exclusión de Leads Activos",
    color: "text-indigo-400 border-indigo-500/30 bg-indigo-500/5"
  },
  Purchase: {
    why: "Se disparó porque el pago fue validado manualmente por el equipo de ventas o detectado automáticamente por el Ojo de Halcón.",
    benefit: "Optimiza las campañas de conversión. Meta aprende el perfil exacto de un comprador real para mostrar anuncios a personas con mayor probabilidad de compra.",
    audience: "Lookalike Compradores · Exclusión de Clientes Actuales · Upsell Audiences",
    color: "text-emerald-400 border-emerald-500/30 bg-emerald-500/5"
  },
  CompleteRegistration: {
    why: "El prospecto completó un formulario o proceso de registro en el embudo de ventas.",
    benefit: "Permite optimizar campañas hacia el evento de registro, reduciendo el costo por lead calificado.",
    audience: "Retargeting de Registrados · Lookalike de Alta Intención",
    color: "text-amber-400 border-amber-500/30 bg-amber-500/5"
  },
  Contact: {
    why: "El prospecto inició contacto activo (respondió un mensaje, hizo clic en un CTA).",
    benefit: "Señal de engagement temprano. Útil para optimizar campañas de tráfico y mensajes.",
    audience: "Audiencia de Engagement · Retargeting Temprano",
    color: "text-blue-400 border-blue-500/30 bg-blue-500/5"
  }
};

export const CAPIMarketingReport = ({ event }: CAPIMarketingReportProps) => {
  if (!event) return null;

  const ud = event.unhashed_data?.user_data || {};
  const customData = event.unhashed_data?.custom_data || {};
  const explanation = EVENT_EXPLANATIONS[event.event_name] || EVENT_EXPLANATIONS['Lead'];
  
  const sentFields = EMQ_FIELDS.filter(f => !!ud[f.key]);
  const missingFields = EMQ_FIELDS.filter(f => !ud[f.key]);
  const emqScore = sentFields.length;
  const emqPercent = Math.round((emqScore / 7) * 100);

  const getEmqLabel = (score: number) => {
    if (score >= 6) return { label: 'EXCELENTE', color: 'text-emerald-400', bg: 'bg-emerald-500' };
    if (score >= 4) return { label: 'BUENO', color: 'text-amber-400', bg: 'bg-amber-500' };
    return { label: 'MEJORABLE', color: 'text-red-400', bg: 'bg-red-500' };
  };

  const emqInfo = getEmqLabel(emqScore);

  return (
    <div className="space-y-6 p-1">
      {/* Header del Evento */}
      <div className={cn("border rounded-2xl p-5", explanation.color)}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Zap className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-widest">Evento Disparado</span>
            </div>
            <h2 className="text-2xl font-bold text-white">{event.event_name}</h2>
            <p className="text-[11px] mt-1 opacity-80">{new Date(event.created_at).toLocaleString('es-MX', { dateStyle: 'full', timeStyle: 'short' })}</p>
          </div>
          <Badge className={cn("text-xs font-bold px-3 py-1", event.status === 'OK' ? 'bg-emerald-600' : 'bg-red-600')}>
            {event.status === 'OK' ? '✓ ACEPTADO POR META' : '✗ ERROR'}
          </Badge>
        </div>
        <div className="bg-black/20 rounded-xl p-4 border border-white/10">
          <p className="text-[11px] leading-relaxed opacity-90">
            <strong>¿Por qué se envió este evento?</strong><br />
            {explanation.why}
          </p>
        </div>
      </div>

      {/* EMQ Score Visual */}
      <Card className="bg-slate-900 border-slate-800 rounded-2xl overflow-hidden">
        <CardHeader className="border-b border-slate-800 bg-slate-950/30 py-4">
          <CardTitle className="text-xs uppercase tracking-widest text-white flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-amber-500" /> Calidad de Señal (EMQ Score)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-5">
          <div className="flex items-center gap-6">
            <div className="relative w-20 h-20 shrink-0">
              <svg className="w-20 h-20 -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#1e293b" strokeWidth="3" />
                <circle cx="18" cy="18" r="15.9" fill="none" stroke={emqScore >= 6 ? '#10b981' : emqScore >= 4 ? '#f59e0b' : '#ef4444'} strokeWidth="3"
                  strokeDasharray={`${emqPercent} ${100 - emqPercent}`} strokeLinecap="round" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={cn("text-lg font-bold", emqInfo.color)}>{emqScore}</span>
                <span className="text-[8px] text-slate-500">/7</span>
              </div>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Badge className={cn("text-[10px] font-bold", emqScore >= 6 ? 'bg-emerald-600' : emqScore >= 4 ? 'bg-amber-600' : 'bg-red-600')}>
                  {emqInfo.label}
                </Badge>
                <span className="text-xs text-slate-400">Event Match Quality</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                {emqScore >= 6 
                  ? "Señal de alta calidad. Meta puede hacer un match preciso con su base de datos para optimizar la entrega de anuncios."
                  : emqScore >= 4 
                  ? "Señal aceptable. Considera capturar más datos del prospecto para mejorar la precisión del matching."
                  : "Señal débil. Faltan datos clave. El algoritmo de Meta tendrá dificultades para identificar a este usuario."
                }
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Datos Enviados ({sentFields.length})
              </p>
              {sentFields.map(f => (
                <div key={f.key} className="flex items-center justify-between bg-emerald-900/10 border border-emerald-500/20 rounded-lg px-3 py-1.5">
                  <div className="flex items-center gap-2">
                    <f.icon className="w-3 h-3 text-emerald-400" />
                    <span className="text-[11px] text-emerald-300">{f.label}</span>
                  </div>
                  <Badge className="text-[8px] bg-emerald-900/50 text-emerald-400 border-emerald-500/30">{f.weight}</Badge>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Datos Faltantes ({missingFields.length})
              </p>
              {missingFields.map(f => (
                <div key={f.key} className="flex items-center justify-between bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 opacity-60">
                  <div className="flex items-center gap-2">
                    <f.icon className="w-3 h-3 text-slate-500" />
                    <span className="text-[11px] text-slate-500">{f.label}</span>
                  </div>
                  <Badge variant="outline" className="text-[8px] border-slate-700 text-slate-600">{f.weight}</Badge>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notificación proactiva de Samurai IA si faltan datos */}
      {missingFields.length > 0 && (
        <Card className="bg-slate-900 border-amber-500/30 rounded-2xl overflow-hidden border-l-4 border-l-amber-500 shadow-xl">
          <CardContent className="p-5 space-y-4">
            <h4 className="text-xs font-bold text-amber-400 uppercase tracking-widest flex items-center gap-2">
              <Brain className="w-5 h-5" /> Samurai IA: Recolección Activa
            </h4>
            <div className="bg-amber-950/20 border border-amber-900/50 p-4 rounded-xl">
               <p className="text-[11px] text-amber-200 leading-relaxed">
                  Faltan datos prioritarios para asegurar el <strong>Event Match Quality (EMQ)</strong>, principalmente el <strong className="text-white">Email</strong>. Samurai seguirá conversando estratégicamente con el lead para extraer esta información. 
                  <br/><br/>
                  Adicionalmente, el <strong>Perfil Psicográfico</strong> se está analizando en tiempo real y se empaquetará dentro del parámetro <code className="bg-black/50 px-1 rounded">custom_data</code> del evento para enriquecer la inteligencia del algoritmo de Meta.
               </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Impacto en Audiencias */}
      <Card className="bg-slate-900 border-slate-800 rounded-2xl overflow-hidden">
        <CardHeader className="border-b border-slate-800 bg-slate-950/30 py-4">
          <CardTitle className="text-xs uppercase tracking-widest text-white flex items-center gap-2">
            <Target className="w-4 h-4 text-indigo-400" /> Impacto en Audiencias de Meta Ads
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="bg-indigo-900/10 border border-indigo-500/20 rounded-xl p-4">
            <p className="text-[11px] text-indigo-300 leading-relaxed">
              <strong className="text-indigo-400">Beneficio para tus campañas:</strong><br />
              {explanation.benefit}
            </p>
          </div>
          <div className="space-y-2">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Audiencias que se actualizan:</p>
            <div className="flex flex-wrap gap-2">
              {explanation.audience.split(' · ').map((aud, i) => (
                <Badge key={i} variant="outline" className="text-[10px] border-indigo-500/30 text-indigo-300 bg-indigo-900/10 px-3 py-1">
                  <Users className="w-3 h-3 mr-1.5" /> {aud}
                </Badge>
              ))}
            </div>
          </div>

          {Object.keys(customData).length > 0 && (
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <p className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">Datos de Contexto (Custom Data):</p>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(customData).filter(([k]) => !['source'].includes(k)).map(([key, val]) => (
                  <div key={key} className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2">
                    <p className="text-[9px] text-slate-500 uppercase">{key.replace(/_/g, ' ')}</p>
                    <p className="text-[11px] text-amber-400 font-mono font-bold truncate">{String(val) || 'N/A'}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};