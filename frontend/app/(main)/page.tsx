import Button from "@/_components/Button";
import Counter from "@/_components/Counter";
import Title from "@/_components/Name";
import NavBar from "@/_components/NavBar";
import Blurb from "@/_components/FrontBlurb";

export default function Home() {
  return (
    <div className="flex flex-col gap-2 p-5">
      <Blurb />
      <div className="space-x-4">
        <Button>I am a reusable component!</Button>
        <Button>I love Caitlin B</Button>
      </div>
    </div>
  );
}
