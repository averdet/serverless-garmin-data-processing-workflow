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
const s3Operation = require("./utility/aws_s3_service.js");
const lambdaGateway = require("./utility/lambda_gateway.js");
const utils = require("./utility/utils.js");

const integration = 'garmin';

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
        'health-integration-garmin' + prefix,
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
    transformedData[i] = utils.addNewField(transformedData[i], {
      calendar_date: moment(
        transformedData[i].start_time_in_seconds +
          transformedData[i].start_time_offset_in_seconds,
        "X"
      ).format("YYYY-MM-DD"),
      start_time: moment(
        transformedData[i].start_time_in_seconds +
          transformedData[i].start_time_offset_in_seconds,
        "X"
      ).format(),
      end_time: moment(
        transformedData[i].start_time_in_seconds +
          transformedData[i].start_time_offset_in_seconds +
          transformedData[i].duration_in_seconds,
        "X"
      ).format(),
    });
    transformedData[i] = utils.removeField(transformedData[i], [
      "start_time_in_seconds",
      "start_time_offset_in_seconds",
      "duration_in_seconds",
    ]);
  }
  body.data = transformedData;

  const pubOpt = {
          topic: 'research/output/f1f3f5',
          payload: JSON.stringify({"result": body}),
          queueFullPolicy: 'AllOrError',
  };
  iotClient.publish(pubOpt, publishCallback);
  //lambdaGateway.outputGateway(JSON.stringify(responseBody), callback);
};

function createMetadata(type, body, date) {
  return `Integration=${integration}&Type=${type}&Date=${date}&User=${body.userId}&Status=Unprocessed`;
}

function publishCallback(err, data) {
    console.log(err);
    console.log(data);
}