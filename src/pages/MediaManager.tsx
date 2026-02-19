import React, { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Image, FileText, Video, Upload, Trash2, ExternalLink, Loader2, Copy, AlertTriangle, Bot, Edit, Zap, WifiOff, Scan, FileSearch } from 'lucide-react';
import { toast } from 'sonner';
import { logActivity } from '@/utils/logger';

const MediaManager = () => {
  const [assets, setAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [scanningId, setScanningId] = useState<string | null>(null);
  
  // Upload State
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [uploadInstructions, setUploadInstructions] = useState('');

  // Edit State
  const [editingAsset, setEditingAsset] = useState<any>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editInstructions, setEditInstructions] = useState('');

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

      if (error) throw error;
      if (data) setAssets(data);
    } catch (error: any) {
      toast.error('Error cargando archivos multimedia');
    } finally {
      setLoading(false);
    }
  };

  const handleScanOcr = async (asset: any) => {
     if (asset.type !== 'IMAGE') return toast.error("OCR solo disponible para imágenes");
     setScanningId(asset.id);
     
     try {
        const { data, error } = await supabase.functions.invoke('scrape-website', {
           body: { url: asset.url, mode: 'VISION' }
        });

        if (error || !data.success) throw new Error(data.error || "Fallo en el escaneo visual");

        const detectedText = data.content;
        
        // Guardamos el texto extraído en una sección especial de las instrucciones o metadatos
        // Para este MVP, lo concatenamos a las instrucciones con un tag claro
        const cleanInstructions = asset.ai_instructions?.split('--- OCR DATA ---')[0] || asset.ai_instructions || '';
        const newInstructions = `${cleanInstructions}\n\n--- OCR DATA ---\n${detectedText}`;

        const { error: updateErr } = await supabase
           .from('media_assets')
           .update({ ai_instructions: newInstructions })
           .eq('id', asset.id);

        if (updateErr) throw updateErr;

        toast.success("Texto extraído correctamente de la imagen.");
        fetchAssets();
     } catch (err: any) {
        toast.error(`Error de visión: ${err.message}`);
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

      const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(filePath, selectedFile);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('media')
        .getPublicUrl(filePath);

      let type = 'FILE';
      const ext = fileExt?.toLowerCase() || '';
      if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) type = 'IMAGE';
      if (['mp4', 'mov', 'webm'].includes(ext)) type = 'VIDEO';
      if (['pdf'].includes(ext)) type = 'PDF';

      const { error: dbError } = await supabase.from('media_assets').insert({
        title: title || selectedFile.name,
        url: publicUrl,
        type,
        tags: [type],
        ai_instructions: uploadInstructions || null
      });

      if (dbError) throw dbError;

      toast.success('Archivo subido e indexado');
      setIsUploadOpen(false);
      resetForm();
      fetchAssets();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleUpdateAsset = async () => {
     if (!editingAsset) return;
     setUploading(true);
     try {
        const { error } = await supabase
           .from('media_assets')
           .update({ 
              title: editTitle,
              ai_instructions: editInstructions || null 
           })
           .eq('id', editingAsset.id);
        
        if (error) throw error;
        toast.success('Cambios guardados correctamente');
        setEditingAsset(null);
        fetchAssets();
     } catch (error: any) {
        toast.error(error.message);
     } finally {
        setUploading(false);
     }
  };

  const deleteAsset = async (id: string) => {
    if (!confirm('¿Eliminar este archivo?')) return;
    await supabase.from('media_assets').delete().eq('id', id);
    fetchAssets();
  };

  const resetForm = () => {
     setSelectedFile(null);
     setTitle('');
     setUploadInstructions('');
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-2">Media Manager</h1>
            <p className="text-slate-400">Gestiona imágenes y archivos que el Samurai conoce.</p>
          </div>
          <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
            <DialogTrigger asChild>
              <Button className="bg-indigo-600 hover:bg-indigo-700">
                <Upload className="w-4 h-4 mr-2" /> Subir Asset
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-slate-900 border-slate-800 text-white">
              <DialogHeader><DialogTitle>Nuevo Archivo</DialogTitle></DialogHeader>
              <form onSubmit={handleUpload} className="space-y-4 pt-4">
                <Input type="file" onChange={e => setSelectedFile(e.target.files?.[0] || null)} className="bg-slate-950 border-slate-800" />
                <div className="space-y-2">
                  <Label>Nombre del Item</Label>
                  <Input value={title} onChange={e => setTitle(e.target.value)} className="bg-slate-950 border-slate-800" placeholder="Ej: Poster Torreón" />
                </div>
                <div className="space-y-2">
                  <Label>Instrucciones IA</Label>
                  <Textarea value={uploadInstructions} onChange={e => setUploadInstructions(e.target.value)} className="bg-slate-950 border-slate-800 h-24" placeholder="¿Cuándo enviar este archivo?" />
                </div>
                <Button type="submit" className="w-full bg-indigo-600" disabled={uploading || !selectedFile}>
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Subir e Indexar'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Edit Dialog */}
        <Dialog open={!!editingAsset} onOpenChange={(open) => !open && setEditingAsset(null)}>
           <DialogContent className="bg-slate-900 border-slate-800 text-white sm:max-w-xl">
              <DialogHeader>
                 <DialogTitle>Editar Asset</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                 <div className="space-y-2">
                    <Label>Nombre / Título</Label>
                    <Input value={editTitle} onChange={e => setEditTitle(e.target.value)} className="bg-slate-950 border-slate-800" />
                 </div>
                 <div className="space-y-2">
                    <Label>Instrucciones de la IA</Label>
                    <Textarea 
                       value={editInstructions} 
                       onChange={e => setEditInstructions(e.target.value)} 
                       className="bg-slate-950 border-slate-800 h-40 font-mono text-xs" 
                    />
                 </div>
                 <DialogFooter>
                    <Button variant="ghost" onClick={() => setEditingAsset(null)}>Cancelar</Button>
                    <Button onClick={handleUpdateAsset} className="bg-indigo-600" disabled={uploading}>
                       {uploading ? <Loader2 className="w-4 h-4 animate-spin"/> : 'Guardar Cambios'}
                    </Button>
                 </DialogFooter>
              </div>
           </DialogContent>
        </Dialog>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {loading ? (
             <div className="col-span-full flex justify-center py-10"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>
          ) : (
             assets.map((asset) => {
                const ocrData = asset.ai_instructions?.split('--- OCR DATA ---')[1];
                return (
                  <Card key={asset.id} className="bg-slate-900 border-slate-800 group overflow-hidden hover:border-indigo-500 transition-all">
                    <div className="aspect-square bg-slate-950 relative flex items-center justify-center border-b border-slate-800">
                       {asset.type === 'IMAGE' ? <img src={asset.url} className="object-cover w-full h-full opacity-80" /> : <FileText className="w-12 h-12 text-slate-600" />}
                       <div className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 transition-all flex flex-col items-center justify-center gap-2 p-4">
                          <Button variant="secondary" size="sm" className="w-full" onClick={() => { setEditingAsset(asset); setEditTitle(asset.title); setEditInstructions(asset.ai_instructions || ''); }}><Edit className="w-3 h-3 mr-2" /> Editar</Button>
                          {asset.type === 'IMAGE' && (
                             <Button variant="secondary" size="sm" className="w-full bg-indigo-600 text-white" onClick={() => handleScanOcr(asset)} disabled={scanningId === asset.id}>
                                {scanningId === asset.id ? <Loader2 className="w-3 h-3 animate-spin"/> : <Scan className="w-3 h-3 mr-2" />} OCR Scan
                             </Button>
                          )}
                          <Button variant="destructive" size="sm" className="w-full" onClick={() => deleteAsset(asset.id)}><Trash2 className="w-3 h-3 mr-2" /> Borrar</Button>
                       </div>
                    </div>
                    <div className="p-3">
                       <p className="text-xs font-bold text-white truncate mb-1">{asset.title}</p>
                       {ocrData ? (
                          <div className="bg-slate-950 p-1.5 rounded border border-indigo-500/20 mt-2">
                             <p className="text-[9px] text-indigo-400 font-bold uppercase flex items-center gap-1 mb-1"><FileSearch className="w-3 h-3"/> Texto Detectado</p>
                             <p className="text-[9px] text-slate-500 line-clamp-3 italic">{ocrData}</p>
                          </div>
                       ) : (
                          <p className="text-[10px] text-slate-500 line-clamp-1 italic">{asset.ai_instructions?.substring(0, 50) || 'Sin instrucciones'}</p>
                       )}
                    </div>
                  </Card>
                );
             })
          )}
        </div>
      </div>
    </Layout>
  );
};

export default MediaManager;