"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import Icon from "@/app/favicon.ico";
import Name from "./Name";
import Button from "./Button";
import { GoSearch } from "react-icons/go";
import { HiOutlineMicrophone } from "react-icons/hi2";
import { CiVideoOn } from "react-icons/ci";
import { HiOutlineMenu, HiOutlineX } from "react-icons/hi";

export default function NavBar() {
  const [open, setOpen] = useState(false);

  // Close on ESC; prevent body scroll when open (mobile)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    // lock scroll (mobile)
    const prev = document.body.style.overflow;
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = prev || "";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev || "";
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <nav className="sticky top-0 z-50 w-full bg-[#e8ecee] border-b border-white overflow-x-clip">
      {/* Top bar */}
      <div className="mx-auto max-w-7xl w-full px-4 py-3 flex items-center justify-between gap-4">
        {/* Brand */}
        <Link href="/" className="flex items-center space-x-2 shrink-0">
          <Image src={Icon} alt="AccelNow Logo" width={40} height={40} />
          <Name />
        </Link>

        {/* Desktop actions */}
        <div className="hidden md:flex space-x-4 shrink-0">
          <div className="relative group">
            <Link href="/chat">
              <Button><GoSearch /></Button>
            </Link>
            <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-full mt-2 w-max max-w-[160px] px-3 py-1 text-xs text-white bg-gray-700 rounded whitespace-nowrap opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition">
              Text Chat
            </span>
          </div>

          <div className="relative group">
            <Link href="/voice">
              <Button><HiOutlineMicrophone /></Button>
            </Link>
            <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-full mt-2 w-max max-w-[160px] px-3 py-1 text-xs text-white bg-gray-700 rounded whitespace-nowrap opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition">
              Voice Chat
            </span>
          </div>

          <div className="relative group">
            <Link href="/call">
              <Button><CiVideoOn /></Button>
            </Link>
            <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-full mt-2 w-max max-w-[160px] px-3 py-1 text-xs text-white bg-gray-700 rounded whitespace-nowrap opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition">
              Meeting Assist
            </span>
          </div>
        </div>

        {/* Mobile hamburger */}
        <button
          type="button"
          className="md:hidden inline-flex items-center justify-center rounded-lg p-2 text-gray-800 hover:bg-white/60 focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="Toggle menu"
          aria-expanded={open}
          onClick={() => setOpen(v => !v)}
        >
          {open ? <HiOutlineX size={22} /> : <HiOutlineMenu size={22} />}
        </button>
      </div>

      {/* Mobile sheet (simple, no overlay) */}
      <div
        className={`md:hidden border-t border-white/60 bg-[#e8ecee] overflow-hidden ${open ? "max-h-96" : "max-h-0"} transition-[max-height] duration-200 ease-out`}
      >
        <div className="mx-auto max-w-7xl w-full px-4 py-3">
          <div className="grid grid-cols-3 gap-3">
            <Link
              href="/chat"
              onClick={close}
              className="flex flex-col items-center gap-2 rounded-xl bg-white/80 hover:bg-white p-3 text-sm text-gray-900"
            >
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100">
                <GoSearch />
              </span>
              <span>Text Chat</span>
            </Link>

            <Link
              href="/voice"
              onClick={close}
              className="flex flex-col items-center gap-2 rounded-xl bg-white/80 hover:bg-white p-3 text-sm text-gray-900"
            >
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100">
                <HiOutlineMicrophone />
              </span>
              <span>Voice Chat</span>
            </Link>

            <Link
              href="/call"
              onClick={close}
              className="flex flex-col items-center gap-2 rounded-xl bg-white/80 hover:bg-white p-3 text-sm text-gray-900"
            >
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100">
                <CiVideoOn />
              </span>
              <span>Meeting Assist</span>
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
