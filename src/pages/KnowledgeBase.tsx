import React, { useState } from 'react';
import Layout from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Search, FileText, Upload, BookOpen, FileCode, 
  HelpCircle, ExternalLink, Plus, MoreVertical, File
} from 'lucide-react';

const KnowledgeBase = () => {
  const [searchTerm, setSearchTerm] = useState('');

  // Simulated data
  const documents = [
    { id: 1, title: 'Manual de Producto: Cuencos', type: 'PDF', category: 'Productos', size: '2.4 MB', updated: '14 Feb 2026' },
    { id: 2, title: 'Política de Reembolsos 2026', type: 'DOC', category: 'Legal', size: '150 KB', updated: '10 Feb 2026' },
    { id: 3, title: 'Scripts de Cierre de Venta', type: 'TXT', category: 'Ventas', size: '45 KB', updated: '12 Feb 2026' },
    { id: 4, title: 'Guía de Hoteles en Tepoztlán', type: 'PDF', category: 'Logística', size: '5.1 MB', updated: '20 Ene 2026' },
    { id: 5, title: 'FAQ Técnico Cuencos', type: 'NOTION', category: 'Soporte', size: 'Link', updated: 'Today' },
    { id: 6, title: 'Precios Mayorista v2', type: 'SHEET', category: 'Ventas', size: 'Link', updated: 'Yesterday' },
  ];

  const filteredDocs = documents.filter(doc => 
    doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    doc.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
          <Button className="bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-900/20">
            <Upload className="w-4 h-4 mr-2" />
            Subir Recurso
          </Button>
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
                <span className="text-xs text-slate-500 uppercase tracking-wider">Documentos Activos</span>
             </div>
          </Card>
        </div>

        {/* Categories */}
        <Tabs defaultValue="all" className="w-full">
          <TabsList className="bg-slate-900 border border-slate-800 mb-6">
            <TabsTrigger value="all" className="data-[state=active]:bg-slate-800 data-[state=active]:text-white">Todo</TabsTrigger>
            <TabsTrigger value="products" className="data-[state=active]:bg-slate-800 data-[state=active]:text-white">Productos</TabsTrigger>
            <TabsTrigger value="sales" className="data-[state=active]:bg-slate-800 data-[state=active]:text-white">Ventas</TabsTrigger>
            <TabsTrigger value="legal" className="data-[state=active]:bg-slate-800 data-[state=active]:text-white">Legal & Soporte</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredDocs.map((doc) => (
                <Card key={doc.id} className="bg-slate-900 border-slate-800 hover:border-slate-700 transition-all group cursor-pointer">
                  <CardHeader className="flex flex-row items-start justify-between pb-2">
                    <div className="w-10 h-10 rounded bg-slate-800 flex items-center justify-center text-slate-400 group-hover:text-white group-hover:bg-indigo-600 transition-colors">
                      {doc.type === 'PDF' && <FileText className="w-5 h-5" />}
                      {doc.type === 'DOC' && <File className="w-5 h-5" />}
                      {doc.type === 'TXT' && <FileCode className="w-5 h-5" />}
                      {(doc.type === 'NOTION' || doc.type === 'SHEET') && <ExternalLink className="w-5 h-5" />}
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-white">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </CardHeader>
                  <CardContent className="pb-2">
                    <CardTitle className="text-base text-white mb-2 leading-tight">{doc.title}</CardTitle>
                    <div className="flex gap-2 mb-2">
                       <Badge variant="secondary" className="bg-slate-800 text-slate-400 text-[10px]">{doc.category}</Badge>
                       <Badge variant="outline" className="border-slate-700 text-slate-500 text-[10px]">{doc.type}</Badge>
                    </div>
                  </CardContent>
                  <CardFooter className="pt-2 border-t border-slate-800/50 flex justify-between text-xs text-slate-500">
                     <span>{doc.size}</span>
                     <span>Updated: {doc.updated}</span>
                  </CardFooter>
                </Card>
              ))}
              
              {/* Add New Card Placeholder */}
              <button className="border border-dashed border-slate-800 rounded-xl flex flex-col items-center justify-center gap-4 min-h-[180px] hover:bg-slate-900/50 hover:border-slate-700 transition-all group text-slate-500 hover:text-indigo-400">
                 <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Plus className="w-6 h-6" />
                 </div>
                 <span className="font-medium">Añadir Nuevo Recurso</span>
              </button>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default KnowledgeBase;