import React, { useEffect, useState } from 'react';
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
        // Intentamos una operación ligera para verificar conectividad
        const { error } = await supabase.auth.getSession();
        
        if (error) throw error;
        
        const end = performance.now();
        setLatency(Math.round(end - start));
        setConnectionStatus('connected');
        toast.success('Conexión con Supabase establecida correctamente');
      } catch (err: any) {
        console.error('Error de conexión:', err);
        setConnectionStatus('error');
        setErrorMessage(err.message || 'No se pudo conectar al servidor');
        toast.error('Error al conectar con Supabase');
      }
    };

    checkConnection();
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-4 font-sans">
      <div className="w-full max-w-4xl space-y-8">
        
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="inline-block p-4 rounded-full bg-slate-900 border border-slate-800 relative group animate-fade-in">
            <div className="absolute inset-0 bg-red-600/20 blur-xl rounded-full group-hover:bg-red-600/30 transition-all duration-500"></div>
            <span className="text-5xl relative z-10 block hover:scale-110 transition-transform">侍</span>
          </div>
          <h1 className="text-6xl font-black tracking-tighter bg-gradient-to-r from-red-500 via-orange-500 to-red-600 bg-clip-text text-transparent drop-shadow-sm">
            SAMURAI
          </h1>
          <p className="text-lg text-slate-400 font-light tracking-widest uppercase">
            Sistema de Gestión de Agente Autónomo
          </p>
        </div>

        {/* Status Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          {/* Database Status */}
          <Card className="bg-slate-900/50 border-slate-800 p-6 flex flex-col items-center justify-center space-y-3 backdrop-blur-sm hover:border-slate-700 transition-colors">
            <div className="p-3 bg-slate-800/50 rounded-full">
              <Database className={`w-6 h-6 ${connectionStatus === 'connected' ? 'text-green-500' : connectionStatus === 'error' ? 'text-red-500' : 'text-slate-400'}`} />
            </div>
            <div className="text-center">
              <h3 className="text-sm font-medium text-slate-300">Base de Datos</h3>
              <div className="flex items-center gap-2 mt-1 justify-center">
                {connectionStatus === 'checking' && (
                  <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" /> Verificando...
                  </Badge>
                )}
                {connectionStatus === 'connected' && (
                  <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">
                    <CheckCircle2 className="w-3 h-3 mr-1" /> Online ({latency}ms)
                  </Badge>
                )}
                {connectionStatus === 'error' && (
                  <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20">
                    <AlertCircle className="w-3 h-3 mr-1" /> Error
                  </Badge>
                )}
              </div>
            </div>
          </Card>

          {/* Auth Status */}
          <Card className="bg-slate-900/50 border-slate-800 p-6 flex flex-col items-center justify-center space-y-3 backdrop-blur-sm hover:border-slate-700 transition-colors">
            <div className="p-3 bg-slate-800/50 rounded-full">
              <Shield className="w-6 h-6 text-blue-500" />
            </div>
            <div className="text-center">
              <h3 className="text-sm font-medium text-slate-300">Autenticación</h3>
              <div className="flex items-center gap-2 mt-1 justify-center">
                <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/20">
                  Sistema Listo
                </Badge>
              </div>
            </div>
          </Card>

          {/* Agent Status */}
          <Card className="bg-slate-900/50 border-slate-800 p-6 flex flex-col items-center justify-center space-y-3 backdrop-blur-sm hover:border-slate-700 transition-colors">
            <div className="p-3 bg-slate-800/50 rounded-full">
              <Activity className="w-6 h-6 text-purple-500" />
            </div>
            <div className="text-center">
              <h3 className="text-sm font-medium text-slate-300">Estado del Agente</h3>
              <div className="flex items-center gap-2 mt-1 justify-center">
                <Badge variant="outline" className="bg-purple-500/10 text-purple-500 border-purple-500/20 animate-pulse">
                  Esperando Input
                </Badge>
              </div>
            </div>
          </Card>
        </div>

        {/* Console Log */}
        <Card className="bg-black/40 border-slate-800 p-4 font-mono text-xs md:text-sm text-slate-400 h-48 overflow-y-auto">
          <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-800 text-slate-500">
            <Terminal className="w-4 h-4" />
            <span>TERMINAL DE SISTEMA</span>
          </div>
          <div className="space-y-1">
            <p><span className="text-slate-600">[INFO]</span> Inicializando interfaz gráfica Samurai v1.0...</p>
            <p><span className="text-slate-600">[INFO]</span> Cargando módulos de visualización...</p>
            <p><span className="text-blue-500">[NET]</span> Conectando a {supabase.supabaseUrl?.split('//')[1].split('/')[0]}...</p>
            
            {connectionStatus === 'connected' && (
              <>
                <p><span className="text-green-500">[OK]</span> Conexión establecida exitosamente.</p>
                <p><span className="text-green-500">[OK]</span> Latencia de red: {latency}ms.</p>
                <p><span className="text-yellow-500">[WAIT]</span> Esperando instrucciones del índice de prompts...</p>
              </>
            )}
            
            {connectionStatus === 'error' && (
              <>
                <p><span className="text-red-500">[ERR]</span> Fallo en la conexión.</p>
                <p className="text-red-400 pl-4">{errorMessage}</p>
                <p><span className="text-slate-500">[HINT]</span> Verifica si el servidor Supabase permite conexiones desde este dominio (CORS) o si la URL es accesible públicamente.</p>
              </>
            )}
          </div>
        </Card>

      </div>
    </div>
  );
};

export default Index;