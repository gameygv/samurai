import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Loader2, ShieldCheck, AlertCircle, User, Wifi, WifiOff } from 'lucide-react';
import { toast } from 'sonner';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [dbStatus, setDbStatus] = useState<'checking' | 'ok' | 'error'>('checking');
  const navigate = useNavigate();

  // Test de conexión al montar
  useEffect(() => {
    checkDbConnection();
  }, []);

  const checkDbConnection = async () => {
    try {
      const { error } = await supabase.from('profiles').select('count', { count: 'exact', head: true });
      
      if (error && error.code !== 'PGRST116') {
         console.warn("Health check failed:", error);
         if (error.message.includes("schema")) {
            setDbStatus('error');
         } else {
            setDbStatus('ok');
         }
      } else {
         setDbStatus('ok');
      }
    } catch (err) {
      console.error("Connection error:", err);
      setDbStatus('error');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const email = `${username.toLowerCase().trim()}@samurai.local`;

    try {
      console.log("Login attempt:", email);
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (data.user) {
        toast.success(`Bienvenido, ${username}`);
        navigate('/');
      }
    } catch (error: any) {
      console.error("Login Error:", error);
      let msg = error.message;
      
      if (msg.includes("Invalid login credentials")) {
        msg = "Usuario o contraseña incorrectos";
      }
      
      // Ya NO enmascaramos el error de "querying schema" para ver el detalle real si persiste
      
      toast.error(msg, { duration: 5000 });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
      <Card className="w-full max-w-md bg-slate-900 border-slate-800 shadow-2xl">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 rounded-full bg-red-600 flex items-center justify-center mb-2 shadow-lg shadow-red-900/50">
            <span className="text-white font-bold text-2xl">侍</span>
          </div>
          <CardTitle className="text-2xl font-bold text-white">SAMURAI PANEL v5.1</CardTitle>
          <CardDescription className="text-slate-400">
            Acceso exclusivo personal autorizado
          </CardDescription>
        </CardHeader>
        <CardContent>
          {dbStatus === 'error' && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-md flex items-start gap-3">
              <WifiOff className="w-5 h-5 text-red-500 mt-0.5" />
              <div className="text-xs text-red-400">
                <p className="font-bold">Error de Conexión Detectado</p>
                <p>La API no responde correctamente. Ejecuta el script <code>FIX_PERMISSIONS.sql</code> en Supabase y luego reinicia la página.</p>
              </div>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-slate-300">Usuario</Label>
              <div className="relative">
                <User className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                <Input
                  id="username"
                  type="text"
                  placeholder="Ej: gamey"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="pl-10 bg-slate-950 border-slate-800 text-white placeholder:text-slate-600 focus:border-red-600/50 transition-colors"
                  required
                  autoFocus
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-300">Contraseña</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-slate-950 border-slate-800 text-white placeholder:text-slate-600 focus:border-red-600/50 transition-colors"
                required
              />
            </div>

            <Button 
              type="submit" 
              className="w-full bg-red-600 hover:bg-red-700 text-white font-medium py-2 transition-all duration-200"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Conectando...
                </>
              ) : (
                <>
                  <ShieldCheck className="mr-2 h-4 w-4" />
                  Ingresar al Sistema
                </>
              )}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex justify-between border-t border-slate-800 pt-4">
          <p className="text-xs text-slate-500 flex items-center gap-2">
            <AlertCircle className="w-3 h-3" />
            IP Registrada
          </p>
          <div className="flex items-center gap-2">
             {dbStatus === 'checking' && <span className="text-xs text-yellow-500 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin"/> Verificando API...</span>}
             {dbStatus === 'ok' && <span className="text-xs text-green-500 flex items-center gap-1"><Wifi className="w-3 h-3"/> API Online</span>}
             {dbStatus === 'error' && <span className="text-xs text-red-500 flex items-center gap-1"><WifiOff className="w-3 h-3"/> API Error</span>}
          </div>
        </CardFooter>
      </Card>
    </div>
  );
};

export default Login;