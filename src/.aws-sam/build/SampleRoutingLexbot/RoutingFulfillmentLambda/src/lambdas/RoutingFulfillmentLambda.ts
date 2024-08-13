import { IRoutingFulfillment } from "../models/iRoutingFulfillment";
import { RoutingFulfillmentSchema } from "../services/dataSchema/RoutingFulfillmentSchema";
import { BaseLambda } from "./BaseLambda";
import { DateUtil } from "../utils/dateUtil";
import { BotMultiLanguagePromptSchema } from "../services/dataSchema/BotMultiLanguagePromptSchema";
import { LexV2Event, LexV2Response } from "../models";
import { BotDestinationSchema } from "../services/dataSchema/BotDestinationSchema";
import { IBotMultiLanguagePrompt } from "../models/IBotMultiLanguagePrompt";

enum Intents {
  CUSTOMER_SERVICE = "rout_customerservice",
  SUPPORT = "rout_support",
  ORDER_STATUS = "rout_orderstatus",
  SALES = "rout_sales",
}

const FALLBACK_MAX_LIMIT = 3;

export class RoutingFulfillmentLambda extends BaseLambda {
  private botName = "RoutingBot";
  private language;
  protected schema: RoutingFulfillmentSchema;
  protected promptSchema: BotMultiLanguagePromptSchema;
  protected destinationSchema: BotDestinationSchema;

  constructor(
    schema: RoutingFulfillmentSchema,
    promptSchema: BotMultiLanguagePromptSchema,
    destinationSchema: BotDestinationSchema
  ) {
    super();
    this.schema = schema;
    this.promptSchema = promptSchema;
    this.destinationSchema = destinationSchema;
  }

  async handler(event: LexV2Event): Promise<any> {
    console.info("event", event);
    const intentName =
      "rout_" +
      event.sessionState.intent.name.toLowerCase().split("_").slice(-1);
    this.language = event.bot.localeId;
    const inboundNumber = event.sessionState.sessionAttributes?.InboundNumber;

    let result: IRoutingFulfillment = {
      sessionId: event.sessionId,
      contactId:
        event.sessionState.sessionAttributes?.contactId || event.sessionId,
      intentName: intentName,
      inputTranscript:
        event.sessionState.sessionAttributes?.originalInput ||
        event.inputTranscript,
      userId: event.requestAttributes?.userId,
      dateSaved: new Date().toISOString(),
      TTL: DateUtil.getTTL(parseInt(process.env.LEX_DATA_TTL_DAYS)),
      inboundPhone: event.sessionState.sessionAttributes?.InboundNumber,
      // { ...event.currentIntent.slotDetails }
    };

    if (event.sessionState.intent.name === "FallbackIntent") {
      return await this.callFallback(event, result);
    }

    try {
      console.debug("Save result");
      await this.schema.put(result);
    } catch (error) {
      console.error("Could not save: " + JSON.stringify(result, null, 2));
      console.log(error);
    }
    const routeChosenMessage =
      '<speak><amazon:breath duration="short" volume="soft"/></speak>';
    const sessionAttributes: { [name: string]: string } = {
      sessionId: result.sessionId,
      contactID: result.contactId,
      intentName: result.intentName,
      inputTranscript: result.inputTranscript,
      userId: result.userId,
      InboundNumber: event.sessionState.sessionAttributes?.InboundNumber,
    };
    return this.fulfill(event, result, routeChosenMessage, sessionAttributes);
  }

  private fulfill(
    event: LexV2Event,
    result: IRoutingFulfillment,
    message: string,
    sessionAttrs: { [name: string]: string }
  ) {
    const closeResponse: LexV2Response = {
      sessionState: {
        state: "Fulfilled",
        intent: event.sessionState.intent,
        dialogAction: {
          type: "Close",
        },
        sessionAttributes: sessionAttrs,
      },
      messages: [
        {
          contentType: "SSML",
          content: message,
        },
      ],
    };
    closeResponse.sessionState.intent.state = "Fulfilled";
    console.info("RETURN: " + JSON.stringify(closeResponse, null, 2));
    console.log(closeResponse);
    return closeResponse;
  }

  public getRoutingFulfillment(
    event: LexV2Event,
    intent: string,
    transcript: string
  ): IRoutingFulfillment {
    return {
      sessionId: event.sessionId,
      contactId:
        event.sessionState.sessionAttributes?.contactId || event.sessionId,
      intentName: intent,
      inputTranscript: transcript,
      userId: event.requestAttributes?.userId,
      dateSaved: new Date().toISOString(),
      TTL: DateUtil.getTTL(parseInt(process.env.LEX_DATA_TTL_DAYS)),
      inboundPhone: event.sessionState.sessionAttributes?.InboundNumber,
    };
  }

  public elicitSlot(
    event: LexV2Event,
    slotName: string,
    message?: string,
    intentName?: string
  ): LexV2Response {
    const originalInput =
      event.sessionState.sessionAttributes?.originalInput ||
      event.inputTranscript;
    const response: LexV2Response = {
      sessionState: {
        state: "InProgress",
        sessionAttributes: {
          ...event.sessionState.sessionAttributes,
          originalInput: originalInput,
        },
        intent: event.sessionState.intent,
        dialogAction: {
          type: "ElicitSlot",
          slotToElicit: slotName,
        },
      },
    };

    if (typeof message !== "undefined" && message) {
      response.messages = [
        {
          contentType: "SSML",
          content: message,
        },
      ];
    }
    if (event.sessionState.activeContexts) {
      response.sessionState.activeContexts = {
        ...event.sessionState.activeContexts,
      };
    }
    if (event.requestAttributes) {
      response.requestAttributes = { ...event.requestAttributes };
    }
    return response;
  }

  private async getMessage(
    message: string,
    defaultMessage: string
  ): Promise<string> {
    try {
      const metaMessage = await this.promptSchema.get(this.botName, message);
      const returnMessage = metaMessage.data.find(
        (msg) => msg.language === this.language
      )?.text;
      return `<speak> ${
        returnMessage ? returnMessage : defaultMessage
      } </speak>`;
    } catch (error) {
      console.error("Error getting message for: " + message);
      return defaultMessage;
    }
  }

  public registerMisunderstanding(event: LexV2Event) {
    let misunderstandings = [];
    if (this.getSessionAttribute(event, "misunderstandings")) {
      misunderstandings = JSON.parse(
        this.getSessionAttribute(event, "misunderstandings")
      );
    }
    const currentMisunderstanding = {
      type: "FALLBACK",
      intent: "FallbackIntent",
      value: event.inputTranscript,
      expected: "intent -",
    };

    misunderstandings.push(currentMisunderstanding);
    return misunderstandings;
  }

  private getSessionAttribute(
    event: LexV2Event,
    attributeName: string
  ): string {
    if (
      event.sessionState?.sessionAttributes &&
      event.sessionState.sessionAttributes[attributeName]
    ) {
      return event.sessionState.sessionAttributes[attributeName];
    }
    return;
  }

  /**
   * This was originally a separate FallbackIntent.
   */
  private async callFallback(
    event: LexV2Event,
    result: IRoutingFulfillment
  ): Promise<LexV2Response> {
    const fallbackBotName = "FallbackBot";
    this.botName = fallbackBotName;
    console.log("FALLBACK EVENT: ", event);
    let fallbackCounter: number = Number(this.getFallbackCounter(event));
    if (!event.sessionState.sessionAttributes) {
      event.sessionState.sessionAttributes = {};
    }
    event.sessionState.sessionAttributes[
      "fallbackCounter"
    ] = `${fallbackCounter}`;

    const misunderstandingsRecorded = this.registerMisunderstanding(event);
    console.log("Found misunderstandings", misunderstandingsRecorded);
    event.sessionState.sessionAttributes["misunderstandings"] = JSON.stringify(
      misunderstandingsRecorded
    );

    const misunderstandingsCount = misunderstandingsRecorded.length;
    console.log(
      `Fallback counter ${fallbackCounter} , number of misunderstandings ${misunderstandingsCount} `
    );

    // No more attempts
    if (fallbackCounter > FALLBACK_MAX_LIMIT) {
      event.sessionState.sessionAttributes["intentName"] = result.intentName;
      event.sessionState.sessionAttributes["sessionId"] = result.sessionId;
      event.sessionState.sessionAttributes["contactID"] = result.contactId;
      event.sessionState.sessionAttributes["intentName"] = result.intentName;
      event.sessionState.sessionAttributes["inputTranscript"] =
        result.inputTranscript;
      event.sessionState.sessionAttributes["userId"] = result.userId;
      event.sessionState.sessionAttributes["dateSaved"] = result.dateSaved;
      // save into LexData table
      console.debug("Save result");
      await this.schema.put(result);

      // Return fulfilled with FallbackIntent
      console.debug("FALLBACK", JSON.stringify(event, null, 4));
      const message = await this.getMessage(
        "fallback",
        "<speak>Sorry, I did not understand.</speak>"
      );
      event.sessionState.sessionAttributes["fallbackResponseMessage"] = message;

      return this.fulfill(
        event,
        result,
        message,
        event.sessionState.sessionAttributes
      );
      // hang up
    }

    // Send elicitIntent back to RoutingBot
    const allMessages: [IBotMultiLanguagePrompt] =
      await this.promptSchema.getAllForBot(fallbackBotName, this.language);
    const messages = [];
    for (let messageKey in allMessages) {
      if (allMessages[messageKey].PromptName.startsWith("misunderstanding")) {
        messages.push(allMessages[messageKey]);
      }
    }
    console.log(
      "Get message " + ((fallbackCounter - 1) % messages.length),
      messages
    );
    const message: string = messages[
      (fallbackCounter - 1) % messages.length
    ].data.find((msg) => msg.language === this.language)?.text;

    const response: LexV2Response = {
      sessionState: {
        state: "InProgress",
        sessionAttributes: JSON.parse(
          JSON.stringify(event.sessionState.sessionAttributes)
        ),
        dialogAction: {
          type: "ElicitIntent",
        },
      },
    };
    if (typeof message !== "undefined" && message) {
      response.messages = [
        {
          contentType: "SSML",
          content: `<speak>${message}</speak>`,
        },
      ];
    }
    console.log("Reprompt for Intent", response);
    return response;
  }

  private getFallbackCounter(event: LexV2Event): number {
    const fallbackCounterAttr = this.getSessionAttribute(
      event,
      "fallbackCounter"
    );
    let fallbackCounter: number;

    if (fallbackCounterAttr === undefined) {
      fallbackCounter = 1;
    } else {
      fallbackCounter = Number(fallbackCounterAttr) + 1;
    }
    return fallbackCounter;
  }
}
