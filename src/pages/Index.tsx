import React from 'react';

const Index = () => {
  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-4">
      <div className="max-w-2xl text-center space-y-6">
        <div className="inline-block p-4 rounded-full bg-slate-900 border border-slate-800 mb-4 relative group">
          <div className="absolute inset-0 bg-red-500/20 blur-xl rounded-full group-hover:bg-red-500/30 transition-all duration-500"></div>
          <span className="text-4xl relative z-10">侍</span>
        </div>
        <h1 className="text-5xl font-bold tracking-tight bg-gradient-to-r from-red-500 to-orange-500 bg-clip-text text-transparent">
          PROYECTO SAMURAI
        </h1>
        <p className="text-xl text-slate-400">
          Panel de Control del Agente
        </p>
        <div className="mt-8 p-6 bg-slate-900/50 border border-slate-800 rounded-lg text-left shadow-2xl shadow-black/50">
          <p className="text-sm text-slate-300 font-mono space-y-2">
            <span className="flex items-center gap-2">
              <span className="text-green-500">✓</span> Sistema inicializado
            </span>
            <span className="flex items-center gap-2">
              <span className="text-green-500">✓</span> Cliente Supabase configurado
            </span>
            <span className="flex items-center gap-2">
              <span className="text-green-500">✓</span> Conexión establecida: <span className="text-slate-500 text-xs truncate max-w-[200px]">162.251.123.3</span>
            </span>
            <span className="flex items-center gap-2 animate-pulse mt-4">
              <span className="text-blue-500">➜</span> Esperando instrucciones del operador...
            </span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Index;