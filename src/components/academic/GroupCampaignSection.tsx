import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, Users, Wifi, Send, GraduationCap, Check, AlertCircle } from 'lucide-react';
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

export const GroupCampaignSection = () => {
  const [courses, setCourses] = useState<CourseWithGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [syncInfo, setSyncInfo] = useState<{ matched: number; synced: number } | null>(null);
  const [loadingSync, setLoadingSync] = useState(false);

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

  const handleCourseSelect = async (courseId: string) => {
    setSelectedCourseId(courseId);
    setSent(false);
    setSyncInfo(null);

    // Fetch sync info for this course's group
    const course = courses.find(c => c.id === courseId);
    if (!course) return;

    setLoadingSync(true);
    const { count } = await supabase
      .from('contact_whatsapp_groups')
      .select('id', { count: 'exact', head: true })
      .eq('course_id', courseId);

    setSyncInfo({ matched: count || 0, synced: 0 });
    setLoadingSync(false);
  };

  const handleSend = async () => {
    const course = courses.find(c => c.id === selectedCourseId);
    if (!course || !message.trim()) return;

    if (!confirm(`¿Enviar mensaje al grupo "${course.title}"?\n\nEsto enviará UN mensaje al grupo de WhatsApp (no mensajes individuales).`)) return;

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-group-message', {
        body: {
          channel_id: course.whatsapp_channel_id,
          group_jid: course.whatsapp_group_jid,
          message: message.trim(),
          course_id: course.id,
        },
      });

      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || 'Error al enviar');

      setSent(true);
      toast.success('Mensaje enviado al grupo.');
    } catch (err: any) {
      toast.error(`Error: ${err.message}`);
    }
    setSending(false);
  };

  const selectedCourse = courses.find(c => c.id === selectedCourseId);

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
          <Wifi className="w-4 h-4 text-emerald-400" /> Campaña a Grupo de Curso
        </CardTitle>
        <p className="text-xs text-slate-500 mt-1">Envía un mensaje directo al grupo de WhatsApp vinculado a un curso.</p>
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
            {/* Course selector */}
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">Curso</label>
              <Select value={selectedCourseId} onValueChange={handleCourseSelect}>
                <SelectTrigger className="bg-[#121214] border-[#222225] rounded-xl h-11 text-xs text-slate-300">
                  <SelectValue placeholder="Selecciona un curso con grupo vinculado..." />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-slate-100 rounded-xl">
                  {courses.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      <div className="flex items-center gap-2">
                        <GraduationCap className="w-3.5 h-3.5 text-indigo-400" />
                        <span>{c.title}</span>
                        {c.sede && <span className="text-slate-500 text-[10px]">• {c.sede}</span>}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Course info */}
            {selectedCourse && (
              <div className="p-3 bg-[#121214] border border-[#222225] rounded-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Wifi className="w-3 h-3 text-emerald-400" />
                    <span className="text-xs text-slate-300">{selectedCourse.title}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {loadingSync ? (
                      <Loader2 className="w-3 h-3 animate-spin text-slate-500" />
                    ) : syncInfo ? (
                      <Badge variant="outline" className="text-[9px] border-emerald-500/30 text-emerald-400">
                        <Users className="w-2.5 h-2.5 mr-1" />{syncInfo.matched} contactos en CRM
                      </Badge>
                    ) : null}
                  </div>
                </div>
                <p className="text-[10px] text-slate-600 font-mono mt-1">{selectedCourse.whatsapp_group_jid}</p>
              </div>
            )}

            {/* Message */}
            {selectedCourseId && (
              <>
                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">Mensaje</label>
                  <Textarea
                    value={message}
                    onChange={e => { setMessage(e.target.value); setSent(false); }}
                    placeholder="Escribe el mensaje para enviar al grupo..."
                    className="bg-[#121214] border-[#222225] text-slate-200 rounded-xl min-h-[100px] text-sm"
                  />
                  <p className="text-[10px] text-slate-600">{message.length} caracteres</p>
                </div>

                {sent ? (
                  <div className="flex items-center gap-2 p-3 bg-emerald-900/10 border border-emerald-500/20 rounded-xl">
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span className="text-sm text-emerald-400 font-bold">Mensaje enviado al grupo</span>
                  </div>
                ) : (
                  <Button
                    onClick={handleSend}
                    disabled={sending || !message.trim()}
                    className={cn(
                      'w-full h-12 rounded-xl font-bold uppercase tracking-widest text-[10px] shadow-lg',
                      'bg-emerald-600 hover:bg-emerald-500 text-white'
                    )}
                  >
                    {sending ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <Send className="w-4 h-4 mr-2" />
                    )}
                    Enviar al Grupo
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
