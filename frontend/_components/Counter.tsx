"use client"

import { useState } from "react"

export default function Counter() {
    const [counter, setCounter] = useState(0);

    const buttonClicked = () => {
        setCounter(counter + 1);
    }

    return (
        <div>
            <p className="font-bold text-md">Value: {counter}</p>

            <button 
                onClick={buttonClicked}
                className="border-2 border-black bg-pink-400 hover:bg-pink-600 transition-colors rounded-md p-2 text-white"   
            >
                Add Counter!
            </button>
        </div>
    )
}