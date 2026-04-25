import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Loader2, Users, Wifi, Send, GraduationCap, Check, AlertCircle,
  CheckCircle2, XCircle, Image, Video, Music, X as XIcon, Paperclip
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface CourseWithGroup {
  id: string;
  title: string;
  whatsapp_group_jid: string;
  whatsapp_channel_id: string;
  nivel: string;
  sede: string;
  profesor: string;
}

interface MediaAttachment {
  url: string;
  type: 'image' | 'video' | 'audio';
  name: string;
  previewUrl?: string;
}

interface SendResult {
  courseId: string;
  courseTitle: string;
  success: boolean;
  error?: string;
}

const MEDIA_ACCEPT: Record<string, string> = {
  image: 'image/jpeg,image/png,image/webp',
  video: 'video/mp4,video/3gpp',
  audio: 'audio/ogg,audio/mpeg,audio/mp4,audio/wav',
};

const MEDIA_ICONS: Record<string, React.ReactNode> = {
  image: <Image className="w-4 h-4" />,
  video: <Video className="w-4 h-4" />,
  audio: <Music className="w-4 h-4" />,
};

export const GroupCampaignSection = () => {
  const [courses, setCourses] = useState<CourseWithGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [media, setMedia] = useState<MediaAttachment | null>(null);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendResults, setSendResults] = useState<SendResult[]>([]);
  const [currentSendIndex, setCurrentSendIndex] = useState(-1);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video' | 'audio'>('image');

  useEffect(() => {
    fetchCoursesWithGroups();
  }, []);

  const fetchCoursesWithGroups = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('courses')
      .select('id, title, whatsapp_group_jid, whatsapp_channel_id, nivel, sede, profesor')
      .not('whatsapp_group_jid', 'is', null)
      .order('title');

    if (data) setCourses(data as CourseWithGroup[]);
    setLoading(false);
  };

  const handleToggleCourse = (courseId: string) => {
    setSendResults([]);
    setSelectedCourseIds(prev =>
      prev.includes(courseId)
        ? prev.filter(id => id !== courseId)
        : [...prev, courseId]
    );
  };

  const handleSelectAll = () => {
    setSendResults([]);
    setSelectedCourseIds(
      selectedCourseIds.length === courses.length ? [] : courses.map(c => c.id)
    );
  };

  const handleMediaSelect = (type: 'image' | 'video' | 'audio') => {
    setMediaType(type);
    setTimeout(() => fileInputRef.current?.click(), 0);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (16MB max for WhatsApp)
    if (file.size > 16 * 1024 * 1024) {
      toast.error('Archivo muy grande. Máximo 16MB para WhatsApp.');
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'bin';
      const path = `campaigns/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('media').upload(path, file);
      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(path);

      setMedia({
        url: publicUrl,
        type: mediaType,
        name: file.name,
        previewUrl: mediaType === 'image' ? URL.createObjectURL(file) : undefined,
      });
    } catch (err: any) {
      toast.error(`Error subiendo: ${err.message}`);
    }
    setUploading(false);
    // Reset input so same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemoveMedia = () => {
    if (media?.previewUrl) URL.revokeObjectURL(media.previewUrl);
    setMedia(null);
  };

  const handleSend = async () => {
    const selectedCourses = courses.filter(c => selectedCourseIds.includes(c.id));
    if (selectedCourses.length === 0 || (!message.trim() && !media)) return;

    const groupNames = selectedCourses.map(c => `• ${c.title}`).join('\n');
    const mediaLabel = media ? `\n\n📎 Con ${media.type === 'image' ? 'imagen' : media.type === 'video' ? 'video' : 'audio'} adjunto` : '';
    if (!confirm(`¿Enviar mensaje a ${selectedCourses.length} grupo${selectedCourses.length > 1 ? 's' : ''}?\n\n${groupNames}${mediaLabel}\n\nSe enviará UN mensaje a cada grupo de WhatsApp.`)) return;

    setSending(true);
    setSendResults([]);
    const results: SendResult[] = [];

    for (let i = 0; i < selectedCourses.length; i++) {
      const course = selectedCourses[i];
      setCurrentSendIndex(i);

      try {
        const body: Record<string, unknown> = {
          channel_id: course.whatsapp_channel_id,
          group_jid: course.whatsapp_group_jid,
          message: message.trim(),
          course_id: course.id,
        };

        if (media) {
          body.mediaData = {
            url: media.url,
            type: media.type,
            name: media.name,
          };
        }

        const { data, error } = await supabase.functions.invoke('send-group-message', { body });

        if (error) throw new Error(error.message);
        if (!data?.success) throw new Error(data?.error || 'Error al enviar');

        results.push({ courseId: course.id, courseTitle: course.title, success: true });
      } catch (err: any) {
        results.push({ courseId: course.id, courseTitle: course.title, success: false, error: err.message });
      }

      setSendResults([...results]);
    }

    setCurrentSendIndex(-1);
    setSending(false);

    const ok = results.filter(r => r.success).length;
    const fail = results.filter(r => !r.success).length;
    if (fail === 0) {
      toast.success(`Mensaje enviado a ${ok} grupo${ok > 1 ? 's' : ''}.`);
    } else {
      toast.warning(`${ok} enviados, ${fail} con error.`);
    }
  };

  const handleReset = () => {
    setSendResults([]);
    setSelectedCourseIds([]);
    setMessage('');
    handleRemoveMedia();
  };

  const allSelected = courses.length > 0 && selectedCourseIds.length === courses.length;
  const someSelected = selectedCourseIds.length > 0;
  const sendComplete = sendResults.length > 0 && !sending;
  const canSend = someSelected && (message.trim() || media) && !sending;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <Card className="bg-[#0f0f11] border-[#222225] shadow-2xl rounded-2xl border-l-4 border-l-emerald-500">
      <CardHeader className="bg-[#161618] border-b border-[#222225] py-4">
        <CardTitle className="text-white text-sm uppercase tracking-widest font-bold flex items-center gap-2">
          <Wifi className="w-4 h-4 text-emerald-400" /> Campaña a Grupos de Curso
        </CardTitle>
        <p className="text-xs text-slate-500 mt-1">Selecciona uno o más cursos y envía un mensaje a sus grupos de WhatsApp.</p>
      </CardHeader>
      <CardContent className="p-6 space-y-5">
        {courses.length === 0 ? (
          <div className="text-center py-8 space-y-2">
            <AlertCircle className="w-8 h-8 text-slate-600 mx-auto" />
            <p className="text-sm text-slate-500">No hay cursos con grupo de WhatsApp vinculado.</p>
            <p className="text-xs text-slate-600">Ve al catálogo, edita un curso y vincula un grupo.</p>
          </div>
        ) : (
          <>
            {/* Header with select all */}
            <div className="flex items-center justify-between">
              <label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">
                Cursos con grupo vinculado ({courses.length})
              </label>
              {courses.length > 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSelectAll}
                  disabled={sending}
                  className="text-[10px] uppercase tracking-widest font-bold text-slate-400 hover:text-white h-7"
                >
                  {allSelected ? 'Deseleccionar todos' : 'Seleccionar todos'}
                </Button>
              )}
            </div>

            {/* Course list with checkboxes */}
            <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
              {courses.map(c => {
                const isSelected = selectedCourseIds.includes(c.id);
                const result = sendResults.find(r => r.courseId === c.id);
                const selectedCourses = courses.filter(cc => selectedCourseIds.includes(cc.id));
                const isCurrent = sending && currentSendIndex >= 0 && selectedCourses[currentSendIndex]?.id === c.id;

                return (
                  <button
                    key={c.id}
                    onClick={() => !sending && handleToggleCourse(c.id)}
                    disabled={sending}
                    className={cn(
                      'w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left',
                      isSelected
                        ? 'bg-emerald-900/10 border-emerald-500/30'
                        : 'bg-[#121214] border-[#222225] hover:border-[#333336]',
                      sending && 'cursor-default'
                    )}
                  >
                    <Checkbox
                      checked={isSelected}
                      className="border-slate-600 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500 shrink-0"
                      tabIndex={-1}
                    />
                    <GraduationCap className="w-4 h-4 text-indigo-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-200 truncate">{c.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {c.sede && <span className="text-[10px] text-slate-500">{c.sede}</span>}
                        {c.profesor && <span className="text-[10px] text-slate-600">• {c.profesor}</span>}
                      </div>
                    </div>

                    {isCurrent && <Loader2 className="w-4 h-4 animate-spin text-emerald-400 shrink-0" />}
                    {result?.success && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
                    {result && !result.success && (
                      <div className="flex items-center gap-1 shrink-0">
                        <XCircle className="w-4 h-4 text-red-400" />
                        <span className="text-[9px] text-red-400 max-w-[100px] truncate">{result.error}</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Message + media editor */}
            {someSelected && (
              <>
                <div className="space-y-3">
                  <label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">
                    Mensaje para {selectedCourseIds.length} grupo{selectedCourseIds.length > 1 ? 's' : ''}
                  </label>

                  {/* Media preview */}
                  {media && (
                    <div className="relative bg-[#121214] border border-[#222225] rounded-xl p-3">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleRemoveMedia}
                        disabled={sending}
                        className="absolute top-2 right-2 h-6 w-6 bg-black/60 hover:bg-black/80 text-white rounded-full z-10"
                      >
                        <XIcon className="w-3 h-3" />
                      </Button>
                      {media.type === 'image' && media.previewUrl && (
                        <img
                          src={media.previewUrl}
                          alt="Preview"
                          className="max-h-48 rounded-lg object-contain mx-auto"
                        />
                      )}
                      {media.type === 'video' && (
                        <div className="flex items-center gap-3 py-2">
                          <div className="w-12 h-12 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                            <Video className="w-5 h-5 text-indigo-400" />
                          </div>
                          <div>
                            <p className="text-sm text-slate-200 font-semibold truncate max-w-[300px]">{media.name}</p>
                            <p className="text-[10px] text-slate-500">Video adjunto</p>
                          </div>
                        </div>
                      )}
                      {media.type === 'audio' && (
                        <div className="flex items-center gap-3 py-2">
                          <div className="w-12 h-12 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                            <Music className="w-5 h-5 text-amber-400" />
                          </div>
                          <div>
                            <p className="text-sm text-slate-200 font-semibold truncate max-w-[300px]">{media.name}</p>
                            <p className="text-[10px] text-slate-500">Audio adjunto</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Text area */}
                  <Textarea
                    value={message}
                    onChange={e => { setMessage(e.target.value); setSendResults([]); }}
                    placeholder={media ? 'Caption del archivo (opcional)...' : 'Escribe el mensaje para enviar a los grupos...'}
                    className="bg-[#121214] border-[#222225] text-slate-200 rounded-xl min-h-[100px] text-sm"
                    disabled={sending}
                  />

                  {/* Media buttons + char count */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      {!media && !sending && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleMediaSelect('image')}
                            disabled={uploading}
                            className="h-8 px-2.5 text-slate-500 hover:text-emerald-400 hover:bg-emerald-900/10 rounded-lg"
                            title="Adjuntar imagen"
                          >
                            {uploading && mediaType === 'image'
                              ? <Loader2 className="w-4 h-4 animate-spin" />
                              : <Image className="w-4 h-4" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleMediaSelect('video')}
                            disabled={uploading}
                            className="h-8 px-2.5 text-slate-500 hover:text-indigo-400 hover:bg-indigo-900/10 rounded-lg"
                            title="Adjuntar video"
                          >
                            {uploading && mediaType === 'video'
                              ? <Loader2 className="w-4 h-4 animate-spin" />
                              : <Video className="w-4 h-4" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleMediaSelect('audio')}
                            disabled={uploading}
                            className="h-8 px-2.5 text-slate-500 hover:text-amber-400 hover:bg-amber-900/10 rounded-lg"
                            title="Adjuntar audio"
                          >
                            {uploading && mediaType === 'audio'
                              ? <Loader2 className="w-4 h-4 animate-spin" />
                              : <Music className="w-4 h-4" />}
                          </Button>
                        </>
                      )}
                      {uploading && (
                        <span className="text-[10px] text-slate-500 ml-2">Subiendo archivo...</span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-600">{message.length} caracteres</span>
                  </div>
                </div>

                {/* Hidden file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept={MEDIA_ACCEPT[mediaType]}
                  onChange={handleFileChange}
                />

                {/* Send / Results */}
                {sendComplete ? (
                  <div className="space-y-2">
                    <div className={cn(
                      'flex items-center gap-2 p-3 rounded-xl',
                      sendResults.every(r => r.success)
                        ? 'bg-emerald-900/10 border border-emerald-500/20'
                        : 'bg-amber-900/10 border border-amber-500/20'
                    )}>
                      <Check className="w-4 h-4 text-emerald-400" />
                      <span className="text-sm font-bold text-emerald-400">
                        {sendResults.filter(r => r.success).length} de {sendResults.length} enviados
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleReset}
                      className="text-[10px] uppercase tracking-widest font-bold text-slate-400 hover:text-white"
                    >
                      Nueva campaña
                    </Button>
                  </div>
                ) : (
                  <Button
                    onClick={handleSend}
                    disabled={!canSend}
                    className={cn(
                      'w-full h-12 rounded-xl font-bold uppercase tracking-widest text-[10px] shadow-lg',
                      'bg-emerald-600 hover:bg-emerald-500 text-white'
                    )}
                  >
                    {sending ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        Enviando {currentSendIndex + 1} de {selectedCourseIds.length}...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        {media && <Paperclip className="w-3 h-3 mr-1" />}
                        Enviar a {selectedCourseIds.length} Grupo{selectedCourseIds.length > 1 ? 's' : ''}
                      </>
                    )}
                  </Button>
                )}
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};
