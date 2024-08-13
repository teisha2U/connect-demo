
exports.actions = {
	CREATE: "CREATE",
	UPDATE: "UPDATE",
	DELETE: "DELETE",
}


exports.convertConversationLogs = (cf_config) => {
    let returnString = '{'
    if ( cf_config.logSettings ) {
        returnString = returnString + '"logSettings": ['
        cf_config.logSettings.forEach ( logSetting => {
            returnString = returnString + `{"logType": "${logSetting.logType}", "destination":"${logSetting.destination}", "resourceArn":"${logSetting.resourceArn}"}`
        })
        returnString = returnString + '],'
    }
    returnString = returnString + ` "iamRoleArn":"${cf_config.iamRoleArn}"`

    return returnString + '}'
}


exports.pause  = ( waitLength) => {
    return new Promise ( (resolve) => {
      setTimeout(  () => {
        console.log("WAIT:: " + waitLength + " seconds ")
        return resolve('waited')
      }, waitLength * 1000)
    } )
}
// const expectedString = '{"logSettings": [{"logType": "TEXT","destination": "CLOUDWATCH_LOGS", "resourceArn": "arn:aws:logs:us-east-1:813837579429:log-group:TT_test_Flow_InkSubscriptionLogGroup:*"}], "iamRoleArn":"arn:aws:iam::813837579429:role/hp-connect-lex-test-FlowBots-1K4-CloudWatchLexRole-1W4WX0IF1NLXH"}'
// const input = {
//     "botName": "TT_test_Flow_InkSubscriptionBot",
//     "conversationLogs": {
//         "iamRoleArn": "arn:aws:iam::813837579429:role/hp-connect-lex-test-FlowBots-1OM-CloudWatchLexRole-1G8I8V52IYFNR",
//         "logSettings": [
//             {
//                 "logType": "TEXT",
//                 "destination": "CLOUDWATCH_LOGS",
//                 "resourceArn": "arn:aws:logs:us-east-1:813837579429:log-group:TT_test_Flow_InkSubscriptionLogGroup:*"
//             }
//         ]
//     },
//     "name": "live",
//     "description": "Get Data to support ink subscriptions",
//     "botVersion": "1"
// }