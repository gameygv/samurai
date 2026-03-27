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
  ArrowRight, RefreshCw, Trash2, Sparkles, Mail, User as UserIcon, Bot, BotOff, ShieldCheck
} from 'lucide-react';
import { toast } from 'sonner';
import ChatViewer from '@/components/ChatViewer';
import { AuditAgentDialog } from '@/components/archive/AuditAgentDialog';
import { logActivity } from '@/utils/logger';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';

const Archive = () => {
  const { user, isManager } = useAuth();
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  const [agentsMap, setAgentsMap] = useState<Record<string, string>>({});
  
  // Auditoría QA
  const [auditLeadId, setAuditLeadId] = useState<string | null>(null);
  const [auditAgentName, setAuditAgentName] = useState('');
  const [isAuditOpen, setIsAuditOpen] = useState(false);

  useEffect(() => {
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
  }, [user, isManager]);

  const fetchArchive = async () => {
    if (!refreshing) setLoading(true);
    try {
      let query = supabase.from('leads').select('*, conversaciones(id)').order('last_message_at', { ascending: false });
      if (!isManager) {
          query = query.eq('assigned_to', user?.id);
      }
      const { data, error } = await query;

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
     const tid = toast.loading("Forzando extracción de datos...");
     try {
        const { data, error } = await supabase.functions.invoke('analyze-leads', {
           body: { force: true }
        });
        
        if (error) throw new Error(error.message);
        
        if (data.results && data.results.length > 0) {
           toast.success(`Análisis completo: ${data.results.length} perfiles enriquecidos.`, { id: tid });
           fetchArchive();
        } else {
           toast.info(data.message || "No se encontraron leads pendientes de análisis.", { id: tid });
        }
     } catch (err: any) {
        toast.error("Error en análisis: " + err.message, { id: tid });
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

  const handleAuditAgent = (lead: any) => {
     setAuditLeadId(lead.id);
     setAuditAgentName(agentsMap[lead.assigned_to] || 'Agente Desconocido');
     setIsAuditOpen(true);
  };

  const filtered = conversations.filter(l => 
    l.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    l.telefono?.includes(searchTerm) ||
    l.summary?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (isManager && agentsMap[l.assigned_to]?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <div className="p-2 bg-indigo-900/30 rounded-xl border border-indigo-500/20">
                 <ArchiveIcon className="w-6 h-6 text-indigo-400" />
              </div>
              Archivo de Chats
            </h1>
            <p className="text-slate-400 text-sm mt-1">Historial completo, auditorías QA y resúmenes de inteligencia.</p>
          </div>
          <div className="flex gap-3 items-center flex-wrap">
            {isManager && (
              <Button 
                variant="outline" 
                className="border-indigo-500/30 text-indigo-400 hover:bg-indigo-900/40 h-10 px-4 rounded-xl uppercase tracking-widest text-[10px] font-bold"
                onClick={handleRunAnalysis}
                disabled={analyzing}
              >
                {analyzing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                Forzar Análisis IA
              </Button>
            )}
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
              <Input 
                placeholder={isManager ? "Buscar por cliente, agente o notas..." : "Buscar por nombre..."} 
                className="pl-10 h-10 rounded-xl bg-[#121214] border-[#222225] text-white focus-visible:ring-indigo-500/50"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>

        <Card className="bg-[#0f0f11] border-[#222225] shadow-2xl rounded-2xl overflow-hidden min-h-[400px]">
          <CardHeader className="border-b border-[#222225] bg-[#161618] flex flex-row items-center justify-between py-4">
            <CardTitle className="text-white text-sm uppercase tracking-widest flex items-center gap-2 font-bold">
              <MessageSquare className="w-4 h-4 text-indigo-400" /> Bóveda de Registros ({filtered.length})
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={fetchArchive} disabled={refreshing} className="h-8 text-[10px] uppercase tracking-widest font-bold text-slate-400 hover:text-white">
               <RefreshCw className={`w-3.5 h-3.5 mr-2 ${refreshing ? 'animate-spin' : ''}`} /> Actualizar
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-[#222225] bg-[#0a0a0c] hover:bg-[#0a0a0c]">
                  <TableHead className="text-slate-500 uppercase tracking-widest text-[10px] font-bold py-4 pl-6">Cliente</TableHead>
                  {isManager && <TableHead className="text-slate-500 uppercase tracking-widest text-[10px] font-bold">Asignación & Estado</TableHead>}
                  <TableHead className="text-slate-500 uppercase tracking-widest text-[10px] font-bold">Resumen de Conversación (IA)</TableHead>
                  <TableHead className="text-slate-500 uppercase tracking-widest text-[10px] font-bold text-right pr-6">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && !refreshing ? (
                  <TableRow><TableCell colSpan={isManager ? 4 : 3} className="h-48 text-center"><Loader2 className="animate-spin mx-auto text-indigo-500" /></TableCell></TableRow>
                ) : filtered.map((lead) => (
                  <TableRow key={lead.id} className="border-[#222225] hover:bg-[#121214] transition-colors">
                    <TableCell className="pl-6">
                       <div className="flex flex-col">
                          <span className="font-bold text-slate-200">{lead.nombre || 'Sin nombre'}</span>
                          <span className="text-[10px] text-slate-500 font-mono mt-0.5">{lead.telefono || 'Sin número'}</span>
                          {lead.email && <span className="text-[9px] text-emerald-500/80 flex items-center gap-1 mt-1"><Mail className="w-2.5 h-2.5"/> {lead.email}</span>}
                       </div>
                    </TableCell>
                    
                    {isManager && (
                       <TableCell>
                          <div className="flex flex-col gap-2">
                             <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest flex items-center gap-1.5 bg-indigo-950/20 border border-indigo-500/20 px-2 py-1 rounded-md w-fit">
                                <UserIcon className="w-3 h-3"/> {agentsMap[lead.assigned_to] || 'Bot Global (Sin Agente)'}
                             </span>
                             {lead.ai_paused ? (
                                <Badge variant="outline" className="text-[9px] bg-red-950/20 border-red-900/50 text-red-400 uppercase tracking-widest flex items-center gap-1 w-fit"><BotOff className="w-3 h-3"/> Humano al Mando</Badge>
                             ) : (
                                <Badge variant="outline" className="text-[9px] bg-emerald-950/20 border-emerald-900/50 text-emerald-400 uppercase tracking-widest flex items-center gap-1 w-fit"><Bot className="w-3 h-3"/> IA Activa</Badge>
                             )}
                          </div>
                       </TableCell>
                    )}

                    <TableCell>
                       <div className="flex flex-col gap-1.5 max-w-sm">
                          <span className="text-[11px] text-slate-300 leading-relaxed">{lead.summary || 'En cola de análisis...'}</span>
                          {lead.perfil_psicologico && <span className="text-[10px] text-amber-500/70 italic leading-relaxed line-clamp-2">Psicología: {lead.perfil_psicologico}</span>}
                       </div>
                    </TableCell>
                    
                    <TableCell className="text-right pr-6">
                       <div className="flex justify-end items-center gap-2">
                          {isManager && lead.ai_paused && (
                             <Button size="sm" variant="outline" className="h-8 bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500 hover:text-slate-900 text-[9px] font-bold uppercase tracking-widest px-3" onClick={() => handleAuditAgent(lead)}>
                                <ShieldCheck className="w-3.5 h-3.5 mr-1.5" /> Evaluar Agente
                             </Button>
                          )}
                          <Button size="sm" variant="outline" className="h-8 bg-[#161618] border-[#333336] text-indigo-400 hover:bg-indigo-600 hover:text-white text-[9px] font-bold uppercase tracking-widest px-3" onClick={() => handleOpenChat(lead)}>
                             <MessageSquare className="w-3.5 h-3.5 mr-1.5" /> Leer Chat
                          </Button>
                          {isManager && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:bg-red-900/20 hover:text-red-500 rounded-lg" onClick={() => handleDeleteLead(lead.id, lead.nombre)}>
                               <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                       </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {selectedLead && <ChatViewer lead={selectedLead} open={isChatOpen} onOpenChange={setIsChatOpen} />}
        <AuditAgentDialog open={isAuditOpen} onOpenChange={setIsAuditOpen} leadId={auditLeadId} agentName={auditAgentName} />
      </div>
    </Layout>
  );
};

export default Archive;