#!/bin/bash -v
set -e


STAGE=${1}
PROJECT=${2}
S3_BUCKET=${3}                          # Artifact Bucket - must be created beforehand
PROFILE=${4}
REGION=us-east-1

# example: ./connect-instance-meta/deploy.sh dev client lsft-athena-investigations lsoft
STACK_NAME=connect-meta-${PROJECT}-${STAGE}

CONNECT_ARN=$(aws cloudformation describe-stacks --stack-name connect-${PROJECT}-${STAGE} --region ${REGION} --query 'Stacks[0].Outputs[?OutputKey==`ConnectInstanceArn`].OutputValue | [0]' --output text)
echo "${CONNECT_ARN}"

sam deploy -t ./connect-instance-meta/template.yaml \
  --s3-bucket ${S3_BUCKET} \
  --s3-prefix ${STACK_NAME} \
  --capabilities CAPABILITY_IAM \
  --stack-name ${STACK_NAME} \
  --parameter-overrides ParameterKey=Stage,ParameterValue=${STAGE} \
  ParameterKey=Project,ParameterValue=${PROJECT} \
  ParameterKey=ConnectInstanceArn,ParameterValue="${CONNECT_ARN}" \
  --profile ${PROFILE} \
  --region ${REGION}