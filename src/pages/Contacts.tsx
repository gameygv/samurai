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
import { 
  Search, Loader2, MapPin, Phone, Trash2, 
  Users, FileSpreadsheet, Megaphone, X, Mail, Edit3, FolderInput,
  UserPlus, ExternalLink, Filter, Wallet, DollarSign, CheckSquare, Download
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
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { normalizeLeadForChat } from '@/lib/chat-normalizer';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogHeader, AlertDialogTitle, AlertDialogFooter
} from "@/components/ui/alert-dialog";

const Contacts = () => {
  const { user, isManager } = useAuth();
  const [contacts, setContacts] = useState<any[]>([]);
  const [groups, setGroups] = useState<string[]>([]);
  const [cities, setCities] = useState<string[]>([]); 
  const [globalTags, setGlobalTags] = useState<{id: string, text: string, color: string}[]>([]);
  const [localTags, setLocalTags] = useState<{id: string, text: string, color: string}[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string>('ALL');
  const [selectedTagFilter, setSelectedTagFilter] = useState<string>('ALL');
  const [selectedCity, setSelectedCity] = useState<string>('ALL'); 
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('ALL');
  const [debtFilter, setDebtFilter] = useState<string>('ALL'); 
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
  const [isMassGroupOpen, setIsMassGroupOpen] = useState(false);
  const [massGroupName, setMassGroupName] = useState("");
  const [isUpdatingGroup, setIsUpdatingGroup] = useState(false);
  const [contactToDelete, setContactToDelete] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchContacts();
    if (user) fetchTags();
    const channel = supabase.channel('contacts-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contacts' }, () => fetchContacts())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const fetchTags = async () => {
    if (!user) return;
    const { data } = await supabase.from('app_config').select('key, value').in('key', [`agent_tags_${user.id}`, 'global_tags']);
    if (data) {
      const local = data.find(d => d.key === `agent_tags_${user.id}`)?.value;
      const global = data.find(d => d.key === 'global_tags')?.value;
      if (local) { try { const parsed = JSON.parse(local); if (Array.isArray(parsed)) setLocalTags(parsed); } catch {} }
      if (global) { try { const parsed = JSON.parse(global); if (Array.isArray(parsed)) setGlobalTags(parsed); } catch {} }
    }
  };

  const fetchContacts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('contacts')
      .select('*, leads(id, buying_intent, payment_status, lead_score, ai_paused, summary), credit_sales(total_amount, status)')
      .order('updated_at', { ascending: false });

    if (!error && data) {
      const mappedData = data.map(c => {
        const activeSales = c.credit_sales?.filter((s: any) => s.status === 'ACTIVE') || [];
        const totalDebt = activeSales.reduce((acc: number, sale: any) => acc + Number(sale.total_amount), 0);
        return { ...c, total_debt: totalDebt };
      });
      setContacts(mappedData);
      setGroups(Array.from(new Set(mappedData.map(d => d.grupo).filter(Boolean))) as string[]);
      setCities(Array.from(new Set(mappedData.map(d => d.ciudad).filter(Boolean))) as string[]);
    }
    setLoading(false);
    setSelectedIds([]);
  };

  const allTags = [...globalTags, ...localTags];

  const handleToggleSelectAll = () => setSelectedIds(selectedIds.length === filteredContacts.length ? [] : filteredContacts.map(c => c.id));
  const handleToggleSelect = (id: string) => setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);

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
      toast.success(`${selectedIds.length} contactos movidos.`, { id: tid });
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
    } catch (err: any) {
      toast.error(err.message, { id: tid });
    } finally {
      setIsDeleting(false);
    }
  };

  // ✅ FUNCIÓN CORREGIDA: abre el chat directamente sin async/await innecesario
  const handleOpenChat = async (contact: any) => {
    // Si ya tiene lead_id, buscamos el lead y abrimos
    if (contact.lead_id) {
      const { data: lead } = await supabase
        .from('leads')
        .select('*')
        .eq('id', contact.lead_id)
        .maybeSingle();

      if (lead) {
        setSelectedLead(normalizeLeadForChat(lead));
        setIsChatOpen(true);
        return;
      }
    }

    // Si no tiene lead, lo creamos
    const tid = toast.loading("Iniciando chat...");
    try {
      const { data: newLead, error } = await supabase.from('leads').insert({
        nombre: contact.nombre || 'Contacto',
        telefono: contact.telefono,
        email: contact.email || null,
        ciudad: contact.ciudad || null,
        estado: contact.estado || null,
        cp: contact.cp || null,
        pais: contact.pais || 'mx',
        tags: Array.isArray(contact.tags) ? contact.tags : [],
        buying_intent: 'BAJO',
        ai_paused: true,
        summary: 'Importado desde Contactos.',
      }).select().single();

      if (error) throw error;

      await supabase.from('contacts').update({ lead_id: newLead.id }).eq('id', contact.id);

      toast.success("Chat listo.", { id: tid });
      setSelectedLead(normalizeLeadForChat(newLead));
      setIsChatOpen(true);
      fetchContacts();
    } catch (err: any) {
      toast.error(err.message, { id: tid });
    }
  };

  const handleExportCSV = (dataToExport: any[]) => {
    if (dataToExport.length === 0) return toast.error("No hay datos para exportar.");
    const tid = toast.loading("Generando archivo CSV...");
    try {
      const exportFormat = dataToExport.map(c => ({
        Nombre: c.nombre || '',
        Apellido: c.apellido || '',
        Telefono: c.telefono || '',
        Email: c.email || '',
        Ciudad: c.ciudad || '',
        Estado: c.estado || '',
        CP: c.cp || '',
        Grupo: c.grupo || '',
        Etiquetas: Array.isArray(c.tags) ? c.tags.join(', ') : '',
        Estatus_Financiero: c.financial_status || 'Sin transacción',
        Deuda_Total: c.total_debt || 0,
        Intencion_Compra: c.leads?.buying_intent || 'N/A'
      }));

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
    const term = searchTerm.toLowerCase();
    const contactTags = Array.isArray(c.tags) ? c.tags : [];
    const matchesSearch = c.nombre?.toLowerCase().includes(term) || c.apellido?.toLowerCase().includes(term) || c.telefono?.includes(term) || c.email?.toLowerCase().includes(term);
    const matchesGroup = selectedGroup === 'ALL' || c.grupo === selectedGroup;
    const matchesCity = selectedCity === 'ALL' || c.ciudad === selectedCity;
    const matchesStatus = selectedStatusFilter === 'ALL' || (c.financial_status || 'Sin transacción') === selectedStatusFilter;
    const matchesTag = selectedTagFilter === 'ALL' || contactTags.includes(selectedTagFilter);
    const matchesDebt = debtFilter === 'ALL' || (debtFilter === 'CON_DEUDA' ? c.total_debt > 0 : c.total_debt === 0);
    return matchesSearch && matchesGroup && matchesCity && matchesStatus && matchesTag && matchesDebt;
  });

  const hasActiveFilters = searchTerm !== '' || selectedGroup !== 'ALL' || selectedCity !== 'ALL' || selectedTagFilter !== 'ALL' || selectedStatusFilter !== 'ALL' || debtFilter !== 'ALL';

  return (
    <Layout>
      <div className="max-w-[1800px] mx-auto space-y-6 pb-24 animate-in fade-in duration-500">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <div className="p-2 bg-indigo-900/30 rounded-xl border border-indigo-500/20">
                <Users className="w-6 h-6 text-indigo-400" />
              </div>
              Directorio de Contactos
            </h1>
            <p className="text-slate-400 text-sm mt-1">Gestión avanzada, segmentaciones y creación de audiencias para campañas.</p>
          </div>

          <div className="flex gap-2 items-center flex-wrap">
            <Button onClick={() => setIsMassMessageOpen(true)} variant="outline" className="bg-amber-900/20 border-amber-500/30 text-amber-500 hover:bg-amber-900/40 h-11 rounded-xl font-bold uppercase tracking-widest text-[10px]">
              <Megaphone className="w-4 h-4 mr-2" /> Campañas ({filteredContacts.length})
            </Button>
            <div className="flex bg-[#0a0a0c] border border-[#333336] rounded-xl overflow-hidden h-11">
              <Button onClick={() => setIsImportOpen(true)} variant="ghost" className="h-full rounded-none hover:bg-[#161618] text-slate-300 font-bold uppercase tracking-widest text-[10px] border-r border-[#333336]">
                <FileSpreadsheet className="w-4 h-4 mr-2" /> Importar
              </Button>
              <Button onClick={() => handleExportCSV(filteredContacts)} variant="ghost" className="h-full rounded-none hover:bg-[#161618] text-slate-300 font-bold uppercase tracking-widest text-[10px]">
                <Download className="w-4 h-4 mr-2" /> Exportar CSV
              </Button>
            </div>
            <Button onClick={() => setIsCreateOpen(true)} className="bg-indigo-600 hover:bg-indigo-500 text-white h-11 px-6 font-bold rounded-xl shadow-lg uppercase tracking-widest text-[10px]">
              <UserPlus className="w-4 h-4 mr-2" /> NUEVO
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 bg-[#0f0f11] p-3 rounded-2xl border border-slate-800/50 shadow-md">
          <div className="flex items-center gap-2 pl-2 border-r border-slate-800/50 pr-4">
            <Filter className="w-4 h-4 text-slate-500" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Segmentación</span>
          </div>

          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
            <Input placeholder="Buscar por nombre, email o tel..." className="pl-10 h-10 bg-[#161618] border-[#222225] rounded-xl text-xs focus-visible:ring-indigo-500/50 text-white" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>

          <Select value={selectedGroup} onValueChange={setSelectedGroup}>
            <SelectTrigger className="w-[150px] h-10 bg-[#161618] border-[#222225] rounded-xl text-xs text-slate-300">
              <SelectValue placeholder="Grupo" />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-slate-800 text-white rounded-xl max-h-[300px]">
              <SelectItem value="ALL">Cualquier Grupo</SelectItem>
              {groups.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={selectedCity} onValueChange={setSelectedCity}>
            <SelectTrigger className="w-[150px] h-10 bg-[#161618] border-[#222225] rounded-xl text-xs text-slate-300">
              <SelectValue placeholder="Ciudad" />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-slate-800 text-white rounded-xl max-h-[300px]">
              <SelectItem value="ALL">Cualquier Ciudad</SelectItem>
              {cities.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={selectedTagFilter} onValueChange={setSelectedTagFilter}>
            <SelectTrigger className="w-[150px] h-10 bg-[#161618] border-[#222225] rounded-xl text-xs text-slate-300">
              <SelectValue placeholder="Etiqueta" />
            </SelectTrigger>
            <SelectContent className="bg-[#121214] border-[#222225] text-white rounded-xl max-h-[300px]">
              <SelectItem value="ALL">Todas las Etiquetas</SelectItem>
              {allTags.map(t => (
                <SelectItem key={t.id || t.text} value={t.text} className="focus:bg-[#161618]">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: t.color }}></div>
                    {t.text}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {isManager && (
            <>
              <Select value={selectedStatusFilter} onValueChange={setSelectedStatusFilter}>
                <SelectTrigger className="w-[150px] h-10 bg-[#161618] border-[#222225] rounded-xl text-xs text-slate-300">
                  <SelectValue placeholder="Finanzas" />
                </SelectTrigger>
                <SelectContent className="bg-[#121214] border-[#222225] text-white rounded-xl">
                  <SelectItem value="ALL">Cualquier Estado</SelectItem>
                  {financialStatuses.map(s => <SelectItem key={s.id} value={s.id}>{s.id}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={debtFilter} onValueChange={setDebtFilter}>
                <SelectTrigger className="w-[140px] h-10 bg-[#161618] border-[#222225] rounded-xl text-xs text-slate-300">
                  <SelectValue placeholder="Deuda" />
                </SelectTrigger>
                <SelectContent className="bg-[#121214] border-[#222225] text-white rounded-xl">
                  <SelectItem value="ALL">Cualquier Saldo</SelectItem>
                  <SelectItem value="CON_DEUDA">Con Deuda Activa</SelectItem>
                  <SelectItem value="SIN_DEUDA">Sin Deuda</SelectItem>
                </SelectContent>
              </Select>
            </>
          )}

          {hasActiveFilters && filteredContacts.length > 0 && (
            <Button onClick={handleToggleSelectAll} variant="secondary" className={cn("h-10 px-4 ml-auto rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all", selectedIds.length === filteredContacts.length ? "bg-indigo-600/20 text-indigo-400 border border-indigo-500/30" : "bg-[#161618] text-slate-300 hover:bg-[#222225] border border-[#333336]")}>
              <CheckSquare className="w-3.5 h-3.5 mr-2" />
              {selectedIds.length === filteredContacts.length ? "Deseleccionar" : `Seleccionar Segmento (${filteredContacts.length})`}
            </Button>
          )}
        </div>

        <Card className="bg-[#0f0f11] border-[#222225] shadow-2xl rounded-2xl overflow-hidden min-h-[400px]">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-[#222225] bg-[#161618] hover:bg-[#161618]">
                  <TableHead className="w-12 pl-6">
                    <Checkbox checked={selectedIds.length > 0 && selectedIds.length === filteredContacts.length} onCheckedChange={handleToggleSelectAll} className="border-slate-600 data-[state=checked]:bg-indigo-500"/>
                  </TableHead>
                  <TableHead className="text-slate-500 text-[10px] uppercase font-bold tracking-widest py-4">Nombre y Contacto</TableHead>
                  <TableHead className="text-slate-500 text-[10px] uppercase font-bold tracking-widest">Ubicación & Etiquetas</TableHead>
                  {isManager && <TableHead className="text-slate-500 text-[10px] uppercase font-bold tracking-widest w-48">Finanzas & Deuda</TableHead>}
                  <TableHead className="text-slate-500 text-[10px] uppercase font-bold tracking-widest text-right pr-6">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={isManager ? 5 : 4} className="h-60 text-center"><Loader2 className="animate-spin mx-auto text-indigo-500" /></TableCell></TableRow>
                ) : filteredContacts.length === 0 ? (
                  <TableRow><TableCell colSpan={isManager ? 5 : 4} className="h-60 text-center text-slate-600 italic uppercase text-[10px] tracking-widest font-bold">No hay resultados con estos filtros.</TableCell></TableRow>
                ) : filteredContacts.map((contact) => (
                  <TableRow key={contact.id} className={cn("border-b border-[#161618] transition-colors", selectedIds.includes(contact.id) ? "bg-indigo-900/10" : "hover:bg-[#1a1a1d]")}>
                    <TableCell className="pl-6">
                      <Checkbox checked={selectedIds.includes(contact.id)} onCheckedChange={() => handleToggleSelect(contact.id)} className="border-slate-600 data-[state=checked]:bg-indigo-500"/>
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="flex items-center gap-4">
                        <Avatar className="h-10 w-10 border border-[#222225] bg-[#121214]">
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
                      <div className="flex flex-col gap-2">
                        <span className={cn("text-[10px] flex items-center gap-1.5", contact.email ? "text-slate-300" : "text-slate-600 italic")}>
                          <Mail className="w-3 h-3" /> {contact.email || 'Sin email'}
                        </span>
                        <span className={cn("text-[10px] flex items-center gap-1.5", contact.ciudad ? "text-slate-300" : "text-slate-600 italic")}>
                          <MapPin className="w-3 h-3" /> {contact.ciudad || 'Sin ciudad'}
                          {contact.grupo && <span className="ml-2 text-indigo-400 font-bold">• {contact.grupo}</span>}
                        </span>
                        {Array.isArray(contact.tags) && contact.tags.length > 0 && (
                          <div className="flex gap-1.5 flex-wrap mt-1">
                            {contact.tags.map((t: string) => {
                              const tagConf = allTags.find(lt => lt.text === t);
                              const bgColor = tagConf ? tagConf.color + '15' : '#1e293b';
                              const textColor = tagConf ? tagConf.color : '#94a3b8';
                              const borderColor = tagConf ? tagConf.color + '40' : '#334155';
                              return (
                                <Badge key={t} style={{ backgroundColor: bgColor, color: textColor, borderColor }} className="text-[9px] h-5 px-2 font-bold uppercase tracking-widest border">
                                  {t}
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
                          {contact.total_debt > 0 && (
                            <span className="text-[11px] font-mono font-bold text-amber-500 flex items-center gap-1">
                              <DollarSign className="w-3 h-3"/> {contact.total_debt.toLocaleString()}
                            </span>
                          )}
                        </div>
                      </TableCell>
                    )}
                    <TableCell className="text-right pr-6">
                      <div className="flex justify-end items-center gap-3">
                        {isManager && (
                          <button className="text-amber-500 hover:text-amber-400 text-[9px] font-bold uppercase tracking-widest flex items-center gap-1.5 transition-colors border border-amber-500/30 bg-amber-500/10 px-3 py-2 rounded-xl" onClick={() => { setContactForCredit(contact); setIsCreditOpen(true); }}>
                            <Wallet className="w-3.5 h-3.5" /> CRÉDITO
                          </button>
                        )}
                        <button
                          className="text-indigo-400 hover:text-indigo-300 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 transition-colors"
                          onClick={() => handleOpenChat(contact)}
                        >
                          <ExternalLink className="w-3.5 h-3.5" /> CHAT
                        </button>
                        <button className="text-slate-500 hover:text-white transition-colors bg-[#161618] p-2 rounded-xl border border-[#222225]" onClick={() => { setContactToEdit(contact); setIsEditOpen(true); }} title="Editar Contacto">
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        {isManager && (
                          <button className="text-slate-500 hover:text-red-500 transition-colors bg-[#161618] p-2 rounded-xl border border-[#222225]" onClick={() => setContactToDelete(contact)} title="Eliminar">
                            <X className="w-3.5 h-3.5" />
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

        {selectedIds.length > 0 && (
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 duration-300">
            <div className="bg-[#0f0f11] border border-indigo-500/30 shadow-[0_20px_50px_rgba(0,0,0,0.8)] rounded-2xl px-6 py-4 flex items-center gap-6 backdrop-blur-xl">
              <div className="flex items-center gap-3 border-r border-[#222225] pr-6">
                <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-bold text-white shadow-lg">
                  {selectedIds.length}
                </div>
                <span className="text-[10px] font-bold text-slate-200 uppercase tracking-widest">Seleccionados</span>
              </div>

              <div className="flex items-center gap-3">
                <Button variant="outline" onClick={() => handleExportCSV(contacts.filter(c => selectedIds.includes(c.id)))} className="bg-emerald-900/20 border-emerald-500/30 text-emerald-500 hover:bg-emerald-600 hover:text-slate-900 h-10 px-4 rounded-xl font-bold uppercase tracking-widest text-[10px]">
                  <Download className="w-4 h-4 mr-2" /> Exportar
                </Button>

                <Button variant="outline" onClick={() => setIsMassMessageOpen(true)} className="bg-amber-900/20 border-amber-500/30 text-amber-500 hover:bg-amber-600 hover:text-slate-900 h-10 px-4 rounded-xl font-bold uppercase tracking-widest text-[10px]">
                  <Megaphone className="w-4 h-4 mr-2" /> Lanzar Campaña
                </Button>

                <Button variant="outline" onClick={() => setIsMassGroupOpen(true)} className="bg-[#161618] border-[#222225] text-slate-300 hover:bg-indigo-600 hover:text-white h-10 px-4 rounded-xl font-bold uppercase tracking-widest text-[10px]">
                  <FolderInput className="w-4 h-4 mr-2" /> Mover Grupo
                </Button>

                {isManager && (
                  <Button variant="destructive" onClick={handleMassDelete} disabled={isDeleting} className="bg-red-950 border-red-900 text-red-500 hover:bg-red-600 hover:text-white h-10 px-4 rounded-xl font-bold uppercase tracking-widest text-[10px]">
                    {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4 mr-2" />} Borrar
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

      <Dialog open={isMassGroupOpen} onOpenChange={setIsMassGroupOpen}>
        <DialogContent className="bg-[#0f0f11] border-[#222225] text-white max-w-sm rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-indigo-400 flex items-center gap-2"><FolderInput className="w-5 h-5"/> Asignar Grupo</DialogTitle>
            <DialogDescription className="text-slate-400 text-xs">Mueve los {selectedIds.length} contactos a un nuevo grupo.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleMassGroupUpdate} className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Nombre del Grupo</Label>
              <Input list="existing-groups-mass" value={massGroupName} onChange={e => setMassGroupName(e.target.value)} placeholder="Ej: Oferta Noviembre..." className="bg-[#161618] border-[#222225] h-11 rounded-xl text-white focus-visible:ring-indigo-500" required />
              <datalist id="existing-groups-mass">{groups.map(g => <option key={g} value={g} />)}</datalist>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setIsMassGroupOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={isUpdatingGroup} className="bg-indigo-600 hover:bg-indigo-500 font-bold px-6 rounded-xl uppercase tracking-widest text-[10px]">
                {isUpdatingGroup ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : 'Confirmar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!contactToDelete} onOpenChange={() => !isDeleting && setContactToDelete(null)}>
        <AlertDialogContent className="bg-[#0f0f11] border-[#222225] text-white rounded-3xl">
          <AlertDialogHeader><AlertDialogTitle className="text-red-400">¿Eliminar permanentemente?</AlertDialogTitle></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent border-[#222225] text-slate-400 hover:text-white rounded-xl h-11" disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-500 rounded-xl h-11 font-bold" onClick={() => handleDeleteContact(contactToDelete)} disabled={isDeleting}>Borrar Definitivo</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <EditContactDialog open={isEditOpen} onOpenChange={setIsEditOpen} contact={contactToEdit} existingGroups={groups} allTags={allTags} onSuccess={fetchContacts} />
      <ImportContactsDialog open={isImportOpen} onOpenChange={setIsImportOpen} onSuccess={fetchContacts} />
      <MassMessageDialog open={isMassMessageOpen} onOpenChange={setIsMassMessageOpen} targetContacts={contacts.filter(c => selectedIds.includes(c.id))} />
      {isCreateOpen && <CreateLeadDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} onSuccess={fetchContacts} />}
      {isCreditOpen && <CreateCreditSaleDialog open={isCreditOpen} onOpenChange={setIsCreditOpen} contact={contactForCredit} onSuccess={() => { toast.info('Actualizando saldos...'); fetchContacts(); }} />}
      {selectedLead && <ChatViewer lead={selectedLead} open={isChatOpen} onOpenChange={setIsChatOpen} />}
    </Layout>
  );
};

export default Contacts;