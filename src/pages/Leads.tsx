import React, { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MessageSquare, Search, Loader2, Phone, Zap, BrainCircuit } from 'lucide-react';
import { toast } from 'sonner';
import ChatViewer from '@/components/ChatViewer';

const Leads = () => {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);

  useEffect(() => {
    fetchLeads();

    const channel = supabase
      .channel('leads-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, (payload) => {
          if (payload.eventType === 'INSERT') {
            setLeads((prev) => [payload.new, ...prev]);
            toast.info('Nuevo lead detectado!');
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

  const handleOpenChat = (lead: any) => {
    setSelectedLead(lead);
    setIsChatOpen(true);
  };

  const filteredLeads = leads.filter(l => 
    l.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    l.telefono?.includes(searchTerm)
  );

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
             <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-2">
                Radar de Leads
                <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20 text-[10px] animate-pulse">
                   <Zap className="w-3 h-3 mr-1" /> LIVE
                </Badge>
             </h1>
             <p className="text-slate-400">Monitoreo en tiempo real de interacciones y perfiles psicológicos.</p>
          </div>
          <div className="relative w-full md:w-64">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-500" />
            <Input 
              placeholder="Buscar por nombre o teléfono..." 
              className="pl-8 bg-slate-900 border-slate-800 text-slate-200 h-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="border-b border-slate-800">
            <CardTitle className="text-white flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-indigo-400" />
              Últimos Leads Activos
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-slate-800 hover:bg-slate-900">
                  <TableHead className="text-slate-400">Cliente</TableHead>
                  <TableHead className="text-slate-400">Ubicación</TableHead>
                  <TableHead className="text-slate-400">Estado Emocional</TableHead>
                  <TableHead className="text-slate-400">Intención de Compra</TableHead>
                  <TableHead className="text-slate-400 text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                   <TableRow>
                      <TableCell colSpan={5} className="text-center h-24 text-slate-500">
                         <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                      </TableCell>
                   </TableRow>
                ) : filteredLeads.map((lead) => (
                  <TableRow key={lead.id} className="border-slate-800 hover:bg-slate-800/50">
                    <TableCell>
                      <div className="flex flex-col">
                         <span className="font-bold text-slate-200 flex items-center gap-2">
                            {lead.nombre || 'Desconocido'}
                            {lead.ai_paused && <Badge variant="destructive" className="h-4 px-1 text-[9px]">PAUSADO</Badge>}
                         </span>
                         <span className="text-xs text-slate-500 mt-1 flex items-center gap-1"><Phone className="w-3 h-3" /> {lead.telefono}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                       <span className="text-sm text-slate-300">{lead.ciudad || 'Pendiente...'}</span>
                    </TableCell>
                    <TableCell>
                       <Badge variant="outline" className={`
                          ${lead.estado_emocional_actual === 'ENOJADO' ? 'border-red-500 text-red-500 bg-red-500/10' :
                            lead.estado_emocional_actual === 'FELIZ' ? 'border-green-500 text-green-500 bg-green-500/10' :
                            'border-slate-600 text-slate-500'}
                       `}>
                          {lead.estado_emocional_actual || 'NEUTRO'}
                       </Badge>
                    </TableCell>
                    <TableCell>
                       <div className="flex flex-col gap-1 w-[120px]">
                          <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                             <span>SCORE</span>
                             <span>{lead.buying_intent || 'BAJO'}</span>
                          </div>
                          <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                             <div className="h-full bg-indigo-500" style={{ width: `${lead.confidence_score || 10}%` }} />
                          </div>
                       </div>
                    </TableCell>
                    <TableCell className="text-right">
                       <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 h-8" onClick={() => handleOpenChat(lead)}>
                          <BrainCircuit className="w-3 h-3 mr-2" /> Analizar
                       </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {selectedLead && (
          <ChatViewer 
            lead={selectedLead} 
            open={isChatOpen} 
            onOpenChange={setIsChatOpen} 
          />
        )}
      </div>
    </Layout>
  );
};

export default Leads;