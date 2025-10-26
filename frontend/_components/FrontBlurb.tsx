import Blurb from "./Blurb";
import RightSection from "./RightBlurb";

export default function FrontBlurb() {
  return (
    <section className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start px-8 py-16 max-w-7xl mx-auto">
      <Blurb />
      <RightSection />
    </section>
  );
}
