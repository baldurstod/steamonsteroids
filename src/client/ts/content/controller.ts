import { GenerationState } from '../enums';

export enum ControllerEvents {
	Tf2RefreshVisibleListing = 'refreshvisiblelisting',
	ClearMarketListing = 'clearmarketlisting',
	SetGenerationState = 'setgenerationstate',
	ShowRowContainer = 'showrowcontainer',
	HideRowContainer = 'hiderowcontainer',
	SelectInventoryItem = 'selectinventoryitem',
	CenterCameraTarget = 'centercameratarget',
	SetCameraTarget = 'setcameratarget',
	SetItemInfo = 'setiteminfo',
}

export type ClearMarketListingEvent = {
	listingId: string;
}

export type SetGenerationStateEvent = {
	state: GenerationState;
	listingId: string;
}

export type SetItemInfoEvent = {
	listingId: string;
	info: string;
}

export class Controller {
	static readonly eventTarget = new EventTarget();

	static addEventListener(type: ControllerEvents, callback: EventListenerOrEventListenerObject | null, options?: AddEventListenerOptions | boolean): void {
		this.eventTarget.addEventListener(type, callback, options);
	}

	static dispatch(type: ControllerEvents, options?: CustomEventInit): boolean {
		return this.eventTarget.dispatchEvent(new CustomEvent(type, options));
	}

	static dispatchEvent(event: Event): boolean {
		return this.eventTarget.dispatchEvent(event);
	}

	static removeEventListener(type: ControllerEvents, callback: EventListenerOrEventListenerObject | null, options?: EventListenerOptions | boolean): void {
		this.eventTarget.removeEventListener(type, callback, options);
	}
}
