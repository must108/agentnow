// Home.tsx
import Button from "@/_components/Button";
import Counter from "@/_components/Counter";
import Title from "@/_components/Name";
import NavBar from "@/_components/NavBar";
import Blurb from "@/_components/FrontBlurb";
import WaveDivider from "@/_components/Wave";

export default function Home() {
  return (
<<<<<<< HEAD:frontend/app/page.tsx

      <div className="flex flex-col gap-6 p-5">
        <NavBar />
        <Blurb />
=======
    <div className="flex flex-col gap-2 p-5">
      <Blurb />
      <div className="space-x-4">
        <Button>I am a reusable component!</Button>
        <Button>I love Caitlin B</Button>
>>>>>>> c4918e7044a604c1070ecd2ad4327720281cb9f3:frontend/app/(main)/page.tsx
      </div>
  );
}
