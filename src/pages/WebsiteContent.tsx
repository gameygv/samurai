import React, { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Globe, Loader2, RefreshCw, CheckCircle2, AlertCircle, Search, 
  FileText, DatabaseZap, Eye, Scan, ExternalLink, ChevronRight,
  Info, ShieldCheck, ImagePlus, ImageIcon
} from 'lucide-react';
import { toast } from 'sonner';

const CORE_URLS = [
  { url: 'https://theelephantbowl.com/', title: 'Home / Inicio' },
  { url: 'https://theelephantbowl.com/cursos/', title: 'Página Principal de Cursos' },
  { url: 'https://theelephantbowl.com/curso-nivel-1/', title: 'Curso Nivel 1' },
  { url: 'https://theelephantbowl.com/curso-nivel-2/', title: 'Curso Nivel 2' },
  { url: 'https://theelephantbowl.com/curso-nivel-3/', title: 'Curso Nivel 3' },
  { url: 'https://theelephantbowl.com/curso-online-conviertete-en-cuencoterapeuta/', title: 'Curso Online: Cuencoterapeuta' },
  { url: 'https://theelephantbowl.com/curso-online-la-psicoacustica/', title: 'Curso Online: Psicoacústica' },
  { url: 'https://theelephantbowl.com/curso-online-facilitadores-de-cuencos/', title: 'Curso Online: Facilitadores' },
  { url: 'https://theelephantbowl.com/comunidad/', title: 'Comunidad' },
  { url: 'https://theelephantbowl.com/historia/', title: 'Nuestra Historia' },
  { url: 'https://theelephantbowl.com/expertos/', title: 'Expertos y Guías' },
  { url: 'https://theelephantbowl.com/biblioteca/', title: 'Biblioteca de Recursos' },
  { url: 'https://theelephantbowl.com/ubicaciones/', title: 'Ubicaciones' },
  { url: 'https://theelephantbowl.com/contacto/', title: 'Contacto' }
];

const WebsiteContent = () => {
  const [pages, setPages] = useState<any[]>([]);
  const [selectedPage, setSelectedPage] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [detectedImages, setDetectedImages] = useState<string[]>([]);
  const [importingImage, setImportingImage] = useState<string | null>(null);

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

  const handleInitCoreUrls = async () => {
     setSyncing(true);
     try {
        await supabase.from('main_website_content').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        
        const payload = CORE_URLS.map(page => ({
           ...page,
           scrape_status: 'pending'
        }));
        const { error } = await supabase.from('main_website_content').insert(payload);
        if (error) throw error;
        toast.success("Fuentes de Verdad inyectadas.");
        fetchPages();
     } catch (err: any) {
        toast.error("Error: " + err.message);
     } finally {
        setSyncing(false);
     }
  };

  const handleSyncSingle = async (pageId: string, url: string) => {
    setSyncingId(pageId);
    setDetectedImages([]);
    const tid = toast.loading(`Actualizando Verdad Maestra: ${url}...`);
    
    try {
      console.log('[WebsiteContent] Iniciando sincronización de:', url);
      
      const { data, error } = await supabase.functions.invoke('scrape-website', {
        body: { url }
      });
      
      console.log('[WebsiteContent] Respuesta del scraper:', { data, error });
      
      // Validación 1: Error de invocación
      if (error) {
        console.error('[WebsiteContent] Error de invocación:', error);
        throw new Error(`Fallo crítico del servidor: ${error.message}`);
      }
      
      // Validación 2: Respuesta vacía
      if (!data) {
        throw new Error("El servidor no devolvió ninguna respuesta.");
      }
      
      // Validación 3: Success flag
      if (data.success === false) {
        throw new Error(data.error || "El sitio web bloqueó el acceso.");
      }
      
      // Validación 4: Contenido existe
      if (!data.content) {
        throw new Error("El servidor devolvió una respuesta sin contenido.");
      }
      
      // Validación 5: Contenido suficiente
      const content = data.content;
      if (typeof content !== 'string') {
        throw new Error("El contenido devuelto no es texto válido.");
      }
      
      if (content.length < 50) {
        throw new Error(`Contenido insuficiente (${content.length} caracteres). El sitio puede estar bloqueando el scraping.`);
      }

      console.log('[WebsiteContent] Contenido válido recibido:', content.length, 'caracteres');

      // Actualizar base de datos
      const { error: dbError } = await supabase.from('main_website_content').update({
        content: content,
        content_length: content.length,
        scrape_status: 'success',
        error_message: null,
        last_scraped_at: new Date().toISOString()
      }).eq('id', pageId);

      if (dbError) {
        console.error('[WebsiteContent] Error actualizando DB:', dbError);
        throw new Error(`Error guardando en base de datos: ${dbError.message}`);
      }

      // Manejo de imágenes (opcional)
      if (data.images && Array.isArray(data.images) && data.images.length > 0) {
         setDetectedImages(data.images);
         toast.success(`¡Sincronizado! ${content.length} caracteres indexados. ${data.images.length} imágenes detectadas.`, { id: tid });
      } else {
         toast.success(`Contenido actualizado: ${content.length} caracteres indexados.`, { id: tid });
      }
      
      fetchPages();
      
    } catch (err: any) {
      console.error('[WebsiteContent] Error en sincronización:', err);
      
      const errorMessage = err.message || 'Error desconocido';
      toast.error(errorMessage, { id: tid });
      
      // Guardar error en DB
      await supabase.from('main_website_content').update({
        scrape_status: 'error',
        error_message: errorMessage,
        last_scraped_at: new Date().toISOString()
      }).eq('id', pageId);
      
      fetchPages();
    } finally {
      setSyncingId(null);
    }
  };

  const handleImportToMedia = async (imageUrl: string) => {
     setImportingImage(imageUrl);
     try {
        const { error } = await supabase.from('media_assets').insert({
           title: `Importado de ${selectedPage?.title || 'Web'}`,
           url: imageUrl,
           type: 'IMAGE',
           ai_instructions: `VINCULADO A: ${selectedPage?.title}\nURL ORIGEN: ${selectedPage?.url}`
        });

        if (error) throw error;
        toast.success("Imagen enviada al Media Manager.");
     } catch (err: any) {
        toast.error("Error al importar imagen.");
     } finally {
        setImportingImage(null);
     }
  };

  const handleSyncAll = async () => {
    setSyncing(true);
    toast.info("Iniciando sincronización masiva de todas las fuentes...");
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
            <p className="text-slate-400">Control de indexación y visión de theelephantbowl.com</p>
          </div>
          <div className="flex gap-3">
            <Button onClick={handleInitCoreUrls} variant="outline" className="border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/10">
               <RefreshCw className="w-4 h-4 mr-2" /> Reiniciar URLs Críticas
            </Button>
            <Button onClick={handleSyncAll} disabled={syncing || pages.length === 0} className="bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-900/20">
              {syncing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />} 
              Sincronizar Lote
            </Button>
          </div>
        </div>

        <div className="flex-1 flex gap-6 min-h-0">
          <Card className="w-80 bg-slate-900 border-slate-800 flex flex-col">
            <div className="p-4 border-b border-slate-800">
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
                        <div className="flex items-center p-3">
                          <button
                            onClick={() => setSelectedPage(page)}
                            className="flex-1 text-left min-w-0"
                          >
                            <p className={`text-[11px] font-bold truncate ${selectedPage?.id === page.id ? 'text-white' : 'text-slate-400'}`}>{page.title}</p>
                            <div className="flex items-center gap-2 mt-1">
                                <div className={`w-1.5 h-1.5 rounded-full ${page.scrape_status === 'success' ? 'bg-green-500' : 'bg-red-500'}`} />
                                <span className="text-[9px] text-slate-600 font-mono truncate">{page.url.replace('https://theelephantbowl.com', '')}</span>
                            </div>
                          </button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className={`h-7 w-7 transition-all ${selectedPage?.id === page.id ? 'text-white' : 'text-slate-600 hover:text-indigo-400'}`}
                            onClick={(e) => { e.stopPropagation(); handleSyncSingle(page.id, page.url); }}
                            disabled={syncingId === page.id}
                          >
                            {syncingId === page.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                          </Button>
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
                        <div className="flex items-center gap-4">
                           <div className="w-12 h-12 rounded-xl bg-indigo-600/10 flex items-center justify-center border border-indigo-500/20">
                              <Globe className="w-6 h-6 text-indigo-400" />
                           </div>
                           <div>
                              <CardTitle className="text-white text-lg">{selectedPage.title}</CardTitle>
                              <a href={selectedPage.url} target="_blank" className="text-[10px] text-indigo-400 flex items-center gap-1 hover:underline">
                                 {selectedPage.url} <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                           </div>
                        </div>
                        <Badge className={selectedPage.scrape_status === 'success' ? 'bg-green-600/20 text-green-500 border-green-500/30' : 'bg-red-600/20 text-red-500'}>
                           {selectedPage.scrape_status === 'success' ? '✓ INDEXADO' : '⚠ ERROR'}
                        </Badge>
                     </div>
                  </CardHeader>
                  
                  <Tabs defaultValue="texto" className="flex-1 flex flex-col min-h-0">
                     <div className="px-6 border-b border-slate-800">
                        <TabsList className="bg-transparent h-12 p-0 gap-8">
                           <TabsTrigger value="texto" className="rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-500 data-[state=active]:bg-transparent text-slate-500 data-[state=active]:text-white h-full px-0">
                              <FileText className="w-4 h-4 mr-2" /> Contenido de Verdad
                           </TabsTrigger>
                           <TabsTrigger value="visual" className="rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-500 data-[state=active]:bg-transparent text-slate-500 data-[state=active]:text-white h-full px-0">
                              <ImageIcon className="w-4 h-4 mr-2" /> Imágenes Detectadas
                           </TabsTrigger>
                        </TabsList>
                     </div>

                     <TabsContent value="texto" className="flex-1 p-6 min-h-0 m-0">
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
                                 <p>Página sin contenido indexado.<br/>Pulsa el botón de refrescar arriba a la derecha.</p>
                              </div>
                           )}
                        </ScrollArea>
                     </TabsContent>

                     <TabsContent value="visual" className="flex-1 p-6 min-h-0 m-0">
                        <div className="h-full flex flex-col gap-4">
                           <div className="bg-indigo-500/5 p-4 rounded-lg border border-indigo-500/20 flex items-start gap-3">
                              <Scan className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                              <p className="text-xs text-slate-400 leading-relaxed">
                                 Imágenes detectadas en tiempo real.
                              </p>
                           </div>
                           
                           <ScrollArea className="flex-1">
                              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                 {(detectedImages || []).length === 0 ? (
                                    <div className="col-span-full py-20 text-center border-2 border-dashed border-slate-800 rounded-xl">
                                       <ImageIcon className="w-12 h-12 text-slate-800 mx-auto mb-4" />
                                       <p className="text-slate-500 text-sm italic">Sin fotos detectadas.</p>
                                    </div>
                                 ) : detectedImages.map((img, i) => (
                                    <Card key={i} className="bg-slate-950 border-slate-800 overflow-hidden group">
                                       <div className="aspect-square bg-black relative">
                                          <img src={img} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" />
                                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center p-4">
                                             <Button 
                                               size="sm" 
                                               className="w-full bg-indigo-600 text-[10px]" 
                                               onClick={() => handleImportToMedia(img)}
                                               disabled={importingImage === img}
                                             >
                                                {importingImage === img ? <Loader2 className="w-3 h-3 animate-spin" /> : <ImagePlus className="w-3 h-3 mr-1" />}
                                                IMPORTAR
                                             </Button>
                                          </div>
                                       </div>
                                    </Card>
                                 ))}
                              </div>
                           </ScrollArea>
                        </div>
                     </TabsContent>
                  </Tabs>
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
    </Layout>
  );
};

export default WebsiteContent;