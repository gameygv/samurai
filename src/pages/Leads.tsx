import React, { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MessageSquare, Search, Loader2, Phone, Mail, MapPin, Zap } from 'lucide-react';
import { toast } from 'sonner';

const Leads = () => {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

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

  const filteredLeads = leads.filter(l => 
    l.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    l.telefono?.includes(searchTerm) ||
    l.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
             <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-2">
                Leads & Conversaciones
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
                  <TableHead className="text-slate-400">Contacto</TableHead>
                  <TableHead className="text-slate-400">Estado Emocional</TableHead>
                  <TableHead className="text-slate-400">Score</TableHead>
                  <TableHead className="text-slate-400">Funnel</TableHead>
                  <TableHead className="text-slate-400 text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                   <TableRow>
                      <TableCell colSpan={6} className="text-center h-24 text-slate-500">
                         <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                         Cargando leads...
                      </TableCell>
                   </TableRow>
                ) : filteredLeads.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center h-24 text-slate-500">
                       No se encontraron leads.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLeads.map((lead) => (
                    <TableRow key={lead.id} className="border-slate-800 hover:bg-slate-800/50 transition-colors">
                      <TableCell>
                        <div className="flex flex-col">
                           <span className="font-bold text-slate-200">{lead.nombre || 'Lead Sin Nombre'}</span>
                           <div className="flex items-center gap-1 text-xs text-slate-500 mt-1">
                              <MapPin className="w-3 h-3" /> {lead.ciudad || 'N/A'}
                           </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1 text-xs text-slate-400">
                           <div className="flex items-center gap-1"><Phone className="w-3 h-3" /> {lead.telefono}</div>
                           <div className="flex items-center gap-1"><Mail className="w-3 h-3" /> {lead.email}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                         <Badge variant="outline" className={`
                            ${lead.estado_emocional_actual === 'ENOJADO' ? 'border-red-500 text-red-500 bg-red-500/10' :
                              lead.estado_emocional_actual === 'FRUSTRADO' ? 'border-orange-500 text-orange-500 bg-orange-500/10' :
                              lead.estado_emocional_actual === 'EMOCIONAL' ? 'border-purple-500 text-purple-500 bg-purple-500/10' :
                              lead.estado_emocional_actual === 'PRAGMÁTICO' ? 'border-blue-500 text-blue-500 bg-blue-500/10' :
                              'border-slate-500 text-slate-500'}
                         `}>
                            {lead.estado_emocional_actual || 'NEUTRO'}
                         </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-slate-300">
                         {lead.confidence_score ? `${lead.confidence_score}%` : '-'}
                      </TableCell>
                      <TableCell className="text-slate-400 text-sm">
                         {lead.funnel_stage || 'Inicial'} <span className="text-xs text-slate-600">({lead.dias_en_funnel}d)</span>
                      </TableCell>
                      <TableCell className="text-right">
                         <Button size="sm" variant="ghost" className="text-indigo-400 hover:text-indigo-300 hover:bg-indigo-900/20">
                            Ver Chat
                         </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Leads;