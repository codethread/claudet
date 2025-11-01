import { APITester } from './APITester';
import { UpdateBanner } from './components/UpdateBanner';
import './index.css';

export function App() {
	return (
		<div className="w-full h-dvh flex flex-col">
			<UpdateBanner />
			<main className="flex-1 min-h-0 overflow-hidden">
				<APITester />
			</main>
		</div>
	);
}

export default App;
