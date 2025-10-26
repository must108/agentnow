import { ButtonHTMLAttributes } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

export default function Button({ children, ...props }: ButtonProps) {
  return (
    <button
      {...props}
      className="inline-block w-auto bg-white text-blue-600 font-semibold px-4 py-2 rounded-md hover:bg-gray-100 transition-colors"
    >
      {children}
    </button>
  );
}
