import React, { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, BookOpen, Upload, Loader2, Globe, RefreshCw, Lock, FileText, CheckCircle2, AlertCircle } from 'lucide-react';
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
      toast.error('Error cargando documentos');
    } finally {
      setLoading(false);
    }
  };

  const handleSyncWebsite = async (id: string, url: string) => {
     if (!url) return toast.error("No hay URL para sincronizar");
     setSyncingId(id);
     const tid = toast.loading(`Sincronizando con ${url}...`);
     
     try {
        const { data, error } = await supabase.functions.invoke('scrape-website', {
           body: { url }
        });

        if (error || !data.success) throw new Error(error?.message || data?.error || "Fallo en el scraping");

        const { error: dbError } = await supabase
           .from('knowledge_documents')
           .update({ 
              content: data.content,
              updated_at: new Date().toISOString()
           })
           .eq('id', id);

        if (dbError) throw dbError;

        toast.success(`Información actualizada correctamente.`, { id: tid });
        fetchDocuments(); 
     } catch (err: any) {
        toast.error(`Error: ${err.message}`, { id: tid });
     } finally {
        setSyncingId(null);
     }
  };

  const filteredDocs = documents.filter(doc => {
    const matchesSearch = doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         doc.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = activeCategory === 'all' || doc.category.toLowerCase() === activeCategory.toLowerCase();
    return matchesSearch && matchesCategory;
  });

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-8 pb-12">
        
        {/* Banner de Fuente de Verdad Maestra */}
        <Card className="bg-indigo-900/10 border-indigo-500/30 border-l-4 border-l-indigo-500 overflow-hidden">
          <div className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-full bg-indigo-500/10">
              <Globe className="w-6 h-6 text-indigo-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-white font-bold text-sm">Sincronización con theelephantbowl.com</h3>
              <p className="text-xs text-slate-400">Samurai utiliza el contenido indexado del sitio oficial como su verdad absoluta. Aquí puedes añadir recursos adicionales.</p>
            </div>
            <Button variant="outline" size="sm" className="border-indigo-500/30 text-indigo-400" onClick={() => window.location.href='/website-content'}>
               Configurar Verdad Maestra
            </Button>
          </div>
        </Card>

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-2">
              <BookOpen className="w-8 h-8 text-indigo-500" />
              Base de Conocimiento
            </h1>
            <p className="text-slate-400">Archivos técnicos, biografías de maestros y detalles de talleres.</p>
          </div>
          <Button className="bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-900/20" onClick={() => setIsDialogOpen(true)}>
            <Upload className="w-4 h-4 mr-2" />
            Añadir Recurso
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
           <Card className="md:col-span-1 bg-slate-900 border-slate-800 h-fit">
              <div className="p-4 border-b border-slate-800">
                 <Label className="text-[10px] uppercase font-bold text-slate-500">Filtrar por categoría</Label>
              </div>
              <div className="p-2 space-y-1">
                 {['all', 'Talleres', 'Maestros', 'Instrumentos', 'Legal'].map(cat => (
                    <button
                       key={cat}
                       onClick={() => setActiveCategory(cat)}
                       className={cn(
                          "w-full text-left px-3 py-2 rounded-md text-xs transition-colors flex justify-between items-center",
                          activeCategory === cat ? "bg-indigo-600 text-white font-bold" : "text-slate-400 hover:bg-slate-800"
                       )}
                    >
                       {cat === 'all' ? 'Todos los recursos' : cat}
                       <span className="text-[10px] opacity-60">
                          {cat === 'all' ? documents.length : documents.filter(d => d.category === cat).length}
                       </span>
                    </button>
                 ))}
              </div>
           </Card>

           <div className="md:col-span-3 space-y-6">
              <Card className="bg-slate-900 border-slate-800">
                 <div className="p-2 flex items-center">
                    <Search className="w-5 h-5 text-slate-500 ml-2" />
                    <Input 
                        placeholder="Buscar en la memoria técnica..." 
                        className="border-0 bg-transparent text-lg focus-visible:ring-0 text-white placeholder:text-slate-700"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                 </div>
              </Card>

              {loading ? (
                <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-indigo-600" /></div>
              ) : filteredDocs.length === 0 ? (
                <div className="text-center py-20 border-2 border-dashed border-slate-800 rounded-xl text-slate-600 italic">
                   No se encontraron recursos que coincidan con la búsqueda.
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                   {filteredDocs.map(doc => (
                      <DocumentCard 
                        key={doc.id} 
                        doc={doc} 
                        syncingId={syncingId}
                        onSync={handleSyncWebsite}
                        onDelete={fetchDocuments} 
                      />
                   ))}
                </div>
              )}
           </div>
        </div>

        <CreateResourceDialog open={isDialogOpen} onOpenChange={setIsDialogOpen} userId={user?.id} onSuccess={fetchDocuments} />
      </div>
    </Layout>
  );
};

export default KnowledgeBase;