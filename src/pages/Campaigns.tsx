import React, { useEffect, useState, useCallback } from 'react';
import Layout from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Search, Loader2, MapPin, Phone,
  Megaphone, CheckSquare, Globe, User as UserIcon, Mail, CalendarClock, Trash2, RefreshCw
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
const ACADEMIC_FIELDS = new Set(['profesor', 'sede', 'nivel_curso', 'grupo_whatsapp']);

/** Apply a single filter rule to a contact */
function matchesRule(contact: any, rule: FilterRule, groupMembership: Map<string, Set<string>>): boolean {
  const { field, op, value } = rule;
  if (!field || !op) return true;
  if ((op === 'is_null' || op === 'not_null') && !value) {
    // handled below
  } else if (!value && op !== 'is_null' && op !== 'not_null') {
    return true; // incomplete rule, skip
  }

  // Academic record fields — search in JSONB array
  if (field === 'profesor' || field === 'sede' || field === 'nivel_curso') {
    const records: any[] = Array.isArray(contact.academic_record) ? contact.academic_record : [];
    const recordField = field === 'profesor' ? 'teacher' : field === 'sede' ? 'location' : 'nivel';

    if (op === 'is_null') return records.every((r: any) => !r[recordField]);
    if (op === 'not_null') return records.some((r: any) => !!r[recordField]);

    const lowerValue = String(value).toLowerCase();
    const matchFn = (r: any) => {
      const v = String(r[recordField] || '').toLowerCase();
      switch (op) {
        case 'eq': return v === lowerValue;
        case 'neq': return v !== lowerValue;
        case 'contains': return v.includes(lowerValue);
        default: return false;
      }
    };
    return records.some(matchFn);
  }

  // Grupo WhatsApp — check junction table membership
  if (field === 'grupo_whatsapp') {
    const contactGroups = groupMembership.get(contact.id);
    if (op === 'is_null') return !contactGroups || contactGroups.size === 0;
    if (op === 'not_null') return !!contactGroups && contactGroups.size > 0;

    const lowerValue = String(value).toLowerCase();
    if (!contactGroups) return op === 'neq';

    const groupNames = [...contactGroups];
    switch (op) {
      case 'eq': return groupNames.some(g => g.toLowerCase() === lowerValue);
      case 'neq': return !groupNames.some(g => g.toLowerCase() === lowerValue);
      case 'contains': return groupNames.some(g => g.toLowerCase().includes(lowerValue));
      default: return false;
    }
  }

  // Standard contact/lead fields
  let fieldValue: any;
  if (contact.leads && typeof contact.leads === 'object') {
    fieldValue = contact[field] ?? contact.leads[field] ?? null;
  } else {
    fieldValue = contact[field] ?? null;
  }

  if (op === 'is_null') return fieldValue === null || fieldValue === undefined || fieldValue === '';
  if (op === 'not_null') return fieldValue !== null && fieldValue !== undefined && fieldValue !== '';

  const strValue = String(fieldValue || '').toLowerCase();
  const lowerValue = String(value).toLowerCase();

  switch (op) {
    case 'eq': return strValue === lowerValue;
    case 'neq': return strValue !== lowerValue;
    case 'contains': return strValue.includes(lowerValue);
    case 'gt': return Number(fieldValue) > Number(value);
    case 'lt': return Number(fieldValue) < Number(value);
    default: return true;
  }
}

/** Inner content without Layout wrapper — used by AcademicCatalog */
export const CampaignsContent = () => {
  const { user, isManager } = useAuth();
  const [contacts, setContacts] = useState<any[]>([]);
  const [scheduledCampaigns, setScheduledCampaigns] = useState<any[]>([]);
  const [groupMembership, setGroupMembership] = useState<Map<string, Set<string>>>(new Map());

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRules, setFilterRules] = useState<FilterRule[]>([]);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isMassMessageOpen, setIsMassMessageOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [campaignMode, setCampaignMode] = useState<'individual' | 'groups' | 'courses'>('individual');
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 50;

  useEffect(() => {
    fetchContacts();
    fetchScheduledCampaigns();
    fetchGroupMembership();
  }, [user]);

  const fetchContacts = async () => {
    setLoading(true);
    let query = supabase
      .from('contacts')
      .select('*, leads!inner(id, buying_intent, assigned_to, confidence_score, origen, estado_emocional_actual, ai_paused)')
      .order('updated_at', { ascending: false });

    if (!isManager) {
      query = query.eq('leads.assigned_to', user?.id);
    }

    const { data, error } = await query;
    if (!error && data) {
      setContacts(data);
    }
    setLoading(false);
    setSelectedIds([]);
  };

  const fetchGroupMembership = async () => {
    const { data } = await supabase
      .from('contact_whatsapp_groups')
      .select('contact_id, group_name');
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
        if (Array.isArray(parsed)) {
          setScheduledCampaigns(parsed.reverse());
        } else {
          setScheduledCampaigns([]);
        }
      } catch { setScheduledCampaigns([]); }
    }
  };

  const handleDeleteCampaign = async (id: string) => {
    if (!confirm("¿Cancelar y eliminar esta campaña programada?")) return;
    const updated = scheduledCampaigns.filter(c => c.id !== id);
    setScheduledCampaigns(updated);
    await supabase.from('app_config').upsert({ key: 'scheduled_campaigns', value: JSON.stringify(updated.reverse()), category: 'SYSTEM' }, { onConflict: 'key' });
    toast.success("Campaña cancelada.");
  };

  const handleFilterChange = useCallback((rules: FilterRule[]) => {
    setFilterRules(rules);
    setCurrentPage(1);
    setSelectedIds([]);
  }, []);

  // Client-side filtering: search + FilterBuilder rules
  const filteredContacts = contacts.filter(c => {
    // Text search
    const term = searchTerm.toLowerCase().trim();
    if (term) {
      const nombre = String(c.nombre || '').toLowerCase();
      const apellido = String(c.apellido || '').toLowerCase();
      const telefono = String(c.telefono || '').toLowerCase();
      const email = String(c.email || '').toLowerCase();
      if (!nombre.includes(term) && !apellido.includes(term) && !telefono.includes(term) && !email.includes(term)) {
        return false;
      }
    }

    // FilterBuilder rules (AND logic)
    const validRules = filterRules.filter(r => r.field && r.op && (r.value || r.op === 'is_null' || r.op === 'not_null'));
    for (const rule of validRules) {
      if (!matchesRule(c, rule, groupMembership)) return false;
    }

    return true;
  });

  const handleToggleSelectAll = () => setSelectedIds(selectedIds.length === filteredContacts.length ? [] : filteredContacts.map(c => c.id));
  const handleToggleSelect = (id: string) => setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);

  const hasActiveFilters = searchTerm !== '' || filterRules.length > 0;

  return (
    <>
      <div className="space-y-8 pb-24 animate-in fade-in duration-500">
        {/* Campaign mode selector */}
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
            <DirectGroupCampaign />
          </TabsContent>

          <TabsContent value="courses" className="mt-6">
            <GroupCampaignSection />
          </TabsContent>

          <TabsContent value="individual" className="mt-6 space-y-6">

        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div>
            <p className="text-slate-400 text-sm">Filtra tu audiencia y lanza difusiones masivas seguras.</p>
          </div>
          {selectedIds.length > 0 && (
            <Button onClick={() => setIsMassMessageOpen(true)} className="bg-amber-600 hover:bg-amber-500 text-slate-950 h-11 px-8 rounded-xl shadow-lg shadow-amber-900/20 font-bold uppercase tracking-widest text-[10px] animate-in slide-in-from-right-4">
              <Megaphone className="w-4 h-4 mr-2" /> Difusión a {selectedIds.length} Contactos
            </Button>
          )}
        </div>

        {/* CAMPAÑAS PROGRAMADAS */}
        {scheduledCampaigns.length > 0 && (
          <Card className="bg-[#0f0f11] border-[#222225] shadow-2xl rounded-2xl border-l-4 border-l-amber-500">
            <CardHeader className="bg-[#161618] border-b border-[#222225] py-4 flex flex-row items-center justify-between">
              <CardTitle className="text-white text-sm uppercase tracking-widest font-bold flex items-center gap-2">
                <CalendarClock className="w-4 h-4 text-amber-500"/> Cola de Campañas Activas ({scheduledCampaigns.length})
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={fetchScheduledCampaigns} className="h-8 text-slate-400 hover:text-white uppercase text-[10px] font-bold tracking-widest"><RefreshCw className="w-3.5 h-3.5 mr-1.5"/> Refrescar Cola</Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-[#222225] bg-[#121214] hover:bg-[#121214]">
                    <TableHead className="text-slate-500 text-[10px] uppercase font-bold tracking-widest pl-6">Campaña</TableHead>
                    <TableHead className="text-slate-500 text-[10px] uppercase font-bold tracking-widest">Lanzamiento</TableHead>
                    <TableHead className="text-slate-500 text-[10px] uppercase font-bold tracking-widest">Progreso</TableHead>
                    <TableHead className="text-slate-500 text-[10px] uppercase font-bold tracking-widest">Estatus</TableHead>
                    <TableHead className="text-right pr-6"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {scheduledCampaigns.map(camp => {
                    const total = camp.contacts?.length || 0;
                    const sent = camp.contacts?.filter((c:any) => c.status === 'sent' || c.status === 'error').length || 0;
                    const pct = total > 0 ? Math.round((sent / total) * 100) : 0;
                    return (
                      <TableRow key={camp.id} className="border-[#222225] hover:bg-[#1a1a1d] transition-colors">
                        <TableCell className="pl-6 font-bold text-white text-sm">{camp.name}</TableCell>
                        <TableCell className="text-slate-300 text-xs font-mono">{new Date(camp.scheduledAt).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-24 h-1.5 bg-[#222225] rounded-full overflow-hidden">
                              <div className="h-full bg-amber-500 transition-all duration-500" style={{ width: `${pct}%` }}></div>
                            </div>
                            <span className="text-[10px] font-mono text-slate-400">{sent} / {total}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn(
                            "text-[9px] uppercase font-bold tracking-widest border h-5 px-2",
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

        {/* BÚSQUEDA + FILTROS AVANZADOS */}
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
            <Input
              placeholder="Buscar por nombre, email o teléfono..."
              className="pl-10 h-10 bg-[#0f0f11] border-[#222225] rounded-xl text-xs focus-visible:ring-amber-500/50 text-white"
              value={searchTerm}
              onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            />
          </div>

          <FilterBuilder
            clientSideOnly
            externalCount={hasActiveFilters ? filteredContacts.length : null}
            onFilterChange={handleFilterChange}
          />
        </div>

        {/* SELECCIONAR TODOS */}
        {hasActiveFilters && filteredContacts.length > 0 && (
          <div className="flex items-center justify-end">
            <Button onClick={handleToggleSelectAll} variant="secondary" className={cn("h-10 px-4 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all", selectedIds.length === filteredContacts.length ? "bg-amber-600/20 text-amber-500 border border-amber-500/30" : "bg-[#161618] text-slate-300 hover:bg-[#222225] border border-[#333336]")}>
              <CheckSquare className="w-3.5 h-3.5 mr-2" />
              {selectedIds.length === filteredContacts.length ? "Deseleccionar" : `Seleccionar Audiencia (${filteredContacts.length})`}
            </Button>
          </div>
        )}

        {/* TABLA DE CONTACTOS */}
        <Card className="bg-[#0f0f11] border-[#222225] shadow-2xl rounded-2xl overflow-hidden min-h-[400px]">
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
                  <TableRow><TableCell colSpan={3} className="h-60 text-center"><Loader2 className="animate-spin mx-auto text-amber-500" /></TableCell></TableRow>
                ) : filteredContacts.length === 0 ? (
                  <TableRow><TableCell colSpan={3} className="h-60 text-center text-slate-600 italic uppercase text-[10px] tracking-widest font-bold">No hay contactos con estos filtros.</TableCell></TableRow>
                ) : filteredContacts.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE).map((contact) => {
                  const contactGroupNames = groupMembership.get(contact.id);
                  const academicRecords: any[] = Array.isArray(contact.academic_record) ? contact.academic_record : [];
                  const contactTags = Array.isArray(contact.tags) ? contact.tags.map((t:any) => extractTagText(t)).filter(Boolean) : [];

                  return (
                    <TableRow key={contact.id} className={cn("border-b border-[#161618] transition-colors", selectedIds.includes(contact.id) ? "bg-amber-900/10" : "hover:bg-[#1a1a1d]")}>
                      <TableCell className="pl-6"><Checkbox checked={selectedIds.includes(contact.id)} onCheckedChange={() => handleToggleSelect(contact.id)} className="border-slate-600 data-[state=checked]:bg-amber-500"/></TableCell>
                      <TableCell className="py-4">
                        <div className="flex items-center gap-4">
                          <Avatar className="h-10 w-10 border border-[#222225] bg-[#121214]"><AvatarFallback className="bg-transparent text-amber-500 font-bold text-sm">{String(contact.nombre || 'NA').substring(0, 2).toUpperCase()}</AvatarFallback></Avatar>
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-100 text-sm">{contact.nombre} {contact.apellido}</span>
                            <span className="text-[11px] text-slate-500 font-mono mt-0.5 flex items-center gap-1.5"><Phone className="w-3 h-3"/> {contact.telefono}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1.5">
                          <span className={cn("text-[10px] flex items-center gap-1.5", contact.email ? "text-slate-300" : "text-slate-600 italic")}><Mail className="w-3 h-3" /> {contact.email || 'Sin email'}</span>
                          <span className={cn("text-[10px] flex items-center gap-1.5", contact.ciudad ? "text-slate-300" : "text-slate-600 italic")}><MapPin className="w-3 h-3" /> {contact.ciudad || 'Sin ciudad'}</span>
                          {contactGroupNames && contactGroupNames.size > 0 && (
                            <div className="flex gap-1 flex-wrap">
                              {[...contactGroupNames].slice(0, 2).map(gn => (
                                <Badge key={gn} variant="outline" className="text-[8px] border-indigo-500/30 text-indigo-400 h-4 px-1.5">{gn.length > 25 ? gn.slice(0, 25) + '…' : gn}</Badge>
                              ))}
                              {contactGroupNames.size > 2 && <Badge variant="outline" className="text-[8px] border-slate-700 text-slate-500 h-4 px-1.5">+{contactGroupNames.size - 2}</Badge>}
                            </div>
                          )}
                          {contactTags.length > 0 && (
                            <div className="flex gap-1 flex-wrap">
                              {contactTags.slice(0, 3).map((t: string, idx: number) => (
                                <Badge key={`${t}-${idx}`} variant="outline" className="text-[8px] border-amber-500/20 text-amber-400 h-4 px-1.5">{t}</Badge>
                              ))}
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

          {filteredContacts.length > PAGE_SIZE && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-[#222225]">
              <span className="text-[10px] text-slate-500">
                {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filteredContacts.length)} de {filteredContacts.length}
              </span>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" disabled={currentPage <= 1} onClick={() => setCurrentPage(p => p - 1)}
                  className="text-[10px] h-7 px-3 text-slate-400">Anterior</Button>
                <Button variant="ghost" size="sm" disabled={currentPage * PAGE_SIZE >= filteredContacts.length} onClick={() => setCurrentPage(p => p + 1)}
                  className="text-[10px] h-7 px-3 text-slate-400">Siguiente</Button>
              </div>
            </div>
          )}
        </Card>

          </TabsContent>
        </Tabs>
      </div>

      <MassMessageDialog open={isMassMessageOpen} onOpenChange={setIsMassMessageOpen} targetContacts={contacts.filter(c => selectedIds.includes(c.id))} onScheduled={fetchScheduledCampaigns} />
    </>
  );
};

/** Standalone page — redirects to /academic?tab=campaigns */
const Campaigns = () => {
  React.useEffect(() => {
    window.location.replace('/academic?tab=campaigns');
  }, []);
  return (
    <Layout>
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    </Layout>
  );
};

export default Campaigns;
