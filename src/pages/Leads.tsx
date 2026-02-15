import React, { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MessageSquare, Search, Loader2, Phone, Mail, MapPin, Zap, BrainCircuit } from 'lucide-react';
import { toast } from 'sonner';
import ChatViewer from '@/components/ChatViewer';

const Leads = () => {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Chat Viewer State
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);

  useEffect(() => {
    fetchLeads();

    // Real-time subscription
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'leads',
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setLeads((prev) => [payload.new, ...prev]);
            toast.info('Nuevo lead detectado!');
          } else if (payload.eventType === 'UPDATE') {
            setLeads((prev) => prev.map((lead) => (lead.id === payload.new.id ? payload.new : lead)));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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
    l.telefono?.includes(searchTerm) ||
    l.email?.toLowerCase().includes(searchTerm.toLowerCase())
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
             <p className="text-slate-400">Monitoreo en tiempo real de interacciones vía Kommo.</p>
          </div>
          <div className="relative w-full md:w-64">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-500" />
            <Input 
              placeholder="Buscar por nombre o teléfono..." 
              className="pl-8 bg-slate-900 border-slate-800 text-slate-200"
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
                  <TableHead className="text-slate-400">Psicología (IA)</TableHead>
                  <TableHead className="text-slate-400">Probabilidad Compra</TableHead>
                  <TableHead className="text-slate-400">Última Actividad</TableHead>
                  <TableHead className="text-slate-400 text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                   <TableRow>
                      <TableCell colSpan={5} className="text-center h-24 text-slate-500">
                         <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                         Cargando leads...
                      </TableCell>
                   </TableRow>
                ) : filteredLeads.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center h-24 text-slate-500">
                       No se encontraron leads.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLeads.map((lead) => (
                    <TableRow key={lead.id} className="border-slate-800 hover:bg-slate-800/50 transition-colors">
                      <TableCell className="w-[250px]">
                        <div className="flex flex-col">
                           <span className="font-bold text-slate-200 flex items-center gap-2">
                              {lead.nombre || 'Lead Sin Nombre'}
                              {lead.ai_paused && <Badge variant="destructive" className="h-4 px-1 text-[9px]">PAUSADO</Badge>}
                           </span>
                           <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                              <Phone className="w-3 h-3" /> {lead.telefono || 'Sin Tlf'}
                           </div>
                           {lead.summary && (
                              <p className="text-[10px] text-slate-400 mt-1 line-clamp-1 italic">"{lead.summary}"</p>
                           )}
                        </div>
                      </TableCell>
                      <TableCell>
                         <div className="flex flex-col gap-1">
                           <Badge variant="outline" className={`w-fit
                              ${lead.estado_emocional_actual?.includes('ENOJADO') ? 'border-red-500 text-red-500 bg-red-500/10' :
                                lead.estado_emocional_actual?.includes('FELIZ') ? 'border-green-500 text-green-500 bg-green-500/10' :
                                lead.estado_emocional_actual?.includes('PRAGMATICO') ? 'border-blue-500 text-blue-500 bg-blue-500/10' :
                                'border-slate-600 text-slate-500'}
                           `}>
                              {lead.estado_emocional_actual || 'NEUTRO'}
                           </Badge>
                         </div>
                      </TableCell>
                      <TableCell className="w-[200px]">
                         <div className="space-y-1">
                            <div className="flex justify-between text-xs">
                               <span className="text-slate-400">Score: {lead.confidence_score || 0}%</span>
                               <span className="text-[10px] text-slate-500 font-mono">{lead.buying_intent || 'BAJO'}</span>
                            </div>
                            <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                               <div 
                                 className={`h-full rounded-full ${
                                    (lead.confidence_score || 0) > 70 ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 
                                    (lead.confidence_score || 0) > 40 ? 'bg-yellow-500' : 'bg-slate-600'
                                 }`} 
                                 style={{ width: `${lead.confidence_score || 5}%` }}
                               />
                            </div>
                         </div>
                      </TableCell>
                      <TableCell className="text-xs text-slate-400">
                         {new Date(lead.last_message_at).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                         <Button 
                            size="sm" 
                            className="bg-indigo-600 hover:bg-indigo-700 h-8 text-xs"
                            onClick={() => handleOpenChat(lead)}
                         >
                            <BrainCircuit className="w-3 h-3 mr-2" />
                            Analizar Chat
                         </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Chat Component */}
        <ChatViewer 
           lead={selectedLead} 
           open={isChatOpen} 
           onOpenChange={setIsChatOpen} 
        />
      </div>
    </Layout>
  );
};

export default Leads;