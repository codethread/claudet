import { APITester } from "./APITester";
import "./index.css";

export function App() {
  return (
    <div className="w-full h-dvh flex flex-col px-4 px-safe sm:px-6 border border-red-100 border-lg">
      <main className="flex-1 min-h-0 overflow-hidden py-4 sm:py-6">
        <APITester />
      </main>
    </div>
  );
}

export default App;
