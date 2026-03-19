"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Edit2, ChevronDown, User, Smartphone, Mail, MapPin, Globe, Target, Fingerprint, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface IdentityCrmProps {
  isEditing: boolean;
  setIsEditing: (val: boolean) => void;
  memoryForm: any;
  setMemoryForm: (val: any) => void;
  onSave: () => void;
  saving: boolean;
  agentName: string;
  channelName: string;
  email: string;
  ciudad: string;
  estado: string;
  cp: string;
  summary: string;
  perfil: string;
}

export const IdentityCrm = ({
  isEditing, setIsEditing, memoryForm, setMemoryForm, onSave, saving,
  agentName, channelName, email, ciudad, estado, cp, summary, perfil
}: IdentityCrmProps) => {
  const [tacticalOpen, setTacticalOpen] = useState(true);

  return (
    <div className="p-5 border-b border-[#1a1a1a] space-y-4">
       <div className="flex justify-between items-center mb-2">
          <h4 className="text-[10px] font-bold text-[#7A8A9E] uppercase tracking-widest flex items-center gap-2">
             <Fingerprint className="w-3.5 h-3.5 text-[#7A8A9E]" /> Identidad & CRM
          </h4>
          {!isEditing && (
             <button onClick={() => setIsEditing(true)} className="text-[#7A8A9E] hover:text-white transition-colors" title="Edición Rápida">
                <Edit2 className="w-3.5 h-3.5" />
             </button>
          )}
       </div>

       {isEditing ? (
          <div className="space-y-4 bg-[#121214] p-4 rounded-xl border border-[#222225] animate-in fade-in">
             <div className="grid grid-cols-2 gap-2">
                <Input value={String(memoryForm.nombre)} onChange={e => setMemoryForm({...memoryForm, nombre: e.target.value})} placeholder="Nombre" className="h-8 text-xs bg-[#0a0a0c] border-[#222225]" />
                <Input value={String(memoryForm.ciudad)} onChange={e => setMemoryForm({...memoryForm, ciudad: e.target.value})} placeholder="Ciudad" className="h-8 text-xs bg-[#0a0a0c] border-[#222225]" />
             </div>
             <div className="grid grid-cols-2 gap-2">
                <Input value={String(memoryForm.estado || '')} onChange={e => setMemoryForm({...memoryForm, estado: e.target.value})} placeholder="Estado" className="h-8 text-xs bg-[#0a0a0c] border-[#222225]" />
                <Input value={String(memoryForm.cp || '')} onChange={e => setMemoryForm({...memoryForm, cp: e.target.value})} placeholder="C.P." className="h-8 text-xs bg-[#0a0a0c] border-[#222225]" />
             </div>
             <Input value={String(memoryForm.email)} onChange={e => setMemoryForm({...memoryForm, email: e.target.value})} placeholder="Email" className="h-8 text-xs bg-[#0a0a0c] border-[#222225]" />
             <Button onClick={onSave} disabled={saving} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white h-9 text-xs font-bold rounded-lg uppercase tracking-widest mt-2 shadow-lg">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Guardar Ficha"}
             </Button>
          </div>
       ) : (
          <div>
             <button onClick={() => setTacticalOpen(!tacticalOpen)} className="w-full flex justify-between items-center py-2 text-[10px] font-bold text-white uppercase tracking-widest hover:text-indigo-400 transition-colors">
                Resumen Táctico
                <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", tacticalOpen ? "rotate-180" : "")} />
             </button>
             {tacticalOpen && (
                <div className="grid grid-cols-2 gap-y-5 gap-x-4 pt-2 pb-4 animate-in slide-in-from-top-2">
                   <div>
                      <span className="text-[9px] text-[#7A8A9E] uppercase font-bold tracking-widest">Agente</span>
                      <p className="text-[11px] text-slate-300 mt-1 flex items-center gap-1.5"><User className="w-3 h-3 text-[#7A8A9E]"/> {agentName}</p>
                   </div>
                   <div>
                      <span className="text-[9px] text-[#7A8A9E] uppercase font-bold tracking-widest">Canal</span>
                      <p className="text-[11px] text-indigo-400 mt-1 flex items-center gap-1.5 font-bold"><Smartphone className="w-3 h-3 text-indigo-400"/> {channelName}</p>
                   </div>
                   <div className="col-span-2 grid grid-cols-2 gap-4 mt-1 mb-1 p-3 bg-[#121214] rounded-xl border border-[#222225]">
                      <div className="overflow-hidden">
                         <span className="text-[9px] text-[#7A8A9E] uppercase font-bold tracking-widest flex items-center gap-1"><Mail className="w-3 h-3"/> Email</span>
                         <p className="text-[11px] text-slate-300 mt-1 truncate" title={email || 'No capturado'}>{email || 'N/A'}</p>
                      </div>
                      <div className="overflow-hidden">
                         <span className="text-[9px] text-[#7A8A9E] uppercase font-bold tracking-widest flex items-center gap-1"><MapPin className="w-3 h-3"/> Ciudad</span>
                         <p className="text-[11px] text-slate-300 mt-1 truncate" title={ciudad || 'No capturada'}>{ciudad || 'N/A'}</p>
                      </div>
                      <div className="overflow-hidden">
                         <span className="text-[9px] text-[#7A8A9E] uppercase font-bold tracking-widest flex items-center gap-1"><Globe className="w-3 h-3"/> Estado</span>
                         <p className="text-[11px] text-slate-300 mt-1 truncate" title={estado || 'N/A'}>{estado || 'N/A'}</p>
                      </div>
                      <div className="overflow-hidden">
                         <span className="text-[9px] text-[#7A8A9E] uppercase font-bold tracking-widest flex items-center gap-1"><Target className="w-3 h-3"/> C.P.</span>
                         <p className="text-[11px] text-slate-300 mt-1 truncate font-mono" title={cp || 'N/A'}>{cp || 'N/A'}</p>
                      </div>
                   </div>
                   <div className="col-span-2">
                      <span className="text-[9px] text-[#7A8A9E] uppercase font-bold tracking-widest">Resumen IA</span>
                      <p className="text-[11px] text-emerald-400/80 italic mt-1 leading-relaxed">{summary}</p>
                   </div>
                   <div className="col-span-2">
                      <span className="text-[9px] text-[#7A8A9E] uppercase font-bold tracking-widest">Perfil Psicográfico</span>
                      <p className="text-[11px] text-amber-500/80 italic mt-1 leading-relaxed">{perfil}</p>
                   </div>
                </div>
             )}
          </div>
       )}
    </div>
  );
};