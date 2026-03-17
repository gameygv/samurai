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
      toast.error("Error: " + err.message, { id: tid });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleOpenChat = async (contact: any) => {
    let leadId = contact.lead_id;
    if (!leadId) {
       const tid = toast.loading("Iniciando chat...");
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
               summary: `Importado de Contactos.`
           }).select().single();
           if (error) throw error;
           await supabase.from('contacts').update({ lead_id: newLead.id }).eq('id', contact.id);
           toast.success("Chat listo.", { id: tid });
           setSelectedLead(newLead);
           setIsChatOpen(true);
           fetchContacts();
           return;
       } catch (err: any) {
           toast.error(err.message, { id: tid });
           return;
       }
    }
    const { data: lead } = await supabase.from('leads').select('*').eq('id', leadId).maybeSingle();
    if (lead) { setSelectedLead(lead); setIsChatOpen(true); } else { toast.error("Chat no encontrado."); }
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
      (isManager && c.financial_status?.toLowerCase().includes(term)) || // Solo gerentes buscan por finanzas
      contactTags.some((t: string) => t.toLowerCase().includes(term)) ||
      leadTags.some((t: string) => t.toLowerCase().includes(term));
      
    const matchesGroup = selectedGroup === 'ALL' || c.grupo === selectedGroup;
    return matchesSearch && matchesGroup;
  });

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
          </div>
          <div className="flex gap-2 items-center flex-wrap">
            <Select value={selectedGroup} onValueChange={setSelectedGroup}>
               <SelectTrigger className="w-[160px] bg-slate-900 border-slate-800 h-10 rounded-xl text-indigo-300 font-bold">
                  <SelectValue placeholder="Grupos" />
               </SelectTrigger>
               <SelectContent className="bg-slate-900 border-slate-800 text-white rounded-xl">
                  <SelectItem value="ALL">Todos los Grupos</SelectItem>
                  {groups.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
               </SelectContent>
            </Select>
            <Button onClick={() => setIsMassMessageOpen(true)} variant="secondary" className="bg-amber-600/20 text-amber-500 h-10"><Megaphone className="w-4 h-4 mr-2" /> Difusión</Button>
            <Button onClick={() => setIsImportOpen(true)} variant="outline" className="h-10"><FileSpreadsheet className="w-4 h-4 mr-2" /> Importar</Button>
            <Button onClick={() => setIsCreateOpen(true)} className="bg-indigo-600 h-10 px-6 font-bold"><UserPlus className="w-4 h-4 mr-2" /> Nuevo</Button>
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
              <Input placeholder="Buscar..." className="pl-10 h-10" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
          </div>
        </div>

        <Card className="bg-slate-900 border-slate-800 shadow-2xl rounded-2xl overflow-hidden">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-slate-800 bg-slate-900/20">
                  <TableHead className="text-slate-500 text-[10px] uppercase font-bold pl-6">Contacto</TableHead>
                  <TableHead className="text-slate-500 text-[10px] uppercase font-bold">Ubicación</TableHead>
                  {isManager && <TableHead className="text-slate-500 text-[10px] uppercase font-bold">Finanzas</TableHead>}
                  <TableHead className="text-slate-500 text-[10px] uppercase font-bold text-right pr-6">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={isManager ? 4 : 3} className="h-40 text-center"><Loader2 className="animate-spin mx-auto text-indigo-500" /></TableCell></TableRow>
                ) : filteredContacts.map((contact) => (
                    <TableRow key={contact.id} className="border-slate-800 hover:bg-slate-800/40">
                      <TableCell className="pl-6 py-4">
                        <div className="flex flex-col">
                           <span className="font-bold text-slate-100">{contact.nombre} {contact.apellido}</span>
                           <span className="text-[10px] text-slate-500 font-mono"><Phone className="w-2.5 h-2.5 inline mr-1" /> {contact.telefono}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                         <span className="text-[10px] text-slate-300 flex items-center gap-1.5"><MapPin className="w-3 h-3 text-slate-500" /> {contact.ciudad || 'N/A'}</span>
                      </TableCell>
                      {isManager && (
                         <TableCell>
                            <FinancialStatusBadge contactId={contact.id} currentStatus={contact.financial_status || 'Sin transacción'} isManager={isManager} onUpdate={fetchContacts} />
                         </TableCell>
                      )}
                      <TableCell className="text-right pr-6">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="ghost" className="text-indigo-400" onClick={() => handleOpenChat(contact)}>ABRIR CHAT</Button>
                          {isManager && <Button size="sm" variant="ghost" className="text-red-500" onClick={() => setContactToDelete(contact)}><Trash2 className="w-4 h-4" /></Button>}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
      <AlertDialog open={!!contactToDelete} onOpenChange={() => !isDeleting && setContactToDelete(null)}>
        <AlertDialogContent className="bg-slate-900 border-slate-800 text-white">
          <AlertDialogHeader><AlertDialogTitle className="text-red-400">¿Eliminar permanentemente?</AlertDialogTitle></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-slate-800 text-slate-300" disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600" onClick={() => handleDeleteContact(contactToDelete)} disabled={isDeleting}>Borrar</AlertDialogAction>
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