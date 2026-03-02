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
      const { error } = await supabase.from('app_config').select('count', { count: 'exact', head: true });
      if (error && error.code !== 'PGRST116') {
         setDbStatus('error');
      } else {
         setDbStatus('ok');
      }
    } catch (err) {
      setDbStatus('error');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Transformación transparente de Usuario a Email Interno
    const internalEmail = username.includes('@') ? username : `${username.toLowerCase().trim()}@samurai.local`;

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: internalEmail,
        password,
      });

      if (error) throw error;

      if (data.user) {
        toast.success(`Acceso concedido: ${username}`);
        navigate('/');
      }
    } catch (error: any) {
      console.error("Login Error:", error);
      let msg = error.message;
      if (msg.includes("Invalid login credentials")) msg = "Usuario o contraseña incorrectos";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
      <Card className="w-full max-w-md bg-slate-900 border-slate-800 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-red-600 to-indigo-600"></div>

        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-16 h-16 rounded-full bg-red-600 flex items-center justify-center mb-4 shadow-lg shadow-red-900/50 ring-4 ring-slate-800 animate-in zoom-in duration-500">
            <span className="text-white font-bold text-4xl pb-1">侍</span>
          </div>
          <CardTitle className="text-3xl font-bold text-white tracking-tight">SAMURAI v1.6</CardTitle>
          <CardDescription className="text-slate-400">
            Sistema Operativo de Ventas & Inteligencia Artificial
          </CardDescription>
        </CardHeader>

        <CardContent>
          {dbStatus === 'error' && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-md flex items-start gap-3">
              <WifiOff className="w-5 h-5 text-red-500 mt-0.5" />
              <div className="text-xs text-red-400">
                <p className="font-bold">Error de Conexión</p>
                <p>No se puede alcanzar la base de datos Supabase.</p>
                <Button variant="link" className="p-0 h-auto text-red-300 text-[10px]" onClick={checkDbConnection}>
                   <RefreshCw className="w-3 h-3 mr-1" /> Reintentar conexión
                </Button>
              </div>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-slate-300 font-medium">Nombre de Usuario</Label>
              <div className="relative group">
                <User className="absolute left-3 top-3 h-4 w-4 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
                <Input
                  id="username"
                  type="text"
                  placeholder="Ej: gamey"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="pl-10 bg-slate-950 border-slate-800 text-white placeholder:text-slate-600 focus:border-indigo-500 h-11 transition-all"
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
                className="bg-slate-950 border-slate-800 text-white focus:border-indigo-500 h-11 transition-all"
                required
              />
            </div>

            <Button 
              type="submit" 
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-11 shadow-lg shadow-indigo-900/20 mt-2 transition-all hover:scale-[1.02]"
              disabled={loading}
            >
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
              {loading ? 'Validando Credenciales...' : 'Iniciar Sesión'}
            </Button>
          </form>
        </CardContent>

        <CardFooter className="flex justify-between border-t border-slate-800 pt-4 bg-slate-900/50">
          <p className="text-[10px] text-slate-500 flex items-center gap-1 uppercase tracking-wider">
            <AlertCircle className="w-3 h-3" /> Acceso Restringido
          </p>
          <div className="flex items-center gap-2">
             {dbStatus === 'ok' && (
                <span className="text-[9px] text-green-500 font-bold tracking-widest uppercase flex items-center gap-1 animate-pulse">
                   <Wifi className="w-3 h-3"/> System Online
                </span>
             )}
          </div>
        </CardFooter>
      </Card>
    </div>
  );
};

export default Login;