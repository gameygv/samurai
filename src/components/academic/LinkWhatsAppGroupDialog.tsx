import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, Users, Wifi, Check, Unlink, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface WhatsAppChannel {
  id: string;
  name: string;
  instance_id: string;
}

interface WhatsAppGroup {
  jid: string;
  name: string;
  participant_count: number;
}

interface SyncResult {
  synced: number;
  matched: number;
  unmatched: number;
  group_name: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseId: string;
  courseTitle: string;
  currentGroupJid: string | null;
  currentChannelId: string | null;
  onLinked: (groupJid: string, channelId: string, groupName: string) => void;
  onUnlinked: () => void;
}

export const LinkWhatsAppGroupDialog = ({
  open, onOpenChange, courseId, courseTitle,
  currentGroupJid, currentChannelId,
  onLinked, onUnlinked,
}: Props) => {
  const [channels, setChannels] = useState<WhatsAppChannel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<string>('');
  const [groups, setGroups] = useState<WhatsAppGroup[]>([]);
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [linking, setLinking] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (open) {
      fetchChannels();
      setSyncResult(null);
      if (currentChannelId) {
        setSelectedChannel(currentChannelId);
        // Cargar grupos del canal vinculado para resolver el nombre del grupo
        if (currentGroupJid) fetchGroups(currentChannelId);
      }
    }
  }, [open]);

  const fetchChannels = async () => {
    setLoadingChannels(true);
    try {
      const { data, error } = await supabase
        .from('whatsapp_channels')
        .select('id, name, instance_id')
        .eq('provider', 'gowa')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      if (data) setChannels(data as WhatsAppChannel[]);
    } catch (err: any) {
      toast.error(`Error cargando canales: ${err.message}`);
    }
    setLoadingChannels(false);
  };

  const fetchGroups = async (channelId: string) => {
    setLoadingGroups(true);
    setGroups([]);
    try {
      const { data, error } = await supabase.functions.invoke('list-whatsapp-groups', {
        body: { channel_id: channelId },
      });
      if (error) throw new Error(error.message);
      setGroups(data?.groups || []);
    } catch (err: any) {
      toast.error(`Error cargando grupos: ${err.message}`);
    }
    setLoadingGroups(false);
  };

  const handleChannelChange = (channelId: string) => {
    setSelectedChannel(channelId);
    fetchGroups(channelId);
  };

  const handleLink = async (group: WhatsAppGroup) => {
    setLinking(true);
    try {
      const { error } = await supabase
        .from('courses')
        .update({
          whatsapp_group_jid: group.jid,
          whatsapp_channel_id: selectedChannel,
          updated_at: new Date().toISOString(),
        })
        .eq('id', courseId);

      if (error) throw error;

      onLinked(group.jid, selectedChannel, group.name);
      toast.success(`Grupo "${group.name}" vinculado al curso.`);

      // Auto-sync members
      await handleSync(selectedChannel, group.jid);
    } catch (err: any) {
      toast.error(err.message);
    }
    setLinking(false);
  };

  const handleUnlink = async () => {
    if (!confirm('¿Desvincular el grupo de WhatsApp de este curso?')) return;
    setUnlinking(true);
    try {
      const { error } = await supabase
        .from('courses')
        .update({
          whatsapp_group_jid: null,
          whatsapp_channel_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', courseId);

      if (error) throw error;

      // Clean up junction table entries for this course
      await supabase
        .from('contact_whatsapp_groups')
        .delete()
        .eq('course_id', courseId);

      onUnlinked();
      setSyncResult(null);
      toast.success('Grupo desvinculado.');
    } catch (err: any) {
      toast.error(err.message);
    }
    setUnlinking(false);
  };

  const handleSync = async (channelId?: string, groupJid?: string) => {
    const chId = channelId || currentChannelId;
    const gJid = groupJid || currentGroupJid;
    if (!chId || !gJid) return;

    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-group-members', {
        body: { channel_id: chId, group_jid: gJid, course_id: courseId },
      });
      if (error) throw new Error(error.message);
      setSyncResult(data);
    } catch (err: any) {
      toast.error(`Error sincronizando: ${err.message}`);
    }
    setSyncing(false);
  };

  const linkedGroupName = currentGroupJid
    ? groups.find(g => g.jid === currentGroupJid)?.name || currentGroupJid
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-800 text-slate-100 max-w-lg rounded-2xl shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-sm uppercase tracking-widest text-emerald-400 font-bold flex items-center gap-2">
            <Wifi className="w-4 h-4" /> Vincular Grupo WhatsApp
          </DialogTitle>
          <p className="text-xs text-slate-500 mt-1">Curso: {courseTitle}</p>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* Already linked state */}
          {currentGroupJid && (
            <div className="p-4 bg-emerald-900/10 border border-emerald-500/20 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span className="text-sm font-bold text-emerald-400">Grupo vinculado</span>
                </div>
                <Button variant="ghost" size="sm" onClick={handleUnlink} disabled={unlinking}
                  className="text-red-400 hover:text-red-300 hover:bg-red-900/20 h-8 text-[10px] uppercase tracking-widest font-bold">
                  {unlinking ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Unlink className="w-3 h-3 mr-1" />}
                  Desvincular
                </Button>
              </div>
              <p className="text-xs text-slate-300">{linkedGroupName}</p>
              <p className="text-[10px] text-slate-600 font-mono">{currentGroupJid}</p>

              <Button variant="outline" size="sm" onClick={() => handleSync()} disabled={syncing}
                className="w-full border-emerald-500/30 text-emerald-400 hover:bg-emerald-900/20 h-9 text-[10px] uppercase tracking-widest font-bold">
                {syncing ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <RefreshCw className="w-3 h-3 mr-1" />}
                Re-sincronizar Miembros
              </Button>
            </div>
          )}

          {/* Sync results */}
          {syncResult && (
            <div className="p-3 bg-[#121214] border border-[#222225] rounded-xl space-y-2">
              <p className="text-[10px] uppercase tracking-widest font-bold text-slate-500">Sincronización</p>
              <div className="flex gap-4 text-xs">
                <span className="text-slate-300"><Users className="w-3 h-3 inline mr-1" />{syncResult.synced} miembros</span>
                <span className="text-emerald-400">{syncResult.matched} en CRM</span>
                <span className="text-amber-400">{syncResult.unmatched} sin contacto</span>
              </div>
            </div>
          )}

          {/* Channel selector */}
          {!currentGroupJid && (
            <>
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">Canal GOWA</label>
                {loadingChannels ? (
                  <div className="flex items-center gap-2 text-xs text-slate-500"><Loader2 className="w-4 h-4 animate-spin" /> Cargando canales...</div>
                ) : (
                  <Select value={selectedChannel} onValueChange={handleChannelChange}>
                    <SelectTrigger className="bg-[#121214] border-[#222225] rounded-xl h-11 text-xs text-slate-300">
                      <SelectValue placeholder="Selecciona un canal..." />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-800 text-slate-100 rounded-xl">
                      {channels.map(ch => (
                        <SelectItem key={ch.id} value={ch.id}>
                          {ch.name} ({ch.instance_id})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Groups list */}
              {selectedChannel && (
                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">
                    Grupos disponibles
                    {groups.length > 0 && <span className="text-slate-600 ml-2">({groups.length})</span>}
                  </label>

                  {loadingGroups ? (
                    <div className="flex items-center gap-2 text-xs text-slate-500 py-8 justify-center">
                      <Loader2 className="w-4 h-4 animate-spin" /> Cargando grupos de WhatsApp...
                    </div>
                  ) : groups.length === 0 ? (
                    <p className="text-center text-slate-600 text-xs py-8 italic">Este canal no tiene grupos.</p>
                  ) : (
                    <div className="max-h-[300px] overflow-y-auto space-y-1.5 custom-scrollbar pr-1">
                      {groups.map(g => (
                        <button
                          key={g.jid}
                          onClick={() => handleLink(g)}
                          disabled={linking}
                          className={cn(
                            'w-full flex items-center justify-between p-3 rounded-xl border transition-all text-left',
                            'bg-[#121214] border-[#222225] hover:border-emerald-500/50 hover:bg-emerald-900/5'
                          )}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-200 truncate">{g.name}</p>
                            <p className="text-[10px] text-slate-600 font-mono mt-0.5">{g.jid}</p>
                          </div>
                          <Badge variant="outline" className="text-[9px] border-slate-700 text-slate-400 shrink-0 ml-2">
                            <Users className="w-2.5 h-2.5 mr-1" />{g.participant_count}
                          </Badge>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
