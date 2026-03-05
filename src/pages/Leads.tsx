import React, { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  MessageSquare, Search, Loader2, Zap, BrainCircuit,
  Clock, CheckCircle2, AlertCircle, TrendingUp, Target, Mail, UserPlus, Sparkles, Brain
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
    const channel = supabase.channel('leads-realtime').on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => fetchLeads()).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchLeads = async () => {
    setLoading(true);
    const { data } = await supabase.from('leads').select('*').order('last_message_at', { ascending: false });
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

  const filteredLeads = leads.filter(l => {
    const matchesSearch = (l.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) || l.telefono?.includes(searchTerm));
    const matchesIntent = filterIntent === 'ALL' || l.buying_intent?.toUpperCase() === filterIntent;
    return matchesSearch && matchesIntent;
  });

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
             <h1 className="text-3xl font-bold text-slate-50 mb-2 flex items-center gap-2">
                Radar de Leads 
                <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/30 ml-2 animate-pulse">LIVE</Badge>
             </h1>
             <p className="text-slate-400">Vigila la salud de los datos y el cierre de ventas.</p>
          </div>
          <div className="flex gap-3 items-center">
             <Button onClick={() => setIsCreateOpen(true)} className="bg-indigo-900 hover:bg-indigo-800 text-amber-500 shadow-lg">
                <UserPlus className="w-4 h-4 mr-2" /> Nuevo Lead
             </Button>
             <Button variant="outline" onClick={handleRunAnalysis} disabled={analyzing} className="border-slate-700 text-slate-300 hover:bg-slate-800">
                {analyzing ? <Loader2 className="animate-spin" /> : <Sparkles className="w-4 h-4" />}
             </Button>
             <div className="relative w-64">
               <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
               <Input 
                  placeholder="Buscar..." 
                  className="pl-10 bg-slate-900/50 border-slate-800 text-slate-200 rounded-full focus:border-amber-500" 
                  value={searchTerm} 
                  onChange={e => setSearchTerm(e.target.value)} 
               />
             </div>
          </div>
        </div>

        <Card className="bg-slate-900 border-slate-800 shadow-2xl rounded-2xl overflow-hidden">
          <CardHeader className="border-b border-slate-800 bg-slate-950/40">
             <CardTitle className="text-slate-200 flex items-center gap-2 text-xs uppercase tracking-widest font-bold">
                <Target className="w-4 h-4 text-amber-500" /> Prospectos en el Embudo
             </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-slate-800 bg-slate-900/20">
                  <TableHead className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Cliente</TableHead>
                  <TableHead className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Calidad Datos (CAPI)</TableHead>
                  <TableHead className="text-slate-500 text-[10px] uppercase font-bold tracking-wider text-center">IA Status</TableHead>
                  <TableHead className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Intención</TableHead>
                  <TableHead className="text-slate-500 text-[10px] uppercase font-bold tracking-wider text-right">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                   <TableRow><TableCell colSpan={5} className="text-center h-32"><Loader2 className="w-6 h-6 animate-spin mx-auto text-amber-600" /></TableCell></TableRow>
                ) : filteredLeads.map((lead) => {
                  const hasEmail = lead.email && lead.email.length > 5;
                  const hasCity = lead.ciudad && lead.ciudad.length > 2;
                  return (
                  <TableRow key={lead.id} className="border-slate-800 hover:bg-slate-800/40 transition-colors">
                    <TableCell>
                       <div className="flex flex-col">
                          <span className="font-bold text-slate-100">{lead.nombre || 'Desconocido'}</span>
                          <span className="text-[10px] text-slate-500 font-mono">{lead.telefono}</span>
                       </div>
                    </TableCell>
                    <TableCell>
                       <div className="flex gap-2">
                          <DataBadge label="EMAIL" active={hasEmail} />
                          <DataBadge label="CIUDAD" active={hasCity} />
                       </div>
                    </TableCell>
                    <TableCell className="text-center">
                       {lead.summary ? <Brain className="w-4 h-4 text-indigo-400 mx-auto" /> : <Clock className="w-4 h-4 text-slate-600 mx-auto" />}
                    </TableCell>
                    <TableCell>
                       <div className="flex flex-col gap-1 w-[100px]">
                          <span className="text-[9px] text-slate-400 font-bold tracking-widest">{lead.buying_intent || 'BAJO'}</span>
                          <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                             <div className={cn("h-full transition-all duration-500", lead.buying_intent === 'ALTO' ? 'bg-amber-500' : lead.buying_intent === 'MEDIO' ? 'bg-indigo-400' : 'bg-slate-600')} style={{ width: lead.buying_intent === 'ALTO' ? '90%' : lead.buying_intent === 'MEDIO' ? '50%' : '15%' }} />
                          </div>
                       </div>
                    </TableCell>
                    <TableCell className="text-right">
                       <Button size="sm" variant="outline" className="border-slate-700 hover:bg-slate-800 h-8 text-[10px] uppercase font-bold tracking-widest text-amber-500" onClick={() => { setSelectedLead(lead); setIsChatOpen(true); }}>
                          DETALLES
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