import React, { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  MessageSquare, Search, Loader2, Phone, Zap, BrainCircuit,
  Clock, MapPin, UserCheck, Brain, RefreshCw, Sparkles,
  AlertCircle, TrendingUp, Smile, Meh, Frown, Target, Mail, ShieldAlert, CheckCircle2, UserPlus
} from 'lucide-react';
import { toast } from 'sonner';
import ChatViewer from '@/components/ChatViewer';
import { CreateLeadDialog } from '@/components/leads/CreateLeadDialog';
import { cn } from '@/lib/utils';

const Leads = () => {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterIntent, setFilterIntent] = useState<string>('ALL');
  
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  useEffect(() => {
    fetchLeads();

    const channel = supabase
      .channel('leads-realtime-enhanced')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, (payload) => {
          if (payload.eventType === 'INSERT') {
            setLeads((prev) => [payload.new, ...prev]);
            toast.info('¡Nuevo lead detectado en el radar!');
          } else if (payload.eventType === 'UPDATE') {
            setLeads((prev) => prev.map((lead) => (lead.id === payload.new.id ? payload.new : lead)));
          }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchLeads = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .order('last_message_at', { ascending: false });

    if (!error && data) {
      setLeads(data);
    }
    setLoading(false);
  };

  const handleRunAnalysis = async () => {
     setAnalyzing(true);
     const tid = toast.loading("Forzando re-análisis neuronal de conversaciones...");
     try {
        const { data, error } = await supabase.functions.invoke('analyze-leads', {
           body: { force: true } 
        });
        
        if (error) {
          const errorBody = await error.context.json();
          throw new Error(errorBody.error || error.message);
        }
        
        if (data.results && data.results.length > 0) {
           toast.success(`Datos extraídos: ${data.results.length} perfiles enriquecidos.`, { id: tid });
           fetchLeads();
        } else {
           toast.info(data.message || "No se encontraron leads pendientes.", { id: tid });
        }
     } catch (err: any) {
        toast.error("Error: " + err.message, { id: tid });
     } finally {
        setAnalyzing(false);
     }
  };

  const handleOpenChat = (lead: any) => {
    setSelectedLead(lead);
    setIsChatOpen(true);
  };

  const getAnalysisFreshness = (dateString: string | null) => {
     if (!dateString) return <span className="text-[9px] text-slate-600 flex items-center gap-1"><AlertCircle className="w-3 h-3"/> Pendiente</span>;
     const diff = new Date().getTime() - new Date(dateString).getTime();
     const minutes = Math.floor(diff / 60000);
     
     if (minutes < 60) return <span className="text-[9px] text-green-500 font-bold">Hace {minutes}m</span>;
     if (minutes < 1440) return <span className="text-[9px] text-slate-400">Hace {Math.floor(minutes/60)}h</span>;
     return <span className="text-[9px] text-slate-600">Hace {Math.floor(minutes/1440)}d</span>;
  };

  const filteredLeads = leads.filter(l => {
    const matchesSearch = (l.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) || l.telefono?.includes(searchTerm));
    const matchesIntent = filterIntent === 'ALL' || l.buying_intent?.toUpperCase() === filterIntent;
    return matchesSearch && matchesIntent;
  });

  const intentStats = {
    alto: leads.filter(l => l.buying_intent?.toUpperCase() === 'ALTO').length,
    medio: leads.filter(l => l.buying_intent?.toUpperCase() === 'MEDIO').length,
    bajo: leads.filter(l => l.buying_intent?.toUpperCase() === 'BAJO').length,
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
             <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-2">
                Radar de Leads
                <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20 text-[10px]">
                   <Zap className="w-3 h-3 mr-1" /> LIVE
                </Badge>
             </h1>
             <p className="text-slate-400">Monitoreo táctico de prospectos e intención de compra.</p>
          </div>
          <div className="flex flex-wrap gap-3 items-center w-full md:w-auto">
             <Button 
                onClick={() => setIsCreateOpen(true)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-900/20"
             >
                <UserPlus className="w-4 h-4 mr-2" /> Nuevo Lead
             </Button>
             
             <Button 
               variant="outline"
               className="border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/10"
               onClick={handleRunAnalysis}
               disabled={analyzing}
             >
                {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
             </Button>
             
             <div className="relative w-full md:w-64">
               <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-500" />
               <Input 
                 placeholder="Buscar lead..." 
                 className="pl-8 bg-slate-900 border-slate-800 text-slate-200 h-10"
                 value={searchTerm}
                 onChange={(e) => setSearchTerm(e.target.value)}
               />
             </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <IntentCard label="Alta Intención 🔥" count={intentStats.alto} color="border-red-500/50" active={filterIntent === 'ALTO'} onClick={() => setFilterIntent(filterIntent === 'ALTO' ? 'ALL' : 'ALTO')} />
          <IntentCard label="Intención Media ⚡" count={intentStats.medio} color="border-yellow-500/50" active={filterIntent === 'MEDIO'} onClick={() => setFilterIntent(filterIntent === 'MEDIO' ? 'ALL' : 'MEDIO')} />
          <IntentCard label="Interés Inicial ❄️" count={intentStats.bajo} color="border-blue-500/50" active={filterIntent === 'BAJO'} onClick={() => setFilterIntent(filterIntent === 'BAJO' ? 'ALL' : 'BAJO')} />
        </div>

        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="border-b border-slate-800 flex flex-row items-center justify-between">
            <CardTitle className="text-white flex items-center gap-2 text-sm uppercase tracking-widest">
              <Target className="w-4 h-4 text-indigo-400" /> Prospectos en el Embudo
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-slate-800 hover:bg-slate-900">
                  <TableHead className="text-slate-400 text-[10px] uppercase">Cliente</TableHead>
                  <TableHead className="text-slate-400 text-[10px] uppercase">Salud de Datos (CAPI)</TableHead>
                  <TableHead className="text-slate-400 text-[10px] uppercase text-center">IA Analysis</TableHead>
                  <TableHead className="text-slate-400 text-[10px] uppercase">Intención</TableHead>
                  <TableHead className="text-slate-400 text-[10px] uppercase text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                   <TableRow><TableCell colSpan={5} className="text-center h-32"><Loader2 className="w-6 h-6 animate-spin mx-auto text-indigo-600" /></TableCell></TableRow>
                ) : filteredLeads.map((lead) => {
                  const hasName = lead.nombre && !lead.nombre.includes('Nuevo');
                  const hasEmail = lead.email && lead.email.length > 5;
                  const hasCity = lead.ciudad && lead.ciudad.length > 2;
                  
                  return (
                  <TableRow key={lead.id} className="border-slate-800 hover:bg-slate-800/30 transition-colors">
                    <TableCell>
                      <div className="flex flex-col">
                         <span className={cn("font-bold flex items-center gap-2", hasName ? 'text-indigo-400' : 'text-slate-300')}>
                            {lead.nombre || 'Desconocido'}
                            {lead.ai_paused && <Badge variant="destructive" className="h-4 px-1 text-[8px] bg-red-600">STOP</Badge>}
                         </span>
                         <span className="text-[10px] text-slate-500 mt-0.5 font-mono truncate max-w-[120px]">{lead.telefono}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                       <div className="flex gap-2">
                          <DataBadge label="NOMBRE" active={hasName} />
                          <DataBadge label="EMAIL" active={hasEmail} />
                          <DataBadge label="CIUDAD" active={hasCity} />
                       </div>
                    </TableCell>
                    <TableCell className="text-center">
                       {lead.summary ? (
                          <div className="flex flex-col items-center gap-1">
                             <Brain className="w-5 h-5 text-indigo-500" />
                             {getAnalysisFreshness(lead.last_analyzed_at)}
                          </div>
                       ) : (
                          <span className="text-[9px] text-slate-700 italic">Sin datos</span>
                       )}
                    </TableCell>
                    <TableCell>
                       <div className="flex flex-col gap-1 w-[100px]">
                          <div className="flex justify-between text-[8px] text-slate-500 font-bold uppercase"><span>{lead.buying_intent || 'BAJO'}</span></div>
                          <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                             <div className={cn("h-full transition-all duration-500", lead.buying_intent?.toUpperCase() === 'ALTO' ? 'bg-green-500' : lead.buying_intent?.toUpperCase() === 'MEDIO' ? 'bg-yellow-500' : 'bg-slate-700')} style={{ width: lead.buying_intent?.toUpperCase() === 'ALTO' ? '90%' : lead.buying_intent?.toUpperCase() === 'MEDIO' ? '50%' : '10%' }} />
                          </div>
                       </div>
                    </TableCell>
                    <TableCell className="text-right">
                       <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 h-8 text-[10px] font-bold" onClick={() => handleOpenChat(lead)}>
                          DETALLES <BrainCircuit className="w-3 h-3 ml-2" />
                       </Button>
                    </TableCell>
                  </TableRow>
                )})}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {isCreateOpen && (
           <CreateLeadDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} onSuccess={fetchLeads} />
        )}
      </div>
    </Layout>
  );
};

const DataBadge = ({ label, active }: { label: string, active: boolean }) => (
   <Badge variant="outline" className={cn("text-[8px] h-5 px-1.5 font-bold", active ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30" : "bg-slate-800 text-slate-600 border-slate-700")}>
      {active ? <CheckCircle2 className="w-2.5 h-2.5 mr-1" /> : <AlertCircle className="w-2.5 h-2.5 mr-1" />}
      {label}
   </Badge>
);

const IntentCard = ({ label, count, color, active, onClick }: any) => (
  <Card className={cn("bg-slate-900 border-slate-800 p-4 cursor-pointer transition-all hover:scale-[1.02]", active ? cn("ring-2 ring-indigo-500", color) : "hover:border-slate-700")} onClick={onClick}>
    <div className="flex justify-between items-center"><span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{label}</span><span className="text-2xl font-bold text-white">{count}</span></div>
  </Card>
);

export default Leads;