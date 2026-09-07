import Image from "next/image";
import { galleryImages, testimonials } from "@/lib/site-config";
import { picsumUrl } from "@/lib/picsum";

export function GalleryMasonry() {
  return (
    <section id="proyectos" className="mx-auto max-w-7xl px-4 py-20 md:py-28">
      <h2 className="font-display max-w-2xl text-3xl font-semibold tracking-tight text-text sm:text-4xl">
        Piscinas que hemos construido
      </h2>

      <div className="mt-10 columns-1 gap-4 sm:columns-2 lg:columns-3 [&>*]:mb-4">
        {galleryImages.map((image) => (
          <div
            key={image.seed}
            className={`relative w-full overflow-hidden rounded ${image.aspect}`}
          >
            {/* Placeholder: finished pool photography, see alt text for subject */}
            <Image
              src={picsumUrl(image.seed, 800, 1000)}
              alt={image.alt}
              fill
              sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
              className="object-cover"
            />
          </div>
        ))}
      </div>

      <div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-2">
        {testimonials.map((testimonial) => (
          <figure
            key={testimonial.author}
            className="rounded border border-border bg-surface p-6"
          >
            <blockquote className="text-lg leading-relaxed text-text">
              {testimonial.quote}
            </blockquote>
            <figcaption className="mt-4 text-sm font-medium text-text-muted">
              {testimonial.author}, {testimonial.location}
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
