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
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { 
  Search, Loader2, MapPin, Phone, Trash2, 
  Users, FileSpreadsheet, Megaphone, X, Mail, Edit3, FolderInput,
  UserPlus, ExternalLink, Filter, Wallet, DollarSign, CheckSquare, Download, GraduationCap, Tags, Globe, User as UserIcon, Sparkles
} from 'lucide-react';
import { toast } from 'sonner';
import Papa from 'papaparse';
import ChatViewer from '@/components/ChatViewer';
import { CreateLeadDialog } from '@/components/leads/CreateLeadDialog';
import { ImportContactsDialog } from '@/components/contacts/ImportContactsDialog';
import { MassMessageDialog } from '@/components/contacts/MassMessageDialog';
import { FinancialStatusBadge, financialStatuses } from '@/components/contacts/FinancialStatusBadge';
import { EditContactDialog } from '@/components/contacts/EditContactDialog';
import { CreateCreditSaleDialog } from '@/components/contacts/CreateCreditSaleDialog';
import { ManageCreditDialog } from '@/components/payments/ManageCreditDialog';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { extractTagText, parseTagsSafe } from '@/lib/tag-parser';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogHeader, AlertDialogTitle, AlertDialogFooter
} from "@/components/ui/alert-dialog";

const Contacts = () => {
  const { user, isManager } = useAuth();
  const [contacts, setContacts] = useState<any[]>([]);
  const [groups, setGroups] = useState<string[]>([]);
  const [cities, setCities] = useState<string[]>([]); 
  const [globalTags, setGlobalTags] = useState<any[]>([]);
  const [localTags, setLocalTags] = useState<any[]>([]);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string>('ALL');
  const [selectedCity, setSelectedCity] = useState<string>('ALL'); 
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('ALL');
  const [debtFilter, setDebtFilter] = useState<string>('ALL'); 
  const [selectedTags, setSelectedTags] = useState<string[]>([]); 
  
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isMassMessageOpen, setIsMassMessageOpen] = useState(false);
  const [contactToEdit, setContactToEdit] = useState<any>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  
  const [contactForCredit, setContactForCredit] = useState<any>(null);
  const [isCreditOpen, setIsCreditOpen] = useState(false);
  const [selectedActiveSale, setSelectedActiveSale] = useState<any>(null);
  const [isManageCreditOpen, setIsManageCreditOpen] = useState(false);

  const [isMassGroupOpen, setIsMassGroupOpen] = useState(false);
  const [massGroupName, setMassGroupName] = useState("");
  const [isUpdatingGroup, setIsUpdatingGroup] = useState(false);
  const [contactToDelete, setContactToDelete] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    fetchContacts();
    if (user) fetchTags();
  }, [user]);

  const fetchTags = async () => {
    if (!user) return;
    const { data } = await supabase.from('app_config').select('key, value').in('key', [`agent_tags_${user.id}`, 'global_tags']);
    if (data) {
      const local = data.find(d => d.key === `agent_tags_${user.id}`)?.value;
      const global = data.find(d => d.key === 'global_tags')?.value;
      if (local) setLocalTags(parseTagsSafe(local));
      if (global) setGlobalTags(parseTagsSafe(global));
    }
  };

  const fetchContacts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('contacts')
      .select('*, leads(id, buying_intent, payment_status, lead_score, ai_paused, summary), credit_sales(*, installments:credit_installments(*))')
      .order('updated_at', { ascending: false });

    if (!error && data) {
      const mappedData = data.map(c => {
        const activeSales = c.credit_sales?.filter((s: any) => s.status === 'ACTIVE') || [];
        const totalDebt = activeSales.reduce((acc: number, sale: any) => acc + Number(sale.total_amount || 0), 0);
        let academicArray = [];
        try { academicArray = Array.isArray(c.academic_record) ? c.academic_record : JSON.parse(c.academic_record || '[]'); } catch(e){}
        return { ...c, total_debt: totalDebt, active_sales: activeSales, academic_count: academicArray.length };
      });
      setContacts(mappedData);
      setGroups(Array.from(new Set(mappedData.map(d => String(d.grupo || '')).filter(Boolean))));
      setCities(Array.from(new Set(mappedData.map(d => String(d.ciudad || '')).filter(Boolean))));
    }
    setLoading(false);
    setSelectedIds([]);
  };

  const handleRunMassAnalysis = async () => {
    setAnalyzing(true);
    toast.info("Iniciando escaneo de chats...");
    try {
      const { error } = await supabase.functions.invoke('analyze-leads', { body: { force: true } });
      if (error) throw error;
      toast.success("Análisis completado.");
      fetchContacts();
    } catch (err: any) {
      toast.error("Error en el motor de IA");
    } finally {
      setAnalyzing(false);
    }
  };

  const allTags = [...globalTags, ...localTags];

  const toggleTagSelection = (tagText: string) => {
      setSelectedTags(prev => prev.includes(tagText) ? prev.filter(t => t !== tagText) : [...prev, tagText]);
  };

  const filteredContacts = contacts.filter(c => {
    const term = searchTerm.toLowerCase().trim();
    const contactTags = Array.isArray(c.tags) ? c.tags.map((t:any) => extractTagText(t)) : [];
    
    const nombre = String(c.nombre || '').toLowerCase();
    const apellido = String(c.apellido || '').toLowerCase();
    const telefono = String(c.telefono || '').toLowerCase();
    const email = String(c.email || '').toLowerCase();

    const matchesSearch = term === '' || nombre.includes(term) || apellido.includes(term) || telefono.includes(term) || email.includes(term);
    const matchesGroup = selectedGroup === 'ALL' || String(c.grupo) === selectedGroup;
    const matchesCity = selectedCity === 'ALL' || String(c.ciudad) === selectedCity;
    const matchesStatus = selectedStatusFilter === 'ALL' || (c.financial_status || 'Sin transacción') === selectedStatusFilter;
    const matchesDebt = debtFilter === 'ALL' || (debtFilter === 'CON_DEUDA' ? (c.total_debt || 0) > 0 : (c.total_debt || 0) === 0);
    const matchesTag = selectedTags.length === 0 || selectedTags.every(t => contactTags.includes(t));

    return matchesSearch && matchesGroup && matchesCity && matchesStatus && matchesTag && matchesDebt;
  });

  const handleOpenChat = async (contact: any) => {
    if (contact.lead_id) {
      const { data: lead } = await supabase.from('leads').select('*').eq('id', contact.lead_id).maybeSingle();
      if (lead) {
        setSelectedLead(lead);
        setIsChatOpen(true);
        return;
      }
    }
    toast.error("Este contacto no tiene un chat activo.");
  };

  return (
    <Layout>
      <div className="max-w-[1800px] mx-auto space-y-6 pb-24 animate-in fade-in">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <div className="p-2 bg-indigo-900/30 rounded-xl border border-indigo-500/20">
                <Users className="w-6 h-6 text-indigo-400" />
              </div>
              Directorio de Contactos
            </h1>
            <p className="text-slate-400 text-sm mt-1">Gestión avanzada y segmentación de clientes.</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleRunMassAnalysis} disabled={analyzing} variant="outline" className="border-indigo-500/30 text-indigo-400 h-11 px-4 rounded-xl font-bold text-[10px] uppercase tracking-widest">
               {analyzing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />} Forzar Análisis IA
            </Button>
            <Button onClick={() => setIsCreateOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white h-11 px-6 rounded-xl shadow-lg uppercase tracking-widest text-[10px]">
              <UserPlus className="w-4 h-4 mr-2" /> NUEVO
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 bg-[#0f0f11] p-3 rounded-2xl border border-[#222225] shadow-md">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
            <Input placeholder="Buscar por nombre, email o tel..." className="pl-10 h-10 bg-[#161618] border-[#222225] rounded-xl text-xs text-white" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
          <Select value={selectedGroup} onValueChange={setSelectedGroup}>
            <SelectTrigger className="w-[150px] h-10 bg-[#161618] border-[#222225] rounded-xl text-xs text-slate-300"><SelectValue placeholder="Grupo" /></SelectTrigger>
            <SelectContent className="bg-slate-900 border-slate-800 text-white rounded-xl">
              <SelectItem value="ALL">Cualquier Grupo</SelectItem>
              {groups.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <Card className="bg-[#0f0f11] border-[#222225] shadow-2xl rounded-2xl overflow-hidden min-h-[400px]">
          <Table>
            <TableHeader className="bg-[#161618]">
              <TableRow className="border-b border-[#222225]">
                <TableHead className="w-12 pl-6"><Checkbox checked={selectedIds.length > 0 && selectedIds.length === filteredContacts.length} onCheckedChange={() => {}} /></TableHead>
                <TableHead className="text-slate-500 text-[10px] uppercase font-bold tracking-widest py-4">Nombre y Contacto</TableHead>
                <TableHead className="text-slate-500 text-[10px] uppercase font-bold tracking-widest">Ubicación & Etiquetas</TableHead>
                {isManager && <TableHead className="text-slate-500 text-[10px] uppercase font-bold tracking-widest w-48">Finanzas</TableHead>}
                <TableHead className="text-slate-500 text-[10px] uppercase font-bold tracking-widest text-right pr-6">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={isManager ? 5 : 4} className="h-60 text-center"><Loader2 className="animate-spin mx-auto text-indigo-500" /></TableCell></TableRow>
              ) : filteredContacts.length === 0 ? (
                <TableRow><TableCell colSpan={isManager ? 5 : 4} className="h-60 text-center text-slate-600 italic uppercase text-[10px] tracking-widest font-bold">No hay resultados.</TableCell></TableRow>
              ) : filteredContacts.map((contact) => (
                <TableRow key={contact.id} className="border-b border-[#161618] hover:bg-[#1a1a1d]">
                  <TableCell className="pl-6"><Checkbox checked={selectedIds.includes(contact.id)} onCheckedChange={() => {}} /></TableCell>
                  <TableCell className="py-4">
                    <div className="flex items-center gap-4">
                      <Avatar className="h-10 w-10 border border-[#222225] bg-[#121214]"><AvatarFallback className="bg-transparent text-indigo-300 font-bold text-sm">{String(contact.nombre || 'NA').substring(0, 2).toUpperCase()}</AvatarFallback></Avatar>
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-100 text-sm">{contact.nombre} {contact.apellido}</span>
                        <span className="text-[11px] text-slate-500 font-mono mt-0.5">{contact.telefono}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] text-slate-300">{contact.email || 'Sin email'}</span>
                      <span className="text-[10px] text-indigo-400 font-bold">{contact.ciudad || 'Sin ciudad'}</span>
                    </div>
                  </TableCell>
                  {isManager && (
                    <TableCell>
                      <FinancialStatusBadge contactId={contact.id} currentStatus={contact.financial_status || 'Sin transacción'} isManager={isManager} onUpdate={fetchContacts} />
                    </TableCell>
                  )}
                  <TableCell className="text-right pr-6">
                    <div className="flex justify-end items-center gap-3">
                      <button className="text-indigo-400 hover:text-indigo-300 text-[10px] font-bold uppercase tracking-widest" onClick={() => handleOpenChat(contact)}>CHAT</button>
                      <button className="text-slate-500 hover:text-white" onClick={() => { setContactToEdit(contact); setIsEditOpen(true); }}><Edit3 className="w-4 h-4" /></button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>

      {isEditOpen && contactToEdit && <EditContactDialog open={isEditOpen} onOpenChange={setIsEditOpen} contact={contactToEdit} existingGroups={groups} allTags={allTags} globalTags={globalTags} onSuccess={fetchContacts} />}
      {selectedLead && <ChatViewer lead={selectedLead} open={isChatOpen} onOpenChange={setIsChatOpen} />}
      {isCreateOpen && <CreateLeadDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} onSuccess={fetchContacts} />}
    </Layout>
  );
};

export default Contacts;