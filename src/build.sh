#!/bin/bash -v
set -e                  


echo "Building Lambdas"
cd src
npm run build
cd ..

echo "Copy dist.zip to custom resource"
cd dist
zip -r dist.zip .

sam build
