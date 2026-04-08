import React from 'react';
import { Heart, Utensils, AlertTriangle, Target } from 'lucide-react';

interface StudentProfileProps {
  dieta?: string | null;
  alimentacion?: string | null;
  alergias?: string | null;
  motivoCurso?: string | null;
}

export const StudentProfile = ({ dieta, alimentacion, alergias, motivoCurso }: StudentProfileProps) => {
  if (!dieta && !alimentacion && !alergias && !motivoCurso) return null;

  const items = [
    { icon: Utensils, label: 'Dieta', value: dieta, color: 'text-amber-400' },
    { icon: Heart, label: 'Alimentación', value: alimentacion, color: 'text-pink-400' },
    { icon: AlertTriangle, label: 'Alergias', value: alergias, color: 'text-red-400' },
    { icon: Target, label: 'Motivación', value: motivoCurso, color: 'text-indigo-400' },
  ].filter(i => i.value);

  return (
    <div className="pt-2 border-t border-[#1a1a1a]">
       <div className="py-2">
          <span className="text-[10px] font-bold text-white uppercase tracking-widest flex items-center gap-2">
             <span className="p-1 bg-amber-500/10 rounded-md"><Heart className="w-3 h-3 text-amber-400" /></span> Perfil del Alumno
          </span>
       </div>
       <div className="space-y-1.5 mt-1">
          {items.map((item, idx) => (
             <div key={idx} className="flex items-start gap-2 p-2 bg-[#121214] border border-[#222225] rounded-lg">
                <item.icon className={`w-3 h-3 mt-0.5 shrink-0 ${item.color}`} />
                <div>
                  <p className="text-[8px] text-slate-500 uppercase tracking-widest font-bold">{item.label}</p>
                  <p className="text-[10px] text-slate-300 leading-relaxed">{item.value}</p>
                </div>
             </div>
          ))}
       </div>
    </div>
  );
};
