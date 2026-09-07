"use client";

import { useState } from "react";
import { CaretDown } from "@phosphor-icons/react";
import { faqItems } from "@/lib/site-config";

export function FaqAccordion() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="preguntas" className="mx-auto max-w-7xl px-4 py-20 md:py-28">
      <h2 className="font-display max-w-2xl text-3xl font-semibold tracking-tight text-text sm:text-4xl">
        Preguntas frecuentes
      </h2>

      <div className="mt-10 max-w-3xl divide-y divide-border border-t border-border">
        {faqItems.map((item, index) => {
          const isOpen = openIndex === index;
          return (
            <div key={item.question}>
              <button
                type="button"
                onClick={() => setOpenIndex(isOpen ? null : index)}
                aria-expanded={isOpen}
                className="flex w-full items-center justify-between gap-4 py-5 text-left"
              >
                <span className="font-display text-lg font-medium text-text">
                  {item.question}
                </span>
                <CaretDown
                  size={20}
                  weight="regular"
                  className={`shrink-0 text-text-muted transition-transform ${
                    isOpen ? "rotate-180" : ""
                  }`}
                />
              </button>
              {isOpen && (
                <p className="max-w-2xl pb-6 text-text-muted">{item.answer}</p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
