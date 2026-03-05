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

    const internalEmail = username.includes('@') ? username : `${username.toLowerCase().trim()}@teb.local`;

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
      <Card className="w-full max-w-md bg-slate-900 border-slate-800 shadow-2xl relative overflow-hidden rounded-2xl">
        {/* Detalle premium en el borde superior en lugar de colores brillantes */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-600/50 via-indigo-900 to-slate-800"></div>

        <CardHeader className="text-center space-y-3 mt-6">
          <div className="mx-auto w-28 h-28 flex items-center justify-center mb-2 animate-in zoom-in duration-500">
            <img src="/logo.png" alt="The Elephant Bowl Logo" className="w-full h-full object-contain drop-shadow-2xl" />
          </div>
          <CardTitle className="text-3xl font-bold text-slate-50 tracking-tight">The Elephant Bowl</CardTitle>
          <CardDescription className="text-slate-400 font-medium tracking-wide uppercase text-xs">
            Intelligent CRM & Protocol
          </CardDescription>
        </CardHeader>

        <CardContent className="mt-4">
          {dbStatus === 'error' && (
            <div className="mb-6 p-4 bg-red-900/20 border border-red-900/50 rounded-lg flex items-start gap-3">
              <WifiOff className="w-5 h-5 text-red-400 mt-0.5" />
              <div className="text-xs text-red-300">
                <p className="font-bold">Error de Conexión</p>
                <p>No se puede alcanzar la base de datos.</p>
                <Button variant="link" className="p-0 h-auto text-red-400 text-[10px] mt-1" onClick={checkDbConnection}>
                   <RefreshCw className="w-3 h-3 mr-1" /> Reintentar conexión
                </Button>
              </div>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-slate-300 font-medium">Credencial de Usuario</Label>
              <div className="relative group">
                <User className="absolute left-3 top-3.5 h-4 w-4 text-slate-500 group-focus-within:text-amber-500 transition-colors" />
                <Input
                  id="username"
                  type="text"
                  placeholder="Ej: admin"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="pl-10 bg-slate-950/50 border-slate-800 text-slate-50 placeholder:text-slate-600 focus:border-amber-500 h-12 transition-all rounded-xl"
                  required
                  autoFocus
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-300 font-medium">Clave de Seguridad</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-slate-950/50 border-slate-800 text-slate-50 focus:border-amber-500 h-12 transition-all rounded-xl text-lg tracking-widest"
                required
              />
            </div>

            <Button 
              type="submit" 
              className="w-full bg-indigo-900 hover:bg-indigo-800 text-slate-50 font-bold h-12 shadow-xl shadow-black/20 mt-4 transition-all rounded-xl uppercase tracking-widest text-xs"
              disabled={loading}
            >
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4 text-amber-500" />}
              {loading ? 'Autenticando...' : 'Acceder al Sistema'}
            </Button>
          </form>
        </CardContent>

        <CardFooter className="flex justify-between border-t border-slate-800/50 pt-5 mt-2 bg-slate-900/30">
          <p className="text-[10px] text-slate-500 flex items-center gap-1 uppercase tracking-wider font-medium">
            <AlertCircle className="w-3 h-3" /> Acceso Cifrado
          </p>
          <div className="flex items-center gap-2">
             {dbStatus === 'ok' && (
                <span className="text-[9px] text-amber-500/80 font-bold tracking-widest uppercase flex items-center gap-1">
                   <Wifi className="w-3 h-3"/> Conexión Estable
                </span>
             )}
          </div>
        </CardFooter>
      </Card>
    </div>
  );
};

export default Login;