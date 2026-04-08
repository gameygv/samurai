import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Loader2, ShieldCheck, Wifi, WifiOff } from 'lucide-react';
import { toast } from 'sonner';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [dbStatus, setDbStatus] = useState<'checking' | 'ok' | 'error'>('checking');
  const [brandName, setBrandName] = useState('Samurai Workspace');
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate('/', { replace: true });
    });
    checkDbConnection();
    supabase.from('app_config').select('value').eq('key', 'brand_name').maybeSingle().then(({ data }) => {
       if (data?.value) setBrandName(data.value);
    });
  }, []);

  const checkDbConnection = async () => {
    setDbStatus('checking');
    try {
      const { error } = await supabase.from('app_config').select('count', { count: 'exact', head: true });
      if (error && error.code !== 'PGRST116') setDbStatus('error');
      else setDbStatus('ok');
    } catch (err) {
      setDbStatus('error');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;
      if (data.user) {
        toast.success(`Acceso concedido`);
        navigate('/');
      }
    } catch (error: any) {
      let msg = error.message;
      if (msg.includes("Invalid login credentials")) {
          msg = "Email o contraseña incorrectos.";
      } else if (msg.includes("Email not confirmed")) {
          msg = "Email pendiente de confirmación. Contacta a un administrador.";
      }
      toast.error(msg, { duration: 6000 });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
      <Card className="w-full max-w-md bg-slate-900 border-slate-800 shadow-2xl relative overflow-hidden rounded-2xl">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-600/50 via-indigo-900 to-slate-800"></div>

        <CardHeader className="text-center space-y-3 mt-6">
          <div className="mx-auto w-28 h-28 flex items-center justify-center mb-2">
            <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
          </div>
          <CardTitle className="text-3xl font-bold text-slate-50">{brandName}</CardTitle>
          <CardDescription className="text-slate-400 uppercase text-[10px] tracking-widest font-bold">
            Samurai Kernel AI System
          </CardDescription>
        </CardHeader>

        <CardContent className="mt-4 space-y-5">
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-300">Email de Acceso</Label>
              <Input
                id="email"
                type="email"
                placeholder="email@ejemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-slate-950/50 border-slate-800 text-slate-50 h-12 rounded-xl"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" id="pass-label" className="text-slate-300">Clave de Seguridad</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-slate-950/50 border-slate-800 text-slate-50 h-12 rounded-xl tracking-widest"
                required
              />
            </div>

            <Button 
              type="submit" 
              className="w-full bg-indigo-900 hover:bg-indigo-800 text-slate-50 font-bold h-12 rounded-xl shadow-lg"
              disabled={loading}
            >
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4 text-amber-500" />}
              Acceder al Sistema
            </Button>
          </form>
        </CardContent>

        <CardFooter className="flex justify-center bg-slate-950/30 p-4 border-t border-slate-800/50">
           <span className="text-[9px] text-slate-600 font-mono flex items-center gap-2">
              {dbStatus === 'ok' ? <><Wifi className="w-3 h-3 text-amber-500"/> KERNEL CONNECTION: STABLE</> : <><WifiOff className="w-3 h-3 text-red-500"/> KERNEL OFFLINE</>}
           </span>
        </CardFooter>
      </Card>
    </div>
  );
};

export default Login;