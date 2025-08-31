const LOADOUT_CREDENTIAL_URL = 'https://loadout.tf/patreon.php';
const STEAM_MARKET_LISTING_URL = 'https://steamcommunity.com/market/listings';
const STEAM_INVENTORY_URL = 'https://steamcommunity.com/profiles/';

function setMessage(message: string, type = 'error') {
	const messages = document.getElementById('messages');
	if (messages) {
		messages.innerText = message;
		messages.className = type;
	}
}

async function collapseMarketFavorites() {
	const expandButton = document.getElementById('options-market-favorites-expand-button');
	if (expandButton) {
		expandButton.style.display = '';
	}
	const collapseButton = document.getElementById('options-market-favorites-collapse-button');
	if (collapseButton) {
		collapseButton.style.display = 'none';
	}
	const favoritesListings = document.getElementById('options-market-favorites-listings');
	if (favoritesListings) {
		favoritesListings.style.display = 'none';
	}
}

async function collapseInventoryFavorites() {
	const expandButton = document.getElementById('options-inventory-favorites-expand-button')
	if (expandButton) {
		expandButton.style.display = '';
	}
	const collapseButton = document.getElementById('options-inventory-favorites-collapse-button');
	if (collapseButton) {
		collapseButton.style.display = 'none';
	}
	const favoritesListings = document.getElementById('options-inventory-favorites-listings');
	if (favoritesListings) {
		favoritesListings.style.display = 'none';
	}
}

async function expandMarketFavorites() {
	const collapseButton = document.getElementById('options-market-favorites-collapse-button');
	if (collapseButton) {
		collapseButton.style.display = '';
	}
	const expandButton = document.getElementById('options-market-favorites-expand-button');
	if (expandButton) {
		expandButton.style.display = 'none';
	}
	const favoritesListings = document.getElementById('options-market-favorites-listings');
	if (favoritesListings) {
		favoritesListings.style.display = '';
	}

	const htmlListings = document.getElementById('options-market-favorites-listings');
	if (htmlListings) {
		htmlListings.innerText = '';
	}

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
				htmlListings?.append(htmlListing);
			}
		}
	}
}

async function expandInventoryFavorites() {
	const collapseButton = document.getElementById('options-inventory-favorites-collapse-button');
	if (collapseButton) {
		collapseButton.style.display = '';
	}
	const expandButton = document.getElementById('options-inventory-favorites-expand-button');
	if (expandButton) {
		expandButton.style.display = 'none';
	}
	const favoritesListings = document.getElementById('options-inventory-favorites-listings');
	if (favoritesListings) {
		favoritesListings.style.display = '';
	}

	const htmlListings = document.getElementById('options-inventory-favorites-listings');
	if (htmlListings) {
		htmlListings.innerText = '';
	}

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
			htmlListings?.append(htmlListing);
		}
	}
}

async function checkCredentials() {
	const storage = await chrome.storage.sync.get('app.access.level');
	const credentials = document.getElementById('credentials');
	if (!credentials) {
		return;
	}
	if (storage['app.access.level'] > 0) {
		credentials.style.display = 'none';
	} else {
		credentials.style.display = '';
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
	document.getElementById('button-login-loadout-tf')?.addEventListener('click', () => getPatreonCredential(LOADOUT_CREDENTIAL_URL));
	document.getElementById('button-clear-datas')?.addEventListener('click', () => clearExtensionDatas());
	document.getElementById('button-clear-market-favorites')?.addEventListener('click', () => clearMarketFavorites());
	document.getElementById('button-clear-inventory-favorites')?.addEventListener('click', () => clearInventoryFavorites());

	document.getElementById('options-market-favorites-expand-button')?.addEventListener('click', () => expandMarketFavorites());
	document.getElementById('options-market-favorites-collapse-button')?.addEventListener('click', () => collapseMarketFavorites());

	document.getElementById('options-inventory-favorites-expand-button')?.addEventListener('click', () => expandInventoryFavorites());
	document.getElementById('options-inventory-favorites-collapse-button')?.addEventListener('click', () => collapseInventoryFavorites());

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
