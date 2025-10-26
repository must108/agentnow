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

      <div className="flex space-x-4">
        {/* Find Accelerator */}
        <div className="relative group">
          <Button>Find Accelerator</Button>
          <span className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-max px-3 py-1 text-xs text-white bg-gray-700 rounded opacity-0 group-hover:opacity-100 transition">
            Chat with AI agent
          </span>
        </div>

        {/* Chat with Agent */}
        <div className="relative group">
          <Button>Chat with Agent</Button>
          <span className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-max px-3 py-1 text-xs text-white bg-gray-700 rounded opacity-0 group-hover:opacity-100 transition">
            Voice chat with AI agent
          </span>
        </div>
      </div>

    </nav>
  );
}
