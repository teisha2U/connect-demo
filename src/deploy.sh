#!/bin/bash -v
set -e                        # Fail script on error

# example: ./deploy.sh client-dev us-east-1 073e9328-9243-4e65-a74e-e06c66112492 client-instance-name artifact-bucket user@client.com

PROFILE=${1}                            # AWS Profile to use for deploy
REGION=${2}                             # Deployment Region
CONNECT_ID=${3}                         # Used for naming
CONNECT_NAME=${4}                       # Used for naming
S3_BUCKET=${5}                          # Artifact Bucket - must be created beforehand
ADMIN_USER_EMAIL=${6}                   # Admin Email

CLI_COMMAND="run - ./deploy.sh <AWS_PROFILE> <AWS_REGION> <CONNECT_ID> <CONNECT_NAME> <S3_BUCKET> <ADMIN_USER_EMAIL>"

if [ -z "$PROFILE" ]
  then
    echo "Argument profile is required"
    echo "${CLI_COMMAND}"
    exit 1
fi

if [ -z "$REGION" ]
  then
    echo "Argument region is required"
    echo "${CLI_COMMAND}"
    exit 1
fi

if [ -z "$CONNECT_ID" ]
  then
    echo "Argument connect ID is required"
    echo "${CLI_COMMAND}"
    exit 1
fi

if [ -z "$CONNECT_NAME" ]
  then
    echo "Argument connect Name is required"
    echo "${CLI_COMMAND}"
    exit 1
fi

if [ -z "$S3_BUCKET" ]
  then
    echo "Argument s3 bucket is required"
    exit 1
fi


. ./build.sh

STACK_NAME=vf-admin-${CONNECT_ID}

sam deploy -t .aws-sam/build/template.yaml \
  --s3-bucket ${S3_BUCKET} \
  --s3-prefix vf-connect-admin \
  --capabilities CAPABILITY_IAM \
  --stack-name ${STACK_NAME} \
  --parameter-overrides ConnectInstanceId=${CONNECT_ID} ConnectInstanceName=${CONNECT_NAME} \
  --profile ${PROFILE} \
  --region ${REGION}
