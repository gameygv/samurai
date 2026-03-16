import React, { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Globe, Loader2, RefreshCw, CheckCircle2, AlertCircle, Search, 
  FileText, ExternalLink, Plus, Edit2, Trash2, Settings
} from 'lucide-react';
import { toast } from 'sonner';
import { EditPageDialog } from '@/components/website/EditPageDialog';
import { SyncSettingsDialog } from '@/components/website/SyncSettingsDialog';

const WebsiteContent = () => {
  const [pages, setPages] = useState<any[]>([]);
  const [selectedPage, setSelectedPage] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Dialog States
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [pageToEdit, setPageToEdit] = useState<any | null>(null);

  useEffect(() => {
    fetchPages();
  }, []);

  const fetchPages = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('main_website_content')
        .select('*')
        .order('title', { ascending: true });

      if (error) throw error;
      setPages(data || []);
      if (data && data.length > 0 && !selectedPage) {
        setSelectedPage(data[0]);
      }
    } catch (err: any) {
      toast.error('Error cargando fuentes de verdad');
    } finally {
      setLoading(false);
    }
  };

  const handleSyncSingle = async (pageId: string, url: string) => {
    setSyncingId(pageId);
    const tid = toast.loading(`Actualizando Verdad Maestra: ${url}...`);
    
    try {
      const { data, error } = await supabase.functions.invoke('scrape-website', {
        body: { url }
      });

      if (error) throw new Error(error.message);
      if (!data || data.success === false) throw new Error(data?.error || "Fallo en el scraper.");

      const content = data.content || '';

      await supabase.from('main_website_content').update({
        content: content,
        content_length: content.length,
        scrape_status: 'success',
        error_message: null,
        last_scraped_at: new Date().toISOString()
      }).eq('id', pageId);
      
      toast.success(`¡Sincronizado! ${content.length} caracteres indexados.`, { id: tid });
      fetchPages();
      
    } catch (err: any) {
      toast.error(err.message, { id: tid });
      await supabase.from('main_website_content').update({
        scrape_status: 'error',
        error_message: err.message,
        last_scraped_at: new Date().toISOString()
      }).eq('id', pageId);
      fetchPages();
    } finally {
      setSyncingId(null);
    }
  };

  const handleDeletePage = async (id: string, title: string) => {
    if (!confirm(`¿Borrar permanentemente "${title}" de la base de conocimiento?`)) return;
    try {
      const { error } = await supabase.from('main_website_content').delete().eq('id', id);
      if (error) throw error;
      toast.success("Página eliminada.");
      setSelectedPage(null); // Deseleccionar
      fetchPages();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleSyncAll = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('scrape-main-website', {});
      if (error) throw error;
      toast.success(`Proceso finalizado: ${data.successful} páginas actualizadas.`);
      fetchPages();
    } catch (err: any) {
      toast.error(`Fallo masivo: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const filteredPages = pages.filter(p => 
    p.url?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.title?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Layout>
      <div className="max-w-[1600px] mx-auto h-[calc(100vh-140px)] flex flex-col gap-6">
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-2">
              <Globe className="w-8 h-8 text-indigo-500" />
              Auditor de Verdad Maestra
            </h1>
            <p className="text-slate-400">Control de indexación y lectura del Sitio Web Oficial.</p>
          </div>
          <div className="flex gap-3">
            <Button onClick={() => setIsSettingsOpen(true)} variant="outline" className="border-slate-800 text-slate-400">
               <Settings className="w-4 h-4 mr-2" /> Programación
            </Button>
            <Button onClick={handleSyncAll} disabled={syncing || pages.length === 0} className="bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-900/20">
              {syncing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />} 
              Sincronizar Lote
            </Button>
          </div>
        </div>

        <div className="flex-1 flex gap-6 min-h-0">
          <Card className="w-96 bg-slate-900 border-slate-800 flex flex-col">
            <div className="p-4 border-b border-slate-800 space-y-4">
               <Button 
                onClick={() => { setPageToEdit(null); setIsEditOpen(true); }} 
                className="w-full bg-slate-800 hover:bg-slate-700 text-xs h-8 border border-slate-700"
               >
                 <Plus className="w-3 h-3 mr-2" /> Nueva Página
               </Button>
               <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-slate-500" />
                  <Input 
                    placeholder="Buscar página..." 
                    className="pl-8 bg-slate-950 border-slate-800 text-xs h-9" 
                    value={searchTerm} 
                    onChange={e => setSearchTerm(e.target.value)} 
                  />
               </div>
            </div>
            <ScrollArea className="flex-1 p-2">
               <div className="space-y-1">
                  {loading ? (
                     <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-slate-700" /></div>
                  ) : filteredPages.map(page => (
                     <div
                        key={page.id}
                        className={`w-full group rounded-lg transition-all border ${selectedPage?.id === page.id ? 'bg-indigo-600/20 border-indigo-500/50' : 'hover:bg-slate-800/50 border-transparent'}`}
                     >
                        <div className="flex items-center p-3 gap-2">
                          <button
                            onClick={() => setSelectedPage(page)}
                            className="flex-1 text-left min-w-0"
                          >
                            <p className={`text-[11px] font-bold truncate ${selectedPage?.id === page.id ? 'text-white' : 'text-slate-400'}`}>{page.title}</p>
                            <div className="flex items-center gap-2 mt-1">
                                <div className={`w-1.5 h-1.5 rounded-full ${page.scrape_status === 'success' ? 'bg-green-500' : 'bg-red-500'}`} />
                                <span className="text-[9px] text-slate-600 font-mono truncate" title={page.url}>{page.url}</span>
                            </div>
                          </button>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                             <Button 
                               variant="ghost" 
                               size="icon" 
                               className={`h-6 w-6 ${selectedPage?.id === page.id ? 'text-white' : 'text-slate-600 hover:text-indigo-400'}`}
                               onClick={(e) => { e.stopPropagation(); handleSyncSingle(page.id, page.url); }}
                               disabled={syncingId === page.id}
                             >
                               {syncingId === page.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                             </Button>
                          </div>
                        </div>
                     </div>
                  ))}
               </div>
            </ScrollArea>
          </Card>

          <Card className="flex-1 bg-slate-900 border-slate-800 flex flex-col overflow-hidden">
             {selectedPage ? (
                <>
                  <CardHeader className="border-b border-slate-800 bg-slate-950/20 py-4">
                     <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 overflow-hidden">
                           <div className="w-12 h-12 rounded-xl bg-indigo-600/10 flex items-center justify-center border border-indigo-500/20 shrink-0">
                              <Globe className="w-6 h-6 text-indigo-400" />
                           </div>
                           <div className="min-w-0">
                              <CardTitle className="text-white text-lg truncate">{selectedPage.title}</CardTitle>
                              <a href={selectedPage.url} target="_blank" rel="noreferrer" className="text-[10px] text-indigo-400 flex items-center gap-1 hover:underline truncate">
                                 {selectedPage.url} <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                           </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                           <div className="flex gap-1">
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-400 hover:text-white" onClick={() => { setPageToEdit(selectedPage); setIsEditOpen(true); }} title="Editar URL/Título">
                                 <Edit2 className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-400 hover:text-red-500" onClick={() => handleDeletePage(selectedPage.id, selectedPage.title)} title="Eliminar Página">
                                 <Trash2 className="w-4 h-4" />
                              </Button>
                           </div>
                           <Badge className={selectedPage.scrape_status === 'success' ? 'bg-green-600/20 text-green-500 border-green-500/30' : 'bg-red-600/20 text-red-500'}>
                              {selectedPage.scrape_status === 'success' ? '✓ INDEXADO' : '⚠ ERROR'}
                           </Badge>
                        </div>
                     </div>
                  </CardHeader>
                  
                  <div className="flex-1 p-6 min-h-0 m-0">
                     <ScrollArea className="h-full bg-black rounded-xl border border-slate-800 p-6 shadow-inner">
                        {selectedPage.scrape_status === 'error' && (
                           <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded text-red-500 text-xs flex items-center gap-2">
                              <AlertCircle className="w-4 h-4" /> 
                              Error detectado: {selectedPage.error_message || 'Fallo de conexión'}.
                           </div>
                        )}
                        {selectedPage.content ? (
                           <p className="text-sm text-slate-300 font-mono whitespace-pre-wrap leading-relaxed">
                              {selectedPage.content}
                           </p>
                        ) : (
                           <div className="h-full flex flex-col items-center justify-center text-slate-600 italic text-center gap-4">
                              <RefreshCw className="w-8 h-8 opacity-20" />
                              <p>Página sin contenido indexado.<br/>Pulsa el botón de refrescar en el menú lateral.</p>
                           </div>
                        )}
                     </ScrollArea>
                  </div>
                </>
             ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-600">
                   <Globe className="w-16 h-16 opacity-10 mb-4" />
                   <p className="italic">Selecciona una fuente en el sidebar.</p>
                </div>
             )}
          </Card>
        </div>
      </div>

      <EditPageDialog 
        open={isEditOpen} 
        onOpenChange={setIsEditOpen} 
        page={pageToEdit} 
        onSuccess={fetchPages} 
      />

      <SyncSettingsDialog 
        open={isSettingsOpen} 
        onOpenChange={setIsSettingsOpen} 
      />
    </Layout>
  );
};

export default WebsiteContent;