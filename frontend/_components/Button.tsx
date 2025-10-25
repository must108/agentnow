import { AnchorHTMLAttributes } from "react";

// sample component!
export default function Button({ children }: AnchorHTMLAttributes<HTMLAnchorElement>) {
    return (
        <button className="text-white font-bold bg-blue-500 w-30 hover:bg-blue-700 transition-colors rounded-md p-2"
        >
            {children}
        </button>
    )
}