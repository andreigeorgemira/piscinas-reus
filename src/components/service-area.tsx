import Image from "next/image";
import { MapPin } from "@phosphor-icons/react/ssr";
import { serviceTowns } from "@/lib/site-config";
import { picsumUrl } from "@/lib/picsum";

export function ServiceArea() {
  return (
    <section id="zona" className="bg-brand py-20 text-brand-foreground md:py-28">
      <div className="mx-auto max-w-7xl px-4">
        <h2 className="font-display max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
          Trabajamos en seis poblaciones del Camp de Tarragona
        </h2>
        <p className="mt-4 max-w-xl text-brand-foreground/80">
          Reus es nuestra base. Desde ahí cubrimos obra nueva, reformas y
          mantenimiento en toda la comarca.
        </p>
      </div>

      <div className="mt-10 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:mx-auto md:max-w-7xl">
        {serviceTowns.map((town) => (
          <div
            key={town.name}
            className="relative flex h-72 w-64 shrink-0 snap-start flex-col justify-end overflow-hidden rounded"
          >
            {/* Placeholder: town landmark or streetscape photo */}
            <Image
              src={picsumUrl(town.imageSeed, 500, 650)}
              alt={`Vista de ${town.name}`}
              fill
              sizes="256px"
              className="object-cover"
            />
            <div className="relative bg-gradient-to-t from-brand-dark/95 via-brand-dark/60 to-transparent p-5 pt-14">
              <div className="flex items-center gap-2">
                <MapPin size={16} weight="regular" className="text-accent" />
                <span className="text-xs font-medium text-brand-foreground/80">
                  {town.distance}
                </span>
              </div>
              <h3 className="font-display mt-2 text-lg font-semibold text-brand-foreground">
                {town.name}
              </h3>
              <p className="mt-1 text-sm text-brand-foreground/80">{town.note}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
