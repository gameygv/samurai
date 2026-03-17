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
  Contact, Search, Loader2, MapPin, Mail, Phone, ExternalLink, 
  UserPlus, Tag, Trash2, RefreshCw, Users, FileSpreadsheet, Megaphone
} from 'lucide-react';
import { toast } from 'sonner';
import ChatViewer from '@/components/ChatViewer';
import { CreateLeadDialog } from '@/components/leads/CreateLeadDialog';
import { ImportContactsDialog } from '@/components/contacts/ImportContactsDialog';
import { MassMessageDialog } from '@/components/contacts/MassMessageDialog';
import { FinancialStatusBadge } from '@/components/contacts/FinancialStatusBadge';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const Contacts = () => {
  const { user, isManager } = useAuth();
  const [contacts, setContacts] = useState<any[]>([]);
  const [groups, setGroups] = useState<string[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>('ALL');
  
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isMassMessageOpen, setIsMassMessageOpen] = useState(false);
  
  const [contactToDelete, setContactToDelete] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [localTags, setLocalTags] = useState<{id: string, text: string, color: string}[]>([]);

  useEffect(() => {
    fetchContacts();
    if (user) fetchLocalTags();

    const channel = supabase.channel('contacts-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contacts' }, () => fetchContacts())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const fetchContacts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('contacts')
      .select('*, leads(id, buying_intent, payment_status, lead_score, ai_paused, summary, telefono, nombre, apellido, email, ciudad, estado, cp, pais, tags)')
      .order('updated_at', { ascending: false });

    if (!error && data) {
      setContacts(data);
      // Extraer grupos únicos
      const uniqueGroups = Array.from(new Set(data.map(d => d.grupo).filter(Boolean))) as string[];
      setGroups(uniqueGroups);
    }
    setLoading(false);
  };

  const fetchLocalTags = async () => {
     if(!user) return;
     const { data } = await supabase.from('app_config').select('value').eq('key', `agent_tags_${user.id}`).maybeSingle();
     if (data?.value) {
        try { setLocalTags(JSON.parse(data.value)); } catch(e) {}
     }
  };

  const handleDeleteContact = async (contact: any) => {
    setIsDeleting(true);
    const tid = toast.loading(`Eliminando a ${contact.nombre}...`);
    try {
      const leadId = contact.lead_id;

      if (leadId) {
         await supabase.from('conversaciones').delete().eq('lead_id', leadId);
         await supabase.from('leads').delete().eq('id', leadId);
      }

      const { error } = await supabase.from('contacts').delete().eq('id', contact.id);
      
      if (error) throw error;

      toast.success("Registro eliminado permanentemente.", { id: tid });
      setContactToDelete(null);
      fetchContacts();
    } catch (err: any) {
      toast.error("Error de integridad: " + err.message, { id: tid });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleOpenChat = async (contact: any) => {
    let leadId = contact.lead_id;
    
    if (!leadId) {
       const tid = toast.loading("Creando entorno de chat para este contacto...");
       try {
           const { data: newLead, error } = await supabase.from('leads').insert({
               nombre: contact.nombre || 'Contacto Importado',
               telefono: contact.telefono,
               email: contact.email,
               ciudad: contact.ciudad,
               estado: contact.estado,
               cp: contact.cp,
               pais: contact.pais,
               tags: contact.tags,
               buying_intent: 'BAJO',
               ai_paused: true,
               summary: `Prospecto iniciado desde importación de Contactos. ${contact.grupo ? 'Grupo: '+contact.grupo : ''}`
           }).select().single();

           if (error) throw error;
           
           await supabase.from('contacts').update({ lead_id: newLead.id }).eq('id', contact.id);

           toast.success("Entorno de chat listo.", { id: tid });
           setSelectedLead(newLead);
           setIsChatOpen(true);
           fetchContacts();
           return;
       } catch (err: any) {
           toast.error("Error al iniciar chat: " + err.message, { id: tid });
           return;
       }
    }

    const { data: lead } = await supabase.from('leads').select('*').eq('id', leadId).maybeSingle();
    if (lead) {
      setSelectedLead(lead);
      setIsChatOpen(true);
    } else {
      toast.error("No se encontró el entorno de chat asociado.");
    }
  };

  const getSafeTags = (tags: any) => Array.isArray(tags) ? tags : [];

  const filteredContacts = contacts.filter(c => {
    const term = searchTerm.toLowerCase();
    const l = c.leads || {};
    const contactTags = getSafeTags(c.tags);
    const leadTags = getSafeTags(l.tags);
    
    const matchesSearch = 
      c.nombre?.toLowerCase().includes(term) ||
      c.apellido?.toLowerCase().includes(term) ||
      c.telefono?.includes(term) ||
      c.email?.toLowerCase().includes(term) ||
      c.ciudad?.toLowerCase().includes(term) ||
      c.financial_status?.toLowerCase().includes(term) ||
      contactTags.some((t: string) => t.toLowerCase().includes(term)) ||
      leadTags.some((t: string) => t.toLowerCase().includes(term));
      
    const matchesGroup = selectedGroup === 'ALL' || c.grupo === selectedGroup;

    return matchesSearch && matchesGroup;
  });

  const leadData = (c: any) => c.leads || null;

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-6 pb-12">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <div className="p-2 bg-indigo-900/30 rounded-xl border border-indigo-500/20">
                <Users className="w-6 h-6 text-indigo-400" />
              </div>
              Directorio de Contactos
            </h1>
            <p className="text-slate-400 text-sm mt-1">Gestión de base de datos, segmentaciones y envíos masivos.</p>
          </div>
          <div className="flex gap-2 items-center flex-wrap">
            <Select value={selectedGroup} onValueChange={setSelectedGroup}>
               <SelectTrigger className="w-[160px] bg-slate-900 border-slate-800 h-10 rounded-xl text-indigo-300 font-bold">
                  <SelectValue placeholder="Todos los Grupos" />
               </SelectTrigger>
               <SelectContent className="bg-slate-900 border-slate-800 text-white rounded-xl">
                  <SelectItem value="ALL">Todos los Grupos</SelectItem>
                  {groups.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
               </SelectContent>
            </Select>

            <Button onClick={() => setIsMassMessageOpen(true)} variant="secondary" className="bg-amber-600/20 text-amber-500 hover:bg-amber-600/30 border border-amber-500/30 h-10">
              <Megaphone className="w-4 h-4 mr-2" /> Difusión ({filteredContacts.length})
            </Button>
            <Button onClick={() => setIsImportOpen(true)} variant="outline" className="border-slate-700 text-slate-300 bg-slate-900 hover:bg-slate-800 h-10">
              <FileSpreadsheet className="w-4 h-4 mr-2" /> Importar CSV
            </Button>
            <Button onClick={() => setIsCreateOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 h-10 px-6 font-bold text-xs uppercase tracking-widest rounded-xl">
              <UserPlus className="w-4 h-4 mr-2" /> Nuevo
            </Button>
            <div className="relative w-full md:w-64 mt-2 xl:mt-0">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
              <Input
                placeholder="Buscar por tag, ciudad o nombre..."
                className="pl-10 bg-slate-900/50 border-slate-800 text-slate-200 rounded-xl h-10 focus-visible:ring-indigo-500"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>

        <Card className="bg-slate-900 border-slate-800 shadow-2xl rounded-2xl overflow-hidden">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-slate-800 bg-slate-900/20">
                  <TableHead className="text-slate-500 text-[10px] uppercase font-bold pl-6">Nombre y Contacto</TableHead>
                  <TableHead className="text-slate-500 text-[10px] uppercase font-bold">Ubicación & Segmentación</TableHead>
                  {isManager && <TableHead className="text-slate-500 text-[10px] uppercase font-bold">Finanzas</TableHead>}
                  <TableHead className="text-slate-500 text-[10px] uppercase font-bold text-right pr-6">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={isManager ? 4 : 3} className="h-40 text-center"><Loader2 className="animate-spin mx-auto text-indigo-500" /></TableCell></TableRow>
                ) : filteredContacts.length === 0 ? (
                  <TableRow><TableCell colSpan={isManager ? 4 : 3} className="h-40 text-center text-slate-500 italic">No hay registros que coincidan.</TableCell></TableRow>
                ) : filteredContacts.map((contact) => {
                  const l = leadData(contact);
                  const combinedTags = Array.from(new Set([...getSafeTags(contact.tags), ...getSafeTags(l?.tags)]));
                  
                  return (
                    <TableRow key={contact.id} className="border-slate-800 hover:bg-slate-800/40 transition-colors">
                      <TableCell className="pl-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-slate-950 border border-slate-800 flex items-center justify-center text-indigo-400 font-bold uppercase shrink-0">
                            {contact.nombre?.substring(0, 2) || 'CL'}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-100">{contact.nombre || 'Sin nombre'} {contact.apellido || ''}</span>
                            <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                              <Phone className="w-2.5 h-2.5" /> {contact.telefono}
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1.5 items-start">
                          <span className={cn("text-[10px] flex items-center gap-1.5", contact.email ? "text-emerald-400" : "text-slate-600 italic")}>
                            <Mail className="w-3 h-3" /> {contact.email || 'Sin email'}
                          </span>
                          <span className={cn("text-[10px] flex items-center gap-1.5", contact.ciudad ? "text-slate-300" : "text-slate-600 italic")}>
                            <MapPin className="w-3 h-3 text-slate-500" /> {contact.ciudad || 'Sin ciudad'}
                          </span>
                          
                          <div className="flex flex-wrap gap-1 mt-1">
                             {contact.grupo && (
                                <Badge className="bg-purple-900/30 text-purple-400 border-purple-500/30 text-[9px] px-1.5">
                                   <Users className="w-2.5 h-2.5 mr-1"/> {contact.grupo}
                                </Badge>
                             )}
                             {combinedTags.map((t: string) => {
                                const tagConf = localTags.find(lt => lt.text === t);
                                const style = tagConf ? { backgroundColor: tagConf.color+'20', color: tagConf.color, borderColor: tagConf.color+'50' } : {};
                                return (
                                   <Badge key={t} variant="outline" className="text-[8px] h-3.5 px-1 font-medium max-w-[120px] truncate" style={style}>
                                      {t}
                                   </Badge>
                                );
                             })}
                          </div>
                        </div>
                      </TableCell>
                      {isManager && (
                         <TableCell>
                            <FinancialStatusBadge contactId={contact.id} currentStatus={contact.financial_status || 'Sin transacción'} isManager={isManager} onUpdate={fetchContacts} />
                         </TableCell>
                      )}
                      <TableCell className="text-right pr-6">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="ghost" className="h-8 text-[10px] text-indigo-400 hover:bg-indigo-900/20 font-bold"
                            onClick={() => handleOpenChat(contact)}>
                            <ExternalLink className="w-3 h-3 mr-1.5" /> {contact.lead_id ? 'ABRIR CHAT' : 'INICIAR CHAT'}
                          </Button>
                          {isManager && (
                             <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-slate-600 hover:text-red-500"
                               onClick={() => setContactToDelete(contact)}>
                               <Trash2 className="w-4 h-4" />
                             </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={!!contactToDelete} onOpenChange={() => !isDeleting && setContactToDelete(null)}>
        <AlertDialogContent className="bg-slate-900 border-slate-800 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-400 flex items-center gap-2">
               <Trash2 className="w-5 h-5"/> ¿Eliminar permanentemente?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              Esta acción borrará a <strong className="text-white">"{contactToDelete?.nombre}"</strong>, toda su conversación y su registro en el pipeline. No se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-slate-800 border-slate-700 text-slate-300" disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => handleDeleteContact(contactToDelete)} disabled={isDeleting}>
              {isDeleting ? <Loader2 className="w-4 h-4 animate-spin mr-2"/> : null}
              Confirmar Eliminación
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ImportContactsDialog open={isImportOpen} onOpenChange={setIsImportOpen} onSuccess={fetchContacts} />
      <MassMessageDialog open={isMassMessageOpen} onOpenChange={setIsMassMessageOpen} targetContacts={filteredContacts} />
      {isCreateOpen && <CreateLeadDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} onSuccess={fetchContacts} />}
      {selectedLead && <ChatViewer lead={selectedLead} open={isChatOpen} onOpenChange={setIsChatOpen} />}
    </Layout>
  );
};

export default Contacts;