/**
 * Lambda function to process Garmin Activity data.
 *
 * @param {Object} event - Input event to the Lambda function
 * @param {Object} context - Lambda Context runtime methods and attributes
 *
 *
 */
var AWS = require("aws-sdk");
const utils = require("./utility/utils.js");
const lambdaGateway = require("./utility/lambda_gateway.js");

const ggSdk = require('aws-greengrass-core-sdk');

const iotClient = new ggSdk.IotData();

exports.lambdaHandler = async (event, context, callback) => {
  //let body = lambdaGateway.inputGateway(event, context);
  const body = event.result;
  // normalize keys
  let transformedData = [];
  for (let i = 0; i < body.data.length; i++) {
    transformedData[i] = utils.normalizeKeys(body.data[i]);
    transformedData[i] = utils.keepField(
      transformedData[i],
      utils.garminHeaderParams + utils.garminDailiesAllowedParams
    );
  }
  body.data = transformedData

  const pubOpt = {
          topic: 'research/output/f4',
          payload: JSON.stringify({"result": body}),
          queueFullPolicy: 'AllOrError',
      };
      iotClient.publish(pubOpt, publishCallback);

  //lambdaGateway.outputGateway(JSON.stringify(body), callback);
};

function publishCallback(err, data) {
    console.log(err);
    console.log(data);
}