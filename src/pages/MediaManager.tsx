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
import { Image as ImageIcon, FileText, Upload, Trash2, Loader2, Scan, Eye, Edit, AlertTriangle, Sparkles, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

const MediaManager = () => {
  const [assets, setAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [scanningId, setScanningId] = useState<string | null>(null);
  
  // Dialog States
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<any>(null);
  
  // Form States
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [instructions, setInstructions] = useState('');

  useEffect(() => {
    fetchAssets();
  }, []);

  const fetchAssets = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('media_assets').select('*').order('created_at', { ascending: false });
      if (!error && data) setAssets(data);
    } finally {
      setLoading(false);
    }
  };

  const handleScanOcr = async (asset: any) => {
     if (asset.type !== 'IMAGE') return toast.error("Solo se puede escanear texto en imágenes.");
     setScanningId(asset.id);
     const tid = toast.loading("Ojo de Halcón analizando imagen...");
     
     try {
        const { data, error } = await supabase.functions.invoke('scrape-website', {
           body: { url: asset.url, mode: 'VISION' }
        });

        if (error) throw error;
        if (!data || !data.success) throw new Error(data?.error || "La visión no detectó texto.");

        const detectedText = data.content;
        // Separamos las instrucciones humanas de los datos OCR para no perder nada
        const baseInstructions = asset.ai_instructions?.split('--- OCR DATA ---')[0] || asset.ai_instructions || '';
        const newInstructions = `${baseInstructions.trim()}\n\n--- OCR DATA ---\n${detectedText}`;

        const { error: updateErr } = await supabase
           .from('media_assets')
           .update({ ai_instructions: newInstructions })
           .eq('id', asset.id);

        if (updateErr) throw updateErr;

        toast.success("Texto extraído y guardado en la memoria del asset.", { id: tid });
        fetchAssets();
     } catch (err: any) {
        toast.error(`Error de visión: ${err.message}`, { id: tid });
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
      if (['jpg', 'jpeg', 'png', 'webp'].includes(fileExt?.toLowerCase() || '')) type = 'IMAGE';

      await supabase.from('media_assets').insert({
        title: title || selectedFile.name,
        url: publicUrl,
        type,
        ai_instructions: instructions || null
      });

      toast.success('Asset subscrito correctamente.');
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
     setTitle(asset.title);
     setInstructions(asset.ai_instructions || '');
     setIsEditOpen(true);
  };

  const handleUpdateAsset = async () => {
     if (!selectedAsset) return;
     setUploading(true);
     try {
        const { error } = await supabase
           .from('media_assets')
           .update({
              title: title,
              ai_instructions: instructions
           })
           .eq('id', selectedAsset.id);
        
        if (error) throw error;
        toast.success("Asset actualizado.");
        setIsEditOpen(false);
        fetchAssets();
     } catch (err: any) {
        toast.error(err.message);
     } finally {
        setUploading(false);
     }
  };

  const deleteAsset = async (id: string, url: string) => {
    if (!confirm('¿Borrar permanentemente este asset?')) return;
    
    try {
      // Intentar borrar del storage también si es posible extraer el path
      const path = url.split('/').pop();
      if (path) {
         await supabase.storage.from('media').remove([`uploads/${path}`]);
      }
      
      await supabase.from('media_assets').delete().eq('id', id);
      toast.success("Eliminado.");
      fetchAssets();
    } catch (err: any) {
       toast.error("Error al eliminar.");
    }
  };

  const resetForms = () => {
     setSelectedFile(null);
     setTitle('');
     setInstructions('');
     setSelectedAsset(null);
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-2">
               <ImageIcon className="w-8 h-8 text-indigo-500" /> Media Manager
            </h1>
            <p className="text-slate-400 text-sm">Biblioteca visual para que Samurai reconozca promociones y comprobantes.</p>
          </div>
          <Button className="bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-900/20" onClick={() => { resetForms(); setIsUploadOpen(true); }}>
             <Upload className="w-4 h-4 mr-2" /> Subir Nuevo Asset
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {loading ? (
             <div className="col-span-full flex flex-col items-center justify-center py-20 text-slate-500">
                <Loader2 className="w-10 h-10 animate-spin mb-2" />
                <p>Cargando biblioteca...</p>
             </div>
          ) : assets.length === 0 ? (
             <div className="col-span-full py-20 text-center border-2 border-dashed border-slate-800 rounded-2xl text-slate-500">
                <ImageIcon className="w-12 h-12 mx-auto mb-4 opacity-20" />
                <p>No hay archivos en la biblioteca. Sube posters o imágenes de promociones.</p>
             </div>
          ) : assets.map((asset) => (
            <Card key={asset.id} className="bg-slate-900 border-slate-800 overflow-hidden group hover:border-indigo-500/50 transition-all shadow-xl">
              <div className="aspect-video bg-slate-950 relative border-b border-slate-800">
                 {asset.type === 'IMAGE' ? (
                    <img src={asset.url} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                 ) : (
                    <div className="w-full h-full flex items-center justify-center bg-slate-800/50">
                       <FileText className="w-12 h-12 text-slate-600" />
                    </div>
                 )}
                 
                 <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all flex flex-col items-center justify-center gap-2 p-4">
                    {asset.type === 'IMAGE' && (
                       <Button size="sm" className="w-full bg-indigo-600 h-8 text-[10px] font-bold" onClick={() => handleScanOcr(asset)} disabled={scanningId === asset.id}>
                          {scanningId === asset.id ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <Scan className="w-3 h-3 mr-2" />} ESCANEAR (OCR)
                       </Button>
                    )}
                    <div className="flex gap-2 w-full">
                       <Button variant="secondary" size="sm" className="flex-1 h-8 text-[10px]" onClick={() => handleEdit(asset)}>
                          <Edit className="w-3 h-3 mr-1" /> EDITAR
                       </Button>
                       <Button variant="destructive" size="sm" className="h-8 w-8 p-0" onClick={() => deleteAsset(asset.id, asset.url)}>
                          <Trash2 className="w-3 h-3" />
                       </Button>
                    </div>
                 </div>
                 
                 <div className="absolute top-2 right-2">
                    {asset.ai_instructions?.includes('--- OCR DATA ---') ? (
                       <Badge className="bg-green-600 text-[8px] h-4">OCR OK</Badge>
                    ) : (
                       <Badge variant="outline" className="bg-slate-900/80 border-slate-700 text-[8px] h-4">NO OCR</Badge>
                    )}
                 </div>
              </div>
              
              <div className="p-4 space-y-3">
                 <p className="text-xs font-bold text-white truncate" title={asset.title}>{asset.title}</p>
                 
                 <div className="space-y-2">
                    <p className="text-[10px] text-slate-500 uppercase font-bold flex items-center gap-1">
                       <Sparkles className="w-3 h-3 text-indigo-400" /> Instrucción IA:
                    </p>
                    <p className="text-[10px] text-slate-300 italic line-clamp-2 leading-relaxed">
                       {asset.ai_instructions?.split('--- OCR DATA ---')[0] || "Sin instrucciones de envío..."}
                    </p>
                 </div>

                 {asset.ai_instructions?.includes('--- OCR DATA ---') && (
                    <Accordion type="single" collapsible>
                       <AccordionItem value="ocr" className="border-none">
                          <AccordionTrigger className="py-1 px-2 bg-slate-800 rounded text-[9px] text-slate-400 uppercase font-bold hover:no-underline">
                             <Eye className="w-3 h-3 mr-2" /> Ver Datos Extraídos
                          </AccordionTrigger>
                          <AccordionContent className="pt-2">
                             <div className="max-h-24 overflow-y-auto text-[9px] text-slate-500 font-mono bg-black p-2 rounded custom-scrollbar">
                                {asset.ai_instructions.split('--- OCR DATA ---')[1].trim()}
                             </div>
                          </AccordionContent>
                       </AccordionItem>
                    </Accordion>
                 )}
              </div>
            </Card>
          ))}
        </div>
      </div>
      
      {/* DIALOG: SUBIR ASSET */}
      <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-lg">
          <DialogHeader>
             <DialogTitle>Añadir a la Biblioteca</DialogTitle>
             <DialogDescription className="text-slate-400">Sube imágenes de promociones, posters o formatos de pago.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpload} className="space-y-4 pt-4">
             <div className="space-y-2">
                <Label>Archivo</Label>
                <Input type="file" onChange={e => setSelectedFile(e.target.files?.[0] || null)} className="bg-slate-950 border-slate-800" accept="image/*" />
             </div>
             <div className="space-y-2">
                <Label>Título Identificativo</Label>
                <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ej: Promo Talleres Marzo" className="bg-slate-950 border-slate-800" />
             </div>
             <div className="space-y-2">
                <Label className="flex items-center gap-2">Instrucción para Samurai <Sparkles className="w-3 h-3 text-indigo-400"/></Label>
                <Textarea 
                   value={instructions} 
                   onChange={e => setInstructions(e.target.value)} 
                   placeholder="Ej: Envía esta imagen cuando el cliente pregunte por precios de los cuencos de Nepal." 
                   className="bg-slate-950 border-slate-800 text-xs h-24" 
                />
                <p className="text-[10px] text-slate-500 italic">Samurai usará este texto para saber en qué momento de la charla enviar esta imagen.</p>
             </div>
             <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700" disabled={uploading || !selectedFile}>
                {uploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                Guardar en Biblioteca
             </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* DIALOG: EDITAR ASSET */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-lg">
          <DialogHeader>
             <DialogTitle>Editar Asset</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
             <div className="space-y-2">
                <Label>Título</Label>
                <Input value={title} onChange={e => setTitle(e.target.value)} className="bg-slate-950 border-slate-800" />
             </div>
             <div className="space-y-2">
                <Label>Instrucciones de Envío</Label>
                <Textarea 
                   value={instructions} 
                   onChange={e => setInstructions(e.target.value)} 
                   className="bg-slate-950 border-slate-800 text-xs h-40" 
                />
             </div>
          </div>
          <DialogFooter>
             <Button variant="ghost" onClick={() => setIsEditOpen(false)}>Cancelar</Button>
             <Button className="bg-indigo-600 hover:bg-indigo-700" onClick={handleUpdateAsset} disabled={uploading}>
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-2" />} Guardar Cambios
             </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default MediaManager;