import React, { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Image, FileText, Upload, Trash2, Loader2, Scan, Eye, Edit, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

const MediaManager = () => {
  const [assets, setAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [scanningId, setScanningId] = useState<string | null>(null);
  
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [uploadInstructions, setUploadInstructions] = useState('');

  const [editingAsset, setEditingAsset] = useState<any>(null);

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
     
     try {
        const { data, error } = await supabase.functions.invoke('scrape-website', {
           body: { url: asset.url, mode: 'VISION' }
        });

        if (error) throw error;
        if (!data || !data.success) throw new Error(data?.error || "La función de visión no devolvió resultados.");

        const detectedText = data.content;
        const cleanInstructions = asset.ai_instructions?.split('--- OCR DATA ---')[0] || asset.ai_instructions || '';
        const newInstructions = `${cleanInstructions.trim()}\n\n--- OCR DATA ---\n${detectedText}`;

        const { error: updateErr } = await supabase
           .from('media_assets')
           .update({ ai_instructions: newInstructions })
           .eq('id', asset.id);

        if (updateErr) throw updateErr;

        toast.success("Ojo de Halcón: Texto extraído correctamente.");
        fetchAssets();
     } catch (err: any) {
        console.error("OCR Error:", err);
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

      const { error: uploadError } = await supabase.storage.from('media').upload(filePath, selectedFile);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(filePath);

      let type = 'FILE';
      if (['jpg', 'jpeg', 'png', 'webp'].includes(fileExt?.toLowerCase() || '')) type = 'IMAGE';

      await supabase.from('media_assets').insert({
        title: title || selectedFile.name,
        url: publicUrl,
        type,
        ai_instructions: uploadInstructions || null
      });

      toast.success('Asset guardado.');
      setIsUploadOpen(false);
      fetchAssets();
    } finally {
      setUploading(false);
    }
  };

  const deleteAsset = async (id: string) => {
    if (!confirm('¿Borrar este asset?')) return;
    await supabase.from('media_assets').delete().eq('id', id);
    fetchAssets();
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-white">Media Manager</h1>
            <p className="text-slate-400">Imágenes y posters conocidos por el Samurai.</p>
          </div>
          <Button className="bg-indigo-600" onClick={() => setIsUploadOpen(true)}><Upload className="w-4 h-4 mr-2" /> Subir Asset</Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading ? (
             <div className="col-span-full flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>
          ) : assets.map((asset) => (
            <Card key={asset.id} className="bg-slate-900 border-slate-800 overflow-hidden group hover:border-indigo-500/50 transition-all">
              <div className="aspect-square bg-slate-950 relative border-b border-slate-800">
                 {asset.type === 'IMAGE' ? <img src={asset.url} className="w-full h-full object-cover opacity-80" /> : <FileText className="w-12 h-12 m-auto text-slate-700" />}
                 <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all flex flex-col items-center justify-center gap-2 p-4">
                    {asset.type === 'IMAGE' && (
                       <Button size="sm" className="w-full bg-indigo-600" onClick={() => handleScanOcr(asset)} disabled={scanningId === asset.id}>
                          {scanningId === asset.id ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <Scan className="w-3 h-3 mr-2" />} Escanear OCR
                       </Button>
                    )}
                    <Button variant="destructive" size="sm" className="w-full" onClick={() => deleteAsset(asset.id)}><Trash2 className="w-3 h-3 mr-2" /> Borrar</Button>
                 </div>
              </div>
              <div className="p-4 space-y-3">
                 <p className="text-sm font-bold text-white truncate">{asset.title}</p>
                 {asset.ai_instructions?.includes('--- OCR DATA ---') ? (
                    <Accordion type="single" collapsible>
                       <AccordionItem value="ocr" className="border-none">
                          <AccordionTrigger className="py-2 px-3 bg-indigo-500/10 border border-indigo-500/20 rounded text-[10px] text-indigo-400 uppercase font-bold">
                             <Eye className="w-3 h-3 mr-2" /> Texto Detectado
                          </AccordionTrigger>
                          <AccordionContent className="pt-2">
                             <p className="text-[10px] text-slate-400 font-mono bg-slate-950 p-2 rounded leading-relaxed">
                                {asset.ai_instructions.split('--- OCR DATA ---')[1].trim()}
                             </p>
                          </AccordionContent>
                       </AccordionItem>
                    </Accordion>
                 ) : (
                    <div className="flex items-center gap-2 text-[10px] text-slate-600 italic">
                       <AlertTriangle className="w-3 h-3" /> Sin escaneo OCR
                    </div>
                 )}
              </div>
            </Card>
          ))}
        </div>
      </div>
      
      <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white">
          <DialogHeader><DialogTitle>Nuevo Archivo</DialogTitle></DialogHeader>
          <form onSubmit={handleUpload} className="space-y-4 pt-4">
             <Input type="file" onChange={e => setSelectedFile(e.target.files?.[0] || null)} className="bg-slate-950 border-slate-800" />
             <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Título del poster..." className="bg-slate-950 border-slate-800" />
             <Button type="submit" className="w-full bg-indigo-600" disabled={uploading || !selectedFile}>Subir</Button>
          </form>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default MediaManager;