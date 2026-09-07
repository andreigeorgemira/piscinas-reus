import Link from "next/link";
import { navLinks, serviceTowns, siteConfig } from "@/lib/site-config";

export function Footer() {
  return (
    <footer className="bg-brand-dark text-brand-foreground">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-4 py-14 md:grid-cols-4">
        <div>
          <p className="font-display text-lg font-semibold">{siteConfig.name}</p>
          <p className="mt-3 max-w-xs text-sm text-brand-foreground/75">
            Construcción, reforma y mantenimiento de piscinas privadas en el
            Camp de Tarragona.
          </p>
          <Link
            href="#contacto"
            className="mt-5 inline-block rounded bg-accent-strong px-5 py-2.5 text-sm font-semibold text-accent-foreground transition-colors hover:bg-brand"
          >
            {siteConfig.ctaLabel}
          </Link>
        </div>

        <div>
          <p className="text-sm font-semibold text-brand-foreground/60">
            Navegación
          </p>
          <ul className="mt-3 flex flex-col gap-2">
            {navLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="text-sm text-brand-foreground/80 hover:text-brand-foreground"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="text-sm font-semibold text-brand-foreground/60">
            Zona de trabajo
          </p>
          <ul className="mt-3 flex flex-col gap-2">
            {serviceTowns.map((town) => (
              <li key={town.name} className="text-sm text-brand-foreground/80">
                {town.name}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="text-sm font-semibold text-brand-foreground/60">
            Contacto
          </p>
          <ul className="mt-3 flex flex-col gap-2 text-sm text-brand-foreground/80">
            <li>
              <a href={siteConfig.phoneHref}>{siteConfig.phone}</a>
            </li>
            <li>
              <a href={`mailto:${siteConfig.email}`}>{siteConfig.email}</a>
            </li>
            <li>{siteConfig.addressLine}</li>
          </ul>
        </div>
      </div>

      <div className="border-t border-brand-foreground/10 px-4 py-6">
        <p className="mx-auto max-w-7xl text-xs text-brand-foreground/60">
          {new Date().getFullYear()} {siteConfig.name}. Todos los derechos
          reservados.
        </p>
      </div>
    </footer>
  );
}
