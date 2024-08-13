import { Context } from "aws-lambda";
import { RoutingFulfillmentLambda } from "./lambdas/RoutingFulfillmentLambda";
import { LexV2Event } from "./models";
import { BotDestinationSchema } from "./services/dataSchema/BotDestinationSchema";
import { BotMultiLanguagePromptSchema } from "./services/dataSchema/BotMultiLanguagePromptSchema";

import { RoutingFulfillmentSchema } from "./services/dataSchema/RoutingFulfillmentSchema";
import { DynamoService } from "./services/DynamoService";

export const RouterIntent = async (
  event: LexV2Event,
  context: Context
): Promise<any> => {
  console.log(JSON.stringify(event, null, 2));
  console.log(JSON.stringify(context, null, 2));

  const lambda = new RoutingFulfillmentLambda(
    new RoutingFulfillmentSchema(new DynamoService(process.env.LEX_DATA_TABLE)),
    new BotMultiLanguagePromptSchema(
      new DynamoService(process.env.LEX_DATA_TABLE)
    ),
    new BotDestinationSchema(new DynamoService(process.env.LEX_DATA_TABLE))
  );
  return await lambda.handler(event);
};
