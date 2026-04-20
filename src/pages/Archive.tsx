import React, { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Archive as ArchiveIcon, Search, Loader2, MessageSquare,
  RefreshCw, Sparkles, Mail, User as UserIcon, Bot, BotOff, ShieldCheck, Filter
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
  

  useEffect(() => {
    if (user) {
        fetchArchive();
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

  const fetchArchive = async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      let query = supabase.from('leads').select('*, conversaciones(id)').order('last_message_at', { ascending: false });
      
      // FILTRO DE PRIVACIDAD
      if (!isManager) {
          query = query.eq('assigned_to', user?.id);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      setConversations(data || []);
    } finally {
      if (showLoader) setLoading(false);
    }
  };

  const handleOpenChat = (lead: any) => {
    setSelectedLead(lead);
    setIsChatOpen(true);
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
                  <TableHead className="text-slate-500 text-[10px] uppercase font-bold py-4 pl-6">Cliente</TableHead>
                  {isManager && <TableHead className="text-slate-500 text-[10px] uppercase font-bold">Asignación</TableHead>}
                  <TableHead className="text-slate-500 text-[10px] uppercase font-bold">Resumen IA</TableHead>
                  <TableHead className="text-right pr-6"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? <TableRow><TableCell colSpan={4} className="h-48 text-center"><Loader2 className="animate-spin mx-auto text-indigo-500" /></TableCell></TableRow>
                : filtered.map((lead) => (
                  <TableRow key={lead.id} className="border-[#222225] hover:bg-[#121214] transition-colors">
                    <TableCell className="pl-6 font-bold">{lead.nombre || lead.telefono}</TableCell>
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
        </Card>
        {selectedLead && <ChatViewer lead={selectedLead} open={isChatOpen} onOpenChange={setIsChatOpen} />}
      </div>
    </Layout>
  );
};
export default Archive;