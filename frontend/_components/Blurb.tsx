import { FaHandsHelping } from "react-icons/fa";

export default function Blurb() {
  return (
    <div>
      <h1 className="text-5xl font-bold text-[#e8ecee] leading-tight">
        Matching You With the Right{" "}
        <span className="inline-flex items-center gap-2">
          Tools
          <FaHandsHelping className="text-5xl text-[#e8ecee]" />
        </span>
      </h1>
    </div>
  );
}
