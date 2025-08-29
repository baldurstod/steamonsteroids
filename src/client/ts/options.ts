const LOADOUT_CREDENTIAL_URL = 'https://loadout.tf/patreon.php';
const STEAM_MARKET_LISTING_URL = 'https://steamcommunity.com/market/listings';
const STEAM_INVENTORY_URL = 'https://steamcommunity.com/profiles/';

function setMessage(message: string, type = 'error') {
	const messages = document.getElementById('messages');
	if (messages) {
		messages.innerHTML = message;
		messages.className = type;
	}
}

async function collapseMarketFavorites() {
	(document.getElementById('options-market-favorites-expand-button') as HTMLElement).style.display = '';
	(document.getElementById('options-market-favorites-collapse-button') as HTMLElement).style.display = 'none';
	(document.getElementById('options-market-favorites-listings') as HTMLElement).style.display = 'none';
}

async function collapseInventoryFavorites() {
	(document.getElementById('options-inventory-favorites-expand-button') as HTMLElement).style.display = '';
	(document.getElementById('options-inventory-favorites-collapse-button') as HTMLElement).style.display = 'none';
	(document.getElementById('options-inventory-favorites-listings') as HTMLElement).style.display = 'none';
}

async function expandMarketFavorites() {
	(document.getElementById('options-market-favorites-collapse-button') as HTMLElement).style.display = '';
	(document.getElementById('options-market-favorites-expand-button') as HTMLElement).style.display = 'none';
	(document.getElementById('options-market-favorites-listings') as HTMLElement).style.display = '';

	let htmlListings = document.getElementById('options-market-favorites-listings') as HTMLElement;
	htmlListings.innerHTML = '';

	let storageResult = await chrome.storage.sync.get('app.market.favoritelistings');
	let favoriteListings = storageResult['app.market.favoritelistings'];
	let favorites = new Set<string>();
	if (favoriteListings) {
		for (let listingId in favoriteListings) {
			let listingProperties = favoriteListings[listingId];
			let listingAppId = listingProperties.appId;
			let listingHash = listingProperties.marketHashName;

			let listingAppIdHash = `${listingAppId} ${listingHash}`;
			if (!favorites.has(listingAppIdHash)) {
				favorites.add(listingAppIdHash);
				let htmlListing = document.createElement('div');
				htmlListing.className = 'options-market-favorite-listing';
				htmlListing.innerHTML = `<a target="_blank" href="${STEAM_MARKET_LISTING_URL}/${listingAppId}/${listingHash}" ><div class="options-market-favorite-listing-hash">${listingHash}</div></a>`;
				htmlListings.append(htmlListing);
			}
		}
	}
}

async function expandInventoryFavorites() {
	(document.getElementById('options-inventory-favorites-collapse-button') as HTMLElement).style.display = '';
	(document.getElementById('options-inventory-favorites-expand-button') as HTMLElement).style.display = 'none';
	(document.getElementById('options-inventory-favorites-listings') as HTMLElement).style.display = '';

	let htmlListings = document.getElementById('options-inventory-favorites-listings') as HTMLElement;
	htmlListings.innerHTML = '';

	let storageResult = await chrome.storage.sync.get('app.inventory.favoritelistings');
	let favoriteListings = storageResult['app.inventory.favoritelistings'];
	if (favoriteListings) {
		for (let listingId in favoriteListings) {
			let listingProperties = favoriteListings[listingId];
			let listingSteamUserId = listingProperties.steamUserId;
			let listingAppId = listingProperties.appId;
			let listingContextId = listingProperties.contextId;
			let listingHash = listingProperties.marketHashName;

			let htmlListing = document.createElement('div');
			htmlListing.className = 'options-inventory-favorite-listing';
			htmlListing.innerHTML = `<a target="_blank" href="${STEAM_INVENTORY_URL}/${listingSteamUserId}/inventory/#${listingAppId}_${listingContextId}_${listingId}" ><div class="options-market-favorite-listing-hash">${listingHash}</div></a>`;
			htmlListings.append(htmlListing);
		}
	}
}

async function checkCredentials() {
	let storage = await chrome.storage.sync.get('app.access.level');
	if (storage['app.access.level'] > 0) {
		(document.getElementById('credentials') as HTMLElement).style.display = 'none';
	} else {
		(document.getElementById('credentials') as HTMLElement).style.display = '';
	}
}

async function getPatreonCredential(url: string) {
	try {
		let response = await fetch(url, { credentials: "same-origin" });
		let responseJSON = await response.json();
		if (responseJSON && responseJSON.success) {
			setPledgeLevel(responseJSON.pledge_level ?? 0);
			checkCredentials();
			setMessage('Credentials successfully acquired', 'success');
		} else {
			setMessage('Failed to get the credentials');
		}
	} catch (e) {
		setMessage('Failed to get the credentials');
	}
}

async function clearExtensionDatas() {
	await chrome.storage.sync.clear();
	setMessage('Datas successfully cleared', 'success');
	checkCredentials();
}

async function clearMarketFavorites() {
	chrome.storage.sync.remove('app.market.favoritelistings');
}

async function clearInventoryFavorites() {
	chrome.storage.sync.remove('app.inventory.favoritelistings');
}


document.addEventListener('DOMContentLoaded', (event) => {
	(document.getElementById('button-login-loadout-tf') as HTMLElement).addEventListener('click', () => getPatreonCredential(LOADOUT_CREDENTIAL_URL));
	(document.getElementById('button-clear-datas') as HTMLElement).addEventListener('click', () => clearExtensionDatas());
	(document.getElementById('button-clear-market-favorites') as HTMLElement).addEventListener('click', () => clearMarketFavorites());
	(document.getElementById('button-clear-inventory-favorites') as HTMLElement).addEventListener('click', () => clearInventoryFavorites());

	(document.getElementById('options-market-favorites-expand-button') as HTMLElement).addEventListener('click', () => expandMarketFavorites());
	(document.getElementById('options-market-favorites-collapse-button') as HTMLElement).addEventListener('click', () => collapseMarketFavorites());

	(document.getElementById('options-inventory-favorites-expand-button') as HTMLElement).addEventListener('click', () => expandInventoryFavorites());
	(document.getElementById('options-inventory-favorites-collapse-button') as HTMLElement).addEventListener('click', () => collapseInventoryFavorites());

	checkCredentials();
	collapseMarketFavorites();
	collapseInventoryFavorites();
});


function setPledgeLevel(pledgeLevel: number) {
	chrome.storage.sync.set({
		'app.access.level': pledgeLevel
		, accessLevelLastChecked: Date.now()
	});
}
