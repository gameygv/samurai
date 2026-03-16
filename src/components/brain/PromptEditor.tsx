"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Lock, ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';

interface PromptEditorProps {
  title: string;
  icon: React.ElementType;
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  color?: string;
  readOnly?: boolean;
}

export const PromptEditor = ({ title, icon: Icon, value, onChange, placeholder, color = "text-indigo-500", readOnly = false }: PromptEditorProps) => {
  const { isDev } = useAuth();
  const isLocked = !isDev || readOnly;

  return (
    <Card className={cn(
      "bg-slate-900 border-slate-800 h-full shadow-xl flex flex-col overflow-hidden group border-l-2",
      isLocked ? "border-l-slate-700 opacity-90" : "border-l-indigo-500/30"
    )}>
      <CardHeader className="pb-3 border-b border-slate-800/50 bg-slate-950/40 shrink-0 flex flex-row items-center justify-between">
        <CardTitle className="text-[11px] text-white flex items-center gap-2 uppercase tracking-widest font-bold">
          <Icon className={cn("w-4 h-4", color)} />
          {title}
        </CardTitle>
        {isLocked && (
          <Badge variant="outline" className="text-[9px] border-amber-500/30 text-amber-500 bg-amber-500/10 flex items-center gap-1">
            <Lock className="w-2.5 h-2.5" /> Solo Dev
          </Badge>
        )}
      </CardHeader>

      {isLocked && (
        <div className="mx-4 mt-3 p-3 bg-amber-900/10 border border-amber-500/20 rounded-xl flex items-start gap-2 shrink-0">
          <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-[10px] text-amber-400 leading-relaxed">
            <strong>Acceso restringido.</strong> Los prompts del Kernel solo pueden ser editados por el rol <strong>Developer</strong>. 
            Como Administrador, puedes proponer mejoras a través del <strong>Laboratorio IA</strong>.
          </p>
        </div>
      )}

      <CardContent className="p-0 flex-1 flex flex-col bg-slate-950 min-h-0 relative z-10">
        <Textarea
          value={value || ''}
          onChange={e => !isLocked && onChange(e.target.value)}
          placeholder={isLocked ? "Contenido protegido — usa el Laboratorio IA para proponer cambios." : placeholder}
          readOnly={isLocked}
          className={cn(
            "flex-1 rounded-none border-0 bg-transparent font-mono text-xs focus-visible:ring-0 p-5 leading-relaxed custom-scrollbar resize-none min-h-[200px]",
            isLocked ? "text-slate-500 cursor-not-allowed select-none" : "text-slate-300"
          )}
        />
      </CardContent>
      <div className="px-4 py-1 bg-slate-900 border-t border-slate-800/50 flex justify-between items-center shrink-0">
        <span className="text-[9px] text-slate-600 font-mono">CHARS: {value?.length || 0}</span>
        {isLocked && <span className="text-[9px] text-amber-600 font-mono uppercase">🔒 KERNEL PROTECTED</span>}
      </div>
    </Card>
  );
};