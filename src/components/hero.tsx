"use client";

import Image from "next/image";
import Link from "next/link";
import { useReducedMotion, motion } from "motion/react";
import { picsumUrl } from "@/lib/picsum";
import { siteConfig } from "@/lib/site-config";

export function Hero() {
  const reduceMotion = useReducedMotion();

  return (
    <section
      id="top"
      className="grid min-h-[100dvh] max-w-7xl grid-cols-1 items-center gap-10 px-4 pt-24 pb-16 md:mx-auto md:grid-cols-12 md:gap-8 md:pt-24"
    >
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="order-2 md:order-1 md:col-span-7"
      >
        <h1 className="font-display max-w-xl text-3xl font-semibold leading-[1.15] tracking-tight text-text sm:text-5xl">
          Piscinas de obra para el jardín de tu casa.
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-text-muted">
          Construcción y mantenimiento de piscinas privadas en Reus, Cambrils
          y Salou. Un equipo, de la excavación al primer baño.
        </p>
        <div className="mt-8 flex flex-wrap gap-4">
          <Link
            href="#contacto"
            className="rounded bg-accent-strong px-6 py-3 text-base font-semibold text-accent-foreground transition-colors hover:bg-brand"
          >
            {siteConfig.ctaLabel}
          </Link>
          <Link
            href="#proyectos"
            className="rounded border border-border px-6 py-3 text-base font-semibold text-text transition-colors hover:border-text"
          >
            Ver proyectos
          </Link>
        </div>
      </motion.div>

      <motion.div
        initial={reduceMotion ? false : { opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
        className="order-1 md:order-2 md:col-span-5"
      >
        <div className="relative aspect-[4/5] w-full overflow-hidden rounded">
          {/* Placeholder: finished pool with garden view, Reus area, portrait crop */}
          <Image
            src={picsumUrl("piscina-infinita-jardin-reus", 900, 1125)}
            alt="Piscina de obra terminada con vistas al jardín en una vivienda de Reus"
            fill
            priority
            sizes="(min-width: 768px) 40vw, 100vw"
            className="object-cover"
          />
        </div>
      </motion.div>
    </section>
  );
}
