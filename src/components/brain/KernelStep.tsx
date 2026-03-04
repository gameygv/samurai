"use client";

import React from 'react';
import { cn } from '@/lib/utils';

interface KernelStepProps {
  num: number;
  title: string;
  desc: string;
  color: string;
  icon: React.ElementType;
}

export const KernelStep = ({ num, title, desc, color, icon: Icon }: KernelStepProps) => (
  <div className="flex gap-4 items-start bg-slate-950/40 p-3.5 rounded-xl border border-slate-800/50 hover:bg-slate-800/30 transition-all group">
    <div className={cn(
      "w-9 h-9 rounded-full flex items-center justify-center bg-slate-900 border border-slate-700 shrink-0 shadow-inner group-hover:scale-110 transition-transform",
      color
    )}>
      <Icon className="w-4 h-4" />
    </div>
    <div className="min-w-0">
      <p className={cn("text-xs font-bold uppercase tracking-wider", color)}>{num}. {title}</p>
      <p className="text-[10px] text-slate-500 leading-relaxed mt-1 font-medium italic">"{desc}"</p>
    </div>
  </div>
);