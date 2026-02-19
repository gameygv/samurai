import React, { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Globe, Loader2, RefreshCw, ExternalLink, CheckCircle2, AlertCircle, Search, FileText, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

const WebsiteContent = () => {
  const [pages, setPages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // New URL State
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newUrl, setNewUrl] = useState('');
  const [newTitle, setNewTitle] = useState('');

  useEffect(() => {
    fetchPages();
  }, []);

  const fetchPages = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('main_website_content')
        .select('*')
        .order('url', { ascending: true });

      if (error) throw error;
      setPages(data || []);
    } catch (err: any) {
      toast.error('Error cargando contenido del sitio');
    } finally {
      setLoading(false);
    }
  };

  const handleAddUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUrl.startsWith('http')) return toast.error("La URL debe ser válida");
    
    setSyncing(true);
    try {
       const { error } = await supabase.from('main_website_content').insert([
          { url: newUrl, title: newTitle || 'Página Manual', scrape_status: 'pending' }
       ]);
       if (error) throw error;
       toast.success("URL añadida a la cola de indexación.");
       setIsAddOpen(false);
       setNewUrl('');
       setNewTitle('');
       fetchPages();
    } catch (err: any) {
       toast.error("Error al añadir URL: " + err.message);
    } finally {
       setSyncing(false);
    }
  };

  const handleSyncAll = async () => {
    setSyncing(true);
    toast.info("Sincronizando sitio principal...");
    try {
      const { data, error } = await supabase.functions.invoke('scrape-main-website', {});
      if (error) throw error;
      toast.success(`Sincronización finalizada. Éxito: ${data.successful}`);
      fetchPages();
    } catch (err: any) {
      toast.error(`Error de sincronización: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const filteredPages = pages.filter(p => 
    p.url?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.title && p.title.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-2">
              <Globe className="w-8 h-8 text-indigo-500" />
              Sitio Web Principal
            </h1>
            <p className="text-slate-400">Contenido indexado de theelephantbowl.com</p>
          </div>
          <div className="flex gap-3">
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
               <DialogTrigger asChild>
                  <Button variant="outline" className="border-indigo-500 text-indigo-400">
                     <Plus className="w-4 h-4 mr-2" /> Añadir URL
                  </Button>
               </DialogTrigger>
               <DialogContent className="bg-slate-900 border-slate-800 text-white">
                  <DialogHeader><DialogTitle>Nueva página para indexar</DialogTitle></DialogHeader>
                  <form onSubmit={handleAddUrl} className="space-y-4 pt-4">
                     <div className="space-y-2">
                        <Label>URL Completa</Label>
                        <Input value={newUrl} onChange={e => setNewUrl(e.target.value)} placeholder="https://..." className="bg-slate-950 border-slate-800" />
                     </div>
                     <div className="space-y-2">
                        <Label>Título (Opcional)</Label>
                        <Input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Ej: Taller Gongs Mayo" className="bg-slate-950 border-slate-800" />
                     </div>
                     <Button type="submit" className="w-full bg-indigo-600" disabled={syncing}>Guardar en Cola</Button>
                  </form>
               </DialogContent>
            </Dialog>
            <Button onClick={handleSyncAll} disabled={syncing} className="bg-indigo-600 hover:bg-indigo-700">
              {syncing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />} Sincronizar Todo
            </Button>
          </div>
        </div>

        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="border-b border-slate-800 flex flex-row items-center justify-between">
             <CardTitle className="text-white text-sm uppercase tracking-widest flex items-center gap-2">
                Páginas Indexadas ({filteredPages.length})
             </CardTitle>
             <div className="relative w-64">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-500" />
                <Input placeholder="Buscar..." className="pl-8 bg-slate-950 border-slate-800 text-white h-9" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
             </div>
          </CardHeader>
          <CardContent className="p-4">
            <Accordion type="single" collapsible className="space-y-2">
              {filteredPages.map((page, index) => (
                <AccordionItem key={page.id} value={`page-${index}`} className="bg-slate-950 border border-slate-800 rounded-lg overflow-hidden">
                  <AccordionTrigger className="px-4 py-3">
                    <div className="flex items-center justify-between w-full pr-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${page.scrape_status === 'success' ? 'bg-green-500' : 'bg-red-500'}`} />
                        <span className="text-sm font-bold text-white truncate max-w-[200px]">{page.title || page.url}</span>
                      </div>
                      <Badge variant="outline" className="text-[9px] border-slate-700 text-slate-400">{page.content_length || 0} chars</Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4">
                    <div className="bg-slate-900 border border-slate-800 rounded p-4 max-h-[300px] overflow-y-auto">
                      <p className="text-xs text-slate-300 font-mono leading-relaxed">{page.content || 'Sin contenido'}</p>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default WebsiteContent;