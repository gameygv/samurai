import React, { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Contact, Search, Loader2, MapPin, Phone, Trash2, 
  RefreshCw, Users, FileSpreadsheet, Megaphone, CheckSquare, 
  Square, X, ArrowRight, FolderInput, AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';
import ChatViewer from '@/components/ChatViewer';
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
  
  // Selection State
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isMassMessageOpen, setIsMassMessageOpen] = useState(false);
  
  const [contactToDelete, setContactToDelete] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchContacts();
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
      setGroups(uniqueGroups);
    }
    setLoading(false);
    setSelectedIds([]);
  };

  const filteredContacts = contacts.filter(c => {
    const term = searchTerm.toLowerCase();
    const l = c.leads || {};
    const contactTags = Array.isArray(c.tags) ? c.tags : [];
    
    const matchesSearch = 
      c.nombre?.toLowerCase().includes(term) ||
      c.apellido?.toLowerCase().includes(term) ||
      c.telefono?.includes(term) ||
      c.email?.toLowerCase().includes(term) ||
      c.ciudad?.toLowerCase().includes(term) ||
      contactTags.some((t: string) => t.toLowerCase().includes(term));
      
    const matchesGroup = selectedGroup === 'ALL' || c.grupo === selectedGroup;
    return matchesSearch && matchesGroup;
  });

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
     if (!confirm(`¿ESTÁS SEGURO? Eliminarás ${selectedIds.length} contactos y sus historiales de chat permanentemente.`)) return;
     
     setIsDeleting(true);
     const tid = toast.loading(`Eliminando ${selectedIds.length} registros...`);
     
     try {
        const selectedContacts = contacts.filter(c => selectedIds.includes(c.id));
        const leadIds = selectedContacts.map(c => c.lead_id).filter(Boolean);

        if (leadIds.length > 0) {
           await supabase.from('conversaciones').delete().in('lead_id', leadIds);
           await supabase.from('leads').delete().in('id', leadIds);
        }
        
        const { error } = await supabase.from('contacts').delete().in('id', selectedIds);
        if (error) throw error;

        toast.success("Limpieza masiva completada.", { id: tid });
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
               buying_intent: 'BAJO',
               ai_paused: true
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

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-6 pb-20">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <div className="p-2 bg-indigo-900/30 rounded-xl border border-indigo-500/20 shadow-glow">
                <Users className="w-6 h-6 text-indigo-400" />
              </div>
              Inteligencia de Contactos
            </h1>
          </div>
          <div className="flex gap-2 items-center flex-wrap">
            <Select value={selectedGroup} onValueChange={setSelectedGroup}>
               <SelectTrigger className="w-[180px] bg-slate-900 border-slate-800 h-10 rounded-xl text-indigo-300 font-bold">
                  <Users className="w-4 h-4 mr-2 opacity-50" /><SelectValue placeholder="Filtrar Grupo" />
               </SelectTrigger>
               <SelectContent className="bg-slate-900 border-slate-800 text-white rounded-xl">
                  <SelectItem value="ALL">Todos los Grupos</SelectItem>
                  {groups.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
               </SelectContent>
            </Select>
            <Button onClick={() => setIsImportOpen(true)} variant="outline" className="h-10 border-slate-800 bg-slate-900/50 hover:bg-slate-800 rounded-xl">
               <FileSpreadsheet className="w-4 h-4 mr-2 text-emerald-500" /> Importar CSV
            </Button>
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-600" />
              <Input placeholder="Buscar contactos..." className="pl-10 h-10 bg-slate-950 border-slate-800 rounded-xl" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
          </div>
        </div>

        <Card className="bg-slate-900 border-slate-800 shadow-2xl rounded-2xl overflow-hidden relative min-h-[400px]">
          <Table>
            <TableHeader>
              <TableRow className="border-slate-800 bg-slate-950/40">
                <TableHead className="w-12 pl-6">
                   <Checkbox 
                     checked={selectedIds.length > 0 && selectedIds.length === filteredContacts.length} 
                     onCheckedChange={handleToggleSelectAll}
                   />
                </TableHead>
                <TableHead className="text-slate-500 text-[10px] uppercase font-bold">Contacto</TableHead>
                <TableHead className="text-slate-500 text-[10px] uppercase font-bold">Ubicación</TableHead>
                <TableHead className="text-slate-500 text-[10px] uppercase font-bold">Grupo / Campaña</TableHead>
                {isManager && <TableHead className="text-slate-500 text-[10px] uppercase font-bold">Finanzas</TableHead>}
                <TableHead className="text-slate-500 text-[10px] uppercase font-bold text-right pr-6">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="h-60 text-center"><Loader2 className="animate-spin mx-auto text-indigo-500" /></TableCell></TableRow>
              ) : filteredContacts.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="h-60 text-center text-slate-600 italic uppercase text-[10px] tracking-widest">No se encontraron registros</TableCell></TableRow>
              ) : filteredContacts.map((contact) => (
                    <TableRow key={contact.id} className={cn("border-slate-800 transition-colors", selectedIds.includes(contact.id) ? "bg-indigo-900/10" : "hover:bg-slate-800/30")}>
                      <TableCell className="pl-6">
                         <Checkbox 
                           checked={selectedIds.includes(contact.id)} 
                           onCheckedChange={() => handleToggleSelect(contact.id)}
                         />
                      </TableCell>
                      <TableCell className="py-4">
                        <div className="flex flex-col">
                           <span className="font-bold text-slate-100">{contact.nombre} {contact.apellido}</span>
                           <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1.5 mt-0.5"><Phone className="w-3 h-3" /> {contact.telefono}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                         <span className="text-[10px] text-slate-400 flex items-center gap-1.5"><MapPin className="w-3 h-3 text-slate-600" /> {contact.ciudad || 'N/A'}</span>
                      </TableCell>
                      <TableCell>
                         <Badge variant="outline" className="text-[9px] border-slate-800 bg-slate-950 text-slate-500 uppercase px-2 h-5">
                            {contact.grupo || 'General'}
                         </Badge>
                      </TableCell>
                      {isManager && (
                         <TableCell>
                            <FinancialStatusBadge contactId={contact.id} currentStatus={contact.financial_status || 'Sin transacción'} isManager={isManager} onUpdate={fetchContacts} />
                         </TableCell>
                      )}
                      <TableCell className="text-right pr-6">
                        <Button size="sm" variant="ghost" className="text-indigo-400 hover:bg-indigo-900/20 font-bold text-[10px] uppercase tracking-widest" onClick={() => handleOpenChat(contact)}>
                           Mensaje <ArrowRight className="w-3 h-3 ml-1.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
            </TableBody>
          </Table>
        </Card>

        {/* BARRA DE ACCIONES MASIVAS (Contextual) */}
        {selectedIds.length > 0 && (
           <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 duration-300">
              <div className="bg-slate-900 border border-indigo-500/50 shadow-[0_20px_50px_rgba(0,0,0,0.5)] rounded-2xl px-6 py-4 flex items-center gap-6 backdrop-blur-xl">
                 <div className="flex items-center gap-3 border-r border-slate-800 pr-6">
                    <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-bold text-white shadow-lg">
                       {selectedIds.length}
                    </div>
                    <span className="text-xs font-bold text-slate-200 uppercase tracking-widest">Seleccionados</span>
                 </div>
                 
                 <div className="flex items-center gap-3">
                    <Button 
                      variant="outline" 
                      onClick={() => setIsMassMessageOpen(true)}
                      className="bg-indigo-900/20 border-indigo-500/30 text-indigo-300 hover:bg-indigo-600 hover:text-white h-10 px-4 rounded-xl"
                    >
                       <Megaphone className="w-4 h-4 mr-2" /> Difusión
                    </Button>
                    
                    <Button 
                      variant="destructive" 
                      onClick={handleMassDelete}
                      disabled={isDeleting}
                      className="bg-red-950 border-red-900 text-red-500 hover:bg-red-600 hover:text-white h-10 px-4 rounded-xl"
                    >
                       {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />} Borrar Selección
                    </Button>
                    
                    <Button 
                      variant="ghost" 
                      onClick={() => setSelectedIds([])}
                      className="text-slate-500 hover:text-white"
                    >
                       <X className="w-4 h-4" />
                    </Button>
                 </div>
              </div>
           </div>
        )}
      </div>

      <ImportContactsDialog open={isImportOpen} onOpenChange={setIsImportOpen} onSuccess={fetchContacts} />
      <MassMessageDialog open={isMassMessageOpen} onOpenChange={setIsMassMessageOpen} targetContacts={contacts.filter(c => selectedIds.includes(c.id))} />
      {selectedLead && <ChatViewer lead={selectedLead} open={isChatOpen} onOpenChange={setIsChatOpen} />}
    </Layout>
  );
};
export default Contacts;