import { Nav } from "@/components/nav";
import { Hero } from "@/components/hero";
import { ServicesBento } from "@/components/services-bento";
import { ProcessTimeline } from "@/components/process-timeline";
import { GalleryMasonry } from "@/components/gallery-masonry";
import { ServiceArea } from "@/components/service-area";
import { FaqAccordion } from "@/components/faq-accordion";
import { ContactSection } from "@/components/contact-section";
import { Footer } from "@/components/footer";

export default function Home() {
  return (
    <>
      <Nav />
      <main className="flex-1">
        <Hero />
        <ServicesBento />
        <ProcessTimeline />
        <GalleryMasonry />
        <ServiceArea />
        <FaqAccordion />
        <ContactSection />
      </main>
      <Footer />
    </>
  );
}
