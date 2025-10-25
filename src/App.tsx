import { APITester } from "./APITester";
import "./index.css";

export function App() {
  return (
    <div className="w-full h-screen-safe flex flex-col p-2 sm:p-4 md:p-6 px-safe">
      <header className="mb-2 sm:mb-4 flex-shrink-0">
        <h1 className="text-xl sm:text-2xl font-bold">Claude Chat</h1>
      </header>
      <main className="flex-1 min-h-0 overflow-hidden">
        <APITester />
      </main>
    </div>
  );
}

export default App;
