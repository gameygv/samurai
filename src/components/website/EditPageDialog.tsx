import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Save, Globe } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface EditPageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  page: any | null;
  onSuccess: () => void;
}

export const EditPageDialog = ({ open, onOpenChange, page, onSuccess }: EditPageDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ title: '', url: '' });

  useEffect(() => {
    if (page) {
      setFormData({ title: page.title || '', url: page.url || '' });
    } else {
      setFormData({ title: '', url: '' });
    }
  }, [page, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (page?.id) {
        const { error } = await supabase
          .from('main_website_content')
          .update({ title: formData.title, url: formData.url })
          .eq('id', page.id);
        if (error) throw error;
        toast.success("Fuente actualizada.");
      } else {
        const { error } = await supabase
          .from('main_website_content')
          .insert([{ title: formData.title, url: formData.url, scrape_status: 'pending' }]);
        if (error) throw error;
        toast.success("Nueva fuente añadida.");
      }
      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-800 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-indigo-400" />
            {page ? 'Editar Fuente de Verdad' : 'Nueva Fuente de Verdad'}
          </DialogTitle>
          <DialogDescription>
            Configura la URL principal que el Samurai debe indexar para aprender sobre la empresa.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label>Título de la página</Label>
            <Input 
              value={formData.title} 
              onChange={e => setFormData({...formData, title: e.target.value})}
              placeholder="Ej: Inicio / Producto A"
              className="bg-slate-950 border-slate-800"
              required
            />
          </div>
          <div className="space-y-2">
            <Label>URL Completa</Label>
            <Input 
              value={formData.url} 
              onChange={e => setFormData({...formData, url: e.target.value})}
              placeholder="https://midominio.com/pagina"
              className="bg-slate-950 border-slate-800 font-mono"
              required
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" className="bg-indigo-600" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              Guardar Cambios
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};