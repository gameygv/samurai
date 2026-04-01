import React, { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ImageIcon, FileText, Upload, Trash2, Loader2, Scan, Edit, Sparkles, CheckCircle2, CreditCard, Info, AlertTriangle, Music, CalendarClock, DollarSign, GraduationCap, MapPin, User } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const CATEGORIES = [
  { value: 'POSTER_PROMO', label: 'Poster Promocional' },
  { value: 'CARTEL_GENERAL', label: 'Cartel General' },
  { value: 'PROMO_ESPECIAL', label: 'Promoción Especial' },
  { value: 'AVISO', label: 'Aviso' },
  { value: 'PAYMENT', label: 'Comprobante / Recibo (Auditoría)' },
];

const CATEGORY_COLORS: Record<string, string> = {
  POSTER_PROMO: 'bg-amber-500 text-slate-950 border-amber-400',
  CARTEL_GENERAL: 'bg-blue-500 text-white border-blue-400',
  PROMO_ESPECIAL: 'bg-fuchsia-500 text-white border-fuchsia-400',
  AVISO: 'bg-orange-500 text-white border-orange-400',
  PAYMENT: 'bg-indigo-600 text-white border-indigo-500',
};

const MediaManager = () => {
  const [assets, setAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [scanningId, setScanningId] = useState<string | null>(null);

  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<any>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [instructions, setInstructions] = useState('');
  const [category, setCategory] = useState('POSTER_PROMO');
  const [ocrContent, setOcrContent] = useState('');
  const [presalePrice, setPresalePrice] = useState('');
  const [presaleEndsAt, setPresaleEndsAt] = useState('');
  const [normalPrice, setNormalPrice] = useState('');
  const [nivel, setNivel] = useState('');
  const [profesor, setProfesor] = useState('');
  const [sede, setSede] = useState('');
  const [fridayConcert, setFridayConcert] = useState(false);
  const [validUntil, setValidUntil] = useState('');

  // Data from app_config for selectors
  const [niveles, setNiveles] = useState<any[]>([]);
  const [profesores, setProfesores] = useState<any[]>([]);
  const [sedes, setSedes] = useState<any[]>([]);

  useEffect(() => {
    fetchAssets();
    fetchConfigOptions();
  }, []);

  const fetchAssets = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('media_assets')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error && data) setAssets(data);
    } finally {
      setLoading(false);
    }
  };

  const fetchConfigOptions = async () => {
    const { data: configs } = await supabase.from('app_config').select('key, value').in('key', ['academic_courses', 'academic_teachers', 'academic_locations']);
    if (!configs) return;
    const getVal = (key: string) => {
      const raw = configs.find(c => c.key === key)?.value;
      if (!raw) return [];
      try { return JSON.parse(raw); } catch { return []; }
    };
    setNiveles(getVal('academic_courses'));
    setProfesores(getVal('academic_teachers'));
    setSedes(getVal('academic_locations'));
  };

  const handleScanOcr = async (asset: any) => {
     setScanningId(asset.id);
     const tid = toast.loading(`Analizando con IA (${asset.category === 'PAYMENT' ? 'Ojo de Halcón' : 'Modo Póster'})...`);

     try {
        const { data, error } = await supabase.functions.invoke('scrape-website', {
           body: { url: asset.url, mode: 'VISION', assetCategory: asset.category }
        });

        if (error) throw new Error(error.message);
        if (!data || data.success === false) throw new Error(data?.error || "La IA no pudo procesar la imagen.");

        const detectedText = data.content;

        const { error: updateErr } = await supabase
           .from('media_assets')
           .update({ ocr_content: detectedText })
           .eq('id', asset.id);

        if (updateErr) throw updateErr;

        toast.success("Análisis completado e indexado.", { id: tid });
        fetchAssets();
     } catch (err: any) {
        toast.error(`${err.message}`, { id: tid });
     } finally {
        setScanningId(null);
     }
  };

  const isEventCategory = (cat: string) => cat !== 'PAYMENT';

  const buildPayload = () => ({
    title: title || undefined,
    ai_instructions: instructions || null,
    category,
    presale_price: presalePrice ? parseFloat(presalePrice) : null,
    presale_ends_at: presaleEndsAt || null,
    normal_price: normalPrice ? parseFloat(normalPrice) : null,
    nivel: nivel || null,
    profesor: profesor || null,
    sede: sede || null,
    friday_concert: fridayConcert,
    valid_until: validUntil || null,
  });

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;
    setUploading(true);
    try {
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `uploads/${fileName}`;

      const { error: uploadError } = await supabase.storage.from('media').upload(filePath, selectedFile);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(filePath);

      let type = 'FILE';
      if (['jpg', 'jpeg', 'png', 'webp', 'svg'].includes(fileExt?.toLowerCase() || '')) type = 'IMAGE';

      const payload = buildPayload();
      await supabase.from('media_assets').insert({
        ...payload,
        title: title || selectedFile.name,
        url: publicUrl,
        type,
      });

      toast.success('Asset guardado en la biblioteca.');
      setIsUploadOpen(false);
      resetForms();
      fetchAssets();
    } catch (err: any) {
       toast.error("Error al subir: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleEdit = (asset: any) => {
     setSelectedAsset(asset);
     setTitle(asset.title || '');
     setInstructions(asset.ai_instructions || '');
     setCategory(asset.category || 'POSTER_PROMO');
     setOcrContent(asset.ocr_content || '');
     setPresalePrice(asset.presale_price?.toString() || '');
     setPresaleEndsAt(asset.presale_ends_at || '');
     setNormalPrice(asset.normal_price?.toString() || '');
     setNivel(asset.nivel || '');
     setProfesor(asset.profesor || '');
     setSede(asset.sede || '');
     setFridayConcert(asset.friday_concert || false);
     setValidUntil(asset.valid_until || '');
     setIsEditOpen(true);
  };

  const handleUpdateAsset = async () => {
     if (!selectedAsset) return;
     setUploading(true);
     try {
        const payload = buildPayload();
        const { error } = await supabase
           .from('media_assets')
           .update({ ...payload, ocr_content: ocrContent })
           .eq('id', selectedAsset.id);

        if (error) throw error;
        toast.success("Información actualizada.");
        setIsEditOpen(false);
        fetchAssets();
     } catch (err: any) {
        toast.error(err.message);
     } finally {
        setUploading(false);
     }
  };

  const resetForms = () => {
     setSelectedFile(null);
     setTitle('');
     setInstructions('');
     setCategory('POSTER_PROMO');
     setSelectedAsset(null);
     setOcrContent('');
     setPresalePrice('');
     setPresaleEndsAt('');
     setNormalPrice('');
     setNivel('');
     setProfesor('');
     setSede('');
     setFridayConcert(false);
     setValidUntil('');
  };

  const EventFields = () => (
    <>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest flex items-center gap-1"><DollarSign className="w-3 h-3 text-emerald-400"/> Precio Preventa</Label>
          <Input type="number" value={presalePrice} onChange={e => setPresalePrice(e.target.value)} placeholder="1500" className="bg-slate-950 border-slate-800 h-10 rounded-xl focus:border-emerald-500" />
        </div>
        <div className="space-y-2">
          <Label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest flex items-center gap-1"><CalendarClock className="w-3 h-3 text-amber-400"/> Fin Preventa</Label>
          <Input type="date" value={presaleEndsAt} onChange={e => setPresaleEndsAt(e.target.value)} className="bg-slate-950 border-slate-800 h-10 rounded-xl focus:border-amber-500" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest flex items-center gap-1"><DollarSign className="w-3 h-3 text-slate-400"/> Precio Normal</Label>
          <Input type="number" value={normalPrice} onChange={e => setNormalPrice(e.target.value)} placeholder="2000" className="bg-slate-950 border-slate-800 h-10 rounded-xl focus:border-slate-500" />
        </div>
        <div className="space-y-2">
          <Label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest flex items-center gap-1"><CalendarClock className="w-3 h-3 text-red-400"/> Fecha Finalización</Label>
          <Input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} className="bg-slate-950 border-slate-800 h-10 rounded-xl focus:border-red-500" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-2">
          <Label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest flex items-center gap-1"><GraduationCap className="w-3 h-3 text-amber-400"/> Nivel</Label>
          <Select value={nivel} onValueChange={setNivel}>
            <SelectTrigger className="bg-slate-950 border-slate-800 rounded-xl h-10 text-xs"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
            <SelectContent className="bg-slate-900 text-slate-100 rounded-xl border-slate-800">
              <SelectItem value="">Sin nivel</SelectItem>
              {niveles.map((n: any) => <SelectItem key={n.id} value={n.name}>{n.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest flex items-center gap-1"><User className="w-3 h-3 text-blue-400"/> Profesor</Label>
          <Select value={profesor} onValueChange={setProfesor}>
            <SelectTrigger className="bg-slate-950 border-slate-800 rounded-xl h-10 text-xs"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
            <SelectContent className="bg-slate-900 text-slate-100 rounded-xl border-slate-800">
              <SelectItem value="">Sin profesor</SelectItem>
              {profesores.filter((p: any) => p.name?.trim()).map((p: any) => <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest flex items-center gap-1"><MapPin className="w-3 h-3 text-red-400"/> Sede</Label>
          <Select value={sede} onValueChange={setSede}>
            <SelectTrigger className="bg-slate-950 border-slate-800 rounded-xl h-10 text-xs"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
            <SelectContent className="bg-slate-900 text-slate-100 rounded-xl border-slate-800">
              <SelectItem value="">Sin sede</SelectItem>
              {sedes.map((s: any) => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex items-center justify-between p-3 bg-slate-950 border border-slate-800 rounded-xl">
        <Label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest flex items-center gap-2"><Music className="w-3.5 h-3.5 text-purple-400"/> Concierto del Viernes</Label>
        <Switch checked={fridayConcert} onCheckedChange={setFridayConcert} />
      </div>
    </>
  );

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-6 pb-12">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-50 flex items-center gap-3 tracking-tight">
               <div className="p-2 bg-indigo-900/30 rounded-xl border border-indigo-900/50">
                  <ImageIcon className="w-6 h-6 text-amber-500" />
               </div>
               Media Manager
            </h1>
            <p className="text-slate-400 text-sm mt-1">Biblioteca visual para Posters, Carteles, Promociones y Auditoría de Pagos.</p>
          </div>
          <Button className="bg-indigo-900 hover:bg-indigo-800 text-amber-500 shadow-lg h-11 px-6 rounded-xl font-bold uppercase tracking-widest text-xs" onClick={() => { resetForms(); setIsUploadOpen(true); }}>
             <Upload className="w-4 h-4 mr-2" /> Subir Archivo
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mt-8">
          {loading ? (
             <div className="col-span-full flex flex-col items-center justify-center py-20 text-slate-500"><Loader2 className="w-10 h-10 animate-spin mb-2 text-amber-500" /></div>
          ) : assets.length === 0 ? (
             <div className="col-span-full py-20 text-center border-2 border-dashed border-slate-800 rounded-2xl text-slate-500">
                <p className="uppercase tracking-widest font-bold text-[10px]">No hay archivos en la biblioteca.</p>
             </div>
          ) : assets.map((asset) => (
            <Card key={asset.id} className="bg-slate-900 border-slate-800 overflow-hidden group hover:border-indigo-500/50 transition-all shadow-xl rounded-2xl">
              <div className="aspect-[4/5] bg-black relative border-b border-slate-800">
                 {asset.type === 'IMAGE' ? (
                    <img src={asset.url} className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity" alt={asset.title} />
                 ) : (
                    <div className="w-full h-full flex items-center justify-center bg-slate-900"><FileText className="w-12 h-12 text-slate-700" /></div>
                 )}

                 <div className="absolute inset-0 bg-black/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-all flex flex-col items-center justify-center gap-3 p-6">
                    {asset.type === 'IMAGE' && (
                       <Button size="sm" className="w-full bg-amber-600 hover:bg-amber-500 text-slate-950 h-10 text-[10px] font-bold uppercase tracking-widest rounded-xl" onClick={() => handleScanOcr(asset)} disabled={scanningId === asset.id}>
                          {scanningId === asset.id ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Scan className="w-4 h-4 mr-2" />} ANALIZAR OCR
                       </Button>
                    )}
                    <div className="flex gap-2 w-full">
                       <Button variant="secondary" size="sm" className="flex-1 h-9 text-[10px] bg-slate-800 text-slate-200 hover:bg-slate-700 rounded-xl uppercase font-bold tracking-widest" onClick={() => handleEdit(asset)}>EDITAR</Button>
                       <Button variant="destructive" size="sm" className="h-9 w-10 p-0 rounded-xl bg-red-900/50 text-red-400 hover:bg-red-600 hover:text-white" onClick={async () => {
                          if (confirm('¿Eliminar de la biblioteca?')) {
                             await supabase.from('media_assets').delete().eq('id', asset.id);
                             fetchAssets();
                          }
                       }}><Trash2 className="w-4 h-4" /></Button>
                    </div>
                 </div>

                 <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
                    <Badge className={cn(
                       "text-[9px] uppercase tracking-widest font-bold shadow-lg",
                       CATEGORY_COLORS[asset.category] || CATEGORY_COLORS.POSTER_PROMO
                    )}>
                       {CATEGORIES.find(c => c.value === asset.category)?.label || asset.category}
                    </Badge>
                    {asset.friday_concert && <Badge className="bg-purple-500/90 text-white border-purple-400 text-[8px] h-5 shadow-lg"><Music className="w-2.5 h-2.5 mr-1"/> Concierto</Badge>}
                    {asset.ocr_content && <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[8px] h-5 shadow-lg"><CheckCircle2 className="w-2.5 h-2.5 mr-1"/> OCR</Badge>}
                 </div>
              </div>

              <div className="p-5 space-y-3">
                 <p className="text-sm font-bold text-slate-100 truncate">{asset.title}</p>

                 {/* Meta info pills */}
                 {isEventCategory(asset.category) && (asset.sede || asset.nivel || asset.profesor) && (
                   <div className="flex flex-wrap gap-1.5">
                     {asset.sede && <Badge variant="outline" className="text-[8px] border-slate-700 text-slate-400"><MapPin className="w-2.5 h-2.5 mr-1"/>{asset.sede}</Badge>}
                     {asset.nivel && <Badge variant="outline" className="text-[8px] border-slate-700 text-slate-400"><GraduationCap className="w-2.5 h-2.5 mr-1"/>{asset.nivel}</Badge>}
                     {asset.profesor && <Badge variant="outline" className="text-[8px] border-slate-700 text-slate-400"><User className="w-2.5 h-2.5 mr-1"/>{asset.profesor}</Badge>}
                   </div>
                 )}

                 {/* Prices */}
                 {isEventCategory(asset.category) && (asset.presale_price || asset.normal_price) && (
                   <div className="flex gap-3 text-[10px]">
                     {asset.presale_price && (
                       <span className="text-emerald-400 font-bold">
                         ${asset.presale_price.toLocaleString()} <span className="text-emerald-600 font-normal">preventa</span>
                       </span>
                     )}
                     {asset.normal_price && (
                       <span className="text-slate-500">
                         ${asset.normal_price.toLocaleString()} normal
                       </span>
                     )}
                   </div>
                 )}

                 {/* Presale deadline */}
                 {asset.presale_ends_at && (
                   <div className="text-[9px] text-amber-400/80 flex items-center gap-1">
                     <CalendarClock className="w-3 h-3"/> Preventa hasta: {new Date(asset.presale_ends_at + 'T00:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
                   </div>
                 )}

                 {!asset.ai_instructions && asset.category !== 'PAYMENT' ? (
                    <div className="p-3 bg-red-900/20 border border-red-900/50 rounded-xl flex items-center gap-2 text-red-400">
                        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                        <span className="text-[9px] font-bold uppercase tracking-widest leading-tight">SIN INSTRUCCIÓN<br/>(IA NO LO USARÁ)</span>
                    </div>
                 ) : (
                    <div className="space-y-1.5">
                        <p className="text-[9px] text-slate-500 uppercase font-bold flex items-center gap-1.5 tracking-widest">
                        {asset.category === 'PAYMENT' ? <CreditCard className="w-3 h-3 text-indigo-400" /> : <Sparkles className="w-3 h-3 text-amber-500" />}
                        {asset.category === 'PAYMENT' ? 'Regla de Auditoría:' : 'Trigger IA:'}
                        </p>
                        <p className="text-[11px] text-slate-400 italic line-clamp-3 leading-relaxed">
                        {asset.ai_instructions || 'Sin configuración manual.'}
                        </p>
                    </div>
                 )}
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Upload Dialog */}
      <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 text-slate-100 max-w-lg rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
             <DialogTitle className="text-sm uppercase tracking-widest text-amber-500 font-bold flex items-center gap-2"><Upload className="w-4 h-4"/> Añadir a Biblioteca</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpload} className="space-y-4 pt-4">
             <div className="space-y-2">
                <Label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Categoría</Label>
                <Select value={category} onValueChange={setCategory}>
                   <SelectTrigger className="bg-slate-950 border-slate-800 rounded-xl h-11"><SelectValue /></SelectTrigger>
                   <SelectContent className="bg-slate-900 text-slate-100 rounded-xl border-slate-800">
                      {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                   </SelectContent>
                </Select>
             </div>
             <div className="space-y-2">
                <Label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Archivo</Label>
                <Input type="file" onChange={e => setSelectedFile(e.target.files?.[0] || null)} className="bg-slate-950 border-slate-800 rounded-xl file:text-amber-500 file:font-bold file:mr-4 file:bg-slate-900 file:border-0 file:rounded-md cursor-pointer" accept="image/*,.pdf" />
             </div>
             <div className="space-y-2">
                <Label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Título</Label>
                <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ej: Taller Torreón Abril" className="bg-slate-950 border-slate-800 h-11 rounded-xl focus:border-amber-500" required />
             </div>

             {isEventCategory(category) && <EventFields />}

             <div className="space-y-2">
                <Label className="text-[10px] text-indigo-400 uppercase font-bold tracking-widest flex items-center gap-2"><Sparkles className="w-3 h-3"/> {category === 'PAYMENT' ? 'Reglas de Validación' : 'Instrucciones IA'}</Label>
                <Textarea
                   value={instructions}
                   onChange={e => setInstructions(e.target.value)}
                   placeholder={category === 'PAYMENT' ? "Ej: Validar que sea un depósito de $1500..." : "Ej: Enviar cuando el cliente diga que es de TORREÓN..."}
                   className="bg-slate-950 border-slate-800 text-xs h-24 focus:border-indigo-500 rounded-xl leading-relaxed"
                   required
                />
             </div>
             <Button type="submit" className="w-full bg-indigo-900 hover:bg-indigo-800 text-amber-500 h-12 rounded-xl shadow-lg uppercase font-bold tracking-widest text-[10px]" disabled={uploading || !selectedFile}>
                {uploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />} Subir e Indexar
             </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 text-slate-100 max-w-lg rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="text-sm uppercase tracking-widest text-amber-500 font-bold">Editar Recurso</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-4">
             <div className="space-y-2">
                <Label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Categoría</Label>
                <Select value={category} onValueChange={setCategory}>
                   <SelectTrigger className="bg-slate-950 border-slate-800 rounded-xl h-11"><SelectValue /></SelectTrigger>
                   <SelectContent className="bg-slate-900 text-slate-100 rounded-xl border-slate-800">
                      {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                   </SelectContent>
                </Select>
             </div>
             <div className="space-y-2">
                <Label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Título</Label>
                <Input value={title} onChange={e => setTitle(e.target.value)} className="bg-slate-950 border-slate-800 h-11 rounded-xl focus:border-amber-500" />
             </div>

             {isEventCategory(category) && <EventFields />}

             <div className="space-y-2">
                <Label className="text-[10px] uppercase font-bold text-indigo-400 tracking-widest">Instrucciones IA</Label>
                <Textarea value={instructions} onChange={e => setInstructions(e.target.value)} className="bg-slate-950 border-slate-800 text-xs h-24 rounded-xl focus:border-indigo-500" />
             </div>
             <div className="space-y-2">
                <Label className="flex items-center gap-2 text-[10px] uppercase font-bold text-slate-400 tracking-widest">Contenido de la Imagen (OCR) <Info className="w-3 h-3 text-slate-500" /></Label>
                <Textarea
                    value={ocrContent}
                    onChange={e => setOcrContent(e.target.value)}
                    placeholder="Contenido detectado..."
                    className="bg-[#0D0B0A] border border-slate-800 rounded-xl p-4 text-[10px] text-amber-500/70 font-mono h-28 leading-relaxed custom-scrollbar focus:border-amber-500/50"
                />
             </div>
          </div>
          <DialogFooter className="mt-4">
             <Button variant="ghost" onClick={() => setIsEditOpen(false)} className="rounded-xl">Cancelar</Button>
             <Button className="bg-indigo-900 hover:bg-indigo-800 text-amber-500 rounded-xl uppercase font-bold tracking-widest text-[10px] shadow-lg" onClick={handleUpdateAsset} disabled={uploading}>
                Guardar Cambios
             </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default MediaManager;
