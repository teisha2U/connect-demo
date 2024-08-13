import { IRoutingFulfillment } from "../../models/iRoutingFulfillment";
import { DynamoService } from "../DynamoService";


interface DbModel {
    PK: string;
    SK: string;
    intentName: string;
    inputTranscript: string;
    userId: string;
    dateSaved: string;
    TTL: number;
    inboundPhone: string;
    sessionId: string;
}

export const ROUTING_FULFILLMENT_PK = "ROUTING_INTENT"
export class RoutingFulfillmentSchema {
    constructor(private dynamo: DynamoService) {    }

    async put(item : IRoutingFulfillment)  {
        return await this.dynamo.put(this.convertItemToDbModel(item));
    }

    async delete(contactId: string) {
        const key = {
            PK: ROUTING_FULFILLMENT_PK,
            SK: contactId
        }
        const response = await this.dynamo.delete(key);
        console.log("Deleted: ", response)
        return response;
    }

    async get(contactId: string): Promise<IRoutingFulfillment | null> {
        const key = {
            PK: ROUTING_FULFILLMENT_PK,
            SK: contactId
        }
        const response = await this.dynamo.get(key);  
        if (!response.Item) return null;
        return (this.convertDbModelToItem(response.Item))
    }


    async getAll(): Promise<any> {
        const params = {
            KeyConditionExpression: 'PK = :value',
            ExpressionAttributeValues: {
                ':value': ROUTING_FULFILLMENT_PK
            }
        }

        const allRoutingIntents =  await this.dynamo.query(params);
        allRoutingIntents.Items = allRoutingIntents.Items.map( (item: DbModel) => this.convertDbModelToItem(item))
        return allRoutingIntents;
    }


    convertItemToDbModel (item: IRoutingFulfillment) : DbModel {
        const model :DbModel =   {
            PK: ROUTING_FULFILLMENT_PK,
            SK: item.contactId,
            intentName: item.intentName ,
            inputTranscript: item.inputTranscript ,
            userId: item.userId ,
            dateSaved: item.dateSaved,
            TTL: item.TTL,
            inboundPhone: item.inboundPhone,
            sessionId: item.sessionId
        }
        return model;
    }

    convertDbModelToItem (data: DbModel) : IRoutingFulfillment {
        console.log(data)
        const item: IRoutingFulfillment = {
            contactId: data.SK,
            intentName: data.intentName ,
            inputTranscript: data.inputTranscript ,
            userId: data.userId ,
            dateSaved: data.dateSaved,
            TTL: data.TTL,
            inboundPhone: data.inboundPhone,
            sessionId: data.sessionId
        }
        return item
    }
}


