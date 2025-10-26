import Blurb from "./Blurb";
import RightSection from "./RightBlurb";

export default function FrontBlurb() {
  return (
    <section className="flex flex-col items-center px-8 py-16 max-w-7xl mx-auto w-full text-center">
      {/* Blurb centered */}
      <div className="mb-4">
        <Blurb />
      </div>

      {/* RightBlurb slightly under it */}
      <div className="mt-2">
        <RightSection />
      </div>
    </section>
  );
}
