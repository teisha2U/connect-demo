#!/bin/bash -v
set -e                        # Fail script on error

# example: ./connect-instance/deploy.sh dev client lsft-athena-investigations lsoft


STAGE=${1}
PROJECT=${2}
S3_BUCKET=${3}                          # Artifact Bucket - must be created beforehand
PROFILE=${4}
REGION=us-east-1



STACK_NAME=connect-${PROJECT}-${STAGE}

sam deploy -t ./connect-instance/template.yaml \
  --s3-bucket ${S3_BUCKET} \
  --s3-prefix ${STACK_NAME} \
  --capabilities CAPABILITY_IAM \
  --stack-name ${STACK_NAME} \
  --parameter-overrides ParameterKey=Stage,ParameterValue=${STAGE} \
  ParameterKey=Project,ParameterValue=${PROJECT} \
  ParameterKey=InstanceName,ParameterValue="${PROJECT}${STAGE}" \
  --profile ${PROFILE} \
  --region ${REGION}
