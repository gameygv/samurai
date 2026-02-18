import React, { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, BookOpen, Upload, Loader2, Globe, RefreshCw, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { CreateResourceDialog } from '@/components/knowledge/CreateResourceDialog';
import { DocumentCard } from '@/components/knowledge/DocumentCard';

const KnowledgeBase = () => {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState('all');
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [syncingAll, setSyncingAll] = useState(false);

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('knowledge_documents')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
    } catch (error: any) {
      console.error('Error fetching documents:', error);
      toast.error('Error cargando documentos');
    } finally {
      setLoading(false);
    }
  };

  const handleSyncWebsite = async (id: string, url: string) => {
     if (!url) return toast.error("No hay URL válida para sincronizar");
     setSyncingId(id);
     
     try {
        const { data: scrapeData, error: scrapeError } = await supabase.functions.invoke('scrape-website', {
           body: { url }
        });

        if (scrapeError || !scrapeData.success) {
           throw new Error(scrapeError?.message || scrapeData?.error || "Fallo en el scraping");
        }

        const newContent = scrapeData.content;
        const chars = scrapeData.length;

        const { error: dbError } = await supabase
           .from('knowledge_documents')
           .update({ 
              content: newContent,
              updated_at: new Date().toISOString()
           })
           .eq('id', id);

        if (dbError) throw dbError;

        toast.success(`Sincronización completa. Leídos ${chars} caracteres.`);
        fetchDocuments(); 
        
     } catch (err: any) {
        toast.error(`Error de sincronización: ${err.message}`);
     } finally {
        setSyncingId(null);
     }
  };

  const handleSyncAll = async () => {
     setSyncingAll(true);
     toast.info("Iniciando sincronización masiva de sitios web...");
     
     try {
        const { data, error } = await supabase.functions.invoke('auto-sync-knowledge', {});
        
        if (error) throw error;
        
        const successCount = data.results.filter((r: any) => r.status === 'ok').length;
        const failCount = data.results.filter((r: any) => r.status === 'error').length;
        
        if (failCount > 0) {
           toast.warning(`Sincronización finalizada. Éxito: ${successCount}, Errores: ${failCount}`);
        } else {
           toast.success(`¡Todo actualizado! ${successCount} sitios sincronizados.`);
        }
        
        fetchDocuments();
     } catch (err: any) {
        toast.error(`Fallo en sincronización masiva: ${err.message}`);
     } finally {
        setSyncingAll(false);
     }
  };

  const handleDeleteDocument = async (id: string, title: string, filePath?: string) => {
    if (!confirm(`¿Eliminar "${title}"?`)) return;

    try {
      if (filePath) {
        await supabase.storage.from('knowledge-files').remove([filePath]);
      }

      const { error } = await supabase
        .from('knowledge_documents')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Documento eliminado');
      fetchDocuments();
    } catch (error: any) {
      toast.error('Error al eliminar');
    }
  };

  const filteredDocs = documents.filter(doc => {
    const matchesSearch = doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         doc.category.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (activeCategory === 'websites') {
        return doc.type === 'WEBSITE' && matchesSearch;
    }
    
    if (doc.type === 'WEBSITE') return false;

    const matchesCategory = activeCategory === 'all' || doc.category.toLowerCase() === activeCategory.toLowerCase();
    return matchesSearch && matchesCategory;
  });

  const getCategoryCount = (category: string) => {
    if (category === 'websites') return documents.filter(d => d.type === 'WEBSITE').length;
    if (category === 'all') return documents.filter(d => d.type !== 'WEBSITE').length;
    return documents.filter(d => d.category.toLowerCase() === category.toLowerCase() && d.type !== 'WEBSITE').length;
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-8">
        
        <Card className="bg-gradient-to-r from-indigo-900/20 to-purple-900/20 border-indigo-500/30 border-l-4 border-l-indigo-500">
          <div className="p-4 flex items-start gap-4">
            <div className="p-3 rounded-lg bg-indigo-500/10 shrink-0">
              <Lock className="w-6 h-6 text-indigo-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-white font-bold mb-1 flex items-center gap-2">
                Sitio Principal (theelephantbowl.com)
                <Badge className="bg-indigo-600 text-[9px]">SISTEMA PROTEGIDO</Badge>
              </h3>
              <p className="text-sm text-slate-300 mb-2">
                Esta es la Fuente de Verdad Maestra. El Samurai utiliza todo el contenido indexado del sitio oficial para responder con precisión absoluta.
              </p>
              <p className="text-xs text-slate-400 flex items-center gap-1">
                <RefreshCw className="w-3 h-3 text-indigo-400" /> 
                Actualización diaria automática activa. Este recurso no puede ser modificado manualmente para garantizar la integridad del ADN Samurai.
              </p>
            </div>
          </div>
        </Card>

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-2">
              <BookOpen className="w-8 h-8 text-indigo-500" />
              Base de Conocimiento
            </h1>
            <p className="text-slate-400">Recursos adicionales de talleres, maestros e instrumentos.</p>
          </div>
          
          <div className="flex gap-3">
             <Button 
                variant="outline" 
                className="border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/10"
                onClick={handleSyncAll}
                disabled={syncingAll}
             >
                {syncingAll ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                Sincronizar Todo
             </Button>

             <Button className="bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-900/20" onClick={() => setIsDialogOpen(true)}>
               <Upload className="w-4 h-4 mr-2" />
               Nuevo Recurso
             </Button>
          </div>

          <CreateResourceDialog 
             open={isDialogOpen} 
             onOpenChange={setIsDialogOpen} 
             userId={user?.id} 
             onSuccess={fetchDocuments}
          />
        </div>

        <Card className="bg-slate-900 border-slate-800">
            <div className="p-2 flex items-center">
            <Search className="w-5 h-5 text-slate-500 ml-2" />
            <Input 
                placeholder="Buscar recursos..." 
                className="border-0 bg-transparent text-lg focus-visible:ring-0 text-white placeholder:text-slate-600"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
            />
            </div>
        </Card>

        <Tabs value={activeCategory} onValueChange={setActiveCategory} className="w-full">
          <TabsList className="bg-slate-900 border border-slate-800 mb-6 flex-wrap h-auto p-1">
            <TabsTrigger value="websites" className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white flex gap-2">
               <Globe className="w-4 h-4" /> Sitios Web ({getCategoryCount('websites')})
            </TabsTrigger>
            <div className="w-px h-6 bg-slate-800 mx-2 hidden md:block"></div>
            <TabsTrigger value="all" className="data-[state=active]:bg-slate-800 data-[state=active]:text-white">
              Documentos ({getCategoryCount('all')})
            </TabsTrigger>
            <TabsTrigger value="talleres" className="data-[state=active]:bg-slate-800 data-[state=active]:text-white">
              Talleres ({getCategoryCount('talleres')})
            </TabsTrigger>
            <TabsTrigger value="instrumentos" className="data-[state=active]:bg-slate-800 data-[state=active]:text-white">
              Instrumentos ({getCategoryCount('instrumentos')})
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeCategory} className="mt-0">
            {loading ? (
              <div className="flex justify-center items-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
              </div>
            ) : filteredDocs.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed border-slate-800 rounded-lg">
                  <p className="text-slate-500">No hay recursos en esta categoría.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredDocs.map((doc) => (
                  <DocumentCard 
                     key={doc.id} 
                     doc={doc} 
                     syncingId={syncingId} 
                     onSync={handleSyncWebsite} 
                     onDelete={handleDeleteDocument} 
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default KnowledgeBase;