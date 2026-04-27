import React from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
  footer: string;
  color: string;
  delay?: number;
}

export const StatCard = ({ title, value, icon: Icon, footer, color, delay = 0 }: StatCardProps) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay }}
  >
    <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 p-5 hover:border-indigo-500/50 transition-all group overflow-hidden relative">
      <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full -mr-10 -mt-10 group-hover:bg-indigo-500/10 transition-colors" />
      <div className="flex justify-between items-start relative z-10">
        <div>
          <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">{title}</p>
          <h3 className="text-3xl font-bold text-slate-900 dark:text-white mt-2 tabular-nums">{value}</h3>
        </div>
        <div className={cn("p-3 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 group-hover:scale-110 transition-transform shadow-inner", color)}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <p className="mt-4 text-[9px] text-slate-500 dark:text-slate-600 font-mono uppercase tracking-widest flex items-center gap-2">
        <span className="w-1 h-1 rounded-full bg-indigo-500 animate-pulse" /> {footer}
      </p>
    </Card>
  </motion.div>
);
