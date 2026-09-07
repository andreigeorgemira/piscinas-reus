import Image from "next/image";
import { Drop } from "@phosphor-icons/react/ssr";
import { picsumUrl } from "@/lib/picsum";
import { services } from "@/lib/site-config";

export function ServicesBento() {
  const [construction, renovation, maintenance] = services;

  return (
    <section id="servicios" className="mx-auto max-w-7xl px-4 py-20 md:py-28">
      <h2 className="font-display max-w-2xl text-3xl font-semibold tracking-tight text-text sm:text-4xl">
        Lo que hacemos
      </h2>

      <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3 md:grid-rows-2">
        <div className="relative overflow-hidden rounded md:col-span-2 md:row-span-2 min-h-[22rem]">
          {/* Placeholder: gunite shell mid-construction, landscape */}
          <Image
            src={picsumUrl(construction?.imageSeed ?? "obra-piscina", 1200, 1200)}
            alt="Estructura de gunitado de una piscina en construcción"
            fill
            sizes="(min-width: 768px) 66vw, 100vw"
            className="object-cover"
          />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-brand-dark/90 via-brand-dark/40 to-transparent p-6 pt-16">
            <h3 className="font-display text-xl font-semibold text-brand-foreground sm:text-2xl">
              {construction?.title}
            </h3>
            <p className="mt-2 max-w-md text-sm text-brand-foreground/85">
              {construction?.description}
            </p>
          </div>
        </div>

        <div className="overflow-hidden rounded border border-border bg-surface">
          <div className="relative aspect-[4/3] w-full">
            {/* Placeholder: renovated pool, new tiling, square-ish crop */}
            <Image
              src={picsumUrl(renovation?.imageSeed ?? "reforma-piscina", 700, 525)}
              alt="Piscina reformada con revestimiento nuevo"
              fill
              sizes="(min-width: 768px) 33vw, 100vw"
              className="object-cover"
            />
          </div>
          <div className="p-5">
            <h3 className="font-display text-lg font-semibold text-text">
              {renovation?.title}
            </h3>
            <p className="mt-2 text-sm text-text-muted">{renovation?.description}</p>
          </div>
        </div>

        <div className="flex flex-col justify-between rounded bg-brand p-6 text-brand-foreground">
          <Drop size={28} weight="regular" className="text-accent" />
          <div>
            <h3 className="font-display mt-4 text-lg font-semibold">
              {maintenance?.title}
            </h3>
            <p className="mt-2 text-sm text-brand-foreground/80">
              {maintenance?.description}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
