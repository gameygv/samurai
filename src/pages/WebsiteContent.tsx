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
  Info, ShieldCheck
} from 'lucide-react';
import { toast } from 'sonner';

const CORE_URLS = [
  { url: 'https://theelephantbowl.com/', title: 'Home / Inicio' },
  { url: 'https://theelephantbowl.com/formacion-sonoterapia', title: 'Formación Sonoterapia' },
  { url: 'https://theelephantbowl.com/maestros', title: 'Maestros y Guías' },
  { url: 'https://theelephantbowl.com/eventos', title: 'Calendario de Eventos' },
  { url: 'https://theelephantbowl.com/talleres', title: 'Talleres Presenciales' },
  { url: 'https://theelephantbowl.com/instrumentos', title: 'Catálogo de Instrumentos' },
  { url: 'https://theelephantbowl.com/cuencos-de-cuarzo', title: 'Cuencos de Cuarzo' },
  { url: 'https://theelephantbowl.com/gongs', title: 'Gongs Pro' },
  { url: 'https://theelephantbowl.com/quienes-somos', title: 'Nuestra Historia' },
  { url: 'https://theelephantbowl.com/testimonios', title: 'Experiencias y Testimonios' },
  { url: 'https://theelephantbowl.com/tienda', title: 'E-commerce / Tienda' },
  { url: 'https://theelephantbowl.com/politicas', title: 'Políticas y Garantías' },
  { url: 'https://theelephantbowl.com/certificaciones', title: 'Certificaciones Internacionales' },
  { url: 'https://theelephantbowl.com/preguntas-frecuentes', title: 'FAQ / Ayuda' }
];

const WebsiteContent = () => {
  const [pages, setPages] = useState<any[]>([]);
  const [selectedPage, setSelectedPage] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [mediaRelated, setMediaRelated] = useState<any[]>([]);

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

  useEffect(() => {
    if (selectedPage) {
       fetchRelatedMedia();
    }
  }, [selectedPage]);

  const fetchRelatedMedia = async () => {
    // Buscamos en media_assets imágenes que tengan el título de la página en sus instrucciones o tags
    const { data } = await supabase
      .from('media_assets')
      .select('*')
      .ilike('ai_instructions', `%${selectedPage.title}%`);
    setMediaRelated(data || []);
  };

  const handleInitCoreUrls = async () => {
     setSyncing(true);
     try {
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

  const handleSyncAll = async () => {
    setSyncing(true);
    toast.info("Sincronizando cerebro con el sitio principal...");
    try {
      const { data, error } = await supabase.functions.invoke('scrape-main-website', {});
      if (error) throw error;
      toast.success(`Sincronización Exitosa: ${data.successful} páginas.`);
      fetchPages();
    } catch (err: any) {
      toast.error(`Fallo de conexión: ${err.message}`);
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
            <p className="text-slate-400">Control de indexación de theelephantbowl.com</p>
          </div>
          <div className="flex gap-3">
            {pages.length === 0 && (
               <Button onClick={handleInitCoreUrls} variant="outline" className="border-indigo-500 text-indigo-400">
                  <DatabaseZap className="w-4 h-4 mr-2" /> Inyectar 14 URLs Críticas
               </Button>
            )}
            <Button onClick={handleSyncAll} disabled={syncing || pages.length === 0} className="bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-900/20">
              {syncing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />} 
              {syncing ? 'Sincronizando...' : 'Sincronizar Todo'}
            </Button>
          </div>
        </div>

        <div className="flex-1 flex gap-6 min-h-0">
          {/* SIDEBAR: LISTA DE URLs */}
          <Card className="w-80 bg-slate-900 border-slate-800 flex flex-col">
            <div className="p-4 border-b border-slate-800">
               <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-slate-500" />
                  <Input 
                    placeholder="Filtrar fuentes..." 
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
                  ) : filteredPages.length === 0 ? (
                     <p className="text-center text-[10px] text-slate-600 py-10">Sin fuentes cargadas.</p>
                  ) : filteredPages.map(page => (
                     <button
                        key={page.id}
                        onClick={() => setSelectedPage(page)}
                        className={`w-full text-left p-3 rounded-lg transition-all flex items-center justify-between group ${selectedPage?.id === page.id ? 'bg-indigo-600/20 border border-indigo-500/50' : 'hover:bg-slate-800 border border-transparent'}`}
                     >
                        <div className="min-w-0">
                           <p className={`text-xs font-bold truncate ${selectedPage?.id === page.id ? 'text-white' : 'text-slate-400'}`}>{page.title}</p>
                           <div className="flex items-center gap-2 mt-1">
                              <div className={`w-1.5 h-1.5 rounded-full ${page.scrape_status === 'success' ? 'bg-green-500' : 'bg-red-500'}`} />
                              <span className="text-[9px] text-slate-500 font-mono truncate">{page.url.replace('https://theelephantbowl.com', '')}</span>
                           </div>
                        </div>
                        <ChevronRight className={`w-4 h-4 shrink-0 transition-transform ${selectedPage?.id === page.id ? 'text-indigo-400 translate-x-1' : 'text-slate-700'}`} />
                     </button>
                  ))}
               </div>
            </ScrollArea>
          </Card>

          {/* MAIN: AUDITOR DE CONTENIDO */}
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
                        <div className="flex items-center gap-4">
                           <div className="text-right">
                              <p className="text-[10px] text-slate-500 uppercase font-bold">Estado Samurai</p>
                              {selectedPage.scrape_status === 'success' ? (
                                 <Badge className="bg-green-600/20 text-green-500 border-green-500/30 text-[9px]"><ShieldCheck className="w-3 h-3 mr-1" /> INDEXADO</Badge>
                              ) : (
                                 <Badge className="bg-red-600/20 text-red-500 border-red-500/30 text-[9px]"><AlertCircle className="w-3 h-3 mr-1" /> PENDIENTE</Badge>
                              )}
                           </div>
                        </div>
                     </div>
                  </CardHeader>
                  
                  <Tabs defaultValue="texto" className="flex-1 flex flex-col min-h-0">
                     <div className="px-6 border-b border-slate-800">
                        <TabsList className="bg-transparent h-12 p-0 gap-8">
                           <TabsTrigger value="texto" className="rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-500 data-[state=active]:bg-transparent text-slate-500 data-[state=active]:text-white h-full px-0">
                              <FileText className="w-4 h-4 mr-2" /> Texto Indexado
                           </TabsTrigger>
                           <TabsTrigger value="visual" className="rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-500 data-[state=active]:bg-transparent text-slate-500 data-[state=active]:text-white h-full px-0">
                              <Scan className="w-4 h-4 mr-2" /> Ojo de Halcón (Visual)
                           </TabsTrigger>
                        </TabsList>
                     </div>

                     <TabsContent value="texto" className="flex-1 p-6 min-h-0 m-0">
                        <div className="h-full flex flex-col gap-4">
                           <div className="bg-slate-950/50 p-4 rounded-lg border border-indigo-500/10 flex items-start gap-3">
                              <Info className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                              <p className="text-xs text-slate-400 leading-relaxed">
                                 Este es el contenido puro que el Samurai utiliza para responder. Si ves información desactualizada, pulsa el botón de <strong>Sincronizar Todo</strong> arriba para refrescar el cerebro.
                              </p>
                           </div>
                           <div className="flex-1 bg-black rounded-xl border border-slate-800 p-6 overflow-y-auto custom-scrollbar shadow-inner relative">
                              <div className="absolute top-4 right-4 text-[9px] font-mono text-slate-700">KERNEL_VIEW v0.8</div>
                              {selectedPage.content ? (
                                 <p className="text-sm text-slate-300 font-mono whitespace-pre-wrap leading-relaxed">
                                    {selectedPage.content}
                                 </p>
                              ) : (
                                 <div className="h-full flex flex-col items-center justify-center text-slate-600 italic">
                                    <RefreshCw className="w-8 h-8 mb-4 opacity-20" />
                                    Sin datos indexados para esta fuente.
                                 </div>
                              )}
                           </div>
                        </div>
                     </TabsContent>

                     <TabsContent value="visual" className="flex-1 p-6 min-h-0 m-0">
                        <div className="h-full flex flex-col gap-4">
                           <div className="bg-blue-500/5 p-4 rounded-lg border border-blue-500/20 flex items-start gap-3">
                              <Eye className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                              <p className="text-xs text-slate-400 leading-relaxed">
                                 A continuación se muestran los <strong>Assets Multimedia</strong> vinculados a esta sección. La IA utiliza estos datos OCR para reconocer posters y folletos en el chat.
                              </p>
                           </div>
                           
                           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 overflow-y-auto pr-2">
                              {mediaRelated.length === 0 ? (
                                 <div className="col-span-full py-20 text-center border-2 border-dashed border-slate-800 rounded-xl">
                                    <Scan className="w-12 h-12 text-slate-800 mx-auto mb-4" />
                                    <p className="text-slate-500 text-sm italic">No hay posters o imágenes vinculadas a esta sección en el Media Manager.</p>
                                 </div>
                              ) : mediaRelated.map(asset => (
                                 <Card key={asset.id} className="bg-slate-950 border-slate-800 overflow-hidden shadow-xl hover:border-indigo-500/30 transition-all group">
                                    <div className="aspect-video bg-black relative">
                                       <img src={asset.url} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" />
                                       <div className="absolute top-2 right-2">
                                          <Badge className="bg-indigo-600 text-[8px]">OCR DETECTADO</Badge>
                                       </div>
                                    </div>
                                    <div className="p-3 space-y-2">
                                       <p className="text-[10px] font-bold text-white uppercase">{asset.title}</p>
                                       <div className="bg-slate-900 p-2 rounded text-[9px] text-slate-500 font-mono leading-tight max-h-24 overflow-y-auto">
                                          {asset.ai_instructions?.split('--- OCR DATA ---')[1]?.trim() || 'No hay datos OCR procesados.'}
                                       </div>
                                    </div>
                                 </Card>
                              ))}
                           </div>
                        </div>
                     </TabsContent>
                  </Tabs>
                </>
             ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-600 space-y-4">
                   <Globe className="w-16 h-16 opacity-10" />
                   <p className="italic">Selecciona una Fuente de Verdad para auditar su conocimiento.</p>
                </div>
             )}
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default WebsiteContent;