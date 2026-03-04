"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface PromptEditorProps {
  title: string;
  icon: React.ElementType;
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  color?: string;
}

export const PromptEditor = ({ title, icon: Icon, value, onChange, placeholder, color = "text-indigo-500" }: PromptEditorProps) => (
  <Card className="bg-slate-900 border-slate-800 h-full hover:border-indigo-500/30 transition-all shadow-xl flex flex-col overflow-hidden group">
    <CardHeader className="pb-3 border-b border-slate-800/50 bg-slate-950/40 shrink-0">
      <CardTitle className="text-[11px] text-white flex items-center gap-2 uppercase tracking-widest font-bold">
        <Icon className={cn("w-4 h-4", color)} />
        {title}
      </CardTitle>
    </CardHeader>
    <CardContent className="p-0 flex-1 flex flex-col bg-slate-950 min-h-0">
      <Textarea 
        value={value || ''} 
        onChange={e => onChange(e.target.value)} 
        placeholder={placeholder} 
        className="flex-1 rounded-none border-0 bg-transparent font-mono text-xs focus-visible:ring-0 p-5 leading-relaxed custom-scrollbar resize-none text-slate-300 placeholder:text-slate-700 overflow-y-auto" 
      />
    </CardContent>
    <div className="px-4 py-1 bg-slate-900 border-t border-slate-800/50 flex justify-between items-center shrink-0">
       <span className="text-[9px] text-slate-600 font-mono">CHARS: {value?.length || 0}</span>
       <div className="w-1 h-1 rounded-full bg-indigo-500 animate-pulse opacity-0 group-hover:opacity-100 transition-opacity"></div>
    </div>
  </Card>
);