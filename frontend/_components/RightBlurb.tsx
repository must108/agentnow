import Link from "next/link";

export default function RightBlurb() {
  return (
    <div className="max-w-md ml-auto">
      <p className="text-lg text-[#e8ecee] mb-8 text-center">
        Find the accelerator that moves your business forward. 
        Our AI-powered recommendations connect your needs with 
        the right solutions.
      </p>

      <div className="flex flex-row space-x-6">

        <Link
          href="/chat"
          className="block text-[#e8ecee] hover:text-gray-300 transition-colors text-center"
        >
          <span className="font-semibold text-lg">Text Chat</span>
          <p className="text-[#e8ecee] text-sm">
            Type with an AI agent to discover the accelerator that fits your needs.
          </p>
        </Link>

        <Link
          href="/voice"
          className="block text-[#e8ecee] hover:text-gray-300 transition-colors text-center"
        >
          <span className="font-semibold text-lg">Voice Chat</span>
          <p className="text-[#e8ecee] text-sm">
            Talk with our AI Agent to find the best accelerator for your needs.
          </p>
        </Link>
      </div>
    </div>
  );
}