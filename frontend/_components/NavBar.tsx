"use client";

import Link from "next/link";
import Image from "next/image";
import Icon from "@/app/favicon.ico";
import Name from "./Name";
import Button from "./Button";
import { GoSearch } from "react-icons/go";
import { HiOutlineMicrophone } from "react-icons/hi2";

export default function NavBar() {
  return (
    <nav className="flex items-center justify-between bg-[#e8ecee] px-6 py-4 border-b border-white">
      {/* Logo + Name → home route */}
      <Link href="/" className="flex items-center space-x-2">
        <Image src={Icon} alt="AccelNow Logo" width={50} height={50} />
        <Name />
      </Link>

      {/* Navigation Buttons */}
      <div className="flex space-x-4">
        {/* Text Chat → /chat */}
        <div className="relative group">
          <Link href="/chat">
            <Button>
              <GoSearch />
            </Button>
          </Link>
          <span
            className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-max px-3 py-1 text-xs text-white bg-gray-700 rounded 
                      opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 
                      transition-all duration-300 ease-out"
          >
            Text Chat
          </span>
        </div>

        {/* Voice Chat → /voice */}
        <div className="relative group">
          <Link href="/voice">
            <Button>
              <HiOutlineMicrophone />
            </Button>
          </Link>
          <span
            className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-max px-3 py-1 text-xs text-white bg-gray-700 rounded 
                      opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 
                      transition-all duration-300 ease-out"
          >
            Voice Chat
          </span>
        </div>
      </div>
    </nav>
  );
}
