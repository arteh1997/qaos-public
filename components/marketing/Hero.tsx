"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

export function Hero() {
  return (
    <section className="relative min-h-screen flex items-center pt-20 overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-primary/8 rounded-full blur-[160px]" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-highlight/5 rounded-full blur-[120px]" />
      </div>

      {/* Grid lines */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(hsl(0 0% 100%) 1px, transparent 1px), linear-gradient(90deg, hsl(0 0% 100%) 1px, transparent 1px)",
          backgroundSize: "80px 80px",
        }}
      />

      <div className="container relative z-10 px-6 md:px-8">
        <div className="max-w-5xl mx-auto">
          {/* Eyebrow */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
            className="flex items-center gap-4 mb-10 md:mb-14"
          >
            <motion.div
              className="h-px bg-primary/60 origin-left"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{
                duration: 1.2,
                delay: 0.2,
                ease: [0.22, 1, 0.36, 1],
              }}
              style={{ width: "60px" }}
            />
            <span className="text-muted-foreground text-xs tracking-[0.3em] uppercase">
              The kitchen that thinks ahead
            </span>
          </motion.div>

          <motion.h1
            className="hero-headline text-foreground mb-8 [overflow-wrap:break-word]"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          >
            What if your kitchen
            <br />
            <span className="glow-text">already knew</span> what
            <br />
            tomorrow needs?
          </motion.h1>

          <motion.div
            className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-24"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            <p className="text-lg md:text-xl text-muted-foreground max-w-md leading-relaxed">
              Qaos is AI that learns how your restaurant moves — what sells,
              what spoils, what&apos;s coming — and turns chaos into clarity.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                href="/login?signup=true"
                className="inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground px-8 py-4 rounded-full text-base font-semibold hover:brightness-110 transition-all"
              >
                Join the waitlist
                <ArrowRight className="w-5 h-5" />
              </Link>
              <a
                href="#features"
                className="inline-flex items-center justify-center gap-2 border border-border text-foreground px-8 py-4 rounded-full text-base font-medium hover:bg-card transition-colors"
              >
                See how it works
              </a>
            </div>
          </motion.div>

          {/* Dashboard preview — living terminal */}
          <motion.div
            className="relative max-w-4xl mx-auto"
            initial={{ opacity: 0, y: 80, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 1.2, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="bg-card rounded-2xl border border-border p-1 shadow-2xl shadow-primary/5">
              <div className="bg-background rounded-xl p-6 md:p-8">
                {/* Terminal header */}
                <div className="flex items-center gap-2 mb-6">
                  <div className="w-2.5 h-2.5 rounded-full bg-destructive/60" />
                  <div className="w-2.5 h-2.5 rounded-full bg-warm/60" />
                  <div className="w-2.5 h-2.5 rounded-full bg-primary/60" />
                  <span className="ml-3 text-[10px] text-muted-foreground/40 font-mono">
                    qaos — intelligence feed
                  </span>
                </div>

                {/* AI thought stream */}
                <div className="space-y-4 font-mono text-xs md:text-sm">
                  <motion.div
                    className="flex gap-3"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.8, duration: 0.5 }}
                  >
                    <span className="text-primary shrink-0">&#9656;</span>
                    <span className="text-muted-foreground">
                      Analysing 14 days of sales data across{" "}
                      <span className="text-foreground">847 menu items</span>
                      ...
                    </span>
                  </motion.div>

                  <motion.div
                    className="flex gap-3"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 1.2, duration: 0.5 }}
                  >
                    <span className="text-primary shrink-0">&#9656;</span>
                    <span className="text-muted-foreground">
                      Friday demand spike detected —{" "}
                      <span className="text-primary">
                        recommend ordering 18kg chicken by Wednesday
                      </span>
                    </span>
                  </motion.div>

                  <motion.div
                    className="flex gap-3"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 1.6, duration: 0.5 }}
                  >
                    <span className="text-warm shrink-0">&#9656;</span>
                    <span className="text-muted-foreground">
                      3 ingredients approaching expiry —{" "}
                      <span className="text-warm">
                        repurpose suggestions generated
                      </span>
                    </span>
                  </motion.div>

                  <motion.div
                    className="flex gap-3"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 2.0, duration: 0.5 }}
                  >
                    <span className="text-primary shrink-0">&#9656;</span>
                    <span className="text-muted-foreground">
                      Projected waste reduction this week:{" "}
                      <span className="text-foreground font-semibold">
                        &pound;320 saved
                      </span>
                    </span>
                  </motion.div>

                  <motion.div
                    className="mt-2"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: [0, 1, 0] }}
                    transition={{ delay: 2.4, duration: 1.2, repeat: Infinity }}
                  >
                    <span className="text-primary">_</span>
                  </motion.div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
