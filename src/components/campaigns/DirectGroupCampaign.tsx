import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Loader2, Users, Wifi, Send, Search, Check, AlertCircle,
  CheckCircle2, XCircle, Image, Video, Music, X as XIcon, Paperclip
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface CachedGroup {
  id: string;
  jid: string;
  name: string;
  member_count: number;
  channel_id: string;
  channel_name?: string;
}

interface SendResult {
  groupId: string;
  groupName: string;
  success: boolean;
  error?: string;
}

interface MediaAttachment {
  url: string;
  type: 'image' | 'video' | 'audio';
  name: string;
  previewUrl?: string;
}

const MEDIA_ACCEPT: Record<string, string> = {
  image: 'image/jpeg,image/png,image/webp',
  video: 'video/mp4,video/3gpp',
  audio: 'audio/ogg,audio/mpeg,audio/mp4,audio/wav',
};

export const DirectGroupCampaign = () => {
  const [groups, setGroups] = useState<CachedGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [media, setMedia] = useState<MediaAttachment | null>(null);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendResults, setSendResults] = useState<SendResult[]>([]);
  const [currentSendIndex, setCurrentSendIndex] = useState(-1);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video' | 'audio'>('image');

  useEffect(() => {
    fetchGroups();
  }, []);

  useEffect(() => {
    return () => { if (media?.previewUrl) URL.revokeObjectURL(media.previewUrl); };
  }, [media]);

  const fetchGroups = async () => {
    setLoading(true);
    // Load all active groups with channel name
    const { data } = await supabase
      .from('whatsapp_groups_cache')
      .select('id, jid, name, member_count, channel_id, whatsapp_channels(name)')
      .eq('is_active', true)
      .order('name');

    if (data) {
      setGroups(data.map((g: any) => ({
        ...g,
        channel_name: g.whatsapp_channels?.name || '',
      })));
    }
    setLoading(false);
  };

  const filteredGroups = searchQuery
    ? groups.filter(g =>
        g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        g.channel_name?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : groups;

  const handleToggle = (id: string) => {
    setSendResults([]);
    setSelectedGroupIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    setSendResults([]);
    setSelectedGroupIds(
      selectedGroupIds.length === filteredGroups.length ? [] : filteredGroups.map(g => g.id)
    );
  };

  const handleMediaSelect = (type: 'image' | 'video' | 'audio') => {
    setMediaType(type);
    setTimeout(() => fileInputRef.current?.click(), 0);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 16 * 1024 * 1024) { toast.error('Máximo 16MB.'); return; }

    setUploading(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'bin';
      const path = `campaigns/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('media').upload(path, file);
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(path);
      if (!publicUrl) throw new Error('No se pudo generar URL');

      setMedia({
        url: publicUrl, type: mediaType, name: file.name,
        previewUrl: mediaType === 'image' ? URL.createObjectURL(file) : undefined,
      });
    } catch (err: any) { toast.error(`Error subiendo: ${err.message}`); }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemoveMedia = () => {
    if (media?.previewUrl) URL.revokeObjectURL(media.previewUrl);
    setMedia(null);
  };

  const handleSend = async () => {
    const selected = groups.filter(g => selectedGroupIds.includes(g.id));
    if (selected.length === 0 || (!message.trim() && !media)) return;

    if (!confirm(`¿Enviar mensaje a ${selected.length} grupo${selected.length > 1 ? 's' : ''} de WhatsApp?`)) return;

    setSending(true);
    setSendResults([]);
    const results: SendResult[] = [];

    for (let i = 0; i < selected.length; i++) {
      const group = selected[i];
      setCurrentSendIndex(i);
      try {
        const body: Record<string, unknown> = {
          channel_id: group.channel_id,
          group_jid: group.jid,
          message: message.trim(),
        };
        if (media) body.mediaData = { url: media.url, type: media.type, name: media.name };

        const { data, error } = await supabase.functions.invoke('send-group-message', { body });
        if (error) throw new Error(error?.message || 'Error');
        if (!data?.success) throw new Error(data?.error || 'Fallo');

        results.push({ groupId: group.id, groupName: group.name, success: true });
      } catch (err: any) {
        results.push({ groupId: group.id, groupName: group.name, success: false, error: err.message });
      }
      setSendResults([...results]);
    }

    setCurrentSendIndex(-1);
    setSending(false);
    const ok = results.filter(r => r.success).length;
    const fail = results.filter(r => !r.success).length;
    if (fail === 0) toast.success(`Enviado a ${ok} grupo${ok > 1 ? 's' : ''}.`);
    else toast.warning(`${ok} enviados, ${fail} con error.`);
  };

  const someSelected = selectedGroupIds.length > 0;
  const canSend = someSelected && (message.trim() || media) && !sending;
  const sendComplete = sendResults.length > 0 && !sending;

  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-emerald-500" /></div>;

  return (
    <Card className="bg-[#0f0f11] border-[#222225] shadow-2xl rounded-2xl border-l-4 border-l-indigo-500">
      <CardHeader className="bg-[#161618] border-b border-[#222225] py-4">
        <CardTitle className="text-white text-sm uppercase tracking-widest font-bold flex items-center gap-2">
          <Wifi className="w-4 h-4 text-indigo-400" /> Campaña a Grupos Directos
        </CardTitle>
        <p className="text-xs text-slate-500 mt-1">Selecciona grupos de WhatsApp y envía un mensaje directo.</p>
      </CardHeader>
      <CardContent className="p-6 space-y-4">
        {/* Search + select all */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
            <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder="Buscar grupo o canal..." className="bg-[#121214] border-[#222225] text-xs h-9 pl-9 rounded-xl" />
          </div>
          <Button variant="ghost" size="sm" onClick={handleSelectAll} disabled={sending}
            className="text-[10px] uppercase tracking-widest font-bold text-slate-400 h-7 shrink-0">
            {selectedGroupIds.length === filteredGroups.length ? 'Ninguno' : `Todos (${filteredGroups.length})`}
          </Button>
        </div>

        {/* Group list */}
        <div className="max-h-[250px] overflow-y-auto space-y-1.5 custom-scrollbar pr-1">
          {filteredGroups.map(g => {
            const isSelected = selectedGroupIds.includes(g.id);
            const result = sendResults.find(r => r.groupId === g.id);
            const selected = groups.filter(gg => selectedGroupIds.includes(gg.id));
            const isCurrent = sending && currentSendIndex >= 0 && selected[currentSendIndex]?.id === g.id;

            return (
              <button key={g.id} onClick={() => !sending && handleToggle(g.id)} disabled={sending}
                className={cn('w-full flex items-center gap-3 p-2.5 rounded-xl border transition-all text-left',
                  isSelected ? 'bg-indigo-900/10 border-indigo-500/30' : 'bg-[#121214] border-[#222225] hover:border-[#333336]',
                  sending && 'cursor-default'
                )}>
                <Checkbox checked={isSelected} tabIndex={-1}
                  className="border-slate-600 data-[state=checked]:bg-indigo-500 data-[state=checked]:border-indigo-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-200 truncate">{g.name}</p>
                  <span className="text-[10px] text-slate-600">{g.channel_name}</span>
                </div>
                <Badge variant="outline" className="text-[9px] border-slate-700 text-slate-400 shrink-0">
                  <Users className="w-2.5 h-2.5 mr-1" />{g.member_count}
                </Badge>
                {isCurrent && <Loader2 className="w-4 h-4 animate-spin text-indigo-400 shrink-0" />}
                {result?.success && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
                {result && !result.success && <XCircle className="w-4 h-4 text-red-400 shrink-0" />}
              </button>
            );
          })}
        </div>

        {/* Editor */}
        {someSelected && (
          <>
            <label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">
              Mensaje para {selectedGroupIds.length} grupo{selectedGroupIds.length > 1 ? 's' : ''}
            </label>

            {media && (
              <div className="relative bg-[#121214] border border-[#222225] rounded-xl p-3">
                <Button variant="ghost" size="icon" onClick={handleRemoveMedia} disabled={sending}
                  className="absolute top-2 right-2 h-6 w-6 bg-black/60 hover:bg-black/80 text-white rounded-full z-10">
                  <XIcon className="w-3 h-3" />
                </Button>
                {media.type === 'image' && media.previewUrl && <img src={media.previewUrl} alt="Preview" className="max-h-32 rounded-lg object-contain mx-auto" />}
                {media.type !== 'image' && <p className="text-xs text-slate-300">{media.name} ({media.type})</p>}
              </div>
            )}

            <Textarea value={message} onChange={e => setMessage(e.target.value)}
              placeholder={media ? 'Caption (opcional)...' : 'Mensaje para los grupos...'}
              className="bg-[#121214] border-[#222225] text-slate-200 rounded-xl min-h-[80px] text-sm" disabled={sending} />

            <div className="flex items-center gap-1">
              {!media && !sending && ['image', 'video', 'audio'].map(t => (
                <Button key={t} variant="ghost" size="sm" onClick={() => handleMediaSelect(t as any)} disabled={uploading}
                  className="h-8 px-2.5 text-slate-500 hover:text-white rounded-lg">
                  {t === 'image' ? <Image className="w-4 h-4" /> : t === 'video' ? <Video className="w-4 h-4" /> : <Music className="w-4 h-4" />}
                </Button>
              ))}
              {uploading && <span className="text-[10px] text-slate-500 ml-2">Subiendo...</span>}
            </div>

            <input ref={fileInputRef} type="file" className="hidden" accept={MEDIA_ACCEPT[mediaType]} onChange={handleFileChange} />

            {sendComplete ? (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-900/10 border border-emerald-500/20">
                <Check className="w-4 h-4 text-emerald-400" />
                <span className="text-sm font-bold text-emerald-400">
                  {sendResults.filter(r => r.success).length} de {sendResults.length} enviados
                </span>
              </div>
            ) : (
              <Button onClick={handleSend} disabled={!canSend}
                className="w-full h-12 rounded-xl font-bold uppercase tracking-widest text-[10px] bg-indigo-600 hover:bg-indigo-500 text-white">
                {sending ? (<><Loader2 className="w-4 h-4 animate-spin mr-2" /> Enviando {currentSendIndex + 1} de {selectedGroupIds.length}...</>)
                  : (<><Send className="w-4 h-4 mr-2" /> Enviar a {selectedGroupIds.length} Grupo{selectedGroupIds.length > 1 ? 's' : ''}</>)}
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};
