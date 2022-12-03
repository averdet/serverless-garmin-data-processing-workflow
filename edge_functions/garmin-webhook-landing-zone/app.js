/**
 * Lambda Function that performs saving of data into Landing Zone.
 * This Function performs batch write
 *
 * @param {Object} event - Input event to the Lambda function
 * @param {Object} context - Lambda Context runtime methods and attributes
 *
 *
 */
// let _ = require("lodash");
const AWS = require("aws-sdk");
var moment = require("moment");
const s3Operation = require("./utility/aws_s3_service.js");
const lambdaGateway = require("./utility/lambda_gateway.js");

const integration = 'garmin';

const ggSdk = require('aws-greengrass-core-sdk');

const iotClient = new ggSdk.IotData();

exports.lambdaHandler = async (event, context, callback) => {
  //const body = lambdaGateway.inputGateway(event, context);
  const body = event.result;
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

  const pubOpt = {
        topic: 'research/output/f3',
        payload: JSON.stringify({"result": body}),
        queueFullPolicy: 'AllOrError',
    };
    iotClient.publish(pubOpt, publishCallback);

  //lambdaGateway.outputGateway(JSON.stringify(body), callback);
};

function createMetadata(type, body, date) {
  return `Integration=${integration}&Type=${type}&Date=${date}&User=${body.userId}&Status=Unprocessed`;
}

function publishCallback(err, data) {
    console.log(err);
    console.log(data);
}