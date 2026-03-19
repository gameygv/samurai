"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { FileEdit, Zap } from 'lucide-react';

interface QuickActionsProps {
  contactData: any;
  isManager: boolean;
  onEdit: () => void;
  onCia: () => void;
}

export const QuickActions = ({ contactData, isManager, onEdit, onCia }: QuickActionsProps) => {
  if (!contactData) return null;

  return (
    <div className="px-5 pt-5 flex flex-col gap-2">
       <div className="flex gap-2">
          <Button onClick={onEdit} variant="outline" className="flex-1 h-9 bg-[#121214] border-[#222225] hover:bg-[#161618] text-slate-300 text-[10px] font-bold uppercase tracking-widest">
             <FileEdit className="w-3.5 h-3.5 mr-1.5" /> Editar Perfil
          </Button>
          <Button onClick={onCia} variant="outline" className="flex-1 h-9 bg-amber-950/20 border-amber-900/50 text-amber-500 hover:bg-amber-900/30 text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2">
             <Zap className="w-3.5 h-3.5" /> Corregir IA
          </Button>
       </div>
    </div>
  );
};