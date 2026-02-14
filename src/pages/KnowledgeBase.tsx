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
  ExternalLink, File, Loader2, Trash2, Download, AlertCircle
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
  
  // Form state
  const [formData, setFormData] = useState({
    title: '',
    type: 'PDF',
    category: 'Productos',
    external_link: '',
    description: '',
    content: '',
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
      
      // Auto-detectar tipo de archivo
      const extension = file.name.split('.').pop()?.toUpperCase();
      if (extension) {
        setFormData(prev => ({ ...prev, type: extension }));
      }
      
      // Auto-llenar título si está vacío
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

      // Si es modo archivo, subir a Storage
      if (formData.uploadMode === 'file' && selectedFile) {
        const uploadResult = await uploadFile(selectedFile);
        fileUrl = uploadResult.url;
        filePath = uploadResult.path;
        fileSize = `${(selectedFile.size / 1024).toFixed(2)} KB`;
      } else if (formData.uploadMode === 'link') {
        fileUrl = formData.external_link;
        fileSize = 'Link';
      }

      const { error } = await supabase
        .from('knowledge_documents')
        .insert({
          title: formData.title,
          type: formData.type,
          category: formData.category,
          file_url: fileUrl,
          file_path: filePath,
          external_link: formData.uploadMode === 'link' ? formData.external_link : null,
          size: fileSize,
          description: formData.description,
          content: formData.content,
          created_by: user?.id
        });

      if (error) throw error;

      await logActivity({
        action: 'CREATE',
        resource: 'BRAIN',
        description: `Documento "${formData.title}" añadido a Base de Conocimiento`,
        status: 'OK'
      });

      toast.success('Documento añadido correctamente');
      setIsDialogOpen(false);
      setFormData({
        title: '',
        type: 'PDF',
        category: 'Productos',
        external_link: '',
        description: '',
        content: '',
        uploadMode: 'file'
      });
      setSelectedFile(null);
      fetchDocuments();
    } catch (error: any) {
      console.error('Error creating document:', error);
      toast.error(`Error: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDocument = async (id: string, title: string, filePath?: string) => {
    if (!confirm(`¿Eliminar "${title}"?`)) return;

    try {
      // Si tiene archivo en storage, eliminarlo primero
      if (filePath) {
        const { error: storageError } = await supabase.storage
          .from('knowledge-files')
          .remove([filePath]);
        
        if (storageError) console.error('Error deleting file:', storageError);
      }

      const { error } = await supabase
        .from('knowledge_documents')
        .delete()
        .eq('id', id);

      if (error) throw error;

      await logActivity({
        action: 'DELETE',
        resource: 'BRAIN',
        description: `Documento "${title}" eliminado`,
        status: 'OK'
      });

      toast.success('Documento eliminado');
      fetchDocuments();
    } catch (error: any) {
      console.error('Error deleting document:', error);
      toast.error('Error al eliminar');
    }
  };

  const handleDownload = (url: string, title: string) => {
    window.open(url, '_blank');
  };

  const filteredDocs = documents.filter(doc => {
    const matchesSearch = doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         doc.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         doc.description?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = activeCategory === 'all' || doc.category.toLowerCase() === activeCategory.toLowerCase();
    
    return matchesSearch && matchesCategory;
  });

  const getCategoryCount = (category: string) => {
    if (category === 'all') return documents.length;
    return documents.filter(d => d.category.toLowerCase() === category.toLowerCase()).length;
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
            <p className="text-slate-400">Documentos y recursos que el Samurai usa para responder.</p>
          </div>
          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-900/20">
                <Upload className="w-4 h-4 mr-2" />
                Subir Recurso
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-2xl">
              <DialogHeader>
                <DialogTitle>Añadir Nuevo Documento</DialogTitle>
                <DialogDescription className="text-slate-400">
                  Sube un archivo o agrega un link externo.
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
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Link Externo
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
                            <p className="text-xs text-slate-600 mt-1">PDF, DOC, TXT, CSV, XLSX</p>
                          </div>
                        )}
                      </label>
                    </div>
                  </div>
                )}

                {/* Link Externo */}
                {formData.uploadMode === 'link' && (
                  <div className="space-y-2">
                    <Label>URL del Recurso</Label>
                    <Input 
                      value={formData.external_link}
                      onChange={e => setFormData({...formData, external_link: e.target.value})}
                      className="bg-slate-950 border-slate-800"
                      placeholder="https://notion.so/... o https://docs.google.com/..."
                      required={formData.uploadMode === 'link'}
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Título del Documento</Label>
                    <Input 
                      value={formData.title}
                      onChange={e => setFormData({...formData, title: e.target.value})}
                      className="bg-slate-950 border-slate-800"
                      placeholder="Ej: Manual de Cuencos 2026"
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
                        <SelectItem value="Productos">Productos</SelectItem>
                        <SelectItem value="Ventas">Ventas</SelectItem>
                        <SelectItem value="Legal">Legal</SelectItem>
                        <SelectItem value="Logística">Logística</SelectItem>
                        <SelectItem value="Soporte">Soporte</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Descripción Breve</Label>
                  <Textarea 
                    value={formData.description}
                    onChange={e => setFormData({...formData, description: e.target.value})}
                    className="bg-slate-950 border-slate-800 min-h-[80px]"
                    placeholder="¿De qué trata este documento?"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Contenido Indexable (Opcional)</Label>
                  <Textarea 
                    value={formData.content}
                    onChange={e => setFormData({...formData, content: e.target.value})}
                    className="bg-slate-950 border-slate-800 min-h-[120px] font-mono text-xs"
                    placeholder="Pega aquí el texto completo para que la IA pueda buscarlo..."
                  />
                </div>

                <DialogFooter>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => {
                      setIsDialogOpen(false);
                      setSelectedFile(null);
                    }} 
                    className="border-slate-700"
                    disabled={uploading}
                  >
                    Cancelar
                  </Button>
                  <Button 
                    type="submit" 
                    className="bg-indigo-600 hover:bg-indigo-700"
                    disabled={uploading || (formData.uploadMode === 'file' && !selectedFile)}
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Subiendo...
                      </>
                    ) : (
                      'Guardar Documento'
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search & Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="bg-slate-900 border-slate-800 md:col-span-3">
             <div className="p-2 flex items-center">
                <Search className="w-5 h-5 text-slate-500 ml-2" />
                <Input 
                   placeholder="Buscar documentos, guías o scripts..." 
                   className="border-0 bg-transparent text-lg focus-visible:ring-0 text-white placeholder:text-slate-600"
                   value={searchTerm}
                   onChange={(e) => setSearchTerm(e.target.value)}
                />
             </div>
          </Card>
          <Card className="bg-slate-900 border-slate-800 flex items-center justify-center">
             <div className="text-center">
                <span className="text-3xl font-bold text-white block">{documents.length}</span>
                <span className="text-xs text-slate-500 uppercase tracking-wider">Documentos</span>
             </div>
          </Card>
        </div>

        {/* Categories */}
        <Tabs value={activeCategory} onValueChange={setActiveCategory} className="w-full">
          <TabsList className="bg-slate-900 border border-slate-800 mb-6">
            <TabsTrigger value="all" className="data-[state=active]:bg-slate-800 data-[state=active]:text-white">
              Todo ({getCategoryCount('all')})
            </TabsTrigger>
            <TabsTrigger value="productos" className="data-[state=active]:bg-slate-800 data-[state=active]:text-white">
              Productos ({getCategoryCount('productos')})
            </TabsTrigger>
            <TabsTrigger value="ventas" className="data-[state=active]:bg-slate-800 data-[state=active]:text-white">
              Ventas ({getCategoryCount('ventas')})
            </TabsTrigger>
            <TabsTrigger value="legal" className="data-[state=active]:bg-slate-800 data-[state=active]:text-white">
              Legal ({getCategoryCount('legal')})
            </TabsTrigger>
            <TabsTrigger value="soporte" className="data-[state=active]:bg-slate-800 data-[state=active]:text-white">
              Soporte ({getCategoryCount('soporte')})
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeCategory} className="mt-0">
            {loading ? (
              <div className="flex justify-center items-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
              </div>
            ) : filteredDocs.length === 0 ? (
              <Card className="bg-slate-900/50 border-slate-800 border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <AlertCircle className="w-12 h-12 text-slate-600 mb-4" />
                  <p className="text-slate-500 text-center">
                    No hay documentos aún. <br />
                    <span className="text-slate-600">Sube el primer recurso para comenzar.</span>
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredDocs.map((doc) => (
                  <Card key={doc.id} className="bg-slate-900 border-slate-800 hover:border-slate-700 transition-all group">
                    <CardHeader className="flex flex-row items-start justify-between pb-2">
                      <div className="w-10 h-10 rounded bg-slate-800 flex items-center justify-center text-slate-400 group-hover:text-white group-hover:bg-indigo-600 transition-colors">
                        {doc.type === 'PDF' && <FileText className="w-5 h-5" />}
                        {doc.type === 'DOC' && <File className="w-5 h-5" />}
                        {doc.type === 'TXT' && <FileCode className="w-5 h-5" />}
                        {(doc.type === 'NOTION' || doc.type === 'SHEET' || doc.type === 'LINK') && <ExternalLink className="w-5 h-5" />}
                      </div>
                      <div className="flex gap-1">
                        {doc.file_url && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-slate-500 hover:text-indigo-400"
                            onClick={() => handleDownload(doc.file_url, doc.title)}
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                        )}
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-slate-500 hover:text-red-500"
                          onClick={() => handleDeleteDocument(doc.id, doc.title, doc.file_path)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="pb-2">
                      <CardTitle className="text-base text-white mb-2 leading-tight">{doc.title}</CardTitle>
                      {doc.description && (
                        <p className="text-xs text-slate-400 mb-2 line-clamp-2">{doc.description}</p>
                      )}
                      <div className="flex gap-2 mb-2">
                         <Badge variant="secondary" className="bg-slate-800 text-slate-400 text-[10px]">{doc.category}</Badge>
                         <Badge variant="outline" className="border-slate-700 text-slate-500 text-[10px]">{doc.type}</Badge>
                      </div>
                    </CardContent>
                    <CardFooter className="pt-2 border-t border-slate-800/50 flex justify-between text-xs text-slate-500">
                       <span>{doc.size || 'N/A'}</span>
                       <span>{new Date(doc.created_at).toLocaleDateString()}</span>
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