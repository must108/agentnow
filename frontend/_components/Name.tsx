// export default function title() {
//     return (
//         <h1 className="text-5xl font-bold text-[#63df4e]">
//             accelnow
//         </h1>
//     )
// }

import Image from "next/image";
import SNIcon from "@/imgs/SN.png";

export default function Title() {
  return (
    <h1 className="text-5xl font-bold text-[#63df4e] flex items-center">
        <span>acceln</span>
        <Image
            src={SNIcon}
            alt="O icon"
            width={40}
            height={20}
            className="relative -bottom-0.5"
        />
        <span>w</span>
        </h1>
  );
}
