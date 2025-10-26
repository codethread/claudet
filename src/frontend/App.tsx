import { APITester } from "./APITester";
import "./index.css";

export function App() {
  return (
    <div className="w-full h-dvh flex flex-col px-4 px-safe sm:px-6 border border-red-100 border-lg">
      <header className="mb-4 sm:mb-6 mt-4 sm:mt-6 flex-shrink-0">
        <h1 className="text-xl sm:text-2xl font-bold">Claude Chats</h1>
      </header>
      <main className="flex-1 min-h-0 overflow-hidden pb-4 sm:pb-6">
        <APITester />
      </main>
    </div>
  );
}

export default App;
