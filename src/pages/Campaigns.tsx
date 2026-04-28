import React, { useEffect, useState, useCallback } from 'react';
import Layout from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Search, Loader2, MapPin, Phone,
  Megaphone, CheckSquare, Mail, CalendarClock, Trash2, RefreshCw, Edit3, Clock, History
} from 'lucide-react';
import { toast } from 'sonner';
import { MassMessageDialog } from '@/components/contacts/MassMessageDialog';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { extractTagText } from '@/lib/tag-parser';
import { GroupCampaignSection } from '@/components/academic/GroupCampaignSection';
import { DirectGroupCampaign } from '@/components/campaigns/DirectGroupCampaign';
import { FilterBuilder, type FilterRule } from '@/components/filters/FilterBuilder';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Academic fields that need special client-side filtering
function matchesRule(contact: any, rule: FilterRule, groupMembership: Map<string, Set<string>>): boolean {
  const { field, op, value } = rule;
  if (!field || !op) return true;
  if (op !== 'is_null' && op !== 'not_null' && !value) return true;

  if (field === 'profesor' || field === 'sede' || field === 'nivel_curso') {
    const records: any[] = Array.isArray(contact.academic_record) ? contact.academic_record : [];
    const recordField = field === 'profesor' ? 'teacher' : field === 'sede' ? 'location' : 'nivel';
    if (op === 'is_null') return records.every((r: any) => !r[recordField]);
    if (op === 'not_null') return records.some((r: any) => !!r[recordField]);
    const lv = String(value).toLowerCase();
    return records.some((r: any) => {
      const v = String(r[recordField] || '').toLowerCase();
      return op === 'eq' ? v === lv : op === 'neq' ? v !== lv : op === 'contains' ? v.includes(lv) : false;
    });
  }

  if (field === 'grupo_whatsapp') {
    const cg = groupMembership.get(contact.id);
    if (op === 'is_null') return !cg || cg.size === 0;
    if (op === 'not_null') return !!cg && cg.size > 0;
    const lv = String(value).toLowerCase();
    if (!cg) return op === 'neq';
    const names = [...cg];
    return op === 'eq' ? names.some(g => g.toLowerCase() === lv) : op === 'neq' ? !names.some(g => g.toLowerCase() === lv) : op === 'contains' ? names.some(g => g.toLowerCase().includes(lv)) : false;
  }

  let fv: any = contact[field] ?? null;
  if (op === 'is_null') return !fv || fv === '';
  if (op === 'not_null') return !!fv && fv !== '';
  const sv = String(fv || '').toLowerCase();
  const lv = String(value).toLowerCase();
  return op === 'eq' ? sv === lv : op === 'neq' ? sv !== lv : op === 'contains' ? sv.includes(lv) : op === 'gt' ? Number(fv) > Number(value) : op === 'lt' ? Number(fv) < Number(value) : true;
}

/** Inner content without Layout wrapper — used by AcademicCatalog */
export const CampaignsContent = () => {
  const { user, isManager } = useAuth();
  const [contacts, setContacts] = useState<any[]>([]);
  const [totalContacts, setTotalContacts] = useState(0);
  const [scheduledCampaigns, setScheduledCampaigns] = useState<any[]>([]);
  const [groupMembership, setGroupMembership] = useState<Map<string, Set<string>>>(new Map());

  const [searchTerm, setSearchTerm] = useState('');
  const [filterRules, setFilterRules] = useState<FilterRule[]>([]);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isMassMessageOpen, setIsMassMessageOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [campaignMode, setCampaignMode] = useState<'individual' | 'groups' | 'courses'>('individual');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);

  // Campaign history/edit
  const [editingCampaignId, setEditingCampaignId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState('');

  useEffect(() => {
    fetchContacts();
    fetchScheduledCampaigns();
    fetchGroupMembership();
  }, [user]);

  useEffect(() => {
    fetchContacts();
  }, [currentPage, pageSize]);

  const fetchContacts = async () => {
    setLoading(true);
    // Query contacts directly — no join to leads (avoids RLS/embed issues)
    // For campaigns, we need: id, nombre, apellido, telefono, email, ciudad, academic_record, tags, lead_id
    const query = supabase
      .from('contacts')
      .select('id, nombre, apellido, telefono, email, ciudad, academic_record, tags, lead_id', { count: 'exact' })
      .order('updated_at', { ascending: false });

    const from = (currentPage - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, error, count } = await query.range(from, to);
    if (!error && data) {
      setContacts(data);
      setTotalContacts(count ?? 0);
    }
    setLoading(false);
  };

  const fetchGroupMembership = async () => {
    const { data } = await supabase.from('contact_whatsapp_groups').select('contact_id, group_name');
    if (data) {
      const map = new Map<string, Set<string>>();
      data.forEach((row: any) => {
        if (!map.has(row.contact_id)) map.set(row.contact_id, new Set());
        if (row.group_name) map.get(row.contact_id)!.add(row.group_name);
      });
      setGroupMembership(map);
    }
  };

  const fetchScheduledCampaigns = async () => {
    const { data } = await supabase.from('app_config').select('value').eq('key', 'scheduled_campaigns').maybeSingle();
    if (data?.value) {
      try {
        const parsed = JSON.parse(data.value);
        if (Array.isArray(parsed)) setScheduledCampaigns(parsed.reverse());
        else setScheduledCampaigns([]);
      } catch { setScheduledCampaigns([]); }
    }
  };

  const handleDeleteCampaign = async (id: string) => {
    if (!confirm("¿Cancelar y eliminar esta campaña?")) return;
    const updated = scheduledCampaigns.filter(c => c.id !== id);
    setScheduledCampaigns(updated);
    await supabase.from('app_config').upsert({ key: 'scheduled_campaigns', value: JSON.stringify([...updated].reverse()), category: 'SYSTEM' }, { onConflict: 'key' });
    toast.success("Campaña eliminada.");
  };

  const handleEditCampaignDate = async (id: string) => {
    if (!editDate) return;
    const updated = scheduledCampaigns.map(c =>
      c.id === id ? { ...c, scheduledAt: new Date(editDate).toISOString() } : c
    );
    setScheduledCampaigns(updated);
    await supabase.from('app_config').upsert({ key: 'scheduled_campaigns', value: JSON.stringify([...updated].reverse()), category: 'SYSTEM' }, { onConflict: 'key' });
    toast.success("Fecha actualizada.");
    setEditingCampaignId(null);
    setEditDate('');
  };

  const handleFilterChange = useCallback((rules: FilterRule[]) => {
    setFilterRules(rules);
    setCurrentPage(1);
  }, []);

  // Client-side filtering
  const filteredContacts = contacts.filter(c => {
    const term = searchTerm.toLowerCase().trim();
    if (term) {
      const n = String(c.nombre || '').toLowerCase();
      const a = String(c.apellido || '').toLowerCase();
      const t = String(c.telefono || '').toLowerCase();
      const e = String(c.email || '').toLowerCase();
      if (!n.includes(term) && !a.includes(term) && !t.includes(term) && !e.includes(term)) return false;
    }
    const validRules = filterRules.filter(r => r.field && r.op && (r.value || r.op === 'is_null' || r.op === 'not_null'));
    for (const rule of validRules) {
      if (!matchesRule(c, rule, groupMembership)) return false;
    }
    return true;
  });

  // Auto-select all when filter is applied
  useEffect(() => {
    const validRules = filterRules.filter(r => r.field && r.op && (r.value || r.op === 'is_null' || r.op === 'not_null'));
    if (validRules.length > 0 && filteredContacts.length > 0) {
      setSelectedIds(filteredContacts.map(c => c.id));
    } else if (validRules.length === 0) {
      setSelectedIds([]);
    }
  }, [filterRules, contacts, groupMembership]);

  const handleToggleSelectAll = () => setSelectedIds(selectedIds.length === filteredContacts.length ? [] : filteredContacts.map(c => c.id));
  const handleToggleSelect = (id: string) => setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);

  const hasActiveFilters = searchTerm !== '' || filterRules.length > 0;

  return (
    <>
      <div className="space-y-8 pb-24 animate-in fade-in duration-500">

        {/* CAMPAÑAS PROGRAMADAS E HISTORIAL — siempre visible */}
        {scheduledCampaigns.length > 0 && (
          <Card className="bg-[#0f0f11] border-[#222225] shadow-2xl rounded-2xl border-l-4 border-l-amber-500">
            <CardHeader className="bg-[#161618] border-b border-[#222225] py-4 flex flex-row items-center justify-between">
              <CardTitle className="text-white text-sm uppercase tracking-widest font-bold flex items-center gap-2">
                <History className="w-4 h-4 text-amber-500"/> Campañas ({scheduledCampaigns.length})
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={fetchScheduledCampaigns} className="h-8 text-slate-400 hover:text-white uppercase text-[10px] font-bold tracking-widest"><RefreshCw className="w-3.5 h-3.5 mr-1.5"/> Refrescar</Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-[#222225] bg-[#121214] hover:bg-[#121214]">
                    <TableHead className="text-slate-500 text-[10px] uppercase font-bold tracking-widest pl-6">Campaña</TableHead>
                    <TableHead className="text-slate-500 text-[10px] uppercase font-bold tracking-widest">Lanzamiento</TableHead>
                    <TableHead className="text-slate-500 text-[10px] uppercase font-bold tracking-widest">Progreso</TableHead>
                    <TableHead className="text-slate-500 text-[10px] uppercase font-bold tracking-widest">Estatus</TableHead>
                    <TableHead className="text-right pr-6 text-slate-500 text-[10px] uppercase font-bold tracking-widest">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {scheduledCampaigns.map(camp => {
                    const total = camp.contacts?.length || 0;
                    const sent = camp.contacts?.filter((c:any) => c.status === 'sent' || c.status === 'error').length || 0;
                    const pct = total > 0 ? Math.round((sent / total) * 100) : 0;
                    const isEditing = editingCampaignId === camp.id;
                    return (
                      <TableRow key={camp.id} className="border-[#222225] hover:bg-[#1a1a1d] transition-colors">
                        <TableCell className="pl-6 font-bold text-white text-sm">{camp.name}</TableCell>
                        <TableCell>
                          {isEditing ? (
                            <div className="flex items-center gap-2">
                              <Input type="datetime-local" value={editDate} onChange={e => setEditDate(e.target.value)} className="h-7 text-xs bg-[#121214] border-[#222225] w-44" />
                              <Button size="sm" onClick={() => handleEditCampaignDate(camp.id)} className="h-7 text-[9px] bg-emerald-600 text-white">OK</Button>
                              <Button size="sm" variant="ghost" onClick={() => setEditingCampaignId(null)} className="h-7 text-[9px] text-slate-400">X</Button>
                            </div>
                          ) : (
                            <button onClick={() => { setEditingCampaignId(camp.id); setEditDate(new Date(camp.scheduledAt).toISOString().slice(0,16)); }} className="text-slate-300 text-xs font-mono hover:text-amber-400 transition-colors flex items-center gap-1">
                              <Edit3 className="w-3 h-3" /> {new Date(camp.scheduledAt).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}
                            </button>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-24 h-1.5 bg-[#222225] rounded-full overflow-hidden">
                              <div className="h-full bg-amber-500 transition-all duration-500" style={{ width: `${pct}%` }}></div>
                            </div>
                            <span className="text-[10px] font-mono text-slate-400">{sent}/{total}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn("text-[9px] uppercase font-bold tracking-widest border h-5 px-2",
                            camp.status === 'completed' ? 'border-emerald-500/30 text-emerald-400 bg-emerald-900/10' :
                            camp.status === 'processing' ? 'border-indigo-500/30 text-indigo-400 bg-indigo-900/10 animate-pulse' :
                            'border-amber-500/30 text-amber-400 bg-amber-900/10'
                          )}>
                            {camp.status === 'completed' ? 'FINALIZADA' : camp.status === 'processing' ? 'PROCESANDO...' : 'PROGRAMADA'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right pr-6">
                          {camp.status !== 'processing' && (
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteCampaign(camp.id)} className="h-8 w-8 text-slate-500 hover:bg-red-900/20 hover:text-red-500 rounded-lg"><Trash2 className="w-4 h-4"/></Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        <Tabs value={campaignMode} onValueChange={(v: any) => setCampaignMode(v)}>
          <TabsList className="bg-[#0a0a0c] border border-[#222225] h-11 p-1 rounded-xl w-full max-w-lg">
            <TabsTrigger value="individual" className="flex-1 rounded-lg text-[10px] font-bold uppercase tracking-widest data-[state=active]:bg-amber-600 data-[state=active]:text-slate-900">
              Difusión Individual
            </TabsTrigger>
            <TabsTrigger value="groups" className="flex-1 rounded-lg text-[10px] font-bold uppercase tracking-widest data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
              Grupos Directos
            </TabsTrigger>
            <TabsTrigger value="courses" className="flex-1 rounded-lg text-[10px] font-bold uppercase tracking-widest data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
              Grupos de Curso
            </TabsTrigger>
          </TabsList>

          <TabsContent value="groups" className="mt-6">
            <DirectGroupCampaign onContinueToCampaign={(members) => {
              // Set members as selected contacts and open Campaign Manager
              setContacts(members);
              setTotalContacts(members.length);
              setSelectedIds(members.map(m => m.id));
              setIsMassMessageOpen(true);
            }} />
          </TabsContent>
          <TabsContent value="courses" className="mt-6"><GroupCampaignSection /></TabsContent>

          <TabsContent value="individual" className="mt-6 space-y-6">

        {/* HEADER con botón de enviar */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <p className="text-slate-400 text-sm">Filtra tu audiencia, selecciona contactos y lanza campañas.</p>
          {selectedIds.length > 0 && (
            <Button onClick={() => setIsMassMessageOpen(true)} className="bg-amber-600 hover:bg-amber-500 text-slate-950 h-11 px-8 rounded-xl shadow-lg shadow-amber-900/20 font-bold uppercase tracking-widest text-[10px] animate-in slide-in-from-right-4">
              <Megaphone className="w-4 h-4 mr-2" /> Crear Campaña ({selectedIds.length} contactos)
            </Button>
          )}
        </div>

        {/* FILTROS */}
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
            <Input placeholder="Buscar por nombre, email o teléfono..." className="pl-10 h-10 bg-[#0f0f11] border-[#222225] rounded-xl text-xs focus-visible:ring-amber-500/50 text-white"
              value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }} />
          </div>
          <FilterBuilder clientSideOnly externalCount={filteredContacts.length} onFilterChange={handleFilterChange} />
        </div>

        {/* SELECCIONAR/DESELECCIONAR */}
        {filteredContacts.length > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-500">{selectedIds.length} de {filteredContacts.length} seleccionados</span>
            <Button onClick={handleToggleSelectAll} variant="secondary" className={cn("h-10 px-4 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all", selectedIds.length === filteredContacts.length ? "bg-amber-600/20 text-amber-500 border border-amber-500/30" : "bg-[#161618] text-slate-300 hover:bg-[#222225] border border-[#333336]")}>
              <CheckSquare className="w-3.5 h-3.5 mr-2" />
              {selectedIds.length === filteredContacts.length ? "Deseleccionar todo" : `Seleccionar todo (${filteredContacts.length})`}
            </Button>
          </div>
        )}

        {/* TABLA DE CONTACTOS */}
        <Card className="bg-[#0f0f11] border-[#222225] shadow-2xl rounded-2xl overflow-hidden min-h-[300px]">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-[#222225] bg-[#161618] hover:bg-[#161618]">
                  <TableHead className="w-12 pl-6"><Checkbox checked={selectedIds.length > 0 && selectedIds.length === filteredContacts.length} onCheckedChange={handleToggleSelectAll} className="border-slate-600 data-[state=checked]:bg-amber-500"/></TableHead>
                  <TableHead className="text-slate-500 text-[10px] uppercase font-bold tracking-widest py-4">Nombre y Contacto</TableHead>
                  <TableHead className="text-slate-500 text-[10px] uppercase font-bold tracking-widest">Ubicación & Grupos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={3} className="h-40 text-center"><Loader2 className="animate-spin mx-auto text-amber-500" /></TableCell></TableRow>
                ) : filteredContacts.length === 0 ? (
                  <TableRow><TableCell colSpan={3} className="h-40 text-center text-slate-600 italic uppercase text-[10px] tracking-widest font-bold">No hay contactos con estos filtros.</TableCell></TableRow>
                ) : filteredContacts.map(contact => {
                  const contactGroupNames = groupMembership.get(contact.id);
                  return (
                    <TableRow key={contact.id} className={cn("border-b border-[#161618] transition-colors", selectedIds.includes(contact.id) ? "bg-amber-900/10" : "hover:bg-[#1a1a1d]")}>
                      <TableCell className="pl-6"><Checkbox checked={selectedIds.includes(contact.id)} onCheckedChange={() => handleToggleSelect(contact.id)} className="border-slate-600 data-[state=checked]:bg-amber-500"/></TableCell>
                      <TableCell className="py-3">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9 border border-[#222225] bg-[#121214]"><AvatarFallback className="bg-transparent text-amber-500 font-bold text-xs">{String(contact.nombre || 'NA').substring(0, 2).toUpperCase()}</AvatarFallback></Avatar>
                          <div>
                            <span className="font-bold text-slate-100 text-sm">{contact.nombre} {contact.apellido}</span>
                            <span className="text-[10px] text-slate-500 font-mono ml-2">{contact.telefono}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {contact.ciudad && <span className="text-[10px] text-slate-400 flex items-center gap-1"><MapPin className="w-3 h-3"/>{contact.ciudad}</span>}
                          {contactGroupNames && contactGroupNames.size > 0 && (
                            <div className="flex gap-1 flex-wrap">
                              {[...contactGroupNames].slice(0, 2).map(gn => (
                                <Badge key={gn} variant="outline" className="text-[8px] border-indigo-500/30 text-indigo-400 h-4 px-1.5">{gn.length > 20 ? gn.slice(0, 20) + '…' : gn}</Badge>
                              ))}
                              {contactGroupNames.size > 2 && <Badge variant="outline" className="text-[8px] border-slate-700 text-slate-500 h-4 px-1.5">+{contactGroupNames.size - 2}</Badge>}
                            </div>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>

          {/* Paginación */}
          <div className="flex items-center justify-between px-6 py-3 border-t border-[#222225]">
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-slate-500">
                {totalContacts > 0 ? `${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, totalContacts)} de ${totalContacts}` : '0'}
              </span>
              <Select value={String(pageSize)} onValueChange={v => { setPageSize(Number(v)); setCurrentPage(1); }}>
                <SelectTrigger className="w-[90px] h-7 bg-[#161618] border-[#222225] rounded-lg text-[10px] text-slate-400">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-slate-100 rounded-xl">
                  <SelectItem value="50">50 / pág</SelectItem>
                  <SelectItem value="100">100 / pág</SelectItem>
                  <SelectItem value="200">200 / pág</SelectItem>
                  <SelectItem value="500">500 / pág</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" disabled={currentPage <= 1} onClick={() => setCurrentPage(p => p - 1)} className="text-[10px] h-7 px-3 text-slate-400 uppercase font-bold tracking-widest">Anterior</Button>
              <span className="text-[10px] text-slate-500 px-2">Pág {currentPage} de {Math.max(1, Math.ceil(totalContacts / pageSize))}</span>
              <Button variant="ghost" size="sm" disabled={currentPage * pageSize >= totalContacts} onClick={() => setCurrentPage(p => p + 1)} className="text-[10px] h-7 px-3 text-slate-400 uppercase font-bold tracking-widest">Siguiente</Button>
            </div>
          </div>
        </Card>

          </TabsContent>
        </Tabs>
      </div>

      <MassMessageDialog open={isMassMessageOpen} onOpenChange={setIsMassMessageOpen} targetContacts={contacts.filter(c => selectedIds.includes(c.id))} onScheduled={fetchScheduledCampaigns} />
    </>
  );
};

const Campaigns = () => {
  React.useEffect(() => { window.location.replace('/academic?tab=campaigns'); }, []);
  return <Layout><div className="flex h-[80vh] items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-amber-500" /></div></Layout>;
};

export default Campaigns;
