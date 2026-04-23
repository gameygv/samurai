import React, { useState, useEffect, useMemo } from 'react';
import Layout from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  GraduationCap, MapPin, UserCheck, Plus, Trash2, Save, Loader2,
  LayoutGrid, List, Music, CalendarClock, Users, ChevronDown, Settings2,
  DollarSign, Upload, Scan, Sparkles, Bot, BotOff, X as XIcon, Megaphone, Wifi
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { CampaignsContent } from './Campaigns';
import { useSearchParams } from 'react-router-dom';
import { LinkWhatsAppGroupDialog } from '@/components/academic/LinkWhatsAppGroupDialog';

interface Course {
  id: string;
  title: string;
  description: string;
  poster_url: string;
  ocr_content: string;
  presale_price: number | null;
  presale_ends_at: string | null;
  normal_price: number | null;
  sale_closes_at: string | null;
  nivel: string;
  sede: string;
  profesor: string;
  ai_instructions: string;
  ai_enabled: boolean;
  extras: string;
  session_dates: { date: string; start_time: string; end_time: string }[];
  valid_until: string | null;
  created_at: string;
  whatsapp_group_jid: string | null;
  whatsapp_channel_id: string | null;
}

interface CatalogItem { id: string; name: string; }

const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

const parseSafe = (val: string | undefined): CatalogItem[] => {
  if (!val) return [];
  try { const p = JSON.parse(val); return Array.isArray(p) ? p : []; } catch { return []; }
};

const isPresaleActive = (c: Course): boolean => {
  if (!c.presale_price || !c.presale_ends_at) return false;
  return new Date(c.presale_ends_at + 'T23:59:59') >= new Date();
};

const formatPrice = (n: number): string => `$${n.toLocaleString()}`;

const AcademicCatalog = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') === 'campaigns' ? 'campaigns' : 'catalog';
  const [activeMainTab, setActiveMainTab] = useState(initialTab);

  const handleMainTabChange = (tab: string) => {
    setActiveMainTab(tab);
    if (tab === 'campaigns') setSearchParams({ tab: 'campaigns' });
    else setSearchParams({});
  };

  const [catalogCourses, setCatalogCourses] = useState<CatalogItem[]>([]);
  const [locations, setLocations] = useState<CatalogItem[]>([]);
  const [teachers, setTeachers] = useState<CatalogItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);

  const [courses, setCourses] = useState<Course[]>([]);
  const [contacts, setContacts] = useState<{ academic_record: unknown }[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const [filterProfesor, setFilterProfesor] = useState('__all__');
  const [filterSede, setFilterSede] = useState('__all__');
  const [filterNivel, setFilterNivel] = useState('__all__');
  const [filterMonth, setFilterMonth] = useState('__all__');

  // Course create/edit dialog
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogStep, setDialogStep] = useState(1);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  // Form state
  const [form, setForm] = useState({
    title: '', description: '', poster_url: '', ocr_content: '',
    presale_price: '', presale_ends_at: '', normal_price: '',
    sale_closes_at: '', nivel: '', sede: '', profesor: '',
    ai_instructions: '', ai_enabled: true, extras: '',
    session_dates: [{ date: '', start_time: '', end_time: '' }] as { date: string; start_time: string; end_time: string }[],
    valid_until: '',
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');

  // WhatsApp group linking
  const [isGroupDialogOpen, setIsGroupDialogOpen] = useState(false);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [coursesRes, contactsRes, configRes] = await Promise.all([
        supabase.from('courses').select('*').order('created_at', { ascending: false }),
        supabase.from('contacts').select('academic_record'),
        supabase.from('app_config').select('key, value').in('key', ['academic_courses', 'academic_locations', 'academic_teachers']),
      ]);
      if (coursesRes.data) setCourses(coursesRes.data as Course[]);
      if (contactsRes.data) setContacts(contactsRes.data);
      if (configRes.data) {
        setCatalogCourses(parseSafe(configRes.data.find(d => d.key === 'academic_courses')?.value));
        setLocations(parseSafe(configRes.data.find(d => d.key === 'academic_locations')?.value));
        setTeachers(parseSafe(configRes.data.find(d => d.key === 'academic_teachers')?.value));
      }
    } finally { setLoading(false); }
  };

  const enrollmentMap = useMemo(() => {
    const map: Record<string, number> = {};
    contacts.forEach(c => {
      try {
        const ar = Array.isArray(c.academic_record) ? c.academic_record : JSON.parse(String(c.academic_record || '[]'));
        ar.forEach((r: any) => { if (r.asset_id) map[r.asset_id] = (map[r.asset_id] || 0) + 1; });
      } catch {}
    });
    return map;
  }, [contacts]);

  const filterOptions = useMemo(() => {
    const profesores = new Set<string>(), sedes = new Set<string>(), niveles = new Set<string>(), months = new Set<number>();
    courses.forEach(c => {
      if (c.profesor) profesores.add(c.profesor);
      if (c.sede) sedes.add(c.sede);
      if (c.nivel) niveles.add(c.nivel);
      const d = c.valid_until || c.presale_ends_at;
      if (d) months.add(new Date(d + 'T00:00:00').getMonth());
    });
    return { profesores: Array.from(profesores).sort(), sedes: Array.from(sedes).sort(), niveles: Array.from(niveles).sort(), months: Array.from(months).sort((a, b) => a - b) };
  }, [courses]);

  const filteredCourses = useMemo(() => courses.filter(c => {
    if (filterProfesor !== '__all__' && c.profesor !== filterProfesor) return false;
    if (filterSede !== '__all__' && c.sede !== filterSede) return false;
    if (filterNivel !== '__all__' && c.nivel !== filterNivel) return false;
    if (filterMonth !== '__all__') {
      const d = c.valid_until || c.presale_ends_at;
      if (!d || new Date(d + 'T00:00:00').getMonth() !== parseInt(filterMonth)) return false;
    }
    return true;
  }), [courses, filterProfesor, filterSede, filterNivel, filterMonth]);

  const hasActiveFilters = filterProfesor !== '__all__' || filterSede !== '__all__' || filterNivel !== '__all__' || filterMonth !== '__all__';

  // Dialog helpers
  const resetForm = () => {
    setForm({ title: '', description: '', poster_url: '', ocr_content: '', presale_price: '', presale_ends_at: '', normal_price: '', sale_closes_at: '', nivel: '', sede: '', profesor: '', ai_instructions: '', ai_enabled: true, extras: '', session_dates: [{ date: '', start_time: '', end_time: '' }], valid_until: '' });
    setSelectedFile(null); setPreviewUrl(''); setDialogStep(1); setEditingCourse(null);
  };

  const openCreate = () => { resetForm(); setIsDialogOpen(true); };

  const openEdit = (c: Course) => {
    setEditingCourse(c);
    setForm({
      title: c.title, description: c.description, poster_url: c.poster_url, ocr_content: c.ocr_content,
      presale_price: c.presale_price?.toString() || '', presale_ends_at: c.presale_ends_at || '',
      normal_price: c.normal_price?.toString() || '', sale_closes_at: c.sale_closes_at || '',
      nivel: c.nivel, sede: c.sede, profesor: c.profesor, ai_instructions: c.ai_instructions,
      ai_enabled: c.ai_enabled, extras: c.extras,
      session_dates: Array.isArray(c.session_dates) && c.session_dates.length > 0 ? c.session_dates : [{ date: '', start_time: '', end_time: '' }],
      valid_until: c.valid_until || '',
    });
    setPreviewUrl(c.poster_url);
    setDialogStep(3);
    setIsDialogOpen(true);
  };

  const handleFileSelect = (file: File | null) => {
    setSelectedFile(file);
    if (file) setPreviewUrl(URL.createObjectURL(file));
    else setPreviewUrl('');
  };

  const handleAnalyze = async () => {
    if (!selectedFile) return;
    setAnalyzing(true);
    const tid = toast.loading('Analizando poster con IA...');
    try {
      const ext = selectedFile.name.split('.').pop();
      const path = `uploads/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('media').upload(path, selectedFile);
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(path);
      setPreviewUrl(publicUrl);
      setForm(f => ({ ...f, poster_url: publicUrl }));

      const { data, error } = await supabase.functions.invoke('scrape-website', {
        body: { url: publicUrl, mode: 'VISION', assetCategory: 'COURSE', autoFill: true,
          categoryFields: ['title', 'description', 'presale_price', 'presale_ends_at', 'normal_price', 'valid_until', 'nivel', 'sede', 'profesor', 'extras', 'session_dates', 'ai_instructions'] }
      });
      if (error) throw new Error(error.message);
      if (data?.extracted) {
        const e = data.extracted;
        setForm(f => ({
          ...f, ocr_content: data.content || '',
          title: e.title || f.title, description: e.description || f.description,
          presale_price: e.presale_price?.toString() || f.presale_price,
          presale_ends_at: e.presale_ends_at || f.presale_ends_at,
          normal_price: e.normal_price?.toString() || f.normal_price,
          valid_until: e.valid_until || f.valid_until,
          nivel: e.nivel || f.nivel, sede: e.sede || f.sede, profesor: e.profesor || f.profesor,
          extras: e.extras || f.extras, ai_instructions: e.ai_instructions || f.ai_instructions,
          session_dates: Array.isArray(e.session_dates) && e.session_dates.length > 0 ? e.session_dates : f.session_dates,
        }));
      } else if (data?.content) {
        setForm(f => ({ ...f, ocr_content: data.content }));
      }
      toast.success('Análisis completado. Revisa los campos.', { id: tid });
      setDialogStep(3);
    } catch (err: any) { toast.error(err.message, { id: tid }); }
    finally { setAnalyzing(false); }
  };

  const handleSaveCourse = async () => {
    if (!form.poster_url) { toast.error('Se requiere un poster.'); return; }
    setUploading(true);
    try {
      const payload = {
        title: form.title || 'Sin título', description: form.description, poster_url: form.poster_url,
        ocr_content: form.ocr_content, presale_price: form.presale_price ? parseFloat(form.presale_price) : null,
        presale_ends_at: form.presale_ends_at || null, normal_price: form.normal_price ? parseFloat(form.normal_price) : null,
        sale_closes_at: form.sale_closes_at || null, nivel: form.nivel, sede: form.sede, profesor: form.profesor,
        ai_instructions: form.ai_instructions, ai_enabled: form.ai_enabled, extras: form.extras,
        session_dates: form.session_dates.filter(s => s.date), valid_until: form.valid_until || null,
      };

      if (editingCourse) {
        const { error } = await supabase.from('courses').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editingCourse.id);
        if (error) throw error;
        toast.success('Curso actualizado.');
      } else {
        const { error } = await supabase.from('courses').insert(payload);
        if (error) throw error;
        toast.success('Curso creado exitosamente.');
      }
      setIsDialogOpen(false);
      resetForm();
      fetchAll();
    } catch (err: any) { toast.error(err.message); }
    finally { setUploading(false); }
  };

  const handleDeleteCourse = async (id: string) => {
    if (!confirm('¿Eliminar este curso?')) return;
    await supabase.from('courses').delete().eq('id', id);
    fetchAll();
  };

  const handleSaveConfig = async () => {
    setSaving(true);
    try {
      await supabase.from('app_config').upsert([
        { key: 'academic_courses', value: JSON.stringify(catalogCourses), category: 'ACADEMIC' },
        { key: 'academic_locations', value: JSON.stringify(locations), category: 'ACADEMIC' },
        { key: 'academic_teachers', value: JSON.stringify(teachers), category: 'ACADEMIC' },
      ], { onConflict: 'key' });
      toast.success('Catálogo guardado.');
    } catch (err: any) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const renderConfigList = (items: CatalogItem[], setItems: (v: CatalogItem[]) => void, placeholder: string) => (
    <div className="space-y-4">
      {items.length === 0 ? <p className="text-center text-slate-600 text-xs italic py-8">Lista vacía.</p> :
        items.map((item, idx) => (
          <div key={item.id} className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#161618] border border-[#222225] flex items-center justify-center text-xs font-bold text-slate-500 shrink-0">{idx + 1}</div>
            <Input value={item.name} onChange={e => setItems(items.map(i => i.id === item.id ? { ...i, name: e.target.value } : i))} className="bg-[#121214] border-[#222225] h-11 text-slate-200 rounded-xl" placeholder={placeholder} />
            <Button variant="ghost" size="icon" onClick={() => setItems(items.filter(i => i.id !== item.id))} className="text-slate-600 hover:text-red-500 h-11 w-11 rounded-xl shrink-0"><Trash2 className="w-5 h-5" /></Button>
          </div>
        ))}
    </div>
  );

  if (loading) return <Layout><div className="flex h-[80vh] items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div></Layout>;

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-6 pb-12 animate-in fade-in duration-500">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <div className="p-2 bg-indigo-500/10 rounded-xl border border-indigo-500/20"><GraduationCap className="w-6 h-6 text-indigo-400" /></div>
              Academia
            </h1>
            <p className="text-slate-400 text-sm mt-1">Cursos, talleres y campañas</p>
          </div>
          {activeMainTab === 'catalog' && (
            <div className="flex items-center gap-2">
              <div className="flex bg-[#121214] border border-[#222225] rounded-xl p-1">
                <Button variant="ghost" size="sm" onClick={() => setViewMode('grid')} className={cn('h-8 w-8 p-0 rounded-lg', viewMode === 'grid' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-white')}><LayoutGrid className="w-4 h-4" /></Button>
                <Button variant="ghost" size="sm" onClick={() => setViewMode('list')} className={cn('h-8 w-8 p-0 rounded-lg', viewMode === 'list' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-white')}><List className="w-4 h-4" /></Button>
              </div>
              <Button className="bg-indigo-600 hover:bg-indigo-500 text-white h-11 px-6 rounded-xl font-bold uppercase tracking-widest text-xs" onClick={openCreate}>
                <Plus className="w-4 h-4 mr-2" /> Nuevo Curso
              </Button>
            </div>
          )}
        </div>

        {/* Main Tabs: Catálogo | Campañas */}
        <div className="flex bg-[#121214] border border-[#222225] rounded-xl p-1 w-fit">
          <Button variant="ghost" size="sm" onClick={() => handleMainTabChange('catalog')}
            className={cn('h-9 px-6 rounded-lg text-xs font-bold uppercase tracking-widest gap-2', activeMainTab === 'catalog' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-white')}>
            <GraduationCap className="w-4 h-4" /> Catálogo
          </Button>
          <Button variant="ghost" size="sm" onClick={() => handleMainTabChange('campaigns')}
            className={cn('h-9 px-6 rounded-lg text-xs font-bold uppercase tracking-widest gap-2', activeMainTab === 'campaigns' ? 'bg-amber-600 text-white' : 'text-slate-500 hover:text-white')}>
            <Megaphone className="w-4 h-4" /> Campañas
          </Button>
        </div>

        {activeMainTab === 'campaigns' && <CampaignsContent />}

        {activeMainTab === 'catalog' && (<>
        {/* Catalog content starts here */}

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-end">
          {[{ label: 'Profesor', val: filterProfesor, set: setFilterProfesor, opts: filterOptions.profesores },
            { label: 'Sede', val: filterSede, set: setFilterSede, opts: filterOptions.sedes },
            { label: 'Nivel', val: filterNivel, set: setFilterNivel, opts: filterOptions.niveles }].map(f => (
            <div key={f.label} className="space-y-1 min-w-[150px]">
              <Label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">{f.label}</Label>
              <Select value={f.val} onValueChange={f.set}>
                <SelectTrigger className="bg-[#121214] border-[#222225] rounded-xl h-9 text-xs text-slate-300"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-[#121214] border-[#222225] text-slate-200 rounded-xl">
                  <SelectItem value="__all__">Todos</SelectItem>
                  {f.opts.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          ))}
          <div className="space-y-1 min-w-[130px]">
            <Label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">Mes</Label>
            <Select value={filterMonth} onValueChange={setFilterMonth}>
              <SelectTrigger className="bg-[#121214] border-[#222225] rounded-xl h-9 text-xs text-slate-300"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-[#121214] border-[#222225] text-slate-200 rounded-xl">
                <SelectItem value="__all__">Todos</SelectItem>
                {filterOptions.months.map(m => <SelectItem key={m} value={String(m)}>{MONTH_NAMES[m]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {hasActiveFilters && <Button variant="ghost" size="sm" onClick={() => { setFilterProfesor('__all__'); setFilterSede('__all__'); setFilterNivel('__all__'); setFilterMonth('__all__'); }} className="text-slate-500 hover:text-white text-xs h-9">Limpiar filtros</Button>}
        </div>

        {/* Grid View */}
        {viewMode === 'grid' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredCourses.length === 0 ? (
              <div className="col-span-full py-20 text-center border-2 border-dashed border-slate-800 rounded-2xl text-slate-500">
                <p className="uppercase tracking-widest font-bold text-[10px]">No hay cursos que coincidan.</p>
              </div>
            ) : filteredCourses.map(c => {
              const enrolled = enrollmentMap[c.id] || 0;
              const presale = isPresaleActive(c);
              return (
                <Card key={c.id} className="bg-slate-900 border-slate-800 overflow-hidden group hover:border-indigo-500/50 transition-all shadow-xl rounded-2xl cursor-pointer" onClick={() => openEdit(c)}>
                  <div className="aspect-[4/5] bg-black relative border-b border-slate-800">
                    <img src={c.poster_url} className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity" alt={c.title} />
                    <div className="absolute top-3 left-3 flex gap-1.5">
                      {c.ai_enabled ? <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[8px] h-5 shadow-lg"><Bot className="w-2.5 h-2.5 mr-1"/>IA ON</Badge>
                        : <Badge className="bg-red-900/30 text-red-400 border-red-500/30 text-[8px] h-5 shadow-lg"><BotOff className="w-2.5 h-2.5 mr-1"/>IA OFF</Badge>}
                    </div>
                    {enrolled > 0 && <div className="absolute top-3 right-3"><Badge className="bg-indigo-600/90 text-white border-indigo-500 text-[9px] h-6 shadow-lg font-bold"><Users className="w-3 h-3 mr-1"/>{enrolled}</Badge></div>}
                    <Button variant="destructive" size="sm" className="absolute bottom-3 right-3 h-8 w-8 p-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity bg-red-900/80"
                      onClick={(e) => { e.stopPropagation(); handleDeleteCourse(c.id); }}><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
                  <div className="p-5 space-y-3">
                    <p className="text-sm font-bold text-slate-100 truncate">{c.title}</p>
                    {(c.sede || c.nivel || c.profesor) && (
                      <div className="flex flex-wrap gap-1.5">
                        {c.nivel && <Badge variant="outline" className="text-[8px] border-slate-700 text-slate-400"><GraduationCap className="w-2.5 h-2.5 mr-1"/>{c.nivel}</Badge>}
                        {c.profesor && <Badge variant="outline" className="text-[8px] border-slate-700 text-slate-400"><UserCheck className="w-2.5 h-2.5 mr-1"/>{c.profesor}</Badge>}
                        {c.sede && <Badge variant="outline" className="text-[8px] border-slate-700 text-slate-400"><MapPin className="w-2.5 h-2.5 mr-1"/>{c.sede}</Badge>}
                      </div>
                    )}
                    {(c.presale_price || c.normal_price) && (
                      <div className="flex gap-3 text-[10px] items-center">
                        {presale && c.presale_price ? (<><span className="text-amber-400 font-bold">${c.presale_price.toLocaleString()} <span className="text-amber-600 font-normal">preventa</span></span>{c.normal_price && <span className="text-slate-600 line-through">${c.normal_price.toLocaleString()}</span>}</>)
                          : c.normal_price ? <span className="text-slate-400 font-bold">{formatPrice(c.normal_price)}</span> : null}
                      </div>
                    )}
                    {c.session_dates && c.session_dates.length > 0 && c.session_dates[0].date && (
                      <div className="text-[9px] text-indigo-400/80 flex items-center gap-1">
                        <CalendarClock className="w-3 h-3"/> {c.session_dates.filter(s => s.date).map(s => new Date(s.date + 'T00:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })).join(', ')}
                      </div>
                    )}
                    <div className="flex items-center gap-3">
                      <span className="text-[9px] text-slate-500 flex items-center gap-1"><Users className="w-3 h-3"/> {enrolled} alumno{enrolled !== 1 ? 's' : ''}</span>
                      {c.whatsapp_group_jid && <Badge className="bg-emerald-900/20 text-emerald-400 border-emerald-500/20 text-[7px] h-4"><Wifi className="w-2 h-2 mr-0.5"/>Grupo WA</Badge>}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* List View */}
        {viewMode === 'list' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead><tr className="border-b border-[#222225] text-[10px] uppercase tracking-widest text-slate-500 font-bold">
                <th className="py-3 px-4">Curso</th><th className="py-3 px-4">Nivel</th><th className="py-3 px-4">Profesor</th><th className="py-3 px-4">Sede</th><th className="py-3 px-4 text-right">Precio</th><th className="py-3 px-4 text-center">IA</th><th className="py-3 px-4 text-center">Alumnos</th>
              </tr></thead>
              <tbody>
                {filteredCourses.length === 0 ? <tr><td colSpan={7} className="py-20 text-center text-slate-500 text-[10px]">No hay cursos.</td></tr> :
                  filteredCourses.map(c => {
                    const enrolled = enrollmentMap[c.id] || 0;
                    const presale = isPresaleActive(c);
                    const price = presale && c.presale_price ? c.presale_price : c.normal_price;
                    return (
                      <tr key={c.id} className="border-b border-[#161618] hover:bg-[#121214] transition-colors cursor-pointer" onClick={() => openEdit(c)}>
                        <td className="py-3 px-4"><div className="flex items-center gap-3"><img src={c.poster_url} className="w-10 h-10 rounded-lg object-cover border border-slate-800" alt=""/><p className="text-sm font-semibold text-slate-200 truncate max-w-[200px]">{c.title}</p></div></td>
                        <td className="py-3 px-4 text-xs text-slate-400">{c.nivel || '-'}</td>
                        <td className="py-3 px-4 text-xs text-slate-400">{c.profesor || '-'}</td>
                        <td className="py-3 px-4 text-xs text-slate-400">{c.sede || '-'}</td>
                        <td className="py-3 px-4 text-right">{price ? <span className={cn('text-xs font-bold', presale ? 'text-amber-400' : 'text-slate-300')}>{formatPrice(price)}</span> : <span className="text-xs text-slate-600">-</span>}</td>
                        <td className="py-3 px-4 text-center">{c.ai_enabled ? <Bot className="w-4 h-4 text-emerald-400 mx-auto"/> : <BotOff className="w-4 h-4 text-red-400 mx-auto"/>}</td>
                        <td className="py-3 px-4 text-center"><Badge variant="outline" className={cn('text-[9px] font-bold', enrolled > 0 ? 'border-indigo-500/50 text-indigo-400' : 'border-slate-700 text-slate-600')}>{enrolled}</Badge></td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}

        {/* Config Section */}
        <Collapsible open={configOpen} onOpenChange={setConfigOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full flex items-center justify-between h-12 px-4 bg-[#0f0f11] border border-[#222225] rounded-xl hover:bg-[#161618] text-slate-400">
              <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest"><Settings2 className="w-4 h-4"/> Gestionar Catálogos</span>
              <ChevronDown className={cn('w-4 h-4 transition-transform', configOpen && 'rotate-180')} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-4 space-y-4">
            <div className="flex justify-end">
              <Button onClick={handleSaveConfig} disabled={saving} className="bg-indigo-600 hover:bg-indigo-500 text-white h-11 px-8 rounded-xl shadow-lg uppercase tracking-widest font-bold text-xs">
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2"/> : <Save className="w-4 h-4 mr-2"/>} Guardar Catálogo
              </Button>
            </div>
            <Tabs defaultValue="cursos" className="w-full">
              <TabsList className="bg-[#121214] border border-[#222225] p-1 rounded-xl flex-wrap h-auto">
                <TabsTrigger value="cursos" className="gap-2 px-6 py-2 text-xs data-[state=active]:bg-indigo-600 data-[state=active]:text-white font-bold uppercase tracking-widest"><GraduationCap className="w-4 h-4"/> Niveles</TabsTrigger>
                <TabsTrigger value="sedes" className="gap-2 px-6 py-2 text-xs data-[state=active]:bg-emerald-600 data-[state=active]:text-white font-bold uppercase tracking-widest"><MapPin className="w-4 h-4"/> Sedes</TabsTrigger>
                <TabsTrigger value="profesores" className="gap-2 px-6 py-2 text-xs data-[state=active]:bg-amber-600 data-[state=active]:text-white font-bold uppercase tracking-widest"><UserCheck className="w-4 h-4"/> Profesores</TabsTrigger>
              </TabsList>
              <TabsContent value="cursos" className="mt-6"><Card className="bg-[#0f0f11] border-[#222225] shadow-2xl rounded-2xl border-l-4 border-l-indigo-500"><CardHeader className="bg-[#161618] border-b border-[#222225] flex flex-row items-center justify-between"><div><CardTitle className="text-indigo-400 text-base font-bold">Niveles de Cursos</CardTitle></div><Button onClick={() => setCatalogCourses([...catalogCourses, { id: Date.now().toString(), name: '' }])} variant="outline" className="border-[#333336] bg-[#0a0a0c] hover:text-white rounded-xl h-9 text-[10px] uppercase font-bold tracking-widest"><Plus className="w-4 h-4 mr-2"/> Añadir</Button></CardHeader><CardContent className="p-6">{renderConfigList(catalogCourses, setCatalogCourses, 'Ej: Módulo 1 Básico')}</CardContent></Card></TabsContent>
              <TabsContent value="sedes" className="mt-6"><Card className="bg-[#0f0f11] border-[#222225] shadow-2xl rounded-2xl border-l-4 border-l-emerald-500"><CardHeader className="bg-[#161618] border-b border-[#222225] flex flex-row items-center justify-between"><div><CardTitle className="text-emerald-400 text-base font-bold">Sedes</CardTitle></div><Button onClick={() => setLocations([...locations, { id: Date.now().toString(), name: '' }])} variant="outline" className="border-[#333336] bg-[#0a0a0c] hover:text-white rounded-xl h-9 text-[10px] uppercase font-bold tracking-widest"><Plus className="w-4 h-4 mr-2"/> Añadir</Button></CardHeader><CardContent className="p-6">{renderConfigList(locations, setLocations, 'Ej: CDMX - Coyoacán')}</CardContent></Card></TabsContent>
              <TabsContent value="profesores" className="mt-6"><Card className="bg-[#0f0f11] border-[#222225] shadow-2xl rounded-2xl border-l-4 border-l-amber-500"><CardHeader className="bg-[#161618] border-b border-[#222225] flex flex-row items-center justify-between"><div><CardTitle className="text-amber-500 text-base font-bold">Profesores</CardTitle></div><Button onClick={() => setTeachers([...teachers, { id: Date.now().toString(), name: '' }])} variant="outline" className="border-[#333336] bg-[#0a0a0c] hover:text-white rounded-xl h-9 text-[10px] uppercase font-bold tracking-widest"><Plus className="w-4 h-4 mr-2"/> Añadir</Button></CardHeader><CardContent className="p-6">{renderConfigList(teachers, setTeachers, 'Ej: Maestro Juan Pérez')}</CardContent></Card></TabsContent>
            </Tabs>
          </CollapsibleContent>
        </Collapsible>
        </>)}
      </div>

      {/* Course Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setIsDialogOpen(open); }}>
        <DialogContent className="bg-slate-900 border-slate-800 text-slate-100 max-w-2xl rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-sm uppercase tracking-widest text-indigo-400 font-bold flex items-center gap-2">
              {editingCourse ? <GraduationCap className="w-4 h-4"/> : <Upload className="w-4 h-4"/>}
              {dialogStep === 1 && 'Paso 1: Subir Poster del Curso'}
              {dialogStep === 2 && 'Analizando...'}
              {dialogStep === 3 && (editingCourse ? 'Editar Curso' : 'Paso 2: Completar Información')}
            </DialogTitle>
          </DialogHeader>

          {dialogStep === 1 && (
            <div className="space-y-6 pt-4">
              <p className="text-xs text-slate-400">Sube el poster del curso o taller. Se analizará con IA para extraer la información automáticamente.</p>
              {previewUrl ? (
                <div className="relative rounded-xl overflow-hidden border border-slate-700">
                  <img src={previewUrl} className="w-full max-h-64 object-contain bg-black" alt="Preview"/>
                  <Button variant="ghost" size="sm" className="absolute top-2 right-2 bg-black/60 text-white h-8 rounded-lg text-[10px]" onClick={() => { handleFileSelect(null); setPreviewUrl(''); }}>Cambiar</Button>
                </div>
              ) : (
                <Input type="file" onChange={e => handleFileSelect(e.target.files?.[0] || null)} className="bg-slate-950 border-slate-800 rounded-xl file:text-amber-500 file:font-bold file:mr-4 file:bg-slate-900 file:border-0 cursor-pointer" accept="image/*" />
              )}
              <Button className="w-full bg-amber-600 hover:bg-amber-500 text-slate-950 h-12 rounded-xl font-bold uppercase tracking-widest text-[10px]" onClick={handleAnalyze} disabled={!selectedFile || analyzing}>
                {analyzing ? <Loader2 className="w-4 h-4 animate-spin mr-2"/> : <Scan className="w-4 h-4 mr-2"/>} Analizar con IA y Continuar
              </Button>
            </div>
          )}

          {dialogStep === 3 && (
            <div className="space-y-4 pt-4">
              {previewUrl && <div className="rounded-xl overflow-hidden border border-slate-700 mb-2"><img src={previewUrl} className="w-full max-h-40 object-contain bg-black" alt="Poster"/></div>}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2 md:col-span-2">
                  <Label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Título *</Label>
                  <Input value={form.title} onChange={e => setForm({...form, title: e.target.value})} className="bg-slate-950 border-slate-800 h-11 rounded-xl" required/>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Descripción</Label>
                  <Textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="bg-slate-950 border-slate-800 text-xs h-20 rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest flex items-center gap-1"><DollarSign className="w-3 h-3 text-emerald-400"/> Precio Preventa</Label>
                  <Input type="number" value={form.presale_price} onChange={e => setForm({...form, presale_price: e.target.value})} placeholder="1500" className="bg-slate-950 border-slate-800 h-10 rounded-xl"/>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest flex items-center gap-1"><CalendarClock className="w-3 h-3 text-amber-400"/> Fin Preventa</Label>
                  <Input type="date" value={form.presale_ends_at} onChange={e => setForm({...form, presale_ends_at: e.target.value})} className="bg-slate-950 border-slate-800 h-10 rounded-xl"/>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest flex items-center gap-1"><DollarSign className="w-3 h-3"/> Precio Normal</Label>
                  <Input type="number" value={form.normal_price} onChange={e => setForm({...form, normal_price: e.target.value})} placeholder="2000" className="bg-slate-950 border-slate-800 h-10 rounded-xl"/>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-bold text-red-400 tracking-widest flex items-center gap-1"><CalendarClock className="w-3 h-3"/> Cierre de Venta</Label>
                  <Input type="date" value={form.sale_closes_at} onChange={e => setForm({...form, sale_closes_at: e.target.value})} className="bg-slate-950 border-slate-800 h-10 rounded-xl"/>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Nivel</Label>
                  <Select value={form.nivel || '_none_'} onValueChange={v => setForm({...form, nivel: v === '_none_' ? '' : v})}>
                    <SelectTrigger className="bg-slate-950 border-slate-800 rounded-xl h-10 text-xs"><SelectValue/></SelectTrigger>
                    <SelectContent className="bg-slate-900 text-slate-100 rounded-xl border-slate-800"><SelectItem value="_none_">Sin nivel</SelectItem>{catalogCourses.map(n => <SelectItem key={n.id} value={n.name}>{n.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Profesor</Label>
                  <Select value={form.profesor || '_none_'} onValueChange={v => setForm({...form, profesor: v === '_none_' ? '' : v})}>
                    <SelectTrigger className="bg-slate-950 border-slate-800 rounded-xl h-10 text-xs"><SelectValue/></SelectTrigger>
                    <SelectContent className="bg-slate-900 text-slate-100 rounded-xl border-slate-800"><SelectItem value="_none_">Sin profesor</SelectItem>{teachers.filter(t => t.name?.trim()).map(t => <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Sede</Label>
                  <Select value={form.sede || '_none_'} onValueChange={v => setForm({...form, sede: v === '_none_' ? '' : v})}>
                    <SelectTrigger className="bg-slate-950 border-slate-800 rounded-xl h-10 text-xs"><SelectValue/></SelectTrigger>
                    <SelectContent className="bg-slate-900 text-slate-100 rounded-xl border-slate-800"><SelectItem value="_none_">Sin sede</SelectItem>{locations.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Vigente Hasta</Label>
                  <Input type="date" value={form.valid_until} onChange={e => setForm({...form, valid_until: e.target.value})} className="bg-slate-950 border-slate-800 h-10 rounded-xl"/>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Extras (conciertos, actividades)</Label>
                <Input value={form.extras} onChange={e => setForm({...form, extras: e.target.value})} placeholder="Ej: Concierto del viernes incluido" className="bg-slate-950 border-slate-800 h-10 rounded-xl"/>
              </div>

              {/* WhatsApp Group Link */}
              {editingCourse && (
                <div className="p-3 bg-[#121214] border border-[#222225] rounded-xl">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Grupo WhatsApp</span>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setIsGroupDialogOpen(true)}
                      className={cn('h-8 rounded-lg text-[10px] uppercase tracking-widest font-bold',
                        editingCourse.whatsapp_group_jid
                          ? 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-900/20'
                          : 'border-[#333336] text-slate-400 hover:text-white')}>
                      {editingCourse.whatsapp_group_jid ? 'Vinculado' : 'Vincular'}
                    </Button>
                  </div>
                  {editingCourse.whatsapp_group_jid && (
                    <p className="text-[10px] text-slate-600 font-mono mt-1">{editingCourse.whatsapp_group_jid}</p>
                  )}
                </div>
              )}

              {/* Session dates */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-[10px] uppercase font-bold text-amber-400 tracking-widest flex items-center gap-1"><CalendarClock className="w-3.5 h-3.5"/> Fechas de Impartición</Label>
                  <Button type="button" variant="ghost" size="sm" className="h-7 text-[9px] text-emerald-500" onClick={() => setForm({...form, session_dates: [...form.session_dates, { date: '', start_time: '', end_time: '' }]})}>
                    <Plus className="w-3 h-3 mr-1"/> Sesión
                  </Button>
                </div>
                {form.session_dates.map((s, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Input type="date" value={s.date} onChange={e => { const sd = [...form.session_dates]; sd[idx] = {...s, date: e.target.value}; setForm({...form, session_dates: sd}); }} className="bg-slate-950 border-slate-800 h-8 text-xs rounded-lg flex-1"/>
                    <Input type="time" value={s.start_time} onChange={e => { const sd = [...form.session_dates]; sd[idx] = {...s, start_time: e.target.value}; setForm({...form, session_dates: sd}); }} className="bg-slate-950 border-slate-800 h-8 text-xs w-24 rounded-lg"/>
                    <span className="text-slate-600">-</span>
                    <Input type="time" value={s.end_time} onChange={e => { const sd = [...form.session_dates]; sd[idx] = {...s, end_time: e.target.value}; setForm({...form, session_dates: sd}); }} className="bg-slate-950 border-slate-800 h-8 text-xs w-24 rounded-lg"/>
                    {form.session_dates.length > 1 && <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500" onClick={() => setForm({...form, session_dates: form.session_dates.filter((_, i) => i !== idx)})}><XIcon className="w-3 h-3"/></Button>}
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] text-indigo-400 uppercase font-bold tracking-widest flex items-center gap-2"><Sparkles className="w-3 h-3"/> Instrucciones IA</Label>
                <Textarea value={form.ai_instructions} onChange={e => setForm({...form, ai_instructions: e.target.value})} placeholder="Prompt para el agente IA: cuándo enviar este poster, qué información dar..." className="bg-slate-950 border-slate-800 text-xs h-24 rounded-xl"/>
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-950 border border-slate-800 rounded-xl">
                <Label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest flex items-center gap-2"><Bot className="w-3.5 h-3.5 text-emerald-400"/> Agente IA usa este curso</Label>
                <Switch checked={form.ai_enabled} onCheckedChange={c => setForm({...form, ai_enabled: c})}/>
              </div>

              <Button className="w-full bg-indigo-600 hover:bg-indigo-500 text-white h-12 rounded-xl shadow-lg uppercase font-bold tracking-widest text-[10px]" onClick={handleSaveCourse} disabled={uploading}>
                {uploading ? <Loader2 className="w-4 h-4 animate-spin mr-2"/> : <Save className="w-4 h-4 mr-2"/>}
                {editingCourse ? 'Guardar Cambios' : 'Crear Curso'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
      {/* WhatsApp Group Link Dialog */}
      {editingCourse && (
        <LinkWhatsAppGroupDialog
          open={isGroupDialogOpen}
          onOpenChange={setIsGroupDialogOpen}
          courseId={editingCourse.id}
          courseTitle={editingCourse.title}
          currentGroupJid={editingCourse.whatsapp_group_jid}
          currentChannelId={editingCourse.whatsapp_channel_id}
          onLinked={(groupJid, channelId, _groupName) => {
            setEditingCourse({ ...editingCourse, whatsapp_group_jid: groupJid, whatsapp_channel_id: channelId });
            setCourses(prev => prev.map(c => c.id === editingCourse.id ? { ...c, whatsapp_group_jid: groupJid, whatsapp_channel_id: channelId } : c));
          }}
          onUnlinked={() => {
            setEditingCourse({ ...editingCourse, whatsapp_group_jid: null, whatsapp_channel_id: null });
            setCourses(prev => prev.map(c => c.id === editingCourse.id ? { ...c, whatsapp_group_jid: null, whatsapp_channel_id: null } : c));
          }}
        />
      )}
    </Layout>
  );
};

export default AcademicCatalog;
