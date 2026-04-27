import React, { useRef } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Plus, X as XIcon, Image, Video, Music, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export interface CampaignVariant {
  position: number;
  label: string;
  caption: string;
  media?: { url: string; type: string; mime: string; name: string } | null;
}

interface VariantTabsProps {
  variants: CampaignVariant[];
  onChange: (variants: CampaignVariant[]) => void;
  disabled?: boolean;
}

const MEDIA_ACCEPT = 'image/jpeg,image/png,image/webp,video/mp4,video/3gpp,audio/ogg,audio/mpeg,audio/mp4,audio/wav';
const LABELS = ['A', 'B', 'C', 'D', 'E'];

export const VariantTabs = ({ variants, onChange, disabled }: VariantTabsProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = React.useState('0');
  const [uploading, setUploading] = React.useState(false);
  const [uploadingFor, setUploadingFor] = React.useState(-1);

  const addVariant = () => {
    if (variants.length >= 5) return;
    const next: CampaignVariant = {
      position: variants.length,
      label: `Variante ${LABELS[variants.length] || variants.length + 1}`,
      caption: '',
      media: null,
    };
    onChange([...variants, next]);
    setActiveTab(String(variants.length));
  };

  const removeVariant = (index: number) => {
    if (variants.length <= 1) return;
    const updated = variants.filter((_, i) => i !== index).map((v, i) => ({
      ...v,
      position: i,
      label: `Variante ${LABELS[i] || i + 1}`,
    }));
    onChange(updated);
    setActiveTab(String(Math.min(index, updated.length - 1)));
  };

  const updateCaption = (index: number, caption: string) => {
    const updated = [...variants];
    updated[index] = { ...updated[index], caption };
    onChange(updated);
  };

  const handleFileUpload = async (index: number, file: File) => {
    if (file.size > 16 * 1024 * 1024) {
      toast.error('Máximo 16MB para WhatsApp.');
      return;
    }
    setUploading(true);
    setUploadingFor(index);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'bin';
      const path = `campaigns/${Date.now()}_v${index}.${ext}`;
      const { error } = await supabase.storage.from('media').upload(path, file);
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(path);

      let type = 'document';
      if (file.type.startsWith('image/')) type = 'image';
      else if (file.type.startsWith('video/')) type = 'video';
      else if (file.type.startsWith('audio/')) type = 'audio';

      const updated = [...variants];
      updated[index] = { ...updated[index], media: { url: publicUrl, type, mime: file.type, name: file.name } };
      onChange(updated);
    } catch (err: any) {
      toast.error(`Error subiendo: ${err.message}`);
    }
    setUploading(false);
    setUploadingFor(-1);
  };

  const removeMedia = (index: number) => {
    const updated = [...variants];
    updated[index] = { ...updated[index], media: null };
    onChange(updated);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">
          {variants.length} variante{variants.length > 1 ? 's' : ''} — distribución round-robin
        </span>
        {variants.length < 5 && !disabled && (
          <Button variant="ghost" size="sm" onClick={addVariant} className="text-[10px] uppercase tracking-widest font-bold text-indigo-400 hover:text-indigo-300 h-7">
            <Plus className="w-3 h-3 mr-1" /> Variante
          </Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-[#0a0a0c] border border-[#222225] h-9 p-0.5 rounded-xl w-full">
          {variants.map((v, i) => (
            <TabsTrigger
              key={i}
              value={String(i)}
              className="flex-1 rounded-lg text-[10px] font-bold uppercase tracking-widest data-[state=active]:bg-indigo-600 data-[state=active]:text-white"
            >
              {v.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {variants.map((v, i) => (
          <TabsContent key={i} value={String(i)} className="space-y-3 mt-3">
            {/* Label editable */}
            <Input
              value={v.label}
              onChange={e => {
                const updated = [...variants];
                updated[i] = { ...updated[i], label: e.target.value };
                onChange(updated);
              }}
              className="bg-[#121214] border-[#222225] text-xs h-8 rounded-lg"
              disabled={disabled}
              placeholder="Nombre de la variante..."
            />

            {/* Media */}
            {v.media ? (
              <div className="flex items-center gap-3 p-3 bg-[#121214] border border-[#222225] rounded-xl">
                <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center',
                  v.media.type === 'image' ? 'bg-emerald-500/10' : v.media.type === 'video' ? 'bg-indigo-500/10' : 'bg-amber-500/10'
                )}>
                  {v.media.type === 'image' ? <Image className="w-4 h-4 text-emerald-400" /> :
                   v.media.type === 'video' ? <Video className="w-4 h-4 text-indigo-400" /> :
                   <Music className="w-4 h-4 text-amber-400" />}
                </div>
                <span className="text-xs text-slate-300 flex-1 truncate">{v.media.name}</span>
                {!disabled && (
                  <Button variant="ghost" size="icon" onClick={() => removeMedia(i)} className="h-7 w-7 text-slate-500 hover:text-red-400">
                    <XIcon className="w-3 h-3" />
                  </Button>
                )}
              </div>
            ) : (
              <div className="flex gap-1">
                {!disabled && ['image', 'video', 'audio'].map(type => (
                  <Button
                    key={type}
                    variant="ghost"
                    size="sm"
                    disabled={uploading}
                    onClick={() => {
                      setUploadingFor(i);
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.accept = MEDIA_ACCEPT;
                      input.onchange = (e) => {
                        const file = (e.target as HTMLInputElement).files?.[0];
                        if (file) handleFileUpload(i, file);
                      };
                      input.click();
                    }}
                    className="h-8 px-2.5 text-slate-500 hover:text-white rounded-lg text-[10px]"
                  >
                    {uploading && uploadingFor === i ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> :
                     type === 'image' ? <Image className="w-3 h-3 mr-1" /> :
                     type === 'video' ? <Video className="w-3 h-3 mr-1" /> :
                     <Music className="w-3 h-3 mr-1" />}
                    {type === 'image' ? 'Imagen' : type === 'video' ? 'Video' : 'Audio'}
                  </Button>
                ))}
              </div>
            )}

            {/* Caption */}
            <Textarea
              value={v.caption}
              onChange={e => updateCaption(i, e.target.value)}
              placeholder="Texto de esta variante... Usa {nombre} y {ciudad}"
              className="bg-[#121214] border-[#222225] text-slate-200 rounded-xl min-h-[80px] text-sm"
              disabled={disabled}
            />

            {/* Remove variant */}
            {variants.length > 1 && !disabled && (
              <Button variant="ghost" size="sm" onClick={() => removeVariant(i)} className="text-[10px] text-red-400 hover:text-red-300 uppercase tracking-widest h-7">
                <XIcon className="w-3 h-3 mr-1" /> Eliminar variante
              </Button>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {variants.length > 1 && (
        <p className="text-[9px] text-slate-600 italic">
          Los destinatarios recibirán variantes alternadas (1→A, 2→B, 3→C, 4→A, ...) para reducir riesgo de baneo.
        </p>
      )}
    </div>
  );
};
