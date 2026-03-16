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
    <div className="space-y-6">
      <Card className="bg-slate-900 border-slate-800 border-l-4 border-l-amber-500">
        <CardHeader className="flex flex-row items-center justify-between border-b border-slate-800 bg-slate-950/30">
          <div>
              <CardTitle className="text-white flex items-center gap-2"><Tag className="w-5 h-5 text-amber-500" /> Etiquetas Globales</CardTitle>
              <CardDescription className="text-xs">Estas etiquetas las verán y podrán usar todos los vendedores.</CardDescription>
          </div>
          <Button onClick={onAddTag} className="bg-amber-600 hover:bg-amber-500 text-slate-900 h-9 text-xs rounded-xl shadow-lg font-bold"><Plus className="w-4 h-4 mr-2" /> Añadir Etiqueta</Button>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          {globalTags.map((tag) => (
              <div key={tag.id} className="p-4 bg-slate-950 border border-slate-800 rounded-xl flex gap-4 items-center group">
                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-bold text-slate-500">Texto de la Etiqueta</Label>
                      <Input value={tag.text} onChange={e => onUpdateTag(tag.id, 'text', e.target.value.toUpperCase())} placeholder="Ej: URGENTE" className="bg-slate-900 border-slate-700 h-9 text-xs font-bold text-white uppercase" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-bold text-slate-500">Color (Hex/Tailwind)</Label>
                      <div className="flex items-center gap-2">
                          <input type="color" value={tag.color} onChange={e => onUpdateTag(tag.id, 'color', e.target.value)} className="w-9 h-9 rounded cursor-pointer bg-slate-900 border border-slate-700 p-0" />
                          <Input value={tag.color} onChange={e => onUpdateTag(tag.id, 'color', e.target.value)} className="bg-slate-900 border-slate-700 h-9 text-xs font-mono w-28" />
                          <Badge style={{ backgroundColor: tag.color + '20', color: tag.color, borderColor: tag.color + '50' }} className="ml-4 px-3 border shadow-sm">{tag.text || 'VISTA PREVIA'}</Badge>
                      </div>
                    </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => onRemoveTag(tag.id)} className="text-slate-500 hover:text-red-500 mt-5"><Trash2 className="w-4 h-4" /></Button>
              </div>
          ))}
        </CardContent>
      </Card>

      <Card className="bg-slate-900 border-slate-800 border-l-4 border-l-indigo-500">
        <CardHeader className="flex flex-row items-center justify-between border-b border-slate-800 bg-slate-950/30">
          <div>
              <CardTitle className="text-white flex items-center gap-2"><MessageSquarePlus className="w-5 h-5 text-indigo-400" /> Plantillas Globales</CardTitle>
              <CardDescription className="text-xs">Respuestas predeterminadas para todo el equipo.</CardDescription>
          </div>
          <Button onClick={onAddQuickReply} className="bg-indigo-900 hover:bg-indigo-800 text-amber-500 h-9 text-xs rounded-xl shadow-lg"><Plus className="w-4 h-4 mr-2" /> Añadir Plantilla</Button>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          {quickReplies.map((qr) => (
              <div key={qr.id} className="p-4 bg-slate-950 border border-slate-800 rounded-xl flex gap-4 items-start group">
                <div className="flex-1 space-y-3">
                    <Input value={qr.title} onChange={e => onUpdateQuickReply(qr.id, 'title', e.target.value)} placeholder="Título (Ej: Info Retiro)" className="bg-slate-900 border-slate-700 h-9 text-xs font-bold" />
                    <Textarea value={qr.text} onChange={e => onUpdateQuickReply(qr.id, 'text', e.target.value)} placeholder="Mensaje..." className="bg-slate-900 border-slate-700 text-xs min-h-[80px]" />
                </div>
                <Button variant="ghost" size="icon" onClick={() => onRemoveQuickReply(qr.id)} className="text-slate-500 hover:text-red-500"><Trash2 className="w-4 h-4" /></Button>
              </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};