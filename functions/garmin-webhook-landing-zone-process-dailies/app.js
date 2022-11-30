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
const s3Operation = require("/opt/utility/aws_s3_service.js");
const utils = require("/opt/utility/utils.js");
const lambdaGateway = require("/opt/utility/lambda_gateway.js");

const integration = process.env.integration;

exports.lambdaHandler = async (event, context, callback) => {
  const body = lambdaGateway.inputGateway(event, context);
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
    
  let transformedData;
  transformedData = utils.normalizeKeys(body.data);
  transformedData = utils.keepField(
    transformedData,
    utils.garminHeaderParams + utils.garminDailiesAllowedParams
  );
  body.data = transformedData
  lambdaGateway.outputGateway(JSON.stringify(body), callback);

};

function createMetadata(type, body, date) {
  return `Integration=${integration}&Type=${type}&Date=${date}&User=${body.userId}&Status=Unprocessed`;
}
