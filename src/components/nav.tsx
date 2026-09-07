"use client";

import { useState } from "react";
import Link from "next/link";
import { List, X } from "@phosphor-icons/react";
import { navLinks, siteConfig } from "@/lib/site-config";

export function Nav() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-border/80 bg-bg/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:h-[72px]">
        <Link href="#top" className="font-display text-lg font-semibold tracking-tight text-text">
          {siteConfig.name}
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-text-muted transition-colors hover:text-text"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <Link
          href="#contacto"
          className="hidden rounded bg-accent-strong px-4 py-2 text-sm font-semibold text-accent-foreground transition-colors hover:bg-brand md:inline-block"
        >
          {siteConfig.ctaLabel}
        </Link>

        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
          aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}
          className="inline-flex h-10 w-10 items-center justify-center rounded text-text md:hidden"
        >
          {menuOpen ? <X size={24} /> : <List size={24} />}
        </button>
      </div>

      {menuOpen && (
        <nav className="border-t border-border bg-bg px-4 pb-6 pt-2 md:hidden">
          <ul className="flex flex-col gap-1">
            {navLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className="block rounded px-2 py-3 text-base font-medium text-text"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
          <Link
            href="#contacto"
            onClick={() => setMenuOpen(false)}
            className="mt-3 block rounded bg-accent-strong px-4 py-3 text-center text-sm font-semibold text-accent-foreground"
          >
            {siteConfig.ctaLabel}
          </Link>
        </nav>
      )}
    </header>
  );
}
