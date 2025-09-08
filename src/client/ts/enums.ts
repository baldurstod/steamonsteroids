export enum GenerationState {
	Started = 0,
	Sucess,
	Failure,
	LoadingModel,
	RetrievingItemDatas,
	WaitingForGeneration,
}

export type GenerationStateEvent = {
	state: GenerationState;
	listingId: string;

}
