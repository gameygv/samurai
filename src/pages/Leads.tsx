import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Layout from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableHeader, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Loader2, Target, UserPlus, Sparkles, Filter, Globe, User as UserIcon } from 'lucide-react';
import { LeadRow } from '@/components/leads/LeadRow';
import { CreateLeadDialog } from '@/components/leads/CreateLeadDialog';
import ChatViewer from '@/components/ChatViewer';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { extractTagText, parseTagsSafe } from '@/lib/tag-parser';

const Leads = () => {
  const { user, isManager } = useAuth();
  const [searchParams] = useSearchParams();
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const [selectedTagFilter, setSelectedTagFilter] = useState<string>('ALL');
  const [selectedIntent, setSelectedIntent] = useState<string>('ALL');
  const [globalTags, setGlobalTags] = useState<any[]>([]);
  const [localTags, setLocalTags] = useState<any[]>([]);

  useEffect(() => { 
    if (user) {
        fetchLeads(); 
        fetchTags();
    }
  }, [user]);

  const fetchLeads = async () => {
    setLoading(true);
    try {
      // FILTRO DE PRIVACIDAD: Si no es manager, solo ve lo asignado a él
      let query = supabase.from('leads').select('*').order('last_message_at', { ascending: false });
      
      if (!isManager) {
          query = query.eq('assigned_to', user?.id);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      
      const leadsList = data || [];
      setLeads(leadsList);

      const targetId = searchParams.get('id');
      if (targetId) {
        const target = leadsList.find(l => l.id === targetId);
        if (target) {
          setSelectedLead(target);
          setIsChatOpen(true);
        }
      }
    } catch (err: any) {
      toast.error("Error al cargar leads: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchTags = async () => {
    if (!user) return;
    const { data } = await supabase.from('app_config').select('key, value').in('key', [`agent_tags_${user.id}`, 'global_tags']);
    if (data) {
      const local = data.find(d => d.key === `agent_tags_${user.id}`)?.value;
      const global = data.find(d => d.key === 'global_tags')?.value;
      if (local) setLocalTags(parseTagsSafe(local));
      if (global) setGlobalTags(parseTagsSafe(global));
    }
  };

  const handleRunMassAnalysis = async () => {
    setAnalyzing(true);
    toast.info("Iniciando escaneo profundo de chats...");
    try {
      const { error } = await supabase.functions.invoke('analyze-leads', { body: { force: true } });
      if (error) throw error;
      toast.success("Análisis completado. Perfiles actualizados.");
      fetchLeads();
    } catch (err: any) {
      toast.error("Error en el motor de IA: " + err.message);
    } finally {
      setAnalyzing(false);
    }
  };

  const allTags = [...globalTags, ...localTags];

  const filtered = leads.filter(l => {
    const term = String(searchTerm || '').toLowerCase().trim();
    const contactTags = Array.isArray(l.tags) ? l.tags.map(extractTagText) : [];
    
    const nombre = String(l.nombre || '').toLowerCase();
    const telefono = String(l.telefono || '').toLowerCase();
    const ciudad = String(l.ciudad || '').toLowerCase();
    
    const matchesSearch = term === '' || nombre.includes(term) || telefono.includes(term) || ciudad.includes(term);
    const matchesTag = selectedTagFilter === 'ALL' || contactTags.includes(selectedTagFilter);
    const matchesIntent = selectedIntent === 'ALL' || String(l.buying_intent || 'BAJO').toUpperCase() === selectedIntent;

    return matchesSearch && matchesTag && matchesIntent;
  });

  const handleOpenChat = (lead: any) => {
    setSelectedLead(lead);
    setIsChatOpen(true);
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <div className="p-2 bg-amber-500/10 rounded-xl border border-amber-500/20">
                <Target className="w-6 h-6 text-amber-500" />
              </div>
              Radar Leads {!isManager && <span className="text-slate-500 font-normal text-lg ml-2">| Mis Asignados</span>}
            </h1>
            <p className="text-slate-500 text-sm mt-1">Monitoreo de inteligencia y embudo en tiempo real.</p>
          </div>
          <div className="flex gap-3">
            {isManager && (
              <Button 
                variant="outline" 
                className="border-[#333336] bg-[#0a0a0c] hover:bg-[#161618] text-amber-500 h-10 px-4 font-bold rounded-xl text-[10px] uppercase tracking-widest"
                onClick={handleRunMassAnalysis}
                disabled={analyzing}
              >
                {analyzing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                Forzar Análisis IA
              </Button>
            )}
            <Button onClick={() => setIsCreateOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white p-2.5 px-6 rounded-xl shadow-lg transition-all font-bold text-[10px] uppercase tracking-widest">
              <UserPlus className="w-4 h-4 mr-2" /> Nuevo Lead
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 bg-[#0f0f11] p-3 rounded-2xl border border-[#222225] shadow-md">
          <div className="flex items-center gap-2 pl-2 border-r border-[#222225] pr-4">
            <Filter className="w-4 h-4 text-slate-500" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Filtros</span>
          </div>
          
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
            <Input placeholder="Buscar por nombre o teléfono..." className="pl-10 h-9 bg-[#161618] border-[#222225] rounded-xl text-xs focus-visible:ring-indigo-500/50 text-white" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>

          <Select value={selectedIntent} onValueChange={setSelectedIntent}>
            <SelectTrigger className="w-[160px] h-9 bg-[#161618] border-[#222225] rounded-xl text-xs text-slate-300">
              <SelectValue placeholder="Intención" />
            </SelectTrigger>
            <SelectContent className="bg-[#121214] border-[#222225] text-white rounded-xl">
              <SelectItem value="ALL">Cualquier Etapa</SelectItem>
              <SelectItem value="BAJO">Data Hunting (Bajo)</SelectItem>
              <SelectItem value="MEDIO">Seducción (Medio)</SelectItem>
              <SelectItem value="ALTO">Cierre (Alto)</SelectItem>
              <SelectItem value="COMPRADO">Ganado (Comprado)</SelectItem>
              <SelectItem value="PERDIDO">Perdido / Descartado</SelectItem>
            </SelectContent>
          </Select>

          <Select value={selectedTagFilter} onValueChange={setSelectedTagFilter}>
            <SelectTrigger className="w-[160px] h-9 bg-[#161618] border-[#222225] rounded-xl text-xs text-slate-300">
              <SelectValue placeholder="Etiqueta" />
            </SelectTrigger>
            <SelectContent className="bg-[#121214] border-[#222225] text-white rounded-xl max-h-[300px]">
              <SelectItem value="ALL">Todas las Etiquetas</SelectItem>
              {allTags.map(t => {
                const isGlobal = globalTags.some(gt => gt.text === t.text);
                return (
                  <SelectItem key={String(t.id || t.text)} value={String(t.text)} className="focus:bg-[#161618]">
                    <div className="flex items-center gap-2">
                      {isGlobal ? <Globe className="w-3 h-3 opacity-50 shrink-0"/> : <UserIcon className="w-3 h-3 opacity-50 shrink-0"/>}
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: String(t.color || '#475569') }}></div>
                      <span className="truncate">{String(t.text)}</span>
                    </div>
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
        </div>

        <Card className="bg-[#0f0f11] border-[#222225] shadow-2xl rounded-2xl overflow-hidden min-h-[400px]">
          <Table>
            <TableHeader className="bg-[#161618]">
              <TableRow className="border-[#222225] hover:bg-[#161618]">
                <TableHead className="text-[10px] uppercase font-bold text-slate-500 pl-6 py-4 tracking-widest">Prospecto</TableHead>
                <TableHead className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">Datos CAPI & Etiquetas</TableHead>
                <TableHead className="text-[10px] uppercase font-bold text-slate-500 text-center tracking-widest">IA Score</TableHead>
                <TableHead className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">Intención</TableHead>
                <TableHead className="text-[10px] uppercase font-bold text-slate-500 text-right pr-6 tracking-widest">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="h-60 text-center"><Loader2 className="animate-spin inline-block text-indigo-500" /></TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="h-60 text-center text-slate-600 italic text-[10px] uppercase font-bold tracking-widest">No tienes leads asignados que coincidan.</TableCell></TableRow>
              ) : (
                filtered.map(lead => (
                  <LeadRow 
                    key={String(lead.id)} 
                    lead={lead} 
                    allTags={allTags}
                    globalTags={globalTags}
                    onClick={() => handleOpenChat(lead)} 
                  />
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </div>

      <CreateLeadDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} onSuccess={fetchLeads} />
      {selectedLead && (
        <ChatViewer lead={selectedLead} open={isChatOpen} onOpenChange={setIsChatOpen} />
      )}
    </Layout>
  );
};

export default Leads;