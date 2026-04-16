"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Edit2, ChevronDown, User, Smartphone, Mail, MapPin, Globe, Target, Fingerprint, Loader2, Sparkles, FileText, Building2 } from 'lucide-react';
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
  onRunAnalysis: () => void;
  analyzing: boolean;
  agents: any[];
  isManager: boolean;
  onAgentChange: (agentId: string) => void;
}

const GENERO_OPTIONS = [
  { value: '', label: 'No definido' },
  { value: 'f', label: 'Femenino' },
  { value: 'm', label: 'Masculino' },
];

const USO_CFDI_OPTIONS = [
  { value: '', label: 'No definido' },
  { value: 'G01', label: 'G01 — Adquisición de mercancías' },
  { value: 'G03', label: 'G03 — Gastos en general' },
  { value: 'D10', label: 'D10 — Pago de servicios educativos' },
  { value: 'S01', label: 'S01 — Sin efectos fiscales' },
  { value: 'CP01', label: 'CP01 — Pagos' },
];

const REGIMEN_OPTIONS = [
  { value: '', label: 'No definido' },
  { value: '601', label: '601 — General de Ley PM' },
  { value: '603', label: '603 — Personas morales sin fines de lucro' },
  { value: '605', label: '605 — Sueldos y salarios' },
  { value: '606', label: '606 — Arrendamiento' },
  { value: '612', label: '612 — Personas físicas con act. empresarial' },
  { value: '616', label: '616 — Sin obligaciones fiscales' },
  { value: '621', label: '621 — Incorporación fiscal' },
  { value: '625', label: '625 — Régimen de act. agrícolas' },
  { value: '626', label: '626 — Simplificado de confianza (RESICO)' },
];

export const IdentityCrm = ({
  isEditing, setIsEditing, memoryForm, setMemoryForm, onSave, saving,
  agentName, channelName, email, ciudad, estado, cp, summary, perfil,
  onRunAnalysis, analyzing, agents, isManager, onAgentChange
}: IdentityCrmProps) => {
  const [tacticalOpen, setTacticalOpen] = useState(true);
  const [fiscalOpen, setFiscalOpen] = useState(false);

  const generoLabel = memoryForm.genero === 'f' ? 'Femenino' : memoryForm.genero === 'm' ? 'Masculino' : 'N/A';

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
             {/* Datos personales */}
             <div className="grid grid-cols-2 gap-2">
                <Input value={String(memoryForm.nombre)} onChange={e => setMemoryForm({...memoryForm, nombre: e.target.value})} placeholder="Nombre" className="h-8 text-xs bg-[#0a0a0c] border-[#222225]" />
                <Select value={memoryForm.genero || ''} onValueChange={v => setMemoryForm({...memoryForm, genero: v || ''})}>
                   <SelectTrigger className="h-8 text-xs bg-[#0a0a0c] border-[#222225]"><SelectValue placeholder="Género" /></SelectTrigger>
                   <SelectContent className="bg-[#161618] border-[#222225] text-white">
                      {GENERO_OPTIONS.map(o => <SelectItem key={o.value} value={o.value || 'none'}>{o.label}</SelectItem>)}
                   </SelectContent>
                </Select>
             </div>
             <Input value={String(memoryForm.email)} onChange={e => setMemoryForm({...memoryForm, email: e.target.value})} placeholder="Email" className="h-8 text-xs bg-[#0a0a0c] border-[#222225]" />
             <div className="grid grid-cols-2 gap-2">
                <Input value={String(memoryForm.ciudad)} onChange={e => setMemoryForm({...memoryForm, ciudad: e.target.value})} placeholder="Ciudad" className="h-8 text-xs bg-[#0a0a0c] border-[#222225]" />
                <Input value={String(memoryForm.estado || '')} onChange={e => setMemoryForm({...memoryForm, estado: e.target.value})} placeholder="Estado" className="h-8 text-xs bg-[#0a0a0c] border-[#222225]" />
             </div>
             <div className="grid grid-cols-2 gap-2">
                <Input value={String(memoryForm.cp || '')} onChange={e => setMemoryForm({...memoryForm, cp: e.target.value})} placeholder="C.P." className="h-8 text-xs bg-[#0a0a0c] border-[#222225]" />
                <Input value={String(memoryForm.direccion || '')} onChange={e => setMemoryForm({...memoryForm, direccion: e.target.value})} placeholder="Dirección" className="h-8 text-xs bg-[#0a0a0c] border-[#222225]" />
             </div>

             {/* Datos fiscales */}
             <div className="border-t border-[#222225] pt-3">
                <span className="text-[9px] text-[#7A8A9E] uppercase font-bold tracking-widest flex items-center gap-1.5 mb-2">
                   <Building2 className="w-3 h-3" /> Datos fiscales (CFDI)
                </span>
                <div className="space-y-2">
                   <Input value={String(memoryForm.rfc || '')} onChange={e => setMemoryForm({...memoryForm, rfc: e.target.value.toUpperCase()})} placeholder="RFC (ej: XAXX010101000)" maxLength={13} className="h-8 text-xs bg-[#0a0a0c] border-[#222225] font-mono uppercase" />
                   <div className="grid grid-cols-2 gap-2">
                      <Select value={memoryForm.uso_cfdi || ''} onValueChange={v => setMemoryForm({...memoryForm, uso_cfdi: v || ''})}>
                         <SelectTrigger className="h-8 text-xs bg-[#0a0a0c] border-[#222225]"><SelectValue placeholder="Uso CFDI" /></SelectTrigger>
                         <SelectContent className="bg-[#161618] border-[#222225] text-white max-h-48">
                            {USO_CFDI_OPTIONS.map(o => <SelectItem key={o.value} value={o.value || 'none'}>{o.label}</SelectItem>)}
                         </SelectContent>
                      </Select>
                      <Select value={memoryForm.regimen_fiscal || ''} onValueChange={v => setMemoryForm({...memoryForm, regimen_fiscal: v || ''})}>
                         <SelectTrigger className="h-8 text-xs bg-[#0a0a0c] border-[#222225]"><SelectValue placeholder="Régimen fiscal" /></SelectTrigger>
                         <SelectContent className="bg-[#161618] border-[#222225] text-white max-h-48">
                            {REGIMEN_OPTIONS.map(o => <SelectItem key={o.value} value={o.value || 'none'}>{o.label}</SelectItem>)}
                         </SelectContent>
                      </Select>
                   </div>
                   <Input value={String(memoryForm.csf_url || '')} onChange={e => setMemoryForm({...memoryForm, csf_url: e.target.value})} placeholder="URL de Constancia de Situación Fiscal (PDF)" className="h-8 text-xs bg-[#0a0a0c] border-[#222225]" />
                </div>
             </div>

             <div className="flex gap-2 mt-2 pt-2 border-t border-[#222225]">
                <Button onClick={onRunAnalysis} disabled={analyzing || saving} variant="outline" className="flex-1 h-9 text-xs bg-indigo-950/20 text-indigo-400 border-indigo-500/30 hover:bg-indigo-900/40 uppercase font-bold tracking-widest">
                   {analyzing ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Sparkles className="w-3.5 h-3.5 mr-1.5" />} IA
                </Button>
                <Button onClick={onSave} disabled={saving || analyzing} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white h-9 text-xs font-bold rounded-lg uppercase tracking-widest shadow-lg">
                   {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Guardar"}
                </Button>
             </div>
          </div>
       ) : (
          <div className="space-y-3">
             <button onClick={() => setTacticalOpen(!tacticalOpen)} className="w-full flex justify-between items-center py-2 text-[10px] font-bold text-white uppercase tracking-widest hover:text-indigo-400 transition-colors">
                Resumen Táctico
                <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", tacticalOpen ? "rotate-180" : "")} />
             </button>
             {tacticalOpen && (
                <div className="grid grid-cols-2 gap-y-5 gap-x-4 pt-2 pb-4 animate-in slide-in-from-top-2">

                   {/* ASIGNACIÓN DE AGENTE DIRECTA */}
                   <div className={cn("col-span-2", isManager ? "mb-2" : "mb-0")}>
                      <span className="text-[9px] text-[#7A8A9E] uppercase font-bold tracking-widest mb-1.5 flex items-center gap-1.5"><User className="w-3 h-3 text-[#7A8A9E]"/> Agente Asignado</span>
                      {isManager ? (
                         <Select value={memoryForm.assigned_to || 'unassigned'} onValueChange={onAgentChange}>
                            <SelectTrigger className="h-8 text-xs bg-[#121214] border-[#222225] font-bold text-slate-300 w-full"><SelectValue placeholder="Bot Global"/></SelectTrigger>
                            <SelectContent className="bg-[#161618] border-[#222225] text-white">
                               <SelectItem value="unassigned">Sin asignar (Bot Global)</SelectItem>
                               {agents.map(a => <SelectItem key={a.id} value={a.id}>{a.full_name}</SelectItem>)}
                            </SelectContent>
                         </Select>
                      ) : (
                         <p className="text-[11px] text-slate-300 font-bold">{agentName}</p>
                      )}
                   </div>

                   <div>
                      <span className="text-[9px] text-[#7A8A9E] uppercase font-bold tracking-widest">Canal</span>
                      <p className="text-[11px] text-indigo-400 mt-1 flex items-center gap-1.5 font-bold"><Smartphone className="w-3 h-3 text-indigo-400"/> {channelName}</p>
                   </div>
                   <div>
                      <span className="text-[9px] text-[#7A8A9E] uppercase font-bold tracking-widest">Género</span>
                      <p className="text-[11px] text-slate-300 mt-1">{generoLabel}</p>
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
                   {memoryForm.direccion && (
                      <div className="col-span-2">
                         <span className="text-[9px] text-[#7A8A9E] uppercase font-bold tracking-widest flex items-center gap-1"><MapPin className="w-3 h-3"/> Dirección</span>
                         <p className="text-[11px] text-slate-300 mt-1">{memoryForm.direccion}</p>
                      </div>
                   )}

                   {/* Datos fiscales (colapsable) */}
                   <div className="col-span-2">
                      <button onClick={() => setFiscalOpen(!fiscalOpen)} className="w-full flex justify-between items-center py-1.5 text-[9px] font-bold text-[#7A8A9E] uppercase tracking-widest hover:text-amber-400 transition-colors">
                         <span className="flex items-center gap-1.5"><Building2 className="w-3 h-3"/> Datos Fiscales</span>
                         <ChevronDown className={cn("w-3 h-3 transition-transform", fiscalOpen ? "rotate-180" : "")} />
                      </button>
                      {fiscalOpen && (
                         <div className="grid grid-cols-2 gap-3 mt-2 p-3 bg-[#121214] rounded-xl border border-[#222225] animate-in slide-in-from-top-2">
                            <div className="overflow-hidden">
                               <span className="text-[9px] text-[#7A8A9E] uppercase font-bold tracking-widest">RFC</span>
                               <p className="text-[11px] text-slate-300 mt-1 font-mono">{memoryForm.rfc || 'N/A'}</p>
                            </div>
                            <div className="overflow-hidden">
                               <span className="text-[9px] text-[#7A8A9E] uppercase font-bold tracking-widest">Uso CFDI</span>
                               <p className="text-[11px] text-slate-300 mt-1 font-mono">{memoryForm.uso_cfdi || 'N/A'}</p>
                            </div>
                            <div className="overflow-hidden">
                               <span className="text-[9px] text-[#7A8A9E] uppercase font-bold tracking-widest">Régimen Fiscal</span>
                               <p className="text-[11px] text-slate-300 mt-1 font-mono">{memoryForm.regimen_fiscal || 'N/A'}</p>
                            </div>
                            <div className="overflow-hidden">
                               <span className="text-[9px] text-[#7A8A9E] uppercase font-bold tracking-widest flex items-center gap-1"><FileText className="w-3 h-3"/> CSF</span>
                               {memoryForm.csf_url ? (
                                  <a href={memoryForm.csf_url} target="_blank" rel="noopener noreferrer" className="text-[11px] text-indigo-400 mt-1 underline truncate block">Ver PDF</a>
                               ) : (
                                  <p className="text-[11px] text-slate-300 mt-1">N/A</p>
                               )}
                            </div>
                         </div>
                      )}
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
