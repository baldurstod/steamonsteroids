export enum GenerationState {
	Started = 0,
	Sucess,
	Failure,
	LoadingModel,
	RetrievingItemDatas,
}

export type GenerationStateEvent = {
	state: GenerationState;
	listingId: string;

}
