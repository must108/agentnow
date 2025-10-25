import Button from "@/_components/Button";
import Counter from "@/_components/Counter";

export default function Home() {
  return (
    <div className="flex flex-col gap-2 p-5">
      hello world!

      <Button>I am a reusable component!</Button>
      <Counter />
      <Button>I love Caitlin B</Button>
    </div>
  );
}
