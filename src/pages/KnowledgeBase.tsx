import React, { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Search, FileText, Upload, BookOpen, FileCode, 
  ExternalLink, File, Loader2, Trash2, Download, AlertCircle, Globe, Link as LinkIcon, Info, RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import { logActivity } from '@/utils/logger';

const KnowledgeBase = () => {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState('all');
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    title: '',
    type: 'PDF',
    category: 'Talleres',
    external_link: '',
    description: '', // Usado para "Cómo se utiliza" en webs
    content: '', // Usado para el contenido/resumen
    uploadMode: 'file' // 'file' o 'link'
  });

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
    const filePath = `${user?.id}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('knowledge-files')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage
      .from('knowledge-files')
      .getPublicUrl(filePath);

    return { path: filePath, url: urlData.publicUrl };
  };

  const handleCreateDocument = async (e: React.FormEvent) => {
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
          created_by: user?.id
        });

      if (error) throw error;

      await logActivity({
        action: 'CREATE',
        resource: 'BRAIN',
        description: `Recurso "${formData.title}" añadido a Base de Conocimiento`,
        status: 'OK'
      });

      toast.success('Recurso añadido correctamente');
      setIsDialogOpen(false);
      resetForm();
      fetchDocuments();
    } catch (error: any) {
      console.error('Error creating document:', error);
      toast.error(`Error: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleSyncWebsite = async (id: string, url: string) => {
     if (!url) return toast.error("No hay URL válida para sincronizar");
     setSyncingId(id);
     
     try {
        // 1. Llamar a la Edge Function para scrapear
        const { data: scrapeData, error: scrapeError } = await supabase.functions.invoke('scrape-website', {
           body: { url }
        });

        if (scrapeError || !scrapeData.success) {
           throw new Error(scrapeError?.message || scrapeData?.error || "Fallo en el scraping");
        }

        const newContent = scrapeData.content;
        const chars = scrapeData.length;

        // 2. Actualizar la base de datos
        const { error: dbError } = await supabase
           .from('knowledge_documents')
           .update({ 
              content: newContent,
              updated_at: new Date().toISOString()
           })
           .eq('id', id);

        if (dbError) throw dbError;

        toast.success(`Sincronización completa. Leídos ${chars} caracteres.`);
        fetchDocuments(); // Refrescar vista
        
     } catch (err: any) {
        toast.error(`Error de sincronización: ${err.message}`);
     } finally {
        setSyncingId(null);
     }
  };

  const resetForm = () => {
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
    
    // Si estamos en tab "Sitios Web", solo mostrar type WEBSITE
    if (activeCategory === 'websites') {
        return doc.type === 'WEBSITE' && matchesSearch;
    }
    
    // Si estamos en otros tabs, ocultar WEBSITE
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
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-2">
              <BookOpen className="w-8 h-8 text-indigo-500" />
              Base de Conocimiento
            </h1>
            <p className="text-slate-400">Recursos de The Elephant Bowl (Talleres, Maestros e Instrumentos).</p>
          </div>
          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-900/20" onClick={resetForm}>
                <Upload className="w-4 h-4 mr-2" />
                Nuevo Recurso
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Añadir Recurso</DialogTitle>
                <DialogDescription className="text-slate-400">
                  Sube documentos o añade sitios web de Maestros/Eventos.
                </DialogDescription>
              </DialogHeader>
              
              <form onSubmit={handleCreateDocument} className="space-y-4 pt-4">
                
                {/* Modo de Upload */}
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

                {/* Upload de Archivo */}
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

                {/* Link Externo */}
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

                {/* Campos Comunes */}
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

                {/* Contenido / Resumen */}
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
                  <Button type="button" variant="ghost" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                  <Button type="submit" className="bg-indigo-600" disabled={uploading}>
                    {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Guardar en Memoria'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search */}
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

        {/* Categories Tabs */}
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
                  <Card key={doc.id} className={`bg-slate-900 border-slate-800 hover:border-slate-700 transition-all group relative overflow-hidden ${doc.type === 'WEBSITE' ? 'border-l-4 border-l-indigo-500' : ''}`}>
                    
                    {doc.type === 'WEBSITE' && (
                       <div className="absolute top-0 right-0 bg-indigo-600 text-white text-[9px] px-2 py-0.5 rounded-bl font-bold tracking-wider">WEB</div>
                    )}

                    <CardHeader className="flex flex-row items-start justify-between pb-2">
                      <div className="w-10 h-10 rounded bg-slate-950 flex items-center justify-center text-slate-400 group-hover:text-white group-hover:bg-slate-800 transition-colors border border-slate-800">
                        {doc.type === 'WEBSITE' ? <Globe className="w-5 h-5 text-indigo-400" /> : <FileText className="w-5 h-5" />}
                      </div>
                      <div className="flex gap-1 z-10">
                        {doc.type === 'WEBSITE' && (
                           <Button 
                             variant="secondary" 
                             size="icon" 
                             className="h-8 w-8 bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600 hover:text-white border border-indigo-500/30" 
                             title="Sincronizar contenido desde la web"
                             disabled={syncingId === doc.id}
                             onClick={() => handleSyncWebsite(doc.id, doc.external_link)}
                           >
                             {syncingId === doc.id ? <Loader2 className="w-4 h-4 animate-spin"/> : <RefreshCw className="w-4 h-4" />}
                           </Button>
                        )}

                        {doc.external_link && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-indigo-400" onClick={() => window.open(doc.external_link, '_blank')}>
                            <ExternalLink className="w-4 h-4" />
                          </Button>
                        )}
                        {doc.file_url && doc.type !== 'WEBSITE' && (
                           <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-green-400" onClick={() => window.open(doc.file_url, '_blank')}>
                              <Download className="w-4 h-4" />
                           </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-red-500" onClick={() => handleDeleteDocument(doc.id, doc.title, doc.file_path)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    
                    <CardContent className="pb-2">
                      <CardTitle className="text-base text-white mb-2 leading-tight pr-4">{doc.title}</CardTitle>
                      
                      {/* Instrucción de Uso (Description) */}
                      {doc.description && (
                         <div className="mb-3 bg-slate-950/50 p-2 rounded border border-slate-800/50">
                            <p className="text-[10px] text-indigo-300 font-bold uppercase mb-1 flex items-center gap-1">
                               <Info className="w-3 h-3"/> Instrucción
                            </p>
                            <p className="text-xs text-slate-400 line-clamp-2 italic">"{doc.description}"</p>
                         </div>
                      )}
                      
                      {/* Contenido Clave (Content) */}
                      <div className="space-y-1">
                          <div className="flex justify-between items-center">
                              <p className="text-[10px] text-slate-500 uppercase font-bold">Información Indexada:</p>
                              <span className="text-[9px] text-slate-600 font-mono">{doc.content ? `${doc.content.length} chars` : 'Vacío'}</span>
                          </div>
                          {doc.content ? (
                             <p className="text-xs text-slate-400 line-clamp-3 font-mono bg-slate-950 p-2 rounded border border-slate-800/50">{doc.content}</p>
                          ) : (
                             <div className="bg-slate-950 p-2 rounded border border-dashed border-slate-800 flex items-center justify-center gap-2 text-slate-600">
                                <AlertCircle className="w-3 h-3" />
                                <span className="text-[10px] italic">Requiere sincronización</span>
                             </div>
                          )}
                      </div>

                      <div className="flex gap-2 mt-3">
                         <Badge variant="secondary" className="bg-slate-800 text-slate-400 text-[10px]">{doc.category}</Badge>
                      </div>
                    </CardContent>
                    
                    <CardFooter className="pt-2 border-t border-slate-800/50 flex justify-between text-xs text-slate-500">
                       <span className="truncate max-w-[150px]">{doc.external_link || doc.size}</span>
                       <span title="Última actualización">
                          {doc.updated_at ? new Date(doc.updated_at).toLocaleDateString() : new Date(doc.created_at).toLocaleDateString()}
                       </span>
                    </CardFooter>
                  </Card>
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