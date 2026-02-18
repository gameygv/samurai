import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Upload, Globe, File, Loader2, Info } from 'lucide-react';
import { toast } from 'sonner';
import { logActivity } from '@/utils/logger';

interface CreateResourceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string | undefined;
  onSuccess: () => void;
}

export const CreateResourceDialog = ({ open, onOpenChange, userId, onSuccess }: CreateResourceDialogProps) => {
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  
  const [formData, setFormData] = useState({
    title: '',
    type: 'PDF',
    category: 'Talleres',
    external_link: '',
    description: '',
    content: '',
    uploadMode: 'file'
  });

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setFormData({
        title: '',
        type: 'PDF',
        category: 'Talleres',
        external_link: '',
        description: '',
        content: '',
        uploadMode: 'file'
      });
      setSelectedFile(null);
    }
  }, [open]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      
      const extension = file.name.split('.').pop()?.toUpperCase();
      if (extension) {
        setFormData(prev => ({ ...prev, type: extension }));
      }
      if (!formData.title) {
        setFormData(prev => ({ ...prev, title: file.name.replace(/\.[^/.]+$/, "") }));
      }
    }
  };

  const uploadFile = async (file: File): Promise<{ path: string; url: string }> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `${userId}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('knowledge-files')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage
      .from('knowledge-files')
      .getPublicUrl(filePath);

    return { path: filePath, url: urlData.publicUrl };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploading(true);
    
    try {
      let fileUrl = '';
      let filePath = '';
      let fileSize = 'N/A';
      let docType = formData.type;
      let finalContent = formData.content;

      if (formData.uploadMode === 'file' && selectedFile) {
        const uploadResult = await uploadFile(selectedFile);
        fileUrl = uploadResult.url;
        filePath = uploadResult.path;
        fileSize = `${(selectedFile.size / 1024).toFixed(2)} KB`;
      } else if (formData.uploadMode === 'link') {
        fileUrl = formData.external_link;
        fileSize = 'WEB';
        docType = 'WEBSITE';
      }

      const { error } = await supabase
        .from('knowledge_documents')
        .insert({
          title: formData.title,
          type: docType,
          category: formData.category,
          file_url: fileUrl,
          file_path: filePath,
          external_link: formData.uploadMode === 'link' ? formData.external_link : null,
          size: fileSize,
          description: formData.description,
          content: finalContent,
          created_by: userId
        });

      if (error) throw error;

      await logActivity({
        action: 'CREATE',
        resource: 'BRAIN',
        description: `Recurso "${formData.title}" añadido a Base de Conocimiento`,
        status: 'OK'
      });

      toast.success('Recurso añadido correctamente');
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error creating document:', error);
      toast.error(`Error: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Añadir Recurso</DialogTitle>
          <DialogDescription className="text-slate-400">
            Sube documentos o añade sitios web de Maestros/Eventos.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          
          <div className="flex gap-2 p-1 bg-slate-950 rounded-lg border border-slate-800">
            <Button
              type="button"
              variant={formData.uploadMode === 'file' ? 'default' : 'ghost'}
              className={`flex-1 ${formData.uploadMode === 'file' ? 'bg-indigo-600' : ''}`}
              onClick={() => setFormData({...formData, uploadMode: 'file'})}
            >
              <Upload className="w-4 h-4 mr-2" />
              Subir Archivo
            </Button>
            <Button
              type="button"
              variant={formData.uploadMode === 'link' ? 'default' : 'ghost'}
              className={`flex-1 ${formData.uploadMode === 'link' ? 'bg-indigo-600' : ''}`}
              onClick={() => setFormData({...formData, uploadMode: 'link'})}
            >
              <Globe className="w-4 h-4 mr-2" />
              Sitio Web / URL
            </Button>
          </div>

          {formData.uploadMode === 'file' && (
            <div className="space-y-2">
              <Label>Seleccionar Archivo</Label>
              <div className="border-2 border-dashed border-slate-700 rounded-lg p-6 text-center hover:border-indigo-500 transition-colors cursor-pointer">
                <input
                  type="file"
                  onChange={handleFileChange}
                  className="hidden"
                  id="file-upload"
                  accept=".pdf,.doc,.docx,.txt,.csv,.xlsx"
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                  {selectedFile ? (
                    <div className="flex items-center justify-center gap-2 text-green-400">
                      <File className="w-5 h-5" />
                      <span className="font-medium">{selectedFile.name}</span>
                      <span className="text-xs text-slate-500">({(selectedFile.size / 1024).toFixed(2)} KB)</span>
                    </div>
                  ) : (
                    <div className="text-slate-400">
                      <Upload className="w-8 h-8 mx-auto mb-2" />
                      <p className="text-sm">Click para seleccionar archivo</p>
                    </div>
                  )}
                </label>
              </div>
            </div>
          )}

          {formData.uploadMode === 'link' && (
            <div className="space-y-4 bg-slate-950/50 p-4 rounded border border-slate-800">
                <div className="space-y-2">
                  <Label className="text-indigo-400">URL del Sitio Web</Label>
                  <Input 
                  value={formData.external_link}
                  onChange={e => setFormData({...formData, external_link: e.target.value})}
                  className="bg-slate-950 border-slate-700"
                  placeholder="https://theelephantbowl.com/maestro-x"
                  required={formData.uploadMode === 'link'}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-indigo-400">
                      <Info className="w-3 h-3" />
                      Instrucción de Venta (¿Cuándo usar este link?)
                  </Label>
                  <Textarea 
                      value={formData.description}
                      onChange={e => setFormData({...formData, description: e.target.value})}
                      className="bg-slate-950 border-slate-700 h-20 text-xs"
                      placeholder="Ej: Envía este link cuando el cliente pregunte por fechas del taller de Sonoterapia o quiera conocer al Maestro Juan."
                      required={formData.uploadMode === 'link'}
                  />
                </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Título Identificativo</Label>
              <Input 
                value={formData.title}
                onChange={e => setFormData({...formData, title: e.target.value})}
                className="bg-slate-950 border-slate-800"
                placeholder={formData.uploadMode === 'link' ? "Ej: Web Maestro Juan" : "Ej: Lista Precios 2026"}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label>Categoría</Label>
              <Select value={formData.category} onValueChange={v => setFormData({...formData, category: v})}>
                <SelectTrigger className="bg-slate-950 border-slate-800">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-white">
                  <SelectItem value="Talleres">Talleres & Eventos</SelectItem>
                  <SelectItem value="Maestros">Maestros</SelectItem>
                  <SelectItem value="Instrumentos">Instrumentos (Cuencos/Gongs)</SelectItem>
                  <SelectItem value="Legal">Políticas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="flex justify-between items-center">
                <span>{formData.uploadMode === 'link' ? 'Información Clave' : 'Contenido Indexable'}</span>
                {formData.uploadMode === 'link' && <Badge variant="outline" className="text-[9px] bg-indigo-500/10 text-indigo-400 border-indigo-500/30">Auto-Scraping Disponible</Badge>}
            </Label>
            <Textarea 
              value={formData.content}
              onChange={e => setFormData({...formData, content: e.target.value})}
              className="bg-slate-950 border-slate-800 min-h-[150px] font-mono text-xs leading-relaxed"
              placeholder={formData.uploadMode === 'link' 
                  ? "Opcional: Pega el texto manualmente O usa el botón 'Sincronizar' después de guardar para leer el sitio automáticamente."
                  : "Pega texto del PDF para ayudar a la búsqueda..."}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" className="bg-indigo-600" disabled={uploading}>
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Guardar en Memoria'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};