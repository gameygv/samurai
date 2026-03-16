"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCcw, Terminal } from 'lucide-react';

interface DebugTabProps {
  isActive: boolean;
}

export const DebugTab = ({ isActive }: DebugTabProps) => {
  const [masterPrompt, setMasterPrompt] = useState("");
  const [loadingMaster, setLoadingMaster] = useState(false);

  useEffect(() => {
    if (isActive && !masterPrompt) {
      handleRefreshMaster();
    }
  }, [isActive]);

  const handleRefreshMaster = async () => {
    setLoadingMaster(true);
    try {
      const { data } = await supabase.functions.invoke('get-samurai-context');
      if (data) setMasterPrompt(data.system_prompt || "");
    } finally { setLoadingMaster(false); }
  };

  return (
    <Card className="bg-[#0D0B0A] border-slate-800 shadow-2xl relative flex-1 flex flex-col overflow-hidden rounded-2xl min-h-0">
      <div className="absolute top-4 right-6 z-10">
        <Button onClick={handleRefreshMaster} variant="outline" className="h-9 text-[10px] border-slate-700 text-amber-500 bg-slate-900 hover:bg-slate-800 font-bold uppercase tracking-widest rounded-lg" disabled={loadingMaster}>
          {loadingMaster ? <Loader2 className="w-3 h-3 animate-spin mr-2"/> : <RefreshCcw className="w-3 h-3 mr-2"/>} Re-compilar
        </Button>
      </div>
      <CardHeader className="shrink-0 py-4 bg-slate-900/50 border-b border-slate-800">
        <CardTitle className="text-[10px] text-slate-400 flex items-center gap-2 uppercase tracking-widest font-bold">
          <Terminal className="w-4 h-4 text-slate-500" /> Inspección del Kernel
        </CardTitle>
      </CardHeader>
      <div className="flex-1 p-8 overflow-y-auto custom-scrollbar">
        <pre className="text-[11px] text-slate-400 font-mono whitespace-pre-wrap leading-relaxed select-text">
          {loadingMaster ? "Cargando constitución..." : masterPrompt || "Presiona Re-compilar para ver el prompt final."}
        </pre>
      </div>
    </Card>
  );
};