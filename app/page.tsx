"use client";
import { motion } from "framer-motion";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white flex flex-col items-center justify-center p-10">
      {/* This is the smooth 'Lando' entrance animation */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="text-center"
      >
        <h1 className="text-8xl font-black italic uppercase tracking-tighter text-[#dfff00]">
          Your Name
        </h1>
        <p className="mt-4 text-xl font-light tracking-widest uppercase opacity-60">
          Digital Portfolio // 2026
        </p>
      </motion.div>

      <motion.button
        whileHover={{ scale: 1.1, backgroundColor: "#ffffff", color: "#000000" }}
        className="mt-12 px-8 py-3 border border-[#dfff00] text-[#dfff00] font-bold uppercase italic"
      >
        View Work
      </motion.button>
    </main>
  );
}