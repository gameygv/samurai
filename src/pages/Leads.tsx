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
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Search, Loader2, Target, UserPlus, Sparkles, MapPin, Mail, ShieldCheck, AlertTriangle, Bot, Play, Pause
} from 'lucide-react';
import { toast } from 'sonner';
import ChatViewer from '@/components/ChatViewer';
import { CreateLeadDialog } from '@/components/leads/CreateLeadDialog';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';

const Leads = () => {
  const { user, isAdmin } = useAuth();
  const [leads, setLeads] = useState<any[]>([]);
  const [agentsMap, setAgentsMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterIntent, setFilterIntent] = useState<string>('ALL');
  
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  useEffect(() => {
    fetchLeads();
    supabase.from('profiles').select('id, full_name').then(({data}) => {
       if (data) {
          const map: any = {};
          data.forEach(d => map[d.id] = d.full_name);
          setAgentsMap(map);
       }
    });

    const channel = supabase.channel('leads-realtime').on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => fetchLeads()).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchLeads = async () => {
    setLoading(true);
    let query = supabase.from('leads').select('*').order('last_message_at', { ascending: false });
    if (!isAdmin) {
       query = query.eq('assigned_to', user?.id);
    }
    const { data } = await query;
    if (data) setLeads(data);
    setLoading(false);
  };

  const handleRunAnalysis = async () => {
     setAnalyzing(true);
     try {
        await supabase.functions.invoke('analyze-leads', { body: { force: true } });
        toast.success("Análisis completo.");
        fetchLeads();
     } catch (err) { toast.error("Error en análisis"); } finally { setAnalyzing(false); }
  };

  const handleGlobalAiToggle = async (pause: boolean) => {
    if (!confirm(`¿Estás seguro de ${pause ? 'PAUSAR' : 'ACTIVAR'} la IA para TODOS tus leads mostrados?`)) return;
    setLoading(true);
    try {
        let query = supabase.from('leads').update({ ai_paused: pause });
        if (!isAdmin) {
            query = query.eq('assigned_to', user?.id);
        } else {
            query = query.neq('id', '00000000-0000-0000-0000-000000000000');
        }
        await query;
        toast.success(`IA ${pause ? 'Pausada' : 'Activada'} masivamente.`);
        fetchLeads();
    } catch (err) {
        toast.error("Error ejecutando acción masiva.");
    }
  };

  const filteredLeads = leads.filter(l => {
    const matchesSearch = (l.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) || l.telefono?.includes(searchTerm) || l.apellido?.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesIntent = filterIntent === 'ALL' || l.buying_intent?.toUpperCase() === filterIntent;
    return matchesSearch && matchesIntent;
  });

  const getIntentUI = (intent: string) => {
     const i = (intent || 'BAJO').toUpperCase();
     if (i === 'COMPRADO') return { color: 'bg-emerald-500', width: '100%', label: 'GANADO', textColor: 'text-emerald-400' };
     if (i === 'PERDIDO') return { color: 'bg-red-500', width: '100%', label: 'PERDIDO', textColor: 'text-red-400' };
     if (i === 'ALTO') return { color: 'bg-amber-500', width: '90%', label: 'CIERRE', textColor: 'text-amber-400' };
     if (i === 'MEDIO') return { color: 'bg-indigo-400', width: '50%', label: 'SEDUCCIÓN', textColor: 'text-indigo-400' };
     return { color: 'bg-slate-500', width: '20%', label: 'DATA HUNTING', textColor: 'text-slate-400' };
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
             <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-2">
                Radar de Leads 
                <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/30 ml-2 animate-pulse">LIVE</Badge>
             </h1>
             <p className="text-slate-400">Vigila la salud de los datos y el cierre de ventas.</p>
          </div>
          <div className="flex gap-3 items-center flex-wrap">
             
             <DropdownMenu>
                <DropdownMenuTrigger asChild>
                   <Button variant="outline" className="border-indigo-500/30 text-indigo-400 bg-indigo-900/10 hover:bg-indigo-900/30 rounded-full h-9">
                      <Bot className="w-4 h-4 mr-2"/> IA Global
                   </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="bg-slate-900 border-slate-800 text-white">
                   <DropdownMenuLabel className="text-[10px] text-slate-500 uppercase">Control Masivo</DropdownMenuLabel>
                   <DropdownMenuSeparator className="bg-slate-800" />
                   <DropdownMenuItem onClick={() => handleGlobalAiToggle(false)} className="text-emerald-400 focus:bg-emerald-900/20 focus:text-emerald-300 cursor-pointer">
                      <Play className="w-4 h-4 mr-2"/> Activar a Todos
                   </DropdownMenuItem>
                   <DropdownMenuItem onClick={() => handleGlobalAiToggle(true)} className="text-red-400 focus:bg-red-900/20 focus:text-red-300 cursor-pointer">
                      <Pause className="w-4 h-4 mr-2"/> Pausar a Todos
                   </DropdownMenuItem>
                </DropdownMenuContent>
             </DropdownMenu>

             <Button onClick={() => setIsCreateOpen(true)} className="bg-indigo-900 hover:bg-indigo-800 text-amber-500 shadow-lg rounded-full h-9">
                <UserPlus className="w-4 h-4 mr-2" /> Nuevo Lead
             </Button>

             <Button variant="outline" onClick={handleRunAnalysis} disabled={analyzing} className="border-slate-700 text-slate-300 hover:bg-slate-800 rounded-full h-9" title="Forzar extracción de datos">
                {analyzing ? <Loader2 className="animate-spin" /> : <Sparkles className="w-4 h-4" />}
             </Button>
             
             <Select value={filterIntent} onValueChange={setFilterIntent}>
                <SelectTrigger className="w-[140px] bg-slate-900/50 border-slate-800 rounded-full text-xs h-9">
                   <SelectValue placeholder="Filtrar Embudo" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-white">
                   <SelectItem value="ALL">Todo el Embudo</SelectItem>
                   <SelectItem value="BAJO">1. Data Hunting</SelectItem>
                   <SelectItem value="MEDIO">2. Seducción</SelectItem>
                   <SelectItem value="ALTO">3. Cierre (Hot)</SelectItem>
                   <SelectItem value="COMPRADO">4. Ganados</SelectItem>
                   <SelectItem value="PERDIDO">5. Perdidos</SelectItem>
                </SelectContent>
             </Select>

             <div className="relative w-full md:w-64">
               <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
               <Input 
                  placeholder="Buscar nombre o tel..." 
                  className="pl-10 bg-slate-900/50 border-slate-800 text-slate-200 rounded-full focus:border-amber-500 h-9 text-xs" 
                  value={searchTerm} 
                  onChange={e => setSearchTerm(e.target.value)} 
               />
             </div>
          </div>
        </div>

        <Card className="bg-slate-900 border-slate-800 shadow-2xl rounded-2xl overflow-hidden">
          <CardHeader className="border-b border-slate-800 bg-slate-950/40">
             <CardTitle className="text-slate-200 text-xs flex items-center gap-2 uppercase tracking-widest font-bold">
                <Target className="w-4 h-4 text-amber-500" /> Prospectos Listados ({filteredLeads.length})
             </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-slate-800 bg-slate-900/20">
                  <TableHead className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Cliente</TableHead>
                  <TableHead className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Data CAPI & Pagos</TableHead>
                  <TableHead className="text-slate-500 text-[10px] uppercase font-bold tracking-wider text-center">Score IA</TableHead>
                  <TableHead className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Etapa</TableHead>
                  <TableHead className="text-slate-500 text-[10px] uppercase font-bold tracking-wider text-right">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                   <TableRow><TableCell colSpan={5} className="text-center h-32"><Loader2 className="w-6 h-6 animate-spin mx-auto text-amber-600" /></TableCell></TableRow>
                ) : filteredLeads.map((lead) => {
                  const hasEmail = lead.email && lead.email.length > 5;
                  const hasCity = lead.ciudad && lead.ciudad.length > 2;
                  const ui = getIntentUI(lead.buying_intent);
                  
                  return (
                  <TableRow key={lead.id} className="border-slate-800 hover:bg-slate-800/40 transition-colors">
                    <TableCell>
                       <div className="flex flex-col gap-1">
                          <span className="font-bold text-slate-100">{lead.nombre || 'Desconocido'} {lead.apellido || ''}</span>
                          <div className="flex items-center gap-2">
                             <span className="text-[10px] text-slate-500 font-mono">{lead.telefono}</span>
                             {lead.assigned_to && agentsMap[lead.assigned_to] && isAdmin && (
                                <Badge variant="outline" className="text-[8px] h-4 px-1 border-purple-900/50 bg-purple-900/20 text-purple-400 font-medium">Resp: {agentsMap[lead.assigned_to].split(' ')[0]}</Badge>
                             )}
                          </div>
                       </div>
                    </TableCell>
                    <TableCell>
                       <div className="flex gap-2 flex-wrap max-w-[200px]">
                          <DataBadge label="EMAIL" active={hasEmail} />
                          <DataBadge label="UBICACIÓN" active={hasCity} />
                          {lead.payment_status === 'VALID' && <Badge variant="outline" className="text-[9px] h-5 px-1.5 border-emerald-500 bg-emerald-900/30 text-emerald-400 font-bold">PAGO OK</Badge>}
                          {lead.payment_status === 'INVALID' && <Badge variant="outline" className="text-[9px] h-5 px-1.5 border-red-500 bg-red-900/30 text-red-400 font-bold">PAGO FALSO</Badge>}
                          {lead.payment_status === 'DOUBTFUL' && <Badge variant="outline" className="text-[9px] h-5 px-1.5 border-amber-500 bg-amber-900/30 text-amber-400 font-bold">DUDOSO</Badge>}
                          {(!lead.payment_status || lead.payment_status === 'NONE') && <Badge variant="outline" className="text-[9px] h-5 px-1.5 border-slate-700 text-slate-500">S/PAGO</Badge>}
                       </div>
                    </TableCell>
                    <TableCell className="text-center">
                       <div className="flex flex-col items-center">
                          <span className="text-[11px] font-bold text-indigo-400">{lead.lead_score || 0}</span>
                          <span className="text-[8px] text-slate-500 uppercase">/100</span>
                       </div>
                    </TableCell>
                    <TableCell>
                       <div className="flex flex-col gap-1 w-[100px]">
                          <span className={cn("text-[9px] font-bold tracking-widest", ui.textColor)}>{ui.label}</span>
                          <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                             <div className={cn("h-full transition-all duration-500", ui.color)} style={{ width: ui.width }} />
                          </div>
                       </div>
                    </TableCell>
                    <TableCell className="text-right">
                       <Button size="sm" variant="outline" className="border-slate-700 hover:bg-slate-800 h-8 text-[10px] uppercase font-bold tracking-widest text-amber-500" onClick={() => { setSelectedLead(lead); setIsChatOpen(true); }}>
                          REVISAR
                       </Button>
                    </TableCell>
                  </TableRow>
                )})}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        {isCreateOpen && <CreateLeadDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} onSuccess={fetchLeads} />}
        {selectedLead && <ChatViewer lead={selectedLead} open={isChatOpen} onOpenChange={setIsChatOpen} />}
      </div>
    </Layout>
  );
};

const DataBadge = ({ label, active }: { label: string, active: boolean }) => (
   <Badge variant="outline" className={cn("text-[9px] h-5 font-bold tracking-wider", active ? "bg-emerald-900/30 text-emerald-400 border-emerald-500/30" : "bg-slate-900 text-slate-600 border-slate-800")}>{label}</Badge>
);

export default Leads;