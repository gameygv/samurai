import React, { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Globe, Loader2, RefreshCw, ExternalLink, CheckCircle2, AlertCircle, Search, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

const WebsiteContent = () => {
  const [pages, setPages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

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

  const handleSyncAll = async () => {
    setSyncing(true);
    toast.info("Iniciando sincronización del sitio principal...");
    try {
      const { data, error } = await supabase.functions.invoke('scrape-main-website', {});
      if (error) throw error;
      
      const successCount = data.successful || 0;
      const failCount = data.failed || 0;
      
      if (failCount > 0) {
        toast.warning(`Sincronización completada. Éxito: ${successCount}, Errores: ${failCount}`);
      } else {
        toast.success(`¡Sitio actualizado! ${successCount} páginas sincronizadas.`);
      }
      
      fetchPages();
    } catch (err: any) {
      toast.error(`Error de sincronización: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const filteredPages = pages.filter(p => 
    p.url?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.content?.toLowerCase().includes(searchTerm.toLowerCase())
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
          <Button 
            onClick={handleSyncAll} 
            disabled={syncing}
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            {syncing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Sincronizar Sitio
          </Button>
        </div>

        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="border-b border-slate-800">
            <div className="flex items-center justify-between">
              <CardTitle className="text-white text-sm uppercase tracking-widest flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-400" />
                Páginas Indexadas ({filteredPages.length})
              </CardTitle>
              <div className="relative w-64">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-500" />
                <Input 
                  placeholder="Buscar en contenido..." 
                  className="pl-8 bg-slate-950 border-slate-800 text-white h-9"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4">
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
              </div>
            ) : (
              <Accordion type="single" collapsible className="space-y-2">
                {filteredPages.map((page, index) => (
                  <AccordionItem 
                    key={page.id} 
                    value={`page-${index}`}
                    className="bg-slate-950 border border-slate-800 rounded-lg overflow-hidden"
                  >
                    <AccordionTrigger className="px-4 py-3 hover:bg-slate-900/50 transition-colors">
                      <div className="flex items-center justify-between w-full pr-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${page.scrape_status === 'success' ? 'bg-green-500' : 'bg-red-500'}`} />
                          <div className="text-left">
                            <p className="text-sm font-bold text-white">{page.title || 'Sin título'}</p>
                            <p className="text-xs text-slate-500 font-mono">{page.url}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className="text-[9px] border-slate-700 text-slate-400">
                            {page.content_length || 0} chars
                          </Badge>
                          {page.scrape_status === 'success' ? (
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                          ) : (
                            <AlertCircle className="w-4 h-4 text-red-500" />
                          )}
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4">
                      <div className="space-y-3 pt-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-500">
                            Última sincronización: {page.last_scraped_at ? new Date(page.last_scraped_at).toLocaleString() : 'Nunca'}
                          </span>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-7 text-xs"
                            onClick={() => window.open(page.url, '_blank')}
                          >
                            <ExternalLink className="w-3 h-3 mr-1" /> Ver Original
                          </Button>
                        </div>
                        
                        {page.error_message && (
                          <div className="bg-red-500/10 border border-red-500/20 rounded p-3">
                            <p className="text-xs text-red-400 font-mono">{page.error_message}</p>
                          </div>
                        )}
                        
                        <div className="bg-slate-900 border border-slate-800 rounded p-4 max-h-[400px] overflow-y-auto">
                          <p className="text-xs text-slate-300 font-mono leading-relaxed whitespace-pre-wrap">
                            {page.content || 'Sin contenido extraído'}
                          </p>
                        </div>
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