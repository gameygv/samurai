"use client";

import React from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { History, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface VersionsTabProps {
  versions: any[];
  onRefresh: () => void;
  onRestore: (snapshot: any) => void;
}

export const VersionsTab = ({ versions, onRefresh, onRestore }: VersionsTabProps) => {

  const handleDeleteSnapshot = async (id: string) => {
    if (!confirm("¿Seguro que quieres borrar este snapshot?")) return;
    try {
      const { error } = await supabase.functions.invoke('manage-prompt-versions', {
        body: { action: 'DELETE', id }
      });
      if (error) throw error;
      toast.success("Snapshot eliminado");
      onRefresh();
    } catch (err: any) {
      toast.error("Error al eliminar");
    }
  };

  const handleRestoreClick = (snapshot: any) => {
    if (!confirm(`¿Restaurar "${snapshot.version_name}"? Esto reemplazará los prompts actuales.`)) return;
    onRestore(snapshot);
    toast.success("Snapshot cargado. Pulsa 'Aplicar Cambios' para hacerlo definitivo.");
  };

  return (
    <Card className="bg-[#0f0f11] border-[#222225] flex-1 flex flex-col overflow-hidden shadow-2xl rounded-2xl min-h-0 h-full">
      <CardHeader className="shrink-0 border-b border-[#222225] p-6 bg-[#161618]">
        <CardTitle className="text-slate-50 text-sm flex items-center gap-2 uppercase tracking-widest font-bold">
          <History className="w-5 h-5 text-amber-500" /> Snapshots
        </CardTitle>
      </CardHeader>
      
      {/* Contenedor con Scroll Nativo */}
      <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#0a0a0c]">
        <Table>
          <TableHeader>
            {/* Cabecera pegajosa (sticky) */}
            <TableRow className="border-[#222225] bg-[#161618] hover:bg-[#161618] sticky top-0 z-10 shadow-sm">
              <TableHead className="pl-6 text-[10px] uppercase font-bold text-slate-400">Nombre</TableHead>
              <TableHead className="text-right pr-6 text-[10px] uppercase font-bold text-slate-400">Acción</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {versions.length === 0 ? (
              <TableRow><TableCell colSpan={2} className="text-center py-20 text-slate-500">No hay snapshots.</TableCell></TableRow>
            ) : versions.map(v => (
              <TableRow key={v.id} className="border-[#222225] hover:bg-[#121214] transition-colors">
                <TableCell className="font-mono text-amber-500 text-xs pl-6">{v.version_name}</TableCell>
                <TableCell className="text-right pr-6">
                  <Button variant="ghost" size="sm" className="text-[10px] font-bold tracking-widest uppercase text-slate-300 hover:text-white" onClick={() => handleRestoreClick(v)}>
                    RESTAURAR
                  </Button>
                  <Button variant="ghost" size="icon" className="text-slate-500 hover:bg-red-500/10 hover:text-red-500 ml-2 rounded-xl" onClick={() => handleDeleteSnapshot(v.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
};