"use client";

import React from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
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
    <Card className="bg-slate-900 border-slate-800 flex-1 flex flex-col overflow-hidden shadow-2xl rounded-2xl min-h-0">
      <CardHeader className="shrink-0 border-b border-slate-800 p-6 bg-slate-950/30">
        <CardTitle className="text-slate-50 text-sm flex items-center gap-2 uppercase tracking-widest font-bold">
          <History className="w-5 h-5 text-amber-500" /> Snapshots
        </CardTitle>
      </CardHeader>
      <ScrollArea className="flex-1">
        <Table>
          <TableHeader>
            <TableRow className="border-slate-800 bg-slate-950/50">
              <TableHead className="pl-6 text-[10px] uppercase font-bold text-slate-400">Nombre</TableHead>
              <TableHead className="text-right pr-6 text-[10px] uppercase font-bold text-slate-400">Acción</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {versions.length === 0 ? (
              <TableRow><TableCell colSpan={2} className="text-center py-20 text-slate-500">No hay snapshots.</TableCell></TableRow>
            ) : versions.map(v => (
              <TableRow key={v.id} className="border-slate-800 hover:bg-slate-800/50">
                <TableCell className="font-mono text-amber-500 text-xs pl-6">{v.version_name}</TableCell>
                <TableCell className="text-right pr-6">
                  <Button variant="ghost" size="sm" onClick={() => handleRestoreClick(v)}>RESTAURAR</Button>
                  <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-500 ml-2" onClick={() => handleDeleteSnapshot(v.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ScrollArea>
    </Card>
  );
};