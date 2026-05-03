export enum GenerationState {
	Started = 0,
	Success,
	Failure,
	LoadingModel,
	RetrievingItemDatas,
	WaitingForGeneration,
}

export type GenerationStateEvent = {
	state: GenerationState;
	listingId: string;

}
