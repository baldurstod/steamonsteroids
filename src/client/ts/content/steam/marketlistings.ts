import { createElement } from 'harmony-ui';
import { MARKET_LISTING_ROW_CLASSNAME } from '../../constants';
import { MASKET_LISTING_ROW_PREFIX } from './constants';

export type ListingElement = {
	row: HTMLElement;
	canvas?: HTMLElement;
	picture?: HTMLElement;
}

export class MarketListings {
	#rows = new Map<string, ListingElement>();

	getRow(listing: string): HTMLElement | null {
		return this.#getListing(listing)?.row ?? null;
	}

	getCanvas(listing: string): HTMLElement | null {
		return this.#getListing(listing)?.canvas ?? null;
	}

	getPicture(listing: string): HTMLElement | null {
		return this.#getListing(listing)?.picture ?? null;
	}

	#getListing(listing: string): ListingElement | null {
		let listingElement = this.#rows.get(listing);
		if (listingElement) {
			return listingElement;
		}

		this.#refreshListings();

		listingElement = this.#rows.get(listing);
		if (listingElement) {
			return listingElement;
		}

		return null;
	}

	#refreshListings(): void {
		const htmlListingRows = document.getElementsByClassName(MARKET_LISTING_ROW_CLASSNAME);
		for (let htmlListingRow of htmlListingRows) {
			const marketListingId = htmlListingRow.id.replace(MASKET_LISTING_ROW_PREFIX, '');
			if (marketListingId) {
				this.#rows.set(marketListingId, {
					row: htmlListingRow as HTMLElement,
					canvas: createElement('div', {
						class: 'market-listing-canvas',
						parent: htmlListingRow as HTMLElement,
					}),
					picture: createElement('div', {
						class: 'market-listing-picture',
						parent: htmlListingRow as HTMLElement,
					}),
				});
			}
		}
	}

}
