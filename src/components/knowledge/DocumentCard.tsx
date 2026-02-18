import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Globe, FileText, ExternalLink, Download, Trash2, Info, Loader2, RefreshCw, AlertCircle } from 'lucide-react';

interface DocumentCardProps {
  doc: any;
  syncingId: string | null;
  onSync: (id: string, url: string) => void;
  onDelete: (id: string, title: string, filePath?: string) => void;
}

export const DocumentCard = ({ doc, syncingId, onSync, onDelete }: DocumentCardProps) => {
  return (
    <Card className={`bg-slate-900 border-slate-800 hover:border-slate-700 transition-all group relative overflow-hidden ${doc.type === 'WEBSITE' ? 'border-l-4 border-l-indigo-500' : ''}`}>
      
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
               onClick={() => onSync(doc.id, doc.external_link)}
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
          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-red-500" onClick={() => onDelete(doc.id, doc.title, doc.file_path)}>
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
  );
};