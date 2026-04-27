import React, { useEffect, useState } from 'react';
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { 
  Search, Loader2, MapPin, Phone, 
  Filter, Megaphone, X, CheckSquare, Globe, User as UserIcon, Mail, CalendarClock, Trash2, RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import { MassMessageDialog } from '@/components/contacts/MassMessageDialog';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { extractTagText, parseTagsSafe } from '@/lib/tag-parser';
import { GroupCampaignSection } from '@/components/academic/GroupCampaignSection';
import { FilterBuilder } from '@/components/filters/FilterBuilder';

/** Inner content without Layout wrapper — used by AcademicCatalog */
export const CampaignsContent = () => {
  const { user, isManager } = useAuth();
  const [contacts, setContacts] = useState<any[]>([]);
  const [groups, setGroups] = useState<string[]>([]);
  const [cities, setCities] = useState<string[]>([]); 
  const [globalTags, setGlobalTags] = useState<{id: string, text: string, color: string}[]>([]);
  const [localTags, setLocalTags] = useState<{id: string, text: string, color: string}[]>([]);
  
  const [scheduledCampaigns, setScheduledCampaigns] = useState<any[]>([]);

  // FILTROS
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string>('ALL');
  const [selectedCity, setSelectedCity] = useState<string>('ALL');
  const [selectedGender, setSelectedGender] = useState<string>('ALL');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isMassMessageOpen, setIsMassMessageOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchContacts();
    fetchScheduledCampaigns();
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
    let query = supabase
      .from('contacts')
      .select('*, leads!inner(id, buying_intent, assigned_to)')
      .order('updated_at', { ascending: false });

    // FILTRO DE PRIVACIDAD
    if (!isManager) {
      query = query.eq('leads.assigned_to', user?.id);
    }

    const { data, error } = await query;

    if (!error && data) {
      setContacts(data);
      setGroups(Array.from(new Set(data.map(d => String(d.grupo || '')).filter(Boolean))));
      setCities(Array.from(new Set(data.map(d => String(d.ciudad || '')).filter(Boolean))));
    }
    setLoading(false);
    setSelectedIds([]);
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
        } catch(e) { setScheduledCampaigns([]); }
    }
  };

  const handleDeleteCampaign = async (id: string) => {
      if (!confirm("¿Cancelar y eliminar esta campaña programada?")) return;
      const updated = scheduledCampaigns.filter(c => c.id !== id);
      setScheduledCampaigns(updated);
      await supabase.from('app_config').upsert({ key: 'scheduled_campaigns', value: JSON.stringify(updated.reverse()), category: 'SYSTEM' }, { onConflict: 'key' });
      toast.success("Campaña cancelada.");
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
    const matchesGender = selectedGender === 'ALL' || String(c.genero || '') === selectedGender;
    const matchesTag = selectedTags.length === 0 || selectedTags.every(t => contactTags.includes(t));

    return matchesSearch && matchesGroup && matchesCity && matchesGender && matchesTag;
  });

  const handleToggleSelectAll = () => setSelectedIds(selectedIds.length === filteredContacts.length ? [] : filteredContacts.map(c => c.id));
  const handleToggleSelect = (id: string) => setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);

  const hasActiveFilters = searchTerm !== '' || selectedGroup !== 'ALL' || selectedCity !== 'ALL' || selectedGender !== 'ALL' || selectedTags.length > 0;

  return (
    <>
      <div className="space-y-8 pb-24 animate-in fade-in duration-500">
        {/* Group Campaign Section */}
        <GroupCampaignSection />

        {/* Divider */}
        <div className="flex items-center gap-4">
          <div className="flex-1 h-px bg-[#222225]" />
          <span className="text-[10px] uppercase tracking-widest font-bold text-slate-600">Difusión Masiva Individual</span>
          <div className="flex-1 h-px bg-[#222225]" />
        </div>

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

        {/* SECCIÓN: CAMPAÑAS PROGRAMADAS */}
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
                        )})}
                     </TableBody>
                  </Table>
               </CardContent>
            </Card>
        )}

        <div className="flex flex-wrap items-center gap-3 bg-[#0f0f11] p-3 rounded-2xl border border-[#222225] shadow-md">
          <div className="flex items-center gap-2 pl-2 border-r border-[#222225] pr-4">
            <Filter className="w-4 h-4 text-slate-500" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Público Objetivo</span>
          </div>
          
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
            <Input placeholder="Buscar por nombre, email o tel..." className="pl-10 h-10 bg-[#161618] border-[#222225] rounded-xl text-xs focus-visible:ring-amber-500/50 text-white" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
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

          <Select value={selectedGender} onValueChange={setSelectedGender}>
            <SelectTrigger className="w-[130px] h-10 bg-[#161618] border-[#222225] rounded-xl text-xs text-slate-300"><SelectValue placeholder="Género" /></SelectTrigger>
            <SelectContent className="bg-slate-900 border-slate-800 text-white rounded-xl">
              <SelectItem value="ALL">Cualquier Género</SelectItem>
              <SelectItem value="Hombre">Hombre</SelectItem>
              <SelectItem value="Mujer">Mujer</SelectItem>
              <SelectItem value="Otro">Otro</SelectItem>
            </SelectContent>
          </Select>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-[160px] h-10 bg-[#161618] border-[#222225] justify-start text-xs rounded-xl", selectedTags.length > 0 ? "text-amber-500" : "text-slate-300")}>
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

          {hasActiveFilters && filteredContacts.length > 0 && (
            <Button onClick={handleToggleSelectAll} variant="secondary" className={cn("h-10 px-4 ml-auto rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all", selectedIds.length === filteredContacts.length ? "bg-amber-600/20 text-amber-500 border border-amber-500/30" : "bg-[#161618] text-slate-300 hover:bg-[#222225] border border-[#333336]")}>
              <CheckSquare className="w-3.5 h-3.5 mr-2" />
              {selectedIds.length === filteredContacts.length ? "Deseleccionar" : `Seleccionar Audiencia (${filteredContacts.length})`}
            </Button>
          )}
        </div>

        <FilterBuilder />

        <Card className="bg-[#0f0f11] border-[#222225] shadow-2xl rounded-2xl overflow-hidden min-h-[400px]">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-[#222225] bg-[#161618] hover:bg-[#161618]">
                  <TableHead className="w-12 pl-6"><Checkbox checked={selectedIds.length > 0 && selectedIds.length === filteredContacts.length} onCheckedChange={handleToggleSelectAll} className="border-slate-600 data-[state=checked]:bg-amber-500"/></TableHead>
                  <TableHead className="text-slate-500 text-[10px] uppercase font-bold tracking-widest py-4">Nombre y Contacto</TableHead>
                  <TableHead className="text-slate-500 text-[10px] uppercase font-bold tracking-widest">Ubicación & Etiquetas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={3} className="h-60 text-center"><Loader2 className="animate-spin mx-auto text-amber-500" /></TableCell></TableRow>
                ) : filteredContacts.length === 0 ? (
                  <TableRow><TableCell colSpan={3} className="h-60 text-center text-slate-600 italic uppercase text-[10px] tracking-widest font-bold">No hay contactos con estos filtros.</TableCell></TableRow>
                ) : filteredContacts.map((contact) => (
                  <TableRow key={contact.id} className={cn("border-b border-[#161618] transition-colors", selectedIds.includes(contact.id) ? "bg-amber-900/10" : "hover:bg-[#1a1a1d]")}>
                    <TableCell className="pl-6"><Checkbox checked={selectedIds.includes(contact.id)} onCheckedChange={() => handleToggleSelect(contact.id)} className="border-slate-600 data-[state=checked]:bg-amber-500"/></TableCell>
                    <TableCell className="py-4">
                      <div className="flex items-center gap-4">
                        <Avatar className="h-10 w-10 border border-[#222225] bg-[#121214]"><AvatarFallback className="bg-transparent text-amber-500 font-bold text-sm">{String(contact.nombre || 'NA').substring(0, 2).toUpperCase()}</AvatarFallback></Avatar>
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-100 text-sm flex items-center gap-2">{contact.nombre} {contact.apellido}</span>
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
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
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