// definition as of 09-09-2021
// Amazon Lex V2 Developer Guide - Using a Lambda Function
// https://docs.aws.amazon.com/lexv2/latest/dg/lambda.html
export interface LexV2Event {
    messageVersion: "1.0";
    invocationSource: "DialogCodeHook" | "FulfillmentCodeHook";
    inputMode: "DTMF" | "Speech" | "Text";
    responseContentType: "CustomPayload" | "ImageResponseCard" | "PlainText" | "SSML",
    sessionId: string;
    inputTranscript: string;
    bot: {
        id: string;
        name: string;
        aliasId: string;
        aliasName?: string;
        localeId: string;
        version: string;
    },
    interpretations: 
        {
            intent: LexV2Intent,
            nluConfidence?: number;
            sentimentResponse?: {
                sentiment: string;
                sentimentScore: {
                    mixed: number;
                    negative: number;
                    neutral: number;
                    positive: number;
                }
            }
        }[];

    requestAttributes?: {
        [requestAttr: string]: string;
    }
    sessionState: {
        activeContexts?: LexV2ActiveContext[];
        sessionAttributes: {
            [attrName: string]: string;
        } 
        dialogAction: {
            slotToElicit: string;
            type: "Close" | "ConfirmIntent" | "Delegate" | "ElicitIntent" | "ElicitSlot";
        }
        intent: LexV2Intent;
        originatingRequestId: string;
    }
}

export interface LexV2Intent {
    confirmationState: "Confirmed" | "Denied" | "None";
    name: string;
    state: "Failed" | "Fulfilled" | "InProgress" | "ReadyForFulfillment";
    kendraResponse?: any;
        // Only present when intent is KendraSearchIntent. For details, see
        // https://docs.aws.amazon.com/kendra/latest/dg/API_Query.html#API_Query_ResponseSyntax    
    slots: {
        [slotName: string]: null | LexV2Slot;
    }
}


export interface LexV2Slot {
    shape: "Scalar" | "List";
    value?: {
        interpretedValue: string;
        originalValue: string;
        resolvedValues: string[];
    }
    values?: LexV2Slot[];
}


export interface LexV2ActiveContext {
    name: string;
    contextAttributes: {
        [contextAttrs: string]: string;
    }
    timeToLive: {
        timeToLiveInSeconds: number;
        turnsToLive: number;
    }
}
