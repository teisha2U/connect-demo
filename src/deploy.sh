#!/bin/bash -v
set -e

# example: ./deploy.sh dev client lsft-athena-investigations lsoft b88acd3b-afb8-44d0-8c84-c16e3ee9a68e clientdev


STAGE=${1}
PROJECT=${2}
S3_BUCKET=${3}                          # Artifact Bucket - must be created beforehand
PROFILE=${4}                            # AWS Profile to use for deploy
CONNECT_ID=${5}                         # Used for naming
CONNECT_NAME=${6}                       # Used for naming
REGION=us-east-1

CLI_COMMAND="run - ./deploy.sh <STAGE> <PROJECT> <S3_BUCKET> <AWS_PROFILE> <CONNECT_ID> <CONNECT_NAME>"

if [ -z "$STAGE" ]
  then
    echo "Argument STAGE is required"
    echo "${CLI_COMMAND}"
    exit 1
fi

if [ -z "$PROJECT" ]
  then
    echo "Argument PROJECT is required"
    echo "${CLI_COMMAND}"
    exit 1
fi

if [ -z "$S3_BUCKET" ]
  then
    echo "Argument S3_BUCKET is required"
    echo "${CLI_COMMAND}"
    exit 1
fi

if [ -z "$PROFILE" ]
  then
    echo "Argument PROFILE is required"
    echo "${CLI_COMMAND}"
    exit 1
fi

if [ -z "$CONNECT_ID" ]
  then
    echo "Argument CONNECT_ID is required"
    exit 1
fi

if [ -z "$CONNECT_NAME" ]
  then
    echo "Argument connect Name is required"
    echo "${CLI_COMMAND}"
    exit 1
fi



. ./build.sh

STACK_NAME=demo-${CONNECT_ID}

sam deploy -t .aws-sam/build/template.yaml \
  --s3-bucket ${S3_BUCKET} \
  --s3-prefix connect-demo-bot-builder \
  --capabilities CAPABILITY_IAM \
  --stack-name ${STACK_NAME} \
  --parameter-overrides \
  ParameterKey=ConnectInstanceId,ParameterValue=${CONNECT_ID} \
  ParameterKey=ConnectInstanceName,ParameterValue=${CONNECT_NAME} \
  ParameterKey=Project,ParameterValue=${PROJECT} \
  ParameterKey=Stage,ParameterValue=${STAGE} \
  --profile ${PROFILE} \
  --region ${REGION}
