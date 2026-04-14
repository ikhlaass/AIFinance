import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Sparkles, BrainCircuit } from 'lucide-react';

const AIInsightWidget = () => {
  const [insight, setInsight] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchInsight = async () => {
      try {
        const res = await axios.get('/api/dashboard/ai-insight');
        if (res.data.insight) {
          setInsight(res.data.insight);
        } else {
          setInsight("Keberhasilan finansial di masa depan dipupuk dari kedisiplinan mencatat hari ini!");
        }
      } catch (err) {
         setInsight("Otak digital saya sedang istirahat sejenak, tapi dompet Anda tetap aman di sini.");
      } finally {
        setIsLoading(false);
      }
    };
    
    // Memberi sedikit jeda loading agar terasa lebih dramatis dan berat
    const timer = setTimeout(() => {
      fetchInsight();
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="relative w-full rounded-[2rem] overflow-hidden bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/20 p-6 md:p-8 flex flex-col md:flex-row items-start gap-4 shadow-xl transition-all group backdrop-blur-md">
      {/* Efek partikel bercahaya Autofint (Glowing Sphere) */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/30 dark:bg-emerald-500/20 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none"></div>
      
      {/* Ikon Statik/Dinamik Avatar AI */}
      <div className="min-w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-500 shrink-0 shadow-[0_0_15px_rgba(16,185,129,0.3)] relative z-10 transition-transform group-hover:scale-105">
        <Sparkles size={26} className={isLoading ? "animate-pulse" : "animate-pulse delay-500 duration-2000"} />
      </div>

      <div className="relative z-10 flex-1">
        <h3 className="text-[11px] font-black uppercase tracking-[0.25em] text-emerald-600 dark:text-emerald-400 mb-3 flex items-center gap-2">
          <BrainCircuit size={15} /> Saran AI Eksekutif
        </h3>
        
        {isLoading ? (
          <div className="space-y-3 mt-3 w-full max-w-xl animate-pulse">
            <div className="h-3 bg-emerald-500/20 rounded-full w-[90%]"></div>
            <div className="h-3 bg-emerald-500/20 rounded-full w-[100%]"></div>
            <div className="h-3 bg-emerald-500/20 rounded-full w-[60%]"></div>
          </div>
        ) : (
          <p className="text-text-main font-bold text-sm md:text-base lg:text-lg leading-relaxed tracking-wide animate-in fade-in duration-1000 slide-in-from-bottom-2 text-justify md:text-left">
            "{insight}"
          </p>
        )}
      </div>
    </div>
  );
};

export default AIInsightWidget;
