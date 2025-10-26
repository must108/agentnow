import Image from "next/image";
import NowIcon from "@/imgs/now.png";

export default function Title() {
  return (
    <h1 className="text-5xl font-bold flex items-center">
      <span className="text-[#63df4e]">agent</span>
      <Image
        src={NowIcon}
        alt="now icon"
        width={105}
        height={50}
        className="relative top-1 ml-1"
      />
    </h1>
  );
}


