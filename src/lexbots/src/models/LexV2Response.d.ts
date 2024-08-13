import { LexV2ActiveContext, LexV2Intent } from "./LexV2Event";

export interface LexV2Response {
    sessionState: {
        activeContexts?: LexV2ActiveContext[];
        sessionAttributes: {
            [sessionAttrs: string]: string;
        }
        dialogAction: {
            slotToElicit?: string;
            type: "Close" | "ConfirmIntent" | "Delegate" | "ElicitIntent" | "ElicitSlot";
        }
        state: "Failed" | "Fulfilled" | "InProgress" | "ReadyForFulfillment";
        intent?: LexV2Intent;
    }
    messages?: 
        {
            contentType: "CustomPayload" | "ImageResponseCard" | "PlainText" | "SSML";
            content?: string;
            imageResponseCard?: {
                title: string;
                subtitle: string;
                imageUrl: string;
                buttons: 
                    {
                        text: string;
                        value: string;
                    }[]
            }
        }[];
    requestAttributes?: {
        [requestAttr: string]: string;
    }
}