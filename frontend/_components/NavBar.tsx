import Image from "next/image";
import Icon from "@/app/favicon.ico";
import Name from "./Name";
import Button from "./Button";

export default function NavBar() {
  return (
    <nav className="flex items-center justify-between bg-[#073561] px-6 py-4 border-b border-white">
      <div className="flex items-center space-x-2">
        <Image src={Icon} alt="AccelNow Logo" width={50} height={50} />
        <Name />
      </div>

      <div className="space-x-4">
        <Button>Find Accelerator</Button>
        <Button>Chat with Agent</Button>
      </div>
    </nav>
  );
}
