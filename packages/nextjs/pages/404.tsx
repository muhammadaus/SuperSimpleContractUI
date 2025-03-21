import Link from "next/link";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";

export default function Custom404() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-black to-gray-900 text-white">
      <div className="text-center p-8 max-w-md">
        <h1 className="text-6xl font-bold mb-4 bg-gradient-to-r from-red-500 to-blue-500 text-transparent bg-clip-text">
          404
        </h1>
        <p className="text-2xl font-semibold mb-4">Page Not Found</p>
        <p className="text-gray-400 mb-6">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Link
          href="/"
          className="inline-flex items-center px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 transition-colors text-white font-medium"
        >
          <ArrowLeftIcon className="h-4 w-4 mr-2" />
          Back to Home
        </Link>
      </div>
    </div>
  );
} 