import Button from "./Button";

export default function RightBlurb() {
  return (
    <div className="max-w-md ml-auto">
      <p className="text-lg text-gray-200 mb-6">
        Find the accelerator that moves your business forward. 
        Our AI-powered recommendations connect your needs with 
        the right solutions—fast, simple, and effective.
      </p>
      <div className="flex flex-row space-x-4">
        <Button>Find Accelerator</Button>
        <Button>Chat with Agent</Button>
      </div>
    </div>
  );
}
