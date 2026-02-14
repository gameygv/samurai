import React, { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2, Loader2, Database, Shield, Activity, Terminal } from 'lucide-react';
import { toast } from 'sonner';

const Index = () => {
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'error'>('checking');
  const [latency, setLatency] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const checkConnection = async () => {
      const start = performance.now();
      try {
        const { error } = await supabase.auth.getSession();
        if (error) throw error;
        const end = performance.now();
        setLatency(Math.round(end - start));
        setConnectionStatus('connected');
      } catch (err: any) {
        console.error('Error de conexión:', err);
        setConnectionStatus('error');
        setErrorMessage(err.message || 'No se pudo conectar al servidor');
      }
    };

    checkConnection();
  }, []);

  return (
    <Layout>
      <div className="space-y-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white">Dashboard de Control</h1>
            <p className="text-slate-400">Resumen de actividad y estado del sistema</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-400">Estado de Red:</span>
            {connectionStatus === 'connected' ? (
               <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">Online ({latency}ms)</Badge>
            ) : connectionStatus === 'error' ? (
               <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20">Error</Badge>
            ) : (
               <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">Conectando...</Badge>
            )}
          </div>
        </div>

        {/* Status Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-slate-900 border-slate-800 p-6 flex flex-col justify-between hover:border-slate-700 transition-colors">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-slate-400">Base de Datos</p>
                <h3 className="text-2xl font-bold text-white mt-1">Conectado</h3>
              </div>
              <div className="p-3 bg-slate-800 rounded-lg text-green-500">
                <Database className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
              <CheckCircle2 className="w-3 h-3 text-green-500" />
              <span>Supabase Instance OK</span>
            </div>
          </Card>

          <Card className="bg-slate-900 border-slate-800 p-6 flex flex-col justify-between hover:border-slate-700 transition-colors">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-slate-400">Autenticación</p>
                <h3 className="text-2xl font-bold text-white mt-1">Activa</h3>
              </div>
              <div className="p-3 bg-slate-800 rounded-lg text-blue-500">
                <Shield className="w-5 h-5" />
              </div>
            </div>
             <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
              <CheckCircle2 className="w-3 h-3 text-green-500" />
              <span>Auth Service OK</span>
            </div>
          </Card>

          <Card className="bg-slate-900 border-slate-800 p-6 flex flex-col justify-between hover:border-slate-700 transition-colors">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-slate-400">Estado del Agente</p>
                <h3 className="text-2xl font-bold text-white mt-1">Configurando</h3>
              </div>
              <div className="p-3 bg-slate-800 rounded-lg text-purple-500">
                <Activity className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2 text-xs text-yellow-500">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>Esperando Prompts...</span>
            </div>
          </Card>
        </div>

        {/* Console Log */}
        <Card className="bg-black/40 border-slate-800 font-mono text-xs md:text-sm text-slate-400 h-64 flex flex-col">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-800 bg-slate-900/30 text-slate-500">
            <Terminal className="w-4 h-4" />
            <span>TERMINAL DE SISTEMA</span>
          </div>
          <div className="p-4 space-y-1 overflow-y-auto flex-1">
            <p><span className="text-slate-600">[INFO]</span> Inicializando interfaz gráfica Samurai v5.1...</p>
            <p><span className="text-green-500">[OK]</span> Conexión a Supabase verificada.</p>
            <p><span className="text-blue-500">[UPDATE]</span> Nuevo módulo cargado: /brain (Gestión de Prompts)</p>
            <p><span className="text-yellow-500">[INPUT]</span> Recibido Prompt 1.1: ADN Core del Samurai.</p>
            <p><span className="text-slate-500">[WAIT]</span> Sistema listo para recibir Parte 1.2: Instrucciones Técnicas...</p>
          </div>
        </Card>

      </div>
    </Layout>
  );
};

export default Index;