import { APITester } from "./APITester";
import "./index.css";

export function App() {
  return (
    <div className="container mx-auto p-4 md:p-8 h-screen flex flex-col">
      <header className="mb-4">
        <h1 className="text-2xl font-bold">Claude Chat</h1>
      </header>
      <main className="flex-1 min-h-0">
        <APITester />
      </main>
    </div>
  );
}

export default App;
