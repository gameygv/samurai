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
  Calendar, User, Bot, ArrowRight, Filter, RefreshCw, Trash2, Sparkles
} from 'lucide-react';
import { toast } from 'sonner';
import ChatViewer from '@/components/ChatViewer';
import { logActivity } from '@/utils/logger';

const Archive = () => {
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    fetchArchive();
  }, []);

  const fetchArchive = async () => {
    if (!refreshing) setLoading(true);
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('*, conversaciones(id)')
        .order('last_message_at', { ascending: false });

      if (error) throw error;
      
      const validLeads = (data || []).filter(l => (l.nombre && l.nombre !== 'Nuevo Lead WhatsApp') || (l.conversaciones && l.conversaciones.length > 0));
      setConversations(validLeads);
    } catch (err: any) {
      toast.error('Error cargando el archivo');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRunAnalysis = async () => {
     setAnalyzing(true);
     toast.info("Iniciando análisis neuronal de conversaciones recientes...");
     try {
        const { data, error } = await supabase.functions.invoke('analyze-leads', {});
        if (error) throw error;
        
        if (data.results && data.results.length > 0) {
           toast.success(`Análisis completo: ${data.results.length} perfiles actualizados.`);
           fetchArchive();
        } else {
           toast.info(data.message || "No se encontraron leads pendientes de análisis.");
        }
     } catch (err: any) {
        toast.error("Error en análisis: " + err.message);
        if (err.message.includes("Gemini API Key")) {
           toast.warning("Ve a Ajustes > API Keys y configura tu Gemini API Key.");
        }
     } finally {
        setAnalyzing(false);
     }
  };

  const handleDeleteLead = async (id: string, nombre: string) => {
    if (!confirm(`¿Estás seguro? Se borrará a "${nombre}" de raíz.`)) return;
    
    setRefreshing(true);
    try {
      await supabase.from('conversaciones').delete().eq('lead_id', id);
      const { error } = await supabase.from('leads').delete().eq('id', id);

      if (error) throw error;

      await logActivity({
        action: 'DELETE',
        resource: 'LEADS',
        description: `Chat eliminado permanentemente: ${nombre}`,
        status: 'OK'
      });

      toast.success('Chat eliminado correctamente');
      setConversations(prev => prev.filter(c => c.id !== id));
    } catch (err: any) {
      toast.error('Fallo al eliminar: ' + err.message);
    } finally {
      setRefreshing(false);
    }
  };

  const handleOpenChat = (lead: any) => {
    setSelectedLead(lead);
    setIsChatOpen(true);
  };

  const filtered = conversations.filter(l => 
    l.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    l.telefono?.includes(searchTerm) ||
    l.summary?.toLowerCase().includes(searchTerm.toLowerCase())
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
            <p className="text-slate-400">Historial completo de interacciones archivadas.</p>
          </div>
          <div className="flex gap-3 items-center">
            <Button 
              variant="outline" 
              className="border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/10"
              onClick={handleRunAnalysis}
              disabled={analyzing}
            >
              {analyzing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
              Analizar Chats
            </Button>
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
              <Input 
                placeholder="Buscar..." 
                className="pl-10 bg-slate-900 border-slate-800 text-white"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>

        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="border-b border-slate-800 flex flex-row items-center justify-between">
            <CardTitle className="text-white text-sm uppercase tracking-widest flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-indigo-400" /> Registros ({filtered.length})
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={fetchArchive} disabled={refreshing}>
               <RefreshCw className={`w-3 h-3 mr-2 ${refreshing ? 'animate-spin' : ''}`} /> Actualizar
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-slate-800">
                  <TableHead className="text-slate-400">Cliente</TableHead>
                  <TableHead className="text-slate-400">Resumen IA</TableHead>
                  <TableHead className="text-slate-400 text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && !refreshing ? (
                  <TableRow><TableCell colSpan={3} className="h-32 text-center"><Loader2 className="animate-spin mx-auto text-indigo-500" /></TableCell></TableRow>
                ) : filtered.map((lead) => (
                  <TableRow key={lead.id} className="border-slate-800 hover:bg-slate-800/30">
                    <TableCell>
                       <div className="flex flex-col">
                          <span className="font-bold text-slate-200">{lead.nombre || 'Sin nombre'}</span>
                          <span className="text-[10px] text-slate-500 font-mono">{lead.telefono || 'Sin número'}</span>
                       </div>
                    </TableCell>
                    <TableCell>
                       <span className="text-xs text-slate-400 italic line-clamp-1">{lead.summary || 'Sin análisis...'}</span>
                    </TableCell>
                    <TableCell className="text-right">
                       <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon" className="text-red-500/50 hover:text-red-500" onClick={() => handleDeleteLead(lead.id, lead.nombre)}>
                             <Trash2 className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="secondary" className="text-[10px] font-bold" onClick={() => handleOpenChat(lead)}>
                             REVISAR <ArrowRight className="w-3 h-3 ml-2" />
                          </Button>
                       </div>
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