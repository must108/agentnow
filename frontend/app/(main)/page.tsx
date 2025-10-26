// Home.tsx
import Button from "@/_components/Button";
import Counter from "@/_components/Counter";
import Title from "@/_components/Name";
import NavBar from "@/_components/NavBar";
import Blurb from "@/_components/FrontBlurb";
import WaveDivider from "@/_components/Wave";

export default function Home() {
  return (

      <div className="flex flex-col gap-6 p-5">
        <Blurb />
      </div>
  );
}
