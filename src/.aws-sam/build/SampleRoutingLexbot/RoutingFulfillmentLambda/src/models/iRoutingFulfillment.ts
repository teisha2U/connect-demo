export interface IRoutingFulfillment {
    sessionId: string;
    contactId: string;
    intentName: string;
    inputTranscript: string;
    userId: string;
    dateSaved: string;
    TTL: number;
    inboundPhone: string;
}