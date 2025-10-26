export default function RightBlurb() {
  return (
    <div className="max-w-md ml-auto">
      <p className="text-lg text-gray-200 mb-8">
        Find the accelerator that moves your business forward. 
        Our AI-powered recommendations connect your needs with 
        the right solutions—fast, simple, and effective.
      </p>

      <div className="flex flex-col space-y-6">
        {/* Link 1 */}
        <a
          href="#chat-agent"
          className="block text-white hover:text-gray-300 transition-colors"
        >
          <span className="font-semibold text-lg">Chat with an Agent</span>
          <p className="text-gray-300 text-sm">
            Voice chat with an AI agent to recommend the best accelerator.
          </p>
        </a>

        {/* Link 2 */}
        <a
          href="#find-accelerator"
          className="block text-white hover:text-gray-300 transition-colors"
        >
          <span className="font-semibold text-lg">Find the Best Accelerator</span>
          <p className="text-gray-300 text-sm">
            Type with an AI agent to discover the accelerator that fits your needs.
          </p>
        </a>
      </div>
    </div>
  );
}