import { IDestinations, IBotDestinations } from "../../models/IBotDestinations";
import { DynamoService } from "../DynamoService";

interface DbModel {
  PK: string;
  SK: string;
  // BotName: string;
  // DestinationName: string;
  destinationValues: IDestinations[];
  disabled: "true" | "false";
  type?: string;
}

export const MULTILANG_PK_PREFIX = "BOT|";
export const MULTILANG_SK_PREFIX = "DESTINATION_NAME|";

export class BotDestinationSchema {
  constructor(private dynamo: DynamoService) {}

  async put(item: IBotDestinations) {
    return await this.dynamo.put(this.convertItemToDbModel(item));
  }

  async delete(botName: string, destinationName: string) {
    const key = {
      PK: MULTILANG_PK_PREFIX + botName,
      SK: MULTILANG_SK_PREFIX + destinationName,
    };
    const response = await this.dynamo.delete(key);
    console.log("Deleted: ", response);
    return response;
  }

  async get(
    botName: string,
    destinationName: string
  ): Promise<IBotDestinations | null> {
    const key = {
      PK: MULTILANG_PK_PREFIX + botName,
      SK: MULTILANG_SK_PREFIX + destinationName,
    };
    const response = await this.dynamo.get(key);
    if (!response.Item) return null;
    return this.convertDbModelToItem(response.Item);
  }

  async getAllForBot(botName: string, language: string): Promise<any> {
    const params = {
      KeyConditionExpression: "#PK = :value and begins_with (#SK, :sk_prefix)",
      ExpressionAttributeValues: {
        ":value": MULTILANG_PK_PREFIX + botName,
        ":sk_prefix": MULTILANG_SK_PREFIX,
      },
      ExpressionAttributeNames: {
        "#PK": "key",
        "#SK": "id",
      },
    };

    try {
      const allDestinations = await this.dynamo.query(params);
      allDestinations.Items = allDestinations.Items.map((item: DbModel) =>
        this.convertDbModelToItem(item)
      ).map((item: IBotDestinations) => {
        item.destinationValues = item.destinationValues.filter(
          (dest) => dest.language === language
        );
        return item;
      });
      console.log("Destinations for bot: " + botName, allDestinations);
      return allDestinations.Items;
    } catch (error) {
      console.error(
        "Error getting destinations for " + botName + ", " + language
      );
      console.error(error);
      return [];
    }
  }

  async getAll(): Promise<any> {
    const params = {
      KeyConditionExpression:
        " begins_with (#PK, :pk_prefix) and begins_with (#SK, :sk_prefix)",
      ExpressionAttributeValues: {
        ":pk_prefix": MULTILANG_PK_PREFIX,
        ":sk_prefix": MULTILANG_SK_PREFIX,
      },
      ExpressionAttributeNames: {
        "#PK": "key",
        "#SK": "id",
      },
    };

    const allBotDestinations = await this.dynamo.query(params);
    allBotDestinations.Items = allBotDestinations.Items.map((item: DbModel) =>
      this.convertDbModelToItem(item)
    );
    console.log("Prompts for all bots ", allBotDestinations);
    return allBotDestinations;
  }

  convertItemToDbModel(item: IBotDestinations): DbModel {
    const model: DbModel = {
      PK: MULTILANG_PK_PREFIX + item.BotName,
      SK: MULTILANG_SK_PREFIX + item.DestinationName,
      destinationValues: item.destinationValues,
      type: item.type,
      disabled: item.disabled,
    };
    return model;
  }

  convertDbModelToItem(data: DbModel): IBotDestinations {
    const item: IBotDestinations = {
      BotName: data.PK.replace(MULTILANG_PK_PREFIX, ""),
      DestinationName: data.SK.replace(MULTILANG_SK_PREFIX, ""),
      destinationValues: data.destinationValues,
      type: data.type,
      disabled: data.disabled,
    };
    return item;
  }
}
