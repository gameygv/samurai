import React, { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Archive as ArchiveIcon, Search, Loader2, MessageSquare,
  RefreshCw, Sparkles, Mail, User as UserIcon, Bot, BotOff, ShieldCheck, Filter, Trash2
} from 'lucide-react';
import { toast } from 'sonner';
import ChatViewer from '@/components/ChatViewer';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';

const Archive = () => {
  const { user, isManager } = useAuth();
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [agentFilter, setAgentFilter] = useState<string>('all');
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [agentsMap, setAgentsMap] = useState<Record<string, string>>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalCount, setTotalCount] = useState(0);


  useEffect(() => {
    if (user) fetchArchive(true, currentPage, pageSize);
  }, [currentPage, pageSize]);

  useEffect(() => {
    if (user) {
        fetchArchive(true, 1, pageSize);
        if (isManager) {
            supabase.from('profiles').select('id, full_name').then(({data}) => {
               if (data) {
                  const map: any = {};
                  data.forEach(d => map[d.id] = d.full_name);
                  setAgentsMap(map);
               }
            });
        }
    }
    // Realtime: refrescar archivo cuando llegan mensajes nuevos o leads cambian
    const archiveChannel = supabase.channel('archive-watch')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => fetchArchive(false))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'conversaciones' }, () => fetchArchive(false))
      .subscribe();
    return () => { supabase.removeChannel(archiveChannel); };
  }, [user, isManager]);

  const fetchArchive = async (showLoader = true, page = currentPage, size = pageSize) => {
    if (showLoader) setLoading(true);
    try {
      let query = supabase.from('leads').select('*, conversaciones(id)', { count: 'exact' }).order('last_message_at', { ascending: false });

      if (!isManager) {
          query = query.eq('assigned_to', user?.id);
      }

      const from = (page - 1) * size;
      const to = from + size - 1;

      const { data, error, count } = await query.range(from, to);
      if (error) throw error;
      setConversations(data || []);
      setTotalCount(count ?? 0);
    } finally {
      if (showLoader) setLoading(false);
    }
  };

  const handleOpenChat = (lead: any) => {
    setSelectedLead(lead);
    setIsChatOpen(true);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(l => l.id)));
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    const confirmed = window.confirm(`¿Eliminar ${selectedIds.size} lead(s) y todas sus conversaciones? Esta acción no se puede deshacer.`);
    if (!confirmed) return;

    setDeleting(true);
    try {
      const ids = Array.from(selectedIds);
      // Borrar conversaciones primero (FK)
      const { error: convError } = await supabase.from('conversaciones').delete().in('lead_id', ids);
      if (convError) throw convError;
      // Borrar leads
      const { error: leadError } = await supabase.from('leads').delete().in('id', ids);
      if (leadError) throw leadError;

      toast.success(`${ids.length} lead(s) eliminados`);
      setSelectedIds(new Set());
      fetchArchive(false);
    } catch (err: any) {
      toast.error(`Error al eliminar: ${err.message}`);
    } finally {
      setDeleting(false);
    }
  };

  const filtered = conversations.filter(l => {
    const matchesSearch = !searchTerm ||
      l.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.telefono?.includes(searchTerm) ||
      l.summary?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesAgent = agentFilter === 'all' || l.assigned_to === agentFilter || (agentFilter === 'unassigned' && !l.assigned_to);
    return matchesSearch && matchesAgent;
  });

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
             <ArchiveIcon className="w-8 h-8 text-indigo-400" /> Archivo de Chats
          </h1>
          <div className="flex items-center gap-3">
            {selectedIds.size > 0 && (
              <Button
                size="sm"
                variant="destructive"
                onClick={handleDeleteSelected}
                disabled={deleting}
                className="h-10 px-4 text-xs font-bold uppercase tracking-wider"
              >
                {deleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
                Eliminar ({selectedIds.size})
              </Button>
            )}
            {isManager && (
              <Select value={agentFilter} onValueChange={setAgentFilter}>
                <SelectTrigger className="w-48 h-10 rounded-xl bg-[#0f0f11] border-[#222225] text-slate-300 text-xs">
                  <Filter className="w-3.5 h-3.5 mr-2 text-slate-500" />
                  <SelectValue placeholder="Filtrar por agente" />
                </SelectTrigger>
                <SelectContent className="bg-[#0f0f11] border-[#222225]">
                  <SelectItem value="all">Todos los agentes</SelectItem>
                  <SelectItem value="unassigned">Sin asignar</SelectItem>
                  {Object.entries(agentsMap).map(([id, name]) => (
                    <SelectItem key={id} value={id}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <div className="relative w-80">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
              <Input placeholder="Buscar..." className="pl-10 h-10 rounded-xl" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}/>
            </div>
          </div>
        </div>

        <Card className="bg-[#0f0f11] border-[#222225] shadow-2xl rounded-2xl overflow-hidden min-h-[400px]">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-[#222225] bg-[#0a0a0c]">
                  <TableHead className="w-10 pl-4">
                    <Checkbox
                      checked={filtered.length > 0 && selectedIds.size === filtered.length}
                      onCheckedChange={toggleSelectAll}
                      className="border-slate-600"
                    />
                  </TableHead>
                  <TableHead className="text-slate-500 text-[10px] uppercase font-bold py-4">Cliente</TableHead>
                  {isManager && <TableHead className="text-slate-500 text-[10px] uppercase font-bold">Asignación</TableHead>}
                  <TableHead className="text-slate-500 text-[10px] uppercase font-bold">Resumen IA</TableHead>
                  <TableHead className="text-right pr-6"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? <TableRow><TableCell colSpan={5} className="h-48 text-center"><Loader2 className="animate-spin mx-auto text-indigo-500" /></TableCell></TableRow>
                : filtered.map((lead) => (
                  <TableRow key={lead.id} className={cn("border-[#222225] hover:bg-[#121214] transition-colors", selectedIds.has(lead.id) && "bg-[#121218]")}>
                    <TableCell className="pl-4">
                      <Checkbox
                        checked={selectedIds.has(lead.id)}
                        onCheckedChange={() => toggleSelect(lead.id)}
                        className="border-slate-600"
                      />
                    </TableCell>
                    <TableCell className="font-bold">{lead.nombre || lead.telefono}</TableCell>
                    {isManager && <TableCell className="text-indigo-400 text-xs">{agentsMap[lead.assigned_to] || 'Sin asignar'}</TableCell>}
                    <TableCell className="text-xs text-slate-400 max-w-sm truncate">{lead.summary || 'Sin resumen'}</TableCell>
                    <TableCell className="text-right pr-6">
                       <Button size="sm" variant="outline" onClick={() => handleOpenChat(lead)} className="h-8 text-[9px] uppercase font-bold">Leer Chat</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>

          {/* Paginación */}
          <div className="flex items-center justify-between px-6 py-3 border-t border-[#222225]">
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-slate-500">
                {totalCount > 0 ? `${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, totalCount)} de ${totalCount}` : '0 chats'}
              </span>
              <Select value={String(pageSize)} onValueChange={v => { setPageSize(Number(v)); setCurrentPage(1); }}>
                <SelectTrigger className="w-[90px] h-7 bg-[#161618] border-[#222225] rounded-lg text-[10px] text-slate-400">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-slate-100 rounded-xl">
                  <SelectItem value="50">50 / pág</SelectItem>
                  <SelectItem value="100">100 / pág</SelectItem>
                  <SelectItem value="200">200 / pág</SelectItem>
                  <SelectItem value="500">500 / pág</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" disabled={currentPage <= 1} onClick={() => setCurrentPage(p => p - 1)}
                className="text-[10px] h-7 px-3 text-slate-400 uppercase font-bold tracking-widest">Anterior</Button>
              <span className="text-[10px] text-slate-500 px-2">Pág {currentPage} de {Math.max(1, Math.ceil(totalCount / pageSize))}</span>
              <Button variant="ghost" size="sm" disabled={currentPage * pageSize >= totalCount} onClick={() => setCurrentPage(p => p + 1)}
                className="text-[10px] h-7 px-3 text-slate-400 uppercase font-bold tracking-widest">Siguiente</Button>
            </div>
          </div>
        </Card>
        {selectedLead && <ChatViewer lead={selectedLead} open={isChatOpen} onOpenChange={setIsChatOpen} />}
      </div>
    </Layout>
  );
};
export default Archive;
