import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { MessageSquarePlus, Tag, Plus, Trash2 } from 'lucide-react';

interface TemplatesTabProps {
  globalTags: any[];
  onAddTag: () => void;
  onUpdateTag: (id: string, field: string, value: string) => void;
  onRemoveTag: (id: string) => void;
  quickReplies: any[];
  onAddQuickReply: () => void;
  onUpdateQuickReply: (id: string, field: string, value: string) => void;
  onRemoveQuickReply: (id: string) => void;
}

export const TemplatesTab = ({
  globalTags, onAddTag, onUpdateTag, onRemoveTag,
  quickReplies, onAddQuickReply, onUpdateQuickReply, onRemoveQuickReply
}: TemplatesTabProps) => {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* ETIQUETAS GLOBALES */}
      <Card className="bg-[#0f0f11] border-[#222225] border-l-4 border-l-amber-500 shadow-2xl overflow-hidden rounded-2xl">
        <CardHeader className="flex flex-row items-center justify-between border-b border-[#161618] bg-[#161618] px-6 py-5">
          <div className="space-y-1">
              <CardTitle className="text-white flex items-center gap-2 text-base font-bold tracking-wide">
                 <Tag className="w-5 h-5 text-amber-500" /> Etiquetas Globales
              </CardTitle>
              <CardDescription className="text-xs text-slate-400">
                 Estas etiquetas las verán y podrán usar todos los vendedores.
              </CardDescription>
          </div>
          <Button onClick={onAddTag} className="bg-amber-600 hover:bg-amber-500 text-slate-950 h-10 px-5 text-xs rounded-xl shadow-lg font-bold uppercase tracking-widest transition-all hover:scale-105">
             <Plus className="w-4 h-4 mr-2" /> Añadir Etiqueta
          </Button>
        </CardHeader>
        
        <CardContent className="space-y-4 p-6 bg-[#0a0a0c]">
          {globalTags.length === 0 ? (
             <div className="text-center py-10 text-slate-600 italic uppercase text-[10px] font-bold tracking-widest">No hay etiquetas globales definidas.</div>
          ) : globalTags.map((tag) => (
              <div key={tag.id} className="p-5 bg-[#161618] border border-[#222225] rounded-xl flex gap-6 items-center group transition-colors hover:border-[#333336]">
                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest ml-1">Texto de la Etiqueta</Label>
                      <Input 
                         value={tag.text} 
                         onChange={e => onUpdateTag(tag.id, 'text', e.target.value.toUpperCase())} 
                         placeholder="Ej: URGENTE" 
                         className="bg-[#0a0a0c] border-[#222225] h-11 text-sm font-bold text-slate-200 uppercase focus-visible:ring-amber-500/50 rounded-xl" 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest ml-1">Color (Hex)</Label>
                      <div className="flex items-center gap-3">
                          <div className="relative shrink-0">
                             <input 
                               type="color" 
                               value={tag.color} 
                               onChange={e => onUpdateTag(tag.id, 'color', e.target.value)} 
                               className="absolute inset-0 opacity-0 w-full h-full cursor-pointer" 
                             />
                             <div className="w-11 h-11 rounded-xl border-2 border-[#222225] shadow-inner" style={{ backgroundColor: tag.color }}></div>
                          </div>
                          <Input 
                             value={tag.color} 
                             onChange={e => onUpdateTag(tag.id, 'color', e.target.value)} 
                             className="bg-[#0a0a0c] border-[#222225] h-11 text-xs font-mono w-28 text-slate-300 focus-visible:ring-amber-500/50 rounded-xl" 
                          />
                          <div className="flex-1 flex justify-end">
                             <Badge style={{ backgroundColor: tag.color + '15', color: tag.color, borderColor: tag.color + '40' }} className="px-4 py-1.5 border shadow-sm text-xs font-bold">
                                {tag.text || 'VISTA PREVIA'}
                             </Badge>
                          </div>
                      </div>
                    </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => onRemoveTag(tag.id)} className="text-slate-600 hover:bg-red-500/10 hover:text-red-500 h-11 w-11 rounded-xl shrink-0">
                   <Trash2 className="w-5 h-5" />
                </Button>
              </div>
          ))}
        </CardContent>
      </Card>

      {/* PLANTILLAS GLOBALES */}
      <Card className="bg-[#0f0f11] border-[#222225] border-l-4 border-l-indigo-600 shadow-2xl overflow-hidden rounded-2xl">
        <CardHeader className="flex flex-row items-center justify-between border-b border-[#161618] bg-[#161618] px-6 py-5">
          <div className="space-y-1">
              <CardTitle className="text-white flex items-center gap-2 text-base font-bold tracking-wide">
                 <MessageSquarePlus className="w-5 h-5 text-indigo-500" /> Plantillas Globales
              </CardTitle>
              <CardDescription className="text-xs text-slate-400">
                 Respuestas predeterminadas para todo el equipo.
              </CardDescription>
          </div>
          <Button onClick={onAddQuickReply} className="bg-indigo-600 hover:bg-indigo-500 text-white h-10 px-5 text-xs rounded-xl shadow-lg font-bold uppercase tracking-widest transition-all hover:scale-105">
             <Plus className="w-4 h-4 mr-2" /> Añadir Plantilla
          </Button>
        </CardHeader>
        
        <CardContent className="space-y-4 p-6 bg-[#0a0a0c]">
          {quickReplies.length === 0 ? (
             <div className="text-center py-10 text-slate-600 italic uppercase text-[10px] font-bold tracking-widest">No hay plantillas globales definidas.</div>
          ) : quickReplies.map((qr) => (
              <div key={qr.id} className="p-5 bg-[#161618] border border-[#222225] rounded-xl flex gap-6 items-start group transition-colors hover:border-[#333336]">
                <div className="flex-1 space-y-4">
                    <div className="space-y-2">
                       <Label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest ml-1">Título de la Plantilla</Label>
                       <Input 
                          value={qr.title} 
                          onChange={e => onUpdateQuickReply(qr.id, 'title', e.target.value)} 
                          placeholder="Ej: Info Retiro Noviembre" 
                          className="bg-[#0a0a0c] border-[#222225] h-11 text-sm font-bold text-slate-200 focus-visible:ring-indigo-500/50 rounded-xl" 
                       />
                    </div>
                    <div className="space-y-2">
                       <Label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest ml-1">Cuerpo del Mensaje</Label>
                       <Textarea 
                          value={qr.text} 
                          onChange={e => onUpdateQuickReply(qr.id, 'text', e.target.value)} 
                          placeholder="Escribe el mensaje completo aquí..." 
                          className="bg-[#0a0a0c] border-[#222225] text-sm min-h-[100px] text-slate-300 focus-visible:ring-indigo-500/50 rounded-xl leading-relaxed resize-none" 
                       />
                    </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => onRemoveQuickReply(qr.id)} className="text-slate-600 hover:bg-red-500/10 hover:text-red-500 h-11 w-11 mt-7 rounded-xl shrink-0">
                   <Trash2 className="w-5 h-5" />
                </Button>
              </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};