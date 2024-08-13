/*
Copyright 2017-2017 Amazon.com, Inc. or its affiliates. All Rights Reserved.

Licensed under the Amazon Software License (the "License"). You may not use this file
except in compliance with the License. A copy of the License is located at

http://aws.amazon.com/asl/

or in the "license" file accompanying this file. This file is distributed on an "AS IS"
BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, express or implied. See the
License for the specific language governing permissions and limitations under the License.
*/

var cfnLambda = require('cfn-lambda')
var aws = require('aws-sdk')
var Promise = require('bluebird')
aws.config.region = process.env.REGION
aws.config.setPromisesDependency(Promise)
const { explodeUtterancesV2 } = require('./util/stringExploder')
const { convertConversationLogs, actions } = require("./util/lexUtils")
const LexRunner = require('./util/lexv2ModelRunner')
const { forEach } = require('jszip')

var iam = new aws.IAM()



  



function makeid(prefix) {
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

    for (var i = 0; i < 5; i++)
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    return text
}

function id(length) {
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

    for (var i = 0; i < length; i++)
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    return text
}

function clean(name) {
    var map = {
        '0': 'zero',
        '1': 'one',
        '2': 'two',
        '3': 'three',
        '4': 'four',
        '5': 'five',
        '6': 'six',
        '7': 'seven',
        '8': 'eight',
        '9': 'nine',
        '-': '_',
    }
    var out = name.replace(/([0-9])/g, x => map[x])
    out = out.replace(/-/g, '_')
    return out
}


const DRAFT = "DRAFT";
class LexV2 {
    constructor(type) {
        this.type = type
        this.modelRunner = new LexRunner(process.env.REGION, type)
    }


    /**
     * Find all versions of a given slottype. Lex API returns an array of objects that describe
     * the available versions of a given slottype. This function returns a promise that resolves
     * to that array.
     * @param id
     * @returns {Promise<PromiseResult<LexModelBuildingService.GetSlotTypeVersionsResponse, AWSError>>}
     */
    slotTypeVersions(id) {
        return lex["getSlotTypeVersions"]({
            name: id,
            maxResults: 50,
        }).promise();
    }



    /**
     * For a given array of intents, resolve the Promise with a map containing the latest version each
     * Intent in the array
     * @param intents
     * @returns {Promise|Promise}
     */
    mapForIntentVersions(intents) {
        return new Promise((resolve, reject) => {
            let p1 = [];
            /**
             * For each Intent in this bot find the latest version number
             */
            intents.forEach(element => {
                p1.push(this.modelRunner.intentVersions(element.intentName));
            });
            console.log("INTENTS: " ,p1)
            Promise.all(p1).then(values => {
                // store a map of the latest version found for each intent. By definition the
                // highest version of each intent will be the last element.
                console.log('VALUES: ', values)
                const map = new Map();
                values.forEach(results => {
                    const element = results.intents[results.intents.length - 1];
                    map.set(element.name, element.version);
                });
                resolve(map);
            }).catch(error => { reject(error) });
        });
    }



    /**
     * For the given botName, resolve the Promise with the latest version of the Bot
     * @param botName
     * @returns {Promise|Promise}
     */
    latestBotVersion(botName) {
        return new Promise((resolve, reject) => {
            this.modelRunner.botVersions(botName).then(versions => {
                const botVersion = versions[versions.length - 1].version; // last version
                resolve(botVersion);
            }).catch(error => {
                console.log('Error obtaining bot version: ' + error);
                reject(error);
            });
        });
    }


    name(params) {
        if (this.type === 'BotAlias' && !params.type && params.name) {
            // use name defined in template if provided otherwise generate a name
            return params.name;
        } else {
            var name = params.name ? clean(params.name) : this.type + makeid()
            name = params.prefix ? [params.prefix, name].join('_') : name;

            console.log("Derived " + name + " from " , params);
            // Original implementation had a suffix, removed for consistent naming 
            // return name.slice(0, 35) + id(5)
            return name.slice(0, 35);
        }
    }

    getBotInfoFromParams = (params, prefix) => {
        const botName = params.botName || this.name({
            type: "Bot",
            name: params.botName,
            prefix: prefix
        })
        console.log("Find info for " + botName)
        return new Promise((resolve, reject) => {
            return this.modelRunner.getBotId(botName)
                .then( botInfo => {
                    console.log("Found botInfo: " , botInfo);
                    return resolve( {botName, ...botInfo})
                })
                .catch( error =>  {
                    console.error("Could not find bot info for: " + botName)
                    console.error(error)
                    return reject(botName)
                })
        })
    }

    getIntentInfoFromParams = (params, prefix) => {
        const intentName = params.name || params.intentName
        console.log("Find IntentId from " + intentName)
        return new Promise( (resolve, reject) => {
            return this.getBotInfoFromParams(params, prefix)
                    .then(botInfo => {
                        if (!botInfo.botId) {
                            return resolve(botInfo)
                        }
                        this.modelRunner.getIntentId(botInfo.botId, DRAFT, //params.botVersion, 
                                                    params.localeId, 
                                                    intentName )
                            .then(intentId => {
                                console.log("Found: " + intentId)
                                this.modelRunner.listIntentSlots(
                                                    botInfo.botId,
                                                    DRAFT,
                                                    params.localeId,
                                                    intentId
                                                )
                                    .then( listOfSlots => {
                                        console.log("Slots Found For Intent", listOfSlots)
                                        return resolve ({
                                            intentId, 
                                            slotList: listOfSlots,
                                            ...botInfo
                                        })
                                    })
                                    .catch( error =>  {
                                        console.error("Could not find slots info for intent: " + intentName + " / " + prefix)
                                        console.error(error)
                                        return reject(intentName)
                                    })                                    
                            })
                            .catch( error =>  {
                                console.error("Could not find intent info for: " + intentName)
                                console.error(error)
                                return reject(intentName)
                            })
                    })
                    .catch( error =>  {
                        console.error("Could not find bot info for: " + intentName, params)
                        console.error(error)
                        return reject(intentName)
                    })
        })
    } 

    getSlotTypeInfoFromParams = (params, prefix) => {
        const slotTypeName = params.name || params.slotTypeName
        console.log("Find SlotTypeId from " + slotTypeName)
        return new Promise( (resolve, reject) => {
            return this.getBotInfoFromParams(params, prefix)
                    .then(botInfo => {
                        if (!botInfo.botId) {
                            return resolve(botInfo)
                        }
                        this.modelRunner.getSlotTypeId(botInfo.botId, DRAFT, //botInfo.botVersion, 
                                    params.localeId, 
                                    slotTypeName)
                            .then(slotTypeId => {
                                console.log("Found: " + slotTypeId)
                                return resolve ({
                                    slotTypeId, 
                                    ...botInfo
                                })
                            })
                            .catch( error =>  {
                                console.error("Could not find slotType info for: " + slotTypeName)
                                console.error(error)
                                return reject(slotTypeName)
                            })
                    })
                    .catch( error =>  {
                        console.error("Could not find bot info for: " + slotTypeName, params)
                        console.error(error)
                        return reject(slotTypeName)
                    })
        })
    }

    getAliasInfoFromParams = (params, prefix) => {
        const aliasName = params.name
        return new Promise( (resolve, reject) => {
            return this.getBotInfoFromParams(params, prefix)
                    .then(botInfo => {
                        if (!botInfo.botId) {
                            return resolve(botInfo)
                        }
                        this.modelRunner.getAliasId(botInfo.botId, aliasName)
                            .then(aliasId => {
                                console.log("Found: " + aliasId)
                                return resolve ({
                                    aliasId, 
                                    ...botInfo
                                })
                            })
                            .catch( error =>  {
                                console.error("Could not find aliasId info for: " + aliasName)
                                console.error(error)
                                return reject(aliasName)
                            })
                    })
                    .catch( error =>  {
                        console.error("Could not find bot info for: " + aliasName, params)
                        console.error(error)
                        return reject(aliasName)
                    })
        })
    } 

    scrubParameters(params) {
        const scrubbedParams = JSON.parse(JSON.stringify(params));
        if (this.type !== "BotAlias" && this.type !== "BotLocale") {
            scrubbedParams.name = this.name(params)
            console.log('Updated scrubbed params.name: ' + params.name) 
        }
        if (scrubbedParams.botName) {
            scrubbedParams.botName = this.name({
                type: "Bot",
                name: params.botName,
                prefix: params.prefix
            })
        }
        this.prefix = scrubbedParams.prefix;

        delete scrubbedParams.prefix
        delete scrubbedParams.DeployVersion
        scrubbedParams.count = 1;


        if (scrubbedParams.dataPrivacy && scrubbedParams.dataPrivacy.childDirected) {
            scrubbedParams.dataPrivacy.childDirected = { "false": false, "true": true }[scrubbedParams.dataPrivacy.childDirected]
        }
        if (scrubbedParams.multipleValuesSetting && scrubbedParams.multipleValuesSetting.allowMultipleValues) {
            scrubbedParams.multipleValuesSetting.allowMultipleValues = { "false": false, "true": true }[scrubbedParams.multipleValuesSetting.allowMultipleValues]
        }
        if (scrubbedParams.fulfillmentCodeHook && scrubbedParams.fulfillmentCodeHook.enabled) {
            scrubbedParams.fulfillmentCodeHook.enabled = { "false": false, "true": true }[scrubbedParams.fulfillmentCodeHook.enabled]
        }
        if (scrubbedParams.dialogCodeHook && scrubbedParams.dialogCodeHook.enabled) {
            scrubbedParams.dialogCodeHook.enabled = { "false": false, "true": true }[scrubbedParams.dialogCodeHook.enabled]
        }
        if (scrubbedParams.botAliasLocaleSettings) {
            for (let localeId of Object.keys(scrubbedParams.botAliasLocaleSettings) ){ 
                if (scrubbedParams.botAliasLocaleSettings[localeId].enabled) {
                    scrubbedParams.botAliasLocaleSettings[localeId].enabled = { "false": false, "true": true }[scrubbedParams.botAliasLocaleSettings[localeId].enabled]
                }
            }
        }
        if (scrubbedParams.conversationLogSettings ) {
            if (scrubbedParams.conversationLogSettings.audioLogSettings) {
                scrubbedParams.conversationLogSettings.audioLogSettings.forEach( setting => {
                    if (setting.enabled) {
                        setting.enabled = { "false": false, "true": true }[setting.enabled]
                    }
                })
            }
            if (scrubbedParams.conversationLogSettings.textLogSettings) {
                scrubbedParams.conversationLogSettings.textLogSettings.forEach( setting => {
                    if (setting.enabled) {
                        setting.enabled = { "false": false, "true": true }[setting.enabled]
                    }
                })
            }                      
        }
        
        if (scrubbedParams.sentimentAnalysisSettings && scrubbedParams.sentimentAnalysisSettings.detectSentiment ) {
            scrubbedParams.sentimentAnalysisSettings.detectSentiment = { "false": false, "true": true }[scrubbedParams.sentimentAnalysisSettings.detectSentiment]
        }
        if (scrubbedParams.intentClosingSetting ) {
            if ( scrubbedParams.intentClosingSetting.active ) {
                scrubbedParams.intentClosingSetting.active = { "false": false, "true": true }[scrubbedParams.intentClosingSetting.active]
            }
            if (scrubbedParams.intentClosingSetting.closingResponse && scrubbedParams.intentClosingSetting.closingResponse.allowInterrupt) {
                scrubbedParams.intentClosingSetting.closingResponse.allowInterrupt = 
                    { "false": false, "true": true }[scrubbedParams.intentClosingSetting.closingResponse.allowInterrupt]

            }
        }
        if (scrubbedParams.intentConfirmationSetting ) {
            if (scrubbedParams.intentConfirmationSetting.active ) {
                scrubbedParams.intentConfirmationSetting.active = { "false": false, "true": true }[scrubbedParams.intentConfirmationSetting.active]
            }
            if ( scrubbedParams.intentConfirmationSetting.promptSpecification && scrubbedParams.intentConfirmationSetting.promptSpecification.allowInterrupt ) {

                    scrubbedParams.intentConfirmationSetting.promptSpecification.allowInterrupt = 
                    { "false": false, "true": true }[scrubbedParams.intentConfirmationSetting.promptSpecification.allowInterrupt]
            }
            if (scrubbedParams.intentConfirmationSetting.declinationResponse && scrubbedParams.intentConfirmationSetting.declinationResponse.allowInterrupt) {
                scrubbedParams.intentConfirmationSetting.declinationResponse.allowInterrupt = 
                    { "false": false, "true": true }[scrubbedParams.intentConfirmationSetting.declinationResponse.allowInterrupt]
            }
        }
        if ( scrubbedParams.valueElicitationSetting && scrubbedParams.valueElicitationSetting.promptSpecification && 
                    scrubbedParams.valueElicitationSetting.promptSpecification.allowInterrupt ) {
            scrubbedParams.valueElicitationSetting.promptSpecification.allowInterrupt = 
            { "false": false, "true": true }[scrubbedParams.valueElicitationSetting.promptSpecification.allowInterrupt]
        }
        if ( scrubbedParams.waitAndContinueSpecification ) {
            if (scrubbedParams.waitAndContinueSpecification.active) {
                scrubbedParams.waitAndContinueSpecification.active = { "false": false, "true": true }[scrubbedParams.waitAndContinueSpecification.active]
            }
            if (scrubbedParams.waitAndContinueSpecification.continueResponse && 
                    scrubbedParams.waitAndContinueSpecification.continueResponse.allowInterrupt ) {
                        scrubbedParams.waitAndContinueSpecification.continueResponse.allowInterrupt = 
                            { "false": false, "true": true }[scrubbedParams.waitAndContinueSpecification.continueResponse.allowInterrupt]
            }
            if ( scrubbedParams.waitAndContinueSpecification.waitingResponse  && 
                scrubbedParams.waitAndContinueSpecification.waitingResponse.allowInterrupt) {
                    scrubbedParams.waitAndContinueSpecification.waitingResponse.allowInterrupt = 
                        { "false": false, "true": true }[scrubbedParams.waitAndContinueSpecification.waitingResponse.allowInterrupt]
            }
            if ( scrubbedParams.waitAndContinueSpecification.stillWaitingResponse  && 
                scrubbedParams.waitAndContinueSpecification.stillWaitingResponse.allowInterrupt) {
                    scrubbedParams.waitAndContinueSpecification.stillWaitingResponse.allowInterrupt = 
                        { "false": false, "true": true }[scrubbedParams.waitAndContinueSpecification.stillWaitingResponse.allowInterrupt]
            }
            if (scrubbedParams.skipResourceInUseCheck) {
                scrubbedParams.skipResourceInUseCheck = { "false": false, "true": true }[scrubbedParams.skipResourceInUseCheck]
            }
        }        

        if (scrubbedParams.slots) {
            for (let paramIdx in scrubbedParams.slots) {
                scrubbedParams.slots[paramIdx] = this.scrubParameters(scrubbedParams.slots[paramIdx]);
                delete scrubbedParams.slots[paramIdx].name
                delete scrubbedParams.slots[paramIdx].count
                console.log(scrubbedParams.slots[paramIdx])
            }
        }
        return scrubbedParams;

    }


    /**
     * Create is called to construct Bot resources. Dependent resource versions are identified and
     * updated as available.
     * @param params
     * @param reply
     * @constructor
     */
    Create = (cf_params, reply) => {
        console.log('Create Lex. Params: ' + JSON.stringify(cf_params, null, 2))
        console.log('Type: ' + this.type)
        let params = this.scrubParameters(cf_params)

        var start = Promise.resolve();
        if (this.type === 'BotAlias') {
            const connectInstance = params.connectInstance 
            delete params.connectInstance

            console.log("CREATE. ALIAS. ASSOCIATE TO CONNECT: " + connectInstance, params)
            try {
                this.getBotInfoFromParams(params, this.prefix)
                .then( botInfo => {
                    params.botAliasName = params.name
                    delete params.name
                    params.botId = botInfo.botId;
                    delete params.botName
                    params.botVersion = DRAFT;   // Only create/update on DRAFT version
    
                    this.modelRunner.createNewVersion(params)
                        .then( botVersion => {
                            params.botVersion = botVersion
                            console.log("Create alias on bot: " , {botId: params.botId, 
                                    botVersion: params.botVersion, 
                                    botAliasName: params.botAliasName
                                })
                            start.then(() =>  this.modelRunner.run(actions.CREATE, params))
                            .then(msg => {
                                console.log("ALIAS CREATED: ", msg) 
                                this.modelRunner.createConnectPolicy(params.botId, msg.botAliasId, connectInstance ) 
                                    .then(aliasPolicy => {
                                        console.log(aliasPolicy)
                                        reply(null, msg.name, {ID: msg.botAliasId, Name: msg.botAliasName, BotVersion: msg.botVersion})
                                    })  
                                    .catch(error => {
                                        console.log('caught', error);
                                        reply(error);
                                    })                 
                            })
                            .catch(error => {
                                console.log('caught', error);
                                reply(error);
                            })
                            .error(reply).catch(reply)
                        })
                })
                .catch(error => {
                    console.error("Could not create alias for bot: " + cf_params.botName)
                    console.log('caught', error);
                    reply(error);
                })
                .error(reply).catch(reply)
            } catch (err) {
                console.log("Exception detected: " + err);
                reply(null, ID);
            }
        }
        else if (this.type === 'Intent' && params.parentIntentSignature && params.parentIntentSignature === "AMAZON.FallbackIntent" ) {
            params.intentId = "FALLBCKINT";
            params.intentName = "FallbackIntent";
            delete params.name;
            params.botVersion = DRAFT;

            try {
                this.getBotInfoFromParams(params, this.prefix).then( botInfo => {
                    params.botId = botInfo.botId;
                    params.botVersion = DRAFT;   // Only create on DRAFT version
                    delete params.botName
 
                    start.then(() =>  this.modelRunner.run(actions.UPDATE, params))
                        .then(msg =>  {            
                            reply(null, msg.name, {ID: msg.intentId, Name: msg.intentName})
                        })
                        .catch(error => {
                            console.log('caught', error);
                            reply(error);
                        })
                        .error(reply).catch(reply);
                });
            } catch (err) {
                console.log("Exception detected: " + err);
                reply(null, ID);
            }
        }
        else if (this.type === 'Intent') {
            // Create Intent,
            // Then create Slots with separate API

            params["intentName"] = params.name;
            delete params.name;

            params = explodeUtterancesV2(params);
            params.botVersion = DRAFT;
            console.log("Now intents are: ", JSON.stringify(params, null, 2));

            //slots are created separately
            let intentSlots = []
            if (params.slots && params.slots.length > 0 ) {
                intentSlots = JSON.parse(JSON.stringify(params.slots));
                console.log("Intent slots: ", intentSlots)
            }
            delete params.slots;

            try {
                this.getBotInfoFromParams(params, this.prefix).then( botInfo => {
                    params.botId = botInfo.botId;
                    params.botVersion = DRAFT;   // Only create on DRAFT version
                    delete params.botName
    
                    const slotsCreate = [];
                    const slotsUpdate = []
                    start.then(() =>  this.modelRunner.run(actions.CREATE, params))
                    .then(msg =>  {
                        console.log("Intent Created:", msg)
                        params["intentId"] = msg.intentId
                        if (intentSlots.length > 0) {    
                            for (let slot of intentSlots) {
                                const slotPriority = slot.priority;
                                delete slot.priority;
        
                                slot.botId = params.botId;
                                slot.botVersion = params.botVersion;
                                slot.localeId = params.localeId;
                                slot.intentId = msg.intentId;
                               
                                console.log("Create Slot: ", slot)
                                /**
                                 * For each slot create the slot and add the priority 
                                 * to the intent update
                                 * You can't add priorities until they're created
                                 */
                                slotsCreate.push( this.modelRunner.createSlot(slot)
                                                .then(slotData => {
                                                    console.log("Slot Created: ", slotData);
                                                    slotsUpdate.push({
                                                        priority: slotPriority,
                                                        slotId: slotData.slotId
                                                    })
                                                })
                                )
                            }
                            Promise.all(slotsCreate)
                                .then(slots => {
                                    console.log(slots)
                                    params["slotPriorities"] = slotsUpdate;
                                    this.modelRunner.run(actions.UPDATE, params)
                                        .then(updated => {
                                            console.log(updated)
                                            // the intent creation is finished
                                            reply(null, msg.name, {ID: msg.intentId, Name: msg.intentName})
                                        })
                                })
                                .catch(error => {
                                    console.log('caught', error);
                                    reply(error);
                                }) 
                        } else {
                            reply(null, msg.name, {ID: msg.intentId, Name: msg.intentName})
                        }
                    })
                    .catch(error => {
                        console.log('caught', error);
                        reply(error);
                    })
                    .error(reply).catch(reply);
                });
            } catch (err) {
                console.log("Exception detected: " + err);
                reply(null, ID);
            }
        } else if (this.type === "BotLocale") {
           delete params.name
           try {
               this.getBotInfoFromParams(params, this.prefix).then( botInfo => {
                    params.botId = botInfo.botId;
                    params.botVersion = DRAFT;   // Only create on DRAFT version
                    delete params.botName
                    start.then(() =>  this.modelRunner.run(actions.CREATE, params))
                        .then(msg => {
                            console.log("LOCALE CREATED: ", msg)
                            this.modelRunner.getUpdatedLocaleStatus(params.botId, DRAFT, params.localeId, 30, ["Creating"])
                            .then(console.log)
                            .then(() => {
                                console.log("MESSAGE IS: ", msg)
                                reply(null, msg.name, {ID: `${msg.botId}::${msg.botVersion}::${msg.localeId}`})
                            })
                            .catch(error => {
                                console.log('caught', error);
                                reply(error);
                            })                         
                        })
                        .catch(error => {
                            console.log('caught', error);
                            reply(error);
                        })
                        .error(reply).catch(reply)
                }) 
            } catch (err) {
                console.log("Exception detected: " + err);
                reply(null, ID);
            }
        }
        else if (this.type === 'Bot') {
            params["botName"] = params.name ;
            delete params.name;

            try {
                console.log("Define service link role")
                start = iam.createServiceLinkedRole({
                    AWSServiceName: 'lex.amazonaws.com',
                    Description: 'Service linked role for lex'
                }).promise()
                    .tap(console.log)
                    .catch( err => {
                        console.error("WARNING: ****" + err.code + ":" + err.message + "****\nIf the above error is due to the service role already existing, this can be ignored.")
                    })
                console.log("Service link role created :: Run bot create", params)
                
                start.then(() => this.modelRunner.run(actions.CREATE, params))
                    .then(msg => {
                        console.log("MESSAGE IS: ", msg)
                        reply(null, msg.name, {ID: msg.botId, Name: msg.botName})
                    })
                    .catch(error => { console.log('caught', error); reply(error); })
                    .error(reply).catch(reply)
            } catch (err) {
                console.log("Exception detected: " + err);
                reply(null, ID);
            }
        }
        // SlotType create
        else if (this.type === "SlotType") {
            params.slotTypeName = params.name
            delete params.name
            try {
                this.getBotInfoFromParams(params, this.prefix).then( botInfo => {
                     params.botId = botInfo.botId;
                     params.botVersion = DRAFT;   // Only create on DRAFT version
                     delete params.botName
                     start.then(() => this.modelRunner.run(actions.CREATE, params)
                        .then(msg => reply(null, msg.name, {ID: msg.slotTypeId, Name: msg.slotTypeName}))
                        .catch(error => {
                            console.log('caught', error);
                            reply(error);
                        })
                        .error(reply).catch(reply)
                    )
                 }) 
            } catch (err) {
                console.log("Exception detected: " + err);
                reply(null, ID);
            }
        }        
        else {
            try {
                this.getBotInfoFromParams(params, this.prefix).then( botInfo => {
                    params.botId = botInfo.botId;
                    params.botVersion = DRAFT;   // Only create on DRAFT version
                    delete params.botName
                    console.log("Generic create called for: " + JSON.stringify(params, null, 2));
                    start.then(() => this.modelRunner.run(actions.CREATE, params)
                        .then(msg => reply(null, msg.name, null))
                        .catch(error => {
                            console.log('caught', error);
                            reply(error);
                        })
                        .error(reply).catch(reply)
                    );
                })
            } catch (err) {
                console.log("Exception detected: " + err);
                reply(null, ID);
            }

        }
    }


    /**
     * Update a resource for a Lex Bot, Intent, SlotType, Alias. Update for each resource is designed to
     * find the most recent version of a dependent resource and use the last version of that dependent resource.
     * So an Intent will find the most recent version number of referenced SlotTypes. A Bot will find the most
     * recent version of a referenced Intents. BotAlias will find the most recent version number of a Bot. The
     * correct checksums most also be identified to correctly call put operations against these resources. Promises
     * are used to find checksums and versions and when complete will drive the assignment of versions referenced
     * by parent resources.
     * @param ID
     * @param params
     * @param oldparams
     * @param reply
     * @constructor
     */
    Update = (ID, cf_params, oldparams, reply) => {
        console.log('Update Lex. ID: ' + ID)
        console.log('Params: ' + JSON.stringify(cf_params, null, 2))
        console.log('OldParams: ' + JSON.stringify(oldparams, null, 2))
        console.log('Type: ' + this.type)

        let params = this.scrubParameters(cf_params)
        console.log('Updated params.name: ' + params.name) 

        if (this.type === "BotAlias") {
            const connectInstance = params.connectInstance 
            delete params.connectInstance
            this.getAliasInfoFromParams(params, this.prefix)
            .then(botData => {
                // If there is no alias for this name, run the Create handler
                if (!botData.aliasId) {
                    return this.Create(cf_params, reply);
                }
                params.botAliasId = botData.aliasId
                params.botAliasName = params.name 
                delete params.name
                params.botId = botData.botId;
                delete params.botName
                params.botVersion = DRAFT;   // Only create/update on DRAFT version

                try {
                    this.modelRunner.createNewVersion(params)
                        .then( botVersion => {
                            params.botVersion = botVersion
                            console.log("Create alias on bot: " , {botId:  params.botId, 
                                botVersion:  params.botVersion, 
                                botName:  params.botName})
                            this.modelRunner.run(actions.UPDATE, params)
                            .then(msg => {
                                console.log("ALIAS UPDATED: ", msg)                       
                                reply(null, msg.name, {ID: msg.botAliasId, Name: msg.botAliasName, BotVersion: msg.botVersion})
                            })
                            .catch(error => {
                                console.log('caught', error);
                                reply(error);
                            })
                            .error(reply).catch(reply)
                        })
                        .catch(error => {
                            console.log('caught', error);
                            reply(error);
                        }) 
                } catch (err) {
                    console.log("Exception detected: " + err);
                    reply(null, ID);
                }
            })
        } else if (this.type === 'Bot') {
            params.botName = params.name;
            delete params.name;
            console.log("Update BOT: ", params)
            if (params.botTags) {
                // You can only add tags when you create a bot, you can't use the UpdateBot operation to update the tags on a bot. To update tags, use the TagResource operation.
                console.log("Tags are not updatable by this operation, so removing.")
                delete params.botTags;
            }

            try {
                this.getBotInfoFromParams(params, this.prefix)
                    .then(botInfo => {
                        console.log("Bot Info for ", botInfo)
                        if (!botInfo.botId) {
                            return this.Create(cf_params, reply);
                        }
                        params.botName = botInfo.botName,
                        params.botId = botInfo.botId;
                        console.log('Final params before call to update method: ' + JSON.stringify(params, null, 2));
                        this.modelRunner.run(actions.UPDATE, params)
                        .then(msg => {
                            console.log("BOT UPDATED: ", msg)                       
                            reply(null, msg.name, {ID: msg.botId, Name: msg.botName})
                        })
                        .catch(error => {
                            console.log('caught', error);
                            reply(error);
                        })
                        .error(reply).catch(reply)
                    })
                    .catch(error => {
                        console.log('caught', error);
                        reply(error);
                    })
                    .error(reply).catch(reply)
            } catch (err) {
                console.log("Exception detected: " + err);
                reply(null, ID);
            }
        } else if (this.type === "BotLocale") {
            try {
                this.getBotInfoFromParams(params, this.prefix).then( botInfo => {
                    params.botId = botInfo.botId;
                    params.botVersion = DRAFT;   // "The version can only be the "DRAFT" version
                    delete params.botName
                    delete params.name;
                    this.modelRunner.run(actions.UPDATE, params)
                        .then(msg => {
                            console.log("LOCALE UPDATED: ", msg)
                            this.modelRunner.getUpdatedLocaleStatus(params.botId, DRAFT, params.localeId, 30, ["Building"])
                            .then(console.log)
                            .then(() => {
                                console.log("MESSAGE IS: ", msg)
                                reply(null, msg.name, {ID: `${msg.botId}::${msg.botVersion}::${msg.localeId}`})
                            })
                            .catch(error => {
                                console.log('caught', error);
                                reply(error);
                            })                         
                        })
                        .catch(error => {
                            console.log('caught', error);
                            reply(error);
                        })
                        .error(reply).catch(reply)
                }).catch(error => { console.log('caught', error); reply(error); })
            } catch (err) {
                console.log("Exception detected: " + err);
                reply(null, ID);
            }            

        } else if (this.type === 'SlotType') {
            /**
             * Update SlotType.
             */
            params.slotTypeName = params.name;
            delete params.name;
            try {
                this.getSlotTypeInfoFromParams(params, this.prefix).then( botInfo => {
                    console.log("Found slotType for update: ", botInfo)
                    if (!botInfo.slotTypeId) {
                        return this.Create(cf_params, reply);
                    }
                    params.botId = botInfo.botId;
                    params.botVersion = DRAFT;   // Only create on DRAFT version
                    params.slotTypeId = botInfo.slotTypeId;
                    delete params.botName
                    console.log("Run update with params ", params);
                    this.modelRunner.run(actions.UPDATE, params)
                       .then(msg => reply(null, msg.name, {ID: msg.slotTypeId, Name: msg.slotTypeName}))
                       .catch(error => {
                           console.log('caught', error);
                           reply(error);
                       })
                       .error(reply).catch(reply)
                }).catch(error => { console.log('caught', error); reply(error); })

            } catch (err) {
                console.log("Exception detected: " + err);
                reply(null, ID);
            }
          
        } else if (this.type === 'Intent' && params.parentIntentSignature && params.parentIntentSignature === "AMAZON.FallbackIntent" ) {
            params.intentId = "FALLBCKINT";
            params.intentName = "FallbackIntent";
            delete params.name;
            params.botVersion = DRAFT;

            try {
                this.getBotInfoFromParams(params, this.prefix).then( botInfo => {
                    params.botId = botInfo.botId;
                    params.botVersion = DRAFT;   // Only create on DRAFT version
                    delete params.botName
    
                    start.then(() =>  this.modelRunner.run(actions.UPDATE, params))
                        .then(msg =>  {            
                            reply(null, msg.name, {ID: msg.intentId, Name: msg.intentName})
                        })
                        .catch(error => {
                            console.log('caught', error);
                            reply(error);
                        })
                        .error(reply).catch(reply);
                });
            } catch (err) {
                console.log("Exception detected: " + err);
                reply(null, ID);
            }     
        } else if (this.type === 'Intent') {
                /**
                 * Update an Intent
                 */
                 params["intentName"] = params.name;
                 delete params.name;
     
                 params = explodeUtterancesV2(params);
                 params.botVersion = DRAFT;
                 console.log("UPDATING intent with PARAMS: ", JSON.stringify(params, null, 2));
     
                 //slots are created separately
                 let intentSlots = []
                 if (params.slots && params.slots.length > 0 ) {
                     intentSlots = JSON.parse(JSON.stringify(params.slots));
                     console.log("UPDATE Intent slots: ", intentSlots)
                 }
                 delete params.slots

                try {
                    // find the values for the DRAFT version to use for update
                    this.getIntentInfoFromParams(params, this.prefix)
                        .then (botInfo => {
                            console.log(botInfo)
                            if (!botInfo.intentId) {
                                return this.Create(cf_params, reply);
                            }
                            params.intentId = botInfo.intentId;
                            params.botId = botInfo.botId;
                            params.botVersion = DRAFT;   // Only create/update on DRAFT version
                            delete params.botName
                            const listOfSlots = botInfo.slotList;
                            console.log("Compare existing slots to updated")
                            console.log("EXISTING: ", listOfSlots)
                            console.log("TO UPDATE: ", intentSlots)


                            // update the slots first, and collect the priorities
                            const slotsUpdate = [];
                            const slotsPriorities = []

                            if (intentSlots.length > 0) {

                                for (let slot of intentSlots) {
                                    const slotPriority = slot.priority;
                                    const existingSlot = listOfSlots.find(intentSlot => {
                                        console.log("Compare: " + intentSlot.slotName + " to " + slot.slotName)
                                        return intentSlot.slotName === slot.slotName
                                    })
                                    delete slot.priority;
            
                                    slot.botId = params.botId;
                                    slot.botVersion = DRAFT;
                                    slot.localeId = params.localeId;
                                    slot.intentId = params.intentId;
                                    /**
                                     * For each slot create or update the slot and add the priority 
                                     * to the intent update
                                     * You can't add priorities until they're created
                                     */                                
                                    if (existingSlot) {
                                        slot.slotId = existingSlot.slotId;
                                        slotsUpdate.push( this.modelRunner.updateSlot(slot)
                                                .then(slotData => {
                                                    console.log("Slot Updated: ", slotData);
                                                    slotsPriorities.push({
                                                        priority: slotPriority,
                                                        slotId: slot.slotId
                                                    })  
                                                })
                                                .catch(error => {
                                                    console.log('caught', error);
                                                    reply(error);
                                                })                                
                                        )
                                    } else {
                                        slotsUpdate.push( this.modelRunner.createSlot(slot)
                                                .then(slotData => {
                                                    console.log("Slot Created: ", slotData);
                                                    slotsPriorities.push({
                                                        priority: slotPriority,
                                                        slotId: slotData.slotId
                                                    })
                                                })
                                                .catch(error => {
                                                    console.log('caught', error);
                                                    reply(error);
                                                }) 
                                        )
                                    }                                
                                }
                                
                                listOfSlots.filter(existingSlot => !intentSlots.some(newSlot => newSlot.slotName === existingSlot.slotName))
                                    .forEach( deletedSlot => {
                                        delete deletedSlot.priority;
            
                                        deletedSlot.botId = params.botId;
                                        deletedSlot.botVersion = DRAFT;
                                        deletedSlot.localeId = params.localeId;
                                        deletedSlot.intentId = params.intentId;
    
                                        console.log("Delete Slot: ", deletedSlot);
                                        slotsUpdate.push( this.modelRunner.deleteSlot(deletedSlot)
                                            .then(slotData => {
                                                console.log("Slot Deleted: ", slotData);
                                            }) 
                                            .catch(error => {
                                                console.log('caught', error);
                                                reply(error);
                                            }) 
                                        )
                                    })
    
    
                                Promise.all(slotsUpdate)
                                    .then(slots => {
                                        console.log(slots)
                                        params["slotPriorities"] = slotsPriorities;
                                        this.modelRunner.run(actions.UPDATE, params)
                                            .then(updated => {
                                                console.log("Updated Output" , updated)
                                                // the intent creation is finished
                                                reply(null, updated.name, {ID: updated.intentId, Name: updated.intentName})
                                            })
                                            .catch(error => {
                                                console.log('caught', error);
                                                reply(error);
                                            }) 
                                    })
                                    .catch(error => {
                                        console.log('caught', error);
                                        reply(error);
                                    }) 
                            } else {

                                this.modelRunner.run(actions.UPDATE, params)
                                    .then(updated => {
                                        console.log("Updated Output" , updated)
                                        // the intent creation is finished
                                        reply(null, updated.name, {ID: updated.intentId, Name: updated.intentName})
                                    })
                                    .catch(error => {
                                        console.log('caught', error);
                                        reply(error);
                                    }) 
                            }

                        })
                        .catch(error => {
                            console.log('caught', error);
                            reply(error);
                        }).error(reply).catch(reply);
                    } catch (err) {
                        console.log("Exception detected: " + err);
                        reply(null, ID);
                    }

            // Nothing should fall here
            } else {
                console.log("Parameters for update: " + JSON.stringify(params, null, 2));
                try {
                    this.modelRunner.run(actions.UPDATE, params)
                        .then(msg => reply(null, msg.name, null))
                        .catch(error => { console.log('caught', error); reply(error); })
                        .error(reply).catch(reply)
                } catch (err) {
                    console.log("Exception detected: " + err);
                    reply(null, ID);
                }
            }
    }

    Delete(ID, cf_params, reply) {
        let arg = { name: ID, count: 1 }

        let params = this.scrubParameters(cf_params)
        console.log("Deleting: " , arg)
        console.log("Deleting Scrubbed parameters for bot: " + params.botName , params)

        if (this.type === "BotAlias") {
            try {
                this.getAliasInfoFromParams(params, this.prefix)
                    .then(botData => {
                        if (params.connectInstance) {
                            //Disassociate bot
                        }
                        console.log("Delete Alias: ", botData)
                        if (!botData.aliasId) {
                            return reply(null, ID + " does not exist", null)
                        }
                        arg = {
                            botAliasId: botData.aliasId,
                            botId: botData.botId,
                            skipResourceInUseCheck: true
                        }
                        return this.runDelete(ID, arg, reply)
                    })
                    .catch(error => {
                        console.log('caught', error);
                        reply(null, ID);
                    })
            } catch (err) {
                console.log("Exception detected: " + err);
                reply(null, ID);
            }
        } else if (this.type === "Bot") {
            params.botName = params.name
            try {
                this.modelRunner.getBotId(params.botName)
                    .then(botData => {
                        console.log("ID for Bot: " + params.botName ,  botData)
                        if (!botData.botId) {
                            return reply(null, ID + " does not exist", null)
                        }
                        arg = {
                            botId: botData.botId,
                            skipResourceInUseCheck: true,
                            count: 1
                        };
                        return this.runDelete(ID, arg, reply)
                    })
                    .catch(error => {
                        console.log('caught', error);
                        reply(null, ID);
                    })
            } catch (err) {
                console.log("Exception detected: " + err);
                reply(null, ID);
            }
        } else if (this.type === "BotLocale") {
            try {
                this.getBotInfoFromParams(params, this.prefix).then( botInfo => {
                    console.log("ID for BotLocale: " + params.botName ,  botInfo)
                    if (!botInfo.botId) {
                        return reply(null, ID + " does not exist", null)
                    }
                    arg = 
                    { 
                        botId: botInfo.botId,
                        botVersion: DRAFT,
                        localeId: params.localeId,
                        count: 1
                    }
                    return this.runDelete(ID, arg, reply)
                })
                .catch(error => {
                    console.log('caught', error);
                    reply(null, ID);
                })
            } catch (err) {
                console.log("Exception detected: " + err);
                reply(null, ID);
            }
        } else if (this.type === 'Intent' && params.parentIntentSignature && params.parentIntentSignature === "AMAZON.FallbackIntent" ) {
            //FallbackIntent is a system defined intent that can't be deleted
            reply(null, ID, null)       
        } else if (this.type === "Intent") {
            try {
                this.getIntentInfoFromParams(params, this.prefix).then( botInfo => {
                    console.log("ID for Intent: " + params.botName ,  botInfo)
                    if (!botInfo.botId) {
                        return reply(null, ID + " does not exist", null)
                    }
                    arg = 
                    {
                        intentId: botInfo.intentId,
                        botId: botInfo.botId,
                        botVersion: DRAFT,
                        localeId: params.localeId,
                        count: 1
                    } 
                    return this.runDelete(ID, arg, reply)
                })
                .catch(error => {
                    console.log('caught', error);
                    reply(null, ID);
                })
            } catch (err) {
                console.log("Exception detected: " + err);
                reply(null, ID);
            }
        } else if (this.type === "SlotType") {
            try {
                this.getSlotTypeInfoFromParams(params, this.prefix).then( botInfo => {
                    console.log("ID for SlotType: " + params.botName ,  botInfo)
                    if (!botInfo.botId) {
                        return reply(null, ID + " does not exist", null)
                    }
                    arg = 
                    {
                        slotTypeId: botInfo.slotTypeId,
                        botId: botInfo.botId,
                        botVersion: DRAFT,
                        localeId: params.localeId,
                        count: 1
                    } 
                    return this.runDelete(ID, arg, reply)
                })
                .catch(error => {
                    console.log('caught', error);
                    reply(null, ID);
                })            
            } catch (err) {
                console.log("Exception detected: " + err);
                reply(null, ID);
            }
        } else {
            // Nothing should drop here
            return this.modelRunner.run(actions.DELETE, arg)
                .then(msg => reply(null, msg.name, null))
                .catch(function (error) {
                    console.log(error)
                    if (error.indexOf("NotFoundException") !== -1) {
                        reply(null, ID, null)
                    } else {
                        reply(error)
                    }
                })
        }

    }

    runDelete = (ID, arg, reply) => {
        console.log("Run Delete: " + ID, arg)
        if (!arg.botId || typeof arg.botId === "undefined") {
            console.error ("Bot ID is missing - nothing to delete")
            return reply(null, ID);
        }
        return this.modelRunner.run(actions.DELETE, arg)
            .then(msg => reply(null, msg.name, null))
            .catch(function (error) {
                console.log(error)
                if (error.indexOf("NotFoundException") !== -1) {
                    reply(null, ID, null)
                } else {
                    reply(error)
                }
            })
    }
}



module.exports = LexV2
