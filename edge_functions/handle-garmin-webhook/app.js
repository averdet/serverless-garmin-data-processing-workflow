/**
 * Lambda function to Handle Webhook Request
 *
 * @param {Object} event - Input event to the Lambda function
 * @param {Object} context - Lambda Context runtime methods and attributes
 *
 *
 */
const lambdaGateway = require("./utility/lambda_gateway.js");

const ggSdk = require('aws-greengrass-core-sdk');

const iotClient = new ggSdk.IotData();

exports.lambdaHandler = async (event, context, callback) => {
  //const eventBody = lambdaGateway.inputGateway(event, context);
  const eventBody = event.body;
  let responseBody;

  if (eventBody.dailies) {
    console.info("Garmin Dailies Available");
    responseBody = {
      type: "dailies",
      isBinary: false,
      data: eventBody.dailies,
    };
  } else if (eventBody.epochs) {
    console.info("Garmin Epochs Available");
    responseBody = {
      type: "epochs",
      isBinary: false,
      data: eventBody.epochs,
    };
  } else if (eventBody.activities) {
    console.info("Garmin Activities Available");
    responseBody = {
      type: "activities",
      isBinary: false,
      data: eventBody.activities,
    };
  } else if (eventBody.activityDetails) {
    console.info("Garmin Activity Details Available");
    responseBody = {
      type: "activityDetails",
      isBinary: false,
      data: eventBody.activityDetails,
    };
  } else if (eventBody.activityFiles) {
    console.info("Garmin Activity Files Available");
    responseBody = {
      type: "activityFiles",
      isBinary: true,
      data: eventBody.activityFiles,
    };
  } else {
    console.info("Garmin Format Unsupported - Please Conteact Admin");
    responseBody = {
      type: "unsupported",
      data: null,
    };
  }

  responseBody.sendDataToBackend =
    process.env.SEND_DATA_BACKEND === "True" ? true : false;
  responseBody.applyMapState =
    process.env.MAP_STATE === "true" ? true : false;

  const pubOpt = {
      topic: 'research/output/f1',
      payload: JSON.stringify({"result": responseBody}),
      queueFullPolicy: 'AllOrError',
  };
  iotClient.publish(pubOpt, publishCallback);
  //lambdaGateway.outputGateway(JSON.stringify(responseBody), callback);
};

function publishCallback(err, data) {
    console.log(err);
    console.log(data);
}