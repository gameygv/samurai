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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  GraduationCap, MapPin, UserCheck, Plus, Trash2, Save, Loader2,
  LayoutGrid, List, Music, CalendarClock, Users, ChevronDown, Settings2, DollarSign
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ── Types ──────────────────────────────────────────────────────────────────────

interface MediaAsset {
  id: string;
  title: string | null;
  url: string | null;
  type: string | null;
  category: string | null;
  nivel: string | null;
  profesor: string | null;
  sede: string | null;
  presale_price: number | null;
  presale_ends_at: string | null;
  normal_price: number | null;
  valid_until: string | null;
  friday_concert: boolean | null;
  created_at: string | null;
}

interface AcademicEntry {
  asset_id?: string;
  course?: string;
  location?: string;
  teacher?: string;
  date?: string;
  nivel?: string;
}

interface CatalogItem {
  id: string;
  name: string;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  POSTER_PROMO: 'bg-amber-500 text-slate-950 border-amber-400',
  CARTEL_GENERAL: 'bg-blue-500 text-white border-blue-400',
  PROMO_ESPECIAL: 'bg-fuchsia-500 text-white border-fuchsia-400',
  AVISO: 'bg-orange-500 text-white border-orange-400',
};

const CATEGORY_LABELS: Record<string, string> = {
  POSTER_PROMO: 'Poster Promocional',
  CARTEL_GENERAL: 'Cartel General',
  PROMO_ESPECIAL: 'Promoción Especial',
  AVISO: 'Aviso',
};

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

// ── Helpers ────────────────────────────────────────────────────────────────────

const parseAcademicRecord = (raw: unknown): AcademicEntry[] => {
  try {
    const arr = Array.isArray(raw) ? raw : JSON.parse(String(raw || '[]'));
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
};

const parseSafe = (val: string | undefined): CatalogItem[] => {
  if (!val) return [];
  try {
    const parsed = JSON.parse(val);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const getAssetMonth = (asset: MediaAsset): number | null => {
  const dateStr = asset.valid_until || asset.presale_ends_at;
  if (!dateStr) return null;
  return new Date(dateStr + 'T00:00:00').getMonth();
};

const isPresaleActive = (asset: MediaAsset): boolean => {
  if (!asset.presale_price || !asset.presale_ends_at) return false;
  return new Date(asset.presale_ends_at + 'T23:59:59') >= new Date();
};

const formatPrice = (n: number): string => `$${n.toLocaleString()}`;

// ── Component ──────────────────────────────────────────────────────────────────

const AcademicCatalog = () => {
  // Catalog config state (existing functionality)
  const [courses, setCourses] = useState<CatalogItem[]>([]);
  const [locations, setLocations] = useState<CatalogItem[]>([]);
  const [teachers, setTeachers] = useState<CatalogItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);

  // Course catalog state (new functionality)
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [contacts, setContacts] = useState<{ academic_record: unknown }[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Filters
  const [filterProfesor, setFilterProfesor] = useState('__all__');
  const [filterSede, setFilterSede] = useState('__all__');
  const [filterNivel, setFilterNivel] = useState('__all__');
  const [filterCategory, setFilterCategory] = useState('__all__');
  const [filterMonth, setFilterMonth] = useState('__all__');

  // ── Data fetching ──────────────────────────────────────────────────────────

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [assetsRes, contactsRes, configRes] = await Promise.all([
        supabase.from('media_assets').select('id, title, url, type, category, nivel, profesor, sede, presale_price, presale_ends_at, normal_price, valid_until, friday_concert, created_at').neq('category', 'PAYMENT').order('created_at', { ascending: false }),
        supabase.from('contacts').select('academic_record'),
        supabase.from('app_config').select('key, value').in('key', ['academic_courses', 'academic_locations', 'academic_teachers']),
      ]);

      if (assetsRes.data) setAssets(assetsRes.data as MediaAsset[]);
      if (contactsRes.data) setContacts(contactsRes.data);
      if (configRes.data) {
        const c = configRes.data.find(d => d.key === 'academic_courses')?.value;
        const l = configRes.data.find(d => d.key === 'academic_locations')?.value;
        const t = configRes.data.find(d => d.key === 'academic_teachers')?.value;
        setCourses(parseSafe(c));
        setLocations(parseSafe(l));
        setTeachers(parseSafe(t));
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Enrollment map ─────────────────────────────────────────────────────────

  const enrollmentMap = useMemo(() => {
    const map: Record<string, number> = {};
    contacts.forEach(c => {
      const ar = parseAcademicRecord(c.academic_record);
      ar.forEach(r => {
        if (r.asset_id) map[r.asset_id] = (map[r.asset_id] || 0) + 1;
      });
    });
    return map;
  }, [contacts]);

  // ── Filter options (derived from data) ─────────────────────────────────────

  const filterOptions = useMemo(() => {
    const profesores = new Set<string>();
    const sedes = new Set<string>();
    const niveles = new Set<string>();
    const categories = new Set<string>();
    const months = new Set<number>();

    assets.forEach(a => {
      if (a.profesor) profesores.add(a.profesor);
      if (a.sede) sedes.add(a.sede);
      if (a.nivel) niveles.add(a.nivel);
      if (a.category) categories.add(a.category);
      const m = getAssetMonth(a);
      if (m !== null) months.add(m);
    });

    return {
      profesores: Array.from(profesores).sort(),
      sedes: Array.from(sedes).sort(),
      niveles: Array.from(niveles).sort(),
      categories: Array.from(categories).sort(),
      months: Array.from(months).sort((a, b) => a - b),
    };
  }, [assets]);

  // ── Filtered assets ────────────────────────────────────────────────────────

  const filteredAssets = useMemo(() => {
    return assets.filter(a => {
      if (filterProfesor !== '__all__' && a.profesor !== filterProfesor) return false;
      if (filterSede !== '__all__' && a.sede !== filterSede) return false;
      if (filterNivel !== '__all__' && a.nivel !== filterNivel) return false;
      if (filterCategory !== '__all__' && a.category !== filterCategory) return false;
      if (filterMonth !== '__all__') {
        const m = getAssetMonth(a);
        if (m === null || m !== parseInt(filterMonth)) return false;
      }
      return true;
    });
  }, [assets, filterProfesor, filterSede, filterNivel, filterCategory, filterMonth]);

  // ── Catalog config save (existing) ─────────────────────────────────────────

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      await supabase.from('app_config').upsert([
        { key: 'academic_courses', value: JSON.stringify(courses), category: 'ACADEMIC' },
        { key: 'academic_locations', value: JSON.stringify(locations), category: 'ACADEMIC' },
        { key: 'academic_teachers', value: JSON.stringify(teachers), category: 'ACADEMIC' },
      ], { onConflict: 'key' });
      toast.success('Catálogo académico guardado exitosamente.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      toast.error('Error al guardar: ' + msg);
    } finally {
      setSaving(false);
    }
  };

  // ── Render helpers ─────────────────────────────────────────────────────────

  const renderList = (
    items: CatalogItem[],
    setItems: (val: CatalogItem[]) => void,
    placeholder: string
  ) => (
    <div className="space-y-4">
      {items.length === 0 ? (
        <p className="text-center text-slate-600 text-xs italic py-8">Lista vacia. Haz clic en &quot;Anadir&quot;.</p>
      ) : items.map((item, idx) => (
        <div key={item.id} className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#161618] border border-[#222225] flex items-center justify-center text-xs font-bold text-slate-500 shrink-0">
            {idx + 1}
          </div>
          <Input
            value={item.name}
            onChange={e => setItems(items.map(i => i.id === item.id ? { ...i, name: e.target.value } : i))}
            className="bg-[#121214] border-[#222225] h-11 text-slate-200 focus-visible:ring-indigo-500 rounded-xl"
            placeholder={placeholder}
          />
          <Button variant="ghost" size="icon" onClick={() => setItems(items.filter(i => i.id !== item.id))} className="text-slate-600 hover:bg-red-500/10 hover:text-red-500 h-11 w-11 rounded-xl shrink-0">
            <Trash2 className="w-5 h-5" />
          </Button>
        </div>
      ))}
    </div>
  );

  const clearFilters = () => {
    setFilterProfesor('__all__');
    setFilterSede('__all__');
    setFilterNivel('__all__');
    setFilterCategory('__all__');
    setFilterMonth('__all__');
  };

  const hasActiveFilters = filterProfesor !== '__all__' || filterSede !== '__all__' || filterNivel !== '__all__' || filterCategory !== '__all__' || filterMonth !== '__all__';

  // ── Loading state ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <Layout>
        <div className="flex h-[80vh] items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        </div>
      </Layout>
    );
  }

  // ── Main render ────────────────────────────────────────────────────────────

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-6 pb-12 animate-in fade-in duration-500">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <div className="p-2 bg-indigo-500/10 rounded-xl border border-indigo-500/20">
                <GraduationCap className="w-6 h-6 text-indigo-400" />
              </div>
              Catalogo Academico
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              {filteredAssets.length} curso{filteredAssets.length !== 1 ? 's' : ''} de {assets.length} total
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex bg-[#121214] border border-[#222225] rounded-xl p-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setViewMode('grid')}
                className={cn('h-8 w-8 p-0 rounded-lg', viewMode === 'grid' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-white')}
              >
                <LayoutGrid className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setViewMode('list')}
                className={cn('h-8 w-8 p-0 rounded-lg', viewMode === 'list' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-white')}
              >
                <List className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-wrap gap-3 items-end">
          <div className="space-y-1 min-w-[150px]">
            <Label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">Profesor</Label>
            <Select value={filterProfesor} onValueChange={setFilterProfesor}>
              <SelectTrigger className="bg-[#121214] border-[#222225] rounded-xl h-9 text-xs text-slate-300">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#121214] border-[#222225] text-slate-200 rounded-xl">
                <SelectItem value="__all__">Todos</SelectItem>
                {filterOptions.profesores.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1 min-w-[150px]">
            <Label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">Sede</Label>
            <Select value={filterSede} onValueChange={setFilterSede}>
              <SelectTrigger className="bg-[#121214] border-[#222225] rounded-xl h-9 text-xs text-slate-300">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#121214] border-[#222225] text-slate-200 rounded-xl">
                <SelectItem value="__all__">Todas</SelectItem>
                {filterOptions.sedes.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1 min-w-[130px]">
            <Label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">Nivel</Label>
            <Select value={filterNivel} onValueChange={setFilterNivel}>
              <SelectTrigger className="bg-[#121214] border-[#222225] rounded-xl h-9 text-xs text-slate-300">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#121214] border-[#222225] text-slate-200 rounded-xl">
                <SelectItem value="__all__">Todos</SelectItem>
                {filterOptions.niveles.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1 min-w-[150px]">
            <Label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">Tipo</Label>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="bg-[#121214] border-[#222225] rounded-xl h-9 text-xs text-slate-300">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#121214] border-[#222225] text-slate-200 rounded-xl">
                <SelectItem value="__all__">Todos</SelectItem>
                {filterOptions.categories.map(c => <SelectItem key={c} value={c}>{CATEGORY_LABELS[c] || c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1 min-w-[130px]">
            <Label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">Mes</Label>
            <Select value={filterMonth} onValueChange={setFilterMonth}>
              <SelectTrigger className="bg-[#121214] border-[#222225] rounded-xl h-9 text-xs text-slate-300">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#121214] border-[#222225] text-slate-200 rounded-xl">
                <SelectItem value="__all__">Todos</SelectItem>
                {filterOptions.months.map(m => <SelectItem key={m} value={String(m)}>{MONTH_NAMES[m]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="text-slate-500 hover:text-white text-xs h-9">
              Limpiar filtros
            </Button>
          )}
        </div>

        {/* Course Catalog — Grid View */}
        {viewMode === 'grid' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredAssets.length === 0 ? (
              <div className="col-span-full py-20 text-center border-2 border-dashed border-slate-800 rounded-2xl text-slate-500">
                <p className="uppercase tracking-widest font-bold text-[10px]">No hay cursos que coincidan con los filtros.</p>
              </div>
            ) : filteredAssets.map(asset => {
              const enrolled = enrollmentMap[asset.id] || 0;
              const presaleActive = isPresaleActive(asset);

              return (
                <Card key={asset.id} className="bg-slate-900 border-slate-800 overflow-hidden group hover:border-indigo-500/50 transition-all shadow-xl rounded-2xl">
                  {/* Image */}
                  <div className="aspect-[4/5] bg-black relative border-b border-slate-800">
                    {asset.url && asset.type === 'IMAGE' ? (
                      <img src={asset.url} className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity" alt={asset.title || ''} />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-slate-900">
                        <GraduationCap className="w-12 h-12 text-slate-700" />
                      </div>
                    )}

                    {/* Top-left badges */}
                    <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
                      {asset.category && (
                        <Badge className={cn('text-[9px] uppercase tracking-widest font-bold shadow-lg', CATEGORY_COLORS[asset.category] || 'bg-slate-600 text-white')}>
                          {CATEGORY_LABELS[asset.category] || asset.category}
                        </Badge>
                      )}
                      {asset.friday_concert && (
                        <Badge className="bg-purple-500/90 text-white border-purple-400 text-[8px] h-5 shadow-lg">
                          <Music className="w-2.5 h-2.5 mr-1" /> Concierto
                        </Badge>
                      )}
                    </div>

                    {/* Top-right enrollment count */}
                    {enrolled > 0 && (
                      <div className="absolute top-3 right-3">
                        <Badge className="bg-indigo-600/90 text-white border-indigo-500 text-[9px] h-6 shadow-lg font-bold">
                          <Users className="w-3 h-3 mr-1" /> {enrolled}
                        </Badge>
                      </div>
                    )}
                  </div>

                  {/* Card body */}
                  <div className="p-5 space-y-3">
                    <p className="text-sm font-bold text-slate-100 truncate">{asset.title || 'Sin titulo'}</p>

                    {/* Meta pills */}
                    {(asset.sede || asset.nivel || asset.profesor) && (
                      <div className="flex flex-wrap gap-1.5">
                        {asset.nivel && (
                          <Badge variant="outline" className="text-[8px] border-slate-700 text-slate-400">
                            <GraduationCap className="w-2.5 h-2.5 mr-1" />{asset.nivel}
                          </Badge>
                        )}
                        {asset.profesor && (
                          <Badge variant="outline" className="text-[8px] border-slate-700 text-slate-400">
                            <UserCheck className="w-2.5 h-2.5 mr-1" />{asset.profesor}
                          </Badge>
                        )}
                        {asset.sede && (
                          <Badge variant="outline" className="text-[8px] border-slate-700 text-slate-400">
                            <MapPin className="w-2.5 h-2.5 mr-1" />{asset.sede}
                          </Badge>
                        )}
                      </div>
                    )}

                    {/* Prices */}
                    {(asset.presale_price || asset.normal_price) && (
                      <div className="flex gap-3 text-[10px] items-center">
                        {presaleActive && asset.presale_price ? (
                          <>
                            <span className="text-amber-400 font-bold">
                              <DollarSign className="w-3 h-3 inline" />{asset.presale_price.toLocaleString()}
                              <span className="text-amber-600 font-normal ml-1">preventa</span>
                            </span>
                            {asset.normal_price && (
                              <span className="text-slate-600 line-through">${asset.normal_price.toLocaleString()}</span>
                            )}
                          </>
                        ) : asset.normal_price ? (
                          <span className="text-slate-400 font-bold">{formatPrice(asset.normal_price)}</span>
                        ) : null}
                      </div>
                    )}

                    {/* Presale deadline */}
                    {asset.presale_ends_at && presaleActive && (
                      <div className="text-[9px] text-amber-400/80 flex items-center gap-1">
                        <CalendarClock className="w-3 h-3" /> Preventa hasta: {new Date(asset.presale_ends_at + 'T00:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </div>
                    )}

                    {/* Enrollment info */}
                    <div className="text-[9px] text-slate-500 flex items-center gap-1">
                      <Users className="w-3 h-3" /> {enrolled} alumno{enrolled !== 1 ? 's' : ''} inscrito{enrolled !== 1 ? 's' : ''}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* Course Catalog — List View */}
        {viewMode === 'list' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[#222225] text-[10px] uppercase tracking-widest text-slate-500 font-bold">
                  <th className="py-3 px-4">Curso</th>
                  <th className="py-3 px-4">Tipo</th>
                  <th className="py-3 px-4">Nivel</th>
                  <th className="py-3 px-4">Profesor</th>
                  <th className="py-3 px-4">Sede</th>
                  <th className="py-3 px-4 text-right">Precio</th>
                  <th className="py-3 px-4 text-center">Alumnos</th>
                </tr>
              </thead>
              <tbody>
                {filteredAssets.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-20 text-center text-slate-500 text-[10px] uppercase tracking-widest font-bold">
                      No hay cursos que coincidan con los filtros.
                    </td>
                  </tr>
                ) : filteredAssets.map(asset => {
                  const enrolled = enrollmentMap[asset.id] || 0;
                  const presaleActive = isPresaleActive(asset);
                  const displayPrice = presaleActive && asset.presale_price ? asset.presale_price : asset.normal_price;

                  return (
                    <tr key={asset.id} className="border-b border-[#161618] hover:bg-[#121214] transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          {asset.url && asset.type === 'IMAGE' ? (
                            <img src={asset.url} className="w-10 h-10 rounded-lg object-cover border border-slate-800" alt="" />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center">
                              <GraduationCap className="w-4 h-4 text-slate-600" />
                            </div>
                          )}
                          <div>
                            <p className="text-sm font-semibold text-slate-200 truncate max-w-[200px]">{asset.title || 'Sin titulo'}</p>
                            {asset.friday_concert && (
                              <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 text-[7px] h-4 mt-0.5">
                                <Music className="w-2 h-2 mr-0.5" /> Concierto
                              </Badge>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {asset.category && (
                          <Badge className={cn('text-[8px] uppercase tracking-widest font-bold', CATEGORY_COLORS[asset.category] || 'bg-slate-600 text-white')}>
                            {CATEGORY_LABELS[asset.category] || asset.category}
                          </Badge>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-400">{asset.nivel || '-'}</td>
                      <td className="py-3 px-4 text-xs text-slate-400">{asset.profesor || '-'}</td>
                      <td className="py-3 px-4 text-xs text-slate-400">{asset.sede || '-'}</td>
                      <td className="py-3 px-4 text-right">
                        {displayPrice ? (
                          <span className={cn('text-xs font-bold', presaleActive && asset.presale_price ? 'text-amber-400' : 'text-slate-300')}>
                            {formatPrice(displayPrice)}
                            {presaleActive && asset.presale_price && <span className="text-amber-600 font-normal text-[9px] ml-1">preventa</span>}
                          </span>
                        ) : <span className="text-xs text-slate-600">-</span>}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Badge variant="outline" className={cn('text-[9px] font-bold', enrolled > 0 ? 'border-indigo-500/50 text-indigo-400' : 'border-slate-700 text-slate-600')}>
                          {enrolled}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Catalog Config Section (existing functionality, collapsible) */}
        <Collapsible open={configOpen} onOpenChange={setConfigOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full flex items-center justify-between h-12 px-4 bg-[#0f0f11] border border-[#222225] rounded-xl hover:bg-[#161618] text-slate-400">
              <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest">
                <Settings2 className="w-4 h-4" /> Gestionar Catalogos
              </span>
              <ChevronDown className={cn('w-4 h-4 transition-transform', configOpen && 'rotate-180')} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-4 space-y-4">
            <div className="flex justify-end">
              <Button onClick={handleSaveAll} disabled={saving} className="bg-indigo-600 hover:bg-indigo-500 text-white h-11 px-8 rounded-xl shadow-lg uppercase tracking-widest font-bold text-xs">
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />} Guardar Catalogo
              </Button>
            </div>

            <Tabs defaultValue="cursos" className="w-full">
              <TabsList className="bg-[#121214] border border-[#222225] p-1 rounded-xl flex-wrap h-auto">
                <TabsTrigger value="cursos" className="gap-2 px-6 py-2 text-xs data-[state=active]:bg-indigo-600 data-[state=active]:text-white font-bold uppercase tracking-widest">
                  <GraduationCap className="w-4 h-4" /> Cursos / Talleres
                </TabsTrigger>
                <TabsTrigger value="sedes" className="gap-2 px-6 py-2 text-xs data-[state=active]:bg-emerald-600 data-[state=active]:text-white font-bold uppercase tracking-widest">
                  <MapPin className="w-4 h-4" /> Sedes
                </TabsTrigger>
                <TabsTrigger value="profesores" className="gap-2 px-6 py-2 text-xs data-[state=active]:bg-amber-600 data-[state=active]:text-white font-bold uppercase tracking-widest">
                  <UserCheck className="w-4 h-4" /> Profesores
                </TabsTrigger>
              </TabsList>

              <TabsContent value="cursos" className="mt-6">
                <Card className="bg-[#0f0f11] border-[#222225] shadow-2xl rounded-2xl border-l-4 border-l-indigo-500">
                  <CardHeader className="bg-[#161618] border-b border-[#222225] flex flex-row items-center justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-indigo-400 text-base font-bold">Listado de Cursos</CardTitle>
                      <CardDescription className="text-xs text-slate-400">Oferta educativa disponible.</CardDescription>
                    </div>
                    <Button onClick={() => setCourses([...courses, { id: Date.now().toString(), name: '' }])} variant="outline" className="border-[#333336] bg-[#0a0a0c] hover:text-white rounded-xl h-9 text-[10px] uppercase font-bold tracking-widest">
                      <Plus className="w-4 h-4 mr-2" /> Anadir Curso
                    </Button>
                  </CardHeader>
                  <CardContent className="p-6">
                    {renderList(courses, setCourses, 'Ej: Taller de Sonoterapia Modulo 1')}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="sedes" className="mt-6">
                <Card className="bg-[#0f0f11] border-[#222225] shadow-2xl rounded-2xl border-l-4 border-l-emerald-500">
                  <CardHeader className="bg-[#161618] border-b border-[#222225] flex flex-row items-center justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-emerald-400 text-base font-bold">Listado de Sedes</CardTitle>
                      <CardDescription className="text-xs text-slate-400">Lugares fisicos o virtuales.</CardDescription>
                    </div>
                    <Button onClick={() => setLocations([...locations, { id: Date.now().toString(), name: '' }])} variant="outline" className="border-[#333336] bg-[#0a0a0c] hover:text-white rounded-xl h-9 text-[10px] uppercase font-bold tracking-widest">
                      <Plus className="w-4 h-4 mr-2" /> Anadir Sede
                    </Button>
                  </CardHeader>
                  <CardContent className="p-6">
                    {renderList(locations, setLocations, 'Ej: CDMX - Coyoacan, Online Zoom')}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="profesores" className="mt-6">
                <Card className="bg-[#0f0f11] border-[#222225] shadow-2xl rounded-2xl border-l-4 border-l-amber-500">
                  <CardHeader className="bg-[#161618] border-b border-[#222225] flex flex-row items-center justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-amber-500 text-base font-bold">Plantilla de Profesores</CardTitle>
                      <CardDescription className="text-xs text-slate-400">Maestros que imparten los cursos.</CardDescription>
                    </div>
                    <Button onClick={() => setTeachers([...teachers, { id: Date.now().toString(), name: '' }])} variant="outline" className="border-[#333336] bg-[#0a0a0c] hover:text-white rounded-xl h-9 text-[10px] uppercase font-bold tracking-widest">
                      <Plus className="w-4 h-4 mr-2" /> Anadir Profesor
                    </Button>
                  </CardHeader>
                  <CardContent className="p-6">
                    {renderList(teachers, setTeachers, 'Ej: Maestro Juan Perez')}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </Layout>
  );
};

export default AcademicCatalog;
