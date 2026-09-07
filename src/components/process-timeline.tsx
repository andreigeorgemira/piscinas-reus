"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "motion/react";
import { picsumUrl } from "@/lib/picsum";
import { processSteps } from "@/lib/site-config";

export function ProcessTimeline() {
  const reduceMotion = useReducedMotion();

  return (
    <section id="proceso" className="bg-bg-alt py-20 md:py-28">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-4 md:grid-cols-12 md:gap-12">
        <div className="md:col-span-4">
          <div className="md:sticky md:top-28">
            <h2 className="font-display text-3xl font-semibold tracking-tight text-text sm:text-4xl">
              Cómo trabajamos, de la visita al primer baño
            </h2>
            <p className="mt-4 max-w-sm text-text-muted">
              Cinco pasos, el mismo equipo del principio al final. Sabrás en
              cada momento en qué punto está tu obra.
            </p>
            <div className="relative mt-8 hidden aspect-[3/4] w-full max-w-sm overflow-hidden rounded md:block">
              {/* Placeholder: worker laying pool tiling, vertical crop */}
              <Image
                src={picsumUrl("acabado-revestimiento-piscina", 700, 933)}
                alt="Instalador colocando el revestimiento de una piscina"
                fill
                sizes="25vw"
                className="object-cover"
              />
            </div>
          </div>
        </div>

        <ol className="md:col-span-8">
          {processSteps.map((step, index) => (
            <motion.li
              key={step.label}
              initial={reduceMotion ? false : { opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="border-b border-border py-8 first:pt-0 last:border-b-0"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
                <h3 className="font-display text-xl font-semibold text-text sm:text-2xl">
                  {step.label}
                </h3>
                <span className="text-sm font-medium text-text-muted">
                  {step.duration}
                </span>
              </div>
              <p className="mt-3 max-w-2xl text-text-muted">{step.description}</p>
              <span className="mt-4 block h-px w-12 bg-accent" aria-hidden />
              <span className="sr-only">{`Paso ${index + 1} de ${processSteps.length}`}</span>
            </motion.li>
          ))}
        </ol>
      </div>
    </section>
  );
}
