import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Loader2, ShieldCheck, AlertCircle, Mail, Wifi, WifiOff, RefreshCw, Info, LifeBuoy, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [repairing, setRepairing] = useState(false);
  const [dbStatus, setDbStatus] = useState<'checking' | 'ok' | 'error'>('checking');
  const navigate = useNavigate();

  useEffect(() => {
    checkDbConnection();
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
          msg = "Email o contraseña incorrectos. Si acabas de cambiar tu email, prueba el botón de REPARAR abajo.";
      } else if (msg.includes("Email not confirmed")) {
          msg = "Email pendiente de confirmación. Usa el botón de REPARAR abajo para forzar la activación.";
      }
      toast.error(msg, { duration: 6000 });
    } finally {
      setLoading(false);
    }
  };

  const handleEmergencyRepair = async () => {
    if (!email.includes('@')) {
        toast.error("Ingresa tu nuevo email completo (gameygv@gmail.com) para repararlo.");
        return;
    }
    setRepairing(true);
    const tid = toast.loading("Reparando identidad digital...");
    try {
        const { data, error } = await supabase.functions.invoke('update-user-email', {
            body: { email: email.trim() }
        });
        if (error) throw error;
        toast.success(data.message, { id: tid, duration: 5000 });
    } catch (err: any) {
        toast.error("Fallo de rescate: " + err.message, { id: tid });
    } finally {
        setRepairing(false);
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
          <CardTitle className="text-3xl font-bold text-slate-50">The Elephant Bowl</CardTitle>
          <CardDescription className="text-slate-400 uppercase text-[10px] tracking-widest font-bold">
            Intelligent CRM & Protocol
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

          <div className="pt-4 border-t border-slate-800">
             <div className="flex flex-col items-center gap-3">
                <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">¿Problemas tras cambiar email?</p>
                <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full border-amber-600/30 text-amber-500 hover:bg-amber-600/10 h-10 rounded-xl font-bold"
                    onClick={handleEmergencyRepair}
                    disabled={repairing}
                >
                    {repairing ? <Loader2 className="w-4 h-4 animate-spin mr-2"/> : <LifeBuoy className="w-4 h-4 mr-2" />}
                    FORZAR REPARACIÓN DE CUENTA
                </Button>
             </div>
          </div>
        </CardContent>

        <CardFooter className="flex justify-center bg-slate-950/30 p-4 border-t border-slate-800/50">
           <span className="text-[9px] text-slate-600 font-mono flex items-center gap-2">
              <LifeBuoy className="w-3 h-3"/> EMERGENCY RECOVERY MODE ACTIVE
           </span>
        </CardFooter>
      </Card>
    </div>
  );
};

export default Login;