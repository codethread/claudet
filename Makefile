.PHONY: install dev dev-test start test type-check lint format validate mobile mobile-lan mobile-android mobile-ios

install: server/node_modules/.install-stamp mobile/node_modules/.install-stamp

server/node_modules/.install-stamp: server/package.json server/package-lock.json
	cd server && npm install
	touch server/node_modules/.install-stamp

mobile/node_modules/.install-stamp: mobile/package.json mobile/package-lock.json
	cd mobile && npm install
	touch mobile/node_modules/.install-stamp

# Server
dev: install
	cd server && npm run dev

dev-test: install
	cd server && npm run dev:test

start: install
	cd server && npm start

test: install
	cd server && npm test

type-check: install
	cd server && npm run type-check

lint: install
	cd server && npm run lint

format: install
	cd server && npm run format

validate: install
	cd server && npm run validate

# Mobile
mobile: install
	cd mobile && npx expo start

mobile-lan: install
	cd mobile && REACT_NATIVE_PACKAGER_HOSTNAME=homelab.local npx expo start --lan

mobile-android: install
	cd mobile && npx expo start --android

mobile-ios: install
	cd mobile && npx expo start --ios
