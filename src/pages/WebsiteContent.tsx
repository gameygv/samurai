import React, { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Globe, Loader2, RefreshCw, ExternalLink, CheckCircle2, AlertCircle, Search, FileText, Plus, DatabaseZap } from 'lucide-react';
import { toast } from 'sonner';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

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
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
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

  const handleInitCoreUrls = async () => {
     setSyncing(true);
     try {
        const payload = CORE_URLS.map(page => ({
           ...page,
           scrape_status: 'pending'
        }));

        const { error } = await supabase.from('main_website_content').insert(payload);
        if (error) throw error;

        toast.success("Las 14 URLs críticas han sido inyectadas. Ahora puedes sincronizar.");
        fetchPages();
     } catch (err: any) {
        toast.error("Error al inyectar URLs: " + err.message);
     } finally {
        setSyncing(false);
     }
  };

  const handleSyncAll = async () => {
    if (pages.length === 0) return toast.warning("Primero inyecta las 14 URLs base.");
    
    setSyncing(true);
    toast.info("Iniciando sincronización masiva...");
    try {
      const { data, error } = await supabase.functions.invoke('scrape-main-website', {});
      if (error) throw error;
      
      toast.success(`Sincronización completada: ${data.successful} páginas actualizadas.`);
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
            <p className="text-slate-400">Contenido indexado para el ADN Samurai.</p>
          </div>
          <div className="flex gap-3">
            {pages.length === 0 && (
               <Button onClick={handleInitCoreUrls} variant="outline" className="border-indigo-500 text-indigo-400 shadow-lg shadow-indigo-900/20">
                  <DatabaseZap className="w-4 h-4 mr-2" /> Inyectar 14 URLs Base
               </Button>
            )}
            <Button onClick={handleSyncAll} disabled={syncing || pages.length === 0} className="bg-indigo-600 hover:bg-indigo-700">
              {syncing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />} Sincronizar Todo
            </Button>
          </div>
        </div>

        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="border-b border-slate-800 flex flex-row items-center justify-between">
             <CardTitle className="text-white text-sm uppercase tracking-widest flex items-center gap-2">
                Fuentes de Verdad ({filteredPages.length})
             </CardTitle>
             <div className="relative w-64">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-500" />
                <Input placeholder="Buscar..." className="pl-8 bg-slate-950 border-slate-800 text-white h-9" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
             </div>
          </CardHeader>
          <CardContent className="p-4">
            {loading ? (
               <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>
            ) : pages.length === 0 ? (
               <div className="text-center py-20 border-2 border-dashed border-slate-800 rounded-xl space-y-4">
                  <Globe className="w-12 h-12 text-slate-700 mx-auto" />
                  <p className="text-slate-500">No hay contenido indexado. Usa el botón superior para cargar las 14 URLs de The Elephant Bowl.</p>
               </div>
            ) : (
              <Accordion type="single" collapsible className="space-y-2">
                {filteredPages.map((page, index) => (
                  <AccordionItem key={page.id} value={`page-${index}`} className="bg-slate-950 border border-slate-800 rounded-lg overflow-hidden group">
                    <AccordionTrigger className="px-4 py-3 hover:bg-slate-900 transition-colors">
                      <div className="flex items-center justify-between w-full pr-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${page.scrape_status === 'success' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]'}`} />
                          <div className="text-left">
                             <span className="text-sm font-bold text-white group-hover:text-indigo-400 transition-colors">{page.title || page.url}</span>
                             <p className="text-[10px] text-slate-500 font-mono mt-0.5">{page.url}</p>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-[9px] border-slate-700 text-slate-400">{page.content_length || 0} chars</Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4">
                      <div className="bg-slate-900 border border-slate-800 rounded p-4 max-h-[400px] overflow-y-auto mt-2">
                        {page.content ? (
                           <p className="text-xs text-slate-300 font-mono leading-relaxed whitespace-pre-wrap">{page.content}</p>
                        ) : (
                           <div className="flex items-center gap-2 text-slate-600 italic text-xs">
                              <AlertCircle className="w-4 h-4" />
                              Página pendiente de sincronización.
                           </div>
                        )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default WebsiteContent;