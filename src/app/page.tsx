
import { Navbar } from "../components/navbar";
import { Hero } from "../components/hero";
import { DashboardVideo } from "../components/dashboardMock";
import { LogoCloud } from "../components/logo-cloud";
import { PlatformSplit } from "../components/platform-split";
import { HarveyII } from "../components/harveyII";
import { FindYourFit } from "../components/product-innovation";
import { Testimonial } from "../components/testimonial";
import { RealImpact } from "../components/real-impact";
import { Footer } from "../components/footer";

export default function Page() {
  return (
    <main>

      <Navbar />
      <Hero />
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <DashboardVideo />
      </div>
      <LogoCloud />
      <PlatformSplit />
      <HarveyII />
      <FindYourFit />
      <Testimonial />
      <RealImpact />
      <Footer />
    </main>
  );
}