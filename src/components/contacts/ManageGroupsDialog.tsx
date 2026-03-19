import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FolderInput, Plus, Trash2, Loader2, Save } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ManageGroupsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups: string[];
  onGroupsChange: (groups: string[]) => void;
}

export const ManageGroupsDialog = ({ open, onOpenChange, groups, onGroupsChange }: ManageGroupsDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [localGroups, setLocalGroups] = useState<string[]>([]);
  const [newGroup, setNewGroup] = useState("");

  useEffect(() => {
    if (open) {
      setLocalGroups([...groups]);
      setNewGroup("");
    }
  }, [open, groups]);

  const handleAdd = () => {
    const trimmed = newGroup.trim();
    if (!trimmed) return;
    if (localGroups.includes(trimmed)) {
      toast.error("Este grupo ya existe.");
      return;
    }
    setLocalGroups([...localGroups, trimmed]);
    setNewGroup("");
  };

  const handleRemove = (grp: string) => {
    setLocalGroups(localGroups.filter(g => g !== grp));
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await supabase.from('app_config').upsert({
        key: 'contact_groups',
        value: JSON.stringify(localGroups),
        category: 'SYSTEM'
      }, { onConflict: 'key' });
      
      toast.success("Catálogo de grupos actualizado.");
      onGroupsChange(localGroups);
      onOpenChange(false);
    } catch (err: any) {
      toast.error("Error al guardar: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0f0f11] border-[#222225] text-white max-w-md rounded-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-indigo-400">
             <FolderInput className="w-5 h-5" /> Catálogo de Grupos
          </DialogTitle>
          <DialogDescription className="text-slate-400 text-xs">
             Crea los grupos aquí primero. Luego podrás asignarlos a los clientes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex gap-2">
            <Input 
              value={newGroup} 
              onChange={e => setNewGroup(e.target.value)} 
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              placeholder="Nombre del nuevo grupo..." 
              className="bg-[#161618] border-[#222225] h-11 text-sm focus-visible:ring-indigo-500" 
            />
            <Button onClick={handleAdd} className="bg-indigo-600 hover:bg-indigo-500 h-11 px-4 rounded-xl">
               <Plus className="w-4 h-4" />
            </Button>
          </div>

          <div className="space-y-2">
             <Label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">Grupos Activos ({localGroups.length})</Label>
             <ScrollArea className="h-48 bg-[#121214] border border-[#222225] rounded-xl p-2">
                {localGroups.length === 0 ? (
                   <p className="text-center text-slate-600 italic text-xs py-8">No hay grupos creados.</p>
                ) : (
                   localGroups.map((g, i) => (
                      <div key={i} className="flex justify-between items-center p-2.5 hover:bg-[#161618] rounded-lg group transition-colors">
                         <span className="text-sm text-slate-200 font-bold">{g}</span>
                         <Button variant="ghost" size="icon" onClick={() => handleRemove(g)} className="h-8 w-8 text-slate-600 hover:text-red-500 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Trash2 className="w-4 h-4" />
                         </Button>
                      </div>
                   ))
                )}
             </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-xl uppercase text-[10px] font-bold tracking-widest">Cancelar</Button>
          <Button onClick={handleSave} disabled={loading} className="bg-indigo-600 hover:bg-indigo-500 rounded-xl px-6 uppercase text-[10px] font-bold tracking-widest shadow-lg">
             {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />} Guardar Catálogo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};