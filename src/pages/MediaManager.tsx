import React, { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ImageIcon, FileText, Upload, Trash2, Loader2, Scan, Edit, Sparkles, CheckCircle2, Info, AlertTriangle, CalendarClock } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const CATEGORIES = [
  { value: 'GENERAL', label: 'General' },
  { value: 'PROMOCION', label: 'Promoción' },
  { value: 'AVISO', label: 'Aviso' },
];

const CATEGORY_COLORS: Record<string, string> = {
  GENERAL: 'bg-blue-500 text-white border-blue-400',
  PROMOCION: 'bg-fuchsia-500 text-white border-fuchsia-400',
  AVISO: 'bg-orange-500 text-white border-orange-400',
};

// Campos requeridos por categoría (para guiar el auto-relleno)
const CATEGORY_FIELDS: Record<string, string[]> = {
  GENERAL: ['title', 'description', 'valid_until', 'ai_instructions'],
  PROMOCION: ['title', 'description', 'start_date', 'valid_until', 'ai_instructions'],
  AVISO: ['title', 'description', 'ai_instructions'],
};

const MediaManager = () => {
  const [assets, setAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [scanningId, setScanningId] = useState<string | null>(null);

  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<any>(null);

  // Upload flow state: step 1 = category, step 2 = file upload + OCR, step 3 = review fields
  const [uploadStep, setUploadStep] = useState(1);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');

  // Form fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [instructions, setInstructions] = useState('');
  const [category, setCategory] = useState('GENERAL');
  const [ocrContent, setOcrContent] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [startDate, setStartDate] = useState('');

  // Filter
  const [filterCategory, setFilterCategory] = useState('ALL');

  useEffect(() => { fetchAssets(); }, []);

  const fetchAssets = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('media_assets')
        .select('*')
        .in('category', ['GENERAL', 'PROMOCION', 'AVISO'])
        .order('created_at', { ascending: false });
      if (!error && data) setAssets(data);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (file: File | null) => {
    setSelectedFile(file);
    if (file) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    } else {
      setPreviewUrl('');
    }
  };

  const handleAnalyzeImage = async () => {
    if (!selectedFile) return;
    setAnalyzing(true);
    const tid = toast.loading('Analizando imagen con IA...');

    try {
      // Upload temporarily to get a URL for analysis
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `uploads/${fileName}`;

      const { error: uploadError } = await supabase.storage.from('media').upload(filePath, selectedFile);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(filePath);
      setPreviewUrl(publicUrl);

      // Call AI analysis
      const { data, error } = await supabase.functions.invoke('scrape-website', {
        body: {
          url: publicUrl,
          mode: 'VISION',
          assetCategory: category,
          autoFill: true,
          categoryFields: CATEGORY_FIELDS[category],
        }
      });

      if (error) throw new Error(error.message);
      if (!data || data.success === false) throw new Error(data?.error || 'La IA no pudo procesar la imagen.');

      // Auto-fill fields from AI analysis
      setOcrContent(data.content || '');

      if (data.extracted) {
        if (data.extracted.title && !title) setTitle(data.extracted.title);
        if (data.extracted.description && !description) setDescription(data.extracted.description);
        if (data.extracted.valid_until && !validUntil) setValidUntil(data.extracted.valid_until);
        if (data.extracted.start_date && !startDate) setStartDate(data.extracted.start_date);
        if (data.extracted.ai_instructions && !instructions) setInstructions(data.extracted.ai_instructions);
      }

      toast.success('Análisis completado. Revisa los campos auto-rellenados.', { id: tid });
      setUploadStep(3);
    } catch (err: any) {
      toast.error(err.message, { id: tid });
    } finally {
      setAnalyzing(false);
    }
  };

  const handleScanOcr = async (asset: any) => {
    setScanningId(asset.id);
    const tid = toast.loading('Analizando con IA...');
    try {
      const { data, error } = await supabase.functions.invoke('scrape-website', {
        body: { url: asset.url, mode: 'VISION', assetCategory: asset.category }
      });
      if (error) throw new Error(error.message);
      if (!data || data.success === false) throw new Error(data?.error || 'La IA no pudo procesar la imagen.');

      await supabase.from('media_assets').update({ ocr_content: data.content }).eq('id', asset.id);
      toast.success('Análisis completado e indexado.', { id: tid });
      fetchAssets();
    } catch (err: any) {
      toast.error(err.message, { id: tid });
    } finally {
      setScanningId(null);
    }
  };

  const handleUpload = async () => {
    if (!previewUrl) return;
    setUploading(true);
    try {
      // previewUrl is already a public URL from the analysis step
      let type = 'IMAGE';
      const ext = selectedFile?.name.split('.').pop()?.toLowerCase() || '';
      if (!['jpg', 'jpeg', 'png', 'webp', 'svg'].includes(ext)) type = 'FILE';

      await supabase.from('media_assets').insert({
        title: title || selectedFile?.name || 'Sin título',
        description,
        url: previewUrl,
        type,
        category,
        ai_instructions: instructions || null,
        ocr_content: ocrContent || null,
        valid_until: validUntil || null,
        start_date: startDate || null,
      });

      toast.success('Recurso guardado en la biblioteca.');
      setIsUploadOpen(false);
      resetForms();
      fetchAssets();
    } catch (err: any) {
      toast.error('Error al guardar: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleEdit = (asset: any) => {
    setSelectedAsset(asset);
    setTitle(asset.title || '');
    setDescription(asset.description || '');
    setInstructions(asset.ai_instructions || '');
    setCategory(asset.category || 'GENERAL');
    setOcrContent(asset.ocr_content || '');
    setValidUntil(asset.valid_until || '');
    setStartDate(asset.start_date || '');
    setIsEditOpen(true);
  };

  const handleUpdateAsset = async () => {
    if (!selectedAsset) return;
    setUploading(true);
    try {
      const { error } = await supabase.from('media_assets').update({
        title, description, ai_instructions: instructions || null,
        category, ocr_content: ocrContent,
        valid_until: validUntil || null,
        start_date: startDate || null,
      }).eq('id', selectedAsset.id);

      if (error) throw error;
      toast.success('Información actualizada.');
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
    setPreviewUrl('');
    setTitle('');
    setDescription('');
    setInstructions('');
    setCategory('GENERAL');
    setSelectedAsset(null);
    setOcrContent('');
    setValidUntil('');
    setStartDate('');
    setUploadStep(1);
  };

  const filteredAssets = filterCategory === 'ALL' ? assets : assets.filter(a => a.category === filterCategory);
  const fields = CATEGORY_FIELDS[category] || [];

  const CategoryFieldsForm = ({ isEdit }: { isEdit?: boolean }) => (
    <>
      <div className="space-y-2">
        <Label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Título</Label>
        <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Título del recurso" className="bg-slate-950 border-slate-800 h-11 rounded-xl focus:border-amber-500" required />
      </div>

      <div className="space-y-2">
        <Label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Descripción</Label>
        <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Descripción del contenido..." className="bg-slate-950 border-slate-800 text-xs h-20 rounded-xl focus:border-slate-500 leading-relaxed" />
      </div>

      {fields.includes('start_date') && (
        <div className="space-y-2">
          <Label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest flex items-center gap-1"><CalendarClock className="w-3 h-3 text-emerald-400"/> Fecha Inicio Promoción</Label>
          <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-slate-950 border-slate-800 h-10 rounded-xl focus:border-emerald-500" />
        </div>
      )}

      {fields.includes('valid_until') && (
        <div className="space-y-2">
          <Label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest flex items-center gap-1"><CalendarClock className="w-3 h-3 text-red-400"/> Fecha Finalización</Label>
          <Input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} className="bg-slate-950 border-slate-800 h-10 rounded-xl focus:border-red-500" />
        </div>
      )}

      <div className="space-y-2">
        <Label className="text-[10px] text-indigo-400 uppercase font-bold tracking-widest flex items-center gap-2"><Sparkles className="w-3 h-3"/> Instrucciones IA</Label>
        <Textarea
          value={instructions}
          onChange={e => setInstructions(e.target.value)}
          placeholder="Ej: Enviar cuando el cliente pregunte por promociones vigentes..."
          className="bg-slate-950 border-slate-800 text-xs h-24 focus:border-indigo-500 rounded-xl leading-relaxed"
        />
      </div>

      {isEdit && (
        <div className="space-y-2">
          <Label className="flex items-center gap-2 text-[10px] uppercase font-bold text-slate-400 tracking-widest">Contenido de la Imagen (OCR) <Info className="w-3 h-3 text-slate-500" /></Label>
          <Textarea
            value={ocrContent}
            onChange={e => setOcrContent(e.target.value)}
            placeholder="Contenido detectado..."
            className="bg-[#0D0B0A] border border-slate-800 rounded-xl p-4 text-[10px] text-amber-500/70 font-mono h-28 leading-relaxed custom-scrollbar focus:border-amber-500/50"
          />
        </div>
      )}
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
            <p className="text-slate-400 text-sm mt-1">Biblioteca visual: General, Promociones y Avisos.</p>
          </div>
          <div className="flex gap-3">
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="bg-slate-900 border-slate-800 rounded-xl h-11 w-44 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-slate-900 text-slate-100 rounded-xl border-slate-800">
                <SelectItem value="ALL">Todas las categorías</SelectItem>
                {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button className="bg-indigo-900 hover:bg-indigo-800 text-amber-500 shadow-lg h-11 px-6 rounded-xl font-bold uppercase tracking-widest text-xs" onClick={() => { resetForms(); setIsUploadOpen(true); }}>
              <Upload className="w-4 h-4 mr-2" /> Nuevo Recurso
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mt-8">
          {loading ? (
            <div className="col-span-full flex flex-col items-center justify-center py-20 text-slate-500"><Loader2 className="w-10 h-10 animate-spin mb-2 text-amber-500" /></div>
          ) : filteredAssets.length === 0 ? (
            <div className="col-span-full py-20 text-center border-2 border-dashed border-slate-800 rounded-2xl text-slate-500">
              <p className="uppercase tracking-widest font-bold text-[10px]">No hay archivos en esta categoría.</p>
            </div>
          ) : filteredAssets.map((asset) => (
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
                      {scanningId === asset.id ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Scan className="w-4 h-4 mr-2" />} RE-ANALIZAR OCR
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
                  <Badge className={cn("text-[9px] uppercase tracking-widest font-bold shadow-lg", CATEGORY_COLORS[asset.category] || CATEGORY_COLORS.GENERAL)}>
                    {CATEGORIES.find(c => c.value === asset.category)?.label || asset.category}
                  </Badge>
                  {asset.ocr_content && <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[8px] h-5 shadow-lg"><CheckCircle2 className="w-2.5 h-2.5 mr-1"/> OCR</Badge>}
                </div>
              </div>

              <div className="p-5 space-y-3">
                <p className="text-sm font-bold text-slate-100 truncate">{asset.title}</p>

                {asset.description && (
                  <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">{asset.description}</p>
                )}

                {asset.valid_until && (
                  <div className="text-[9px] text-amber-400/80 flex items-center gap-1">
                    <CalendarClock className="w-3 h-3"/> Vigente hasta: {new Date(asset.valid_until + 'T00:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
                )}

                {asset.start_date && (
                  <div className="text-[9px] text-emerald-400/80 flex items-center gap-1">
                    <CalendarClock className="w-3 h-3"/> Inicia: {new Date(asset.start_date + 'T00:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
                )}

                {!asset.ai_instructions ? (
                  <div className="p-3 bg-red-900/20 border border-red-900/50 rounded-xl flex items-center gap-2 text-red-400">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    <span className="text-[9px] font-bold uppercase tracking-widest leading-tight">SIN INSTRUCCIÓN<br/>(IA NO LO USARÁ)</span>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <p className="text-[9px] text-slate-500 uppercase font-bold flex items-center gap-1.5 tracking-widest">
                      <Sparkles className="w-3 h-3 text-amber-500" /> Trigger IA:
                    </p>
                    <p className="text-[11px] text-slate-400 italic line-clamp-3 leading-relaxed">
                      {asset.ai_instructions}
                    </p>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Upload Dialog — 3-step wizard */}
      <Dialog open={isUploadOpen} onOpenChange={(open) => { if (!open) resetForms(); setIsUploadOpen(open); }}>
        <DialogContent className="bg-slate-900 border-slate-800 text-slate-100 max-w-lg rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-sm uppercase tracking-widest text-amber-500 font-bold flex items-center gap-2">
              <Upload className="w-4 h-4"/>
              {uploadStep === 1 && 'Paso 1: Seleccionar Categoría'}
              {uploadStep === 2 && 'Paso 2: Subir Imagen'}
              {uploadStep === 3 && 'Paso 3: Revisar y Completar'}
            </DialogTitle>
          </DialogHeader>

          {uploadStep === 1 && (
            <div className="space-y-6 pt-4">
              <p className="text-xs text-slate-400">Selecciona la categoría del recurso que vas a subir.</p>
              <div className="grid grid-cols-1 gap-3">
                {CATEGORIES.map(c => (
                  <Button key={c.value} variant="outline" onClick={() => { setCategory(c.value); setUploadStep(2); }}
                    className={cn("h-16 rounded-xl border-2 text-left justify-start px-6 transition-all",
                      category === c.value ? "border-amber-500 bg-amber-500/10" : "border-slate-700 bg-slate-950 hover:border-slate-500"
                    )}>
                    <Badge className={cn("text-[10px] uppercase tracking-widest font-bold mr-3", CATEGORY_COLORS[c.value])}>{c.label}</Badge>
                    <span className="text-[10px] text-slate-400">
                      {c.value === 'GENERAL' && 'Contenido general con fecha de vigencia'}
                      {c.value === 'PROMOCION' && 'Promociones con fechas de inicio y fin'}
                      {c.value === 'AVISO' && 'Avisos e información permanente'}
                    </span>
                  </Button>
                ))}
              </div>
            </div>
          )}

          {uploadStep === 2 && (
            <div className="space-y-6 pt-4">
              <p className="text-xs text-slate-400">Sube la imagen. Se analizará automáticamente con IA para extraer información.</p>

              {previewUrl ? (
                <div className="relative rounded-xl overflow-hidden border border-slate-700">
                  <img src={previewUrl} className="w-full max-h-64 object-contain bg-black" alt="Preview" />
                  <Button variant="ghost" size="sm" className="absolute top-2 right-2 bg-black/60 text-white h-8 rounded-lg text-[10px]" onClick={() => { handleFileSelect(null); setPreviewUrl(''); }}>
                    Cambiar
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Input type="file" onChange={e => handleFileSelect(e.target.files?.[0] || null)}
                    className="bg-slate-950 border-slate-800 rounded-xl file:text-amber-500 file:font-bold file:mr-4 file:bg-slate-900 file:border-0 file:rounded-md cursor-pointer"
                    accept="image/*" />
                </div>
              )}

              <div className="flex gap-3">
                <Button variant="ghost" onClick={() => setUploadStep(1)} className="rounded-xl">Atrás</Button>
                <Button className="flex-1 bg-amber-600 hover:bg-amber-500 text-slate-950 h-12 rounded-xl font-bold uppercase tracking-widest text-[10px]"
                  onClick={handleAnalyzeImage} disabled={!selectedFile || analyzing}>
                  {analyzing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Scan className="w-4 h-4 mr-2" />}
                  Analizar con IA y Continuar
                </Button>
              </div>
            </div>
          )}

          {uploadStep === 3 && (
            <div className="space-y-4 pt-4">
              {previewUrl && (
                <div className="rounded-xl overflow-hidden border border-slate-700 mb-4">
                  <img src={previewUrl} className="w-full max-h-40 object-contain bg-black" alt="Preview" />
                </div>
              )}

              <Badge className={cn("text-[10px] uppercase tracking-widest font-bold", CATEGORY_COLORS[category])}>
                {CATEGORIES.find(c => c.value === category)?.label}
              </Badge>

              <CategoryFieldsForm />

              {ocrContent && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-[10px] uppercase font-bold text-slate-400 tracking-widest">
                    Texto detectado (OCR) <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  </Label>
                  <div className="bg-[#0D0B0A] border border-slate-800 rounded-xl p-4 text-[10px] text-amber-500/70 font-mono max-h-28 overflow-y-auto leading-relaxed">
                    {ocrContent}
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <Button variant="ghost" onClick={() => setUploadStep(2)} className="rounded-xl">Atrás</Button>
                <Button className="flex-1 bg-indigo-900 hover:bg-indigo-800 text-amber-500 h-12 rounded-xl shadow-lg uppercase font-bold tracking-widest text-[10px]"
                  onClick={handleUpload} disabled={uploading || !title}>
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                  Guardar en Biblioteca
                </Button>
              </div>
            </div>
          )}
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
            <CategoryFieldsForm isEdit />
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
