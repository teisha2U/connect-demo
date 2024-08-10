aws cloudformation deploy\
    --template-file pipeline/template.yaml\
    --stack-name "${PROJECT}-pipeline"\
    --parameter-overrides\
        Project="$PROJECT"\
        RepoName="$PROJECT"\
        ArtifactBucketName="$BOOTSTRAP_BUCKET_NAME"\
        RepoDevBranch="$DEV_BUILD_BRANCH"\
        DevEnvFile="$DEV_ENV_FILE"\
    --capabilities CAPABILITY_IAM\
    --region $AWS_DEFAULT_REGION