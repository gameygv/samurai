import React, { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Image, FileText, Video, Upload, Trash2, ExternalLink, Loader2, Copy, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { logActivity } from '@/utils/logger';

const MediaManager = () => {
  const [assets, setAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');

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

      // 1. Subir al Bucket
      const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(filePath, selectedFile);

      if (uploadError) throw uploadError;

      // 2. Obtener URL Pública
      const { data: { publicUrl } } = supabase.storage
        .from('media')
        .getPublicUrl(filePath);

      let type = 'FILE';
      if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(fileExt?.toLowerCase() || '')) type = 'IMAGE';
      if (['mp4', 'mov', 'webm'].includes(fileExt?.toLowerCase() || '')) type = 'VIDEO';
      if (['pdf'].includes(fileExt?.toLowerCase() || '')) type = 'PDF';

      // 3. Guardar referencia en BD
      const { error: dbError } = await supabase.from('media_assets').insert({
        title: title || selectedFile.name,
        url: publicUrl,
        type,
        tags: [type]
      });

      if (dbError) throw dbError;

      await logActivity({
        action: 'CREATE',
        resource: 'SYSTEM',
        description: `Media subido: ${title || selectedFile.name}`,
        status: 'OK'
      });

      toast.success('Archivo subido correctamente');
      setIsDialogOpen(false);
      setSelectedFile(null);
      setTitle('');
      fetchAssets();

    } catch (error: any) {
      console.error('Upload error:', error);
      if (error.message.includes('Bucket not found') || error.message.includes('not found')) {
         toast.error('Falta configuración en Supabase', {
            description: 'El bucket "media" no existe. Ejecuta el script SETUP_STORAGE.sql en el SQL Editor de Supabase.'
         });
      } else {
         toast.error(`Error: ${error.message}`);
      }
    } finally {
      setUploading(false);
    }
  };

  const deleteAsset = async (id: string, url: string) => {
    if (!confirm('¿Eliminar este archivo?')) return;
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
    toast.success('URL copiada al portapapeles');
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Media Manager</h1>
            <p className="text-slate-400">Recursos multimedia para que el Samurai envíe.</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-indigo-600 hover:bg-indigo-700">
                <Upload className="w-4 h-4 mr-2" /> Subir Media
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-slate-900 border-slate-800 text-white">
              <DialogHeader>
                <DialogTitle>Subir Archivo</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleUpload} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Título (Opcional)</Label>
                  <Input 
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    className="bg-slate-950 border-slate-800"
                    placeholder="Ej: Catálogo 2026"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Archivo</Label>
                  <Input 
                    type="file"
                    onChange={e => setSelectedFile(e.target.files?.[0] || null)}
                    className="bg-slate-950 border-slate-800 cursor-pointer"
                    accept="image/*,video/*,application/pdf"
                  />
                </div>
                <Button type="submit" className="w-full bg-indigo-600" disabled={uploading || !selectedFile}>
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Subir Archivo'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {loading ? (
             <div className="col-span-full flex justify-center py-10">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
             </div>
          ) : assets.length === 0 ? (
             <div className="col-span-full flex flex-col items-center justify-center py-16 text-slate-500 border-2 border-dashed border-slate-800 rounded-lg bg-slate-900/50">
                <AlertTriangle className="w-10 h-10 mb-4 text-slate-600" />
                <p className="font-medium">No hay archivos multimedia</p>
                <p className="text-sm mt-1">Sube imágenes, videos o PDFs para usar en los chats.</p>
             </div>
          ) : (
             assets.map((asset) => (
                <Card key={asset.id} className="bg-slate-900 border-slate-800 group overflow-hidden hover:border-indigo-500/50 transition-colors">
                   <div className="aspect-square bg-slate-950 relative flex items-center justify-center overflow-hidden">
                      {asset.type === 'IMAGE' ? (
                         <img src={asset.url} alt={asset.title} className="object-cover w-full h-full opacity-80 group-hover:opacity-100 transition-opacity duration-300" />
                      ) : (
                         <div className="text-slate-600 group-hover:text-indigo-400 transition-colors">
                            {asset.type === 'VIDEO' ? <Video className="w-12 h-12" /> : <FileText className="w-12 h-12" />}
                         </div>
                      )}
                      
                      {/* Overlay Actions */}
                      <div className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 transition-all duration-200 flex flex-col items-center justify-center gap-2">
                         <div className="flex gap-2">
                            <Button variant="secondary" size="icon" className="h-8 w-8 rounded-full" onClick={() => window.open(asset.url, '_blank')} title="Ver Original">
                                <ExternalLink className="w-4 h-4" />
                            </Button>
                            <Button variant="secondary" size="icon" className="h-8 w-8 rounded-full" onClick={() => copyUrl(asset.url)} title="Copiar URL">
                                <Copy className="w-4 h-4" />
                            </Button>
                         </div>
                         <Button variant="destructive" size="sm" className="h-8 px-3 rounded-full text-xs" onClick={() => deleteAsset(asset.id, asset.url)}>
                            <Trash2 className="w-3 h-3 mr-1" /> Eliminar
                         </Button>
                      </div>
                   </div>
                   <div className="p-3">
                      <p className="text-sm font-medium text-white truncate" title={asset.title}>{asset.title}</p>
                      <Badge variant="outline" className="mt-1 text-[10px] border-slate-700 text-slate-500">{asset.type}</Badge>
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