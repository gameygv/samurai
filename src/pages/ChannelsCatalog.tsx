import React, { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, Wifi, Users, Search, RefreshCw, GraduationCap, AlertCircle, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ChannelWithStats {
  id: string;
  name: string;
  provider: string;
  is_active: boolean;
  group_count: number;
  last_synced_at: string | null;
}

interface CachedGroup {
  id: string;
  jid: string;
  name: string;
  member_count: number;
  is_active: boolean;
  course_id: string | null;
  last_synced_at: string;
  courses?: { title: string } | null;
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Nunca';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Hace un momento';
  if (mins < 60) return `Hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Hace ${hours}h`;
  return `Hace ${Math.floor(hours / 24)}d`;
}

const ChannelsCatalog = () => {
  const [channels, setChannels] = useState<ChannelWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedChannel, setExpandedChannel] = useState<string | null>(null);
  const [groups, setGroups] = useState<CachedGroup[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshingChannel, setRefreshingChannel] = useState<string | null>(null);

  useEffect(() => {
    fetchChannels();
  }, []);

  const fetchChannels = async () => {
    setLoading(true);
    // Obtener canales con conteo de grupos desde el cache
    const { data: channelData } = await supabase
      .from('whatsapp_channels')
      .select('id, name, provider, is_active')
      .eq('provider', 'gowa')
      .order('name');

    if (!channelData) { setLoading(false); return; }

    // Obtener conteos y última sync por canal
    const channelsWithStats: ChannelWithStats[] = [];
    for (const ch of channelData) {
      const { count } = await supabase
        .from('whatsapp_groups_cache')
        .select('id', { count: 'exact', head: true })
        .eq('channel_id', ch.id)
        .eq('is_active', true);

      const { data: lastSync } = await supabase
        .from('whatsapp_groups_cache')
        .select('last_synced_at')
        .eq('channel_id', ch.id)
        .order('last_synced_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      channelsWithStats.push({
        ...ch,
        group_count: count || 0,
        last_synced_at: lastSync?.last_synced_at || null,
      });
    }

    setChannels(channelsWithStats);
    setLoading(false);
  };

  const fetchGroups = async (channelId: string) => {
    setLoadingGroups(true);
    const { data } = await supabase
      .from('whatsapp_groups_cache')
      .select('id, jid, name, member_count, is_active, course_id, last_synced_at, courses(title)')
      .eq('channel_id', channelId)
      .order('is_active', { ascending: false })
      .order('name');

    setGroups((data as CachedGroup[]) || []);
    setLoadingGroups(false);
  };

  const handleExpandChannel = (channelId: string) => {
    if (expandedChannel === channelId) {
      setExpandedChannel(null);
      setGroups([]);
      setSearchQuery('');
    } else {
      setExpandedChannel(channelId);
      fetchGroups(channelId);
      setSearchQuery('');
    }
  };

  const handleRefresh = async (channelId: string) => {
    setRefreshingChannel(channelId);
    try {
      const { data, error } = await supabase.functions.invoke('sync-channel-groups', {
        body: { channel_id: channelId },
      });

      if (error) throw new Error(error?.message || 'Error al sincronizar');
      if (!data?.ok) throw new Error('Sync falló');

      toast.success(`Sync: ${data.groups_upserted} grupos actualizados`);
      await fetchChannels();
      if (expandedChannel === channelId) await fetchGroups(channelId);
    } catch (err: any) {
      toast.error(`Error: ${err.message}`);
    }
    setRefreshingChannel(null);
  };

  const filteredGroups = searchQuery
    ? groups.filter(g =>
        g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        g.jid.includes(searchQuery)
      )
    : groups;

  const syncAge = (dateStr: string | null): 'fresh' | 'stale' | 'none' => {
    if (!dateStr) return 'none';
    const mins = (Date.now() - new Date(dateStr).getTime()) / 60000;
    return mins < 60 ? 'fresh' : 'stale';
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Canales y Grupos</h1>
            <p className="text-xs text-slate-500 mt-1">
              {channels.length} canales GOWA — {channels.reduce((s, c) => s + c.group_count, 0)} grupos en cache
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleRefresh('')}
            disabled={!!refreshingChannel}
            className="text-[10px] uppercase tracking-widest font-bold border-emerald-500/30 text-emerald-400 hover:bg-emerald-900/20"
          >
            {refreshingChannel === '' ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <RefreshCw className="w-3 h-3 mr-1" />}
            Sync todos
          </Button>
        </div>

        {/* Channel cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {channels.map(ch => {
            const age = syncAge(ch.last_synced_at);
            const isExpanded = expandedChannel === ch.id;

            return (
              <Card
                key={ch.id}
                className={cn(
                  'bg-[#0f0f11] border-[#222225] shadow-lg rounded-2xl cursor-pointer transition-all hover:border-[#333336]',
                  isExpanded && 'col-span-full border-emerald-500/30',
                  !ch.is_active && 'opacity-50'
                )}
              >
                <CardHeader className="py-4 px-5" onClick={() => handleExpandChannel(ch.id)}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'w-10 h-10 rounded-xl flex items-center justify-center',
                        ch.is_active ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-slate-800 border border-slate-700'
                      )}>
                        <Wifi className={cn('w-5 h-5', ch.is_active ? 'text-emerald-400' : 'text-slate-600')} />
                      </div>
                      <div>
                        <CardTitle className="text-sm font-bold text-white">{ch.name}</CardTitle>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-slate-500">{ch.group_count} grupos</span>
                          {!ch.is_active && <Badge variant="outline" className="text-[8px] border-red-500/30 text-red-400">Inactivo</Badge>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {age === 'fresh' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                      {age === 'stale' && <AlertCircle className="w-4 h-4 text-amber-400" />}
                      <span className="text-[9px] text-slate-600">{timeAgo(ch.last_synced_at)}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => { e.stopPropagation(); handleRefresh(ch.id); }}
                        disabled={refreshingChannel === ch.id}
                        className="h-7 w-7 text-slate-500 hover:text-emerald-400"
                      >
                        {refreshingChannel === ch.id
                          ? <Loader2 className="w-3 h-3 animate-spin" />
                          : <RefreshCw className="w-3 h-3" />}
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                {/* Expanded: group list */}
                {isExpanded && (
                  <CardContent className="pt-0 px-5 pb-5 space-y-3">
                    {age === 'stale' && (
                      <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-900/10 border border-amber-500/20 text-xs text-amber-400">
                        <AlertCircle className="w-3 h-3" />
                        Última sync hace más de 1 hora. Considera refrescar.
                      </div>
                    )}

                    {/* Search */}
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                      <Input
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Buscar grupo..."
                        className="bg-[#121214] border-[#222225] text-slate-200 text-xs h-9 pl-9 rounded-xl"
                      />
                    </div>

                    {loadingGroups ? (
                      <div className="flex items-center justify-center py-6">
                        <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
                      </div>
                    ) : filteredGroups.length === 0 ? (
                      <p className="text-center text-slate-600 text-xs py-6">
                        {groups.length === 0 ? 'Este canal no tiene grupos.' : 'Sin resultados.'}
                      </p>
                    ) : (
                      <div className="max-h-[400px] overflow-y-auto space-y-1.5 custom-scrollbar pr-1">
                        {filteredGroups.map(g => (
                          <div
                            key={g.id}
                            className={cn(
                              'flex items-center justify-between p-3 rounded-xl border text-left',
                              g.is_active
                                ? 'bg-[#121214] border-[#222225]'
                                : 'bg-[#0d0d0f] border-[#1a1a1d] opacity-60'
                            )}
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-slate-200 truncate">{g.name}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[10px] text-slate-600 font-mono">{g.jid}</span>
                                {g.courses?.title && (
                                  <Badge variant="outline" className="text-[8px] border-indigo-500/30 text-indigo-400">
                                    <GraduationCap className="w-2.5 h-2.5 mr-0.5" />
                                    {g.courses.title}
                                  </Badge>
                                )}
                                {!g.is_active && (
                                  <Badge variant="outline" className="text-[8px] border-slate-700 text-slate-500">Inactivo</Badge>
                                )}
                              </div>
                            </div>
                            <Badge variant="outline" className="text-[9px] border-slate-700 text-slate-400 shrink-0 ml-2">
                              <Users className="w-2.5 h-2.5 mr-1" />{g.member_count}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}

                    <p className="text-[9px] text-slate-600 text-right">
                      {filteredGroups.filter(g => g.is_active).length} activos
                      {filteredGroups.some(g => !g.is_active) && `, ${filteredGroups.filter(g => !g.is_active).length} inactivos`}
                    </p>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      </div>
    </Layout>
  );
};

export default ChannelsCatalog;
