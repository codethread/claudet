import { APITester } from "./APITester";
import "./index.css";

export function App() {
  return (
    <div className="w-full h-dvh flex flex-col px-safe border border-red-100 border-lg">
      <header className="mb-2 sm:mb-4 flex-shrink-0">
        <h1 className="text-xl sm:text-2xl font-bold">Claude Chats</h1>
      </header>
      <main className="flex-1 min-h-0 overflow-hidden">
        <APITester />
      </main>
    </div>
  );
}

export default App;
