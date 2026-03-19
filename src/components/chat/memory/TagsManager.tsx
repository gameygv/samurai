"use client";

import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { Tag, ChevronDown, Globe, User, X, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { extractTagText } from '@/lib/tag-parser';

interface TagsManagerProps {
  memoryForm: any;
  allAvailableTags: any[];
  validGlobalTags: any[];
  validLocalTags: any[];
  onAddTag: (tag: string) => void;
  onRemoveTag: (tag: any) => void;
}

export const TagsManager = ({
  memoryForm, allAvailableTags, validGlobalTags, validLocalTags, onAddTag, onRemoveTag
}: TagsManagerProps) => {
  const [tagsOpen, setTagsOpen] = useState(true);

  return (
    <div className="pt-2 border-t border-[#1a1a1a]">
       <button onClick={() => setTagsOpen(!tagsOpen)} className="w-full flex justify-between items-center py-2 text-[10px] font-bold text-white uppercase tracking-widest hover:text-indigo-400 transition-colors">
          <span className="flex items-center gap-2"><Tag className="w-3.5 h-3.5 text-[#7A8A9E]" /> Etiquetas Asignadas</span>
          <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", tagsOpen ? "rotate-180" : "")} />
       </button>
       {tagsOpen && (
          <div className="flex flex-wrap gap-2 items-center pt-3 pb-2">
             {Array.isArray(memoryForm.tags) && memoryForm.tags.map((rawTag: any) => {
                const t = extractTagText(rawTag);
                if (!t) return null;
                const tagConf = allAvailableTags.find(lt => lt.text === t);
                const isGlobal = validGlobalTags.some(gt => gt.text === t);
                return (
                   <Badge key={t} style={{ backgroundColor: (tagConf?.color || '#161618') + '15', color: tagConf?.color || '#94a3b8', borderColor: (tagConf?.color || '#222225') + '40' }} className="text-[9px] h-6 border pr-1 pl-1.5 font-bold flex items-center gap-1.5 shadow-sm">
                      {isGlobal ? <Globe className="w-2.5 h-2.5 opacity-70 shrink-0"/> : <User className="w-2.5 h-2.5 opacity-70 shrink-0"/>}
                      <span className="truncate max-w-[120px]">{t}</span>
                      <button onClick={() => onRemoveTag(rawTag)} className="ml-0.5 hover:bg-black/20 rounded-full p-0.5 transition-colors"><X className="w-3 h-3"/></button>
                   </Badge>
                );
             })}
             
             <Select onValueChange={(v) => { if(v) onAddTag(v); }}>
                 <SelectTrigger className="h-6 text-[10px] bg-transparent border border-dashed border-[#333336] hover:bg-[#161618] text-slate-400 w-auto px-3 shadow-none focus:ring-0 rounded-full transition-colors">
                     <Plus className="w-3 h-3 mr-1" /> Añadir
                 </SelectTrigger>
                 <SelectContent className="bg-[#121214] border-[#222225] max-h-[300px]">
                     {validGlobalTags.length > 0 && (
                        <div className="text-[9px] font-bold text-slate-500 uppercase px-2 py-1.5 flex items-center gap-1.5">
                           <Globe className="w-3 h-3"/> Equipo (Globales)
                        </div>
                     )}
                     {validGlobalTags.map(tag => (
                         <SelectItem key={`g-${tag.id || tag.text}`} value={tag.text} className="text-xs text-white focus:bg-[#161618] cursor-pointer">
                             <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full shadow-inner" style={{backgroundColor: tag.color}}></div>{tag.text}</div>
                         </SelectItem>
                     ))}
                     {validLocalTags.length > 0 && (
                        <div className="text-[9px] font-bold text-slate-500 uppercase px-2 py-1.5 mt-2 flex items-center gap-1.5 border-t border-[#222225] pt-2">
                           <User className="w-3 h-3"/> Mis Etiquetas (Personal)
                        </div>
                     )}
                     {validLocalTags.map(tag => (
                         <SelectItem key={`l-${tag.id || tag.text}`} value={tag.text} className="text-xs text-white focus:bg-[#161618] cursor-pointer">
                             <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full shadow-inner" style={{backgroundColor: tag.color}}></div>{tag.text}</div>
                         </SelectItem>
                     ))}
                 </SelectContent>
             </Select>
          </div>
       )}
    </div>
  );
};