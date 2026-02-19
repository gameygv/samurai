import React, { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Archive as ArchiveIcon, Search, Loader2, MessageSquare, 
  Calendar, User, Bot, ArrowRight, Filter
} from 'lucide-react';
import { toast } from 'sonner';
import ChatViewer from '@/components/ChatViewer';

const Archive = () => {
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);

  useEffect(() => {
    fetchArchive();
  }, []);

  const fetchArchive = async () => {
    setLoading(true);
    try {
      // Obtenemos los leads que tienen conversaciones
      const { data, error } = await supabase
        .from('leads')
        .select('*, conversaciones(id)')
        .order('last_message_at', { ascending: false });

      if (error) throw error;
      setConversations(data || []);
    } catch (err: any) {
      toast.error('Error cargando el archivo');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChat = (lead: any) => {
    setSelectedLead(lead);
    setIsChatOpen(true);
  };

  const filtered = conversations.filter(l => 
    l.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    l.telefono?.includes(searchTerm)
  );

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-2">
              <ArchiveIcon className="w-8 h-8 text-indigo-500" />
              Archivo de Conversaciones
            </h1>
            <p className="text-slate-400">Historial completo de interacciones archivadas por lead.</p>
          </div>
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
            <Input 
              placeholder="Buscar por cliente o teléfono..." 
              className="pl-10 bg-slate-900 border-slate-800 text-white"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="border-b border-slate-800 flex flex-row items-center justify-between">
            <CardTitle className="text-white text-sm uppercase tracking-widest flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-indigo-400" /> Registros Archivados
            </CardTitle>
            <div className="flex items-center gap-2">
               <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white" onClick={fetchArchive}>
                  <RefreshCw className="w-3 h-3 mr-2" /> Actualizar
               </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-slate-800 hover:bg-slate-950/50">
                  <TableHead className="text-slate-400">Cliente</TableHead>
                  <TableHead className="text-slate-400">Último Mensaje</TableHead>
                  <TableHead className="text-slate-400">Plataforma</TableHead>
                  <TableHead className="text-slate-400 text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-32 text-center">
                      <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-500" />
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-32 text-center text-slate-500">
                      No hay conversaciones archivadas.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((lead) => (
                    <TableRow key={lead.id} className="border-slate-800 hover:bg-slate-800/30 group">
                      <TableCell>
                        <div className="flex items-center gap-3">
                           <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-bold text-indigo-400">
                              {lead.nombre?.substring(0, 2).toUpperCase()}
                           </div>
                           <div className="flex flex-col">
                              <span className="font-bold text-slate-200">{lead.nombre || 'Desconocido'}</span>
                              <span className="text-[10px] text-slate-500 font-mono">{lead.telefono}</span>
                           </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                           <span className="text-xs text-slate-400 truncate max-w-[300px]">
                              {lead.summary || 'Sin resumen disponible...'}
                           </span>
                           <span className="text-[9px] text-slate-600 flex items-center gap-1 mt-1 uppercase">
                              <Calendar className="w-3 h-3" /> {new Date(lead.last_message_at).toLocaleString()}
                           </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[9px] border-slate-700 text-slate-500">WHATSAPP</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button 
                          size="sm" 
                          variant="secondary" 
                          className="h-8 bg-slate-800 hover:bg-indigo-600 hover:text-white group-hover:shadow-lg transition-all"
                          onClick={() => handleOpenChat(lead)}
                        >
                          Revisar & Corregir <ArrowRight className="w-3 h-3 ml-2" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
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

const RefreshCw = ({ className }: { className?: string }) => (
   <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>
);

export default Archive;