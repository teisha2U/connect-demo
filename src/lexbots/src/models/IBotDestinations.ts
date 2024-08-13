export interface IBotDestinations {
    BotName: string;
    DestinationName: string;
    destinationValues: IDestinations[];
    disabled: "true" | "false";
    type?: string;
}

export interface IDestinations {
    language: string;
    value: string;
}