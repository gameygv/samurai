import React, { useEffect } from "react";
import { useLocation, Link } from "react-router-dom";
import { AlertCircle, ArrowLeft } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname,
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white p-4">
      <div className="text-center space-y-4">
        <div className="inline-flex p-4 rounded-full bg-red-500/10 mb-2">
           <AlertCircle className="w-12 h-12 text-red-500" />
        </div>
        <h1 className="text-4xl font-bold tracking-tight">404 - Ruta no encontrada</h1>
        <p className="text-slate-400 text-lg">
           La ruta <code className="bg-slate-900 px-2 py-1 rounded text-slate-200 font-mono text-sm">{location.pathname}</code> no existe en el sistema.
        </p>
        <div className="pt-4">
          <Link 
             to="/" 
             className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md font-medium transition-colors"
          >
             <ArrowLeft className="w-4 h-4" />
             Volver al Panel
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotFound;