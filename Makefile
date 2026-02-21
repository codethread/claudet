.PHONY: dev dev-test start test type-check lint format validate mobile mobile-android mobile-ios

# Server
dev:
	cd server && npm run dev

dev-test:
	cd server && npm run dev:test

start:
	cd server && npm start

test:
	cd server && npm test

type-check:
	cd server && npm run type-check

lint:
	cd server && npm run lint

format:
	cd server && npm run format

validate:
	cd server && npm run validate

# Mobile
mobile:
	cd mobile && npx expo start

mobile-android:
	cd mobile && npx expo start --android

mobile-ios:
	cd mobile && npx expo start --ios
