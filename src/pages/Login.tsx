import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Loader2, ShieldCheck, AlertCircle, User, Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [dbStatus, setDbStatus] = useState<'checking' | 'ok' | 'error'>('checking');
  const navigate = useNavigate();

  useEffect(() => {
    checkDbConnection();
  }, []);

  const checkDbConnection = async () => {
    setDbStatus('checking');
    try {
      // 1. Verificar conectividad básica (Supabase vivo)
      const { error } = await supabase.from('app_config').select('count', { count: 'exact', head: true });
      
      if (error && error.code !== 'PGRST116') {
         console.error("Health check error:", error);
         setDbStatus('error');
      } else {
         setDbStatus('ok');
      }
    } catch (err) {
      console.error("Critical Connection error:", err);
      setDbStatus('error');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Aseguramos que el email tenga el formato correcto
    const email = username.includes('@') ? username : `${username.toLowerCase().trim()}@samurai.local`;

    try {
      if (dbStatus === 'error') {
         await checkDbConnection(); // Reintentar antes de fallar
         if (dbStatus === 'error') {
            throw new Error("No hay conexión con la base de datos. Por favor RECONSTRUYE la app.");
         }
      }

      console.log("Login attempt:", email);
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        if (error.message.includes("Email not confirmed")) {
           throw new Error("El email no ha sido confirmado. Revisa tu bandeja de entrada o usa un usuario pre-verificado.");
        }
        throw error;
      }

      if (data.user) {
        toast.success(`Bienvenido, ${username}`);
        navigate('/');
      }
    } catch (error: any) {
      console.error("Login Error:", error);
      let msg = error.message;
      
      if (msg.includes("Invalid login credentials")) {
        msg = "Usuario o contraseña incorrectos";
      } else if (msg.includes("Failed to fetch") || msg.includes("URL")) {
        msg = "Error de red: Verifica que Supabase esté conectado y haz REBUILD.";
      }
      
      toast.error(msg, { duration: 5000 });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
      <Card className="w-full max-w-md bg-slate-900 border-slate-800 shadow-2xl relative overflow-hidden">
        {/* Decorative Background */}
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-red-600 to-indigo-600"></div>

        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-14 h-14 rounded-full bg-red-600 flex items-center justify-center mb-2 shadow-lg shadow-red-900/50 ring-4 ring-slate-800">
            <span className="text-white font-bold text-3xl pb-1">侍</span>
          </div>
          <CardTitle className="text-2xl font-bold text-white tracking-tight">SAMURAI PANEL v0.803</CardTitle>
          <CardDescription className="text-slate-400">
            Sistema de Inteligencia Artificial de Ventas
          </CardDescription>
        </CardHeader>
        <CardContent>
          {dbStatus === 'error' && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-md flex items-start gap-3 animate-pulse">
              <WifiOff className="w-5 h-5 text-red-500 mt-0.5" />
              <div className="text-xs text-red-400">
                <p className="font-bold">Error de Conexión Detectado</p>
                <p>No se puede alcanzar la base de datos de Supabase.</p>
                <div className="mt-2 flex gap-2">
                   <Button variant="outline" size="sm" className="h-6 text-[10px] bg-red-900/20 border-red-500/30 text-red-300 hover:bg-red-900/40" onClick={checkDbConnection}>
                      <RefreshCw className="w-3 h-3 mr-1" /> Reintentar
                   </Button>
                   <span className="text-[10px] bg-slate-800 p-1 rounded text-slate-500 self-center">Si persiste, haz REBUILD.</span>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-slate-300 font-medium">Usuario / Email</Label>
              <div className="relative group">
                <User className="absolute left-3 top-3 h-4 w-4 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
                <Input
                  id="username"
                  type="text"
                  placeholder="Ej: gamey"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="pl-10 bg-slate-950 border-slate-800 text-white placeholder:text-slate-600 focus:border-indigo-500 transition-all h-10"
                  required
                  autoFocus
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-300 font-medium">Contraseña Maestra</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-slate-950 border-slate-800 text-white placeholder:text-slate-600 focus:border-indigo-500 transition-all h-10"
                required
              />
            </div>

            <Button 
              type="submit" 
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 h-11 transition-all duration-200 shadow-lg shadow-indigo-900/20 mt-2"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verificando Credenciales...
                </>
              ) : (
                <>
                  <ShieldCheck className="mr-2 h-4 w-4" />
                  Acceder al Sistema
                </>
              )}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex justify-between border-t border-slate-800 pt-4 bg-slate-900/50">
          <p className="text-[10px] text-slate-500 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            Acceso restringido a personal autorizado.
          </p>
          <div className="flex items-center gap-2">
             {dbStatus === 'checking' && <span className="text-[10px] text-yellow-500 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin"/> Checking API...</span>}
             {dbStatus === 'ok' && <span className="text-[10px] text-green-500 flex items-center gap-1 font-mono"><Wifi className="w-3 h-3"/> SYNC OK</span>}
             {dbStatus === 'error' && <span className="text-[10px] text-red-500 flex items-center gap-1 font-bold"><WifiOff className="w-3 h-3"/> SYNC ERROR</span>}
          </div>
        </CardFooter>
      </Card>
    </div>
  );
};

export default Login;