set -e  

PROFILE=${1:-"lsoft"}  # AWS Profile to use for deploy
REGION=${2:-"us-east-1"}          # Deployment Region
BUCKET=${3:-"lsft-athena-investigations"}   # Artifact Bucket - must be created beforehand
ENVIRONMENT=${4:-"dev"}
CONNECT_INSTANCE_ID=${5:-"8ac5630c-0f25-4447-b91a-bc87c6630a64"}
LOGGING_LEVEL=${6:-"info"}


if [ $# -le 5 ]; then
    echo "Parameters are missing.  Please double-check the parameters passed to this script"
    exit 1
fi

CLIENT="dlt2"
PROJECT="lexV2"
PREFIX="${CLIENT}"     



# Build sample bot
echo "Building SampleBot"
cd sample-bot
npm install
npm run build
cp package.json .aws-sam/build/RoutingFulfillmentLambda
cd ..
pwd


TEMPLATE="template.yaml"
STACK_NAME="$CLIENT-$PROJECT-$ENVIRONMENT"
echo " ================================ "
echo $CONNECT_INSTANCE_ID
echo $LOGGING_LEVEL
echo "================ Start SAM Build ================"

sam build --template $TEMPLATE && \
sam deploy \
  --stack-name $STACK_NAME \
  --s3-bucket $BUCKET \
  --s3-prefix $STACK_NAME \
  --tags \
    "Client"=$CLIENT \
    "Project"=$PROJECT \
    "Environment"=$ENVIRONMENT \
  --parameter-overrides \
    ParameterKey=Client,ParameterValue="${CLIENT}" \
    ParameterKey=Project,ParameterValue="${PROJECT}" \
    ParameterKey=Environment,ParameterValue="${ENVIRONMENT}" \
    ParameterKey=ConnectInstanceId,ParameterValue="${CONNECT_INSTANCE_ID}" \
    ParameterKey=Prefix,ParameterValue="${PREFIX}" \
    ParameterKey=LoggingLevel,ParameterValue="${LOGGING_LEVEL}" \
  --capabilities CAPABILITY_IAM CAPABILITY_AUTO_EXPAND CAPABILITY_NAMED_IAM \
  --region $REGION \
  --profile $PROFILE