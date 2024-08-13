import { DynamoDB } from "aws-sdk";
import {
    DeleteItemOutput, DocumentClient, PutItemOutput
} from "aws-sdk/clients/dynamodb";

export class DynamoService {
    protected dynamoDb: DynamoDB.DocumentClient;

    constructor(protected tableName: string) {
        this.dynamoDb = new DocumentClient();
    }

    public async delete(key: any): Promise<DeleteItemOutput> {
        const params = {
            Key: key,
            TableName: this.tableName,
        };

        return await this.dynamoDb.delete(params).promise();
    }

    public async get(parameters: any): Promise<any> {
        const params = {
            TableName: this.tableName,
            Key: parameters,
        };

        return await this.dynamoDb.get(params).promise();
    }

    public async put(data: any): Promise<PutItemOutput> {
        const params = {
            Item: data,
            TableName: this.tableName,
        };

        return await this.dynamoDb.put(params).promise();
    }

    public async query(parameters: any): Promise<any> {
        const params = {
            TableName: this.tableName,
            IndexName: parameters.IndexName,
            KeyConditionExpression: parameters.KeyConditionExpression,
            ExpressionAttributeValues: parameters.ExpressionAttributeValues,
        };

        return await this.dynamoDb.query(params).promise();
    }


    // Pretend this operation doesn't exist - use QUERY instead
    // public async scan(): Promise<any> {
    //     const params = {
    //         TableName: this.tableName,
    //     };

    //     return await this.dynamoDb.scan(params).promise();
    // }

    // public async queryWithFilter(
    //     filterExpression: string,
    //     filterValues: ExpressionAttributeValueMap
    // ): Promise<UpdateItemOutput> {
    //     const params: ScanInput = {
    //         TableName: this.tableName,
    //         FilterExpression: filterExpression,
    //         ExpressionAttributeValues: filterValues,
    //     };

    //     return await this.dynamoDb.query(params).promise();
    // }

    public async update(parameters: any): Promise<any> {
        const params = parameters;
        params.TableName = this.tableName;

        return await this.dynamoDb.update(params).promise();
    }
}
