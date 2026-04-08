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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { 
  Search, Loader2, MapPin, Phone, Trash2, 
  Users, FileSpreadsheet, X, Mail, Edit3, MessageCircle, Wallet,
  UserPlus, Filter, DollarSign, CheckSquare, Download, GraduationCap, Globe, User as UserIcon, Sparkles, Settings
} from 'lucide-react';
import { toast } from 'sonner';
import Papa from 'papaparse';
import ChatViewer from '@/components/ChatViewer';
import { CreateLeadDialog } from '@/components/leads/CreateLeadDialog';
import { ImportContactsDialog } from '@/components/contacts/ImportContactsDialog';
import { FinancialStatusBadge, financialStatuses } from '@/components/contacts/FinancialStatusBadge';
import { EditContactDialog } from '@/components/contacts/EditContactDialog';
import { ManageGroupsDialog } from '@/components/contacts/ManageGroupsDialog';
import { CreateCreditSaleDialog } from '@/components/contacts/CreateCreditSaleDialog';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { extractTagText, parseTagsSafe } from '@/lib/tag-parser';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogHeader, AlertDialogTitle, AlertDialogFooter, AlertDialogDescription
} from "@/components/ui/alert-dialog";

const Contacts = () => {
  const { user, isManager } = useAuth();
  const [contacts, setContacts] = useState<any[]>([]);
  const [groups, setGroups] = useState<string[]>([]);
  const [cities, setCities] = useState<string[]>([]); 
  const [globalTags, setGlobalTags] = useState<{id: string, text: string, color: string}[]>([]);
  const [localTags, setLocalTags] = useState<{id: string, text: string, color: string}[]>([]);
  
  // FILTROS
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
  const [contactToEdit, setContactToEdit] = useState<any>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isManageGroupsOpen, setIsManageGroupsOpen] = useState(false);

  const [contactForCredit, setContactForCredit] = useState<any>(null);
  const [isCreditOpen, setIsCreditOpen] = useState(false);

  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    if (user) {
        fetchContacts();
        fetchTags();
        fetchGroupsCatalog();
    }
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

  const fetchGroupsCatalog = async () => {
    const { data } = await supabase.from('app_config').select('value').eq('key', 'contact_groups').maybeSingle();
    if (data?.value) {
        try { setGroups(JSON.parse(data.value)); } catch(e){}
    }
  };

  const fetchContacts = async () => {
    setLoading(true);
    
    // FILTRO DE PRIVACIDAD — inner join solo cuando se filtra por agente
    const leadsJoin = isManager
      ? 'leads(id, assigned_to, buying_intent, payment_status, lead_score, ai_paused, summary)'
      : 'leads!inner(id, assigned_to, buying_intent, payment_status, lead_score, ai_paused, summary)';
    let query = supabase
      .from('contacts')
      .select(`*, ${leadsJoin}, credit_sales(status, total_amount)`);

    if (!isManager) {
        query = query.eq('leads.assigned_to', user?.id);
    }

    const { data, error } = await query.order('updated_at', { ascending: false });

    if (!error && data) {
      const mappedData = data.map(c => {
        const activeSales = c.credit_sales?.filter((s: any) => s.status === 'ACTIVE') || [];
        const totalDebt = activeSales.reduce((acc: number, sale: any) => acc + Number(sale.total_amount || 0), 0);
        let academicArray = [];
        try { academicArray = Array.isArray(c.academic_record) ? c.academic_record : JSON.parse(c.academic_record || '[]'); } catch(e){}
        return { ...c, total_debt: totalDebt, active_sales: activeSales, academic_count: academicArray.length };
      });
      setContacts(mappedData);
      setCities(Array.from(new Set(mappedData.map(d => String(d.ciudad || '')).filter(Boolean))) as string[]);
    }
    setLoading(false);
    setSelectedIds([]);
  };

  const handleOpenChat = (contact: any) => {
    const lead = Array.isArray(contact.leads) ? contact.leads[0] : contact.leads;
    if (lead) {
       setSelectedLead(lead);
       setIsChatOpen(true);
    }
  };

  const toggleTagSelection = (tagText: string) => {
      setSelectedTags(prev => prev.includes(tagText) ? prev.filter(t => t !== tagText) : [...prev, tagText]);
  };

  const handleToggleSelectAll = () => setSelectedIds(selectedIds.length === filteredContacts.length ? [] : filteredContacts.map(c => c.id));
  const handleToggleSelect = (id: string) => setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);

  const handleBulkDelete = async () => {
      setIsDeleting(true);
      const tid = toast.loading(`Eliminando ${selectedIds.length} contactos...`);
      try {
          const { data: contactsToDelete } = await supabase
              .from('contacts')
              .select('lead_id')
              .in('id', selectedIds);

          const leadIds = contactsToDelete?.map(c => c.lead_id).filter(Boolean) || [];

          if (leadIds.length > 0) {
              const { error: convErr } = await supabase.from('conversaciones').delete().in('lead_id', leadIds);
              if (convErr) throw new Error(`Error borrando conversaciones: ${convErr.message}`);
              const { error: leadErr } = await supabase.from('leads').delete().in('id', leadIds);
              if (leadErr) throw new Error(`Error borrando leads: ${leadErr.message}`);
          }

          const { error: contactErr } = await supabase.from('contacts').delete().in('id', selectedIds);
          if (contactErr) throw new Error(`Error borrando contactos: ${contactErr.message}`);

          toast.success(`${selectedIds.length} contactos eliminados permanentemente.`, { id: tid });
          setSelectedIds([]);
          setIsBulkDeleteOpen(false);
          fetchContacts();
      } catch (err: any) {
          toast.error("Error al eliminar: " + err.message, { id: tid });
      } finally {
          setIsDeleting(false);
      }
  };

  const handleExportCSV = (dataToExport: any[]) => {
    if (dataToExport.length === 0) return toast.error("No hay datos para exportar.");
    const tid = toast.loading("Generando archivo CSV...");
    try {
      const exportFormat = dataToExport.map(c => {
        const safeTags = Array.isArray(c.tags) ? c.tags.map((t: any) => extractTagText(t)).filter(Boolean).join(', ') : '';
        return {
          Nombre: c.nombre || '',
          Apellido: c.apellido || '',
          Telefono: c.telefono || '',
          Email: c.email || '',
          Ciudad: c.ciudad || '',
          Estado: c.estado || '',
          CP: c.cp || '',
          Etiquetas: safeTags,
          Cursos_Tomados: c.academic_count || 0,
          Estatus_Financiero: c.financial_status || 'Sin transacción',
          Deuda_Total: c.total_debt || 0,
          Intencion_Compra: c.leads?.buying_intent || 'N/A'
        };
      });

      const csv = Papa.unparse(exportFormat);
      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `audiencia_samurai_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Audiencia exportada con éxito.", { id: tid });
    } catch (err: any) {
      toast.error("Error al exportar: " + err.message, { id: tid });
    }
  };

  const filteredContacts = contacts.filter(c => {
    const term = searchTerm.toLowerCase().trim();
    const contactTags = Array.isArray(c.tags) ? c.tags.map((t:any) => extractTagText(t)) : [];
    
    const nombre = String(c.nombre || '').toLowerCase();
    const apellido = String(c.apellido || '').toLowerCase();
    const telefono = String(c.telefono || '').toLowerCase();
    const email = String(c.email || '').toLowerCase();

    const matchesSearch = term === '' || nombre.includes(term) || apellido.includes(term) || telefono.includes(term) || email.includes(term);
    const matchesGroup = selectedGroup === 'ALL' || String(c.grupo || '') === selectedGroup;
    const matchesCity = selectedCity === 'ALL' || String(c.ciudad || '') === selectedCity;
    const matchesStatus = selectedStatusFilter === 'ALL' || String(c.financial_status || 'Sin transacción') === selectedStatusFilter;
    const matchesDebt = debtFilter === 'ALL' || (debtFilter === 'CON_DEUDA' ? (c.total_debt || 0) > 0 : (c.total_debt || 0) === 0);
    
    const matchesTag = selectedTags.length === 0 || selectedTags.every(t => contactTags.includes(t));

    return matchesSearch && matchesGroup && matchesCity && matchesStatus && matchesTag && matchesDebt;
  });

  const allTags = [...globalTags, ...localTags];
  const hasActiveFilters = searchTerm !== '' || selectedGroup !== 'ALL' || selectedCity !== 'ALL' || selectedTags.length > 0 || selectedStatusFilter !== 'ALL' || debtFilter !== 'ALL';

  return (
    <Layout>
      <div className="max-w-[1800px] mx-auto space-y-6 pb-24 animate-in fade-in duration-500">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <div className="p-2 bg-indigo-900/30 rounded-xl border border-indigo-500/20">
                <Users className="w-6 h-6 text-indigo-400" />
              </div>
              Directorio de Contactos {!isManager && <span className="text-slate-500 font-normal text-lg ml-2">| Mi Cartera</span>}
            </h1>
            <p className="text-slate-400 text-sm mt-1">Gestión base del CRM, asignación de grupos y exportación.</p>
          </div>

          <div className="flex gap-2 items-center flex-wrap">
            <Button onClick={() => setIsManageGroupsOpen(true)} variant="outline" className="border-[#333336] bg-[#121214] text-slate-300 hover:text-white h-11 rounded-xl font-bold uppercase tracking-widest text-[10px]">
               <Settings className="w-4 h-4 mr-2" /> Grupos
            </Button>
            <div className="flex bg-[#0a0a0c] border border-[#333336] rounded-xl overflow-hidden h-11">
              <Button onClick={() => setIsImportOpen(true)} variant="ghost" className="h-full rounded-none hover:bg-[#161618] text-slate-300 font-bold uppercase tracking-widest text-[10px] border-r border-[#333336]">
                <FileSpreadsheet className="w-4 h-4 mr-2" /> Importar
              </Button>
              <Button onClick={() => handleExportCSV(filteredContacts)} variant="ghost" className="h-full rounded-none hover:bg-[#161618] text-slate-300 font-bold uppercase tracking-widest text-[10px]">
                <Download className="w-4 h-4 mr-2" /> Exportar CSV
              </Button>
            </div>
            <Button onClick={() => setIsCreateOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white h-11 px-6 font-bold rounded-xl shadow-lg uppercase tracking-widest text-[10px]">
              <UserPlus className="w-4 h-4 mr-2" /> NUEVO
            </Button>
          </div>
        </div>

        {/* BANNER DE ACCIONES MASIVAS (MUCHO MÁS VISIBLE) */}
        {selectedIds.length > 0 && (
          <div className="bg-red-950/20 border border-red-500/30 p-4 rounded-2xl flex flex-col sm:flex-row justify-between items-center gap-4 animate-in slide-in-from-top-2 shadow-lg">
             <div className="flex items-center gap-3 text-red-400">
                <CheckSquare className="w-5 h-5"/> 
                <span className="font-bold">{selectedIds.length} contactos seleccionados</span>
             </div>
             <div className="flex gap-3 w-full sm:w-auto">
                <Button onClick={() => setSelectedIds([])} variant="outline" className="flex-1 sm:flex-none border-red-500/30 text-red-400 hover:bg-red-950/40 h-10 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-colors">
                   Cancelar
                </Button>
                <Button onClick={() => setIsBulkDeleteOpen(true)} variant="destructive" className="flex-1 sm:flex-none bg-red-600 hover:bg-red-500 text-white h-10 px-6 rounded-xl font-bold uppercase tracking-widest text-[10px] shadow-lg transition-all active:scale-95">
                   <Trash2 className="w-4 h-4 mr-2"/> Eliminar Masivamente
                </Button>
             </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 bg-[#0f0f11] p-3 rounded-2xl border border-[#222225] shadow-md">
          <div className="flex items-center gap-2 pl-2 border-r border-[#222225] pr-4">
            <Filter className="w-4 h-4 text-slate-500" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Segmentación</span>
          </div>
          
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
            <Input placeholder="Buscar por nombre, email o tel..." className="pl-10 h-10 bg-[#161618] border-[#222225] rounded-xl text-xs focus-visible:ring-indigo-500/50 text-white" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>

          <Select value={selectedGroup} onValueChange={setSelectedGroup}>
            <SelectTrigger className="w-[150px] h-10 bg-[#161618] border-[#222225] rounded-xl text-xs text-slate-300"><SelectValue placeholder="Grupo" /></SelectTrigger>
            <SelectContent className="bg-slate-900 border-slate-800 text-white rounded-xl max-h-[300px]">
              <SelectItem value="ALL">Cualquier Grupo</SelectItem>
              {groups.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={selectedCity} onValueChange={setSelectedCity}>
            <SelectTrigger className="w-[150px] h-10 bg-[#161618] border-[#222225] rounded-xl text-xs text-slate-300"><SelectValue placeholder="Ciudad" /></SelectTrigger>
            <SelectContent className="bg-slate-900 border-slate-800 text-white rounded-xl max-h-[300px]">
              <SelectItem value="ALL">Cualquier Ciudad</SelectItem>
              {cities.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-[160px] h-10 bg-[#161618] border-[#222225] justify-start text-xs rounded-xl", selectedTags.length > 0 ? "text-indigo-400" : "text-slate-300")}>
                {selectedTags.length > 0 ? `${selectedTags.length} Seleccionadas` : 'Etiquetas...'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[240px] p-0 bg-[#121214] border-[#222225] text-white rounded-xl shadow-2xl">
              <Command className="bg-transparent">
                <CommandInput placeholder="Buscar etiqueta..." className="text-xs h-10" />
                <CommandList className="max-h-[300px] overflow-y-auto custom-scrollbar">
                   <CommandEmpty className="py-6 text-center text-xs text-slate-500">No encontrada.</CommandEmpty>
                   <CommandGroup>
                     {selectedTags.length > 0 && (
                        <CommandItem onSelect={() => setSelectedTags([])} className="text-xs focus:bg-[#161618] focus:text-white cursor-pointer border-b border-[#222225] pb-2 mb-2">
                           <X className="w-3 h-3 mr-2 text-red-400" /> Borrar selección
                        </CommandItem>
                     )}
                     {allTags.map(t => {
                        const isGlobal = globalTags.some(gt => gt.text === t.text);
                        return (
                          <CommandItem key={t.id || t.text} onSelect={() => toggleTagSelection(t.text)} className="text-xs focus:bg-[#161618] focus:text-white cursor-pointer py-2">
                             <div className="flex items-center gap-3">
                               <Checkbox checked={selectedTags.includes(t.text)} className="border-slate-600 rounded" />
                               {isGlobal ? <Globe className="w-3 h-3 opacity-50 shrink-0"/> : <UserIcon className="w-3 h-3 opacity-50 shrink-0"/>}
                               <div className="w-2.5 h-2.5 rounded-full shadow-inner shrink-0" style={{ backgroundColor: t.color }}></div>
                               <span className="truncate">{t.text}</span>
                             </div>
                          </CommandItem>
                        )
                     })}
                   </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          {isManager && (
            <Select value={selectedStatusFilter} onValueChange={setSelectedStatusFilter}>
                <SelectTrigger className="w-[150px] h-10 bg-[#161618] border-[#222225] rounded-xl text-xs text-slate-300"><SelectValue placeholder="Finanzas" /></SelectTrigger>
                <SelectContent className="bg-[#121214] border-[#222225] text-white rounded-xl">
                  <SelectItem value="ALL">Cualquier Estado</SelectItem>
                  {financialStatuses.map(s => <SelectItem key={s.id} value={s.id}>{s.id}</SelectItem>)}
                </SelectContent>
            </Select>
          )}

          {hasActiveFilters && filteredContacts.length > 0 && (
            <Button onClick={handleToggleSelectAll} variant="secondary" className={cn("h-10 px-4 ml-auto rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all", selectedIds.length === filteredContacts.length ? "bg-indigo-600/20 text-indigo-400 border border-indigo-500/30" : "bg-[#161618] text-slate-300 hover:bg-[#222225] border border-[#333336]")}>
              <CheckSquare className="w-3.5 h-3.5 mr-2" />
              {selectedIds.length === filteredContacts.length ? "Deseleccionar Lista" : `Seleccionar Cartera (${filteredContacts.length})`}
            </Button>
          )}
        </div>

        <Card className="bg-[#0f0f11] border-[#222225] shadow-2xl rounded-2xl overflow-hidden min-h-[400px]">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-[#222225] bg-[#161618] hover:bg-[#161618]">
                  <TableHead className="w-12 pl-6"><Checkbox checked={selectedIds.length > 0 && selectedIds.length === filteredContacts.length} onCheckedChange={handleToggleSelectAll} className="border-slate-600 data-[state=checked]:bg-indigo-500"/></TableHead>
                  <TableHead className="text-slate-400 text-[10px] uppercase font-bold tracking-widest py-4">Nombre y Contacto</TableHead>
                  <TableHead className="text-slate-400 text-[10px] uppercase font-bold tracking-widest">Ubicación & Etiquetas</TableHead>
                  {isManager && <TableHead className="text-slate-400 text-[10px] uppercase font-bold tracking-widest w-48">Finanzas & Deuda</TableHead>}
                  <TableHead className="text-slate-400 text-[10px] uppercase font-bold tracking-widest text-right pr-6">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={isManager ? 5 : 4} className="h-60 text-center"><Loader2 className="animate-spin mx-auto text-indigo-500" /></TableCell></TableRow>
                ) : filteredContacts.length === 0 ? (
                  <TableRow><TableCell colSpan={isManager ? 5 : 4} className="h-60 text-center text-slate-600 italic uppercase text-[10px] tracking-widest font-bold">No tienes contactos asignados todavía.</TableCell></TableRow>
                ) : filteredContacts.map((contact) => (
                  <TableRow key={contact.id} className={cn("border-b border-[#161618] transition-colors", selectedIds.includes(contact.id) ? "bg-indigo-900/10" : "hover:bg-[#1a1a1d]")}>
                    <TableCell className="pl-6"><Checkbox checked={selectedIds.includes(contact.id)} onCheckedChange={() => handleToggleSelect(contact.id)} className="border-slate-600 data-[state=checked]:bg-indigo-500"/></TableCell>
                    <TableCell className="py-4">
                      <div className="flex items-center gap-4">
                        <Avatar className="h-10 w-10 border border-[#222225] bg-[#121214]"><AvatarFallback className="bg-transparent text-indigo-300 font-bold text-sm">{String(contact.nombre || 'NA').substring(0, 2).toUpperCase()}</AvatarFallback></Avatar>
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-100 text-sm flex items-center gap-2">
                             {contact.nombre} {contact.apellido}
                             {Number(contact.academic_count || 0) > 0 && (
                                <span className="flex items-center gap-1 bg-indigo-950/40 text-indigo-400 border border-indigo-500/30 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest ml-2">
                                   <GraduationCap className="w-3 h-3" /> Alumno
                                </span>
                             )}
                          </span>
                          <span className="text-[11px] text-slate-500 font-mono mt-0.5 flex items-center gap-1.5"><Phone className="w-3 h-3"/> {contact.telefono}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-2">
                        <span className={cn("text-[10px] flex items-center gap-1.5", contact.email ? "text-slate-300" : "text-slate-600 italic")}><Mail className="w-3 h-3" /> {contact.email || 'Sin email'}</span>
                        <span className={cn("text-[10px] flex items-center gap-1.5", contact.ciudad ? "text-slate-300" : "text-slate-600 italic")}><MapPin className="w-3 h-3" /> {contact.ciudad || 'Sin ciudad'}{contact.grupo && <span className="ml-2 text-amber-500 font-bold">• {contact.grupo}</span>}</span>
                        {Array.isArray(contact.tags) && contact.tags.length > 0 && (
                          <div className="flex gap-1.5 flex-wrap mt-1">
                            {contact.tags.map((rawTag: any, idx: number) => {
                              const t = extractTagText(rawTag);
                              if (!t) return null;
                              const tagConf = allTags.find(lt => lt.text === t);
                              const isGlobal = globalTags.some(gt => gt.text === t);
                              return (
                                <Badge key={`${t}-${idx}`} style={{ backgroundColor: (tagConf?.color || '#475569') + '15', color: tagConf?.color || '#94a3b8', borderColor: (tagConf?.color || '#475569') + '40' }} className="text-[9px] h-5 px-1.5 font-bold uppercase tracking-widest border flex items-center gap-1">
                                  {isGlobal ? <Globe className="w-2.5 h-2.5 opacity-70 shrink-0"/> : <UserIcon className="w-2.5 h-2.5 opacity-70 shrink-0"/>}
                                  <span className="truncate max-w-[120px]">{t}</span>
                                </Badge>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    {isManager && (
                      <TableCell>
                        <div className="flex flex-col gap-2">
                          <FinancialStatusBadge contactId={contact.id} currentStatus={contact.financial_status || 'Sin transacción'} isManager={isManager} onUpdate={fetchContacts} />
                          {Number(contact.total_debt || 0) > 0 && (
                             <span className="text-[11px] font-mono font-bold text-amber-500 flex items-center gap-1"><DollarSign className="w-3 h-3"/> {Number(contact.total_debt).toLocaleString()}</span>
                          )}
                        </div>
                      </TableCell>
                    )}
                    <TableCell className="text-right pr-6">
                      <div className="flex justify-end items-center gap-2">
                        <Button variant="outline" size="sm" className="h-8 bg-[#161618] border-[#333336] text-indigo-400 hover:bg-indigo-600 hover:border-indigo-500 hover:text-white text-[10px] font-bold uppercase tracking-widest px-3" onClick={() => handleOpenChat(contact)}>
                           <MessageCircle className="w-3.5 h-3.5 mr-1.5" /> Chat
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-white bg-[#161618] border border-[#333336] rounded-lg" onClick={() => { setContactToEdit(contact); setIsEditOpen(true); }}>
                           <Edit3 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <ManageGroupsDialog open={isManageGroupsOpen} onOpenChange={setIsManageGroupsOpen} groups={groups} onGroupsChange={(newGroups) => { setGroups(newGroups); fetchContacts(); }} />
      <EditContactDialog open={isEditOpen} onOpenChange={setIsEditOpen} contact={contactToEdit} existingGroups={groups} allTags={allTags} globalTags={globalTags} onSuccess={fetchContacts} />
      {isCreateOpen && <CreateLeadDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} onSuccess={fetchContacts} />}
      {isImportOpen && <ImportContactsDialog open={isImportOpen} onOpenChange={setIsImportOpen} onSuccess={fetchContacts} />}
      {selectedLead && <ChatViewer lead={selectedLead} open={isChatOpen} onOpenChange={setIsChatOpen} />}

      <AlertDialog open={isBulkDeleteOpen} onOpenChange={setIsBulkDeleteOpen}>
        <AlertDialogContent className="bg-[#0f0f11] border-[#222225] text-white rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-400 flex items-center gap-2">
              <Trash2 className="w-5 h-5" /> ¿Eliminar {selectedIds.length} contactos?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400 text-sm mt-2">
              Esta acción eliminará de forma permanente los contactos seleccionados y todo su historial de conversaciones. <strong className="text-red-400">No se puede deshacer.</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4">
            <AlertDialogCancel disabled={isDeleting} className="bg-transparent border-[#222225] text-slate-400 hover:text-white rounded-xl h-11 uppercase font-bold text-[10px] tracking-widest">Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={isDeleting} onClick={handleBulkDelete} className="bg-red-600 hover:bg-red-500 text-white rounded-xl h-11 uppercase font-bold text-[10px] tracking-widest border-none shadow-lg">
               {isDeleting ? <Loader2 className="w-4 h-4 animate-spin mr-2"/> : <Trash2 className="w-4 h-4 mr-2"/>} Sí, Eliminar Todo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </Layout>
  );
};

export default Contacts;