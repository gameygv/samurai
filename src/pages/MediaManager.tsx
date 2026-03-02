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
import { ImageIcon, FileText, Upload, Trash2, Loader2, Scan, Edit, Sparkles, CheckCircle2, CreditCard, Info } from 'lucide-react';
import { toast } from 'sonner';

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
  const [category, setCategory] = useState('POSTER');

  useEffect(() => {
    fetchAssets();
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

  const handleScanOcr = async (asset: any) => {
     setScanningId(asset.id);
     const tid = toast.loading("Samurai analizando información visual...");
     
     try {
        const { data, error } = await supabase.functions.invoke('scrape-website', {
           body: { url: asset.url, mode: 'VISION' }
        });

        if (error) throw new Error(error.message || "Error de conexión con Edge Function");
        if (!data.success) throw new Error(data.error || "Fallo en el procesamiento de imagen");
        
        const detectedText = data.content;

        const { error: updateErr } = await supabase
           .from('media_assets')
           .update({ ocr_content: detectedText })
           .eq('id', asset.id);

        if (updateErr) throw updateErr;

        toast.success("Imagen indexada correctamente en el cerebro.", { id: tid });
        fetchAssets();
     } catch (err: any) {
        console.error("OCR Error:", err);
        toast.error(`Fallo al leer imagen: ${err.message}`, { id: tid });
     } finally {
        setScanningId(null);
     }
  };

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

      await supabase.from('media_assets').insert({
        title: title || selectedFile.name,
        url: publicUrl,
        type,
        ai_instructions: instructions || null,
        category: category // Asegurando que use la categoría seleccionada
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
     setCategory(asset.category || 'POSTER');
     setIsEditOpen(true);
  };

  const handleUpdateAsset = async () => {
     if (!selectedAsset) return;
     setUploading(true);
     try {
        const { error } = await supabase
           .from('media_assets')
           .update({
              title,
              ai_instructions: instructions,
              category
           })
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
     setCategory('POSTER');
     setSelectedAsset(null);
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-6 pb-12">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-2">
               <ImageIcon className="w-8 h-8 text-indigo-500" /> Media Manager
            </h1>
            <p className="text-slate-400 text-sm">Biblioteca visual para Posters (Layer 4). Samurai leerá estos archivos para dar contexto al cliente.</p>
          </div>
          <Button className="bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-900/20" onClick={() => { resetForms(); setIsUploadOpen(true); }}>
             <Upload className="w-4 h-4 mr-2" /> Subir Poster/Archivo
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {loading ? (
             <div className="col-span-full flex flex-col items-center justify-center py-20 text-slate-500"><Loader2 className="w-10 h-10 animate-spin mb-2" /></div>
          ) : assets.length === 0 ? (
             <div className="col-span-full py-20 text-center border-2 border-dashed border-slate-800 rounded-2xl text-slate-500">
                <p>No hay archivos en la biblioteca.</p>
             </div>
          ) : assets.map((asset) => (
            <Card key={asset.id} className="bg-slate-900 border-slate-800 overflow-hidden group hover:border-indigo-500/50 transition-all shadow-xl">
              <div className="aspect-video bg-slate-950 relative border-b border-slate-800">
                 {asset.type === 'IMAGE' ? (
                    <img src={asset.url} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" alt={asset.title} />
                 ) : (
                    <div className="w-full h-full flex items-center justify-center bg-slate-800/50"><FileText className="w-12 h-12 text-slate-600" /></div>
                 )}
                 
                 <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-all flex flex-col items-center justify-center gap-2 p-4">
                    {asset.type === 'IMAGE' && (
                       <Button size="sm" className="w-full bg-indigo-600 h-8 text-[10px] font-bold" onClick={() => handleScanOcr(asset)} disabled={scanningId === asset.id}>
                          {scanningId === asset.id ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <Scan className="w-3 h-3 mr-2" />} ANALIZAR OCR
                       </Button>
                    )}
                    <div className="flex gap-2 w-full">
                       <Button variant="secondary" size="sm" className="flex-1 h-8 text-[10px]" onClick={() => handleEdit(asset)}><Edit className="w-3 h-3 mr-1" /> EDITAR</Button>
                       <Button variant="destructive" size="sm" className="h-8 w-8 p-0" onClick={async () => {
                          if (confirm('¿Eliminar de la biblioteca?')) {
                             await supabase.from('media_assets').delete().eq('id', asset.id);
                             fetchAssets();
                          }
                       }}><Trash2 className="w-3 h-3" /></Button>
                    </div>
                 </div>
                 
                 <div className="absolute top-2 left-2 flex gap-1">
                    <Badge className={asset.category === 'PAYMENT' ? 'bg-orange-600' : 'bg-indigo-600'}>
                       {asset.category === 'PAYMENT' ? 'PAGO' : 'POSTER'}
                    </Badge>
                    {asset.ocr_content && <Badge className="bg-green-600 text-[8px] h-4">LECTURA OK</Badge>}
                 </div>
              </div>
              
              <div className="p-4 space-y-3">
                 <p className="text-xs font-bold text-white truncate">{asset.title}</p>
                 <div className="space-y-1">
                    <p className="text-[9px] text-slate-500 uppercase font-bold flex items-center gap-1">
                       {asset.category === 'PAYMENT' ? <CreditCard className="w-2 h-2 text-orange-400" /> : <Sparkles className="w-2 h-2 text-yellow-500" />} 
                       {asset.category === 'PAYMENT' ? 'Auditoría Pago:' : 'Trigger Envío:'}
                    </p>
                    <p className="text-[10px] text-slate-400 italic line-clamp-2 leading-relaxed h-8">
                       {asset.ai_instructions || "Sin instrucciones de envío."}
                    </p>
                 </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
      
      {/* Upload Dialog */}
      <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-lg">
          <DialogHeader><DialogTitle>Nuevo Recurso Visual</DialogTitle></DialogHeader>
          <form onSubmit={handleUpload} className="space-y-4 pt-4">
             <div className="space-y-2">
                <Label>Categoría</Label>
                <Select value={category} onValueChange={setCategory}>
                   <SelectTrigger className="bg-slate-950 border-slate-800"><SelectValue /></SelectTrigger>
                   <SelectContent className="bg-slate-900 text-white">
                      <SelectItem value="POSTER">Poster Promocional (Ventas)</SelectItem>
                      <SelectItem value="PAYMENT">Comprobante / Recibo (Pagos)</SelectItem>
                   </SelectContent>
                </Select>
             </div>
             <div className="space-y-2">
                <Label>Archivo</Label>
                <Input type="file" onChange={e => setSelectedFile(e.target.files?.[0] || null)} className="bg-slate-950 border-slate-800" accept="image/*,.pdf" />
             </div>
             <div className="space-y-2">
                <Label>Título Identificativo</Label>
                <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ej: Taller Torreón Marzo" className="bg-slate-950 border-slate-800" required />
             </div>
             <div className="space-y-2">
                <Label>{category === 'POSTER' ? 'Instrucciones para Samurai (Trigger)' : 'Reglas de Validación'}</Label>
                <Textarea 
                   value={instructions} 
                   onChange={e => setInstructions(e.target.value)} 
                   placeholder={category === 'POSTER' ? "Ej: Enviar cuando pregunten fechas para Torreón..." : "Ej: Validar que sea un depósito de $1500..."}
                   className="bg-slate-950 border-slate-800 text-xs h-24" 
                />
             </div>
             <Button type="submit" className="w-full bg-indigo-600" disabled={uploading || !selectedFile}>
                {uploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />} Guardar en Biblioteca
             </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-lg">
          <DialogHeader><DialogTitle>Editar Recurso</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-4">
             <div className="space-y-2">
                <Label>Categoría</Label>
                <Select value={category} onValueChange={setCategory}>
                   <SelectTrigger className="bg-slate-950 border-slate-800"><SelectValue /></SelectTrigger>
                   <SelectContent className="bg-slate-900 text-white">
                      <SelectItem value="POSTER">Poster Promocional</SelectItem>
                      <SelectItem value="PAYMENT">Comprobante / Recibo</SelectItem>
                   </SelectContent>
                </Select>
             </div>
             <div className="space-y-2">
                <Label>Título</Label>
                <Input value={title} onChange={e => setTitle(e.target.value)} className="bg-slate-950 border-slate-800" />
             </div>
             <div className="space-y-2">
                <Label>Instrucciones de la IA</Label>
                <Textarea value={instructions} onChange={e => setInstructions(e.target.value)} className="bg-slate-950 border-slate-800 text-xs h-32" />
             </div>
             <div className="space-y-2">
                <Label className="flex items-center gap-2">Contenido de la Imagen (OCR) <Info className="w-3 h-3 text-slate-500" /></Label>
                <div className="bg-black/50 border border-slate-800 rounded p-4 text-[10px] text-slate-400 font-mono h-32 overflow-y-auto leading-relaxed">
                   {selectedAsset?.ocr_content || "Usa el botón 'Analizar OCR' en la tarjeta para extraer texto automáticamente."}
                </div>
             </div>
          </div>
          <DialogFooter>
             <Button variant="ghost" onClick={() => setIsEditOpen(false)}>Cerrar</Button>
             <Button className="bg-indigo-600" onClick={handleUpdateAsset} disabled={uploading}>Guardar Cambios</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default MediaManager;