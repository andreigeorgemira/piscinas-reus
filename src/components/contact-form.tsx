"use client";

import { useState, type FormEvent } from "react";
import { CheckCircle } from "@phosphor-icons/react";
import { serviceTypeOptions, siteConfig } from "@/lib/site-config";

type FormState = {
  name: string;
  email: string;
  phone: string;
  serviceType: string;
  message: string;
};

const initialState: FormState = {
  name: "",
  email: "",
  phone: "",
  serviceType: serviceTypeOptions[0]?.value ?? "",
  message: "",
};

export function ContactForm() {
  const [form, setForm] = useState<FormState>(initialState);
  const [submitted, setSubmitted] = useState(false);

  function handleChange(
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // TODO: POST to /api/leads once the backend lands.
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center gap-4 rounded border border-border bg-surface p-10 text-center">
        <CheckCircle size={40} weight="regular" className="text-accent" />
        <h3 className="font-display text-2xl font-semibold text-text">
          Hemos recibido tu solicitud
        </h3>
        <p className="max-w-md text-text-muted">
          Te llamaremos o escribiremos en menos de un día laborable para
          concretar la visita.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-5 sm:grid-cols-2">
      <div className="flex flex-col gap-2">
        <label htmlFor="name" className="text-sm font-medium text-text">
          Nombre
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          value={form.name}
          onChange={handleChange}
          className="rounded border border-border bg-surface px-4 py-3 text-text outline-none focus:border-accent"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="phone" className="text-sm font-medium text-text">
          Teléfono
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          required
          value={form.phone}
          onChange={handleChange}
          className="rounded border border-border bg-surface px-4 py-3 text-text outline-none focus:border-accent"
        />
      </div>

      <div className="flex flex-col gap-2 sm:col-span-2">
        <label htmlFor="email" className="text-sm font-medium text-text">
          Correo electrónico
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          value={form.email}
          onChange={handleChange}
          className="rounded border border-border bg-surface px-4 py-3 text-text outline-none focus:border-accent"
        />
      </div>

      <div className="flex flex-col gap-2 sm:col-span-2">
        <label htmlFor="serviceType" className="text-sm font-medium text-text">
          Tipo de servicio
        </label>
        <select
          id="serviceType"
          name="serviceType"
          value={form.serviceType}
          onChange={handleChange}
          className="rounded border border-border bg-surface px-4 py-3 text-text outline-none focus:border-accent"
        >
          {serviceTypeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-2 sm:col-span-2">
        <label htmlFor="message" className="text-sm font-medium text-text">
          Mensaje
        </label>
        <textarea
          id="message"
          name="message"
          rows={4}
          required
          value={form.message}
          onChange={handleChange}
          className="rounded border border-border bg-surface px-4 py-3 text-text outline-none focus:border-accent"
        />
      </div>

      <div className="sm:col-span-2">
        <button
          type="submit"
          className="rounded bg-accent-strong px-6 py-3 text-base font-semibold text-accent-foreground transition-colors hover:bg-brand"
        >
          Enviar solicitud
        </button>
        <p className="mt-3 text-sm text-text-muted">
          También puedes llamarnos al{" "}
          <a href={siteConfig.phoneHref} className="font-medium text-text underline">
            {siteConfig.phone}
          </a>
          .
        </p>
      </div>
    </form>
  );
}
