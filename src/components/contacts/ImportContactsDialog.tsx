"use client";

import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Upload, Loader2, FileSpreadsheet, CheckCircle2, Users } from 'lucide-react';
import { toast } from 'sonner';

interface ImportContactsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export const ImportContactsDialog = ({ open, onOpenChange, onSuccess }: ImportContactsDialogProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<{ total: number, processed: number }>({ total: 0, processed: 0 });
  
  const [groupName, setGroupName] = useState("");
  const [existingGroups, setExistingGroups] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      setFile(null);
      setGroupName("");
      setProgress({ total: 0, processed: 0 });
      // Cargar grupos existentes para autocompletar
      supabase.from('contacts').select('grupo').not('grupo', 'is', null).then(({data}) => {
        if (data) {
          const unique = Array.from(new Set(data.map(d => d.grupo)));
          setExistingGroups(unique as string[]);
        }
      });
    }
  }, [open]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleImport = () => {
    if (!file) return;
    setUploading(true);
    
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const rows = results.data as any[];
        
        const formattedContacts = rows.map(row => {
            let cleanPhone = row.phone ? String(row.phone).replace(/\D/g, '') : null;
            if (!cleanPhone || cleanPhone.length < 10) return null;
            
            if (cleanPhone.length === 10) {
               cleanPhone = '52' + cleanPhone;
            }

            let tags: string[] = [];
            const stdKeys = ['phone', 'email', 'fn', 'ln', 'ct', 'st', 'zip', 'country', 'add_to_messaging_customer_base_for_whatsapp', 'value', 'dob', 'gen', 'age', 'madid', 'uid'];
            
            Object.entries(row).forEach(([k, v]) => {
                if (!stdKeys.includes(k.toLowerCase()) && v && String(v).trim() !== '') {
                    tags.push(String(v).trim());
                }
            });
            
            if (row.add_to_messaging_customer_base_for_whatsapp) tags.push(String(row.add_to_messaging_customer_base_for_whatsapp).trim());
            if (row.value) tags.push(`Nivel: ${row.value}`);
            if (row.madid) tags.push(String(row.madid).trim());

            return {
                telefono: cleanPhone,
                email: row.email ? String(row.email).trim() : null,
                nombre: row.fn ? String(row.fn).trim() : 'Desconocido',
                apellido: row.ln ? String(row.ln).trim() : null,
                ciudad: row.ct ? String(row.ct).trim() : null,
                estado: row.st ? String(row.st).trim() : null,
                cp: row.zip ? String(row.zip).trim() : null,
                pais: row.country ? String(row.country).trim() : 'mx',
                tags: tags.filter(Boolean),
                grupo: groupName.trim() || null // Asignamos el grupo seleccionado
            };
        }).filter(Boolean);

        setProgress({ total: formattedContacts.length, processed: 0 });

        if (formattedContacts.length === 0) {
            toast.error("No se encontraron contactos válidos. Verifica la columna 'phone'.");
            setUploading(false);
            return;
        }

        const batchSize = 500;
        let successCount = 0;
        try {
            for (let i = 0; i < formattedContacts.length; i += batchSize) {
               const batch = formattedContacts.slice(i, i + batchSize);
               const { error } = await supabase.from('contacts').upsert(batch, { onConflict: 'telefono' });
               if (error) throw error;
               successCount += batch.length;
               setProgress(prev => ({ ...prev, processed: successCount }));
            }
            toast.success(`Importación finalizada. ${successCount} contactos en el grupo ${groupName || 'General'}.`);
            onSuccess();
            onOpenChange(false);
        } catch (err: any) {
            toast.error("Error durante la importación: " + err.message);
        } finally {
            setUploading(false);
        }
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={(val) => !uploading && onOpenChange(val)}>
      <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-md rounded-2xl shadow-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-indigo-400">
             <FileSpreadsheet className="w-5 h-5" /> Importación Masiva (CSV)
          </DialogTitle>
          <DialogDescription className="text-slate-400 text-xs">
             Sube tu archivo .csv y asígnales un grupo de campaña.
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4 space-y-5">
           
           <div className="space-y-2 bg-indigo-950/20 p-4 border border-indigo-500/20 rounded-xl">
              <Label className="text-xs uppercase font-bold text-indigo-400 flex items-center gap-2">
                 <Users className="w-4 h-4"/> Grupo de Usuarios (Opcional)
              </Label>
              <Input
                list="existing-groups"
                value={groupName}
                onChange={e => setGroupName(e.target.value)}
                placeholder="Ej: Campaña Noviembre, Nivel 1..."
                className="bg-slate-950 border-slate-800 h-10 text-slate-200"
                disabled={uploading}
              />
              <datalist id="existing-groups">
                {existingGroups.map(g => <option key={g} value={g} />)}
              </datalist>
              <p className="text-[10px] text-slate-500 italic">Escribe un nombre nuevo o selecciona uno existente de la lista para agrupar estos contactos.</p>
           </div>

           <div className="border-2 border-dashed border-slate-700 rounded-xl p-8 text-center hover:border-indigo-500 transition-colors bg-slate-950/50">
              <input type="file" id="csv-upload" className="hidden" accept=".csv" onChange={handleFileChange} disabled={uploading} />
              <label htmlFor="csv-upload" className="cursor-pointer flex flex-col items-center justify-center w-full h-full">
                 {file ? (
                    <>
                       <CheckCircle2 className="w-8 h-8 text-emerald-500 mb-2" />
                       <span className="text-sm font-bold text-slate-200">{file.name}</span>
                       <span className="text-xs text-slate-500 mt-1">{(file.size / 1024).toFixed(1)} KB</span>
                    </>
                 ) : (
                    <>
                       <Upload className="w-8 h-8 text-slate-500 mb-2" />
                       <span className="text-sm font-medium text-slate-300">Seleccionar archivo CSV</span>
                    </>
                 )}
              </label>
           </div>
           
           {uploading && (
              <div className="space-y-2">
                 <div className="flex justify-between text-xs text-slate-400 font-mono">
                    <span>Insertando en Base de Datos...</span>
                    <span>{progress.processed} / {progress.total}</span>
                 </div>
                 <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                    <div className="bg-indigo-500 h-full transition-all duration-300" style={{ width: `${progress.total > 0 ? (progress.processed / progress.total) * 100 : 0}%` }}></div>
                 </div>
              </div>
           )}
        </div>

        <DialogFooter>
           <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={uploading}>Cancelar</Button>
           <Button onClick={handleImport} disabled={!file || uploading} className="bg-indigo-600 hover:bg-indigo-700 font-bold px-6 shadow-lg">
              {uploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />} 
              Iniciar Importación
           </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};