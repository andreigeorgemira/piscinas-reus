import { ContactForm } from "@/components/contact-form";

export function ContactSection() {
  return (
    <section id="contacto" className="bg-bg-alt py-20 md:py-28">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-4 md:grid-cols-12 md:gap-12">
        <div className="md:col-span-5">
          <h2 className="font-display text-3xl font-semibold tracking-tight text-text sm:text-4xl">
            Cuéntanos tu proyecto
          </h2>
          <p className="mt-4 max-w-sm text-text-muted">
            Cuéntanos qué necesitas y te contactamos para concretar una
            visita al jardín, sin compromiso.
          </p>
        </div>
        <div className="md:col-span-7">
          <ContactForm />
        </div>
      </div>
    </section>
  );
}
