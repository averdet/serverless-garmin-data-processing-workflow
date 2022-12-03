/**
 * Lambda function to Handle Webhook Request
 *
 * @param {Object} event - Input event to the Lambda function
 * @param {Object} context - Lambda Context runtime methods and attributes
 *
 *
 */
const AWS = require("aws-sdk");
var moment = require("moment");
const utils = require("/opt/utility/utils.js");
const s3Operation = require("/opt/utility/aws_s3_service.js");
const lambdaGateway = require("/opt/utility/lambda_gateway.js");

const integration = process.env.integration;

exports.lambdaHandler = async (event, context, callback) => {
  const eventBody = lambdaGateway.inputGateway(event, context);
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
  responseBody.applyMapState = process.env.MAP_STATE === "true" ? true : false;
  let body = responseBody;
  const year = moment().format("YYYY");
  const month = moment().format("MM");
  const day = moment().format("DD");
  const prefix = "/" + body.type + "/" + year + "/" + month + "/" + day;
  const s3Promises = [];
  for (let i = 0; i < body.data.length; i++) {
    const key = body.data[i].userId + "_" + body.data[i].summaryId;
    metadata = createMetadata(
      body.type,
      body.data[i],
      moment().format("YYYY-MM-DD")
    );
    s3Promises.push(
      s3Operation.setPayload(
        key,
        process.env.BUCKET_NAME + prefix,
        JSON.stringify(body.data[i]),
        metadata
      )
    );
  }
  await Promise.all(s3Promises).then((pathValueLocation) => {
    pathValueLocation.forEach((value, index) => {
      body.data[index].landingZonePath = value;
    });
  });

  let transformedData = [];
  for (let i = 0; i < body.data.length; i++) {
    transformedData[i] = utils.normalizeKeys(body.data[i]);
    transformedData[i] = utils.keepField(
      transformedData[i],
      utils.garminHeaderParams + utils.garminDailiesAllowedParams
    );
  }
  body.data = transformedData;
  lambdaGateway.outputGateway(JSON.stringify(body), callback);
};

function createMetadata(type, body, date) {
  return `Integration=${integration}&Type=${type}&Date=${date}&User=${body.userId}&Status=Unprocessed`;
}
