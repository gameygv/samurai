import React from 'react';
import { Badge } from '@/components/ui/badge';
import { GraduationCap, CheckCircle, Clock, MapPin, User, DollarSign, Calendar } from 'lucide-react';

interface AcademicRecordProps {
  academicArray: any[];
}

export const AcademicRecord = ({ academicArray }: AcademicRecordProps) => {
  const safeArray = Array.isArray(academicArray) ? academicArray : [];

  if (safeArray.length === 0) return null;

  const attended = safeArray.filter(ar => ar.attendance).length;

  return (
    <div className="pt-2 border-t border-[#1a1a1a]">
       <div className="flex justify-between items-center py-2">
          <span className="text-[10px] font-bold text-white uppercase tracking-widest flex items-center gap-2">
             <span className="p-1 bg-indigo-500/10 rounded-md"><GraduationCap className="w-3 h-3 text-indigo-400" /></span> Historial Academia
          </span>
          <div className="flex items-center gap-1.5">
            <Badge className="bg-indigo-900/50 text-indigo-300 border-indigo-500/30 text-[9px]">{safeArray.length} cursos</Badge>
            {attended > 0 && <Badge className="bg-emerald-900/50 text-emerald-300 border-emerald-500/30 text-[9px]">{attended} asistidos</Badge>}
          </div>
       </div>
       <div className="space-y-2 mt-1">
          {safeArray.map((ar: any, idx: number) => (
             <div key={ar.id || idx} className="p-2.5 bg-[#121214] border border-[#222225] rounded-lg space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] font-bold text-slate-200 truncate flex-1">{ar.course}</p>
                  {ar.attendance ? (
                    <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[8px] shrink-0"><CheckCircle className="w-2.5 h-2.5 mr-0.5"/>Cursado</Badge>
                  ) : (
                    <Badge className="bg-slate-500/15 text-slate-500 border-slate-500/30 text-[8px] shrink-0"><Clock className="w-2.5 h-2.5 mr-0.5"/>Pendiente</Badge>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[8px] text-slate-500">
                  {ar.date && <span className="flex items-center gap-0.5"><Calendar className="w-2.5 h-2.5"/>{ar.date}</span>}
                  {ar.location && <span className="flex items-center gap-0.5"><MapPin className="w-2.5 h-2.5"/>{ar.location}</span>}
                  {ar.teacher && <span className="flex items-center gap-0.5"><User className="w-2.5 h-2.5"/>{ar.teacher}</span>}
                  {ar.nivel && <Badge variant="outline" className="text-[7px] border-indigo-500/20 text-indigo-400 px-1 py-0 h-3.5">{ar.nivel}</Badge>}
                  {ar.precio_dado != null && (
                    <span className="flex items-center gap-0.5 text-emerald-400"><DollarSign className="w-2.5 h-2.5"/>${ar.precio_dado}
                      {ar.tipo_precio && <span className="text-[7px] text-slate-600 ml-0.5">({ar.tipo_precio})</span>}
                    </span>
                  )}
                </div>
             </div>
          ))}
       </div>
    </div>
  );
};
