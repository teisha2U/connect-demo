// import { CloudFormationCustomResourceEvent, Context } from "aws-lambda";
// import { ICfnResponse } from "./models/ICfnResponse";
// import { ConnectService } from "./services/ConnectService";
// import { EnvConfigService } from "./services/envConfigService";
// import { AssociateLexBot} from "./legacySrc/lambdas/AssociateLexBot"

var cfnLambda = require("cfn-lambda");
var response = require("./lib/util/response");
var _ = require("lodash");
var Lex = require("./lib/lex");
var LexV2 = require("./lib/lexV2");

exports.handler = function (event, context, cb) {
  dispatch(event, context, cb);
};

function dispatch(event, context, cb) {
  console.log("event", JSON.stringify(event, null, 2));
  // var type = event.ResourceType.match(/Custom::(.*)/)
  // console.log(targets[type[1]])
  var Lextype = event.ResourceType.match(
    /Custom::(Lex|LexV2)(Bot|Locale|Alias|SlotType|Intent)/
  );
  if (_.get(Lextype, 2) === "Alias") Lextype[2] = "BotAlias";
  if (_.get(Lextype, 2) === "Locale") Lextype[2] = "BotLocale";
  console.log("LEXTYPE: ", Lextype);

  if (Lextype[1] === "Lex") {
    cfnLambda(new Lex(Lextype[2]))(event, context, cb);
    // } else if (targets[type[1]]) {
    //     return cfnLambda(new targets[type[1]])(event, context, cb)
  } else if (Lextype[1] === "LexV2") {
    cfnLambda(new LexV2(Lextype[2]))(event, context, cb);
  } else {
    response
      .send({
        event,
        context,
        reason: "Invalid resource type:" + event.ResourceType,
        responseStatus: response.FAILED,
      })
      .then(() => cb("Invalid resource type:" + event.ResourceType))
      .catch(cb);
  }
}

// not using these - this is just a lex deployer
/*
var targets = {
    CognitoRole: require('./lib/CognitoRole'),
    CognitoLogin: require('./lib/CognitoLogin'),
    CognitoDomain: require('./lib/CognitoDomain'),
    CognitoUrl: require('./lib/CognitoUrl'),
    S3Clear: require('./lib/S3Clear'),
    S3Version: require('./lib/S3Version'),
    S3Lambda: require('./lib/S3Lambda'),
    S3Unzip: require('./lib/S3Unzip'),
    Variable: require('./lib/Variable'),
    ApiCompression: require('./lib/ApiCompression'),
    ApiDeployment: require('./lib/ApiDeployment'),
    ElasticSearchUpdate: require('./lib/ElasticSearchUpdate'),
    ESCognitoClient: require('./lib/ESCognitoClient'),
    PreUpgradeExport: require('./lib/PreUpgradeExport'),
    PostUpgradeImport: require('./lib/PostUpgradeImport'),
    Kibana: require('./lib/base'),  // Kibana custom resource deprecated.. preserve entry here to avoid resource delete failure on stack upgrade.
}
*/
