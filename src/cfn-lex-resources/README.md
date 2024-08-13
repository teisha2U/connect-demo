# CFN Lambda
This is a modified version of library that runs custom Cloudformation builds.
It uses cfnlambda to run deploys of LexV2 bots.

Cloudformation requires a specific response,which cfnLambda library takes care of.
To roll your own, in your lambda function you need to return a SUCCESS or FAILED status to Cloudformation and your 'key' in the Data field like this:

response_data = {
    'Status': 'SUCCESS',
    'StackId': event['StackId'],
    'RequestId': event['RequestId'],
    'LogicalResourceId': event['LogicalResourceId'],
    'PhysicalResourceId': str(uuid.uuid4()) if event['RequestType'] == 'Create' else event['PhysicalResourceId'],
    'Data': {
        'Key': response['Parameter']['Value']
    }
}

## Tests
tests were removed
test are run using:
```shell
npm test
```
or
```shell
npm unit {{test-name}}
```
