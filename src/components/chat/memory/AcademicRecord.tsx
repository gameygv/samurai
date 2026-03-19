"use client";

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { GraduationCap } from 'lucide-react';

interface AcademicRecordProps {
  academicArray: any[];
}

export const AcademicRecord = ({ academicArray }: AcademicRecordProps) => {
  const safeArray = Array.isArray(academicArray) ? academicArray : [];
  
  if (safeArray.length === 0) return null;

  return (
    <div className="pt-2 border-t border-[#1a1a1a]">
       <div className="flex justify-between items-center py-2">
          <span className="text-[10px] font-bold text-white uppercase tracking-widest flex items-center gap-2">
             <GraduationCap className="w-3.5 h-3.5 text-indigo-400" /> Historial Academia
          </span>
          <Badge className="bg-indigo-900/50 text-indigo-300 border-indigo-500/30 text-[9px]">{safeArray.length}</Badge>
       </div>
       <div className="space-y-2 mt-1">
          {safeArray.slice(0, 2).map((ar: any, idx: number) => (
             <div key={idx} className="p-2 bg-[#121214] border border-[#222225] rounded-lg">
                <p className="text-[10px] font-bold text-slate-200 truncate">{ar.course}</p>
                <p className="text-[8px] text-slate-500 mt-0.5">{ar.date} • {ar.location || 'Online'}</p>
             </div>
          ))}
          {safeArray.length > 2 && (
             <p className="text-[8px] text-slate-600 text-center italic">
                + {safeArray.length - 2} cursos más en expediente
             </p>
          )}
       </div>
    </div>
  );
};