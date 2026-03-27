import React, { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GraduationCap, MapPin, UserCheck, Plus, Trash2, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const AcademicCatalog = () => {
  const [courses, setCourses] = useState<{id: string, name: string}[]>([]);
  const [locations, setLocations] = useState<{id: string, name: string}[]>([]);
  const [teachers, setTeachers] = useState<{id: string, name: string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchCatalog();
  }, []);

  const fetchCatalog = async () => {
    setLoading(true);
    const { data } = await supabase.from('app_config').select('key, value').in('key', ['academic_courses', 'academic_locations', 'academic_teachers']);
    if (data) {
        const c = data.find(d => d.key === 'academic_courses')?.value;
        const l = data.find(d => d.key === 'academic_locations')?.value;
        const t = data.find(d => d.key === 'academic_teachers')?.value;
        
        // BLINDAJE JSON.PARSE
        const parseSafe = (val: string | undefined) => {
            if (!val) return [];
            try { const parsed = JSON.parse(val); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
        };
        
        setCourses(parseSafe(c));
        setLocations(parseSafe(l));
        setTeachers(parseSafe(t));
    }
    setLoading(false);
  };

  const handleSaveAll = async () => {
    setSaving(true);
    try {
        await supabase.from('app_config').upsert([
            { key: 'academic_courses', value: JSON.stringify(courses), category: 'ACADEMIC' },
            { key: 'academic_locations', value: JSON.stringify(locations), category: 'ACADEMIC' },
            { key: 'academic_teachers', value: JSON.stringify(teachers), category: 'ACADEMIC' }
        ], { onConflict: 'key' });
        toast.success("Catálogo académico guardado exitosamente.");
    } catch (err: any) {
        toast.error("Error al guardar: " + err.message);
    } finally {
        setSaving(false);
    }
  };

  if (loading) {
    return <Layout><div className="flex h-[80vh] items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-indigo-500"/></div></Layout>;
  }

  const renderList = (
    items: {id: string, name: string}[], 
    setItems: (val: {id: string, name: string}[]) => void, 
    placeholder: string
  ) => {
      return (
          <div className="space-y-4">
              {items.length === 0 ? (
                  <p className="text-center text-slate-600 text-xs italic py-8">Lista vacía. Haz clic en "Añadir".</p>
              ) : items.map((item, idx) => (
                  <div key={item.id} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[#161618] border border-[#222225] flex items-center justify-center text-xs font-bold text-slate-500 shrink-0">
                          {idx + 1}
                      </div>
                      <Input 
                          value={item.name} 
                          onChange={e => setItems(items.map(i => i.id === item.id ? {...i, name: e.target.value} : i))}
                          className="bg-[#121214] border-[#222225] h-11 text-slate-200 focus-visible:ring-indigo-500 rounded-xl"
                          placeholder={placeholder}
                      />
                      <Button variant="ghost" size="icon" onClick={() => setItems(items.filter(i => i.id !== item.id))} className="text-slate-600 hover:bg-red-500/10 hover:text-red-500 h-11 w-11 rounded-xl shrink-0">
                          <Trash2 className="w-5 h-5" />
                     </Button>
                  </div>
              ))}
          </div>
      );
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6 pb-12 animate-in fade-in duration-500">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <div className="p-2 bg-indigo-500/10 rounded-xl border border-indigo-500/20">
                 <GraduationCap className="w-6 h-6 text-indigo-400" />
              </div>
              Catálogo Académico
            </h1>
            <p className="text-slate-400 text-sm mt-1">Configura las opciones que aparecerán en la Ficha Curricular de los contactos.</p>
          </div>
          <Button onClick={handleSaveAll} disabled={saving} className="bg-indigo-600 hover:bg-indigo-500 text-white h-11 px-8 rounded-xl shadow-lg uppercase tracking-widest font-bold text-xs">
             {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2"/> : <Save className="w-4 h-4 mr-2"/>} Guardar Catálogo
          </Button>
        </div>

        <Tabs defaultValue="cursos" className="w-full">
            <TabsList className="bg-[#121214] border border-[#222225] p-1 rounded-xl flex-wrap h-auto">
               <TabsTrigger value="cursos" className="gap-2 px-6 py-2 text-xs data-[state=active]:bg-indigo-600 data-[state=active]:text-white font-bold uppercase tracking-widest"><GraduationCap className="w-4 h-4"/> Cursos / Talleres</TabsTrigger>
               <TabsTrigger value="sedes" className="gap-2 px-6 py-2 text-xs data-[state=active]:bg-emerald-600 data-[state=active]:text-white font-bold uppercase tracking-widest"><MapPin className="w-4 h-4"/> Sedes</TabsTrigger>
               <TabsTrigger value="profesores" className="gap-2 px-6 py-2 text-xs data-[state=active]:bg-amber-600 data-[state=active]:text-white font-bold uppercase tracking-widest"><UserCheck className="w-4 h-4"/> Profesores</TabsTrigger>
            </TabsList>

            <TabsContent value="cursos" className="mt-6">
                <Card className="bg-[#0f0f11] border-[#222225] shadow-2xl rounded-2xl border-l-4 border-l-indigo-500">
                    <CardHeader className="bg-[#161618] border-b border-[#222225] flex flex-row items-center justify-between">
                        <div className="space-y-1">
                           <CardTitle className="text-indigo-400 text-base font-bold">Listado de Cursos</CardTitle>
                           <CardDescription className="text-xs text-slate-400">Oferta educativa disponible.</CardDescription>
                        </div>
                        <Button onClick={() => setCourses([...courses, { id: Date.now().toString(), name: '' }])} variant="outline" className="border-[#333336] bg-[#0a0a0c] hover:text-white rounded-xl h-9 text-[10px] uppercase font-bold tracking-widest"><Plus className="w-4 h-4 mr-2"/> Añadir Curso</Button>
                    </CardHeader>
                    <CardContent className="p-6">
                        {renderList(courses, setCourses, "Ej: Taller de Sonoterapia Módulo 1")}
                    </CardContent>
                </Card>
            </TabsContent>

            <TabsContent value="sedes" className="mt-6">
                <Card className="bg-[#0f0f11] border-[#222225] shadow-2xl rounded-2xl border-l-4 border-l-emerald-500">
                    <CardHeader className="bg-[#161618] border-b border-[#222225] flex flex-row items-center justify-between">
                        <div className="space-y-1">
                           <CardTitle className="text-emerald-400 text-base font-bold">Listado de Sedes</CardTitle>
                           <CardDescription className="text-xs text-slate-400">Lugares físicos o virtuales.</CardDescription>
                        </div>
                        <Button onClick={() => setLocations([...locations, { id: Date.now().toString(), name: '' }])} variant="outline" className="border-[#333336] bg-[#0a0a0c] hover:text-white rounded-xl h-9 text-[10px] uppercase font-bold tracking-widest"><Plus className="w-4 h-4 mr-2"/> Añadir Sede</Button>
                    </CardHeader>
                    <CardContent className="p-6">
                        {renderList(locations, setLocations, "Ej: CDMX - Coyoacán, Online Zoom")}
                    </CardContent>
                </Card>
            </TabsContent>

            <TabsContent value="profesores" className="mt-6">
                <Card className="bg-[#0f0f11] border-[#222225] shadow-2xl rounded-2xl border-l-4 border-l-amber-500">
                    <CardHeader className="bg-[#161618] border-b border-[#222225] flex flex-row items-center justify-between">
                        <div className="space-y-1">
                           <CardTitle className="text-amber-500 text-base font-bold">Plantilla de Profesores</CardTitle>
                           <CardDescription className="text-xs text-slate-400">Maestros que imparten los cursos.</CardDescription>
                        </div>
                        <Button onClick={() => setTeachers([...teachers, { id: Date.now().toString(), name: '' }])} variant="outline" className="border-[#333336] bg-[#0a0a0c] hover:text-white rounded-xl h-9 text-[10px] uppercase font-bold tracking-widest"><Plus className="w-4 h-4 mr-2"/> Añadir Profesor</Button>
                    </CardHeader>
                    <CardContent className="p-6">
                        {renderList(teachers, setTeachers, "Ej: Maestro Juan Pérez")}
                    </CardContent>
                </Card>
            </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default AcademicCatalog;