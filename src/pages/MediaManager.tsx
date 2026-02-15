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
import { Image, FileText, Video, Upload, Trash2, ExternalLink, Loader2, Copy, AlertTriangle, Bot, Edit } from 'lucide-react';
import { toast } from 'sonner';
import { logActivity } from '@/utils/logger';

const MediaManager = () => {
  const [assets, setAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  
  // Upload State
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [uploadInstructions, setUploadInstructions] = useState('');

  // Edit State
  const [editingAsset, setEditingAsset] = useState<any>(null);
  const [editInstructions, setEditInstructions] = useState('');

  useEffect(() => {
    fetchAssets();
  }, []);

  const fetchAssets = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('media_assets')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) setAssets(data);
    setLoading(false);
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
        ai_instructions: uploadInstructions || null // Guardar instrucciones IA
      });

      if (dbError) throw dbError;

      await logActivity({
        action: 'CREATE',
        resource: 'SYSTEM',
        description: `Media subido: ${title || selectedFile.name}`,
        status: 'OK'
      });

      toast.success('Archivo subido e indexado');
      setIsUploadOpen(false);
      resetForm();
      fetchAssets();

    } catch (error: any) {
      console.error(error);
      toast.error(error.message.includes('Bucket') ? 'Error de Storage (Bucket no existe)' : error.message);
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
           .update({ ai_instructions: editInstructions })
           .eq('id', editingAsset.id);
        
        if (error) throw error;
        toast.success('Instrucciones IA actualizadas');
        setEditingAsset(null);
        fetchAssets();
     } catch (error: any) {
        toast.error(error.message);
     } finally {
        setUploading(false);
     }
  };

  const deleteAsset = async (id: string) => {
    if (!confirm('¿Eliminar este archivo permanentemente?')) return;
    try {
        const { error } = await supabase.from('media_assets').delete().eq('id', id);
        if (error) throw error;
        toast.success('Asset eliminado');
        fetchAssets();
    } catch (err: any) {
        toast.error(err.message);
    }
  };

  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success('URL copiada');
  };

  const resetForm = () => {
     setSelectedFile(null);
     setTitle('');
     setUploadInstructions('');
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Media Manager</h1>
            <p className="text-slate-400">Archivos multimedia con instrucciones de detonación para la IA.</p>
          </div>
          
          <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
            <DialogTrigger asChild>
              <Button className="bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-900/20">
                <Upload className="w-4 h-4 mr-2" /> Subir Nuevo Asset
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-slate-900 border-slate-800 text-white sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Subir Archivo al Cerebro</DialogTitle>
                <DialogDescription className="text-slate-400">
                   Sube imágenes o catálogos y define cuándo debe usarlos el Samurai.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleUpload} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Archivo</Label>
                  <div className="border-2 border-dashed border-slate-700 rounded-lg p-4 hover:border-indigo-500 transition-colors cursor-pointer text-center">
                     <Input 
                        type="file" 
                        onChange={e => setSelectedFile(e.target.files?.[0] || null)} 
                        className="hidden" 
                        id="file-upload"
                        accept="image/*,video/*,application/pdf"
                     />
                     <label htmlFor="file-upload" className="cursor-pointer w-full h-full block">
                        {selectedFile ? (
                           <span className="text-green-400 font-mono text-sm">{selectedFile.name}</span>
                        ) : (
                           <span className="text-slate-500 text-sm">Click para seleccionar (Img, Video, PDF)</span>
                        )}
                     </label>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Título Interno</Label>
                  <Input 
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    className="bg-slate-950 border-slate-800"
                    placeholder="Ej: Catálogo Verano 2026"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                     <Label className="text-indigo-400 flex items-center gap-1"><Bot className="w-3 h-3"/> Instrucciones IA (Trigger)</Label>
                  </div>
                  <Textarea 
                     value={uploadInstructions}
                     onChange={e => setUploadInstructions(e.target.value)}
                     className="bg-slate-950 border-slate-800 min-h-[80px] font-mono text-xs"
                     placeholder="Ej: Enviar esta imagen cuando el cliente pregunte por precios de mayoreo o quiera ver el catálogo completo."
                  />
                  <p className="text-[10px] text-slate-500">Si dejas esto vacío, la IA ignorará este archivo.</p>
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
           <DialogContent className="bg-slate-900 border-slate-800 text-white">
              <DialogHeader>
                 <DialogTitle>Editar Reglas IA</DialogTitle>
                 <DialogDescription>Asset: {editingAsset?.title}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                 <div className="space-y-2">
                    <Label className="text-indigo-400">¿Cuándo enviar esto?</Label>
                    <Textarea 
                       value={editInstructions}
                       onChange={e => setEditInstructions(e.target.value)}
                       className="bg-slate-950 border-slate-800 h-32 font-mono text-xs"
                    />
                 </div>
                 <DialogFooter>
                    <Button variant="ghost" onClick={() => setEditingAsset(null)}>Cancelar</Button>
                    <Button onClick={handleUpdateAsset} className="bg-indigo-600" disabled={uploading}>
                       {uploading ? <Loader2 className="w-4 h-4 animate-spin"/> : 'Guardar Regla'}
                    </Button>
                 </DialogFooter>
              </div>
           </DialogContent>
        </Dialog>

        {/* Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {loading ? (
             <div className="col-span-full flex justify-center py-10"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>
          ) : assets.length === 0 ? (
             <div className="col-span-full flex flex-col items-center justify-center py-16 text-slate-500 border-2 border-dashed border-slate-800 rounded-lg bg-slate-900/50">
                <AlertTriangle className="w-10 h-10 mb-4 text-slate-600" />
                <p>No hay archivos multimedia.</p>
             </div>
          ) : (
             assets.map((asset) => (
                <Card key={asset.id} className="bg-slate-900 border-slate-800 group overflow-hidden hover:border-indigo-500/50 transition-all flex flex-col">
                   <div className="aspect-square bg-slate-950 relative flex items-center justify-center overflow-hidden border-b border-slate-800">
                      {asset.type === 'IMAGE' ? (
                         <img src={asset.url} alt={asset.title} className="object-cover w-full h-full opacity-90 group-hover:opacity-100 transition-opacity" />
                      ) : (
                         <div className="text-slate-600 group-hover:text-indigo-400 transition-colors">
                            {asset.type === 'VIDEO' ? <Video className="w-12 h-12" /> : <FileText className="w-12 h-12" />}
                         </div>
                      )}
                      
                      {/* Actions Overlay */}
                      <div className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 transition-all duration-200 flex flex-col items-center justify-center gap-2 p-4">
                         <div className="flex gap-2">
                            <Button variant="secondary" size="icon" className="h-8 w-8 rounded-full" onClick={() => window.open(asset.url, '_blank')}><ExternalLink className="w-4 h-4" /></Button>
                            <Button variant="secondary" size="icon" className="h-8 w-8 rounded-full" onClick={() => copyUrl(asset.url)}><Copy className="w-4 h-4" /></Button>
                         </div>
                         <Button variant="destructive" size="sm" className="h-7 text-[10px] w-full" onClick={() => deleteAsset(asset.id)}><Trash2 className="w-3 h-3 mr-1" /> Eliminar</Button>
                         <Button 
                           variant="outline" 
                           size="sm" 
                           className="h-7 text-[10px] w-full border-indigo-500 text-indigo-400 hover:bg-indigo-500 hover:text-white"
                           onClick={() => { setEditingAsset(asset); setEditInstructions(asset.ai_instructions || ''); }}
                         >
                            <Edit className="w-3 h-3 mr-1" /> Editar Reglas
                         </Button>
                      </div>
                   </div>
                   
                   <div className="p-3 flex-1 flex flex-col">
                      <div className="flex items-start justify-between gap-2 mb-2">
                         <p className="text-xs font-bold text-white truncate flex-1" title={asset.title}>{asset.title}</p>
                         <Badge variant="outline" className="text-[9px] h-4 px-1 border-slate-700 text-slate-500">{asset.type}</Badge>
                      </div>
                      
                      {/* AI Status Indicator */}
                      <div className="mt-auto pt-2 border-t border-slate-800/50">
                         {asset.ai_instructions ? (
                            <div className="flex items-start gap-1.5 group/tooltip cursor-help">
                               <Bot className="w-3 h-3 text-green-500 mt-0.5 shrink-0" />
                               <p className="text-[10px] text-slate-400 line-clamp-2 leading-tight">
                                  {asset.ai_instructions}
                               </p>
                            </div>
                         ) : (
                            <div className="flex items-center gap-1.5 text-slate-600">
                               <Bot className="w-3 h-3" />
                               <span className="text-[10px]">Ignorado por IA</span>
                            </div>
                         )}
                      </div>
                   </div>
                </Card>
             ))
          )}
        </div>
      </div>
    </Layout>
  );
};

export default MediaManager;