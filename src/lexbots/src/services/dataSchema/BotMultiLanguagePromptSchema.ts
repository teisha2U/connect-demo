import {
  ITranslations,
  IBotMultiLanguagePrompt,
} from "../../models/IBotMultiLanguagePrompt";
import { DynamoService } from "../DynamoService";

interface DbModel {
  PK: string;
  SK: string;
  data: ITranslations[];
  type: string;
  disabled: "true" | "false";
}

export const MULTILANG_PK_PREFIX = "BOT|";
export const MULTILANG_SK_PREFIX = "PROMPT|";

export class BotMultiLanguagePromptSchema {
  constructor(private dynamo: DynamoService) {}

  async put(item: IBotMultiLanguagePrompt) {
    return await this.dynamo.put(this.convertItemToDbModel(item));
  }

  async delete(botName: string, promptName: string) {
    const key = {
      PK: MULTILANG_PK_PREFIX + botName,
      SK: MULTILANG_SK_PREFIX + promptName,
    };
    const response = await this.dynamo.delete(key);
    console.log("Deleted: ", response);
    return response;
  }

  async get(
    botName: string,
    promptName: string
  ): Promise<IBotMultiLanguagePrompt | null> {
    const key = {
      PK: MULTILANG_PK_PREFIX + botName,
      SK: MULTILANG_SK_PREFIX + promptName,
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
      const allPrompts = await this.dynamo.query(params);
      allPrompts.Items = allPrompts.Items.map((item: DbModel) =>
        this.convertDbModelToItem(item)
      ).map((item: IBotMultiLanguagePrompt) => {
        item.data = item.data.filter((prompt) => prompt.language === language);
        return item;
      });
      console.log(
        "Prompts for bot: " + botName + " language: " + language,
        allPrompts
      );
      return allPrompts.Items;
    } catch (error) {
      console.error("Error getting prompts for " + botName + ", " + language);
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

    const allBotPrompts = await this.dynamo.query(params);
    allBotPrompts.Items = allBotPrompts.Items.map((item: DbModel) =>
      this.convertDbModelToItem(item)
    );
    console.log("Prompts for all bots ", allBotPrompts);
    return allBotPrompts;
  }

  convertItemToDbModel(item: IBotMultiLanguagePrompt): DbModel {
    const model: DbModel = {
      PK: MULTILANG_PK_PREFIX + item.BotName,
      SK: MULTILANG_SK_PREFIX + item.PromptName,
      data: item.data,
      type: item.type,
      disabled: item.disabled,
    };
    return model;
  }

  convertDbModelToItem(returnData: DbModel): IBotMultiLanguagePrompt {
    const item: IBotMultiLanguagePrompt = {
      BotName: returnData.PK.replace(MULTILANG_PK_PREFIX, ""),
      PromptName: returnData.SK.replace(MULTILANG_SK_PREFIX, ""),
      data: returnData.data,
      type: returnData.type,
      disabled: returnData.disabled,
    };
    return item;
  }
}
