#!/bin/bash -v
set -e


echo "Building Lambdas"
npm run build


# echo "Copy dist.zip to custom resource"
# cd dist
# zip -r dist.zip .

sam build
