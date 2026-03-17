import React, { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  Contact, Search, Loader2, MapPin, Phone, Trash2, 
  RefreshCw, Users, FileSpreadsheet, Megaphone, X, ArrowRight, Mail, Edit3, FolderInput,
  UserPlus, ExternalLink
} from 'lucide-react';
import { toast } from 'sonner';
import ChatViewer from '@/components/ChatViewer';
import { CreateLeadDialog } from '@/components/leads/CreateLeadDialog';
import { ImportContactsDialog } from '@/components/contacts/ImportContactsDialog';
import { MassMessageDialog } from '@/components/contacts/MassMessageDialog';
import { FinancialStatusBadge } from '@/components/contacts/FinancialStatusBadge';
import { EditContactDialog } from '@/components/contacts/EditContactDialog';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogHeader, AlertDialogTitle, AlertDialogFooter
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

const Contacts = () => {
  const { user, isManager } = useAuth();
  const [contacts, setContacts] = useState<any[]>([]);
  const [groups, setGroups] = useState<string[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>('ALL');
  
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Selection State
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  // Dialogs
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isMassMessageOpen, setIsMassMessageOpen] = useState(false);
  
  const [contactToEdit, setContactToEdit] = useState<any>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  
  const [isMassGroupOpen, setIsMassGroupOpen] = useState(false);
  const [massGroupName, setMassGroupName] = useState("");
  const [isUpdatingGroup, setIsUpdatingGroup] = useState(false);

  const [contactToDelete, setContactToDelete] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchContacts();
    const channel = supabase.channel('contacts-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contacts' }, () => fetchContacts())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchContacts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('contacts')
      .select('*, leads(id, buying_intent, payment_status, lead_score, ai_paused, summary, telefono, nombre, apellido, email, ciudad, estado, cp, pais, tags)')
      .order('updated_at', { ascending: false });

    if (!error && data) {
      setContacts(data);
      const uniqueGroups = Array.from(new Set(data.map(d => d.grupo).filter(Boolean))) as string[];
      setGroups(uniqueGroups.sort());
    }
    setLoading(false);
    setSelectedIds([]);
  };

  const handleToggleSelectAll = () => {
     if (selectedIds.length === filteredContacts.length) {
        setSelectedIds([]);
     } else {
        setSelectedIds(filteredContacts.map(c => c.id));
     }
  };

  const handleToggleSelect = (id: string) => {
     setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleMassDelete = async () => {
     if (!confirm(`¿ESTÁS SEGURO? Eliminarás ${selectedIds.length} contactos permanentemente.`)) return;
     setIsDeleting(true);
     const tid = toast.loading(`Eliminando ${selectedIds.length} registros...`);
     try {
        const selectedContacts = contacts.filter(c => selectedIds.includes(c.id));
        const leadIds = selectedContacts.map(c => c.lead_id).filter(Boolean);
        if (leadIds.length > 0) {
           await supabase.from('conversaciones').delete().in('lead_id', leadIds);
           await supabase.from('leads').delete().in('id', leadIds);
        }
        await supabase.from('contacts').delete().in('id', selectedIds);
        toast.success("Limpieza masiva completada.", { id: tid });
        fetchContacts();
     } catch (err: any) {
        toast.error("Error: " + err.message, { id: tid });
     } finally {
        setIsDeleting(false);
     }
  };

  const handleMassGroupUpdate = async (e: React.FormEvent) => {
     e.preventDefault();
     if (!massGroupName.trim()) return toast.error("Ingresa un nombre de grupo.");
     setIsUpdatingGroup(true);
     const tid = toast.loading("Actualizando grupo masivamente...");
     try {
        const { error } = await supabase.from('contacts').update({ grupo: massGroupName.trim() }).in('id', selectedIds);
        if (error) throw error;
        toast.success(`${selectedIds.length} contactos movidos al grupo "${massGroupName}".`, { id: tid });
        setIsMassGroupOpen(false);
        setMassGroupName("");
        fetchContacts();
     } catch (err: any) {
        toast.error(err.message, { id: tid });
     } finally {
        setIsUpdatingGroup(false);
     }
  };

  const handleDeleteContact = async (contact: any) => {
    setIsDeleting(true);
    const tid = toast.loading(`Eliminando a ${contact.nombre}...`);
    try {
      if (contact.lead_id) {
         await supabase.from('conversaciones').delete().eq('lead_id', contact.lead_id);
         await supabase.from('leads').delete().eq('id', contact.lead_id);
      }
      await supabase.from('contacts').delete().eq('id', contact.id);
      toast.success("Registro eliminado permanentemente.", { id: tid });
      setContactToDelete(null);
      fetchContacts();
    } catch (err: any) { toast.error(err.message, { id: tid }); } finally { setIsDeleting(false); }
  };

  const handleOpenChat = async (contact: any) => {
    let leadId = contact.lead_id;
    if (!leadId) {
       const tid = toast.loading("Iniciando chat...");
       try {
           const { data: newLead, error } = await supabase.from('leads').insert({
               nombre: contact.nombre || 'Contacto Importado', telefono: contact.telefono, email: contact.email, ciudad: contact.ciudad,
               estado: contact.estado, cp: contact.cp, pais: contact.pais, tags: contact.tags, buying_intent: 'BAJO', ai_paused: true, summary: `Importado de Contactos.`
           }).select().single();
           if (error) throw error;
           await supabase.from('contacts').update({ lead_id: newLead.id }).eq('id', contact.id);
           toast.success("Chat listo.", { id: tid });
           setSelectedLead(newLead);
           setIsChatOpen(true);
           fetchContacts();
           return;
       } catch (err: any) { toast.error(err.message, { id: tid }); return; }
    }
    const { data: lead } = await supabase.from('leads').select('*').eq('id', leadId).maybeSingle();
    if (lead) { setSelectedLead(lead); setIsChatOpen(true); } else { toast.error("Chat no encontrado."); }
  };

  const filteredContacts = contacts.filter(c => {
    const term = searchTerm.toLowerCase();
    const contactTags = Array.isArray(c.tags) ? c.tags : [];
    const matchesSearch = c.nombre?.toLowerCase().includes(term) || c.apellido?.toLowerCase().includes(term) || c.telefono?.includes(term) || c.email?.toLowerCase().includes(term) || c.ciudad?.toLowerCase().includes(term) || (isManager && c.financial_status?.toLowerCase().includes(term)) || contactTags.some((t: string) => t.toLowerCase().includes(term));
    const matchesGroup = selectedGroup === 'ALL' || c.grupo === selectedGroup;
    return matchesSearch && matchesGroup;
  });

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-6 pb-24">
        {/* HEADER IDENTICO A CAPTURA */}
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
               <SelectTrigger className="w-[180px] bg-slate-950 border-slate-800 h-10 rounded-xl text-slate-300 font-bold hover:bg-slate-900">
                  <SelectValue placeholder="Todos los Grupos" />
               </SelectTrigger>
               <SelectContent className="bg-slate-900 border-slate-800 text-white rounded-xl">
                  <SelectItem value="ALL">Todos los Grupos</SelectItem>
                  {groups.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
               </SelectContent>
            </Select>
            <Button onClick={() => setIsMassMessageOpen(true)} variant="outline" className="bg-amber-900/20 border-amber-500/30 text-amber-500 hover:bg-amber-900/40 h-10 rounded-xl">
               <Megaphone className="w-4 h-4 mr-2" /> Difusión ({contacts.length})
            </Button>
            <Button onClick={() => setIsImportOpen(true)} variant="outline" className="h-10 border-slate-800 bg-slate-950 hover:bg-slate-900 text-slate-300 rounded-xl">
               <FileSpreadsheet className="w-4 h-4 mr-2" /> Importar CSV
            </Button>
            <Button onClick={() => setIsCreateOpen(true)} className="bg-[#a88265] hover:bg-[#8b6b52] text-[#2a1c12] h-10 px-6 font-bold rounded-xl shadow-lg">
               <UserPlus className="w-4 h-4 mr-2" /> NUEVO
            </Button>
            <div className="relative w-full md:w-72 ml-2">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
              <Input placeholder="Buscar por tag, ciudad o nombre" className="pl-10 h-10 bg-slate-950 border-slate-800 rounded-xl text-sm" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
          </div>
        </div>

        {/* TABLA IDENTICA A CAPTURA */}
        <Card className="bg-[#0f0f11] border-slate-800/50 shadow-2xl rounded-2xl overflow-hidden min-h-[400px]">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-slate-800/50 bg-[#161618] hover:bg-[#161618]">
                  <TableHead className="w-12 pl-6">
                     <Checkbox checked={selectedIds.length > 0 && selectedIds.length === filteredContacts.length} onCheckedChange={handleToggleSelectAll} className="border-slate-600 data-[state=checked]:bg-indigo-500"/>
                  </TableHead>
                  <TableHead className="text-slate-500 text-[10px] uppercase font-bold tracking-widest py-4">Nombre y Contacto</TableHead>
                  <TableHead className="text-slate-500 text-[10px] uppercase font-bold tracking-widest">Ubicación & Segmentación</TableHead>
                  {isManager && <TableHead className="text-slate-500 text-[10px] uppercase font-bold tracking-widest">Finanzas</TableHead>}
                  <TableHead className="text-slate-500 text-[10px] uppercase font-bold tracking-widest text-right pr-6">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={isManager ? 5 : 4} className="h-60 text-center"><Loader2 className="animate-spin mx-auto text-indigo-500" /></TableCell></TableRow>
                ) : filteredContacts.length === 0 ? (
                  <TableRow><TableCell colSpan={isManager ? 5 : 4} className="h-60 text-center text-slate-600 italic">No hay resultados.</TableCell></TableRow>
                ) : filteredContacts.map((contact) => (
                    <TableRow key={contact.id} className={cn("border-b border-slate-800/30 transition-colors", selectedIds.includes(contact.id) ? "bg-indigo-900/10" : "hover:bg-[#1a1a1d]")}>
                      <TableCell className="pl-6">
                         <Checkbox checked={selectedIds.includes(contact.id)} onCheckedChange={() => handleToggleSelect(contact.id)} className="border-slate-600 data-[state=checked]:bg-indigo-500"/>
                      </TableCell>
                      <TableCell className="py-4">
                        <div className="flex items-center gap-4">
                           <Avatar className="h-10 w-10 border border-slate-800 bg-slate-900">
                             <AvatarFallback className="bg-transparent text-indigo-300 font-bold text-sm">
                               {contact.nombre?.substring(0, 2).toUpperCase() || 'NA'}
                             </AvatarFallback>
                           </Avatar>
                           <div className="flex flex-col">
                              <span className="font-bold text-slate-100 text-sm">{contact.nombre} {contact.apellido}</span>
                              <span className="text-[11px] text-slate-500 font-mono mt-0.5 flex items-center gap-1.5"><Phone className="w-3 h-3"/> {contact.telefono}</span>
                           </div>
                        </div>
                      </TableCell>
                      <TableCell>
                         <div className="flex flex-col gap-1.5">
                            <span className={cn("text-[10px] flex items-center gap-1.5", contact.email ? "text-slate-300" : "text-slate-600 italic")}>
                               <Mail className="w-3 h-3" /> {contact.email || 'Sin email'}
                            </span>
                            <span className={cn("text-[10px] flex items-center gap-1.5", contact.ciudad ? "text-slate-300" : "text-slate-600 italic")}>
                               <MapPin className="w-3 h-3" /> {contact.ciudad || 'Sin ciudad'}
                               {contact.grupo && <span className="ml-2 text-indigo-400 font-bold">• {contact.grupo}</span>}
                            </span>
                         </div>
                      </TableCell>
                      {isManager && (
                         <TableCell>
                            <FinancialStatusBadge contactId={contact.id} currentStatus={contact.financial_status || 'Sin transacción'} isManager={isManager} onUpdate={fetchContacts} />
                         </TableCell>
                      )}
                      <TableCell className="text-right pr-6">
                        <div className="flex justify-end items-center gap-4">
                          <button className="text-indigo-400 hover:text-indigo-300 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 transition-colors" onClick={() => handleOpenChat(contact)}>
                             <ExternalLink className="w-3.5 h-3.5" /> ABRIR CHAT
                          </button>
                          <button className="text-slate-500 hover:text-white transition-colors" onClick={() => { setContactToEdit(contact); setIsEditOpen(true); }} title="Editar Contacto">
                             <Edit3 className="w-4 h-4" />
                          </button>
                          {isManager && (
                            <button className="text-slate-500 hover:text-red-500 transition-colors" onClick={() => setContactToDelete(contact)} title="Eliminar">
                               <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* BARRA DE ACCIONES MASIVAS FLOTANTE */}
        {selectedIds.length > 0 && (
           <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 duration-300">
              <div className="bg-slate-900 border border-indigo-500/30 shadow-[0_20px_50px_rgba(0,0,0,0.5)] rounded-2xl px-6 py-4 flex items-center gap-6 backdrop-blur-xl">
                 <div className="flex items-center gap-3 border-r border-slate-800 pr-6">
                    <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-bold text-white shadow-lg">
                       {selectedIds.length}
                    </div>
                    <span className="text-xs font-bold text-slate-200 uppercase tracking-widest">Seleccionados</span>
                 </div>
                 
                 <div className="flex items-center gap-3">
                    <Button variant="outline" onClick={() => setIsMassMessageOpen(true)} className="bg-amber-900/20 border-amber-500/30 text-amber-500 hover:bg-amber-600 hover:text-slate-900 h-10 px-4 rounded-xl font-bold">
                       <Megaphone className="w-4 h-4 mr-2" /> Difusión Masiva
                    </Button>
                    
                    <Button variant="outline" onClick={() => setIsMassGroupOpen(true)} className="bg-indigo-900/20 border-indigo-500/30 text-indigo-300 hover:bg-indigo-600 hover:text-white h-10 px-4 rounded-xl font-bold">
                       <FolderInput className="w-4 h-4 mr-2" /> Mover de Grupo
                    </Button>
                    
                    {isManager && (
                      <Button variant="destructive" onClick={handleMassDelete} disabled={isDeleting} className="bg-red-950 border-red-900 text-red-500 hover:bg-red-600 hover:text-white h-10 px-4 rounded-xl font-bold">
                         {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />} Borrar
                      </Button>
                    )}
                    
                    <Button variant="ghost" onClick={() => setSelectedIds([])} className="text-slate-500 hover:text-white">
                       <X className="w-4 h-4" />
                    </Button>
                 </div>
              </div>
           </div>
        )}
      </div>

      {/* DIALOGO DE EDICIÓN MASIVA DE GRUPOS */}
      <Dialog open={isMassGroupOpen} onOpenChange={setIsMassGroupOpen}>
         <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-sm rounded-2xl">
            <DialogHeader>
               <DialogTitle className="text-indigo-400 flex items-center gap-2"><FolderInput className="w-5 h-5"/> Asignar Grupo</DialogTitle>
               <DialogDescription>Mueve los {selectedIds.length} contactos seleccionados a un nuevo grupo de campaña.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleMassGroupUpdate} className="space-y-4 pt-4">
               <div className="space-y-2">
                  <Label>Nombre del Grupo</Label>
                  <Input
                      list="existing-groups-mass"
                      value={massGroupName}
                      onChange={e => setMassGroupName(e.target.value)}
                      placeholder="Ej: Oferta Noviembre..."
                      className="bg-slate-950 border-slate-800 h-10"
                      required
                  />
                  <datalist id="existing-groups-mass">
                      {groups.map(g => <option key={g} value={g} />)}
                  </datalist>
               </div>
               <DialogFooter>
                  <Button type="button" variant="ghost" onClick={() => setIsMassGroupOpen(false)}>Cancelar</Button>
                  <Button type="submit" disabled={isUpdatingGroup} className="bg-indigo-600 hover:bg-indigo-700 font-bold px-6">
                     {isUpdatingGroup ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmar Cambio'}
                  </Button>
               </DialogFooter>
            </form>
         </DialogContent>
      </Dialog>

      <AlertDialog open={!!contactToDelete} onOpenChange={() => !isDeleting && setContactToDelete(null)}>
        <AlertDialogContent className="bg-slate-900 border-slate-800 text-white">
          <AlertDialogHeader><AlertDialogTitle className="text-red-400">¿Eliminar permanentemente?</AlertDialogTitle></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-slate-800 text-slate-300" disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600" onClick={() => handleDeleteContact(contactToDelete)} disabled={isDeleting}>Borrar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <EditContactDialog open={isEditOpen} onOpenChange={setIsEditOpen} contact={contactToEdit} existingGroups={groups} onSuccess={fetchContacts} />
      <ImportContactsDialog open={isImportOpen} onOpenChange={setIsImportOpen} onSuccess={fetchContacts} />
      <MassMessageDialog open={isMassMessageOpen} onOpenChange={setIsMassMessageOpen} targetContacts={contacts.filter(c => selectedIds.includes(c.id))} />
      {isCreateOpen && <CreateLeadDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} onSuccess={fetchContacts} />}
      {selectedLead && <ChatViewer lead={selectedLead} open={isChatOpen} onOpenChange={setIsChatOpen} />}
    </Layout>
  );
};
export default Contacts;