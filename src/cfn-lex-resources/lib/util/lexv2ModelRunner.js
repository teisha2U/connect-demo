var aws = require('aws-sdk')
var Promise = require('bluebird')
aws.config.region = process.env.REGION
aws.config.setPromisesDependency(Promise)


const {actions, pause} = require("./lexUtils")
const DRAFT = "DRAFT"

class LexRunner {
    constructor(region, type) {
        this.create_method = 'create' + type
        this.update_method = 'update' + type
        this.delete_method = 'delete' + type
        this.get_method = "describe" + type
        this.lex = new aws.LexModelsV2({region: region})
    }
 

 
    /**
     * Find all versions of a given Bot. Lex API returns an array of versions available for a given
     * Bot. This functions resolves the promise and returns that array.
     * @param id
     * @returns {*}
     */
     botVersions(id) {
        return this.lex["listBotVersions"]({
            name: id,
            maxResults: 50,
        }).promise().get("bots");
    }

    getFunction (action) {
        switch (action) {
            case actions.CREATE:
                return this.create_method;
            case actions.UPDATE:
                return this.update_method;
            case actions.DELETE: 
                return this.delete_method;
            default:
                return this.get_method;
        }
    }

    run = (action, params) => {
        console.log("RUN: " + action)
        // This comes in as text, should be boolean. 
        if (params.enableModelImprovements) {
            params.enableModelImprovements = { "false": false, "true": true }[params.enableModelImprovements]
        }
        const fnc = this.getFunction(action);
        console.log(fnc + ':request:' + JSON.stringify(params, null, 3))
        return new Promise( (res, rej) => {
            var next = async (count) => {
                console.log("tries-left:" + count);
                var request = this.lex[fnc](params);
                request.promise()
                    .tap(x => console.log(fnc + ':result:' + JSON.stringify(x, null, 3)))
                    .then(res)
                    .catch(function (err) {
                        console.log(fnc + ':' + err.code)
                        var retry = err.retryDelay || 5
                        console.log("retry in " + retry)
    
                        if (err.code === "ConflictException") {
                            count === 0 ? rej("Error") : setTimeout(() => next(--count), retry * 1000)
                        } else if (err.code === "ResourceInUseException") {
                            count === 0 ? rej("Error") : setTimeout(() => next(--count), retry * 1000)
                        } else if (err.code === "LimitExceededException") {
                            setTimeout(() => next(count), retry * 1000)
                        } else if (err.code === "AccessDeniedException") {
                            setTimeout(() => next(count), retry * 1000)
                        } else {
                            rej(err.code + ':' + err.message)
                        }
                    })

            }
            let retries = 5 ;
            if (params.count) {
                retries = params.count
                delete params.count
            }
            next(retries)
        })
    }
    

    getUpdatedLocaleStatus = async (botId, botVersion, localeId, secondsToWait, dontAllowStatuses, tries) => {
        return new Promise ( async (resolve, reject) => {
          let retryCount = tries || 10;
          let botLocaleStatus;
          console.log("GetUpdatedStatus::  Wait " + secondsToWait + " seconds and get status - ATTEMPT # " + retryCount)
          await pause(secondsToWait);
      
          try {
              const botLocale = await this.lex.describeBotLocale({
                botId: botId, 
                botVersion: botVersion,
                localeId: localeId
              }).promise()
          
              botLocaleStatus = botLocale.botLocaleStatus
          } catch(error) {
            if (error.code === "ResourceNotFoundException") {
                botLocaleStatus = "DELETED";
            } else {
                reject(error.message)
            }              
          }

          if (dontAllowStatuses.includes(botLocaleStatus) && retryCount > 0) {
            console.log("GetUpdatedStatus:: Status is " + botLocaleStatus +  " Need to wait and requery")
            botLocaleStatus = await this.getUpdatedLocaleStatus(botId, botVersion, localeId, secondsToWait, dontAllowStatuses, retryCount - 1 )
            console.log("GetUpdatedStatus:: ==== " + botLocaleStatus + " ====")
          }
          console.log("GetUpdatedStatus:: RETURNING Locale " + localeId + " status is: " + botLocaleStatus) //, botLocale)
          if (dontAllowStatuses.includes(botLocaleStatus)) { return reject("GetUpdatedStatus:: Status is not allowed: " + botLocaleStatus) }
          return resolve(botLocaleStatus);
      
        } )
    } 
  
    waitForBotStatus = async (botId, secondsToWait, waitForStatus, maxRetries) => {
        const triesLeft = maxRetries - 1
        return new Promise ( async (resolve, reject) => {
          if (triesLeft < 0 ) {
            return reject("Bot Status did not resolve to " + waitForStatus + "  in the allowed number of tries")
          }
      
          let botStatus;
          console.log("GetBotStatus::  Wait " + secondsToWait + " seconds and get status")
          await pause(secondsToWait);
      
          try {
              const botData = await this.lex.describeBot({
                botId: botId
              }).promise()
              botStatus = botData.botStatus
          } catch( error) {
              if (error.code === "ResourceNotFoundException") {
                  botStatus = "DELETED";
              } else {
                  reject(error.message)
              }
          }
      
          if (botStatus === waitForStatus) {
            console.log("GetBotStatus:: Status is " + waitForStatus +  ". Return the status!")
            console.log("GetBotStatus:: ==== " + botStatus + " ====")
            return resolve(botStatus);
          } else {
            botStatus = await this.waitForBotStatus(botId, secondsToWait, waitForStatus, triesLeft)
          }
          console.log("GetBotStatus:: RETURNING BOT STATUS " + botId + " status is: " + botStatus) //, botLocale)
          if (botStatus !== waitForStatus) { return reject("GetBotStatus:: Status is not allowed: " + botStatus) }
          return resolve(botStatus);
        } )  
    }
    
    getBotId =  (botName, nextToken) => {
        const params = {
            filters: [
            {
              name: "BotName",
              operator: "EQ",
              values: [botName]
            }]
          }
          if (nextToken) {
              params.nextToken = nextToken
          }
        return new Promise ( async (resolve, reject) => {
            try {
                const data = await this.lex.listBots(params).promise()
                console.log("List Returned, " ,data)
                if (data.botSummaries && data.botSummaries.length > 0) {
                  console.log("ID is " + data.botSummaries[0].botId + ", version is: " + data.botSummaries[0].latestBotVersion)
                  return resolve({
                        botId : data.botSummaries[0].botId,
                        botVersion : data.botSummaries[0].latestBotVersion
                  })
                } else if (data.nextToken ) {
                    return resolve(await this.getBotId(botName, data.nextToken))
                }  
                return resolve ({}) 
            } catch (error) {
            console.log(error)
            return reject(error.message)
            }
        })
    }

    getSlotTypeId = (botId, botVersion, localeId, slotTypeName, nextToken) => {
        console.log("Find SlotTypeID for slotTypeName: " + slotTypeName)
        const params = {
            botId: botId,
            botVersion: botVersion,
            localeId: localeId,
            filters: [{
              name: "SlotTypeName",
              values: [slotTypeName],
              operator: "EQ"
            }]
          }
        if (nextToken) {
            params.nextToken = nextToken
        }
        return new Promise( async (resolve, reject) => {
            try {
                const existingSlotType = await this.lex.listSlotTypes(params).promise();
                console.log("existing slot type: ", existingSlotType)
          
                if (existingSlotType.slotTypeSummaries && existingSlotType.slotTypeSummaries.length > 0) {
                    console.log("Found Slot Type: " + existingSlotType.slotTypeSummaries[0].slotTypeId)
                    return resolve(existingSlotType.slotTypeSummaries[0].slotTypeId);
                } else if (existingSlotType.nextToken) {
                    return resolve(await this.getSlotTypeId(botId, botVersion, localeId, slotTypeName, existingSlotType.nextToken) )
                }
                return resolve(undefined);
            } catch(error) {
            console.error ("Could not find slot type: " + slotTypeName)
            console.error(error.code + ": " + error.message)
            return resolve(undefined);
            }   
        })
    }


    getIntentId = (botId, botVersion, localeId, intentName, nextToken) => {
        const params = {
            botId: botId,
            botVersion: botVersion,
            localeId: localeId,
            filters: [{
              name: "IntentName",
              values: [intentName],
              operator: "EQ"
            }]
          }
        if (nextToken) {
            params.nextToken = nextToken
        }  
        return new Promise( async (resolve, reject) => {
            try {
                const existingIntent = await this.lex.listIntents(params).promise();
                console.log("existing intent: ", existingIntent)
          
                if (existingIntent.intentSummaries && existingIntent.intentSummaries.length > 0) {
                    console.log("Found intentId: " + existingIntent.intentSummaries[0].intentId)
                    return resolve( existingIntent.intentSummaries[0].intentId);
                } else if (existingIntent.nextToken) {
                    return resolve( await this.getIntentId(botId, botVersion, localeId, intentName, existingIntent.nextToken) )
                }
                return resolve(undefined);
            } catch(error) {
            console.error ("Could not find intent: " + intentName)
            console.error(error.code + ": " + error.message)
            return resolve(undefined);
            }   
        })
    }

    getAliasId = (botId, aliasName, nextToken) => {
        const params = {
            botId: botId
          }
        if (nextToken) {
            params.nextToken = nextToken
        }
        return new Promise( async (resolve, reject) => {
            try {
                const existingBotAlias = await this.lex.listBotAliases(params).promise();
                console.log("existing intent: ", existingBotAlias)
          
                if (existingBotAlias.botAliasSummaries  && existingBotAlias.botAliasSummaries.length > 0) {
                    const liveAlias = existingBotAlias.botAliasSummaries.find(alias => alias.botAliasName === aliasName)
                    if (liveAlias.botAliasId) {
                        console.log("Found alias ", liveAlias)
                        return resolve(liveAlias.botAliasId)
                    } else if (existingBotAlias.nextToken) {
                        return resolve( await this.getAliasId(botId, aliasName, existingBotAlias.nextToken) )
                    }
                }
                return resolve(undefined);
            } catch(error) {
                console.error ("Could not find alias: " + aliasName)
                console.error(error.code + ": " + error.message)
                return resolve(undefined);
            }   
        })
    }


    listIntentSlots = (botId, botVersion, localeId, intentId, nextToken) => {
        const slotParams = {
            botId: botId,
            botVersion: botVersion,
            intentId: intentId,
            localeId: localeId
          }
        if (typeof nextToken !== "undefined" &&  nextToken) {
            slotParams["nextToken"] = nextToken;
        }
        return new Promise( async (resolve, reject) => {
            try {
                const existingSlots = await this.lex.listSlots(slotParams).promise();
                console.log("existing slots: ", existingSlots)
          
                let listOfSlots = []
                if (existingSlots.slotSummaries   && existingSlots.slotSummaries.length > 0) {
                    listOfSlots.push( existingSlots.slotSummaries )
                    if (existingSlots.nextToken) {
                        console.log("Get remaining ", existingSlots.nextToken)
                        listOfSlots.push(await this.listIntentSlots(botId,botVersion,localeId,intentId,existingSlots.nextToken))

                    }
                    return resolve(listOfSlots.flat())
                }
                return resolve([]);
            } catch(error) {
                console.error ("Could not find slots for intentId: " + intentId + " botId:" +  botId + "botVersion:" + botVersion + "LocaleId" + localeId)
                console.error(error.code + ": " + error.message)
                return resolve([]);
            }   
        })
    }

    createSlot = (slotParams) => {
        return new Promise( async (resolve, reject) => {
            try {
                console.log("Create Slot: ", slotParams)
                const newSlot  = await this.lex.createSlot(slotParams).promise();
                return resolve(newSlot)
            } catch (error) {
                console.error("Could not create Slot: "+ slotParams.slotName);
                console.error(error)
                return reject(error)
            }
        })
    }

    updateSlot = (slotParams) => {
        return new Promise( async (resolve, reject) => {
            try {
                console.log("Update Slot: ", slotParams)
                const updated  = await this.lex.updateSlot(slotParams).promise();
                return resolve(updated)
            } catch (error) {
                console.error("Could not update Slot: "+ slotParams.slotName);
                console.error(error)
                return reject(error)
            }
        })
    }

    deleteSlot = (slotParams) => {
        return new Promise( async (resolve, reject) => {
            try {
                const deleteParams = {
                    botId: slotParams.botId,
                    botVersion: slotParams.botVersion,
                    intentId: slotParams.intentId,
                    localeId: slotParams.localeId,
                    slotId: slotParams.slotId
                }
                console.log("DELETE Slot: ", deleteParams)
                const deleted  = await this.lex.deleteSlot(deleteParams).promise();
                return resolve(deleted)
            } catch (error) {
                console.error("Could not delete Slot: "+ slotParams.slotName);
                console.error(error)
                return reject(error)
            }
        })
    }
    
    createNewVersion = async (botParams) => {
        return new Promise( async (resolve, reject) => {
            const specification = {}
            const localeBuilders = [];
            console.log("Creating New Version from BOT PARAMS: \n" + JSON.stringify(botParams, null, 2) )

            // Build the draft version (new versions will be created from DRAFT)
            for (let localeId of Object.keys(botParams.botAliasLocaleSettings)) {
                specification[ localeId] = {
                    sourceBotVersion: DRAFT
                }

                localeBuilders.push(new Promise(async(resolve) => {
                    let status = await this.getUpdatedLocaleStatus(botParams.botId, DRAFT, 
                        localeId, 30, ["Building","ReadyExpressTesting"])
                    const buildKick = await this.lex.buildBotLocale({
                        botId: botParams.botId,
                        botVersion: DRAFT,
                        localeId: localeId
                    }).promise()
                    console.log(buildKick)
                    // Wait until status is no longer "Building"
                    status = await this.getUpdatedLocaleStatus(botParams.botId, DRAFT, 
                                                            localeId, 60, ["Building","ReadyExpressTesting"])
                    console.log("STATUS IS: " + status)
                    return resolve(status);
                } ))
            }

           
           //Create new version 
            try {
                const locales = await Promise.all(localeBuilders);
                console.log(locales);
                const versionData = await this.lex.createBotVersion({
                    botId: botParams.botId,
                    botVersionLocaleSpecification: specification
                }).promise();

                console.log("VERSION CREATED ", versionData)
                const botVersion = versionData.botVersion
                console.log("Wait for Bot Status to become Available: \n" + JSON.stringify(botParams, null, 2) )
                // Wait for bot to be available
                const botStatus = await this.waitForBotStatus( botParams.botId, 30, 'Available', 30)
                console.log('Bot Status is ' + botStatus)

                return resolve(botVersion)
            } catch (error) {
                console.error("Can not create new version for " + botParams.botId + " / " +  botParams.botVersion + " / " + botParams.localeId )
                console.log(error)
                return reject(error)
            } 
        });
    }

    createConnectPolicy = async (botId, botAliasId, connectInstance ) => {
        
        return new Promise( async (resolve, reject) => {
            if (typeof connectInstance === "undefined" || !connectInstance || connectInstance.split(":").length < 5 ) {
                return resolve("No connect Instance provided - no resource policy created " + connectInstance)
            }
            const arnRoot = connectInstance.split(":").slice(0, 5)
            const account = arnRoot.slice(-1).toString()
            const region = arnRoot[3].toString();
            const botAliasArn =  `${arnRoot.join(":").replace("connect", "lex")}:bot-alias/${botId}/${botAliasId}`
            const connectInstanceId = connectInstance.split(":").slice(-1).toString().split("/")[1]
            console.log("Create Resource-based policy for " + connectInstance);
            const policyParams =  {
                action: [
                    "lex:GetSession",
                    "lex:PutSession",
                    "lex:RecognizeText",
                    "lex:StartConversation"                   
                ],
                effect: "Allow",
                principal: [{ service: "connect.amazonaws.com"}],
                statementId: "AllowConnect",
                resourceArn: botAliasArn,
                condition: {
                    StringEquals: {"AWS:SourceAccount": account},
                    ArnEquals: { "AWS:SourceArn" : connectInstance }
                }
            }
            try {
                console.log("CREATE policy with params: ", policyParams)
                const aliasPolicy  = await this.lex.createResourcePolicyStatement(policyParams).promise();
                console.log("Resource Policy created"), aliasPolicy;
                const association = await this.associateToConnectInstance(botAliasArn, connectInstanceId)
                return resolve(aliasPolicy);
            } catch (error) {
                console.error("Error creating Policy for botId: "+ botId + " botAliasId: " + botAliasId);
                console.error(error)
                return reject(error)
            }
        })

    }

    associateToConnectInstance = async ( botAliasArn, connectInstanceId, region) => {
        const params = {
            InstanceId: connectInstanceId,
            LexV2Bot: {
                AliasArn: botAliasArn
            }
        }
        return new Promise( async (resolve, reject) => {
            try {
                const connect = new aws.Connect({apiVersion: '2017-08-08', region: region});
                console.log("Associate to connect with params ", params)
                const associationData = await connect.associateBot(params).promise()
                return resolve(associationData)
            } catch (error) {
                console.log("Could not associate bot " + botAliasArn + " to  Connect Instance " + connectInstanceId )
                console.log(error)
                return reject(error)
            }
        });
    }

    disassociateFromConnectInstance = async ( botId, botAliasId, connectInstance) => {
        if (typeof connectInstance === "undefined" || !connectInstance || connectInstance.split(":").length < 5 ) {
            return resolve("No connect Instance provided - no resource policy created " + connectInstance)
        }
        const arnRoot = connectInstance.split(":").slice(0, 5)
        const account = arnRoot.slice(-1).toString()
        const region = arnRoot[3].toString();
        const botAliasArn =  `${arnRoot.join(":").replace("connect", "lex")}:bot-alias/${botId}/${botAliasId}`
        const connectInstanceId = connectInstance.split(":").slice(-1).toString().split("/")[1]

        const params = {
            InstanceId: connectInstanceId,
            LexV2Bot: {
                AliasArn: botAliasArn
            }
        }
        return new Promise( async (resolve, reject) => {
            try {
                const connect = new aws.Connect({apiVersion: '2017-08-08', region: region});
                console.log("Associate to connect with params ", params)
                const associationData = await connect.disassociateBot(params).promise()
                return resolve(associationData)
            } catch (error) {
                console.log("Could not associate bot " + botAliasArn + " to  Connect Instance " + connectInstanceId )
                console.log(error)
                return reject(error)
            }
        });
    }
}

module.exports = LexRunner